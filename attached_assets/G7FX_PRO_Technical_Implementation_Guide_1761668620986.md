# G7FX PRO Course - Technical Implementation Guide for Replit

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │Dashboard │ │  Charts  │ │ Profiles │ │Trade Manager │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │Hypothesis│ │  Signal  │ │   Risk   │ │   Execution  │  │
│  │Generator │ │ Generator│ │ Manager  │ │    Engine    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      ANALYSIS LAYER                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Profile  │ │   VWAP   │ │  Delta   │ │  Footprint   │  │
│  │ Engine   │ │ Calculator│ │ Analyzer │ │   Parser     │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                        DATA LAYER                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │Real-time │ │Historical│ │  Cache   │ │   Database   │  │
│  │   Feed   │ │   Data   │ │  Layer   │ │   Storage    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Core Implementation Modules

### 1. Data Infrastructure

```python
# data/market_data_feed.py
import asyncio
import websockets
import json
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass
from datetime import datetime
import numpy as np

@dataclass
class MarketTick:
    """Single market data point"""
    timestamp: datetime
    price: float
    volume: int
    bid: float
    ask: float
    bid_size: int
    ask_size: int
    aggressor: str  # 'BUY' or 'SELL'

class MarketDataFeed:
    """Real-time market data feed handler"""
    
    def __init__(self, symbols: List[str], provider: str = 'cqg'):
        self.symbols = symbols
        self.provider = provider
        self.callbacks: Dict[str, List[Callable]] = {}
        self.buffer: Dict[str, List[MarketTick]] = {sym: [] for sym in symbols}
        self.is_connected = False
        
    async def connect(self):
        """Establish connection to data provider"""
        # Implementation depends on provider API
        pass
    
    async def subscribe(self, symbol: str, callback: Callable):
        """Subscribe to real-time updates for a symbol"""
        if symbol not in self.callbacks:
            self.callbacks[symbol] = []
        self.callbacks[symbol].append(callback)
        
    async def process_tick(self, symbol: str, tick_data: dict):
        """Process incoming tick data"""
        tick = MarketTick(
            timestamp=datetime.fromisoformat(tick_data['timestamp']),
            price=tick_data['price'],
            volume=tick_data['volume'],
            bid=tick_data['bid'],
            ask=tick_data['ask'],
            bid_size=tick_data['bid_size'],
            ask_size=tick_data['ask_size'],
            aggressor=tick_data['aggressor']
        )
        
        # Add to buffer
        self.buffer[symbol].append(tick)
        
        # Trigger callbacks
        for callback in self.callbacks.get(symbol, []):
            await callback(symbol, tick)
        
    def get_recent_ticks(self, symbol: str, count: int = 100) -> List[MarketTick]:
        """Get recent ticks from buffer"""
        return self.buffer[symbol][-count:] if symbol in self.buffer else []
```

### 2. Profile Calculation Engine

```python
# analysis/profile/volume_profile.py
import numpy as np
import pandas as pd
from typing import Dict, Tuple, Optional
from dataclasses import dataclass

@dataclass
class ProfileLevel:
    """Single price level in profile"""
    price: float
    volume: int
    tpo_count: int  # Time Price Opportunities
    buy_volume: int
    sell_volume: int
    delta: int

class VolumeProfile:
    """Volume Profile calculation and analysis"""
    
    def __init__(self, tick_size: float = 0.25, value_area_pct: float = 0.70):
        self.tick_size = tick_size
        self.value_area_pct = value_area_pct
        self.profile_data: Dict[float, ProfileLevel] = {}
        
    def add_trade(self, price: float, volume: int, aggressor: str, time_period: int):
        """Add a trade to the profile"""
        # Round price to tick
        rounded_price = round(price / self.tick_size) * self.tick_size
        
        if rounded_price not in self.profile_data:
            self.profile_data[rounded_price] = ProfileLevel(
                price=rounded_price,
                volume=0,
                tpo_count=0,
                buy_volume=0,
                sell_volume=0,
                delta=0
            )
        
        level = self.profile_data[rounded_price]
        level.volume += volume
        level.tpo_count += 1
        
        if aggressor == 'BUY':
            level.buy_volume += volume
            level.delta += volume
        else:
            level.sell_volume += volume
            level.delta -= volume
    
    def calculate_value_area(self) -> Dict[str, float]:
        """Calculate Value Area High, Low, and Point of Control"""
        if not self.profile_data:
            return {'vah': 0, 'val': 0, 'poc': 0}
        
        # Sort profile by price
        sorted_profile = sorted(self.profile_data.items(), key=lambda x: x[0])
        
        # Find POC (Point of Control - highest volume price)
        poc_price = max(self.profile_data.keys(), 
                       key=lambda x: self.profile_data[x].volume)
        poc_volume = self.profile_data[poc_price].volume
        
        # Calculate total volume
        total_volume = sum(level.volume for level in self.profile_data.values())
        target_volume = total_volume * self.value_area_pct
        
        # Initialize value area
        va_volume = poc_volume
        upper_idx = lower_idx = None
        
        # Find POC index in sorted profile
        for i, (price, _) in enumerate(sorted_profile):
            if price == poc_price:
                upper_idx = lower_idx = i
                break
        
        # Expand value area from POC
        while va_volume < target_volume:
            upper_volume = lower_volume = 0
            
            # Check volume above
            if upper_idx < len(sorted_profile) - 1:
                upper_volume = sorted_profile[upper_idx + 1][1].volume
            
            # Check volume below
            if lower_idx > 0:
                lower_volume = sorted_profile[lower_idx - 1][1].volume
            
            # Add larger volume side
            if upper_volume >= lower_volume and upper_volume > 0:
                upper_idx += 1
                va_volume += upper_volume
            elif lower_volume > 0:
                lower_idx -= 1
                va_volume += lower_volume
            else:
                break
        
        return {
            'vah': sorted_profile[upper_idx][0],
            'val': sorted_profile[lower_idx][0],
            'poc': poc_price,
            'total_volume': total_volume,
            'va_volume': va_volume
        }
    
    def get_profile_df(self) -> pd.DataFrame:
        """Convert profile to DataFrame for analysis"""
        if not self.profile_data:
            return pd.DataFrame()
        
        df = pd.DataFrame.from_dict(self.profile_data, orient='index')
        df = df.sort_index()
        
        # Add cumulative statistics
        df['cumulative_volume'] = df['volume'].cumsum()
        df['volume_pct'] = df['volume'] / df['volume'].sum() * 100
        df['cumulative_delta'] = df['delta'].cumsum()
        
        return df

# analysis/profile/composite_profile.py
class CompositeProfile:
    """Multi-day composite profile builder"""
    
    def __init__(self, days: int = 5, tick_size: float = 0.25):
        self.days = days
        self.tick_size = tick_size
        self.daily_profiles: List[VolumeProfile] = []
        self.composite: VolumeProfile = VolumeProfile(tick_size)
        
    def add_day_profile(self, profile: VolumeProfile):
        """Add a daily profile to composite"""
        self.daily_profiles.append(profile)
        
        # Merge into composite
        for price, level in profile.profile_data.items():
            self.composite.add_trade(
                price=price,
                volume=level.volume,
                aggressor='BUY' if level.delta > 0 else 'SELL',
                time_period=len(self.daily_profiles)
            )
        
        # Keep only specified number of days
        if len(self.daily_profiles) > self.days:
            self.daily_profiles.pop(0)
            self.rebuild_composite()
    
    def rebuild_composite(self):
        """Rebuild composite from daily profiles"""
        self.composite = VolumeProfile(self.tick_size)
        for profile in self.daily_profiles:
            for price, level in profile.profile_data.items():
                self.composite.add_trade(
                    price=price,
                    volume=level.volume,
                    aggressor='BUY' if level.delta > 0 else 'SELL',
                    time_period=0
                )
```

### 3. VWAP Calculator

```python
# analysis/value/vwap.py
import numpy as np
import pandas as pd
from typing import List, Tuple, Optional
from datetime import datetime, time

class VWAPCalculator:
    """VWAP and standard deviation band calculator"""
    
    def __init__(self, anchor_time: Optional[time] = None):
        self.anchor_time = anchor_time or time(9, 30)  # Default RTH open
        self.reset()
        
    def reset(self):
        """Reset VWAP calculation"""
        self.cumulative_pv = 0  # Price * Volume
        self.cumulative_volume = 0
        self.cumulative_pv2 = 0  # Price^2 * Volume for std dev
        self.prices: List[float] = []
        self.volumes: List[float] = []
        self.vwaps: List[float] = []
        self.timestamps: List[datetime] = []
        
    def add_tick(self, timestamp: datetime, price: float, volume: float):
        """Add new tick to VWAP calculation"""
        # Check if we need to reset at anchor time
        if self.anchor_time and timestamp.time() == self.anchor_time:
            self.reset()
        
        # Update cumulative values
        pv = price * volume
        self.cumulative_pv += pv
        self.cumulative_volume += volume
        self.cumulative_pv2 += price * price * volume
        
        # Calculate VWAP
        vwap = self.cumulative_pv / self.cumulative_volume if self.cumulative_volume > 0 else price
        
        # Store values
        self.prices.append(price)
        self.volumes.append(volume)
        self.vwaps.append(vwap)
        self.timestamps.append(timestamp)
        
        return vwap
    
    def calculate_bands(self, num_std: float = 2.0) -> Tuple[float, float, float]:
        """Calculate VWAP with standard deviation bands"""
        if not self.vwaps:
            return 0, 0, 0
        
        current_vwap = self.vwaps[-1]
        
        # Calculate variance
        if self.cumulative_volume > 0:
            variance = (self.cumulative_pv2 / self.cumulative_volume) - (current_vwap ** 2)
            std_dev = np.sqrt(max(0, variance))
        else:
            std_dev = 0
        
        upper_band = current_vwap + (std_dev * num_std)
        lower_band = current_vwap - (std_dev * num_std)
        
        return current_vwap, upper_band, lower_band
    
    def get_anchored_vwap(self, anchor_timestamp: datetime) -> float:
        """Calculate VWAP from specific anchor point"""
        # Find anchor index
        anchor_idx = None
        for i, ts in enumerate(self.timestamps):
            if ts >= anchor_timestamp:
                anchor_idx = i
                break
        
        if anchor_idx is None:
            return 0
        
        # Calculate from anchor
        pv_sum = sum(p * v for p, v in zip(
            self.prices[anchor_idx:], 
            self.volumes[anchor_idx:]
        ))
        volume_sum = sum(self.volumes[anchor_idx:])
        
        return pv_sum / volume_sum if volume_sum > 0 else 0

# analysis/value/developing_value.py
class DevelopingValueArea:
    """Track developing value area throughout the day"""
    
    def __init__(self, update_interval: int = 30):  # Update every 30 seconds
        self.update_interval = update_interval
        self.current_profile = VolumeProfile()
        self.value_history = []
        self.last_update = None
        
    def add_trade(self, timestamp: datetime, price: float, volume: int, aggressor: str):
        """Add trade and update developing value if needed"""
        self.current_profile.add_trade(price, volume, aggressor, 0)
        
        # Check if we should update value area
        if self.last_update is None:
            self.last_update = timestamp
        elif (timestamp - self.last_update).seconds >= self.update_interval:
            va = self.current_profile.calculate_value_area()
            self.value_history.append({
                'timestamp': timestamp,
                'vah': va['vah'],
                'val': va['val'],
                'poc': va['poc']
            })
            self.last_update = timestamp
    
    def get_current_value_area(self) -> Dict[str, float]:
        """Get current developing value area"""
        return self.current_profile.calculate_value_area()
    
    def detect_migration(self, previous_va: Dict[str, float]) -> str:
        """Detect value migration relative to previous value area"""
        current_va = self.get_current_value_area()
        
        # Check for higher migration
        if current_va['val'] > previous_va['vah']:
            return 'HIGHER'
        # Check for lower migration
        elif current_va['vah'] < previous_va['val']:
            return 'LOWER'
        # Check for overlapping
        else:
            overlap_pct = self._calculate_overlap(current_va, previous_va)
            if overlap_pct > 0.7:
                return 'BALANCED'
            elif current_va['poc'] > previous_va['poc']:
                return 'HIGHER_BIAS'
            else:
                return 'LOWER_BIAS'
    
    def _calculate_overlap(self, va1: Dict, va2: Dict) -> float:
        """Calculate percentage overlap between two value areas"""
        overlap_high = min(va1['vah'], va2['vah'])
        overlap_low = max(va1['val'], va2['val'])
        
        if overlap_high <= overlap_low:
            return 0
        
        overlap_range = overlap_high - overlap_low
        va1_range = va1['vah'] - va1['val']
        va2_range = va2['vah'] - va2['val']
        avg_range = (va1_range + va2_range) / 2
        
        return overlap_range / avg_range if avg_range > 0 else 0
```

### 4. Order Flow Analysis

```python
# analysis/orderflow/cumulative_delta.py
import numpy as np
from typing import List, Dict, Optional
from dataclasses import dataclass

@dataclass
class DeltaBar:
    """Single bar of delta information"""
    timestamp: datetime
    open_delta: int
    high_delta: int
    low_delta: int
    close_delta: int
    volume: int
    price_open: float
    price_high: float
    price_low: float
    price_close: float

class CumulativeDelta:
    """Cumulative delta calculation and divergence detection"""
    
    def __init__(self, bar_size: int = 500):  # Volume bars
        self.bar_size = bar_size
        self.current_delta = 0
        self.current_bar = None
        self.delta_bars: List[DeltaBar] = []
        self.current_bar_volume = 0
        self.intrabar_deltas = []
        
    def add_trade(self, timestamp: datetime, price: float, volume: int, aggressor: str):
        """Add trade and update cumulative delta"""
        # Calculate delta change
        delta_change = volume if aggressor == 'BUY' else -volume
        self.current_delta += delta_change
        
        # Initialize new bar if needed
        if self.current_bar is None:
            self.current_bar = DeltaBar(
                timestamp=timestamp,
                open_delta=self.current_delta,
                high_delta=self.current_delta,
                low_delta=self.current_delta,
                close_delta=self.current_delta,
                volume=0,
                price_open=price,
                price_high=price,
                price_low=price,
                price_close=price
            )
        
        # Update current bar
        self.current_bar.high_delta = max(self.current_bar.high_delta, self.current_delta)
        self.current_bar.low_delta = min(self.current_bar.low_delta, self.current_delta)
        self.current_bar.close_delta = self.current_delta
        self.current_bar.price_high = max(self.current_bar.price_high, price)
        self.current_bar.price_low = min(self.current_bar.price_low, price)
        self.current_bar.price_close = price
        
        # Add to bar volume
        self.current_bar_volume += volume
        self.current_bar.volume += volume
        self.intrabar_deltas.append(self.current_delta)
        
        # Check if bar is complete
        if self.current_bar_volume >= self.bar_size:
            self.delta_bars.append(self.current_bar)
            self.current_bar = None
            self.current_bar_volume = 0
            self.intrabar_deltas = []
    
    def detect_divergence(self, lookback: int = 20) -> Optional[str]:
        """Detect divergence between price and delta"""
        if len(self.delta_bars) < lookback:
            return None
        
        recent_bars = self.delta_bars[-lookback:]
        
        # Check for price highs/lows
        price_highs = [bar.price_high for bar in recent_bars]
        price_lows = [bar.price_low for bar in recent_bars]
        delta_highs = [bar.high_delta for bar in recent_bars]
        delta_lows = [bar.low_delta for bar in recent_bars]
        
        # Bullish divergence: Lower price low, higher delta low
        if (price_lows[-1] < min(price_lows[:-1]) and 
            delta_lows[-1] > min(delta_lows[:-1])):
            return 'BULLISH_DIVERGENCE'
        
        # Bearish divergence: Higher price high, lower delta high
        if (price_highs[-1] > max(price_highs[:-1]) and 
            delta_highs[-1] < max(delta_highs[:-1])):
            return 'BEARISH_DIVERGENCE'
        
        return None
    
    def detect_absorption(self, threshold: float = 0.7) -> Optional[str]:
        """Detect absorption (price moves opposite to delta)"""
        if not self.delta_bars or len(self.delta_bars) < 2:
            return None
        
        last_bar = self.delta_bars[-1]
        prev_bar = self.delta_bars[-2]
        
        price_change = last_bar.price_close - prev_bar.price_close
        delta_change = last_bar.close_delta - prev_bar.close_delta
        
        # Normalize changes
        if price_change != 0 and delta_change != 0:
            correlation = np.sign(price_change) * np.sign(delta_change)
            
            if correlation < 0:  # Opposite directions
                if price_change > 0 and delta_change < 0:
                    return 'BUYING_ABSORPTION'  # Price up, delta down
                else:
                    return 'SELLING_ABSORPTION'  # Price down, delta up
        
        return None

# analysis/orderflow/footprint.py
class FootprintChart:
    """Footprint chart analysis"""
    
    def __init__(self, price_levels: int = 10, volume_filter: int = 100):
        self.price_levels = price_levels
        self.volume_filter = volume_filter
        self.current_bar = {}
        self.completed_bars = []
        
    def add_trade(self, price: float, volume: int, aggressor: str, timestamp: datetime):
        """Add trade to footprint"""
        if price not in self.current_bar:
            self.current_bar[price] = {
                'bid_volume': 0,
                'ask_volume': 0,
                'delta': 0,
                'total_volume': 0
            }
        
        level = self.current_bar[price]
        if aggressor == 'BUY':
            level['ask_volume'] += volume
            level['delta'] += volume
        else:
            level['bid_volume'] += volume
            level['delta'] -= volume
        
        level['total_volume'] += volume
    
    def identify_imbalances(self, ratio_threshold: float = 3.0) -> List[Dict]:
        """Identify order flow imbalances in current bar"""
        imbalances = []
        
        sorted_prices = sorted(self.current_bar.keys())
        
        for i in range(len(sorted_prices) - 1):
            current_price = sorted_prices[i]
            next_price = sorted_prices[i + 1]
            
            current_level = self.current_bar[current_price]
            next_level = self.current_bar[next_price]
            
            # Check diagonal imbalances
            # Buying imbalance: Ask volume at current > Bid at next
            if current_level['ask_volume'] > 0 and next_level['bid_volume'] > 0:
                ratio = current_level['ask_volume'] / next_level['bid_volume']
                if ratio >= ratio_threshold:
                    imbalances.append({
                        'type': 'BUYING_IMBALANCE',
                        'price': current_price,
                        'ratio': ratio,
                        'volume': current_level['ask_volume']
                    })
            
            # Selling imbalance: Bid volume at next > Ask at current
            if next_level['bid_volume'] > 0 and current_level['ask_volume'] > 0:
                ratio = next_level['bid_volume'] / current_level['ask_volume']
                if ratio >= ratio_threshold:
                    imbalances.append({
                        'type': 'SELLING_IMBALANCE',
                        'price': next_price,
                        'ratio': ratio,
                        'volume': next_level['bid_volume']
                    })
        
        return imbalances
    
    def identify_trapped_traders(self, min_volume: int = 500) -> List[Dict]:
        """Identify potential trapped traders"""
        trapped = []
        
        if not self.current_bar:
            return trapped
        
        sorted_prices = sorted(self.current_bar.keys())
        high_price = sorted_prices[-1]
        low_price = sorted_prices[0]
        
        # Check for trapped buyers at highs
        high_level = self.current_bar[high_price]
        if high_level['delta'] > min_volume:
            # Strong buying at highs could indicate trapped longs
            trapped.append({
                'type': 'TRAPPED_BUYERS',
                'price': high_price,
                'volume': high_level['ask_volume'],
                'delta': high_level['delta']
            })
        
        # Check for trapped sellers at lows
        low_level = self.current_bar[low_price]
        if low_level['delta'] < -min_volume:
            # Strong selling at lows could indicate trapped shorts
            trapped.append({
                'type': 'TRAPPED_SELLERS',
                'price': low_price,
                'volume': low_level['bid_volume'],
                'delta': low_level['delta']
            })
        
        return trapped
```

### 5. Hypothesis Generator

```python
# strategy/hypothesis.py
from enum import Enum
from typing import Dict, List, Optional
from dataclasses import dataclass

class MarketCondition(Enum):
    TREND_UP = "TREND_UP"
    TREND_DOWN = "TREND_DOWN"
    BALANCE = "BALANCE"
    BREAKOUT_PENDING = "BREAKOUT_PENDING"

@dataclass
class TradingHypothesis:
    """Daily trading hypothesis"""
    date: datetime
    condition: MarketCondition
    key_levels: Dict[str, float]
    bias: str  # 'LONG', 'SHORT', 'NEUTRAL'
    primary_scenario: str
    alternative_scenario: str
    invalidation_level: float
    confidence: float  # 0-1

class HypothesisGenerator:
    """Generate daily trading hypothesis based on context"""
    
    def __init__(self):
        self.profile_analyzer = VolumeProfile()
        self.vwap_calc = VWAPCalculator()
        self.delta_analyzer = CumulativeDelta()
        
    def generate_hypothesis(
        self,
        composite_profile: CompositeProfile,
        yesterday_profile: VolumeProfile,
        overnight_data: List[MarketTick]
    ) -> TradingHypothesis:
        """Generate trading hypothesis for the day"""
        
        # Get key levels from composite
        composite_va = composite_profile.composite.calculate_value_area()
        
        # Get yesterday's value area
        yesterday_va = yesterday_profile.calculate_value_area()
        
        # Analyze overnight activity
        overnight_range = self._analyze_overnight(overnight_data)
        
        # Determine market condition
        condition = self._determine_condition(
            composite_va, yesterday_va, overnight_range
        )
        
        # Generate key levels
        key_levels = {
            'comp_vah': composite_va['vah'],
            'comp_val': composite_va['val'],
            'comp_poc': composite_va['poc'],
            'yest_vah': yesterday_va['vah'],
            'yest_val': yesterday_va['val'],
            'yest_poc': yesterday_va['poc'],
            'overnight_high': overnight_range['high'],
            'overnight_low': overnight_range['low'],
            'overnight_poc': overnight_range['poc']
        }
        
        # Determine bias
        bias = self._determine_bias(condition, key_levels, overnight_data[-1].price)
        
        # Create scenarios
        primary, alternative, invalidation = self._create_scenarios(
            condition, bias, key_levels
        )
        
        # Calculate confidence
        confidence = self._calculate_confidence(condition, overnight_range)
        
        return TradingHypothesis(
            date=datetime.now(),
            condition=condition,
            key_levels=key_levels,
            bias=bias,
            primary_scenario=primary,
            alternative_scenario=alternative,
            invalidation_level=invalidation,
            confidence=confidence
        )
    
    def _determine_condition(
        self, 
        composite_va: Dict, 
        yesterday_va: Dict, 
        overnight_range: Dict
    ) -> MarketCondition:
        """Determine market condition based on value relationships"""
        
        # Check for trend
        if yesterday_va['val'] > composite_va['vah']:
            return MarketCondition.TREND_UP
        elif yesterday_va['vah'] < composite_va['val']:
            return MarketCondition.TREND_DOWN
        
        # Check for balance
        overlap = self._calculate_overlap(yesterday_va, composite_va)
        if overlap > 0.7:
            return MarketCondition.BALANCE
        
        # Check for breakout potential
        overnight_range_size = overnight_range['high'] - overnight_range['low']
        avg_range = composite_va['vah'] - composite_va['val']
        
        if overnight_range_size < avg_range * 0.5:
            return MarketCondition.BREAKOUT_PENDING
        
        return MarketCondition.BALANCE
    
    def _determine_bias(
        self, 
        condition: MarketCondition, 
        key_levels: Dict,
        current_price: float
    ) -> str:
        """Determine directional bias"""
        
        if condition == MarketCondition.TREND_UP:
            return 'LONG'
        elif condition == MarketCondition.TREND_DOWN:
            return 'SHORT'
        
        # For balanced markets, use price location
        comp_midpoint = (key_levels['comp_vah'] + key_levels['comp_val']) / 2
        
        if current_price > key_levels['comp_vah']:
            return 'LONG'
        elif current_price < key_levels['comp_val']:
            return 'SHORT'
        else:
            return 'NEUTRAL'
    
    def _create_scenarios(
        self, 
        condition: MarketCondition,
        bias: str,
        key_levels: Dict
    ) -> Tuple[str, str, float]:
        """Create trading scenarios and invalidation"""
        
        if condition == MarketCondition.TREND_UP:
            primary = f"Look for pullback to {key_levels['yest_poc']:.2f} for long entry, target {key_levels['comp_vah'] * 1.005:.2f}"
            alternative = f"If below {key_levels['yest_val']:.2f}, expect test of {key_levels['comp_poc']:.2f}"
            invalidation = key_levels['comp_val']
            
        elif condition == MarketCondition.TREND_DOWN:
            primary = f"Look for rally to {key_levels['yest_poc']:.2f} for short entry, target {key_levels['comp_val'] * 0.995:.2f}"
            alternative = f"If above {key_levels['yest_vah']:.2f}, expect test of {key_levels['comp_poc']:.2f}"
            invalidation = key_levels['comp_vah']
            
        elif condition == MarketCondition.BALANCE:
            primary = f"Fade moves to {key_levels['comp_vah']:.2f} and {key_levels['comp_val']:.2f}"
            alternative = f"If break above/below value, look for retest as support/resistance"
            invalidation = key_levels['comp_vah'] * 1.01 if bias == 'SHORT' else key_levels['comp_val'] * 0.99
            
        else:  # BREAKOUT_PENDING
            primary = f"Wait for breakout above {key_levels['overnight_high']:.2f} or below {key_levels['overnight_low']:.2f}"
            alternative = f"If false breakout, fade back to {key_levels['comp_poc']:.2f}"
            invalidation = key_levels['comp_poc']
        
        return primary, alternative, invalidation
```

### 6. Signal Generation

```python
# strategy/signals.py
from enum import Enum
from typing import Optional, List
from dataclasses import dataclass

class SignalType(Enum):
    VALUE_AREA_FADE = "VALUE_AREA_FADE"
    VALUE_AREA_BREAK = "VALUE_AREA_BREAK"
    VWAP_BOUNCE = "VWAP_BOUNCE"
    DELTA_DIVERGENCE = "DELTA_DIVERGENCE"
    ABSORPTION = "ABSORPTION"
    TRAPPED_TRADERS = "TRAPPED_TRADERS"

@dataclass
class TradeSignal:
    timestamp: datetime
    signal_type: SignalType
    direction: str  # 'LONG' or 'SHORT'
    entry_price: float
    stop_loss: float
    target_1: float
    target_2: float
    confidence: float
    reason: str

class SignalGenerator:
    """Generate trade signals based on hypothesis and order flow"""
    
    def __init__(self, hypothesis: TradingHypothesis):
        self.hypothesis = hypothesis
        self.active_signals: List[TradeSignal] = []
        
    def check_for_signals(
        self,
        current_price: float,
        current_va: Dict[str, float],
        vwap_data: Tuple[float, float, float],
        delta_divergence: Optional[str],
        absorption: Optional[str],
        footprint_imbalances: List[Dict]
    ) -> Optional[TradeSignal]:
        """Check for trade signals based on current market state"""
        
        # Check value area signals
        va_signal = self._check_value_area_signal(current_price, current_va)
        if va_signal:
            return va_signal
        
        # Check VWAP signals
        vwap_signal = self._check_vwap_signal(current_price, vwap_data)
        if vwap_signal:
            return vwap_signal
        
        # Check order flow signals
        of_signal = self._check_orderflow_signal(
            current_price, delta_divergence, absorption, footprint_imbalances
        )
        if of_signal:
            return of_signal
        
        return None
    
    def _check_value_area_signal(
        self, 
        price: float, 
        current_va: Dict
    ) -> Optional[TradeSignal]:
        """Check for value area based signals"""
        
        key_levels = self.hypothesis.key_levels
        
        # Value Area Fade Setup
        if self.hypothesis.condition == MarketCondition.BALANCE:
            # Check for test of VAH
            if abs(price - current_va['vah']) < 0.25:
                return TradeSignal(
                    timestamp=datetime.now(),
                    signal_type=SignalType.VALUE_AREA_FADE,
                    direction='SHORT',
                    entry_price=price,
                    stop_loss=current_va['vah'] + 1.0,
                    target_1=current_va['poc'],
                    target_2=current_va['val'],
                    confidence=0.7,
                    reason=f"Testing VAH at {current_va['vah']:.2f} in balanced market"
                )
            
            # Check for test of VAL
            elif abs(price - current_va['val']) < 0.25:
                return TradeSignal(
                    timestamp=datetime.now(),
                    signal_type=SignalType.VALUE_AREA_FADE,
                    direction='LONG',
                    entry_price=price,
                    stop_loss=current_va['val'] - 1.0,
                    target_1=current_va['poc'],
                    target_2=current_va['vah'],
                    confidence=0.7,
                    reason=f"Testing VAL at {current_va['val']:.2f} in balanced market"
                )
        
        # Value Area Breakout Setup
        elif self.hypothesis.condition in [MarketCondition.TREND_UP, MarketCondition.TREND_DOWN]:
            # Breakout above VAH
            if price > current_va['vah'] and price < current_va['vah'] + 0.5:
                return TradeSignal(
                    timestamp=datetime.now(),
                    signal_type=SignalType.VALUE_AREA_BREAK,
                    direction='LONG',
                    entry_price=price,
                    stop_loss=current_va['vah'] - 0.5,
                    target_1=current_va['vah'] + (current_va['vah'] - current_va['val']) * 0.5,
                    target_2=current_va['vah'] + (current_va['vah'] - current_va['val']),
                    confidence=0.8,
                    reason=f"Value area breakout above {current_va['vah']:.2f}"
                )
        
        return None
    
    def _check_vwap_signal(
        self, 
        price: float,
        vwap_data: Tuple[float, float, float]
    ) -> Optional[TradeSignal]:
        """Check for VWAP based signals"""
        
        vwap, upper_band, lower_band = vwap_data
        
        # VWAP bounce from standard deviation bands
        if abs(price - lower_band) < 0.25 and self.hypothesis.bias != 'SHORT':
            return TradeSignal(
                timestamp=datetime.now(),
                signal_type=SignalType.VWAP_BOUNCE,
                direction='LONG',
                entry_price=price,
                stop_loss=lower_band - 0.5,
                target_1=vwap,
                target_2=upper_band,
                confidence=0.65,
                reason=f"VWAP lower band bounce at {lower_band:.2f}"
            )
        
        elif abs(price - upper_band) < 0.25 and self.hypothesis.bias != 'LONG':
            return TradeSignal(
                timestamp=datetime.now(),
                signal_type=SignalType.VWAP_BOUNCE,
                direction='SHORT',
                entry_price=price,
                stop_loss=upper_band + 0.5,
                target_1=vwap,
                target_2=lower_band,
                confidence=0.65,
                reason=f"VWAP upper band bounce at {upper_band:.2f}"
            )
        
        return None
    
    def _check_orderflow_signal(
        self,
        price: float,
        delta_divergence: Optional[str],
        absorption: Optional[str],
        footprint_imbalances: List[Dict]
    ) -> Optional[TradeSignal]:
        """Check for order flow based signals"""
        
        # Delta divergence signal
        if delta_divergence == 'BULLISH_DIVERGENCE':
            return TradeSignal(
                timestamp=datetime.now(),
                signal_type=SignalType.DELTA_DIVERGENCE,
                direction='LONG',
                entry_price=price,
                stop_loss=price - 1.0,
                target_1=price + 1.5,
                target_2=price + 3.0,
                confidence=0.75,
                reason="Bullish divergence in cumulative delta"
            )
        
        elif delta_divergence == 'BEARISH_DIVERGENCE':
            return TradeSignal(
                timestamp=datetime.now(),
                signal_type=SignalType.DELTA_DIVERGENCE,
                direction='SHORT',
                entry_price=price,
                stop_loss=price + 1.0,
                target_1=price - 1.5,
                target_2=price - 3.0,
                confidence=0.75,
                reason="Bearish divergence in cumulative delta"
            )
        
        # Absorption signal
        if absorption == 'BUYING_ABSORPTION':
            return TradeSignal(
                timestamp=datetime.now(),
                signal_type=SignalType.ABSORPTION,
                direction='SHORT',
                entry_price=price,
                stop_loss=price + 0.75,
                target_1=price - 1.0,
                target_2=price - 2.0,
                confidence=0.7,
                reason="Sellers absorbing buying pressure"
            )
        
        elif absorption == 'SELLING_ABSORPTION':
            return TradeSignal(
                timestamp=datetime.now(),
                signal_type=SignalType.ABSORPTION,
                direction='LONG',
                entry_price=price,
                stop_loss=price - 0.75,
                target_1=price + 1.0,
                target_2=price + 2.0,
                confidence=0.7,
                reason="Buyers absorbing selling pressure"
            )
        
        return None
```

### 7. Execution Engine

```python
# execution/trade_manager.py
from enum import Enum
from typing import Dict, List, Optional
from dataclasses import dataclass
import asyncio

class OrderType(Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    STOP = "STOP"
    STOP_LIMIT = "STOP_LIMIT"

class OrderStatus(Enum):
    PENDING = "PENDING"
    FILLED = "FILLED"
    PARTIAL = "PARTIAL"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"

@dataclass
class Order:
    order_id: str
    symbol: str
    side: str  # 'BUY' or 'SELL'
    quantity: int
    order_type: OrderType
    price: Optional[float]
    stop_price: Optional[float]
    status: OrderStatus
    filled_quantity: int
    average_fill_price: float
    timestamp: datetime

@dataclass
class Position:
    symbol: str
    quantity: int  # Positive for long, negative for short
    average_price: float
    current_price: float
    unrealized_pnl: float
    realized_pnl: float

class TradeManager:
    """Manage trade execution and position tracking"""
    
    def __init__(self, broker_api):
        self.broker = broker_api
        self.positions: Dict[str, Position] = {}
        self.orders: Dict[str, Order] = {}
        self.active_trades: List[TradeSignal] = []
        
    async def execute_signal(self, signal: TradeSignal) -> Optional[Order]:
        """Execute a trade signal"""
        
        # Check if we already have a position
        if signal.symbol in self.positions:
            existing = self.positions[signal.symbol]
            if (existing.quantity > 0 and signal.direction == 'LONG') or \
               (existing.quantity < 0 and signal.direction == 'SHORT'):
                print(f"Already have {signal.direction} position in {signal.symbol}")
                return None
        
        # Calculate position size
        position_size = self._calculate_position_size(signal)
        
        # Place entry order
        entry_order = await self._place_order(
            symbol=signal.symbol,
            side='BUY' if signal.direction == 'LONG' else 'SELL',
            quantity=position_size,
            order_type=OrderType.LIMIT,
            price=signal.entry_price
        )
        
        if entry_order and entry_order.status != OrderStatus.REJECTED:
            # Place stop loss order
            stop_order = await self._place_order(
                symbol=signal.symbol,
                side='SELL' if signal.direction == 'LONG' else 'BUY',
                quantity=position_size,
                order_type=OrderType.STOP,
                stop_price=signal.stop_loss
            )
            
            # Store trade information
            self.active_trades.append(signal)
            
            return entry_order
        
        return None
    
    def _calculate_position_size(self, signal: TradeSignal) -> int:
        """Calculate position size based on risk management rules"""
        
        # Get account information
        account_balance = 100000  # Placeholder
        risk_per_trade = 0.01  # 1% risk per trade
        
        # Calculate risk amount
        risk_amount = account_balance * risk_per_trade
        
        # Calculate position size based on stop distance
        stop_distance = abs(signal.entry_price - signal.stop_loss)
        position_size = int(risk_amount / stop_distance)
        
        # Apply maximum position size limit
        max_position = 10  # Maximum contracts
        position_size = min(position_size, max_position)
        
        return position_size
    
    async def manage_positions(self):
        """Manage existing positions"""
        
        for symbol, position in self.positions.items():
            # Update current price
            current_price = await self.broker.get_current_price(symbol)
            position.current_price = current_price
            
            # Calculate unrealized P&L
            if position.quantity > 0:
                position.unrealized_pnl = (current_price - position.average_price) * position.quantity
            else:
                position.unrealized_pnl = (position.average_price - current_price) * abs(position.quantity)
            
            # Check for exit conditions
            await self._check_exit_conditions(position)
    
    async def _check_exit_conditions(self, position: Position):
        """Check if position should be exited"""
        
        # Find associated trade signal
        for trade in self.active_trades:
            if trade.symbol == position.symbol:
                # Check if target 1 reached
                if position.quantity > 0:  # Long position
                    if position.current_price >= trade.target_1:
                        # Partial exit at target 1
                        await self._partial_exit(position, 0.5)
                        
                    elif position.current_price >= trade.target_2:
                        # Full exit at target 2
                        await self._full_exit(position)
                        
                else:  # Short position
                    if position.current_price <= trade.target_1:
                        # Partial exit at target 1
                        await self._partial_exit(position, 0.5)
                        
                    elif position.current_price <= trade.target_2:
                        # Full exit at target 2
                        await self._full_exit(position)
    
    async def _partial_exit(self, position: Position, percentage: float):
        """Partially exit a position"""
        
        exit_quantity = int(abs(position.quantity) * percentage)
        
        if exit_quantity > 0:
            side = 'SELL' if position.quantity > 0 else 'BUY'
            
            await self._place_order(
                symbol=position.symbol,
                side=side,
                quantity=exit_quantity,
                order_type=OrderType.MARKET
            )
            
            # Update position
            if position.quantity > 0:
                position.quantity -= exit_quantity
            else:
                position.quantity += exit_quantity
```

## Testing Framework

```python
# backtesting/backtest_engine.py
import pandas as pd
import numpy as np
from typing import List, Dict
from datetime import datetime, timedelta

class BacktestEngine:
    """Backtesting engine for strategy validation"""
    
    def __init__(
        self,
        start_date: datetime,
        end_date: datetime,
        initial_capital: float = 100000
    ):
        self.start_date = start_date
        self.end_date = end_date
        self.initial_capital = initial_capital
        self.trades = []
        self.equity_curve = []
        
    def run_backtest(
        self,
        data: pd.DataFrame,
        strategy_params: Dict
    ) -> Dict:
        """Run backtest on historical data"""
        
        # Initialize components
        profile_engine = VolumeProfile()
        vwap_calc = VWAPCalculator()
        delta_analyzer = CumulativeDelta()
        
        # Initialize capital
        current_capital = self.initial_capital
        position = None
        
        # Iterate through data
        for idx, row in data.iterrows():
            # Update market structure
            profile_engine.add_trade(
                price=row['price'],
                volume=row['volume'],
                aggressor=row['aggressor'],
                time_period=0
            )
            
            vwap = vwap_calc.add_tick(
                timestamp=row['timestamp'],
                price=row['price'],
                volume=row['volume']
            )
            
            delta_analyzer.add_trade(
                timestamp=row['timestamp'],
                price=row['price'],
                volume=row['volume'],
                aggressor=row['aggressor']
            )
            
            # Generate signals
            va = profile_engine.calculate_value_area()
            vwap_bands = vwap_calc.calculate_bands()
            divergence = delta_analyzer.detect_divergence()
            
            # Check for entry
            if position is None:
                signal = self._check_entry_conditions(
                    row, va, vwap_bands, divergence, strategy_params
                )
                
                if signal:
                    position = {
                        'entry_price': row['price'],
                        'entry_time': row['timestamp'],
                        'direction': signal['direction'],
                        'stop_loss': signal['stop_loss'],
                        'target': signal['target'],
                        'size': self._calculate_size(current_capital, signal)
                    }
            
            # Check for exit
            elif position is not None:
                exit_signal = self._check_exit_conditions(
                    row, position, va, vwap_bands
                )
                
                if exit_signal:
                    # Calculate P&L
                    if position['direction'] == 'LONG':
                        pnl = (row['price'] - position['entry_price']) * position['size']
                    else:
                        pnl = (position['entry_price'] - row['price']) * position['size']
                    
                    # Record trade
                    self.trades.append({
                        'entry_time': position['entry_time'],
                        'exit_time': row['timestamp'],
                        'entry_price': position['entry_price'],
                        'exit_price': row['price'],
                        'direction': position['direction'],
                        'pnl': pnl,
                        'return': pnl / current_capital
                    })
                    
                    # Update capital
                    current_capital += pnl
                    position = None
            
            # Record equity
            self.equity_curve.append({
                'timestamp': row['timestamp'],
                'equity': current_capital
            })
        
        # Calculate metrics
        metrics = self._calculate_metrics()
        
        return metrics
    
    def _calculate_metrics(self) -> Dict:
        """Calculate performance metrics"""
        
        if not self.trades:
            return {'error': 'No trades executed'}
        
        trades_df = pd.DataFrame(self.trades)
        equity_df = pd.DataFrame(self.equity_curve)
        
        # Basic metrics
        total_trades = len(trades_df)
        winning_trades = len(trades_df[trades_df['pnl'] > 0])
        losing_trades = len(trades_df[trades_df['pnl'] < 0])
        win_rate = winning_trades / total_trades if total_trades > 0 else 0
        
        # P&L metrics
        total_pnl = trades_df['pnl'].sum()
        avg_win = trades_df[trades_df['pnl'] > 0]['pnl'].mean() if winning_trades > 0 else 0
        avg_loss = trades_df[trades_df['pnl'] < 0]['pnl'].mean() if losing_trades > 0 else 0
        
        # Risk metrics
        returns = trades_df['return']
        sharpe_ratio = (returns.mean() / returns.std()) * np.sqrt(252) if returns.std() > 0 else 0
        
        # Drawdown
        equity_df['cummax'] = equity_df['equity'].cummax()
        equity_df['drawdown'] = (equity_df['equity'] - equity_df['cummax']) / equity_df['cummax']
        max_drawdown = equity_df['drawdown'].min()
        
        return {
            'total_trades': total_trades,
            'win_rate': win_rate,
            'total_pnl': total_pnl,
            'avg_win': avg_win,
            'avg_loss': avg_loss,
            'profit_factor': abs(avg_win / avg_loss) if avg_loss != 0 else 0,
            'sharpe_ratio': sharpe_ratio,
            'max_drawdown': max_drawdown,
            'final_equity': self.equity_curve[-1]['equity'] if self.equity_curve else self.initial_capital
        }
```

## Deployment Configuration

```yaml
# config/deployment.yaml
app:
  name: "G7FX PRO Trading System"
  version: "1.0.0"
  environment: "production"

data:
  providers:
    - name: "CQG"
      api_key: "${CQG_API_KEY}"
      websocket_url: "wss://api.cqg.com/v1/stream"
    - name: "Rithmic"
      api_key: "${RITHMIC_API_KEY}"
      gateway: "gateway.rithmic.com"

instruments:
  - symbol: "ES"
    name: "E-mini S&P 500"
    tick_size: 0.25
    point_value: 50
    session_start: "18:00"
    session_end: "17:00"
  
  - symbol: "NQ"
    name: "E-mini Nasdaq"
    tick_size: 0.25
    point_value: 20
    session_start: "18:00"
    session_end: "17:00"
  
  - symbol: "CL"
    name: "Crude Oil"
    tick_size: 0.01
    point_value: 1000
    session_start: "18:00"
    session_end: "17:00"

strategy:
  profile:
    lookback_days: 5
    value_area_percentage: 0.70
    update_interval: 30  # seconds
  
  vwap:
    anchor_time: "09:30"
    std_dev_multiplier: 2.0
  
  orderflow:
    delta_bar_size: 500
    footprint_levels: 10
    imbalance_ratio: 3.0
  
  risk:
    max_position_size: 10
    risk_per_trade: 0.01
    max_daily_loss: 0.03
    correlation_limit: 0.7

monitoring:
  metrics_port: 8080
  log_level: "INFO"
  alert_channels:
    - slack: "${SLACK_WEBHOOK_URL}"
    - email: "trading@g7fx.com"
```

## Replit Setup Instructions

```bash
# .replit
language = "python3"
run = "python main.py"

[packager]
ignoredPackages = ["matplotlib"]

[env]
PYTHONPATH = "${REPL_HOME}"

# requirements.txt
asyncio
websockets
numpy
pandas
scipy
plotly
dash
redis
sqlalchemy
psycopg2-binary
python-dotenv
pydantic
pytest
pytest-asyncio

# main.py
#!/usr/bin/env python3
"""
G7FX PRO Trading System
Institutional-grade orderflow trading platform
"""

import asyncio
import logging
from datetime import datetime
from pathlib import Path

# Import system components
from data.market_data_feed import MarketDataFeed
from analysis.profile.volume_profile import VolumeProfile
from analysis.value.vwap import VWAPCalculator
from analysis.orderflow.cumulative_delta import CumulativeDelta
from strategy.hypothesis import HypothesisGenerator
from strategy.signals import SignalGenerator
from execution.trade_manager import TradeManager
from visualization.dashboard import TradingDashboard

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def main():
    """Main application entry point"""
    
    logger.info("Starting G7FX PRO Trading System...")
    
    # Initialize components
    market_feed = MarketDataFeed(['ES', 'NQ', 'CL'])
    profile_engine = VolumeProfile()
    vwap_calc = VWAPCalculator()
    delta_analyzer = CumulativeDelta()
    hypothesis_gen = HypothesisGenerator()
    
    # Connect to market data
    await market_feed.connect()
    
    # Generate daily hypothesis
    hypothesis = await hypothesis_gen.generate_hypothesis()
    logger.info(f"Daily Hypothesis: {hypothesis}")
    
    # Initialize signal generator
    signal_gen = SignalGenerator(hypothesis)
    
    # Start dashboard
    dashboard = TradingDashboard()
    dashboard.start()
    
    # Main trading loop
    while True:
        try:
            # Process market data
            # Check for signals
            # Execute trades
            # Update dashboard
            
            await asyncio.sleep(1)
            
        except KeyboardInterrupt:
            logger.info("Shutting down...")
            break
        except Exception as e:
            logger.error(f"Error in main loop: {e}")
            
    # Cleanup
    await market_feed.disconnect()
    dashboard.stop()

if __name__ == "__main__":
    asyncio.run(main())
```

This technical implementation guide provides a complete blueprint for building the G7FX PRO trading system on Replit, with production-ready code architecture and comprehensive testing framework.