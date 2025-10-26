# OrderFlowAI Trading System

## Overview

OrderFlowAI is a professional automated trading system for futures markets, specifically targeting ES (E-mini S&P 500) for data visualization and MES (Micro E-mini S&P 500) for trade execution. It uses order flow analysis and market regime detection, implementing a dual-strategy approach: Rotational Trading for range-bound markets and Directional Trading for trending markets, with sophisticated risk management based on VWAP, cumulative delta, and volumetric candle analysis. The project's ambition is to provide real-time market data, automated trade execution via Interactive Brokers, and comprehensive performance analytics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React 18, TypeScript, and Vite, utilizing Radix UI primitives and shadcn/ui components styled with Tailwind CSS. It draws inspiration from the Carbon Design System for data-intensive financial interfaces, prioritizing a dark mode with high contrast and IBM Plex fonts for optimal readability. State management uses TanStack Query for server state and WebSockets for real-time market data, candle updates, regime changes, and position updates. 

The UI follows the **90/10 Rule** from professional trading methodology: 90% order flow data, 10% charts. Key components include:
- **Order Flow Panels**: `TimeAndSalesPanel` (color-coded transaction feed), `DomLadder` (depth of market visualization), `AbsorptionAlerts` (institutional order absorption detection)
- **Chart & Analytics**: `ChartComponent` (Chart.js candlesticks with VWAP), `RegimeIndicator`, `SessionIndicator`, `LiveStatsPanel`, `TradeHistoryTable`, `ControlPanel`, `AccountAnalysisPanel`
- **Layout**: Three-column dashboard with Time & Sales (left), Chart (center - smaller per 90/10 rule), DOM (right), with absorption alerts and stats in secondary row

### Backend

The backend is a Node.js Express.js server written in TypeScript, providing RESTful endpoints and WebSocket streaming. 

**Order Flow Analysis Modules** (Foundation Course Implementation):
- **TimeAndSalesProcessor** (`server/time_and_sales.ts`): Processes real-time tick-by-tick transactions, tracks buy/sell pressure, detects large institutional trades, calculates volume ratios
- **DomProcessor** (`server/dom_processor.ts`): Analyzes Level 2 market depth data, identifies bid/ask imbalance, detects stacked liquidity (institutional orders), finds largest support/resistance levels
- **VolumeProfileCalculator** (`server/volume_profile.ts`): Builds horizontal volume histograms, calculates POC (Point of Control), VAH/VAL (Value Area High/Low), identifies profile shapes (P, b, D, DOUBLE), detects HVN/LVN (High/Low Volume Nodes)
- **AbsorptionDetector** (`server/absorption_detector.ts`): Identifies when aggressive orders are absorbed by passive liquidity without price movement, signals institutional defense of price levels, predicts potential reversals/breakouts

**Legacy Trading Modules** (Being Replaced):
- **VolumetricCandleBuilder**: Aggregates tick data into time-based candles with buy/sell volume separation and cumulative delta
- **VWAPCalculator**: Computes Volume-Weighted Average Price with standard deviation bands
- **RegimeDetector**: Identifies market regimes based on cumulative delta thresholds
- **SessionDetector**: Differentiates between ETH and RTH trading sessions
- **SessionAwareRegimeManager**: Manages session-specific cumulative delta
- **KeyLevelsDetector**: Tracks previous day's high/low/close and swing levels
- **PerformanceAnalyzer**: Calculates comprehensive trading metrics
- **Storage Layer**: Currently uses in-memory storage (`MemStorage`) with interface for PostgreSQL via Drizzle ORM

**API Endpoints**:
- `/api/time-and-sales` - Get Time & Sales transaction feed (limit parameter)
- `/api/dom` - Get current Depth of Market snapshot
- `/api/volume-profile` - Get Volume Profile with POC, VAH, VAL
- `/api/absorption-events` - Get detected absorption events (limit parameter)
- `/api/discord-levels` - Get/Set Discord price levels (support/resistance from trading course)

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
- A Python bridge (`server/ibkr_connector.py`) using `ib_insync` connects to IB Gateway/TWS (port 7497 for paper trading).
- Uses ES contracts for price display and MES contracts for trade execution (market orders).
- Subscribes to real-time tick data from ES and fetches account balance, unrealized/realized P&L from IBKR `accountSummary()` API.

### Third-Party Services

**Market Data**: Interactive Brokers delayed market data (free tier).
**Charting Library**: Chart.js, extended with `chartjs-chart-financial` for candlestick charts and `chartjs-adapter-date-fns` for time scaling.

### Key NPM Dependencies

**Frontend**: `@tanstack/react-query`, `chart.js`, `chartjs-adapter-date-fns`, `chartjs-chart-financial`, `@radix-ui/*`, `tailwindcss`, `react-hook-form`, `@hookform/resolvers`.
**Backend**: `express`, `ws`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`.
**Development**: `vite`, `tsx`, `esbuild`.

### Database Provider

**Neon Serverless Postgres**: Configured for future persistent storage implementation.