#!/usr/bin/env python3
"""
IBKR Bridge - Connects local IB Gateway to Replit Trading System
WITH REAL-TIME LEVEL II DOM DATA

This script runs on YOUR computer (ChromeOS Linux) and:
1. Connects to IB Gateway running locally
2. Subscribes to ES futures REAL-TIME market data + Level II DOM
3. Forwards the data to your Replit trading system via HTTP

Usage:
    python3 ibkr_bridge_REAL_TIME_LEVEL2.py https://your-replit-url

Requirements:
    pip install ib_insync requests
"""

import asyncio
import json
import logging
import sys
import requests
from datetime import datetime
from ib_insync import *

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def get_front_month_contract():
    """
    Calculate the front month ES futures contract.
    ES futures roll quarterly: March (3), June (6), September (9), December (12)
    """
    now = datetime.now()
    year = now.year
    month = now.month
    
    # Quarterly months for ES
    quarterly_months = [3, 6, 9, 12]
    
    # Find next quarterly month
    next_month = None
    for qm in quarterly_months:
        if month < qm:
            next_month = qm
            break
    
    # If no future month this year, roll to March next year
    if next_month is None:
        year += 1
        next_month = 3
    
    # Format as YYYYMM (e.g., 202503 for March 2025)
    contract_month = f"{year}{next_month:02d}"
    
    logger.info(f"📅 Calculated front month contract: ES {contract_month}")
    return contract_month

class IBKRBridge:
    def __init__(self):
        self.ib = IB()
        self.replit_url = None
        self.es_contract = None
        self.running = False
        self.session = requests.Session()
        
    async def connect_to_ibkr(self):
        """Connect to local IB Gateway"""
        try:
            logger.info("=" * 60)
            logger.info("Connecting to IB Gateway - LIVE account on port 4002")
            logger.info("(As instructed by IBKR support)")
            logger.info("=" * 60)
            logger.info("Connecting to IB Gateway on 127.0.0.1:4002...")
            await self.ib.connectAsync('127.0.0.1', 4002, clientId=1)
            logger.info("✓ Connected to IB Gateway (LIVE account via port 4002)")
            
            # Get front month contract automatically
            contract_month = get_front_month_contract()
            
            # Try with calculated contract month first
            self.es_contract = Future('ES', contract_month, 'CME')
            
            try:
                contracts = await self.ib.qualifyContractsAsync(self.es_contract)
                if contracts:
                    self.es_contract = contracts[0]
                    logger.info(f"✓ Contract qualified: ES {contract_month}")
                else:
                    # Fallback: let IB Gateway auto-select
                    logger.info("⚠ Calculated contract not found, using auto-select...")
                    self.es_contract = Future('ES', '', 'CME')
                    contracts = await self.ib.qualifyContractsAsync(self.es_contract)
                    if contracts:
                        self.es_contract = contracts[0]
                        logger.info(f"✓ Contract auto-selected: {self.es_contract}")
                    else:
                        raise Exception("Could not qualify any ES contract")
            except Exception as e:
                logger.warning(f"Contract qualification issue: {e}")
                # Try one more time with empty contract month (IB auto-select)
                self.es_contract = Future('ES', '', 'CME')
                contracts = await self.ib.qualifyContractsAsync(self.es_contract)
                if contracts:
                    self.es_contract = contracts[0]
                    logger.info(f"✓ Contract auto-selected (fallback): {self.es_contract}")
                else:
                    raise Exception("Failed to qualify ES contract")
            
            # Request REAL-TIME market data (now that account is funded)
            self.ib.reqMarketDataType(1)  # 1 = Live (real-time)
            logger.info("✓ Requesting REAL-TIME market data with funded account")
            
            # Subscribe to basic market data with real-time volume (tick 233)
            self.ib.reqMktData(self.es_contract, '233', False, False)
            logger.info("✓ Subscribed to real-time market data feed")
            
            # Subscribe to Level II DOM (10 levels deep)
            self.ib.reqMktDepth(self.es_contract, 10)
            logger.info("✓ Subscribed to Level II DOM (10 levels)")
            
            # Setup tick callback
            self.ib.pendingTickersEvent += self.on_tick
            
            # Setup DOM callback for order book updates
            self.ib.updateEvent += self.on_dom_update
            
            # Setup error handler
            self.ib.errorEvent += self.on_error
            
            return True
        except Exception as e:
            logger.error(f"Failed to connect to IB Gateway: {e}")
            logger.error("Make sure IB Gateway is running with:")
            logger.error("  - LIVE account mode (fredpaper74)")
            logger.error("  - API enabled")
            logger.error("  - Port 4002 (as instructed by IBKR support)")
            return False
    
    def send_to_replit(self, data):
        """Send data to Replit via HTTP POST"""
        try:
            response = self.session.post(
                f"{self.replit_url}/api/bridge/data",
                json=data,
                timeout=5
            )
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Failed to send data to Replit: {e}")
            return False
    
    def on_error(self, reqId, errorCode, errorString, contract):
        """Handle IBKR errors"""
        if errorCode == 354 or errorCode == 10168:
            # Market data subscription error
            logger.error(f"⚠ ERROR {errorCode}: {errorString}")
            logger.error("")
            logger.error("❌ Market data subscription not accessible")
            logger.error("📋 TROUBLESHOOTING CHECKLIST:")
            logger.error("   1. ✓ Live account funded (required by IBKR)")
            logger.error("   2. ✓ Data sharing enabled in Client Portal")
            logger.error("   3. ⚠ Wait 5-10 minutes after funding for IBKR systems to update")
            logger.error("   4. ⚠ Restart IB Gateway after funding settles")
            logger.error("   5. If still failing, contact IBKR support")
            logger.error("")
        elif errorCode == 2119:
            # Just connecting to data farm - informational only
            logger.info(f"Market data farm connecting...")
        elif errorCode in [2104, 2106, 2158]:
            # Connection OK messages - informational
            pass
        else:
            # Log other errors
            logger.info(f"IBKR Error {errorCode}: {errorString}")
    
    def on_tick(self, tickers):
        """Called when new tick data arrives from IB Gateway"""
        for ticker in tickers:
            if ticker.contract == self.es_contract:
                self.forward_tick(ticker)
    
    def forward_tick(self, ticker):
        """Forward tick data to Replit"""
        try:
            # Extract relevant data
            last_price = ticker.last if not util.isNan(ticker.last) else ticker.close
            
            if util.isNan(last_price):
                return  # No valid price yet
            
            data = {
                'type': 'market_data',
                'symbol': 'ES',
                'last_price': float(last_price),
                'bid': float(ticker.bid) if not util.isNan(ticker.bid) else None,
                'ask': float(ticker.ask) if not util.isNan(ticker.ask) else None,
                'bid_size': int(ticker.bidSize) if not util.isNan(ticker.bidSize) else None,
                'ask_size': int(ticker.askSize) if not util.isNan(ticker.askSize) else None,
                'volume': int(ticker.volume) if not util.isNan(ticker.volume) else None,
                'timestamp': datetime.now().isoformat()
            }
            
            # Send to Replit
            if self.send_to_replit(data):
                logger.info(f"📊 ES @ {last_price:.2f} → Sent to Replit")
            
        except Exception as e:
            logger.error(f"Error forwarding tick: {e}")
    
    def on_dom_update(self):
        """Handle Level II DOM updates"""
        try:
            # Get the ticker object for our contract
            ticker = self.ib.ticker(self.es_contract)
            
            if ticker and hasattr(ticker, 'domBids') and hasattr(ticker, 'domAsks'):
                if ticker.domBids and ticker.domAsks:
                    # Build DOM data
                    dom_data = {
                        'type': 'dom_update',
                        'symbol': 'ES',
                        'bids': [[level.price, level.size] for level in ticker.domBids[:10]],
                        'asks': [[level.price, level.size] for level in ticker.domAsks[:10]],
                        'timestamp': datetime.now().isoformat()
                    }
                    
                    # Send DOM update to Replit
                    self.send_to_replit(dom_data)
                    logger.info(f"📊 DOM: {len(dom_data['bids'])} bids, {len(dom_data['asks'])} asks → Sent to Replit")
                
        except Exception as e:
            logger.error(f"Error forwarding DOM: {e}")
    
    def get_mes_contract(self):
        """Get MES contract for trading"""
        # MES (Micro E-mini S&P 500) uses same contract months as ES
        contract_month = get_front_month_contract()
        mes_contract = Future('MES', contract_month, 'CME')
        return mes_contract
    
    def poll_pending_orders(self):
        """Check for pending orders from Replit"""
        try:
            response = self.session.get(f"{self.replit_url}/api/pending-orders", timeout=5)
            if response.status_code == 200:
                return response.json()
            return []
        except Exception as e:
            logger.error(f"Error polling orders: {e}")
            return []
    
    async def fetch_and_send_historical_data(self, days=5):
        """Fetch 5 days of historical data and send to Replit to build CVA"""
        try:
            logger.info(f"📊 Fetching {days} days of historical 5-min bars for CVA initialization...")
            
            # Request historical data from IBKR
            bars = await self.ib.reqHistoricalDataAsync(
                self.es_contract,
                endDateTime='',  # Most recent data
                durationStr=f'{days} D',  # Trading days (excludes weekends)
                barSizeSetting='5 mins',
                whatToShow='TRADES',
                useRTH=True,  # Regular Trading Hours only (9:30 AM - 4:00 PM ET)
                formatDate=1
            )
            
            if not bars:
                logger.warning("⚠ No historical data received from IBKR")
                return
            
            logger.info(f"✓ Received {len(bars)} bars from IBKR")
            
            # Group bars by trading date
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
            
            # Convert to list and sort by date
            days_data = []
            for date in sorted(daily_bars.keys()):
                days_data.append({
                    "date": date,
                    "bars": daily_bars[date]
                })
            
            logger.info(f"✓ Grouped into {len(days_data)} trading days")
            
            # Send to Replit CVA initialization endpoint
            try:
                response = self.session.post(
                    f"{self.replit_url}/api/bridge/initialize-cva",
                    json={"days": days_data},
                    timeout=30
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get('success'):
                        cva = result.get('cva', {})
                        logger.info(f"✅ CVA initialized successfully!")
                        logger.info(f"   Days: {cva.get('days_included')}/5")
                        logger.info(f"   POC: {cva.get('composite_poc', 0):.2f}")
                        logger.info(f"   VAH: {cva.get('composite_vah', 0):.2f}")
                        logger.info(f"   VAL: {cva.get('composite_val', 0):.2f}")
                    else:
                        logger.warning(f"⚠ CVA initialization failed: {result.get('error')}")
                else:
                    logger.warning(f"⚠ CVA endpoint returned status {response.status_code}")
            except Exception as e:
                logger.error(f"❌ Failed to send historical data to Replit: {e}")
                
        except Exception as e:
            logger.error(f"❌ Historical data fetch failed: {e}")
            import traceback
            traceback.print_exc()
    
    async def execute_order(self, order):
        """Execute order via IBKR on MES contract"""
        try:
            logger.info(f"🔄 Executing {order['action']} {order['quantity']} MES (ID: {order['id']})")
            
            # Get MES contract
            mes_contract = self.get_mes_contract()
            contracts = await self.ib.qualifyContractsAsync(mes_contract)
            if not contracts:
                raise Exception("Could not qualify MES contract")
            mes_contract = contracts[0]
            
            # Create market order
            from ib_insync import MarketOrder
            ib_order = MarketOrder(order['action'], order['quantity'])
            
            # Place order
            trade = self.ib.placeOrder(mes_contract, ib_order)
            
            # Wait for fill (with timeout)
            for _ in range(10):  # Wait up to 10 seconds
                await asyncio.sleep(1)
                if trade.orderStatus.status in ['Filled', 'Cancelled', 'ApiCancelled']:
                    break
            
            result = {
                'order_id': trade.order.orderId,
                'status': trade.orderStatus.status,
                'filled': trade.orderStatus.filled,
                'avg_fill_price': trade.orderStatus.avgFillPrice,
            }
            
            # Report result back to Replit
            self.send_to_replit({
                'type': 'order_result',
                'orderId': order['id'],
                'status': 'EXECUTED' if trade.orderStatus.status == 'Filled' else 'FAILED',
                'result': result
            })
            
            logger.info(f"✅ Order executed: {order['action']} {order['quantity']} MES @ {trade.orderStatus.avgFillPrice:.2f}")
            
        except Exception as e:
            logger.error(f"❌ Order execution failed: {e}")
            # Report failure
            self.send_to_replit({
                'type': 'order_result',
                'orderId': order['id'],
                'status': 'FAILED',
                'result': {'error': str(e)}
            })
    
    async def run(self, replit_url):
        """Main run loop"""
        self.running = True
        self.replit_url = replit_url.rstrip('/')  # Remove trailing slash if present
        
        print("\n" + "="*60)
        print("IBKR BRIDGE - REAL-TIME Level II Data Forwarder + Order Execution")
        print("="*60)
        print(f"\n🌐 Replit URL: {replit_url}")
        print()
        
        # Connect to IB Gateway
        if not await self.connect_to_ibkr():
            return
        
        # Send handshake to Replit
        logger.info(f"Connecting to Replit at {replit_url}...")
        if self.send_to_replit({'type': 'handshake', 'source': 'ibkr_bridge', 'timestamp': datetime.now().isoformat()}):
            logger.info("✓ Connected to Replit trading system")
        else:
            logger.error("Failed to connect to Replit - check the URL and try again")
            return
        
        # Fetch historical data to initialize CVA
        logger.info("\n" + "="*60)
        logger.info("INITIALIZING COMPOSITE VALUE AREA (CVA)")
        logger.info("="*60)
        await self.fetch_and_send_historical_data(days=5)
        
        print("\n" + "="*60)
        print("✓ BRIDGE ACTIVE - Forwarding ES + DOM & Executing Orders")
        print("Press Ctrl+C to stop")
        print("="*60 + "\n")
        
        try:
            # Keep running
            order_poll_counter = 0
            while self.running:
                await asyncio.sleep(1)
                
                # Poll for orders every 2 seconds
                order_poll_counter += 1
                if order_poll_counter >= 2:
                    order_poll_counter = 0
                    pending_orders = self.poll_pending_orders()
                    for order in pending_orders:
                        await self.execute_order(order)
                
                # Check connections
                if not self.ib.isConnected():
                    logger.error("Lost connection to IB Gateway")
                    break
                    
        except KeyboardInterrupt:
            print("\n\n⚠ Bridge stopped by user")
        finally:
            self.running = False
            self.ib.disconnect()
            logger.info("✓ Disconnected from IB Gateway")

async def main():
    if len(sys.argv) < 2:
        print("Usage: python3 ibkr_bridge_REAL_TIME_LEVEL2.py <replit-url>")
        print("Example: python3 ibkr_bridge_REAL_TIME_LEVEL2.py https://your-app.replit.dev")
        sys.exit(1)
    
    replit_url = sys.argv[1]
    bridge = IBKRBridge()
    await bridge.run(replit_url)

if __name__ == '__main__':
    asyncio.run(main())
