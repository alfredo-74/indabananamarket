#!/usr/bin/env python3
"""
IBKR Local Bridge - Runs on YOUR computer
Connects to IB Gateway locally and forwards data to Replit
"""

import asyncio
import json
import requests
from datetime import datetime
from ib_insync import IB, Future, util
import nest_asyncio

nest_asyncio.apply()

# IMPORTANT: Replace this with your actual Replit app URL
REPLIT_URL = "https://YOUR-REPLIT-URL.replit.dev"

class IBKRLocalBridge:
    def __init__(self, replit_url: str):
        self.ib = IB()
        self.connected = False
        self.replit_url = replit_url
        self.display_contract = None
        self.trade_contract = None
        
    async def connect_to_gateway(self):
        """Connect to IB Gateway running locally on port 4002"""
        try:
            print("Connecting to IB Gateway on localhost:4002...")
            await self.ib.connectAsync('127.0.0.1', 4002, clientId=1)
            self.connected = True
            print("✓ Connected to IB Gateway!")
            
            # Get account info
            account_values = self.ib.accountSummary()
            account_balance = 0
            for item in account_values:
                if item.tag == 'NetLiquidation':
                    account_balance = float(item.value)
                    print(f"✓ Account Balance: ${account_balance:,.2f}")
            
            # Set up ES contract for display
            self.display_contract = Future('ES', exchange='CME')
            contracts = await self.ib.qualifyContractsAsync(self.display_contract)
            if contracts:
                self.display_contract = sorted(contracts, key=lambda c: c.lastTradeDateOrContractMonth)[0]
                print(f"✓ ES Contract: {self.display_contract.lastTradeDateOrContractMonth}")
            
            # Set up MES contract for trading
            self.trade_contract = Future('MES', exchange='CME')
            trade_contracts = await self.ib.qualifyContractsAsync(self.trade_contract)
            if trade_contracts:
                self.trade_contract = sorted(trade_contracts, key=lambda c: c.lastTradeDateOrContractMonth)[0]
                print(f"✓ MES Contract: {self.trade_contract.lastTradeDateOrContractMonth}")
            
            # Request delayed market data (free)
            self.ib.reqMarketDataType(3)
            
            # Subscribe to market data
            self.ib.reqMktData(self.display_contract, '', False, False)
            print("✓ Subscribed to ES market data")
            
            # Send initial connection status to Replit
            self.send_to_replit({
                "type": "connection",
                "connected": True,
                "account_balance": account_balance
            })
            
            return True
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            self.connected = False
            return False
    
    def send_to_replit(self, data):
        """Forward data to Replit backend"""
        try:
            response = requests.post(
                f"{self.replit_url}/api/ibkr-bridge",
                json=data,
                timeout=5
            )
            if response.status_code != 200:
                print(f"Warning: Replit returned status {response.status_code}")
        except Exception as e:
            print(f"Warning: Failed to send to Replit: {e}")
    
    async def stream_market_data(self):
        """Stream market data to Replit"""
        print("\n📊 Streaming market data to Replit...\n")
        
        while self.connected:
            try:
                ticker = self.ib.ticker(self.display_contract)
                
                if ticker and ticker.last and not util.isNan(ticker.last):
                    market_data = {
                        "type": "market_data",
                        "symbol": "ES",
                        "last_price": ticker.last,
                        "bid": ticker.bid if ticker.bid and not util.isNan(ticker.bid) else ticker.last - 0.25,
                        "ask": ticker.ask if ticker.ask and not util.isNan(ticker.ask) else ticker.last + 0.25,
                        "volume": ticker.volume if ticker.volume else 0,
                        "timestamp": int(datetime.now().timestamp() * 1000)
                    }
                    
                    self.send_to_replit(market_data)
                    print(f"ES: ${ticker.last:.2f} | Sent to Replit", end='\r')
                
                await asyncio.sleep(0.5)  # Update every 500ms
                
            except Exception as e:
                print(f"\nError streaming data: {e}")
                await asyncio.sleep(1)
    
    async def run(self):
        """Main run loop"""
        if await self.connect_to_gateway():
            await self.stream_market_data()
        else:
            print("\n❌ Could not connect to IB Gateway")
            print("\nTroubleshooting:")
            print("1. Make sure IB Gateway is running")
            print("2. Check that port is 4002 in IB Gateway settings")
            print("3. Enable 'Enable ActiveX and Socket Clients' in API settings")
            print("4. Disable 'Allow connections from localhost only' if enabled")

async def main():
    print("=" * 60)
    print("IBKR Local Bridge - Connects IB Gateway to Replit")
    print("=" * 60)
    
    # Get Replit URL from user
    replit_url = input("\nEnter your Replit app URL (e.g., https://xxxxx.replit.dev): ").strip()
    
    if not replit_url.startswith("http"):
        print("❌ Invalid URL. Must start with https://")
        return
    
    bridge = IBKRLocalBridge(replit_url)
    await bridge.run()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n✓ Bridge stopped by user")
