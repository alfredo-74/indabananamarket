#!/usr/bin/env python3
"""
IBKR Bridge - Connects local IB Gateway to Replit Trading System

This script runs on YOUR computer (ChromeOS Linux) and:
1. Connects to IB Gateway running locally
2. Subscribes to ES futures market data
3. Forwards the data to your Replit trading system via HTTP

Usage:
    python3 ibkr_bridge_download.py https://your-replit-url

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
            logger.info("Connecting to IB Gateway on 127.0.0.1:7497...")
            await self.ib.connectAsync('127.0.0.1', 7497, clientId=1)
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
    
    async def run(self, replit_url):
        """Main run loop"""
        self.running = True
        self.replit_url = replit_url.rstrip('/')  # Remove trailing slash if present
        
        print("\n" + "="*60)
        print("IBKR BRIDGE - Real-time Data Forwarder")
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
        self.session.close()
        if self.ib.isConnected():
            self.ib.disconnect()
        logger.info("Bridge stopped")

async def main():
    if len(sys.argv) < 2:
        print("\n" + "="*60)
        print("IBKR BRIDGE - Usage")
        print("="*60)
        print("\nUsage:")
        print("  python3 ibkr_bridge_download.py https://your-replit-url")
        print("\nExample:")
        print("  python3 ibkr_bridge_download.py https://ee197047-83ec-40d0-a112-c38e62a21590-00-2lvxbobtxixs9.kirk.replit.dev")
        print("\nNote: Use your actual Replit project URL (with https://)")
        print("="*60 + "\n")
        sys.exit(1)
    
    replit_url = sys.argv[1]
    
    # Validate URL format
    if not (replit_url.startswith('https://') or replit_url.startswith('http://')):
        print("\n⚠ ERROR: URL must start with https:// or http://")
        print(f"   You provided: {replit_url}")
        print(f"   Should be: https://{replit_url}")
        sys.exit(1)
    
    bridge = IBKRBridge()
    await bridge.run(replit_url)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nBridge stopped by user")
