# OrderFlowAI Trading System

## Overview
OrderFlowAI is an automated trading system for futures markets, implementing the G7FX PRO course methodology. It features Market/Volume Profile analysis with 5-day Composite Value Areas (CVA), Value Migration tracking, pre-market hypothesis generation, and advanced order flow detection (absorption, divergence, lack of participation, stacked imbalances). The system targets ES for price display and MES for trade execution via Interactive Brokers. The F1 Command Center UI provides a Formula 1 steering wheel-inspired interface with real-time order flow signal alerts, focusing on 90% context (profiles, VWAP, value areas) and 10% order flow. The project's ambition is to create a robust, professional-grade automated trading solution.

## User Preferences
Preferred communication style: Simple, everyday language.

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