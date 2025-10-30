# OrderFlowAI Trading System

## Overview

OrderFlowAI is a professional automated trading system for futures markets implementing the complete G7FX PRO course methodology. The system features Market/Volume Profile analysis with 5-day Composite Value Areas (CVA), Value Migration tracking, pre-market hypothesis generation, and advanced order flow detection (absorption, divergence, lack of participation, stacked imbalances). It targets ES (E-mini S&P 500) for price display and MES (Micro E-mini S&P 500) for trade execution via Interactive Brokers integration. The F1 Command Center UI provides a Formula 1 steering wheel-inspired interface with traffic light regime indicators, pressure gauges, and real-time order flow signal alerts following the PRO course 90/10 rule: 90% context (profiles, VWAP, value areas), 10% order flow.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### UI Layout Overhaul (October 28, 2025)
- **Layout Restructure:**
  - Converted traffic light indicator from vertical to horizontal for better space utilization
  - Moved System Status to center column (previously in right column, center was empty)
  - Ensured all columns have consistent heights for a clean, balanced look
  - Removed `h-fit` classes to maintain proportionate window sizing
  - Removed IBKR connection helper instructions (system operates with simulated market data)

- **Fixed UI Issues:**
  - Removed duplicate ES symbol in price display header
  - Fixed layout overlap between Tactical Chart and Account section by adding proper scroll behavior
  - Ensured auto-trading toggle button is fully visible and functional
  - Simplified System Status window for cleaner appearance

### Advanced Features Implementation (October 2025)
- Implemented 4 major enhancements to the PRO course trading system:
  1. **Enhanced Order Flow Signal Detection** - Added 6 signal types (lack of participation, stacked imbalances, trapped traders, absorption, divergence, exhaustion)
  2. **Minimal Tactical Chart** - Built lightweight chart showing CVA/DVA levels, VWAP bands, and absorption force field visuals
  3. **High-Probability Trade Recommendation Engine** - Created `high_probability_setup_recognizer.ts` implementing 8 PRO Course setups with confidence scoring
  4. **Auto-Trading Integration** - Connected recommendation engine to AutoTrader for automatic execution of high-confidence setups (75% minimum threshold)

## System Architecture

### Frontend

The frontend is built with React 18, TypeScript, and Vite, utilizing Radix UI primitives and shadcn/ui components styled with Tailwind CSS. State management uses TanStack Query for server state and WebSockets for real-time market data and order flow signals.

**F1 Command Center** (`client/src/pages/f1-command-center.tsx`) - Default homepage:
- Formula 1 steering wheel-inspired tactical interface with high-contrast green/red/black terminal aesthetic
- **Traffic Light Market Regime** - Large visual indicator showing market condition (TREND_UP, TREND_DOWN, BALANCE, BREAKOUT_PENDING)
- **Pressure Gauges** - Buy/sell pressure meters with cumulative delta strength indicator
- **Order Flow Signal Panel** - Real-time absorption events (4:1, 5:1 ratios) with glowing green/red indicators
- **Value Area Display** - CVA, DVA, POC levels from composite profile system
- **Daily Hypothesis** - Pre-market trade plan with key levels and expected behavior
- **System Status** - Account balance, daily P&L, connection indicators

**Classic Trading Dashboard** (`client/src/pages/trading-dashboard.tsx`) - Available at `/classic`:
- Three-column layout with Time & Sales, Chart, DOM
- Chart.js candlesticks with VWAP bands
- Absorption alerts and trade history

### Backend

The backend is a Node.js Express.js server written in TypeScript, providing RESTful endpoints and WebSocket streaming. 

**PRO Course Systems** (Market/Volume Profile + Advanced Order Flow):
- **CompositeProfileManager** (`server/composite_profile.ts`): Builds 5-day Composite Value Area (CVA) for pre-market context, calculates composite POC/VAH/VAL, identifies profile shape (P, b, D, DOUBLE)
- **ValueMigrationDetector** (`server/value_migration_detector.ts`): Tracks Daily Value Area (DVA) position relative to CVA, detects bullish/bearish/neutral migration, measures overlap percentage and migration strength
- **HypothesisGenerator** (`server/hypothesis_generator.ts`): Generates pre-market trade hypothesis using overnight data, CVA, DVA, and value migration, creates rule-based trade plan with key levels and invalidation criteria
- **OrderFlowSignalDetector** (`server/orderflow_signal_detector.ts`): Detects lack of participation, stacked imbalances, trapped traders, initiative vs responsive buying/selling, exhaustion signals
- **TimeAndSalesProcessor** (`server/time_and_sales.ts`): Processes tick-by-tick transactions, tracks buy/sell pressure, detects large institutional trades
- **DomProcessor** (`server/dom_processor.ts`): Analyzes Level 2 market depth, identifies bid/ask imbalance, detects stacked liquidity
- **VolumeProfileCalculator** (`server/volume_profile.ts`): Builds horizontal volume histograms, calculates POC, VAH, VAL, identifies profile shapes and HVN/LVN
- **AbsorptionDetector** (`server/absorption_detector.ts`): Identifies institutional absorption (4:1, 5:1 ratios), signals reversals/breakouts

**Legacy Supporting Modules**:
- **VolumetricCandleBuilder**: Aggregates tick data into candles with buy/sell volume separation
- **VWAPCalculator**: Computes VWAP with standard deviation bands (SD1, SD2)
- **RegimeDetector / SessionAwareRegimeManager**: Identifies market regimes based on cumulative delta
- **SessionDetector**: Differentiates ETH vs RTH trading sessions
- **KeyLevelsDetector**: Tracks previous day's high/low/close and swing levels
- **PerformanceAnalyzer**: Calculates comprehensive trading metrics
- **Storage Layer**: In-memory storage (`MemStorage`) with PostgreSQL interface via Drizzle ORM

**API Endpoints**:

*PRO Course Endpoints*:
- `/api/composite-profile` - Get 5-day Composite Value Area (CVA) with POC, VAH, VAL
- `/api/value-migration` - Get Value Migration analysis (DVA vs CVA relationship)
- `/api/daily-hypothesis` - Get pre-market hypothesis and rule-based trade plan
- `/api/orderflow-signals` - Get advanced order flow signals (limit parameter)

*Foundation Course Endpoints*:
- `/api/time-and-sales` - Get Time & Sales transaction feed (limit parameter)
- `/api/dom` - Get current Depth of Market snapshot
- `/api/volume-profile` - Get Volume Profile with POC, VAH, VAL
- `/api/absorption-events` - Get detected absorption events (limit parameter)
- `/api/discord-levels` - Get/Set Discord price levels (support/resistance from trading course)

*Legacy Endpoints*:
- `/api/status`, `/api/market-data`, `/api/candles`, `/api/vwap`, `/api/regime`, `/api/position`, `/api/trades`, `/api/session`, `/api/key-levels`, `/api/account-analysis`

Trading strategies are implemented for each regime:
- **ROTATIONAL**: Mean reversion from VWAP standard deviation extremes.
- **DIRECTIONAL_BULLISH**: Long entries at SD-1 with targets at higher SD levels.
- **DIRECTIONAL_BEARISH**: Short entries at SD+1 with targets at lower SD levels.

### Data Storage

The current implementation uses in-memory storage. The system is configured for future integration with PostgreSQL via Drizzle ORM and `@neondatabase/serverless`, with a defined schema in `shared/schema.ts`.

### Authentication and Authorization

Not currently implemented, as the system is designed for a single-user paper trading environment.

## External Dependencies

### Trading Platform Integration

**Interactive Brokers (IBKR)**:
- A Python bridge (`server/ibkr_connector.py`) using `ib_insync` connects to IB Gateway on port 4002 (paper trading).
- Uses ES contracts for price display and MES contracts for trade execution (market orders).
- Subscribes to **real-time Level II (DOM) market data** from ES futures via CME Real-Time subscription.
- Fetches account balance, unrealized/realized P&L from IBKR `accountSummary()` API.

**Account Configuration**:
- Login Credentials: `fredpaper74` / `m!j8r5C%WF3W-#2` (main account - select paper mode in IB Gateway)
- Paper Account Number: DU0070151 (username: `rcmrns534` - identifier only, not used for login)
- IB Gateway Port: **4002** (paper trading) / 4001 (live trading)
  - Note: TWS uses different ports: 7497 (paper) / 7496 (live)
- Level II Subscription: CME Real-Time (NP/L2) - £8.34/month (waived with £15-20+ in monthly commissions)
- Market Data: Real-time bid/ask depth, accurate buy/sell volume classification, institutional order flow

### Third-Party Services

**Market Data**: Interactive Brokers CME Real-Time Level II (NP/L2) subscription with Depth of Market (DOM) data.
**Charting Library**: Chart.js, extended with `chartjs-chart-financial` for candlestick charts and `chartjs-adapter-date-fns` for time scaling.

### Key NPM Dependencies

**Frontend**: `@tanstack/react-query`, `chart.js`, `chartjs-adapter-date-fns`, `chartjs-chart-financial`, `@radix-ui/*`, `tailwindcss`, `react-hook-form`, `@hookform/resolvers`.
**Backend**: `express`, `ws`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`.
**Development**: `vite`, `tsx`, `esbuild`.

### Database Provider

**Neon Serverless Postgres**: Configured for future persistent storage implementation.