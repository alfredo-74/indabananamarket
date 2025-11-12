# OrderFlowAI Trading System

**Institutional-grade ES/MES futures trading system implementing the G7FX PRO course methodology**

OrderFlowAI is an automated trading system that combines Market/Volume Profile analysis, Value Migration tracking, pre-market hypothesis generation, and advanced order flow detection. The system connects to Interactive Brokers for real-time Level II market data and automated trade execution.

---

## 🎯 Overview

**Primary Use Case**: Real-time futures trading with professional-grade order flow analysis  
**Target Instrument**: ES (display) / MES (execution)  
**Data Source**: Interactive Brokers CME Real-Time Level II (NP/L2)  
**Deployment**: Local development (ChromeOS Flex) + Production (Replit/Fly.io)

**Key Features**:
- F1 Command Center UI (Formula 1 steering wheel-inspired interface)
- 5-day Composite Value Area (CVA) analysis with historical recovery
- Real-time order flow signal detection (absorption, stacked imbalances, exhaustion)
- Auto-trading orchestrator implementing PRO 90/10 Rule
- Production Safety Manager with database-backed fail-safes
- Automatic trade reconciliation with Interactive Brokers

---

## 🏗️ System Architecture

### Frontend Layer
**Technology**: React 18 + TypeScript + Vite  
**Styling**: Radix UI, shadcn/ui, Tailwind CSS  
**State Management**: TanStack Query + WebSocket subscriptions

**UI Components**:
1. **F1 Command Center** (`/`): Primary trading interface
   - Traffic Light Market Regime indicator
   - Pressure Gauges for order flow
   - Real-time signal alerts panel
   - Value Area display with CVA stacking
   - Daily hypothesis generator
   - 12-window draggable grid layout

2. **Classic Trading Dashboard** (`/classic`): Secondary interface
   - Time & Sales feed
   - Chart.js-based charts with VWAP bands
   - Depth of Market (DOM)

### Backend Layer
**Technology**: Node.js + Express.js + TypeScript  
**Architecture**: Event-driven with WebSocket streaming  
**Database**: PostgreSQL (local) with Drizzle ORM

**Core Subsystems**:

#### Market Analysis Engine
- **CompositeProfileManager**: 5-day CVA calculation with historical data recovery
- **ValueMigrationDetector**: Tracks value area shifts across sessions
- **VolumeProfileCalculator**: Real-time TPO (Time-Price-Opportunity) analysis
- **HypothesisGenerator**: Pre-market setup predictions

#### Order Flow Detection
- **OrderFlowSignalDetector**: Absorption, lack of participation, stacked imbalances, exhaustion
- **FootprintAnalysisEngine**: Delta analysis at price levels
- **AbsorptionDetector**: High-volume absorption events
- **CVAStackingSystem**: Multi-day value area alignment

#### PRO Course Systems
- **OpeningDriveDetector**: Initial balance expansion patterns
- **80%RuleDetector**: Value area acceptance/rejection signals
- **EnhancedValueShiftDetection**: Real-time value migration

#### Auto-Trading System
- **HighProbabilitySetupRecognizer**: Context validation (market regime, value areas, CVA)
- **OrderFlowStrategy**: Signal-based execution logic
- **AutoTradingOrchestrator**: Event-driven coordinator implementing PRO 90/10 Rule
  - Context-driven setup confirmation
  - 75%+ confidence threshold
  - 1-second debounce with signal ID tracking
  - Multi-layer safety integration

#### Production Safety Manager
**Database-backed fail-safe system**:
- Order confirmation tracking (prevent duplicate orders)
- Reject replay protection (30-min cooldown)
- Trading fence (auto-disable on IBKR bridge disconnect)
- Position reconciliation (sync with IBKR every ~15s)
- Max drawdown circuit breaker
- Requires `SAFETY_AUTH_KEY` for critical operations

#### Trade Reconciliation System
**Automatic IBKR synchronization**:
- Continuous position streaming from IBKR
- Auto-closing of server-tracked trades
- Manual entry/partial close adjustments
- Position reversal detection
- P&L validation
- Trade splitting for multi-contract positions

### Integration Layer

**Interactive Brokers Connection**:
- Python bridge (`server/ibkr_connector.py`) using `ib_insync`
- ES contracts for price display
- MES contracts for trade execution
- Real-time Level II (DOM) market data subscription
- Account/P&L data fetching
- Stable connection monitoring with heartbeat updates

**Data Flow**:
```
IB Gateway → Python Bridge → WebSocket → Node.js Server → PostgreSQL
                                ↓
                          React Frontend (WebSocket subscriptions)
```

---

## 🚀 Quick Start

### Prerequisites

1. **ChromeOS Flex / Linux Environment**
   - PostgreSQL 14+ installed
   - Node.js 20+ and npm
   - Python 3.11+ with `ib-insync` and `nest-asyncio`
   - IB Gateway installed (see INSTRUCTIONS.md)

2. **Interactive Brokers Account**
   - Active account with futures trading permissions
   - CME Real-Time Level II (NP/L2) market data subscription
   - IB Gateway configured for API access (port 4001/4002)

3. **Environment Variables**
   ```bash
   DATABASE_URL=postgresql://postgres:password@localhost:5432/indabananamarket
   SESSION_SECRET=your-random-secret-key
   IBKR_USERNAME=your-ibkr-username
   IBKR_PASSWORD=your-ibkr-password
   SAFETY_AUTH_KEY=your-safety-auth-key
   NODE_ENV=development
   ```

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/orderflowai.git
cd orderflowai

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install ib-insync nest-asyncio

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Setup database
npm run db:push

# Start development server
npm run dev
```

Server starts at `http://localhost:3000`

### First-Time Setup

1. **Configure IB Gateway** (see INSTRUCTIONS.md):
   - Enable API access in Settings → API → Settings
   - Set socket port to 4001 (TWS) or 4002 (Gateway)
   - Enable "ActiveX and Socket Clients"
   - Uncheck "Read-Only API"

2. **Launch IB Gateway**:
   ```bash
   # Start with virtual display (ChromeOS)
   Xvfb :1 -ac -screen 0 1024x768x24 &
   export DISPLAY=:1
   ~/Jts/ibgateway/*/ibgateway
   ```

3. **Verify Connection**:
   - Open http://localhost:3000
   - Check "System Status" panel
   - Should show "IBKR Bridge: Connected"

---

## 📊 Core Features

### Market Profile Analysis
- **5-Day Composite Value Areas (CVA)**: Tracks institutional positioning over weekly cycles
- **Value Migration**: Detects shifts in accepted value areas
- **Historical Data Recovery**: Automatically fetches missing daily profiles from IBKR
- **TPO Charts**: Time-Price-Opportunity distribution analysis

### Order Flow Detection
- **Absorption**: Large volume accepted without price movement
- **Lack of Participation**: Price movement with minimal volume
- **Stacked Imbalances**: Sequential delta imbalances indicating momentum
- **Exhaustion**: Volume climax patterns signaling potential reversals

### Auto-Trading (PRO 90/10 Rule)
**Context (90%)**: Market regime + Value areas + CVA alignment  
**Confirmation (10%)**: Real-time order flow signals

**Execution Logic**:
1. Validate market context (rotational vs directional)
2. Check CVA stacking (3+ aligned value areas = high conviction)
3. Wait for order flow confirmation (absorption, imbalance, exhaustion)
4. Execute when confidence ≥ 75%
5. Apply multi-layer safety checks

### Production Safety Features
- **Order Tracking**: Prevent duplicate submissions
- **Reject Protection**: 30-minute cooldown after order rejection
- **Trading Fence**: Auto-disable trading on connection loss
- **Position Reconciliation**: Continuous sync with IBKR positions
- **Circuit Breaker**: Max drawdown protection
- **Authentication**: `SAFETY_AUTH_KEY` required for critical operations

---

## 🔧 Development Workflow

### Local Development (ChromeOS Flex)
```bash
# Start server with hot-reload
npm run dev

# Run TypeScript type checking
npm run check

# Push database schema changes
npm run db:push
```

### Production Build
```bash
# Build frontend + backend
npm run build

# Start production server
npm run start
```

### Database Management
```bash
# Push schema changes (safe)
npm run db:push

# Force push (data-loss warning bypass)
npm run db:push --force

# Backup database
pg_dump -U postgres indabananamarket > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
psql -U postgres indabananamarket < backup_20251111_120000.sql
```

### Git Workflow
```bash
# Pull latest changes
git pull origin main

# Commit changes
git add .
git commit -m "Description of changes"

# Push to GitHub
git push origin main
```

**Replit Sync**: Replit does NOT automatically pull from GitHub. Use the Git pane in Replit to manually pull updates after pushing from local.

---

## 🌐 Deployment Options

### Option 1: Local Development (ChromeOS Flex)
- **Best for**: Active trading hours, real-time monitoring
- **Pros**: Low latency, full control, direct IB Gateway access
- **Cons**: Requires local machine running during market hours

### Option 2: Replit (Development/Monitoring)
- **Best for**: Remote access, collaborative development
- **Pros**: Always accessible, integrated Git, automatic restarts
- **Cons**: Shared resources, higher latency, manual Git sync required
- **Setup**: Import GitHub repo, configure environment secrets, use Git pane to pull updates

### Option 3: Production (Fly.io / VPS)
- **Best for**: 24/7 automated trading
- **Pros**: High uptime, dedicated resources, production-grade infrastructure
- **Cons**: Requires setup, ongoing costs
- **Considerations**: IB Gateway installation, VNC for GUI access, connection monitoring

---

## 🛡️ Safety & Risk Management

### Built-in Safeguards
1. **Position Limits**: Configurable max position size (default: 1 contract)
2. **Drawdown Protection**: Circuit breaker at configurable threshold
3. **Connection Monitoring**: Trading fence activates on IBKR disconnect
4. **Order Confirmation**: Prevents duplicate orders via database tracking
5. **Reject Cooldown**: 30-minute pause after order rejection
6. **Position Reconciliation**: Continuous sync prevents position drift

### Emergency Procedures
```bash
# Disable auto-trading immediately
curl -X POST http://localhost:3000/api/auto-trading/disable \
  -H "X-Safety-Auth: your-safety-key"

# Check current position
curl http://localhost:3000/api/position

# View safety status
curl http://localhost:3000/api/safety/status \
  -H "X-Safety-Auth: your-safety-key"
```

### Manual Override
If automated systems fail:
1. Open IB Gateway manually
2. Use TWS to close positions
3. Disable auto-trading via API endpoint
4. Restart server with `npm run dev`

---

## 📁 Project Structure

```
orderflowai/
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/         # Route components (F1 Command Center, Classic Dashboard)
│   │   ├── components/    # Reusable UI components (shadcn/ui)
│   │   └── lib/           # Query client, utilities
├── server/                # Express.js backend
│   ├── index.ts           # Main server entry point
│   ├── routes.ts          # API route definitions
│   ├── storage.ts         # Database interface (Drizzle ORM)
│   ├── ibkr_connector.py  # Python IB Gateway bridge
│   └── services/          # Business logic
│       ├── CompositeProfileManager.ts
│       ├── OrderFlowSignalDetector.ts
│       ├── AutoTradingOrchestrator.ts
│       ├── ProductionSafetyManager.ts
│       └── TradeReconciliationSystem.ts
├── shared/
│   └── schema.ts          # Database schema (Drizzle)
├── package.json           # Node.js dependencies
├── pyproject.toml         # Python dependencies
├── drizzle.config.ts      # Database configuration
└── .env.example           # Environment template
```

---

## 🐛 Troubleshooting

### IB Gateway Connection Issues
**Problem**: Server shows "IBKR Bridge: Disconnected"

**Solutions**:
1. Check IB Gateway is running: `ps aux | grep ibgateway`
2. Verify API settings in IB Gateway (Configure → Settings → API)
3. Confirm port 4001/4002 is listening: `netstat -an | grep 4001`
4. Check Python bridge logs for errors
5. Restart IB Gateway with virtual display (ChromeOS)

### Database Connection Errors
**Problem**: `Error: connect ECONNREFUSED`

**Solutions**:
1. Verify PostgreSQL is running: `systemctl status postgresql`
2. Check DATABASE_URL in .env matches actual credentials
3. Test connection: `psql -U postgres -d indabananamarket`
4. Restart PostgreSQL: `sudo systemctl restart postgresql`

### WebSocket Connection Failed
**Problem**: Browser console shows WebSocket errors

**Solutions**:
1. Verify server is running on port 3000
2. Check firewall allows WebSocket connections
3. Ensure NODE_ENV is set correctly
4. Restart server: `npm run dev`

### Auto-Trading Not Executing
**Problem**: Signals detected but no trades executed

**Solutions**:
1. Check auto-trading enabled: `/api/auto-trading/status`
2. Verify confidence threshold ≥ 75%
3. Check safety manager status: `/api/safety/status`
4. Review orchestrator logs for rejection reasons
5. Confirm position limits not exceeded

---

## 📚 Additional Documentation

- **[INSTRUCTIONS.md](./INSTRUCTIONS.md)**: Quick-reference command guide
- **[replit.md](./replit.md)**: Replit-specific operational notes
- **G7FX PRO Course**: Methodology documentation (external)
- **Interactive Brokers API**: https://interactivebrokers.github.io/tws-api/

---

## 🤝 Contributing

This is a personal trading system. For questions or collaboration:
1. Review documentation thoroughly
2. Test changes in paper trading account first
3. Never commit credentials or API keys
4. Follow TypeScript/React best practices

---

## ⚠️ Disclaimer

**This software is for educational and personal use only.**

- Futures trading involves substantial risk of loss
- Past performance is not indicative of future results
- No warranty or guarantee of profitability
- Use at your own risk
- Test thoroughly in paper trading before live deployment
- Consult with a financial advisor before trading

---

## 📝 License

MIT License - See LICENSE file for details

---

**Version**: 1.0.0  
**Last Updated**: November 2025  
**Author**: Alfredo Carta  
**Platform**: ChromeOS Flex / Replit / Fly.io
