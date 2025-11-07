#!/usr/bin/env python3
"""
IBKR Bridge - TEST LIVE ACCOUNT (READ-ONLY - NO TRADING)
Connects to LIVE account port 4001 to test CME subscription
"""

import asyncio
import json
import logging
import sys
import requests
from datetime import datetime
from ib_insync import *

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def get_front_month_contract():
    """Calculate the front month ES futures contract."""
    now = datetime.now()
    year = now.year
    month = now.month
    
    quarterly_months = [3, 6, 9, 12]
    
    next_month = None
    for qm in quarterly_months:
        if month < qm:
            next_month = qm
            break
    
    if next_month is None:
        year += 1
        next_month = 3
    
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
        """Connect to local IB Gateway LIVE ACCOUNT (READ-ONLY)"""
        try:
            logger.info("=" * 60)
            logger.info("⚠️  CONNECTING TO LIVE ACCOUNT (READ-ONLY MODE)")
            logger.info("⚠️  NO TRADES WILL BE EXECUTED - DATA ONLY")
            logger.info("=" * 60)
            logger.info("Connecting to IB Gateway on 127.0.0.1:4001 (LIVE)...")
            await self.ib.connectAsync('127.0.0.1', 4001, clientId=1)
            logger.info("✓ Connected to IB Gateway (LIVE ACCOUNT)")
            
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
                self.es_contract = Future('ES', '', 'CME')
                contracts = await self.ib.qualifyContractsAsync(self.es_contract)
                if contracts:
                    self.es_contract = contracts[0]
                    logger.info(f"✓ Contract auto-selected (fallback): {self.es_contract}")
                else:
                    raise Exception("Failed to qualify ES contract")
            
            # Request REAL-TIME market data (requires subscription)
            self.ib.reqMarketDataType(1)  # 1 = Live (TESTING YOUR CME SUBSCRIPTION)
            logger.info("✓ Requesting REAL-TIME market data with CME subscription")
            
            # Subscribe to basic market data with real-time volume
            self.ib.reqMktData(self.es_contract, '233', False, False)
            logger.info("✓ Subscribed to market data feed")
            
            # Subscribe to Level II DOM (10 levels)
            self.ib.reqMktDepth(self.es_contract, 10)
            logger.info("✓ Subscribed to Level II DOM (10 levels)")
            
            # Setup tick callback
            self.ib.pendingTickersEvent += self.on_tick
            
            # Setup DOM callback
            self.ib.updateEvent += self.on_dom_update
            
            # Setup error handler
            self.ib.errorEvent += self.on_error
            
            return True
        except Exception as e:
            logger.error(f"Failed to connect to IB Gateway: {e}")
            logger.error("Make sure IB Gateway is running with API enabled on port 4001 (LIVE)")
            return False
    
    def send_to_replit(self, data):
        """Send data to Replit via HTTP POST"""
        try:
            response = self.session.post(
                f"{self.replit_url}/api/bridge/data",
                json=data,
                timeout=5
            )
            if response.status_code == 200:
                pass  # Success
            else:
                logger.warning(f"Replit responded with status {response.status_code}")
        except requests.exceptions.Timeout:
            logger.warning("Timeout sending to Replit (5s)")
        except Exception as e:
            logger.error(f"Failed to send data to Replit: {e}")
    
    def on_tick(self, tickers):
        """Handle market data ticks"""
        for ticker in tickers:
            if ticker.contract.symbol == 'ES':
                data = {
                    'type': 'tick',
                    'symbol': 'ES',
                    'bid': float(ticker.bid) if ticker.bid and ticker.bid > 0 else None,
                    'ask': float(ticker.ask) if ticker.ask and ticker.ask > 0 else None,
                    'last': float(ticker.last) if ticker.last and ticker.last > 0 else None,
                    'volume': int(ticker.volume) if ticker.volume else 0,
                    'time': ticker.time.isoformat() if ticker.time else datetime.now().isoformat()
                }
                
                if data['last']:
                    logger.info(f"📊 ES @ {data['last']:.2f} → Sent to Replit")
                
                self.send_to_replit(data)
    
    def on_dom_update(self, obj):
        """Handle DOM (Level II) updates"""
        if isinstance(obj, MktDepthData):
            if obj.contract and obj.contract.symbol == 'ES':
                data = {
                    'type': 'dom',
                    'symbol': 'ES',
                    'position': obj.position,
                    'operation': obj.operation,
                    'side': obj.side,
                    'price': float(obj.price) if obj.price else None,
                    'size': int(obj.size) if obj.size else 0
                }
                
                logger.info(f"📊 DOM: Level {obj.position} {'BID' if obj.side == 1 else 'ASK'} @ {obj.price} x {obj.size}")
                
                self.send_to_replit(data)
    
    def on_error(self, reqId, errorCode, errorString, contract):
        """Handle IBKR errors"""
        if errorCode in [2104, 2106, 2158, 2119]:  # Connection status messages
            logger.info(f"Warning {errorCode}, reqId {reqId}: {errorString}")
            if errorCode == 2119:
                logger.info("Market data farm connecting...")
        elif errorCode == 354:
            logger.error(f"⚠ ERROR 354: {errorString}")
            logger.error("")
            logger.error("❌ LIVE ACCOUNT STILL GETTING ERROR 354")
            logger.error("")
            logger.error("This confirms: Your 'CME Real-Time (NP,L2) Trader Workstation'")
            logger.error("subscription does NOT support API access.")
            logger.error("")
            logger.error("You MUST contact IBKR support and ask for:")
            logger.error("'CME Real-Time (NP,L2) Non-Display (API)' subscription")
            logger.error("")
        elif errorCode == 10168:
            logger.warning(f"⚠ ERROR 10168: {errorString}")
        else:
            logger.error(f"Error {errorCode}, reqId {reqId}: {errorString}")
    
    async def handshake_with_replit(self):
        """Initial handshake with Replit"""
        try:
            logger.info(f"Connecting to Replit at {self.replit_url}...")
            response = self.session.post(
                f"{self.replit_url}/api/bridge/data",
                json={'type': 'handshake', 'status': 'connected'},
                timeout=10
            )
            if response.status_code == 200:
                logger.info("✓ Connected to Replit trading system")
                return True
            else:
                logger.error(f"Replit handshake failed: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Failed to connect to Replit: {e}")
            return False
    
    async def run(self, replit_url):
        """Main run loop"""
        self.replit_url = replit_url
        self.running = True
        
        if not await self.connect_to_ibkr():
            return
        
        if not await self.handshake_with_replit():
            return
        
        print()
        print("=" * 60)
        print("✓ BRIDGE ACTIVE - TESTING CME SUBSCRIPTION ON LIVE ACCOUNT")
        print("⚠️  READ-ONLY MODE - NO TRADES WILL BE EXECUTED")
        print("Press Ctrl+C to stop")
        print("=" * 60)
        print()
        
        try:
            while self.running:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("Shutting down...")
        finally:
            self.ib.disconnect()

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 ibkr_bridge_LIVE_READONLY.py <replit-url>")
        print("Example: python3 ibkr_bridge_LIVE_READONLY.py https://your-replit-url")
        sys.exit(1)
    
    replit_url = sys.argv[1].rstrip('/')
    
    print()
    print("=" * 60)
    print("IBKR BRIDGE - LIVE ACCOUNT TEST (READ-ONLY)")
    print("=" * 60)
    print()
    print(f"🌐 Replit URL: {replit_url}")
    print()
    
    bridge = IBKRBridge()
    asyncio.run(bridge.run(replit_url))

if __name__ == '__main__':
    main()
