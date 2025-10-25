import numpy as np
import pandas as pd
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class VWAPCalculator:
    """Calcola VWAP + Standard Deviations (Metodo Statistico Corretto)"""
    
    def __init__(self, lookback_periods: int = 50):
        """
        Inizializza VWAP calculator
        
        Args:
            lookback_periods: Numero di periodi da considerare (default: 50)
            Ridotto per aumentare reattività e ridurre volatilità calcolata
        """
        self.lookback_periods = lookback_periods
        self.price_history = []
        self.volume_history = []
        
    def add_bar(self, price: float, volume: int):
        """
        Aggiunge una candela ai dati storici
        
        Args:
            price: Prezzo medio della candela (High+Low+Close)/3
            volume: Volume della candela
        """
        self.price_history.append(price)
        self.volume_history.append(volume)
        
        # Mantieni solo gli ultimi N periodi
        if len(self.price_history) > self.lookback_periods:
            self.price_history.pop(0)
            self.volume_history.pop(0)
    
    def calculate_vwap(self) -> Optional[float]:
        """
        Calcola VWAP (Volume Weighted Average Price)
        Formula: VWAP = Σ(Price × Volume) / Σ(Volume)
        
        Returns:
            Valore VWAP o None se dati insufficienti
        """
        if len(self.price_history) == 0:
            return None
        
        tp_v = np.sum(np.array(self.price_history) * np.array(self.volume_history))
        total_volume = np.sum(self.volume_history)
        
        if total_volume == 0:
            return None
        
        vwap = tp_v / total_volume
        return round(vwap, 2)
    
    def calculate_std_dev(self) -> Optional[float]:
        """
        Calcola Deviazione Standard dei prezzi ponderata per volume
        Questo è il metodo CORRETTO usato da VWAP standard deviation bands
        
        Returns:
            Valore std dev o None se dati insufficienti
        """
        if len(self.price_history) < 2:
            return None
        
        vwap = self.calculate_vwap()
        if vwap is None:
            return None
        
        # Deviazione standard ponderata per volume
        prices = np.array(self.price_history)
        volumes = np.array(self.volume_history)
        
        # Weighted variance
        variance = np.sum(volumes * (prices - vwap) ** 2) / np.sum(volumes)
        std_dev = np.sqrt(variance)
        
        return round(std_dev, 2)
    
    def get_sd_levels(self) -> Optional[Dict]:
        """
        Calcola i livelli SD usando DEVIAZIONE STANDARD STATISTICA (metodo corretto)
        
        SD = VWAP ± (1/2/3 × StdDev calcolato)
        
        Con lookback_periods ridotto (50), StdDev è più piccolo e reattivo.
        
        Returns:
            Dict con VWAP e tutti i livelli SD
        """
        vwap = self.calculate_vwap()
        std_dev = self.calculate_std_dev()
        
        if vwap is None or std_dev is None:
            return None
        
        levels = {
            'vwap': vwap,
            'std_dev': std_dev,
            
            # Multiples di standard deviation (metodo corretto)
            'sd_plus_1': round(vwap + (1 * std_dev), 2),
            'sd_plus_2': round(vwap + (2 * std_dev), 2),
            'sd_plus_3': round(vwap + (3 * std_dev), 2),
            
            'sd_minus_1': round(vwap - (1 * std_dev), 2),
            'sd_minus_2': round(vwap - (2 * std_dev), 2),
            'sd_minus_3': round(vwap - (3 * std_dev), 2),
        }
        
        return levels
    
    def get_tp_levels(self, position_direction: str = 'LONG') -> Dict:
        """
        Ritorna i Take Profit levels in base alla direzione
        
        Args:
            position_direction: 'LONG' o 'SHORT'
            
        Returns:
            Dict con TP1, TP2, TP3 e VWAP per gestione posizione
        """
        sd_levels = self.get_sd_levels()
        
        if sd_levels is None:
            return {}
        
        if position_direction.upper() == 'LONG':
            return {
                'entry': None,
                'tp1': sd_levels['sd_plus_1'],
                'tp2': sd_levels['sd_plus_2'],
                'tp3': sd_levels['sd_plus_3'],
                'vwap_reversal': sd_levels['vwap'],
                'stop': sd_levels['sd_minus_1']
            }
        
        elif position_direction.upper() == 'SHORT':
            return {
                'entry': None,
                'tp1': sd_levels['sd_minus_1'],
                'tp2': sd_levels['sd_minus_2'],
                'tp3': sd_levels['sd_minus_3'],
                'vwap_reversal': sd_levels['vwap'],
                'stop': sd_levels['sd_plus_1']
            }
        
        return {}
    
    def is_price_above_vwap(self, current_price: float) -> Optional[bool]:
        """Prezzo sopra VWAP?"""
        vwap = self.calculate_vwap()
        if vwap is None:
            return None
        return current_price > vwap
    
    def is_price_near_sd(self, current_price: float, sd_level: int = 1, 
                        tolerance_pct: float = 0.1) -> Optional[bool]:
        """
        Prezzo vicino a un SD level? (con tolleranza %)
        
        Args:
            current_price: Prezzo corrente
            sd_level: 1, 2 o 3
            tolerance_pct: Tolleranza in % (default 0.1%)
        """
        sd_levels = self.get_sd_levels()
        if sd_levels is None:
            return None
        
        level_key_plus = f'sd_plus_{sd_level}'
        level_key_minus = f'sd_minus_{sd_level}'
        
        if level_key_plus not in sd_levels:
            return None
        
        level_plus = sd_levels[level_key_plus]
        level_minus = sd_levels[level_key_minus]
        
        tolerance = (current_price * tolerance_pct) / 100
        
        near_plus = abs(current_price - level_plus) <= tolerance
        near_minus = abs(current_price - level_minus) <= tolerance
        
        return near_plus or near_minus
    
    def print_levels(self):
        """Stampa i livelli VWAP+SD in formato leggibile"""
        sd_levels = self.get_sd_levels()
        
        if sd_levels is None:
            logger.warning("Dati insufficienti per calcolare VWAP+SD")
            return
        
        logger.info("=" * 50)
        logger.info("VWAP + STANDARD DEVIATIONS (Metodo Statistico)")
        logger.info("=" * 50)
        logger.info(f"VWAP:        {sd_levels['vwap']}")
        logger.info(f"StdDev:      {sd_levels['std_dev']:.2f}")
        logger.info("-" * 50)
        logger.info(f"SD +3: {sd_levels['sd_plus_3']}  (TP3)")
        logger.info(f"SD +2: {sd_levels['sd_plus_2']}  (TP2)")
        logger.info(f"SD +1: {sd_levels['sd_plus_1']}  (TP1)")
        logger.info(f"VWAP: {sd_levels['vwap']}")
        logger.info(f"SD -1: {sd_levels['sd_minus_1']}  (TP1)")
        logger.info(f"SD -2: {sd_levels['sd_minus_2']}  (TP2)")
        logger.info(f"SD -3: {sd_levels['sd_minus_3']}  (TP3)")
        logger.info("=" * 50)
    
    def reset(self):
        """Reset per nuovo giorno di trading"""
        self.price_history = []
        self.volume_history = []
        logger.info("VWAP Calculator resettato per nuovo giorno")
