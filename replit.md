# OrderFlowAI Trading System

## Overview
OrderFlowAI is an automated trading system for futures markets, implementing the G7FX PRO course methodology. It features Market/Volume Profile analysis with 5-day Composite Value Areas (CVA), Value Migration tracking, pre-market hypothesis generation, and advanced order flow detection (absorption, divergence, lack of participation, stacked imbalances). The system targets ES for price display and MES for trade execution via Interactive Brokers. The F1 Command Center UI provides a Formula 1 steering wheel-inspired interface with real-time order flow signal alerts, focusing on 90% context (profiles, VWAP, value areas) and 10% order flow. The project's ambition is to create a robust, professional-grade automated trading solution.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes (Nov 7, 2025)

### IBKR Bridge Connection Blinking Fix (RESOLVED)
Fixed the persistent connection blinking issue where the F1 Command Center UI would toggle between "Connected" and "Disconnected" states every few seconds.

**Root Cause Identified:**
- The heartbeat timeout logic only updated `bridgeLastHeartbeat` in the `market_data` branch
- When market is quiet (sparse price updates), the heartbeat would timeout even though the bridge was sending other message types
- This caused the 10-second timeout check to incorrectly mark the bridge as disconnected

**Fix Implemented:**
- Moved `bridgeLastHeartbeat = Date.now()` to the **top** of `/api/bridge/data` handler (line 209)
- Now ALL message types (`market_data`, `dom`, `trades`, `account_data`, `heartbeat`) keep the connection alive
- Removed duplicate heartbeat updates from individual message type branches (cleaner code)

**Security Enhancement - Local-Only Auth Bypass:**
Added optional `SAFETY_AUTH_MODE` environment variable for easier local development:
- **"strict"** (default): Requires `x-safety-auth-key` header on ALL requests (production mode)
- **"local-only"**: Bypasses auth for requests from 127.0.0.1/::1 ONLY (local dev convenience)
- Server logs loud warnings when running in local-only mode
- Enhanced auth rejection logging with IP address and diagnostic details

**Test Results:**
- Server logs show stable `"ibkr_connected":true` throughout startup and operation
- Zero disconnect messages after restart
- Connection stays green without blinking

**Deployment Instructions for User:**
1. Download updated `server/routes_stable.ts` to your local ChromeOS system
2. Copy `.env.local.template` to `.env.local` if not already done
3. Set `SAFETY_AUTH_MODE=local-only` in `.env.local` for easier Python bridge connection (or keep "strict" for production)
4. Ensure `SAFETY_AUTH_KEY` is set in `.env.local` (required for server startup)
5. Restart with `./start.sh`
6. Connection should remain stable without blinking

**Security Notes:**
- Never commit `.env.local` to version control (contains real credentials)
- Use "strict" mode in any hosted/production environment
- Local-only mode ONLY bypasses auth for localhost traffic

### Production Safety System Implementation (Nov 6, PRODUCTION-READY)
Implemented comprehensive AutoTrader Production Safety Manager with database persistence and security hardening for real money trading with £1,912 GBP IBKR account.

**Safety Features (Database-Backed):**
1. **Order Confirmation Tracking** - All IBKR orders tracked in `orderTracking` table, stores order status (PENDING/FILLED/REJECTED/CANCELLED), filled prices, reject reasons
2. **Reject Replay Protection** - Rejected orders cached in `rejectedOrders` table with 30-minute cooldown, prevents duplicate attempts on same signal
3. **Trading Fence** - Automatically activates when IBKR bridge disconnects, persists state to `safetyConfig` table, requires authenticated manual deactivation via API
4. **Position Reconciliation** - Verifies local position matches IBKR before trades, handles GBP currency conversion
5. **Max Drawdown Circuit Breaker** - Halts trading if daily P&L drops below -£500 (configurable in `safetyConfig` table)
6. **Multi-Layered Safety Checks** - Pre-trade validation in auto-trading loop blocks trades on safety violations
7. **Readiness Guards** - All code paths check `safetyManagerReady` flag to prevent race conditions during startup
8. **Fail-Safe Architecture** - Server refuses to start if safety manager initialization fails or SAFETY_AUTH_KEY missing

**Security Features:**
1. **SAFETY_AUTH_KEY Required** - Server performs fail-fast validation on startup, refuses to start if key missing or < 32 characters
2. **Endpoint Authentication** - All safety-critical endpoints require `x-safety-auth-key` header:
   - POST `/api/safety/config` - Update safety configuration (PROTECTED)
   - POST `/api/safety/fence/deactivate` - Manually deactivate trading fence (PROTECTED)
   - POST `/api/order-confirmation` - Receive order confirmations from Python bridge (PROTECTED)
3. **Input Validation** - All safety endpoints validate request parameters (types, ranges, enums)
4. **Security Logging** - All unauthorized access attempts logged with requester IP address

**Database Tables:**
- `orderTracking`: order_id, signal_id, action, quantity, entry_price, status, filled_price, filled_time, reject_reason
- `rejectedOrders`: signal_id, reason, price, timestamp, expires_at (auto-expire after cooldown)
- `safetyConfig`: max_drawdown_gbp, trading_fence_active, fence_reason, fence_activated_at, position_reconciliation_enabled

**API Endpoints:**
- GET `/api/safety/status` - Current safety status with violations list (read-only, no auth)
- POST `/api/safety/config` - Update safety configuration (REQUIRES AUTH)
- POST `/api/safety/fence/deactivate` - Manually deactivate trading fence (REQUIRES AUTH)
- POST `/api/order-confirmation` - Receive order confirmations from Python bridge (REQUIRES AUTH)

**Architecture:**
- `ProductionSafetyManager` class with async factory pattern (`ProductionSafetyManager.create()`)
- Database-backed persistence ensures state survives server restarts
- Integrated into auto-trading loop with comprehensive pre-trade checks and readiness guards
- Python bridge (`ibkr_bridge_v2.py`) sends order confirmations with authentication header using `asyncio.to_thread`
- All safety manager code paths protected by `safetyManagerReady` flag to prevent null reference errors

**Running IBKR Bridge with Authentication:**
The Python bridge requires the same SAFETY_AUTH_KEY environment variable:
```bash
export SAFETY_AUTH_KEY="your-64-character-key-here"
python server/ibkr_bridge_v2.py
```
The bridge will refuse to send order confirmations if SAFETY_AUTH_KEY is not set.

### Earlier Critical Fixes
1. **Mock Data Generator Control**: Fixed race condition, atomic handoff from mock to real data when bridge connects
2. **Footprint Data Backfill**: Automatic backfill for legacy data missing `imbalance_direction` field
3. **Type Safety Fixes**: Resolved LSP errors in storage.ts for Drizzle database insertions

### CVA Historical Data Recovery (AUTOMATED)
The bridge automatically recovers missing daily profiles when connected:
- Fetches 7 days of historical 5-minute bars from IBKR by default
- Rebuilds Market Profile and Volume Profile for each day
- Persists to database (survives restarts)
- Reconstructs 5-day CVA automatically
- User can customize with `--historical-days N` flag

To recover your 6 deleted daily profiles: Just run the bridge once with SAFETY_AUTH_KEY set!

### Known Issues
- 2 LSP errors in storage.ts (unrelated to safety features - legacy profile array conversion issues)
- User needs to run local `ibkr_bridge_v2.py` with SAFETY_AUTH_KEY to connect IBKR and recover CVA data

## System Architecture

### Frontend
The frontend uses React 18, TypeScript, and Vite, with Radix UI, shadcn/ui, and Tailwind CSS. State management employs TanStack Query for server state and WebSockets for real-time data.

**F1 Command Center**: The primary interface, inspired by a Formula 1 steering wheel, features:
- **Traffic Light Market Regime**: Visual indicator for market conditions (TREND_UP, TREND_DOWN, BALANCE, BREAKOUT_PENDING).
- **Pressure Gauges**: Buy/sell pressure and cumulative delta strength indicators.
- **Order Flow Signal Panel**: Real-time absorption event alerts.
- **Value Area Display**: CVA, DVA, POC levels.
- **Daily Hypothesis**: Pre-market trade plan.
- **System Status**: Account balance, P&L, connection indicators.

**Classic Trading Dashboard**: A secondary interface at `/classic` with Time & Sales, Chart.js-based charts (with VWAP bands), and DOM.

### Backend
The backend is a Node.js Express.js server written in TypeScript, offering RESTful endpoints and WebSocket streaming.

**Core PRO Course Systems**:
- **CompositeProfileManager**: Builds 5-day Composite Value Area (CVA) for pre-market context and profile shape identification.
- **ValueMigrationDetector**: Tracks Daily Value Area (DVA) relative to CVA, detecting migration patterns.
- **HypothesisGenerator**: Creates pre-market trade hypotheses based on various market data.
- **OrderFlowSignalDetector**: Detects advanced order flow signals like lack of participation, stacked imbalances, and exhaustion.
- **Footprint Analysis Engine**: Tracks bid/ask volume breakdown, calculates delta, detects imbalances, and identifies stacked imbalances.
- **CVA Stacking System**: Maintains a 30-day historical CVA archive, classifying migration character and providing breakout reference levels.
- **Opening Drive Detector**: Identifies strong directional momentum early in RTH and generates trade entry signals.
- **80% Rule Detector**: Monitors overnight inventory completion, signaling continuation after rejection.
- **Enhanced Value Shift Detection**: Implements seven Value Expectations Framework conditions for various market scenarios.
- **TimeAndSalesProcessor**: Processes tick-by-tick transactions to track buy/sell pressure.
- **DomProcessor**: Analyzes Level 2 market depth for imbalance and liquidity.
- **VolumeProfileCalculator**: Builds horizontal volume histograms and identifies key levels.
- **AbsorptionDetector**: Identifies institutional absorption events.
- **Footprint-Order Flow Integration**: Integrates footprint data for detecting stacked imbalances and absorption signals.

**Supporting Modules**: VolumetricCandleBuilder, VWAPCalculator, RegimeDetector, SessionDetector, KeyLevelsDetector, PerformanceAnalyzer.

**Data Storage**: Uses PostgreSQL database (Neon Serverless) via Drizzle ORM for persistent storage of critical trading data:
- **Positions Table**: Current position state (contracts, entry price, P&L, side)
- **Trades Table**: Complete trade history with order flow signals
- **System Status Table**: Account balance, connection status, trading state
- **Market Data Table**: Latest market prices and volume
- **Daily/Composite Profiles**: 5-day CVA and historical value areas
- **Force Sync API**: `/api/position/force-sync` endpoint to manually reset phantom positions from database

**Trading Strategies**: Implemented for ROTATIONAL (mean reversion), DIRECTIONAL_BULLISH, and DIRECTIONAL_BEARISH market regimes.

## External Dependencies

### Trading Platform Integration
**Interactive Brokers (IBKR)**:
- Python bridge (`server/ibkr_connector.py`) using `ib_insync` connects to IB Gateway (port 4002 for paper trading).
- Uses ES contracts for price display and MES contracts for trade execution (market orders).
- Subscribes to real-time Level II (DOM) market data for ES futures via CME Real-Time subscription.
- Fetches account balance and P&L via IBKR API.

### Third-Party Services
**Market Data**: Interactive Brokers CME Real-Time Level II (NP/L2) subscription.
**Charting Library**: Chart.js, `chartjs-chart-financial`, and `chartjs-adapter-date-fns`.

### Key NPM Dependencies
**Frontend**: `@tanstack/react-query`, `chart.js`, `chartjs-adapter-date-fns`, `chartjs-chart-financial`, `@radix-ui/*`, `tailwindcss`, `react-hook-form`, `@hookform/resolvers`.
**Backend**: `express`, `ws`, `drizzle-orm`, `@neondatabase/serverless`.

### Database Provider
**Neon Serverless Postgres**: Configured for future persistent storage.