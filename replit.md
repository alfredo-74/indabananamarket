# OrderFlowAI Trading System

## Overview

OrderFlowAI is a professional automated trading system for futures markets, specifically targeting ES (E-mini S&P 500) for data visualization and MES (Micro E-mini S&P 500) for trade execution. It uses order flow analysis and market regime detection, implementing a dual-strategy approach: Rotational Trading for range-bound markets and Directional Trading for trending markets, with sophisticated risk management based on VWAP, cumulative delta, and volumetric candle analysis. The project's ambition is to provide real-time market data, automated trade execution via Interactive Brokers, and comprehensive performance analytics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React 18, TypeScript, and Vite, utilizing Radix UI primitives and shadcn/ui components styled with Tailwind CSS. It draws inspiration from the Carbon Design System for data-intensive financial interfaces, prioritizing a dark mode with high contrast and IBM Plex fonts for optimal readability. State management uses TanStack Query for server state and WebSockets for real-time market data, candle updates, regime changes, and position updates. Key components include a `TradingDashboard`, `ChartComponent` (Chart.js-based with VWAP bands), `RegimeIndicator`, `SessionIndicator`, `LiveStatsPanel`, `TradeHistoryTable`, `ControlPanel`, and an `AccountAnalysisPanel` for comprehensive performance analytics.

### Backend

The backend is a Node.js Express.js server written in TypeScript, providing RESTful endpoints and WebSocket streaming. Core trading modules include:
- **VolumetricCandleBuilder**: Aggregates tick data into time-based candles with buy/sell volume separation and cumulative delta.
- **VWAPCalculator**: Computes Volume-Weighted Average Price with standard deviation bands for entry/exit signals.
- **RegimeDetector**: Identifies market regimes (ROTATIONAL, DIRECTIONAL_BULLISH, DIRECTIONAL_BEARISH, TRANSITIONING) based on cumulative delta thresholds and hysteresis.
- **SessionDetector**: Differentiates between ETH (Extended Trading Hours) and RTH (Regular Trading Hours).
- **SessionAwareRegimeManager**: Manages session-specific cumulative delta and regime thresholds, with smart blending at RTH open.
- **KeyLevelsDetector**: Tracks previous day's high/low/close, swing highs/lows, and volume Point of Control for confluence scoring.
- **PerformanceAnalyzer**: Calculates comprehensive trading metrics like win rate, profit factor, Sharpe ratio, and maximum drawdown, with breakdowns by session and regime.
- **Storage Layer**: Currently uses in-memory storage (`MemStorage`) but is designed with an interface for future PostgreSQL integration via Drizzle ORM.

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