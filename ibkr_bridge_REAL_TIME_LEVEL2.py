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
            logger.info("Connecting to IB Gateway on 127.0.0.1:4002...")
            await self.ib.connectAsync('127.0.0.1', 4002, clientId=1)
            logger.info("✓ Connected to IB Gateway")
            
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
            
            # Request REAL-TIME market data (requires subscription)
            self.ib.reqMarketDataType(1)  # 1 = Live data (real-time)
            logger.info("✓ Requesting REAL-TIME Level II market data")
            
            # Subscribe to basic market data with real-time volume (tick 233)
            self.ib.reqMktData(self.es_contract, '233', False, False)
            
            # Subscribe to Level II Market Depth (DOM) - 10 levels deep
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
            logger.error("Make sure IB Gateway is running with API enabled on port 4002 (paper trading)")
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
            logger.error("❌ Your CME subscription is NOT configured for API access")
            logger.error("📋 SOLUTION:")
            logger.error("   1. Go to https://www.interactivebrokers.com/portal/")
            logger.error("   2. Settings → Account Settings → Paper Trading Account")
            logger.error("   3. Enable: 'Share market data subscriptions with paper trading account'")
            logger.error("   4. Restart IB Gateway and try again")
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
    
    def on_dom_update(self, ticker):
        """Handle Level II DOM updates"""
        if hasattr(ticker, 'domBids') and hasattr(ticker, 'domAsks'):
            try:
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
    
    async def run(self, replit_url):
        """Main run loop"""
        self.running = True
        self.replit_url = replit_url.rstrip('/')  # Remove trailing slash if present
        
        print("\n" + "="*60)
        print("IBKR BRIDGE - REAL-TIME Level II Data Forwarder")
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
        
        print("\n" + "="*60)
        print("✓ BRIDGE ACTIVE - Forwarding REAL-TIME ES + DOM to Replit")
        print("Press Ctrl+C to stop")
        print("="*60 + "\n")
        
        try:
            # Keep running
            while self.running:
                await asyncio.sleep(1)
                
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
