#!/usr/bin/env python3
"""
Simple IBKR Bridge - Runs on your computer
Uses your existing IBKR connector to forward data to Replit
"""

import asyncio
import requests
import time
from datetime import datetime
from ib_insync import IB, Future, util

class SimpleBridge:
    def __init__(self, replit_url):
        self.replit_url = replit_url
        self.ib = IB()
        self.es_contract = None
        
    def connect(self):
        """Connect to IB Gateway on port 4002"""
        try:
            print("Connecting to IB Gateway on localhost:4002...")
            self.ib.connect('127.0.0.1', 4002, clientId=1)
            
            # Enable delayed data (free)
            self.ib.reqMarketDataType(3)
            print("✓ Connected to IB Gateway (PAPER)")
            print("  Market Data: DELAYED (Free)")
            
            # Get account balance
            account_values = self.ib.accountSummary()
            balance = 0
            for item in account_values:
                if item.tag == 'NetLiquidation':
                    balance = float(item.value)
                    print(f"✓ Account Balance: ${balance:,.2f}")
            
            # Send connection status to Replit
            self.send_to_replit({
                "type": "connection",
                "connected": True,
                "account_balance": balance
            })
            
            return True
            
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            return False
    
    def setup_es_contract(self):
        """Setup ES contract with auto front-month selection"""
        try:
            print("\n🔍 Finding ES contract (front month)...")
            
            # Get ES contracts
            es = Future(symbol='ES', exchange='CME', currency='USD')
            contracts = self.ib.qualifyContracts(es)
            
            if not contracts:
                print("✗ No ES contracts found")
                return False
            
            # Sort by expiry and pick front month
            sorted_contracts = sorted(
                contracts,
                key=lambda c: c.lastTradeDateOrContractMonth
            )
            
            self.es_contract = sorted_contracts[0]
            print(f"✓ Using {self.es_contract.localSymbol}")
            
            # Subscribe to market data
            self.ib.reqMktData(self.es_contract, '', False, False)
            print("✓ Subscribed to ES market data")
            
            return True
            
        except Exception as e:
            print(f"✗ ES contract setup failed: {e}")
            return False
    
    def send_to_replit(self, data):
        """Send data to Replit backend"""
        try:
            requests.post(
                f"{self.replit_url}/api/ibkr-bridge",
                json=data,
                timeout=5
            )
        except Exception as e:
            # Silent fail - don't spam console
            pass
    
    def stream_data(self):
        """Stream market data to Replit"""
        print("\n📊 Streaming live data to Replit...\n")
        
        while True:
            try:
                ticker = self.ib.ticker(self.es_contract)
                
                if ticker and ticker.last and not util.isNan(ticker.last):
                    data = {
                        "type": "market_data",
                        "symbol": "ES",
                        "last_price": ticker.last,
                        "bid": ticker.bid if ticker.bid and not util.isNan(ticker.bid) else ticker.last - 0.25,
                        "ask": ticker.ask if ticker.ask and not util.isNan(ticker.ask) else ticker.last + 0.25,
                        "volume": ticker.volume if ticker.volume else 0,
                        "timestamp": int(datetime.now().timestamp() * 1000)
                    }
                    
                    self.send_to_replit(data)
                    print(f"ES: ${ticker.last:.2f} → Replit", end='\r')
                
                time.sleep(0.5)
                
            except KeyboardInterrupt:
                raise
            except Exception as e:
                print(f"\nError: {e}")
                time.sleep(1)
    
    def run(self):
        """Main run"""
        if not self.connect():
            return False
        
        if not self.setup_es_contract():
            return False
        
        try:
            self.stream_data()
        except KeyboardInterrupt:
            print("\n\n✓ Stopped by user")
            self.ib.disconnect()

if __name__ == "__main__":
    print("=" * 60)
    print("IBKR Bridge - Connects IB Gateway to Replit")
    print("=" * 60)
    
    url = input("\nEnter your Replit URL: ").strip()
    
    if not url.startswith("http"):
        print("✗ Invalid URL")
        exit(1)
    
    bridge = SimpleBridge(url)
    bridge.run()
