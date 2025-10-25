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
from ib_insync import IB, Stock, Future, Forex, MarketOrder, util
import nest_asyncio

nest_asyncio.apply()

class IBKRConnector:
    def __init__(self):
        self.ib = IB()
        self.connected = False
        self.display_contract = None  # ES contract for price display
        self.trade_contract = None    # MES contract for actual trading
        self.last_price = 0.0
        self.bid = 0.0
        self.ask = 0.0
        self.volume = 0
        self.account_currency = "USD"  # Default to USD
        self.usd_to_gbp_rate = 0.79  # Default exchange rate (will be updated from IB)
        self.port = 7497  # Track which port we're connected to
        
    async def connect(self, username: str, password: str):
        """Connect to IBKR Paper Trading"""
        try:
            # Connect to IB Gateway or TWS (Paper Trading port 7497, Live port 7496)
            self.port = 7497  # Paper trading by default
            await self.ib.connectAsync('127.0.0.1', self.port, clientId=1)
            self.connected = True
            
            # Get account information
            await self.update_account_info()
            
            # Set up ES futures contract for DISPLAY (what traders watch)
            # Auto-select front month (most liquid contract)
            self.display_contract = Future('ES', exchange='CME')
            display_contracts = await self.ib.qualifyContractsAsync(self.display_contract)
            
            if display_contracts:
                # Select the contract with nearest expiry (front month)
                self.display_contract = sorted(display_contracts, key=lambda c: c.lastTradeDateOrContractMonth)[0]
                print(f"Selected ES display contract: {self.display_contract.lastTradeDateOrContractMonth}", file=sys.stderr)
            else:
                # Fallback to specific contract if auto-selection fails
                self.display_contract = Future('ES', '202503', 'CME')
                await self.ib.qualifyContractsAsync(self.display_contract)
            
            # Set up MES futures contract for TRADING (cheaper execution)
            self.trade_contract = Future('MES', exchange='CME')
            trade_contracts = await self.ib.qualifyContractsAsync(self.trade_contract)
            
            if trade_contracts:
                # Select the contract with nearest expiry (front month)
                self.trade_contract = sorted(trade_contracts, key=lambda c: c.lastTradeDateOrContractMonth)[0]
                print(f"Selected MES trading contract: {self.trade_contract.lastTradeDateOrContractMonth}", file=sys.stderr)
            else:
                # Fallback to specific contract if auto-selection fails
                self.trade_contract = Future('MES', '202503', 'CME')
                await self.ib.qualifyContractsAsync(self.trade_contract)
            
            # Request delayed market data (delayed quotes - free)
            self.ib.reqMarketDataType(3)  # 3 = delayed data
            
            # Subscribe to ES market data for display
            self.ib.reqMktData(self.display_contract, '', False, False)
            
            return {"success": True, "message": f"Connected to IBKR Paper Trading - Display: {self.display_contract.lastTradeDateOrContractMonth}, Trade: {self.trade_contract.lastTradeDateOrContractMonth}"}
        except Exception as e:
            self.connected = False
            return {"success": False, "error": str(e)}
    
    async def update_account_info(self):
        """Get account currency and exchange rates from IB"""
        try:
            if not self.connected:
                return
            
            # Get account summary to find base currency
            account_values = self.ib.accountSummary()
            
            for item in account_values:
                if item.tag == 'AccountType':
                    # Detect if this is a paper or live account based on port
                    # Port 7497 = paper, 7496 = live
                    pass
                if item.tag == 'Currency':
                    self.account_currency = item.value
                    print(f"Account currency: {self.account_currency}", file=sys.stderr)
            
            # If account is in GBP, get USD/GBP exchange rate
            if self.account_currency == 'GBP':
                try:
                    # Create GBP.USD forex pair contract
                    fx_contract = Forex('GBPUSD')
                    await self.ib.qualifyContractsAsync(fx_contract)
                    
                    # Request market data for the forex pair
                    self.ib.reqMktData(fx_contract, '', False, False)
                    await asyncio.sleep(1)  # Wait for data
                    
                    ticker = self.ib.ticker(fx_contract)
                    if ticker and ticker.last and not util.isNan(ticker.last):
                        # GBP.USD gives us 1 GBP = X USD
                        # We want USD to GBP, so we invert it
                        gbp_per_usd = 1.0 / float(ticker.last)
                        self.usd_to_gbp_rate = gbp_per_usd
                        print(f"Updated USD/GBP rate: {self.usd_to_gbp_rate:.4f}", file=sys.stderr)
                except Exception as e:
                    print(f"Could not get forex rate, using default: {e}", file=sys.stderr)
                    self.usd_to_gbp_rate = 0.79  # Fallback rate
        except Exception as e:
            print(f"Error updating account info: {e}", file=sys.stderr)
    
    async def get_market_data(self):
        """Get current market data from ES contract for display"""
        try:
            if not self.connected or not self.display_contract:
                return None
                
            ticker = self.ib.ticker(self.display_contract)
            
            # Update from ticker (ES prices for display)
            if ticker and ticker.last and not util.isNan(ticker.last):
                self.last_price = float(ticker.last)
            if ticker and ticker.bid and not util.isNan(ticker.bid):
                self.bid = float(ticker.bid)
            if ticker and ticker.ask and not util.isNan(ticker.ask):
                self.ask = float(ticker.ask)
            if ticker and ticker.volume and not util.isNan(ticker.volume):
                self.volume = int(ticker.volume)
            
            return {
                "symbol": "ES",  # Display ES symbol
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
        """Place a market order on MES contract"""
        try:
            if not self.connected or not self.trade_contract:
                return {"success": False, "error": "Not connected to IBKR"}
            
            order = MarketOrder(action, quantity)
            trade = self.ib.placeOrder(self.trade_contract, order)
            
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
                
                elif command['action'] == 'get_account_info':
                    data = {
                        "account_currency": connector.account_currency,
                        "usd_to_account_rate": connector.usd_to_gbp_rate if connector.account_currency == 'GBP' else 1.0,
                        "account_type": "PAPER" if connector.port == 7497 else "LIVE"
                    }
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
