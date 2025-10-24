#!/usr/bin/env python3
"""
IBKR Connector Bridge - Connects to Interactive Brokers Paper Trading
Uses ib_insync to manage market data subscription and order execution
"""

import asyncio
import json
import sys
import os
from datetime import datetime
from ib_insync import IB, Stock, Future, MarketOrder, util
import nest_asyncio

nest_asyncio.apply()

class IBKRConnector:
    def __init__(self):
        self.ib = IB()
        self.connected = False
        self.contract = None
        self.last_price = 0.0
        self.bid = 0.0
        self.ask = 0.0
        self.volume = 0
        
    async def connect(self, username: str, password: str):
        """Connect to IBKR Paper Trading"""
        try:
            # Connect to IB Gateway or TWS (Paper Trading port 7497)
            await self.ib.connectAsync('127.0.0.1', 7497, clientId=1)
            self.connected = True
            
            # Set up MES futures contract (Micro E-mini S&P 500)
            # Delayed data subscription (free 15-minute delayed data)
            self.contract = Future('MES', '202503', 'CME')
            await self.ib.qualifyContractsAsync(self.contract)
            
            # Request delayed market data (delayed quotes)
            self.ib.reqMarketDataType(3)  # 3 = delayed data
            
            # Subscribe to market data
            self.ib.reqMktData(self.contract, '', False, False)
            
            return {"success": True, "message": "Connected to IBKR Paper Trading"}
        except Exception as e:
            self.connected = False
            return {"success": False, "error": str(e)}
    
    async def get_market_data(self):
        """Get current market data"""
        try:
            if not self.connected:
                return None
                
            ticker = self.ib.ticker(self.contract)
            
            # Update from ticker
            if ticker.last and not util.isNan(ticker.last):
                self.last_price = float(ticker.last)
            if ticker.bid and not util.isNan(ticker.bid):
                self.bid = float(ticker.bid)
            if ticker.ask and not util.isNan(ticker.ask):
                self.ask = float(ticker.ask)
            if ticker.volume and not util.isNan(ticker.volume):
                self.volume = int(ticker.volume)
            
            return {
                "symbol": "MES",
                "last_price": self.last_price,
                "bid": self.bid,
                "ask": self.ask,
                "volume": self.volume,
                "timestamp": int(datetime.now().timestamp() * 1000)
            }
        except Exception as e:
            print(f"Error getting market data: {e}", file=sys.stderr)
            return None
    
    async def place_order(self, action: str, quantity: int):
        """Place a market order"""
        try:
            if not self.connected:
                return {"success": False, "error": "Not connected to IBKR"}
            
            order = MarketOrder(action, quantity)
            trade = self.ib.placeOrder(self.contract, order)
            
            # Wait for order to be filled
            await asyncio.sleep(1)
            
            return {
                "success": True,
                "order_id": trade.order.orderId,
                "status": trade.orderStatus.status
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_position(self):
        """Get current position"""
        try:
            if not self.connected:
                return None
            
            positions = self.ib.positions()
            
            for pos in positions:
                if pos.contract.symbol == 'MES':
                    return {
                        "contracts": int(pos.position),
                        "avg_cost": float(pos.avgCost)
                    }
            
            return {"contracts": 0, "avg_cost": 0.0}
        except Exception as e:
            print(f"Error getting position: {e}", file=sys.stderr)
            return None
    
    def disconnect(self):
        """Disconnect from IBKR"""
        if self.connected:
            self.ib.disconnect()
            self.connected = False

async def main():
    """Main entry point for the IBKR connector"""
    connector = IBKRConnector()
    
    # Get credentials from environment
    username = os.getenv('IBKR_USERNAME', '')
    password = os.getenv('IBKR_PASSWORD', '')
    
    # Connect to IBKR
    result = await connector.connect(username, password)
    print(json.dumps(result))
    
    if not result['success']:
        return
    
    # Main loop - respond to stdin commands
    try:
        while True:
            line = sys.stdin.readline()
            if not line:
                break
            
            try:
                command = json.loads(line.strip())
                
                if command['action'] == 'get_market_data':
                    data = await connector.get_market_data()
                    print(json.dumps(data))
                    sys.stdout.flush()
                    
                elif command['action'] == 'place_order':
                    result = await connector.place_order(
                        command['order_action'],
                        command['quantity']
                    )
                    print(json.dumps(result))
                    sys.stdout.flush()
                    
                elif command['action'] == 'get_position':
                    data = await connector.get_position()
                    print(json.dumps(data))
                    sys.stdout.flush()
                    
                elif command['action'] == 'disconnect':
                    connector.disconnect()
                    print(json.dumps({"success": True}))
                    sys.stdout.flush()
                    break
                    
            except json.JSONDecodeError:
                print(json.dumps({"error": "Invalid JSON"}), file=sys.stderr)
                
    except KeyboardInterrupt:
        pass
    finally:
        connector.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
