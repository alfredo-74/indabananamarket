"""
Volumetric Candle Builder
Accumula tick e crea candele basate su volume target
Come Vadeera: 5000 volume per ES, 2000 per CL
"""
import logging
from typing import Dict, Optional, List
from dataclasses import dataclass
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class VolumetricCandle:
    """Rappresenta una candela volumetrica"""
    open: float
    high: float
    low: float
    close: float
    volume: int
    timestamp_open: datetime
    timestamp_close: datetime
    ticks_count: int
    
    def __repr__(self):
        return f"VC(O:{self.open:.2f} H:{self.high:.2f} L:{self.low:.2f} C:{self.close:.2f} V:{self.volume})"


class VolumetricCandleBuilder:
    """Costruisce candele volumetriche dai tick"""
    
    def __init__(self, volume_target: int = 5000, symbol: str = 'ES'):
        """
        Inizializza il builder
        
        Args:
            volume_target: Volume per formare una candela (default: 5000 per ES)
            symbol: Nome simbolo (ES, CL, ecc.)
        """
        self.volume_target = volume_target
        self.symbol = symbol
        self.accumulated_volume = 0
        self.current_candle_open = None
        self.current_candle_high = None
        self.current_candle_low = None
        self.current_candle_close = None
        self.timestamp_open = None
        self.timestamp_close = None
        self.ticks_count = 0
        self.completed_candles = []
        
        logger.info(f"📊 VolumetricCandleBuilder inizializzato: {symbol} @ {volume_target} volume")
    
    def add_tick(self, price: float, volume: int, timestamp: datetime = None) -> Optional[VolumetricCandle]:
        """
        Aggiunge un tick e ritorna una candela completata se raggiunge il volume target
        
        Args:
            price: Prezzo del tick
            volume: Volume del tick
            timestamp: Timestamp del tick
            
        Returns:
            VolumetricCandle se completata, None altrimenti
        """
        if timestamp is None:
            timestamp = datetime.now()
        
        # Primo tick della candela
        if self.current_candle_open is None:
            self.current_candle_open = price
            self.current_candle_high = price
            self.current_candle_low = price
            self.current_candle_close = price
            self.timestamp_open = timestamp
            self.accumulated_volume = 0
            self.ticks_count = 0
        
        # Aggiorna OHLC
        self.current_candle_high = max(self.current_candle_high, price)
        self.current_candle_low = min(self.current_candle_low, price)
        self.current_candle_close = price
        self.accumulated_volume += volume
        self.ticks_count += 1
        self.timestamp_close = timestamp
        
        # Controlla se la candela è completa
        if self.accumulated_volume >= self.volume_target:
            candle = VolumetricCandle(
                open=self.current_candle_open,
                high=self.current_candle_high,
                low=self.current_candle_low,
                close=self.current_candle_close,
                volume=self.accumulated_volume,
                timestamp_open=self.timestamp_open,
                timestamp_close=self.timestamp_close,
                ticks_count=self.ticks_count
            )
            
            self.completed_candles.append(candle)
            
            # Reset per prossima candela
            excess_volume = self.accumulated_volume - self.volume_target
            self.current_candle_open = None
            self.current_candle_high = None
            self.current_candle_low = None
            self.current_candle_close = None
            self.accumulated_volume = 0
            self.ticks_count = 0
            self.timestamp_open = None
            
            # Se c'è volume in eccesso, lo usa per la prossima candela
            if excess_volume > 0:
                return self.add_tick(price, excess_volume, timestamp)
            
            return candle
        
        return None
    
    def get_current_progress(self) -> Dict:
        """Ritorna lo stato attuale della candela in costruzione"""
        return {
            'accumulated_volume': self.accumulated_volume,
            'volume_target': self.volume_target,
            'progress_pct': (self.accumulated_volume / self.volume_target) * 100 if self.volume_target > 0 else 0,
            'ticks_count': self.ticks_count,
            'open': self.current_candle_open,
            'high': self.current_candle_high,
            'low': self.current_candle_low,
            'close': self.current_candle_close
        }
    
    def get_completed_candles(self, limit: int = None) -> List[VolumetricCandle]:
        """Ritorna le candele completate"""
        if limit is None:
            return self.completed_candles
        return self.completed_candles[-limit:]
    
    def reset(self):
        """Reset del builder (per nuovo giorno/sessione)"""
        self.accumulated_volume = 0
        self.current_candle_open = None
        self.current_candle_high = None
        self.current_candle_low = None
        self.current_candle_close = None
        self.timestamp_open = None
        self.timestamp_close = None
        self.ticks_count = 0
        self.completed_candles = []
        logger.info(f"🔄 VolumetricCandleBuilder resettato")
    
    def get_last_candle(self) -> Optional[VolumetricCandle]:
        """Ritorna l'ultima candela completata"""
        if len(self.completed_candles) > 0:
            return self.completed_candles[-1]
        return None
    
    def get_candles_count(self) -> int:
        """Ritorna numero di candele completate"""
        return len(self.completed_candles)


# Utility function
def get_volume_target_for_symbol(symbol: str) -> int:
    """Ritorna il volume target appropriato per il simbolo"""
    volume_targets = {
        'ES': 5000,   # E-mini S&P
        'MES': 5000,  # Micro E-mini S&P (stesso di ES)
        'NQ': 5000,   # E-mini Nasdaq
        'MNQ': 5000,  # Micro E-mini Nasdaq
        'CL': 2000,   # Crude Oil
        'GC': 2000,   # Gold
    }
    
    return volume_targets.get(symbol.upper(), 5000)  # Default 5000 se non trovato


if __name__ == "__main__":
    print("="*70)
    print("Testing Volumetric Candle Builder")
    print("="*70)
    
    builder = VolumetricCandleBuilder(volume_target=1000, symbol='ES')
    
    # Simula tick
    tick_data = [
        (5850.25, 100),
        (5850.50, 150),
        (5850.75, 200),
        (5851.00, 250),
        (5851.25, 300),
    ]
    
    print("\nAggiungendo tick...")
    for price, volume in tick_data:
        candle = builder.add_tick(price, volume)
        if candle:
            print(f"✅ Candela completata: {candle}")
        progress = builder.get_current_progress()
        print(f"   Progress: {progress['accumulated_volume']}/{progress['volume_target']} ({progress['progress_pct']:.1f}%)")
    
    print(f"\nCandele completate: {builder.get_candles_count()}")
    print("="*70)
