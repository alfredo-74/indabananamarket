"""
IBKR Connector con selezione automatica front month
Fix v2 - Usa reqContractDetails invece di qualifyContracts
"""

from ib_insync import IB, Contract, Future, MarketOrder, util
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class IBKRConnector:
    """Connettore IBKR con smart contract selection"""
    
    def __init__(self, host='127.0.0.1', port=4002, client_id=1):
        self.ib = IB()
        self.host = host
        self.port = port
        self.client_id = client_id
        self.es_contract = None
        self.mes_contract = None
        
    def connect(self):
        """Connetti a IB Gateway/TWS"""
        try:
            self.ib.connect(self.host, self.port, clientId=self.client_id)
            logger.info("✅ Connected to IBKR (PAPER)")
            
            # Abilita delayed data (gratuiti)
            self.ib.reqMarketDataType(3)
            logger.info("   Market Data Type: DELAYED (Type 3 - Free)")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Connection failed: {e}")
            return False
    
    def disconnect(self):
        """Disconnetti da IBKR"""
        if self.ib.isConnected():
            self.ib.disconnect()
            logger.info("🔌 Disconnected from IBKR")
    
    def _select_front_month(self, contract_details):
        """
        Seleziona il front month da una lista di ContractDetails
        
        Args:
            contract_details: Lista di ContractDetails objects
            
        Returns:
            Contract con scadenza più vicina nel futuro
        """
        if not contract_details:
            return None
        
        today = datetime.now()
        
        # Filtra contratti con scadenza futura e ordina per data
        valid_contracts = []
        for cd in contract_details:
            try:
                contract = cd.contract
                # Parse data scadenza (formato YYYYMMDD)
                exp_str = contract.lastTradeDateOrContractMonth
                if len(exp_str) >= 8:
                    exp_date = datetime.strptime(exp_str[:8], '%Y%m%d')
                    
                    # Solo contratti futuri
                    if exp_date > today:
                        valid_contracts.append((exp_date, contract))
            except Exception as e:
                logger.debug(f"Skip contract: {e}")
                continue
        
        if not valid_contracts:
            return None
        
        # Ordina per data e prendi il primo (front month)
        valid_contracts.sort(key=lambda x: x[0])
        front_month = valid_contracts[0][1]
        
        # Log info
        exp_date = valid_contracts[0][0]
        days_to_exp = (exp_date - today).days
        
        if days_to_exp <= 10:
            logger.warning(f"⚠️  Roll period! Using {front_month.localSymbol} "
                         f"(front month expires in {days_to_exp} days)")
        else:
            logger.info(f"✅ Using {front_month.localSymbol} (front month, "
                       f"expires in {days_to_exp} days)")
        
        return front_month
    
    def setup_contracts(self):
        """
        Setup ES (osservazione) e MES (trading) con selezione automatica front month
        
        Returns:
            tuple: (es_contract, mes_contract) o (None, None) se fallisce
        """
        try:
            # ===== ES CONTRACT (Osservazione) =====
            logger.info("🔍 Cercando contratto ES (smart selection)...")
            
            # Usa reqContractDetails invece di qualifyContracts
            es_generic = Future(symbol='ES', exchange='CME', currency='USD')
            contract_details = self.ib.reqContractDetails(es_generic)
            
            if not contract_details:
                logger.error("❌ Nessun contratto ES trovato")
                return None, None
            
            logger.info(f"   Trovati {len(contract_details)} contratti ES disponibili")
            
            # Seleziona front month
            self.es_contract = self._select_front_month(contract_details)
            
            if not self.es_contract:
                logger.error("❌ Impossibile selezionare front month ES")
                return None, None
            
            logger.info(f"   📊 ES: {self.es_contract.localSymbol} "
                       f"(exp: {self.es_contract.lastTradeDateOrContractMonth[:8]})")
            
            # ===== MES CONTRACT (Trading) =====
            logger.info("🔍 Cercando contratto MES (smart selection)...")
            
            # Usa stessa scadenza di ES
            mes_month = self.es_contract.lastTradeDateOrContractMonth
            
            mes_generic = Future(
                symbol='MES',
                exchange='CME',
                currency='USD',
                lastTradeDateOrContractMonth=mes_month
            )
            
            mes_details = self.ib.reqContractDetails(mes_generic)
            
            if not mes_details:
                logger.error("❌ Contratto MES non trovato per stesso mese ES")
                return None, None
            
            self.mes_contract = mes_details[0].contract
            
            logger.info(f"   🎯 MES: {self.mes_contract.localSymbol} "
                       f"(exp: {self.mes_contract.lastTradeDateOrContractMonth[:8]})")
            
            return self.es_contract, self.mes_contract
            
        except Exception as e:
            logger.error(f"❌ Setup contracts failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return None, None
    
    def subscribe_market_data(self, contract, callback):
        """
        Subscribe a market data per un contratto
        
        Args:
            contract: Contract object
            callback: Funzione da chiamare ad ogni tick (callback(ticker))
        """
        try:
            ticker = self.ib.reqMktData(contract, '', False, False)
            ticker.updateEvent += callback
            logger.info(f"📡 Subscribed to {contract.localSymbol} market data")
            return ticker
            
        except Exception as e:
            logger.error(f"❌ Market data subscription failed: {e}")
            return None
    
    def place_market_order(self, contract, action, quantity):
        """
        Piazza un market order
        
        Args:
            contract: Contract object (MES)
            action: 'BUY' o 'SELL'
            quantity: Numero contratti
            
        Returns:
            Trade object o None se fallisce
        """
        try:
            order = MarketOrder(action, quantity)
            trade = self.ib.placeOrder(contract, order)
            
            logger.info(f"📤 Order placed: {action} {quantity}x {contract.localSymbol}")
            logger.info(f"   Order ID: {trade.order.orderId}")
            
            # Aspetta fill (timeout 30s)
            self.ib.sleep(1)  # Quick wait per status update
            
            return trade
            
        except Exception as e:
            logger.error(f"❌ Order placement failed: {e}")
            return None
    
    def get_position(self, contract):
        """
        Ottieni posizione corrente per un contratto
        
        Args:
            contract: Contract object
            
        Returns:
            int: Posizione (>0 LONG, <0 SHORT, 0 FLAT)
        """
        positions = self.ib.positions()
        
        for pos in positions:
            if (pos.contract.symbol == contract.symbol and 
                pos.contract.lastTradeDateOrContractMonth == contract.lastTradeDateOrContractMonth):
                return int(pos.position)
        
        return 0
    
    def cancel_all_orders(self):
        """Cancella tutti gli ordini aperti"""
        try:
            open_orders = self.ib.openTrades()
            for trade in open_orders:
                self.ib.cancelOrder(trade.order)
                logger.info(f"❌ Cancelled order: {trade.order.orderId}")
        except Exception as e:
            logger.error(f"❌ Cancel orders failed: {e}")


# ===== STANDALONE TEST =====
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(levelname)s:%(name)s:%(message)s'
    )
    
    print("=" * 70)
    print("🧪 TEST IBKR CONNECTOR - Front Month Selection v2")
    print("=" * 70)
    print()
    
    connector = IBKRConnector()
    
    # Test 1: Connection
    print("TEST 1: Connessione IBKR...")
    if connector.connect():
        print("✅ Connessione OK\n")
    else:
        print("❌ Connessione fallita\n")
        exit(1)
    
    # Test 2: Contract Setup
    print("TEST 2: Setup contratti ES/MES...")
    es, mes = connector.setup_contracts()
    
    if es and mes:
        print("✅ Setup contratti OK")
        print(f"   ES:  {es.localSymbol} (exp: {es.lastTradeDateOrContractMonth[:8]})")
        print(f"   MES: {mes.localSymbol} (exp: {mes.lastTradeDateOrContractMonth[:8]})")
        print()
    else:
        print("❌ Setup contratti fallito\n")
        connector.disconnect()
        exit(1)
    
    # Test 3: Market Data
    print("TEST 3: Richiesta market data ES...")
    
    tick_count = [0]
    def on_tick(ticker):
        if ticker.last and ticker.last > 0:
            tick_count[0] += 1
            if tick_count[0] <= 3:  # Solo primi 3 tick
                print(f"   📊 ES Tick: {ticker.last:.2f}")
    
    ticker = connector.subscribe_market_data(es, on_tick)
    
    if ticker:
        print("✅ Market data OK")
        print("   Aspetto 10 secondi per vedere tick...")
        print()
        connector.ib.sleep(10)
    else:
        print("❌ Market data fallito\n")
    
    # Test 4: Position Check
    print("\nTEST 4: Check posizione MES...")
    pos = connector.get_position(mes)
    print(f"   Posizione corrente: {pos}")
    if pos == 0:
        print("✅ Posizione FLAT (OK per test)")
    else:
        print(f"⚠️  Posizione APERTA: {pos} contratti")
    print()
    
    # Cleanup
    print("=" * 70)
    print("🧹 Disconnessione...")
    connector.disconnect()
    print("✅ Test completato!")
    print("=" * 70)
