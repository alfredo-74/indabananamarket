#!/usr/bin/env python3
"""
IBKR Bridge - Connects local IB Gateway to Replit Trading System

This script runs on YOUR computer (ChromeOS Linux) and:
1. Connects to IB Gateway running locally
2. Subscribes to ES futures market data
3. Forwards the data to your Replit trading system via WebSocket

Usage:
    python3 ibkr_bridge_download.py

Requirements:
    pip install ib_insync websockets nest_asyncio
"""

import asyncio
import websockets
import json
import logging
from datetime import datetime
from ib_insync import *
import nest_asyncio

# Allow nested event loops (needed for ib_insync)
nest_asyncio.apply()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class IBKRBridge:
    def __init__(self):
        self.ib = IB()
        self.ws = None
        self.replit_url = None
        self.es_contract = None
        self.running = False
        
    async def connect_to_ibkr(self, username, password):
        """Connect to local IB Gateway"""
        try:
            logger.info("Connecting to IB Gateway on 127.0.0.1:7497...")
            await self.ib.connectAsync('127.0.0.1', 7497, clientId=1)
            logger.info("✓ Connected to IB Gateway")
            
            # Create ES futures contract
            self.es_contract = Future('ES', '202412', 'CME')
            await self.ib.qualifyContractsAsync(self.es_contract)
            logger.info(f"✓ Contract qualified: {self.es_contract}")
            
            # Subscribe to market data
            self.ib.reqMktData(self.es_contract, '', False, False)
            logger.info("✓ Subscribed to ES market data")
            
            # Setup tick callback
            self.ib.pendingTickersEvent += self.on_tick
            
            return True
        except Exception as e:
            logger.error(f"Failed to connect to IB Gateway: {e}")
            logger.error("Make sure IB Gateway is running with API enabled on port 7497")
            return False
    
    async def connect_to_replit(self, replit_url):
        """Connect to Replit trading system via WebSocket"""
        self.replit_url = replit_url
        try:
            # Convert https:// to wss://
            ws_url = replit_url.replace('https://', 'wss://').replace('http://', 'ws://')
            ws_url = f"{ws_url}/bridge"
            
            logger.info(f"Connecting to Replit at {ws_url}...")
            self.ws = await websockets.connect(ws_url)
            logger.info("✓ Connected to Replit trading system")
            
            # Send initial handshake
            await self.ws.send(json.dumps({
                'type': 'handshake',
                'source': 'ibkr_bridge',
                'timestamp': datetime.now().isoformat()
            }))
            
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Replit: {e}")
            return False
    
    def on_tick(self, tickers):
        """Called when new tick data arrives from IB Gateway"""
        for ticker in tickers:
            if ticker.contract == self.es_contract:
                asyncio.create_task(self.forward_tick(ticker))
    
    async def forward_tick(self, ticker):
        """Forward tick data to Replit"""
        if not self.ws:
            return
        
        try:
            # Extract relevant data
            data = {
                'type': 'market_data',
                'symbol': 'ES',
                'last_price': ticker.last if not util.isNan(ticker.last) else ticker.close,
                'bid': ticker.bid if not util.isNan(ticker.bid) else None,
                'ask': ticker.ask if not util.isNan(ticker.ask) else None,
                'bid_size': ticker.bidSize if not util.isNan(ticker.bidSize) else None,
                'ask_size': ticker.askSize if not util.isNan(ticker.askSize) else None,
                'volume': ticker.volume if not util.isNan(ticker.volume) else None,
                'timestamp': datetime.now().isoformat()
            }
            
            # Send to Replit
            await self.ws.send(json.dumps(data))
            
        except Exception as e:
            logger.error(f"Error forwarding tick: {e}")
    
    async def run(self):
        """Main run loop"""
        self.running = True
        
        print("\n" + "="*60)
        print("IBKR BRIDGE - Real-time Data Forwarder")
        print("="*60)
        
        # Get credentials
        print("\n📝 IB Gateway Credentials:")
        username = input("Username: ").strip()
        password = input("Password: ").strip()
        
        print("\n🌐 Replit Trading System URL:")
        print("(e.g., https://yourproject.replit.app)")
        replit_url = input("URL: ").strip()
        
        # Connect to IB Gateway
        if not await self.connect_to_ibkr(username, password):
            return
        
        # Connect to Replit
        if not await self.connect_to_replit(replit_url):
            return
        
        print("\n" + "="*60)
        print("✓ BRIDGE ACTIVE - Forwarding ES data to Replit")
        print("Press Ctrl+C to stop")
        print("="*60 + "\n")
        
        try:
            # Keep running
            while self.running:
                await asyncio.sleep(1)
                
                # Check connections
                if not self.ib.isConnected():
                    logger.error("Lost connection to IB Gateway!")
                    break
                    
        except KeyboardInterrupt:
            logger.info("\nShutting down...")
        finally:
            await self.cleanup()
    
    async def cleanup(self):
        """Clean shutdown"""
        if self.ws:
            await self.ws.close()
        if self.ib.isConnected():
            self.ib.disconnect()
        logger.info("Bridge stopped")

async def main():
    bridge = IBKRBridge()
    await bridge.run()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nBridge stopped by user")
