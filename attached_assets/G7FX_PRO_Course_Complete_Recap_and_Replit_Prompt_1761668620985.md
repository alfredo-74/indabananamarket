# G7FX PRO Course - Complete Recap and Replit Development Prompt

## Executive Summary
The G7FX PRO Course is an advanced institutional-level orderflow trading education program that builds upon the Foundation Course. It teaches professional trading methodologies used by proprietary trading firms and investment banks, focusing on developing market hypotheses through context analysis, intraday value dynamics, and microscopic order flow tools.

## Course Philosophy & Core Principles

### Evolution from Foundation to PRO
- **Foundation Course**: Deep understanding of depth of market (DOM), market mechanics, supply/demand dynamics
- **PRO Course**: Bird's eye view approach using human discretionary advantages over algorithms
- **Key Insight**: 80-85% of futures market volume is now algorithmic - manual DOM trading edge has disappeared
- **Solution**: Use discretionary analysis at multiple timeframes with context-based hypothesis development

### The Professional Trading Approach
1. **Hypothesis First**: Every professional trader develops a daily hypothesis before trading
2. **Context is King**: Context provides the roadmap - without it, you're trading blind
3. **Order Flow as Fine-Tuning**: Order flow tools (90% context, 10% execution refinement)
4. **Adaptation Over Time**: Evolve from microscopic (DOM/Footprint) to macro views (Cumulative Delta)

---

## STAGE 1: CONTEXT DEVELOPMENT

### Module 1.1: Introduction & Framework
- **Professional Path**: Mimics institutional training but optimized for modern markets
- **Three-Stage Structure**: 
  1. Context (Market/Volume Profile, AMT)
  2. Intraday Dynamics (VWAP, Value Migration)
  3. Order Flow Refinement (Cumulative Delta, Footprint)

### Module 1.2-1.4: Auction Market Theory (AMT)

#### Supply Side Dominance
- **Core Concept**: Understanding who controls the market (buyers vs sellers)
- **Key Tools**: Volume profile shape analysis, market profile distributions
- **Application**: Identify whether supply or demand dominates current market structure

#### Balance vs Imbalance
- **Balance**: Market acceptance at current prices (normal distribution)
- **Imbalance**: Market rejection leading to directional moves
- **Trading Edge**: Identify transitions from balance to imbalance states

#### Measuring Probability
- **Statistical Foundation**: Using standard deviations and normal distributions
- **70% Rule**: 70% of activity occurs within 1 standard deviation
- **Practical Application**: Define high-probability trade zones

### Module 1.5-1.6: Market & Volume Profile

#### Part 1: Profile Construction
- **Market Profile**: Time-based value areas (TPO - Time Price Opportunity)
- **Volume Profile**: Actual traded volume at each price level
- **Composite Profiles**: Multi-day profiles showing longer-term value areas

#### Part 2: Practical Application (Task 1)
- **Value Area (VA)**: Where 70% of volume traded
- **Point of Control (POC)**: Highest volume price
- **Trading Strategy**: 
  - Trade from edges back to value
  - Fade moves outside value in balanced markets
  - Follow breakouts in trending/imbalanced markets

---

## STAGE 2: INTRADAY VALUE DYNAMICS

### Module 2.1-2.3: VWAP Mastery

#### Introduction to VWAP
- **Definition**: Volume Weighted Average Price - institutional benchmark
- **Concept**: "Intraperiod dynamic evolution of volume profile"
- **Universal Usage**: Standard across ALL institutions for execution quality

#### VWAP Practical Application
- **Standard Deviation Bands**: Define overbought/oversold zones
- **Anchored VWAP**: Custom start points for specific events
- **Institutional Behavior**: 
  - Algorithms target VWAP for large orders
  - Mutual funds benchmark performance against VWAP
  - Creates natural support/resistance

### Module 2.4-2.6: Static vs Dynamic Value

#### Static Value (Historical)
- **Composite Value Area (CVA)**: Multi-day value area from profile
- **Previous Day Value**: Yesterday's value area boundaries
- **Weekly/Monthly Values**: Longer timeframe value areas

#### Dynamic Value (Developing)
- **Developing Value Area (DVA)**: Today's evolving value area
- **VWAP**: Real-time volume-weighted average
- **Value Migration**: How value areas shift throughout the day

#### Integration Framework (Task 4)
- **Hypothesis Development**:
  1. Identify CVA (static reference)
  2. Monitor DVA development
  3. Use VWAP as "line in the sand"
  4. Trade with or against value migration

### Module 2.5: Entry & Exit Methodology
- **Entry Criteria**:
  - Context alignment (hypothesis confirmed)
  - Value area tests (DVA/CVA interaction)
  - VWAP confirmation
  - Order flow trigger (final 10%)
  
- **Exit Strategy**:
  - Target opposite value edges
  - Scale out at standard deviation bands
  - Trail stops using developing value

### Module 2.7: Value Migration & Live Examples (Task 6)
- **Value Migration Patterns**:
  - **Bullish**: DVA consistently above CVA
  - **Bearish**: DVA consistently below CVA
  - **Neutral**: DVA overlapping CVA
  
- **Live Trading Process**:
  1. Pre-market hypothesis using CVA
  2. Monitor early DVA development
  3. Confirm with VWAP direction
  4. Execute at value area edges
  5. Manage using migration patterns

---

## STAGE 3: ORDER FLOW REFINEMENT

### Module 3.1-3.2: Cumulative Delta

#### Introduction to Cumulative Delta
- **Definition**: Running total of buy market orders minus sell market orders
- **Evolution**: More efficient than footprint/DOM for discretionary trading
- **Key Insight**: Shows same information as footprint but in cleaner format

#### Cumulative Delta Practical (Task 5)
- **Normal Behavior**: Price and delta move together
- **Divergences**: 
  - **Absorption**: Price up, delta down (sellers absorbing buyers)
  - **Exhaustion**: Price makes new high, delta doesn't confirm
  
- **Trading Applications**:
  - Confirm hypothesis direction
  - Identify potential reversals
  - Fine-tune entries/exits

### Module 3.3-3.9: Footprint Charts

#### Footprint Basics
- **Purpose**: See inside each candle (bid/ask volume)
- **Components**:
  - Left column: Bid volume
  - Right column: Ask volume
  - Delta: Difference between bid/ask
  - Diagonal analysis: Order flow imbalances

#### Time vs Non-Time Based Charts
- **Time-Based Issues**: Distorted view during low activity
- **Volume Charts**: Consistent information per bar
- **Range Charts**: Normalize price movement
- **Recommendation**: Use volume or range charts for footprint analysis

#### Delta Statistics & Imbalances
- **Delta Divergence**: Price vs delta disconnects
- **Stacked Imbalances**: Multiple diagonal imbalances
- **Trapped Traders**: High volume at extremes with reversal
- **Unfinished Auctions**: Incomplete price discovery

#### Live Trading Integration
- **When to Use Footprint**:
  - Confirm major support/resistance
  - Identify absorption at key levels
  - Spot trapped traders for reversals
  - NOT for every single trade decision

---

## CRITICAL CONCEPTS & PATTERNS

### The 90/10 Rule
- **90% Context**: Market/Volume Profile, VWAP, Value Areas
- **10% Order Flow**: Cumulative Delta, Footprint for fine-tuning
- **Never Reverse This**: Order flow without context = gambling

### Institutional Order Flow Patterns

#### Absorption
- **Definition**: Large players absorbing opposite side pressure
- **Identification**: Price moves opposite to order flow
- **Trading**: Fade the move when absorption confirmed

#### Initiative vs Responsive
- **Initiative**: New business outside value (trend potential)
- **Responsive**: Trading back into value (mean reversion)
- **Strategy**: Follow initiative, fade responsive in balance

#### Value Area Rules
- **80% Rule**: If open outside VA and enter, 80% chance to opposite side
- **VA Rejection**: Quick rejection of VA = potential trend day
- **VA Acceptance**: Slow grind into VA = likely rotation

### Market Conditions Framework

#### Trend Days
- **Characteristics**: 
  - Open outside value, don't return
  - DVA migrates consistently one direction
  - VWAP acts as support/resistance
  - Cumulative delta confirms direction

#### Balance Days
- **Characteristics**:
  - Open inside value, stay inside
  - DVA overlaps CVA significantly
  - VWAP relatively flat
  - Cumulative delta choppy

#### Breakout Days
- **Characteristics**:
  - Test and reject value area
  - DVA expands beyond CVA
  - VWAP accelerates with price
  - Strong cumulative delta

---

## IMPLEMENTATION ROADMAP FOR REPLIT

### Phase 1: Foundation Integration (Weeks 1-2)
```python
# Core Components Needed:
1. Market Data Feed Integration
   - Real-time futures data (ES, NQ, CL, etc.)
   - Historical data for profile building
   - Time & Sales for order flow

2. Profile Calculation Engine
   - Market Profile (TPO) generation
   - Volume Profile computation
   - Composite/Multi-day profiles
   - Value Area calculations (VAH, VAL, POC)

3. VWAP System
   - Standard VWAP calculation
   - Anchored VWAP capability
   - Standard deviation bands
   - Multiple timeframe VWAP
```

### Phase 2: Dynamic Value System (Weeks 3-4)
```python
# Dynamic Analysis Tools:
1. Developing Value Area (DVA)
   - Real-time VA calculation
   - DVA vs CVA comparison
   - Value migration tracking
   - Alert system for migrations

2. Static Reference System
   - Previous day/week/month values
   - Overnight session profiles
   - Gap analysis tools
   - Historical value database

3. Hypothesis Generator
   - Context analysis engine
   - Market condition classifier
   - Probability calculator
   - Trade setup identifier
```

### Phase 3: Order Flow Integration (Weeks 5-6)
```python
# Microscopic Order Flow:
1. Cumulative Delta
   - Real-time delta calculation
   - Delta divergence detection
   - Absorption identifier
   - Multi-timeframe delta

2. Footprint Capability
   - Bid/Ask volume tracking
   - Imbalance calculations
   - Diagonal analysis
   - Trapped trader identification

3. Integration Layer
   - Context + Order flow scoring
   - Entry/exit signal generation
   - Risk management overlay
   - Performance tracking
```

### Phase 4: Execution & Management (Weeks 7-8)
```python
# Trading Execution:
1. Entry System
   - Hypothesis confirmation
   - Value area entry logic
   - Order flow triggers
   - Position sizing algorithm

2. Exit Management
   - Target calculation (VA edges)
   - Stop loss placement
   - Trailing stop logic
   - Partial profit taking

3. Risk Management
   - Maximum position limits
   - Correlation analysis
   - Drawdown controls
   - Kelly Criterion sizing
```

---

## KEY ALGORITHMS & CALCULATIONS

### Value Area Calculation
```python
def calculate_value_area(volume_profile, percentage=0.70):
    """
    Calculate Value Area High (VAH), Value Area Low (VAL), and Point of Control (POC)
    
    Args:
        volume_profile: Dictionary of price -> volume
        percentage: Percentage of volume to include (default 70%)
    
    Returns:
        Dictionary with VAH, VAL, POC
    """
    total_volume = sum(volume_profile.values())
    target_volume = total_volume * percentage
    
    # Find POC (highest volume price)
    poc = max(volume_profile, key=volume_profile.get)
    
    # Expand from POC to find value area
    accumulated_volume = volume_profile[poc]
    upper_price = poc
    lower_price = poc
    
    while accumulated_volume < target_volume:
        # Add volume from above and below alternately
        # Implementation details here
        pass
    
    return {
        'VAH': upper_price,
        'VAL': lower_price,
        'POC': poc
    }
```

### VWAP Calculation
```python
def calculate_vwap(prices, volumes):
    """
    Calculate Volume Weighted Average Price
    
    Args:
        prices: List of prices
        volumes: List of volumes
    
    Returns:
        VWAP value
    """
    pv_sum = sum(p * v for p, v in zip(prices, volumes))
    volume_sum = sum(volumes)
    return pv_sum / volume_sum if volume_sum > 0 else 0
```

### Cumulative Delta
```python
def calculate_cumulative_delta(trades):
    """
    Calculate cumulative delta from trade data
    
    Args:
        trades: List of trade objects with price, volume, and aggressor side
    
    Returns:
        List of cumulative delta values
    """
    cumulative_delta = []
    running_delta = 0
    
    for trade in trades:
        if trade.aggressor == 'BUY':
            running_delta += trade.volume
        else:
            running_delta -= trade.volume
        cumulative_delta.append(running_delta)
    
    return cumulative_delta
```

### Value Migration Detection
```python
def detect_value_migration(current_va, previous_va):
    """
    Detect value migration pattern
    
    Args:
        current_va: Current day's value area
        previous_va: Previous day's value area
    
    Returns:
        Migration type: 'HIGHER', 'LOWER', 'OVERLAPPING'
    """
    if current_va['VAL'] > previous_va['VAH']:
        return 'HIGHER'
    elif current_va['VAH'] < previous_va['VAL']:
        return 'LOWER'
    else:
        return 'OVERLAPPING'
```

---

## REPLIT PROJECT STRUCTURE

```
orderflow_trading_system/
│
├── data/
│   ├── market_data.py          # Real-time data feeds
│   ├── historical_data.py      # Historical data management
│   └── data_storage.py         # Database operations
│
├── analysis/
│   ├── profile/
│   │   ├── market_profile.py   # TPO calculations
│   │   ├── volume_profile.py   # Volume profile generation
│   │   └── composite.py        # Multi-day profiles
│   │
│   ├── value/
│   │   ├── value_area.py       # VA calculations
│   │   ├── vwap.py            # VWAP and bands
│   │   └── migration.py        # Value migration detection
│   │
│   └── orderflow/
│       ├── cumulative_delta.py # Delta calculations
│       ├── footprint.py        # Footprint analysis
│       └── imbalances.py       # Order flow imbalances
│
├── strategy/
│   ├── hypothesis.py           # Daily hypothesis generation
│   ├── context.py             # Market context analysis
│   ├── signals.py             # Trade signal generation
│   └── conditions.py          # Market condition classifier
│
├── execution/
│   ├── entry.py               # Entry logic
│   ├── exit.py                # Exit management
│   ├── risk.py                # Risk management
│   └── broker_interface.py    # Broker connections
│
├── visualization/
│   ├── charts.py              # Chart rendering
│   ├── profiles.py            # Profile visualization
│   ├── dashboard.py           # Trading dashboard
│   └── alerts.py              # Alert system
│
├── backtesting/
│   ├── engine.py              # Backtesting engine
│   ├── metrics.py             # Performance metrics
│   └── optimization.py        # Parameter optimization
│
├── config/
│   ├── settings.py            # System settings
│   ├── instruments.py         # Tradeable instruments
│   └── parameters.py          # Strategy parameters
│
├── utils/
│   ├── logger.py              # Logging system
│   ├── helpers.py             # Utility functions
│   └── validators.py          # Data validation
│
└── main.py                    # Main application entry
```

---

## ADVANCED FEATURES TO IMPLEMENT

### 1. Multi-Timeframe Analysis
- Integrate daily, weekly, monthly profiles
- Nested value areas
- Fractal market structure analysis

### 2. Correlation Analysis
- Inter-market relationships
- Sector rotation detection
- Risk-on/Risk-off classification

### 3. Machine Learning Enhancement
- Pattern recognition for setups
- Probability enhancement models
- Adaptive parameter optimization

### 4. Automated Hypothesis Generation
- Context-based trade ideas
- Probability-weighted scenarios
- Dynamic strategy selection

### 5. Performance Analytics
- Trade journal automation
- Pattern success rates
- Continuous improvement metrics

---

## TESTING & VALIDATION

### Unit Tests Required
1. Profile calculation accuracy
2. VWAP computation verification
3. Value area algorithm validation
4. Delta calculation correctness
5. Signal generation logic

### Integration Tests
1. Data feed reliability
2. Real-time calculation performance
3. Order execution latency
4. Risk management triggers
5. Alert system functionality

### Backtesting Requirements
1. Minimum 2 years historical data
2. Walk-forward analysis
3. Monte Carlo simulations
4. Stress testing scenarios
5. Transaction cost modeling

---

## DEPLOYMENT CONSIDERATIONS

### Performance Requirements
- Sub-millisecond calculation times
- Real-time data processing
- Concurrent multi-instrument analysis
- Scalable architecture

### Risk Controls
- Maximum position limits
- Daily loss limits
- Correlation exposure limits
- System failure protocols
- Data feed redundancy

### Monitoring & Alerts
- System health monitoring
- Performance metrics tracking
- Anomaly detection
- Trade execution verification
- Real-time P&L tracking

---

## SUMMARY & KEY TAKEAWAYS

The G7FX PRO Course represents institutional-grade trading education focused on:

1. **Context-First Approach**: 90% of edge comes from proper market context analysis
2. **Value-Based Trading**: Understanding where and why institutions trade
3. **Order Flow Refinement**: Using microscopic tools only for fine-tuning
4. **Evolution Path**: Progress from DOM → Footprint → Cumulative Delta
5. **Discretionary Advantage**: Leverage human pattern recognition over algorithms

### Implementation Priority for Replit:
1. **Phase 1**: Build robust profile and VWAP systems (foundation)
2. **Phase 2**: Implement dynamic value tracking (context)
3. **Phase 3**: Add order flow tools (refinement)
4. **Phase 4**: Create execution framework (trading)

### Success Metrics:
- Accurate value area calculations
- Reliable hypothesis generation
- Positive expectancy in backtesting
- Consistent real-time performance
- Risk-adjusted returns improvement

---

## APPENDIX: GLOSSARY OF TERMS

**AMT** - Auction Market Theory
**CVA** - Composite Value Area (historical)
**DVA** - Developing Value Area (current day)
**DOM** - Depth of Market
**HFT** - High-Frequency Trading
**POC** - Point of Control (highest volume price)
**TPO** - Time Price Opportunity
**VA** - Value Area
**VAH** - Value Area High
**VAL** - Value Area Low
**VWAP** - Volume Weighted Average Price

---

*This document serves as a comprehensive blueprint for implementing the G7FX PRO Course methodology in a systematic trading platform on Replit. The focus should be on building a robust foundation of context analysis tools before adding microscopic order flow components.*