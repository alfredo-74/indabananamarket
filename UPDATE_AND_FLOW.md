# OrderFlowAI System Architecture & Data Flow

**Version**: Read-Only Market Monitor (November 2025)  
**Status**: All PRO methodology components intact, trading UI removed

---

## System Overview

OrderFlowAI is a **read-only market monitoring system** for ES/MES futures trading, implementing the complete G7FX PRO course methodology. All analysis engines remain fully operational - only the trading execution UI has been removed.

### Design Philosophy

- **90% Context, 10% Order Flow** (PRO Methodology)
- **Context-First Analysis**: Market/Volume Profiles, CVA/DVA, VWAP bands, Value Migration
- **Order Flow Confirmation**: Absorption, divergence, stacked imbalances, exhaustion
- **Full Analysis Engine**: All PRO components active and processing market data
- **Display-Only UI**: No trade execution buttons, pure market intelligence

---

## Architecture Components

### 1. IBKR Bridge (Python)
**File**: `server/ibkr_bridge_local.py`

**Purpose**: Connects to Interactive Brokers TWS/IB Gateway, streams market data to backend

**Capabilities**:
- Real-time ES price quotes (display contract)
- Level II DOM (Depth of Market) data
- MES position tracking (execution contract)
- Account balance & P&L streaming
- Automatic MES price corruption fix (divides by 5 when IBKR returns 5x multiplied prices)

**Data Flow**:
```
IBKR TWS/Gateway → ib_insync library → Bridge Process → HTTP POST → Backend API
```

**Key Endpoints Called**:
- `POST /api/bridge/data` - Market data, DOM, account updates
- `POST /api/order-confirmation` - Trade confirmations (for reconciliation)
- `GET /api/pending-orders` - Polls for queued orders (disabled in read-only mode)

---

### 2. Backend Server (Node.js/Express)
**File**: `server/routes_stable.ts`

**Purpose**: Core analysis engine, data persistence, WebSocket streaming to frontend

**PRO Methodology Components** (All Active):

#### Market Profile & Volume Analysis
- **CompositeProfileManager**: Builds 5-day Composite Value Area (CVA)
- **VolumeProfileCalculator**: Constructs real-time Daily Value Area (DVA)
- **CVA Stacking System**: Archives 30-day historical CVAs, classifies migration patterns

#### Value-Based Systems
- **ValueMigrationDetector**: Tracks DVA position relative to CVA (above/below/inside)
- **Enhanced Value Shift Detection**: 7-condition Value Expectations Framework
- **VWAP Calculator**: Real-time VWAP with standard deviation bands

#### Order Flow Detection
- **OrderFlowSignalDetector**: Advanced signal detection
  - Absorption (buying into selling pressure, selling into buying)
  - Lack of Participation (weak follow-through)
  - Stacked Imbalances (3+ consecutive bid/ask imbalances)
  - Exhaustion (reversal signals)
- **FootprintAnalyzer**: Bid/ask volume tracking, delta calculations
- **DomProcessor**: Level 2 market depth analysis

#### PRO Setup Recognition
- **HighProbabilitySetupRecognizer**: Context-driven trade setups
  - Value Area breakouts (DVA/CVA resistance/support)
  - Mean reversion plays (price extremes)
  - Opening Drive continuation (strong directional momentum)
- **80% Rule Detector**: Overnight inventory completion signals
- **Opening Drive Detector**: First 30-60 minutes directional bias

#### Pre-Market Intelligence
- **HypothesisGenerator**: Daily trade plan based on CVA/DVA alignment

**Data Flow**:
```
Bridge HTTP POST → Routes → Analysis Engines → Database (Neon Postgres)
                                              → WebSocket Broadcast → Frontend
```

**WebSocket Events**:
- `market_data` - Price, volume, timestamp
- `dom_update` - Level 2 bid/ask ladder
- `volume_profile` - DVA structure
- `composite_profile` - CVA levels
- `absorption_events` - Order flow signals
- `value_migration` - CVA/DVA relationship
- `hypothesis` - Pre-market trade plan
- `system_status` - Connection health, account data

---

### 3. Frontend (React/TypeScript)
**File**: `client/src/pages/f1-command-center.tsx`

**Purpose**: F1-inspired command center dashboard, real-time visualization

**UI Components** (12-window draggable grid):

1. **Traffic Light Header** - System health indicators
   - CVA: 5-day composite ready (green/red)
   - DVA: Daily value area built (green/red)
   - VWAP: Active bands (green/red)
   - Hypothesis: Pre-market plan loaded (green/red)
   - Signals: Order flow events active (green/red, pulses when live)

2. **Pressure Gauges** - Buy/sell pressure, cumulative delta
3. **Order Flow Signals** - Real-time absorption, divergence alerts
4. **Time & Sales** - Tick-by-tick trade flow
5. **CVA/DVA Comparison** - 5-day vs. daily value areas side-by-side
6. **Daily Hypothesis** - Pre-market trade plan and conditions
7. **Market Regime** - Rotational/Directional classification
8. **Value Shift Signals** - 7-condition framework alerts
9. **System Status** - Auto-trading OFF, IBKR connection, data streaming
10. **Account** - Balance, position, P&L (FORCE SYNC button only)
11. **DOM** - Level 2 market depth ladder
12. **PRO Setups** - High-probability context signals

**Trading Controls Removed**:
- ❌ BUY/SELL buttons
- ❌ CLOSE POSITION button
- ❌ ENABLE/DISABLE auto-trading toggle
- ❌ AUTO-TRADING traffic light indicator
- ✅ FORCE SYNC retained (data reconciliation only)

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         IBKR TWS/Gateway                        │
│              (ES price quotes, MES positions, DOM)              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Python IBKR Bridge                           │
│   • Subscribes to ES market data (display contract)            │
│   • Tracks MES positions (execution contract)                  │
│   • Auto-corrects MES price corruption (÷5 fix)                │
│   • Polls /api/pending-orders (disabled in read-only)          │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP POST /api/bridge/data
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Node.js Backend Server                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          PRO Methodology Analysis Engines                │  │
│  │  • CompositeProfileManager (5-day CVA)                   │  │
│  │  • ValueMigrationDetector (DVA vs CVA)                   │  │
│  │  • OrderFlowSignalDetector (absorption, divergence)      │  │
│  │  • HighProbabilitySetupRecognizer (VA breakouts, etc)    │  │
│  │  • HypothesisGenerator (pre-market plan)                 │  │
│  │  • CVA Stacking (30-day history)                         │  │
│  │  • VWAP Calculator (real-time bands)                     │  │
│  │  • FootprintAnalyzer (bid/ask delta)                     │  │
│  │  • 80% Rule + Opening Drive detectors                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          Database (Neon Postgres)                        │  │
│  │  • Market data (tick history)                            │  │
│  │  • Daily/Composite profiles (CVA/DVA)                    │  │
│  │  • Trades, positions (reconciliation)                    │  │
│  │  • Order flow events (absorption, signals)               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────┬────────────────────────────────────────────┘
                     │ WebSocket Streaming
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    React Frontend (F1 Dashboard)                │
│  • Real-time price, DOM, volume profile                        │
│  • CVA/DVA comparison charts                                   │
│  • Order flow signal alerts (absorption, divergence)           │
│  • Pre-market hypothesis display                               │
│  • 12-window draggable grid layout                             │
│  • READ-ONLY monitoring (no trading buttons)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Features (All Preserved)

### PRO Methodology (90% Context)
✅ **5-Day Composite Value Area (CVA)**: Daily profiles merged into single composite  
✅ **Value Migration Tracking**: DVA position relative to CVA (above/below/inside)  
✅ **30-Day CVA Stacking**: Historical value area archive, migration classification  
✅ **VWAP Bands**: Real-time calculation with standard deviation envelopes  
✅ **Value Shift Detection**: 7-condition framework for value expectations  
✅ **Market Regime Classification**: Rotational vs. Directional bias  

### Order Flow (10% Confirmation)
✅ **Absorption Detection**: Strong hands absorbing weak hand flow  
✅ **Divergence Signals**: Price/delta mismatches  
✅ **Stacked Imbalances**: 3+ consecutive bid/ask pressure  
✅ **Exhaustion Patterns**: Reversal signals at extremes  
✅ **Footprint Analysis**: Bid/ask volume tracking, delta calculations  

### Pre-Market Intelligence
✅ **Daily Hypothesis**: Automated trade plan generation based on CVA/DVA  
✅ **Opening Drive Detection**: First 30-60 min directional momentum  
✅ **80% Rule**: Overnight inventory completion signals  

### High-Probability Setups
✅ **Value Area Breakouts**: DVA/CVA resistance/support breaks  
✅ **Mean Reversion Plays**: Price extremes relative to value  
✅ **Opening Drive Continuation**: Strong directional follow-through  

### Safety & Reconciliation (Preserved)
✅ **Production Safety Manager**: Max drawdown circuit breaker, position limits  
✅ **Trade Reconciliation**: Auto-syncs IBKR positions with database (every ~15s)  
✅ **MES Price Corruption Fix**: Auto-corrects IBKR 5x price bug  
✅ **Database Persistence**: All state survives server restarts  

---

## How to Run

### Prerequisites
1. **IBKR Account**: Paper trading or live with ES/MES market data subscription
2. **IBKR TWS/Gateway**: Running and logged in (port 7497 for paper, 7496 for live)
3. **Environment Variables**: Set in `.env` or Replit Secrets
   - `DATABASE_URL` - Neon Postgres connection string
   - `IBKR_USERNAME` - IBKR account username
   - `IBKR_PASSWORD` - IBKR account password
   - `SESSION_SECRET` - Random string for session encryption

### Start System
```bash
# All-in-one command (starts backend + frontend + IBKR bridge)
npm run dev
```

This starts:
- **Backend**: Express server on port 5000
- **Frontend**: Vite dev server (proxied through backend)
- **IBKR Bridge**: Python process auto-spawned by backend

### Verify Connection
1. Check IBKR status indicator in F1 dashboard header (should show "IBKR: CONN" in green)
2. Verify traffic lights turn green as data loads:
   - **CVA** - 5-day composite builds after collecting 5 daily profiles
   - **DVA** - Daily value area builds as market ticks come in
   - **VWAP** - Activates immediately with first tick
   - **Hypothesis** - Generates at market open (pre-market)
   - **Signals** - Order flow events appear when detected

### Manual IBKR Bridge Start (if needed)
```bash
# From project root
python3 server/ibkr_connector.py
```

---

## Database Schema

**Tables** (Drizzle ORM managed):
- `market_data` - Tick-by-tick price/volume history
- `volume_profiles` - Daily value areas (DVA)
- `composite_profiles` - 5-day composites (CVA)
- `daily_hypothesis` - Pre-market trade plans
- `order_flow_signals` - Absorption, divergence events
- `trades` - Execution history (reconciliation)
- `positions` - Current position state
- `system_status` - Connection health, account data

**Migrations**:
```bash
# Push schema changes (safe, no manual SQL required)
npm run db:push

# Force push (if data loss warning appears)
npm run db:push --force
```

---

## Trading State (Read-Only Mode)

### Auto-Trading: DISABLED by Default
```typescript
// server/routes_stable.ts line 1074
auto_trading_enabled: existingStatus?.auto_trading_enabled ?? false
```

### UI Changes
- All trading buttons removed from interface
- System displays market intelligence only
- FORCE SYNC button retained for position reconciliation
- Safety systems remain active (max drawdown, position limits)

### Backend Components Active
- Auto-trading orchestrator remains in code but is NOT triggered (no UI toggle)
- All analysis engines process data continuously
- Order queue system disabled (bridge doesn't poll `/api/pending-orders` when auto-trading is OFF)
- Trade reconciliation active (syncs manual IBKR trades to database)

---

## Known Issues & Fixes

### MES Price Corruption (FIXED)
**Problem**: IBKR returns MES entry_price as 5x actual (e.g., 33521 instead of 6707)  
**Cause**: IBKR API bug - multiplies MES price by contract size (5) incorrectly  
**Fix**: Auto-detects ~5x ratio, divides by 5, logs correction  
**Location**: `server/ibkr_bridge_local.py` lines 394-412

### CVA Data Recovery (AUTOMATED)
**Problem**: Missing daily profiles prevent CVA calculation  
**Fix**: Automated backfill fetches historical 5-min bars from IBKR, rebuilds profiles  
**Status**: Fully operational, runs on server startup

---

## Production Deployment

### GitHub Push Preparation
```bash
# Ensure all secrets are in .env.example (NO actual values)
cp .env .env.example
# Edit .env.example and replace all real values with placeholders

# Commit changes
git add .
git commit -m "Convert to read-only market monitor"
git push origin main
```

### Replit → External Platform Migration
1. **Export Database**: Download Neon Postgres connection string
2. **Environment Variables**: Copy all secrets to new platform
3. **Python Dependencies**: Ensure `ib-insync`, `nest-asyncio` installed
4. **Node Dependencies**: `npm install` (package.json already configured)
5. **Port Binding**: Ensure backend binds to `0.0.0.0:5000` (already configured)

---

## Future Enhancements (Optional)

### Restore Trading Capabilities
1. Re-add BUY/SELL buttons to Account window
2. Re-add CLOSE POSITION button
3. Re-add AUTO-TRADING toggle to System Status window
4. Re-add AUTO-TRADING traffic light indicator
5. Set `auto_trading_enabled: true` default in `server/routes_stable.ts` line 1074

### Additional Features
- Historical playback mode (replay past market days)
- Strategy backtesting engine
- Multi-timeframe VWAP (1-hour, 4-hour, daily)
- Enhanced footprint heatmaps
- Alert system (email/SMS on high-confidence signals)

---

## Support & Documentation

- **Replit Docs**: Full system context in `replit.md`
- **PRO Methodology**: G7FX PRO course (external)
- **IBKR API**: TWS API documentation (external)
- **Drizzle ORM**: https://orm.drizzle.team

---

**System Status**: ✅ Fully Operational (Read-Only Mode)  
**Last Updated**: November 2025  
**Maintainer**: OrderFlowAI Team
