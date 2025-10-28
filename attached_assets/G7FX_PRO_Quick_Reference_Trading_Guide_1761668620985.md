# G7FX PRO Course - Quick Reference Trading Guide

## 📊 DAILY PRE-MARKET ROUTINE

### 1. Context Analysis (30-60 minutes before open)
- [ ] Calculate Composite Value Area (CVA) from 5-day profile
- [ ] Mark Yesterday's Value Area (VAH, VAL, POC)
- [ ] Identify Overnight Range (ON High, ON Low, ON POC)
- [ ] Note any significant economic events/news
- [ ] Check correlated markets (bonds, dollar, oil)

### 2. Hypothesis Development
- [ ] Determine Market Condition:
  - **Trend Up**: Yesterday VAL > Composite VAH
  - **Trend Down**: Yesterday VAH < Composite VAL
  - **Balance**: >70% overlap between yesterday and composite
  - **Breakout Pending**: Narrow overnight range (<50% of average)

### 3. Key Levels to Mark
```
Essential Levels:
├── Composite Value Area (5-day)
│   ├── CVA High
│   ├── CVA Low
│   └── CVA POC
├── Yesterday's Value Area
│   ├── Yesterday VAH
│   ├── Yesterday VAL
│   └── Yesterday POC
├── Overnight Session
│   ├── ON High
│   ├── ON Low
│   └── ON POC
└── VWAP Anchors
    ├── Globex Open VWAP
    ├── RTH Open VWAP
    └── Previous Day VWAP
```

---

## 🎯 HIGH-PROBABILITY SETUPS

### Setup 1: Value Area Fade (Balance Days)
**Context**: Market in balance, DVA overlapping CVA
**Entry**: Price tests VA edge (VAH or VAL)
**Confirmation**: 
- Delta showing absorption at level
- No initiative activity (low volume breakout)
- VWAP flat or pulling price back

**Trade**:
- Short at VAH, target POC then VAL
- Long at VAL, target POC then VAH
- Stop: 0.5-1 point beyond VA edge
- **Success Rate**: ~70% in true balance

### Setup 2: Value Area Breakout (Trend Days)
**Context**: Value migration in one direction
**Entry**: Break and hold above/below VA
**Confirmation**:
- Initiative activity (high volume)
- Delta confirming direction
- VWAP accelerating with price

**Trade**:
- Long above VAH, target = VAH + (VAH - VAL)
- Short below VAL, target = VAL - (VAH - VAL)
- Stop: Re-enter value area
- **Success Rate**: ~65% with proper context

### Setup 3: VWAP Bounce
**Context**: Any market condition
**Entry**: Test of VWAP or SD bands
**Confirmation**:
- Price respects level multiple times
- Delta divergence at bands
- Developing VA supporting direction

**Trade**:
- Long at VWAP -2SD, target VWAP
- Short at VWAP +2SD, target VWAP
- Stop: 0.5 points beyond band
- **Success Rate**: ~60% at 2SD bands

### Setup 4: Opening Drive
**Context**: Open outside of value
**Entry**: After initial balance established (first 30-60 min)
**Confirmation**:
- Price accepts above/below value
- Strong delta in direction
- VWAP pulling away from value

**Trade**:
- Follow direction of opening drive
- Target: Measured move = IB range
- Stop: Return to value area
- **Success Rate**: ~55% on trend days

### Setup 5: 80% Rule
**Context**: Open outside value, enter value
**Entry**: When price enters value area
**Confirmation**: 
- Acceptance inside value (>10 min)
- Delta shows continued interest
- No immediate rejection

**Trade**:
- Target opposite side of value (80% probability)
- Stop: Back outside value area
- **Success Rate**: ~80% when properly identified

---

## 📈 MARKET CONDITIONS PLAYBOOK

### TREND DAY CHARACTERISTICS
```
Identification:
✓ Open outside value, don't return
✓ Value migration one direction all day
✓ VWAP acts as support/resistance
✓ Strong cumulative delta trend
✓ Multiple distribution curves

Trading Approach:
→ Trade WITH trend only
→ Buy pullbacks to VWAP (uptrend)
→ Sell rallies to VWAP (downtrend)
→ Hold for targets 2-3x normal
```

### BALANCE DAY CHARACTERISTICS
```
Identification:
✓ Open inside value, stay inside
✓ DVA overlaps CVA significantly  
✓ VWAP relatively flat
✓ Choppy cumulative delta
✓ Normal distribution forming

Trading Approach:
→ Fade extremes back to POC
→ Trade from edge to edge
→ Smaller targets (POC)
→ Quicker exits
```

### TREND TO BALANCE
```
Identification:
✓ Strong open, then stalls
✓ Value stops migrating
✓ Delta divergence develops
✓ Failed breakout attempts

Trading Approach:
→ Recognize transition early
→ Switch from trend following to fading
→ Tighten stops on trend positions
```

---

## 🔍 ORDER FLOW PATTERNS

### ABSORPTION
**What**: Large players absorbing opposing pressure
**How to Identify**:
- Price moves opposite to delta
- High volume but no price progress
- Multiple tests of same level

**Trading**:
- Trade in direction of absorber
- Enter after absorption confirmed
- Stop below absorption zone

### EXHAUSTION
**What**: Trend running out of steam
**How to Identify**:
- Price makes new high/low
- Delta fails to confirm
- Decreasing volume on moves

**Trading**:
- Prepare for reversal
- Wait for confirmation
- Target previous value area

### INITIATIVE VS RESPONSIVE
**Initiative**: New business outside value
- Trade with direction
- Expect continuation
- Wider stops

**Responsive**: Trading back into value
- Fade the move
- Expect mean reversion
- Tighter stops

### DELTA DIVERGENCE TYPES

#### Bullish Divergence
- Price: Lower low
- Delta: Higher low
- Action: Look for long entries

#### Bearish Divergence  
- Price: Higher high
- Delta: Lower high
- Action: Look for short entries

#### Hidden Divergence
- Price: Higher low (uptrend)
- Delta: Lower low
- Action: Trend continuation

---

## ⚡ FOOTPRINT PATTERNS

### STACKED IMBALANCES
```
Pattern: 3+ diagonal imbalances in row
Signal: Strong directional move coming
Entry: Break of imbalance zone
Target: Next major level
```

### P-SHAPE / B-SHAPE
```
P-Shape (Bullish):
└── Heavy buying at lows
    Thin selling at highs
    Entry: Above the P

b-Shape (Bearish):
┌── Heavy selling at highs
    Thin buying at lows  
    Entry: Below the b
```

### UNFINISHED AUCTION
```
Pattern: Single prints at high/low
Signal: Price likely to return
Entry: Fade move away
Target: Fill single prints
```

---

## 📏 POSITION SIZING & RISK RULES

### Position Sizing Formula
```
Position Size = (Account Risk %) / (Stop Distance × Point Value)

Example:
Account: $50,000
Risk: 1% = $500
Stop: 2 points on ES
Point Value: $50

Position Size = $500 / (2 × $50) = 5 contracts
```

### Risk Management Rules
1. **Never risk more than 1% per trade**
2. **Maximum 3% daily loss limit**
3. **Scale out at targets**:
   - 50% at Target 1 (1:1 R:R)
   - 25% at Target 2 (2:1 R:R)
   - 25% runner (trail stop)
4. **Correlation limit**: Max 2 correlated positions
5. **Time stops**: Exit if no movement in 2 hours

---

## 🎮 EXECUTION CHECKLIST

### ENTRY CHECKLIST
- [ ] Context aligns with hypothesis?
- [ ] At/near key level?
- [ ] Order flow confirmation?
- [ ] Risk:Reward minimum 1:1.5?
- [ ] Position size calculated?
- [ ] Stop loss defined?

### MANAGEMENT CHECKLIST
- [ ] Move stop to breakeven at Target 1
- [ ] Scale out 50% at Target 1
- [ ] Trail stop on remainder
- [ ] Watch for reversal signals
- [ ] Honor original stop

### EXIT CHECKLIST
- [ ] Target reached?
- [ ] Reversal signal present?
- [ ] Time stop triggered?
- [ ] End of session approaching?
- [ ] Context changed?

---

## 🚨 RED FLAGS & WARNINGS

### DO NOT TRADE WHEN:
❌ No clear hypothesis
❌ Conflicting timeframes
❌ Major news pending (FOMC, NFP)
❌ Already at max daily loss
❌ Emotional/tilted state
❌ Low volume holidays

### ABORT TRADE IF:
⚠️ Context changes significantly
⚠️ Correlation breaks down
⚠️ Unusual volume spikes
⚠️ Technical issues
⚠️ Delta shows strong rejection

---

## 📝 POST-TRADE REVIEW

### Daily Review Questions:
1. Was my hypothesis correct?
2. Did I follow my plan?
3. Were entries at planned levels?
4. Did I manage risk properly?
5. What can I improve tomorrow?

### Trade Journal Template:
```
Date: ___________
Symbol: _________
Setup: __________

Entry: __________
Stop: ___________
Target 1: _______
Target 2: _______

Result: _________
P&L: ___________

Notes:
- Context:
- Execution:
- Management:
- Lessons:
```

---

## 🔧 PLATFORM SETUP

### Essential Chart Layout:
```
Screen 1: Context (Left Monitor)
├── 30-min chart with Composite Profile
├── Daily chart with weekly levels
└── Market internals (TICK, ADD)

Screen 2: Execution (Center Monitor)
├── 5-min chart with DVA
├── VWAP with 2SD bands
├── Cumulative Delta
└── Volume bars

Screen 3: Order Flow (Right Monitor)
├── Footprint chart (2000V bars)
├── DOM (if scalping)
└── Time & Sales
```

### Recommended Settings:
- **Volume Profile**: 70% Value Area
- **VWAP Bands**: 1SD and 2SD
- **Footprint**: 2000-5000 volume bars
- **Delta**: 500-1000 volume bars
- **Composite**: 5-day lookback

---

## 🎯 QUICK DECISION TREE

```
Market Open
    ├── Open IN Value?
    │   ├── YES → Expect Balance
    │   │   └── Fade VA Edges
    │   └── NO → Check Acceptance
    │       ├── Accepted → Trend Day
    │       │   └── Trade WITH Direction
    │       └── Rejected → Return to Value
    │           └── Apply 80% Rule
    │
    └── Value Migration?
        ├── UP → Bullish Bias
        │   └── Buy Pullbacks
        ├── DOWN → Bearish Bias
        │   └── Sell Rallies
        └── NONE → Balanced
            └── Trade Edge to Edge
```

---

## 📚 KEY FORMULAS

### Value Area Calculation
```
1. Find POC (highest volume price)
2. Add POC volume to total
3. Add next highest volume price above/below
4. Repeat until 70% of volume included
5. Highest price = VAH, Lowest = VAL
```

### VWAP Calculation
```
VWAP = Σ(Price × Volume) / Σ(Volume)

Standard Deviation:
SD = √[Σ(Volume × (Price - VWAP)²) / Σ(Volume)]
```

### Cumulative Delta
```
Delta = Buy Market Orders - Sell Market Orders
Cumulative = Running Total of Delta
```

---

## 💡 PRO TIPS

1. **Context is 90%, Order Flow is 10%**
   - Never trade order flow without context
   - Build hypothesis FIRST, then confirm

2. **Value Migration Tells the Story**
   - Higher DVA = Bullish
   - Lower DVA = Bearish
   - Overlapping = Neutral

3. **VWAP is Your Friend**
   - Institutions benchmark to VWAP
   - Strong support/resistance
   - Trend filter

4. **Delta Divergence is Powerful**
   - But needs price action confirmation
   - Better at extremes
   - Watch for absorption

5. **Footprint for Key Levels Only**
   - Don't watch every candle
   - Focus on major S/R
   - Look for trapped traders

6. **Start Small, Build Consistency**
   - 1 contract until profitable
   - Master one setup first
   - Add complexity gradually

---

## 🏆 MASTERY PROGRESSION

### Beginner (Months 1-3)
- Focus: Understanding profiles and value
- Trade: Value area fades only
- Goal: Break even

### Intermediate (Months 4-9)
- Focus: Adding VWAP and migration
- Trade: Add breakout setups
- Goal: Consistent small profits

### Advanced (Months 10-18)
- Focus: Integrating order flow
- Trade: All setups with context
- Goal: 2:1 profit factor

### Expert (18+ Months)
- Focus: Multi-timeframe synthesis
- Trade: Full strategy deployment
- Goal: Institutional-level returns

---

*"The market is an auction. Value is discovered through the dual auction process. Our job is to identify where value is, where it's going, and trade accordingly."* 

**Remember**: This is a marathon, not a sprint. Focus on process over profits, and the results will follow.

---

**Emergency Contacts**:
- Broker Support: [Your Broker]
- Data Feed Issues: [Provider Support]
- Platform Support: [Platform Help]

**Daily Affirmation**:
"I am a disciplined trader. I follow my plan. I manage risk. I trust the process."