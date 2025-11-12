# OrderFlowAI - Daily Operational Workflow

## System Overview
This trading system implements G7FX PRO course methodology for ES/MES futures trading. It requires both the Replit web server AND a local Python bridge to fetch real-time Level II data from Interactive Brokers.

---

## Pre-Market Setup (Before 9:30 AM ET / 2:30 PM London)

### Step 1: Start IB Gateway (8:00 AM London / 3:00 AM ET)
1. Open **IB Gateway** on your computer
2. **Login:** `fredpaper74` / `m!j8r5C%WF3W-#2`
3. **Select:** Paper Trading mode
4. **Port:** 4002 (paper trading)
5. Wait for "Logged in" confirmation

### Step 2: Start the Replit Web Server (8:00 AM London)
1. Open your Replit project
2. Click **Run** or ensure the workflow is running
3. Copy your Replit URL (e.g., `https://ee197d47-83ec-4d0b-a112-c386e2a21599-00-2ivxobttuxv39.kirk.replit.dev`)
4. Verify server is running (you'll see `Server listening on port 5000`)

### Step 3: Launch the Python Bridge (8:30 AM London / 3:30 AM ET)
On your **local computer** (not Replit), run:
```bash
python3 ibkr_bridge_REAL_TIME_LEVEL2.py https://YOUR-REPLIT-URL
```

**What happens automatically:**
```
🔄 Connecting to IB Gateway...
✓ Connected to IB (paper account DU0070151)
📊 Fetching 5 days of historical 5-min bars for CVA initialization...
✓ Historical data sent to server. CVA initialized with 5 days.
🎯 Subscribing to ES real-time Level II (DOM) data...
✓ Live market data streaming
```

**Server logs confirm CVA initialization:**
```
[CVA INIT] Added 2025-10-25: POC 6845.50, VAH 6851.25, VAL 6839.75
[CVA INIT] Added 2025-10-26: POC 6858.00, VAH 6862.50, VAL 6851.25
[CVA INIT] Added 2025-10-27: POC 6852.25, VAH 6859.00, VAL 6846.50
[CVA INIT] Added 2025-10-28: POC 6869.75, VAH 6875.25, VAL 6864.00
[CVA INIT] Added 2025-10-29: POC 6891.00, VAH 6894.75, VAL 6886.25
[CVA INIT] ✓ Composite Value Area built from 5 days
```

### Step 4: Open the F1 Command Center (9:00 AM London / 4:00 AM ET)
1. Open your Replit URL in browser
2. You'll see the F1 Command Center dashboard
3. Verify:
   - **CVA (5-DAY)** shows POC/VAH/VAL values (not 0)
   - **DVA (DAILY)** will build throughout the day
   - **Connection Status:** Bridge Connected ✅
   - **Account:** PAPER showing balance

---

## Pre-Market Analysis (9:00-9:30 AM London / 4:00-4:30 AM ET)

### Hypothesis Generation
The system **automatically generates** a daily hypothesis using:
- Overnight price action (ETH session data)
- 5-day Composite Value Area (CVA)
- Previous day's DVA
- Value Migration patterns

**View Hypothesis:**
1. Look at **DAILY HYPOTHESIS** panel on the F1 Command Center
2. You'll see:
   ```
   CONDITION: BALANCE
   STRATEGY: Fade value area edges back to POC
   KEY LEVELS:
   R1: 6894.25 (CVA VAH)
   S1: 6846.75 (CVA VAL)
   INVALIDATION: Break and hold above 6900 or below 6840
   CONFIDENCE: 70%
   ```

**What to expect:**
- **BALANCE:** Price rotating within CVA, fade extremes to POC
- **BULLISH MIGRATION:** Price above CVA, look for long entries on pullbacks
- **BEARISH MIGRATION:** Price below CVA, look for short entries on rallies
- **BREAKOUT PENDING:** Price at CVA edge, prepare for directional move

---

## RTH Open (9:30 AM ET / 2:30 PM London)

### Critical Event: Cumulative Delta Flush
At exactly **9:30 AM ET**, the system:
1. **Flushes cumulative delta to 0** (PRO course requirement)
2. Resets all RTH session counters
3. Begins fresh DVA (Daily Volume Profile) calculation
4. Starts tracking buy/sell pressure from scratch

**Server log confirms:**
```
[Session Transition] ETH→RTH: CD FLUSHED at RTH open (was -450.0). 
RTH CD reset to 0 per PRO course methodology.
```

### What Happens Automatically
- **Volume Profile (DVA):** Builds tick-by-tick using real Level II data
- **VWAP:** Calculates with SD1/SD2 bands
- **Order Flow Signals:** Detects absorption (4:1, 5:1 ratios)
- **High-Probability Setups:** Scans for PRO course setups
- **Auto-Trading:** Executes trades if enabled (75%+ confidence threshold)

---

## During RTH (9:30 AM - 4:00 PM ET / 2:30 PM - 9:00 PM London)

### Monitor the F1 Command Center

**Traffic Light Indicator:**
- 🟢 **Green (TREND_UP):** Bullish regime, cumulative delta positive
- 🔴 **Red (TREND_DOWN):** Bearish regime, cumulative delta negative
- 🟡 **Yellow (BALANCE):** Rotational, range-bound trading
- 🟣 **Purple (BREAKOUT_PENDING):** High volatility, prepare for move

**Pressure Gauges:**
- **Buy Pressure:** 0-100% (live tick volume on bid)
- **Sell Pressure:** 0-100% (live tick volume on ask)
- **Cumulative Delta:** Net buying/selling pressure

**Order Flow Signals:**
- Green alerts: **ABSORPTION** events (institutional buying)
- Red alerts: **ABSORPTION** events (institutional selling)
- Each signal shows ratio (e.g., "4.5:1 @ 6892.25")

**Value Areas Update:**
- **DVA (Daily):** Updates every candle completion (5-min)
- **CVA (5-Day):** Static reference (updates at end of day)
- **VWAP:** Updates tick-by-tick

**High-Probability Setups:**
- System scans for 8 PRO course setups
- Displays confidence score (e.g., "INITIATIVE_BUYING_AT_VAL - 82%")
- Auto-executes if enabled and confidence ≥75%

### Manual Intervention (Optional)
If **Auto-Trading is DISABLED:**
1. Watch for high-confidence setup alerts
2. Review hypothesis alignment
3. Manually place MES orders via IB Gateway
4. System tracks your P&L automatically

If **Auto-Trading is ENABLED:**
1. System executes MES market orders automatically
2. Monitor **ACCOUNT** section for:
   - Balance updates
   - Daily P&L
   - Unrealized P&L
3. System follows hypothesis + setup confirmation

---

## Market Close (4:00 PM ET / 9:00 PM London)

### Automatic End-of-Day Processing
At **4:00 PM ET**, the system:
1. Completes final DVA calculation
2. Stores completed daily volume profile
3. Adds today's profile to CVA rotation (removes oldest day)
4. Transitions to ETH session (overnight)
5. Resets overnight cumulative delta to 0

**Server log confirms:**
```
[Session Transition] RTH→ETH: Fresh ETH session started, CD reset to 0
[VOLUME PROFILE] Daily profile completed: POC=6891.00, VAH=6894.75, VAL=6886.25
[CVA] Added 2025-10-31 profile, removed 2025-10-24 (maintaining 5-day window)
```

### Daily Review
1. Check **Daily P&L** in ACCOUNT section
2. Review executed setups (if auto-trading was enabled)
3. Compare actual price action vs hypothesis
4. Note any absorption clusters or key levels

---

## System Maintenance

### Daily Shutdown (Optional - After 4:00 PM ET)
You can leave the system running 24/7, or shut down:
1. Stop Python bridge: `Ctrl+C` in terminal
2. Close IB Gateway
3. Replit server can stay running (uses minimal resources)

### Next Day Startup
Repeat Pre-Market Setup steps:
1. IB Gateway (8:00 AM London)
2. Replit server (should already be running)
3. Python bridge (8:30 AM London)
4. Bridge fetches fresh 5-day historical data automatically

---

## Troubleshooting

### CVA Shows All Zeros
**Problem:** Bridge didn't send historical data
**Fix:** 
1. Stop Python bridge (`Ctrl+C`)
2. Restart: `python3 ibkr_bridge_REAL_TIME_LEVEL2.py https://YOUR-URL`
3. Check for "Fetching 5 days of historical..." message
4. Refresh browser, CVA should show real values

### No Live Price Updates
**Problem:** Bridge not connected or IB Gateway offline
**Fix:**
1. Check IB Gateway is running and logged in
2. Verify bridge shows "Live market data streaming"
3. Check Replit logs for WebSocket errors

### "Insufficient context" for Auto-Trading
**Problem:** CVA not initialized or DVA empty
**Fix:**
1. Ensure CVA has real data (not zeros)
2. Wait for at least 1 completed 5-min candle (DVA builds gradually)
3. Auto-trading enables automatically once context is valid

### Hypothesis Shows Low Confidence
**Behavior:** Normal during overnight/thin trading
**Action:**
- Low confidence (<50%) = avoid trading, wait for clearer signals
- High confidence (>70%) = hypothesis aligns with multiple indicators
- System won't auto-trade below 75% threshold

---

## Key Concepts

### Value Migration
- **BULLISH_ABOVE:** Price above CVA, DVA migrating higher → Long bias
- **BEARISH_BELOW:** Price below CVA, DVA migrating lower → Short bias
- **NEUTRAL_OVERLAP:** DVA overlapping CVA → Range-bound, fade edges

### Absorption Detection
- **4:1 Ratio:** Strong institutional interest
- **5:1+ Ratio:** Extreme absorption, high-probability reversal/continuation
- Green = buying absorption (support), Red = selling absorption (resistance)

### PRO Course Setups (Auto-Trading Logic)
1. **INITIATIVE_BUYING_AT_VAL:** Strong buying at value area low
2. **INITIATIVE_SELLING_AT_VAH:** Strong selling at value area high
3. **ABSORPTION_AT_KEY_LEVEL:** 4:1+ ratio at CVA/DVA level
4. **STACKED_IMBALANCE_BREAKOUT:** Multiple imbalances in one direction
5. **TRAPPED_TRADERS_REVERSAL:** Failed breakout, trapped participants
6. **DIVERGENCE_AT_EXTREME:** Price/volume divergence at VWAP SD2
7. **LACK_OF_PARTICIPATION:** Weak volume at breakout attempt
8. **EXHAUSTION_SIGNAL:** Momentum exhaustion at profile extreme

---

## Summary: Daily Checklist

**8:00 AM London (3:00 AM ET):**
- [ ] Start IB Gateway (paper mode, port 4002)
- [ ] Verify Replit server running

**8:30 AM London (3:30 AM ET):**
- [ ] Launch Python bridge
- [ ] Verify CVA initialization (5 days loaded)
- [ ] Check connection status on F1 Command Center

**9:00 AM London (4:00 AM ET):**
- [ ] Review daily hypothesis
- [ ] Note key levels (R1/S1, CVA VAH/VAL/POC)
- [ ] Check value migration pattern
- [ ] Enable/disable auto-trading based on confidence

**9:30 AM ET (2:30 PM London):**
- [ ] Confirm CD flush (server logs)
- [ ] Monitor DVA building
- [ ] Watch for absorption signals

**During RTH:**
- [ ] Monitor traffic light regime
- [ ] Watch pressure gauges
- [ ] Review high-probability setup alerts
- [ ] Track P&L if auto-trading enabled

**4:00 PM ET (9:00 PM London):**
- [ ] Review daily P&L
- [ ] Compare hypothesis vs actual
- [ ] Check completed DVA values
- [ ] Optionally shut down bridge

---

## Configuration Reference

**IBKR Account:**
- Username: `fredpaper74`
- Password: `m!j8r5C%WF3W-#2`
- Paper Account: DU0070151
- Gateway Port: 4002

**Symbols:**
- Price Display: ES (E-mini S&P 500)
- Trade Execution: MES (Micro E-mini S&P 500)

**Market Hours:**
- RTH: 9:30 AM - 4:00 PM ET (2:30 PM - 9:00 PM London)
- ETH: 4:00 PM - 9:30 AM ET (overnight session)

**Auto-Trading:**
- Minimum Confidence: 75%
- Requires: Valid CVA (3+ days) + Valid DVA
- Position Size: 1 MES contract per setup
- Risk Management: Built into setup recognition

---

**Questions? Check server logs for detailed diagnostics or contact support.**
