# OrderFlowAI Trading System

## Overview
OrderFlowAI is an automated trading system for futures markets, implementing the G7FX PRO course methodology. It provides Market/Volume Profile analysis with 5-day Composite Value Areas (CVA), Value Migration tracking, pre-market hypothesis generation, and advanced order flow detection (absorption, divergence, lack of participation, stacked imbalances). The system targets ES for price display and MES for trade execution via Interactive Brokers. The F1 Command Center UI offers a Formula 1 steering wheel-inspired interface with real-time order flow signal alerts, emphasizing 90% context (profiles, VWAP, value areas) and 10% order flow. The project aims to deliver a robust, professional-grade automated trading solution with a business vision of leveraging AI for precise, automated futures trading and significant market potential.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with React 18, TypeScript, and Vite, utilizing Radix UI, shadcn/ui, and Tailwind CSS for styling. State management uses TanStack Query for server state and WebSockets for real-time data.

**UI/UX Decisions**:
- **F1 Command Center**: A primary interface inspired by a Formula 1 steering wheel, featuring:
    - Traffic Light Market Regime indicator.
    - Pressure Gauges for buy/sell pressure and cumulative delta strength.
    - Order Flow Signal Panel for real-time absorption event alerts.
    - Value Area Display including CVA, DVA, and POC levels.
    - Daily Hypothesis for pre-market trade plans.
    - System Status showing account balance, P&L, and connection indicators.
- **Classic Trading Dashboard**: A secondary interface at `/classic` providing Time & Sales, Chart.js-based charts with VWAP bands, and a DOM.

### Backend
The backend is a Node.js Express.js server written in TypeScript, providing RESTful endpoints and WebSocket streaming.

**Technical Implementations and Feature Specifications**:
- **Core PRO Course Systems**:
    - **CompositeProfileManager**: Builds 5-day CVA for market context.
    - **ValueMigrationDetector**: Tracks Daily Value Area (DVA) relative to CVA.
    - **HypothesisGenerator**: Creates pre-market trade hypotheses.
    - **OrderFlowSignalDetector**: Detects advanced order flow signals (absorption, lack of participation, stacked imbalances, exhaustion).
    - **Footprint Analysis Engine**: Tracks bid/ask volume, delta, imbalances.
    - **CVA Stacking System**: Archives 30-day historical CVAs and classifies migration.
    - **Opening Drive Detector**: Identifies strong directional momentum and generates signals.
    - **80% Rule Detector**: Monitors overnight inventory completion for continuation signals.
    - **Enhanced Value Shift Detection**: Implements seven Value Expectations Framework conditions.
    - **TimeAndSalesProcessor** and **DomProcessor**: Process tick data and Level 2 market depth.
    - **VolumeProfileCalculator** and **AbsorptionDetector**: Build volume profiles and identify absorption.
    - **Footprint-Order Flow Integration**: Combines data for comprehensive signal detection.
- **Auto-Trading Orchestrator**: Event-driven system (`server/auto_trading_orchestrator.ts`) that bridges real-time market data to automated trade execution. Features include:
    - 1-second debounce protection on market data ticks.
    - Signal ID tracking to prevent duplicate orders.
    - 75%+ confidence threshold for signal execution.
    - Multi-Layer Safety Integration with `ProductionSafetyManager`.
    - Fail-safe initialization.
- **Production Safety System**: Comprehensive AutoTrader Production Safety Manager with database persistence. Features include:
    - Order Confirmation Tracking in `orderTracking` table.
    - Reject Replay Protection using `rejectedOrders` table with 30-minute cooldown.
    - Trading Fence that activates on IBKR bridge disconnection, persisted in `safetyConfig` table.
    - Position Reconciliation to verify local position with IBKR.
    - Max Drawdown Circuit Breaker (e.g., -£500 daily P&L).
    - Multi-Layered Safety Checks and Readiness Guards.
    - Fail-Safe Architecture with server refusing to start if initialization fails or `SAFETY_AUTH_KEY` is missing.
    - Security features: `SAFETY_AUTH_KEY` requirement for server startup and critical endpoints, input validation, and security logging.
- **IBKR Bridge Connection Fix**: Implemented a fix to ensure stable "Connected" status by updating `bridgeLastHeartbeat` for all message types.
- **CVA Historical Data Recovery**: Automated recovery of missing daily profiles by fetching historical 5-minute bars from IBKR and rebuilding Market/Volume Profiles.

### System Design Choices
- **Event-Driven Architecture**: For real-time market data processing and trade execution.
- **Database-Backed Persistence**: Ensures critical state (safety settings, order tracking) survives server restarts.
- **Security Hardening**: Implementation of `SAFETY_AUTH_KEY` for critical operations and local-only bypass for development.
- **Modular Design**: Separation of concerns into distinct managers and detectors.
- **Trading Strategies**: Implemented for ROTATIONAL (mean reversion), DIRECTIONAL_BULLISH, and DIRECTIONAL_BEARISH market regimes.

## External Dependencies

### Trading Platform Integration
- **Interactive Brokers (IBKR)**: Connected via a Python bridge (`server/ibkr_connector.py`) using `ib_insync`. Uses ES contracts for price display and MES for trade execution. Subscribes to real-time Level II (DOM) market data and fetches account/P&L data.

### Third-Party Services
- **Market Data**: Interactive Brokers CME Real-Time Level II (NP/L2) subscription.

### Database Provider
- **Neon Serverless Postgres**: Used for persistent storage of trading data, including positions, trades, system status, market data, and daily/composite profiles, managed via Drizzle ORM.

### Key Libraries and Frameworks
- **Frontend**: React, TypeScript, Vite, Radix UI, shadcn/ui, Tailwind CSS, TanStack Query, Chart.js (`chartjs-chart-financial`, `chartjs-adapter-date-fns`).
- **Backend**: Node.js, Express.js, TypeScript, WebSockets (`ws`), Drizzle ORM, `@neondatabase/serverless`.
- **Python Bridge**: `ib_insync`.