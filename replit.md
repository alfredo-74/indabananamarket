# OrderFlowAI Trading System

## Overview

OrderFlowAI is a professional automated trading system for futures markets that uses order flow analysis and market regime detection. The application displays **ES (E-mini S&P 500)** pricing while executing trades on **MES (Micro E-mini S&P 500)** contracts - the industry standard approach. This provides real-time market data visualization, automated trade execution via Interactive Brokers (IBKR), and sophisticated risk management based on VWAP, cumulative delta, and volumetric candle analysis.

The system implements a dual-strategy approach: **Rotational Trading** for range-bound markets and **Directional Trading** for trending markets, with regime transitions determined by cumulative delta thresholds.

**Display vs Trading Architecture**:
- **Price Display**: ES contract (~6000 points) - what professional traders watch
- **Trade Execution**: MES contract - cheaper margin requirement ($1,250 vs $12,500)
- **P&L Calculation**: MES multiplier ($5/point) ensures accurate profit/loss tracking

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript, using Vite as the build tool

**UI Component Library**: Radix UI primitives with shadcn/ui components, styled with Tailwind CSS

**Design System**: 
- Carbon Design System inspiration for data-intensive financial interfaces
- IBM Plex Mono for numerical data alignment (tabular figures)
- IBM Plex Sans for UI labels and headers
- Dark mode primary with high contrast for extended trading sessions
- Information density optimized for real-time data updates

**State Management**:
- TanStack Query (React Query) for server state and API caching
- WebSocket integration for real-time market data streaming
- Local state via React hooks for UI controls

**Real-time Communication**:
- WebSocket connection (`/ws` endpoint) for live market data, candle updates, regime changes, and position updates
- Automatic reconnection logic with connection status monitoring
- Query invalidation triggered by WebSocket messages

**Key Frontend Components**:
- `TradingDashboard`: Main dashboard orchestrating all trading views
- `ChartComponent`: Chart.js-based candlestick charts with VWAP bands and key level overlays
- `RegimeIndicator`: Visual display of current market regime (ROTATIONAL/DIRECTIONAL_BULLISH/DIRECTIONAL_BEARISH)
- `SessionIndicator`: Displays current session (ETH/RTH), time to next session, and session-specific cumulative delta
- `LiveStatsPanel`: Real-time P&L, position, and market statistics
- `TradeHistoryTable`: Historical trade log with performance metrics
- `ControlPanel`: Trading automation controls and parameter settings

### Backend Architecture

**Runtime**: Node.js with Express.js server

**Language**: TypeScript with ES modules

**API Design**: RESTful endpoints for static data, WebSocket for real-time streaming

**Core Trading Modules**:

1. **VolumetricCandleBuilder** (`server/volumetric_candle_builder.ts`):
   - Aggregates tick data into time-based candles (default: 1-minute intervals)
   - Tracks buy/sell volume separation and cumulative delta per candle
   - Uses `accumulated_volume` instead of traditional volume for order flow analysis

2. **VWAPCalculator** (`server/vwap_calculator.ts`):
   - Calculates Volume-Weighted Average Price with standard deviation bands
   - Lookback period: 10 candles (optimized from initial 50 for faster results)
   - Provides SD±1, SD±2, SD±3 levels for entry/exit signals
   - Handles NaN values gracefully for JSON serialization

3. **RegimeDetector** (`server/regime_detector.ts`):
   - Detects market regime based on cumulative delta thresholds
   - Threshold: ±50 (adjusted for tick-by-tick data with volume=1)
   - Implements hysteresis to prevent rapid regime flapping
   - Four states: ROTATIONAL, DIRECTIONAL_BULLISH, DIRECTIONAL_BEARISH, TRANSITIONING

4. **SessionDetector** (`server/session_detector.ts`) - *Phase 1*:
   - Detects ETH (Extended Trading Hours: 6 PM - 9:30 AM ET) vs RTH (Regular Trading Hours: 9:30 AM - 4 PM ET)
   - Handles timezone conversion from user's London timezone to ET
   - Provides session start/end times and calculates time to next session transition

5. **SessionAwareRegimeManager** (`server/session_aware_regime_manager.ts`) - *Phase 1*:
   - Maintains separate cumulative delta tracking for ETH and RTH sessions
   - Different regime thresholds: ±30 for ETH (lower liquidity), ±50 for RTH (higher liquidity)
   - Smart regime blending at RTH open using weighted average (prevents false regime switches)
   - Resets ETH cumulative delta at 6 PM ET daily

6. **KeyLevelsDetector** (`server/key_levels_detector.ts`) - *Phase 1*:
   - Tracks previous day high/low/close for support/resistance
   - Detects swing highs/lows using configurable lookback period (default: 10 candles)
   - Calculates volume Point of Control (POC) - price level with highest volume
   - All levels used for confluence scoring in trade signals

7. **Storage Layer** (`server/storage.ts`):
   - In-memory storage implementation (MemStorage)
   - Stores candles, VWAP data, regime state, positions, trades, market data, system status, session stats, and key levels
   - Designed with interface (IStorage) for future database integration

**Trading Strategy Logic**:
- **ROTATIONAL**: Mean reversion trades when CD is between -50 and +50, targeting VWAP from SD±3 extremes
- **DIRECTIONAL_BULLISH**: Long entries at SD-1 with profit targets at SD+1/+2/+3 when CD > +50
- **DIRECTIONAL_BEARISH**: Short entries at SD+1 with profit targets at SD-1/-2/-3 when CD < -50

### Data Storage Solutions

**Current Implementation**: In-memory storage via `MemStorage` class

**Database Configuration**: Drizzle ORM configured for PostgreSQL (via `@neondatabase/serverless`)
- Schema definition: `shared/schema.ts`
- Migration directory: `./migrations`
- Database provisioning expected via `DATABASE_URL` environment variable

**Note**: The application is architected to support PostgreSQL through Drizzle but currently operates with in-memory storage. The storage interface allows seamless transition to persistent database storage.

### Authentication and Authorization

Not currently implemented - system designed for single-user paper trading environment.

## External Dependencies

### Trading Platform Integration

**Interactive Brokers (IBKR)**:
- Python bridge script (`server/ibkr_connector.py`) using `ib_insync` library
- Connection to IB Gateway/TWS on port 7497 (paper trading)
- Market data type 3 (delayed data - 15-minute delay, free tier)
- Display contract: ES (E-mini S&P 500) with auto front-month selection - for price display
- Trading contract: MES (Micro E-mini S&P 500) with auto front-month selection - for order execution
- Order execution: Market orders for entry/exit on MES
- Real-time tick data subscription with bid/ask tracking from ES

### Third-Party Services

**Market Data**: 
- Interactive Brokers delayed market data (free)
- Planned upgrade path to real-time data ($4.50/month subscription)

**Charting Library**: Chart.js with financial chart extensions
- `chartjs-chart-financial`: Candlestick and OHLC chart support
- `chartjs-adapter-date-fns`: Time-scale adapter for date handling

### Key NPM Dependencies

**Frontend**:
- `@tanstack/react-query`: Server state management
- `chart.js`, `chartjs-adapter-date-fns`, `chartjs-chart-financial`: Charting
- `@radix-ui/*`: Headless UI primitives (18+ packages)
- `tailwindcss`: Utility-first CSS framework
- `react-hook-form` + `@hookform/resolvers`: Form handling with validation

**Backend**:
- `express`: Web server framework
- `ws`: WebSocket server implementation
- `drizzle-orm` + `@neondatabase/serverless`: Database ORM and Postgres driver
- `connect-pg-simple`: PostgreSQL session store (for future session management)

**Development**:
- `vite`: Frontend build tool and dev server
- `tsx`: TypeScript execution for Node.js
- `esbuild`: Backend bundler for production builds

### Database Provider

**Neon Serverless Postgres**: Configured via `@neondatabase/serverless` driver for future persistent storage implementation.

### Build and Deployment

**Development**: 
- Frontend: Vite dev server with HMR
- Backend: tsx with watch mode
- Concurrent development via `NODE_ENV=development`

**Production Build**:
- Frontend: Vite builds to `dist/public`
- Backend: esbuild bundles to `dist/index.js`
- Deployment: Node.js server serving static frontend + API/WebSocket endpoints

## Recent Changes

### Phase 1: Session Intelligence + Key Levels (Completed - October 25, 2025)

**Objective**: Add session awareness and key level detection for confluence-based trading.

**Backend Enhancements**:
- `SessionDetector`: ETH vs RTH detection with ET timezone handling
- `SessionAwareRegimeManager`: Separate ETH/RTH cumulative delta tracking with smart blending at session transitions
- `KeyLevelsDetector`: Previous day levels, swing highs/lows, and volume POC detection
- New API endpoints: `GET /api/session`, `GET /api/key-levels`
- WebSocket broadcasts for session updates and key level changes
- Enhanced schema with `SessionType`, `SessionStats`, and `KeyLevels` types

**Frontend Enhancements**:
- `SessionIndicator` component: Shows current session (ETH/RTH), countdown to next session, session-specific cumulative delta
- Key levels overlay on chart: Purple lines for previous day levels, orange for swing levels, amber for volume POC
- Updated `ChartComponent` to render key levels as horizontal reference lines

**Trading Logic Improvements**:
- Session-aware regime thresholds: ETH uses ±30, RTH uses ±50 (accounts for liquidity differences)
- Smart regime transitions at RTH open: Weighted average instead of hard reset prevents false signals
- Confluence scoring foundation: Key levels aligned with VWAP bands increase trade quality (to be fully implemented in Phase 2)

**Next Phase (Phase 2)**: DOM (Depth of Market) integration with live order book visualization and imbalance detection for enhanced order flow analysis.