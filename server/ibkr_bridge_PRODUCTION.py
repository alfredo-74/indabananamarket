#!/usr/bin/env python3
"""
IBKR Production Bridge - Production-Ready for https://bananamarket.replit.app
Connects to Interactive Brokers and streams market data, DOM, and portfolio updates
"""

import asyncio
import json
import sys
import os
import requests
from datetime import datetime
from ib_insync import IB, Future, MarketOrder, util
import nest_asyncio

nest_asyncio.apply()

# Production backend URL - hardcoded for simplicity
PRODUCTION_URL = "https://bananamarket.replit.app"

class IBKRBridge:
    def __init__(self, replit_url: str):
        self.ib = IB()
        self.connected = False
        self.replit_url = replit_url.rstrip('/')
        self.display_contract = None  # ES contract for price display
        self.trade_contract = None    # MES contract for actual trading
        self.last_price = 0.0
        self.bid = 0.0
        self.ask = 0.0
        self.volume = 0
        self.port = 4002  # IB Gateway paper trading port
        
        # Portfolio tracking
        self.current_position = 0
        self.entry_price = None
        self.unrealized_pnl = 0.0
        self.realized_pnl = 0.0
        
        # Account data
        self.account_balance = 0.0
        self.net_liquidation = 0.0
        self.available_funds = 0.0
        self.daily_pnl = 0.0
        self.last_account_update = 0
        
        # Level II DOM data
        self.dom_bids = []
        self.dom_asks = []
        
        print(f"Bridge initialized - Will forward data to: {self.replit_url}", file=sys.stderr)
    
    async def connect(self):
        """Connect to IBKR Paper Trading via IB Gateway"""
        try:
            print("Connecting to IB Gateway on port 4002...", file=sys.stderr)
            await self.ib.connectAsync('127.0.0.1', self.port, clientId=1)
            self.connected = True
            print("✅ Connected to IBKR Paper Trading", file=sys.stderr)
            
            # Set up ES futures contract for DISPLAY
            self.display_contract = Future('ES', exchange='CME')
            display_contracts = await self.ib.qualifyContractsAsync(self.display_contract)
            
            if display_contracts:
                self.display_contract = sorted(display_contracts, key=lambda c: c.lastTradeDateOrContractMonth)[0]
                print(f"✅ ES display contract: {self.display_contract.lastTradeDateOrContractMonth}", file=sys.stderr)
            else:
                self.display_contract = Future('ES', '202512', 'CME')
                await self.ib.qualifyContractsAsync(self.display_contract)
            
            # Set up MES futures contract for TRADING
            self.trade_contract = Future('MES', exchange='CME')
            trade_contracts = await self.ib.qualifyContractsAsync(self.trade_contract)
            
            if trade_contracts:
                self.trade_contract = sorted(trade_contracts, key=lambda c: c.lastTradeDateOrContractMonth)[0]
                print(f"✅ MES trading contract: {self.trade_contract.lastTradeDateOrContractMonth}", file=sys.stderr)
            else:
                self.trade_contract = Future('MES', '202512', 'CME')
                await self.ib.qualifyContractsAsync(self.trade_contract)
            
            # Request REAL-TIME Level II market data
            self.ib.reqMarketDataType(1)  # 1 = real-time data
            
            # Subscribe to ES market data
            self.ib.reqMktData(self.display_contract, '', False, False)
            
            # Subscribe to Level II DOM (Depth of Market)
            self.ib.reqMktDepth(self.display_contract, numRows=10)
            
            # Set up event handlers
            self.ib.updateEvent += self._on_dom_update
            self.ib.newOrderEvent += self._on_order_update
            self.ib.orderStatusEvent += self._on_order_status
            
            # Subscribe to position updates
            self.ib.positionEvent += self._on_position_update
            self.ib.pnlEvent += self._on_pnl_update
            
            # Request current positions
            await self._request_positions()
            
            return True
            
        except Exception as e:
            print(f"❌ Connection failed: {e}", file=sys.stderr)
            self.connected = False
            return False
    
    async def _request_positions(self):
        """Request current portfolio positions"""
        try:
            positions = self.ib.positions()
            print(f"Current positions: {len(positions)}", file=sys.stderr)
            
            for pos in positions:
                print(f"  - {pos.contract.symbol}: {pos.position} @ {pos.avgCost}", file=sys.stderr)
                if pos.contract.symbol in ['MES', 'ES']:
                    self.current_position = int(pos.position)
                    self.entry_price = float(pos.avgCost)
                    await self._forward_portfolio_update()
            
            # Request account summary for P&L
            account_values = self.ib.accountSummary()
            for item in account_values:
                if item.tag == 'UnrealizedPnL':
                    self.unrealized_pnl = float(item.value)
                elif item.tag == 'RealizedPnL':
                    self.realized_pnl = float(item.value)
            
            if self.current_position != 0:
                await self._forward_portfolio_update()
                
        except Exception as e:
            print(f"Error requesting positions: {e}", file=sys.stderr)
    
    def _on_position_update(self, position):
        """Handle position updates from IBKR"""
        try:
            if position.contract.symbol in ['MES', 'ES']:
                self.current_position = int(position.position)
                self.entry_price = float(position.avgCost) if position.avgCost else None
                print(f"📊 Position update: {position.contract.symbol} {self.current_position} @ {self.entry_price}", file=sys.stderr)
                asyncio.create_task(self._forward_portfolio_update())
        except Exception as e:
            print(f"Error in position update handler: {e}", file=sys.stderr)
    
    def _on_pnl_update(self, pnl):
        """Handle P&L updates from IBKR"""
        try:
            if pnl.unrealizedPnL and not util.isNan(pnl.unrealizedPnL):
                self.unrealized_pnl = float(pnl.unrealizedPnL)
            if pnl.realizedPnL and not util.isNan(pnl.realizedPnL):
                self.realized_pnl = float(pnl.realizedPnL)
            asyncio.create_task(self._forward_portfolio_update())
        except Exception as e:
            print(f"Error in P&L update handler: {e}", file=sys.stderr)
    
    def _on_order_update(self, trade):
        """Handle new order events"""
        try:
            print(f"📝 New order: {trade.order.orderId} - {trade.order.action} {trade.order.totalQuantity}", file=sys.stderr)
        except Exception as e:
            print(f"Error in order update handler: {e}", file=sys.stderr)
    
    def _on_order_status(self, trade):
        """Handle order status changes"""
        try:
            status = trade.orderStatus.status
            print(f"📋 Order {trade.order.orderId} status: {status}", file=sys.stderr)
            
            # When order is filled, positions will update automatically via _on_position_update
            if status == 'Filled':
                print(f"✅ Order filled: {trade.order.action} {trade.order.totalQuantity} @ {trade.orderStatus.avgFillPrice}", file=sys.stderr)
                
        except Exception as e:
            print(f"Error in order status handler: {e}", file=sys.stderr)
    
    async def _fetch_account_data(self):
        """Fetch comprehensive account data from IBKR"""
        try:
            account_summary = self.ib.accountSummary()
            
            for item in account_summary:
                if item.tag == 'NetLiquidation':
                    self.net_liquidation = float(item.value)
                elif item.tag == 'TotalCashValue':
                    self.account_balance = float(item.value)
                elif item.tag == 'AvailableFunds':
                    self.available_funds = float(item.value)
                elif item.tag == 'UnrealizedPnL':
                    self.unrealized_pnl = float(item.value)
                elif item.tag == 'RealizedPnL':
                    self.realized_pnl = float(item.value)
                elif item.tag == 'DailyPnL':
                    self.daily_pnl = float(item.value)
            
            print(f"💰 Account: Balance=${self.account_balance:.2f}, NetLiq=${self.net_liquidation:.2f}, DailyPnL=${self.daily_pnl:.2f}", file=sys.stderr)
            
        except Exception as e:
            print(f"Error fetching account data: {e}", file=sys.stderr)
    
    async def _forward_account_data(self):
        """Forward account data to Replit backend"""
        try:
            data = {
                "type": "account_data",
                "account_balance": self.account_balance,
                "net_liquidation": self.net_liquidation,
                "available_funds": self.available_funds,
                "unrealized_pnl": self.unrealized_pnl,
                "realized_pnl": self.realized_pnl,
                "daily_pnl": self.daily_pnl,
                "timestamp": int(datetime.now().timestamp() * 1000)
            }
            
            response = requests.post(
                f"{self.replit_url}/api/bridge/data",
                json=data,
                timeout=2
            )
            
            if response.status_code == 200:
                print(f"📤 Account data sent: Balance=${self.account_balance:.2f}, Daily PnL=${self.daily_pnl:.2f}", file=sys.stderr)
            else:
                print(f"⚠️ Account data update failed: {response.status_code}", file=sys.stderr)
                
        except Exception as e:
            print(f"Error forwarding account data: {e}", file=sys.stderr)
    
    async def _forward_portfolio_update(self):
        """Forward portfolio updates to Replit backend"""
        try:
            # Calculate market price for unrealized P&L
            market_price = self.last_price if self.last_price > 0 else (self.entry_price or 0)
            
            data = {
                "type": "portfolio_update",
                "contracts": self.current_position,
                "entry_price": self.entry_price if self.entry_price else 0,
                "unrealized_pnl": self.unrealized_pnl,
                "market_price": market_price
            }
            
            response = requests.post(
                f"{self.replit_url}/api/bridge/data",
                json=data,
                timeout=2
            )
            
            if response.status_code == 200:
                print(f"📤 Portfolio update sent: POS={self.current_position}, uPnL=${self.unrealized_pnl:.2f}", file=sys.stderr)
            else:
                print(f"⚠️ Portfolio update failed: {response.status_code}", file=sys.stderr)
                
        except Exception as e:
            print(f"Error forwarding portfolio update: {e}", file=sys.stderr)
    
    def _on_dom_update(self):
        """Handler for DOM updates"""
        try:
            if not self.connected or not self.display_contract:
                return
            
            ticker = self.ib.ticker(self.display_contract)
            
            if ticker and hasattr(ticker, 'domBids') and hasattr(ticker, 'domAsks'):
                self.dom_bids = [(level.price, level.size) for level in ticker.domBids if level.price > 0]
                self.dom_asks = [(level.price, level.size) for level in ticker.domAsks if level.price > 0]
        except Exception as e:
            print(f"Error updating DOM: {e}", file=sys.stderr)
    
    async def send_historical_data(self, days: int = 5):
        """Fetch and send historical data for CVA calculation"""
        try:
            print(f"📊 Fetching {days} days of historical data...", file=sys.stderr)
            
            bars = await self.ib.reqHistoricalDataAsync(
                self.display_contract,
                endDateTime='',
                durationStr=f'{days} D',
                barSizeSetting='5 mins',
                whatToShow='TRADES',
                useRTH=True,
                formatDate=1
            )
            
            if not bars:
                print("⚠️ No historical data returned", file=sys.stderr)
                return
            
            print(f"✅ Received {len(bars)} bars", file=sys.stderr)
            
            # Group by date
            daily_bars = {}
            for bar in bars:
                date_str = bar.date.strftime('%Y-%m-%d')
                if date_str not in daily_bars:
                    daily_bars[date_str] = []
                
                daily_bars[date_str].append({
                    "timestamp": int(bar.date.timestamp() * 1000),
                    "open": float(bar.open),
                    "high": float(bar.high),
                    "low": float(bar.low),
                    "close": float(bar.close),
                    "volume": int(bar.volume)
                })
            
            # Send each day's data
            for date in sorted(daily_bars.keys()):
                data = {
                    "type": "historical_bars",
                    "date": date,
                    "bars": daily_bars[date]
                }
                
                response = requests.post(
                    f"{self.replit_url}/api/bridge/data",
                    json=data,
                    timeout=5
                )
                
                if response.status_code == 200:
                    print(f"✅ Sent {date}: {len(daily_bars[date])} bars", file=sys.stderr)
                else:
                    print(f"⚠️ Failed to send {date}: {response.status_code}", file=sys.stderr)
            
            print(f"🎉 Historical data upload complete - {len(daily_bars)} days sent", file=sys.stderr)
            
        except Exception as e:
            print(f"❌ Error sending historical data: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
    
    async def stream_market_data(self):
        """Stream real-time market data and DOM to Replit"""
        print("🚀 Starting real-time data stream...", file=sys.stderr)
        
        # Fetch account data immediately on startup
        await self._fetch_account_data()
        await self._forward_account_data()
        
        while self.connected:
            try:
                current_time = datetime.now().timestamp()
                
                # Fetch account data every 30 seconds
                if current_time - self.last_account_update >= 30:
                    await self._fetch_account_data()
                    await self._forward_account_data()
                    self.last_account_update = current_time
                
                ticker = self.ib.ticker(self.display_contract)
                
                # Update local values
                if ticker and ticker.last and not util.isNan(ticker.last):
                    self.last_price = float(ticker.last)
                if ticker and ticker.bid and not util.isNan(ticker.bid):
                    self.bid = float(ticker.bid)
                if ticker and ticker.ask and not util.isNan(ticker.ask):
                    self.ask = float(ticker.ask)
                if ticker and ticker.volume and not util.isNan(ticker.volume):
                    self.volume = int(ticker.volume)
                
                # Send market data
                market_data = {
                    "type": "market_data",
                    "symbol": "ES",
                    "last_price": self.last_price,
                    "bid": self.bid,
                    "ask": self.ask,
                    "volume": self.volume,
                    "timestamp": int(datetime.now().timestamp() * 1000)
                }
                
                response = requests.post(
                    f"{self.replit_url}/api/bridge/data",
                    json=market_data,
                    timeout=1
                )
                print(f"📤 Tick sent: ES @ {self.last_price:.2f}", file=sys.stderr)
                
                # Send DOM data
                if self.dom_bids or self.dom_asks:
                    dom_data = {
                        "type": "dom",
                        "bids": self.dom_bids[:10],
                        "asks": self.dom_asks[:10],
                        "timestamp": int(datetime.now().timestamp() * 1000)
                    }
                    
                    requests.post(
                        f"{self.replit_url}/api/bridge/data",
                        json=dom_data,
                        timeout=1
                    )
                    print(f"📤 DOM update sent ({len(self.dom_bids)} bids, {len(self.dom_asks)} asks)", file=sys.stderr)
                
                await asyncio.sleep(0.5)  # 500ms updates
                
            except Exception as e:
                print(f"⚠️ Error in data stream: {e}", file=sys.stderr)
                import traceback
                traceback.print_exc(file=sys.stderr)
                await asyncio.sleep(1)
    
    async def place_order(self, action: str, quantity: int):
        """Place a market order"""
        try:
            order = MarketOrder(action, quantity)
            trade = self.ib.placeOrder(self.trade_contract, order)
            print(f"📝 Order placed: {action} {quantity} MES", file=sys.stderr)
            return {"success": True, "order_id": trade.order.orderId}
        except Exception as e:
            print(f"❌ Order failed: {e}", file=sys.stderr)
            return {"success": False, "error": str(e)}
    
    def disconnect(self):
        """Disconnect from IBKR"""
        if self.connected:
            self.ib.disconnect()
            self.connected = False
            print("👋 Disconnected from IBKR", file=sys.stderr)

async def main():
    """Main entry point - automatically uses production URL"""
    print("=" * 70, file=sys.stderr)
    print("🏎️  IBKR PRODUCTION BRIDGE FOR BANANAMARKET", file=sys.stderr)
    print("=" * 70, file=sys.stderr)
    print(f"🔗 Production URL: {PRODUCTION_URL}", file=sys.stderr)
    print("=" * 70, file=sys.stderr)
    
    bridge = IBKRBridge(PRODUCTION_URL)
    
    try:
        # Connect to IBKR
        if not await bridge.connect():
            print("❌ Failed to connect to IBKR", file=sys.stderr)
            return
        
        # Send historical data for CVA
        await bridge.send_historical_data(days=5)
        
        # Start streaming real-time data
        await bridge.stream_market_data()
        
    except KeyboardInterrupt:
        print("\n⏹️ Stopping bridge...", file=sys.stderr)
    finally:
        bridge.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
