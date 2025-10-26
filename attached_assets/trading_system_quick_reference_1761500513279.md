# Trading System Quick Reference Guide

## Foundational Philosophy (Module 1)

### The 90/10 Rule
```
10% = Charts (Execution Environment)
90% = Raw Data/Order Flow (Real Information)
```

### Institutional Training Timeline
- **Months 1-6**: No charts, only order flow
- **Month 7+**: Charts allowed after proving profitability
- **Year 1**: Training phase ($20-40k)
- **Years 2-3**: Profitability ($200k+)
- **Years 4+**: Scale ($1M+)

### Career Path Alignment
```
Research Phase → Tools Selection → Execution Phase
(Module 1)       (Module 2)        (Module 3-4)
```

---

## Essential Concepts - Quick Lookup

### Market Microstructure Basics
```
PRICE MOVEMENT = Market Orders (Aggression) consuming Available Supply (Intention)
```

### Order Types
- **Market Order** = Aggressive (Takes liquidity, moves price)
- **Limit Order** = Passive (Provides liquidity, creates levels)

### Time & Sales Components
1. **Timestamp**: When trade occurred
2. **Price**: Execution price  
3. **Volume**: Number of contracts
4. **Side**: Buy (at ask) or Sell (at bid)

### DOM (Depth of Market) Structure
```
ASK SIDE (Sellers)
-----------------
Price | Size | Orders
10.05 |  45  |   3
10.04 |  82  |   5
10.03 | 120  |   8
-----------------
LAST: 10.02
-----------------
BID SIDE (Buyers)
10.02 | 150  |  10
10.01 |  95  |   7
10.00 |  65  |   4
```

---

## Key Patterns to Identify

### 1. Absorption
**Definition**: Large aggressive orders absorbed without price movement
```python
absorption = (aggressive_volume > 2 * resting_volume) AND (price_change < threshold)
```

### 2. Value Area (70% Rule)
```python
VAH = Value Area High   # Upper bound containing 70% volume
POC = Point of Control  # Highest volume price  
VAL = Value Area Low    # Lower bound containing 70% volume
```

### 3. Order Flow Imbalance
```python
imbalance = (buy_volume - sell_volume) / total_volume
bullish_imbalance = imbalance > 0.6  # 60%+ buying
bearish_imbalance = imbalance < -0.6 # 60%+ selling
```

---

## Trading Rules

### Entry Conditions (Long)
1. Price at/below Value Area Low (VAL)
2. Buy absorption detected (buyers absorbing selling)
3. Order flow turning bullish
4. Optional: Near Discord support level

### Entry Conditions (Short)
1. Price at/above Value Area High (VAH)
2. Sell absorption detected (sellers absorbing buying)
3. Order flow turning bearish
4. Optional: Near Discord resistance level

### Exit Rules
- **Target 1**: Point of Control (POC)
- **Target 2**: Opposite Value Area boundary
- **Stop Loss**: 2% beyond Value Area boundary
- **Trailing Stop**: Below/above new value areas formed

---

## Volume Profile Interpretation

### Profile Shapes
```
P-Type (Trending Up)        b-Type (Trending Down)
        |                    |||||
       ||                    ||||
      |||                    |||
     ||||                    ||
    |||||                    |

D-Type (Balanced)           Double Distribution
      |||                         |||
     |||||                        |||
      |||                         |||
                                |||||
                                |||||
```

### Volume Nodes
- **HVN** (High Volume Node): Price acceptance area, acts as magnet
- **LVN** (Low Volume Node): Price rejection area, acts as support/resistance

---

## Time-Based Observations

### Market Phases
1. **Initial Balance** (First 60 min): Establishes day's initial range
2. **Range Extension**: Break above/below initial balance
3. **Value Area Development**: Where 70% of volume accumulates
4. **Close**: Often returns to Point of Control

### Timeframe Alignment
```
Monthly Value → Weekly Value → Daily Value → Intraday Value
(Strongest)                                    (Weakest)
```

---

## Risk Management

### Position Sizing Formula
```python
position_size = (account_balance * risk_percentage) / (entry - stop_loss)
max_position = account_balance * 0.10  # Never exceed 10% per position
```

### Risk Parameters
- **Per Trade Risk**: 1-2% of account
- **Daily Loss Limit**: 5% of account
- **Max Concurrent Positions**: 3
- **Risk/Reward Minimum**: 1:1.5

---

## Discord Levels

### Level Categories
1. **Major** (Strength 4-5): Monthly/Weekly highs, lows, pivots
2. **Minor** (Strength 2-3): Daily levels, previous value areas
3. **Micro** (Strength 1): Intraday swing points

### Trading Around Levels
```
Price approaching from below → Potential resistance → Look for shorts
Price approaching from above → Potential support → Look for longs
Price breaks level with volume → Continuation likely
Price rejects level with absorption → Reversal likely
```

---

## Market States

### 1. Balanced (Rotational)
- Price oscillates within value area
- Trade from extremes to POC
- Fade moves outside value

### 2. Imbalanced (Trending)  
- Price consistently above/below value
- Trade pullbacks to value area
- Follow momentum direction

### 3. Discovery (Breakout)
- Price exploring new levels
- No established value area
- Wait for acceptance/rejection

---

## Common Setups

### Setup 1: Value Area Fade
```
Entry: Price reaches VAH/VAL with absorption
Target: POC
Stop: 2% beyond VA boundary
```

### Setup 2: Failed Auction
```
Entry: Price fails to continue after breaking value
Target: Return to value area
Stop: Beyond failure point
```

### Setup 3: Trend Day
```
Entry: First pullback to VWAP/Value after opening drive
Target: Measured move or 2x initial balance
Stop: Below pullback low
```

---

## Formulas & Calculations

### VWAP (Volume Weighted Average Price)
```python
vwap = sum(price * volume) / sum(volume)
```

### Cumulative Delta
```python
delta = sum(buy_volume) - sum(sell_volume)
```

### Market Profile Value Area
```python
total_volume = sum(all_volume)
target_volume = total_volume * 0.70
# Expand from POC until target_volume reached
```

### TPO (Time Price Opportunity)
```python
# Each 30-min period at price = 1 TPO
# More TPOs = More time accepted at price
```

---

## Development Priorities

### Phase 1 (Foundation)
1. ✅ Time & Sales parsing
2. ✅ DOM snapshot capture
3. ✅ Volume Profile building
4. ✅ Value Area calculation

### Phase 2 (Analysis)
1. ⬜ Absorption detection
2. ⬜ Order flow analysis
3. ⬜ Profile pattern recognition
4. ⬜ Multi-timeframe alignment

### Phase 3 (Execution)
1. ⬜ Signal generation
2. ⬜ Position management
3. ⬜ Risk management
4. ⬜ Performance tracking

---

## Debug Checklist

### Data Issues
- [ ] Timestamps in correct timezone?
- [ ] Volume aggregation accurate?
- [ ] Price levels properly rounded to tick size?
- [ ] Missing/duplicate trades handled?

### Calculation Issues
- [ ] Value Area = 70% of total volume?
- [ ] POC = Highest volume price?
- [ ] Absorption threshold calibrated?
- [ ] Delta calculation signed correctly?

### Execution Issues
- [ ] Position size within limits?
- [ ] Stop loss properly placed?
- [ ] Orders routed correctly?
- [ ] Slippage accounted for?

---

## Key Reminders

⚠️ **NEVER**:
- Jump straight to execution without research and planning
- Trade without observing for 3+ months
- Use technical indicators as primary signals
- Risk more than 2% per trade
- Trade against strong absorption
- Skip the foundational preparation phases

✅ **ALWAYS**:
- Follow proper career progression (Research → Tools → Execution)
- Focus on the 90% (raw data) not just the 10% (charts)
- Follow the raw data (Time & Sales, DOM)
- Wait for confluence of signals
- Respect value areas as magnets
- Trade with market structure, not against it
- Remember you're building a career, not gambling

---

## Resources & References

- **Minimum DOM Observation**: 3 months
- **Recommended**: 6 months
- **Tick Size**: Varies by instrument (check exchange specs)
- **Standard Value Area**: 70% of volume (1 standard deviation)
- **Typical Absorption Ratio**: 2:1 or higher

---

*Keep this guide handy while developing. Focus on understanding market mechanics, not just coding indicators.*