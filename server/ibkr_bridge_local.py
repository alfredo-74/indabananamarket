#!/usr/bin/env python3
"""
🔥 IBKR BRIDGE - LOCAL VERSION ✅
==================================
✅ Connects to LOCAL Node.js server on localhost:5000
✅ Run this on your Chromebook alongside the Node.js server
✅ No dev/production confusion - everything runs locally

Connects to Interactive Brokers and streams market data, DOM, portfolio, AND ACCOUNT METRICS
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

# Local backend URL (Node.js server running on your Chromebook)
LOCAL_URL = "http://localhost:5000"

class IBKRBridgeV2:
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
        
        # Track if event handlers are registered (prevent duplicate bindings)
        self.handlers_registered = False
        
        # Track fatal errors (authentication, permission issues)
        self.fatal_error = False
        self.fatal_error_message = None
        
        print(f"🚀 Bridge LOCAL initialized - Will forward data to: {self.replit_url}", file=sys.stderr)
    
    async def connect(self, retry_count=0, max_retries=10):
        """Connect to IBKR Paper Trading via IB Gateway with retry logic"""
        try:
            if retry_count == 0:
                print("Connecting to IB Gateway on port 4002...", file=sys.stderr)
            else:
                print(f"🔄 Retry attempt {retry_count}/{max_retries}...", file=sys.stderr)
                
            await self.ib.connectAsync('127.0.0.1', self.port, clientId=1)
            self.connected = True
            print("✅ CONNECTED to IBKR Paper Trading", file=sys.stderr)
            
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
            
            # Set up event handlers ONCE (prevent duplicate bindings on reconnect)
            if not self.handlers_registered:
                self.ib.updateEvent += self._on_dom_update
                self.ib.newOrderEvent += self._on_order_update
                self.ib.orderStatusEvent += self._on_order_status
                self.ib.positionEvent += self._on_position_update
                self.ib.pnlEvent += self._on_pnl_update
                self.handlers_registered = True
                print("✅ Event handlers registered", file=sys.stderr)
            else:
                print("✅ Event handlers already registered (skipping)", file=sys.stderr)
            
            # Request current positions
            await self._request_positions()
            
            return True
            
        except Exception as e:
            self.connected = False
            error_msg = str(e)
            
            # Detect FATAL errors that won't resolve with retry
            fatal_errors = [
                "not connected",  # Invalid credentials
                "Authentication failed",
                "Invalid username",
                "Invalid password",
                "Permission denied",
                "API key invalid"
            ]
            
            is_fatal = any(fatal_str in error_msg for fatal_str in fatal_errors)
            
            if is_fatal:
                self.fatal_error = True
                self.fatal_error_message = str(e)
                print(f"❌ FATAL ERROR - Cannot retry: {e}", file=sys.stderr)
                print(f"   Check IBKR credentials and gateway configuration", file=sys.stderr)
                return False
            
            if retry_count < max_retries:
                wait_time = min(2 ** retry_count, 30)  # Exponential backoff, max 30s
                print(f"❌ Connection failed: {e}", file=sys.stderr)
                print(f"⏳ Waiting {wait_time}s before retry...", file=sys.stderr)
                await asyncio.sleep(wait_time)
                return await self.connect(retry_count + 1, max_retries)
            else:
                print(f"❌ DISCONNECTED - Max retries ({max_retries}) exceeded: {e}", file=sys.stderr)
                print(f"   This may be a persistent issue - check IB Gateway", file=sys.stderr)
                return False
    
    async def _request_positions(self):
        """Request current portfolio positions"""
        try:
            positions = self.ib.positions()
            print(f"Current positions: {len(positions)}", file=sys.stderr)
            
            # CRITICAL FIX: Reset position to 0 before checking IBKR positions
            # This prevents phantom positions from persisting when user is actually FLAT
            mes_es_position_found = False
            self.current_position = 0
            self.entry_price = None
            self.unrealized_pnl = 0.0
            
            for pos in positions:
                print(f"  - {pos.contract.symbol}: {pos.position} @ {pos.avgCost}", file=sys.stderr)
                if pos.contract.symbol in ['MES', 'ES']:
                    mes_es_position_found = True
                    self.current_position = int(pos.position)
                    self.entry_price = float(pos.avgCost) if pos.avgCost else None
            
            # Request account summary for P&L
            account_values = self.ib.accountSummary()
            for item in account_values:
                if item.tag == 'UnrealizedPnL' and self.current_position != 0:
                    self.unrealized_pnl = float(item.value)
                elif item.tag == 'RealizedPnL':
                    self.realized_pnl = float(item.value)
            
            # ALWAYS forward position update, even if FLAT (contracts=0)
            # This ensures phantom positions get cleared immediately
            await self._forward_portfolio_update()
            
            if mes_es_position_found:
                print(f"✅ MES/ES position: {self.current_position} @ {self.entry_price}", file=sys.stderr)
            else:
                print(f"✅ No MES/ES position - FLAT", file=sys.stderr)
                
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
        """Handle order status changes and send confirmation to trading system"""
        try:
            status = trade.orderStatus.status
            order_id = str(trade.order.orderId)
            print(f"📋 Order {order_id} status: {status}", file=sys.stderr)
            
            # Detect terminal states and send confirmation
            confirmation_status = None
            filled_price = None
            filled_time = None
            reject_reason = None
            
            status_lower = status.lower()
            
            if status_lower == 'filled':
                confirmation_status = 'FILLED'
                filled_price = float(trade.orderStatus.avgFillPrice) if trade.orderStatus.avgFillPrice else None
                filled_time = int(datetime.now().timestamp() * 1000)
                print(f"✅ Order filled: {trade.order.action} {trade.order.totalQuantity} @ {filled_price}", file=sys.stderr)
            elif status_lower in ['cancelled', 'apicancelled']:
                confirmation_status = 'CANCELLED'
                reject_reason = 'Order cancelled'
                print(f"⚠️ Order cancelled: {order_id}", file=sys.stderr)
            elif status_lower in ['rejected', 'error']:
                confirmation_status = 'REJECTED'
                # Try to get reject reason from trade log
                reject_reason = str(trade.log[-1].message) if trade.log and len(trade.log) > 0 else 'Order rejected by IBKR'
                print(f"❌ Order REJECTED: {order_id} - {reject_reason}", file=sys.stderr)
            
            # Send confirmation to Safety Manager for terminal states
            if confirmation_status:
                asyncio.create_task(self._send_order_confirmation(
                    order_id,
                    confirmation_status,
                    filled_price,
                    filled_time,
                    reject_reason
                ))
                
        except Exception as e:
            print(f"Error in order status handler: {e}", file=sys.stderr)
    
    async def _send_order_confirmation(self, order_id: str, status: str, filled_price: float = None, filled_time: int = None, reject_reason: str = None):
        """Send order confirmation to trading system Safety Manager"""
        try:
            # SECURITY: Get safety auth key from environment
            import os
            safety_auth_key = os.environ.get('SAFETY_AUTH_KEY')
            if not safety_auth_key:
                print("❌ SAFETY_AUTH_KEY not set - cannot send order confirmations!", file=sys.stderr)
                return
            
            payload = {
                "order_id": order_id,
                "status": status,
                "filled_price": filled_price,
                "filled_time": filled_time,
                "reject_reason": reject_reason
            }
            
            # SECURITY: Send auth key in header
            headers = {
                'x-safety-auth-key': safety_auth_key,
                'Content-Type': 'application/json'
            }
            
            # Use asyncio.to_thread to prevent blocking event loop
            response = await asyncio.to_thread(
                requests.post,
                f"{self.replit_url}/api/order-confirmation",
                json=payload,
                headers=headers,
                timeout=2
            )
            
            if response.status_code == 200:
                print(f"✅ Order confirmation sent: {order_id} - {status}", file=sys.stderr)
            elif response.status_code == 401:
                print(f"❌ Order confirmation UNAUTHORIZED - check SAFETY_AUTH_KEY", file=sys.stderr)
            else:
                print(f"⚠️ Order confirmation failed: {order_id} - HTTP {response.status_code}", file=sys.stderr)
                
        except Exception as e:
            print(f"❌ Error sending order confirmation: {e}", file=sys.stderr)
    
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
            
            # CRITICAL SANITY CHECK #1: Absolute range check for ES/MES
            # ES/MES trade between 1000-15000 under normal conditions
            # Anything outside this range is corrupt data from IBKR
            validated_entry_price = self.entry_price
            if self.entry_price:
                if self.entry_price < 1000 or self.entry_price > 15000:
                    print(f"⚠️ CORRUPT ENTRY PRICE DETECTED: {self.entry_price} (outside valid range 1000-15000)", file=sys.stderr)
                    print(f"⚠️ REJECTING corrupt data - BLOCKING position update until valid data received", file=sys.stderr)
                    return  # Don't send this update at all - wait for valid data
                
                # CRITICAL SANITY CHECK #2: Relative check against market price (if available)
                if market_price > 0:
                    price_ratio = abs(self.entry_price / market_price)
                    if price_ratio > 3.0 or price_ratio < 0.33:
                        print(f"⚠️ CORRUPT ENTRY PRICE DETECTED: {self.entry_price} vs market {market_price} (ratio: {price_ratio:.2f}x)", file=sys.stderr)
                        print(f"⚠️ REJECTING corrupt data - BLOCKING position update", file=sys.stderr)
                        return  # Don't send this update at all
            
            data = {
                "type": "portfolio_update",
                "contracts": self.current_position,
                "entry_price": validated_entry_price if validated_entry_price else 0,
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
        
        # Track last position refresh time
        last_position_refresh = 0
        last_order_check = 0
        
        while self.connected:
            try:
                # Connection health check - detect IBKR disconnection
                if not self.ib.isConnected():
                    print("❌ DISCONNECTED - IBKR connection lost", file=sys.stderr)
                    self.connected = False
                    break
                
                current_time = datetime.now().timestamp()
                
                # Fetch account data every 30 seconds
                if current_time - self.last_account_update >= 30:
                    await self._fetch_account_data()
                    await self._forward_account_data()
                    self.last_account_update = current_time
                
                # CRITICAL: Refresh positions every 10 seconds to catch phantom position fixes
                if current_time - last_position_refresh >= 10:
                    await self._request_positions()
                    last_position_refresh = current_time
                
                # CRITICAL: Check for pending orders every 2 seconds (for Close Position button)
                if current_time - last_order_check >= 2:
                    await self._check_pending_orders()
                    last_order_check = current_time
                
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
                
                try:
                    response = requests.post(
                        f"{self.replit_url}/api/bridge/data",
                        json=market_data,
                        timeout=1
                    )
                    if response.status_code == 200:
                        print(f"📤 Tick sent: ES @ {self.last_price:.2f}", file=sys.stderr)
                    else:
                        print(f"❌ HTTP {response.status_code}: {response.text[:100]}", file=sys.stderr)
                except requests.exceptions.RequestException as e:
                    print(f"❌ Request failed: {type(e).__name__}: {str(e)}", file=sys.stderr)
                
                # Send DOM data
                if self.dom_bids or self.dom_asks:
                    dom_data = {
                        "type": "dom",
                        "bids": self.dom_bids[:10],
                        "asks": self.dom_asks[:10],
                        "timestamp": int(datetime.now().timestamp() * 1000)
                    }
                    
                    try:
                        response = requests.post(
                            f"{self.replit_url}/api/bridge/data",
                            json=dom_data,
                            timeout=1
                        )
                        if response.status_code == 200:
                            print(f"📤 DOM update sent ({len(self.dom_bids)} bids, {len(self.dom_asks)} asks)", file=sys.stderr)
                        else:
                            print(f"❌ DOM HTTP {response.status_code}: {response.text[:100]}", file=sys.stderr)
                    except requests.exceptions.RequestException as e:
                        print(f"❌ DOM Request failed: {type(e).__name__}: {str(e)}", file=sys.stderr)
                
                await asyncio.sleep(0.5)  # 500ms updates
                
            except Exception as e:
                print(f"⚠️ Error in data stream: {e}", file=sys.stderr)
                import traceback
                traceback.print_exc(file=sys.stderr)
                await asyncio.sleep(1)
    
    async def _check_pending_orders(self):
        """Check for and execute pending orders from the server"""
        try:
            response = requests.get(
                f"{self.replit_url}/api/pending-orders",
                timeout=2
            )
            
            if response.status_code != 200:
                return
            
            pending_orders = response.json()
            
            for order_data in pending_orders:
                order_id = order_data.get('id')
                action = order_data.get('action')
                quantity = order_data.get('quantity')
                
                if not order_id or not action or not quantity:
                    continue
                
                print(f"🔔 Executing pending order: {action} {quantity} MES (ID: {order_id})", file=sys.stderr)
                
                # Execute the order
                result = await self.place_order(action, quantity)
                
                # Report result back to server
                result_data = {
                    "orderId": order_id,
                    "status": "FILLED" if result.get("success") else "FAILED",
                    "result": result
                }
                
                requests.post(
                    f"{self.replit_url}/api/order-result",
                    json=result_data,
                    timeout=2
                )
                
                if result.get("success"):
                    print(f"✅ Order {order_id} executed successfully", file=sys.stderr)
                else:
                    print(f"❌ Order {order_id} failed: {result.get('error')}", file=sys.stderr)
                
        except Exception as e:
            # Silent fail - don't spam logs if server is unreachable
            pass
    
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
    """Main entry point with auto-reconnect"""
    import argparse
    import os
    
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='IBKR Bridge V2 - Real-time market data with automatic CVA recovery')
    parser.add_argument('--historical-days', type=int, 
                        default=int(os.environ.get('HISTORICAL_DAYS', '7')),
                        help='Number of days of historical data to fetch (default: 7, or HISTORICAL_DAYS env var)')
    parser.add_argument('--skip-historical', action='store_true',
                        help='Skip historical data fetch on startup')
    args = parser.parse_args()
    
    print("=" * 70, file=sys.stderr)
    print("🏎️  IBKR BRIDGE - LOCAL MODE (AUTO-RECONNECT ENABLED)", file=sys.stderr)
    print("=" * 70, file=sys.stderr)
    print(f"🔗 Local URL: {LOCAL_URL}", file=sys.stderr)
    if not args.skip_historical:
        print(f"📊 Historical data: {args.historical_days} days", file=sys.stderr)
    print("=" * 70, file=sys.stderr)
    
    bridge = IBKRBridgeV2(LOCAL_URL)
    reconnect_attempts = 0
    max_reconnects = 50  # Cap reconnects to prevent infinite loops on persistent failures
    consecutive_failures = 0
    
    try:
        while reconnect_attempts < max_reconnects:
            try:
                # Connect to IBKR with retry logic
                if not await bridge.connect():
                    # Check if this was a FATAL error (auth, permissions, etc.)
                    if bridge.fatal_error:
                        print("=" * 70, file=sys.stderr)
                        print("❌ FATAL ERROR - Cannot continue", file=sys.stderr)
                        print(f"   Error: {bridge.fatal_error_message}", file=sys.stderr)
                        print("   Action: Fix credentials/gateway configuration and restart", file=sys.stderr)
                        print("=" * 70, file=sys.stderr)
                        return  # Exit immediately - don't retry fatal errors
                    
                    print("❌ Failed to connect to IBKR after retries", file=sys.stderr)
                    reconnect_attempts += 1
                    consecutive_failures += 1
                    
                    # Exponential backoff with cap for full reconnect attempts
                    wait_time = min(60, 5 * consecutive_failures)
                    print(f"⏳ Waiting {wait_time}s before full reconnect attempt {reconnect_attempts}/{max_reconnects}...", file=sys.stderr)
                    await asyncio.sleep(wait_time)
                    
                    # If we've failed 5 times in a row, this might be fatal
                    if consecutive_failures >= 5:
                        print("⚠️  WARNING: 5 consecutive connection failures", file=sys.stderr)
                        print("   Check IB Gateway, credentials, and network connectivity", file=sys.stderr)
                    
                    continue
                
                # Reset counters on successful connection
                reconnect_attempts = 0
                consecutive_failures = 0
                
                # Send historical data for CVA (unless skipped)
                if not args.skip_historical:
                    await bridge.send_historical_data(days=args.historical_days)
                else:
                    print("⏭️  Skipping historical data fetch", file=sys.stderr)
                
                # Start streaming real-time data (this blocks until disconnect)
                await bridge.stream_market_data()
                
                # If we reach here, connection was lost
                print("⚠️ Connection lost - attempting reconnect...", file=sys.stderr)
                bridge.disconnect()
                reconnect_attempts += 1
                consecutive_failures += 1
                
                # Backoff before reconnect
                wait_time = min(30, 5 * consecutive_failures)
                await asyncio.sleep(wait_time)
                
            except KeyboardInterrupt:
                raise  # Bubble up to outer handler
            except Exception as e:
                print(f"❌ Error in main loop: {e}", file=sys.stderr)
                bridge.disconnect()
                reconnect_attempts += 1
                consecutive_failures += 1
                wait_time = min(60, 5 * consecutive_failures)
                print(f"⏳ Waiting {wait_time}s before reconnect attempt {reconnect_attempts}/{max_reconnects}...", file=sys.stderr)
                await asyncio.sleep(wait_time)
        
    except KeyboardInterrupt:
        print("\n⏹️ Stopping bridge...", file=sys.stderr)
    finally:
        bridge.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
