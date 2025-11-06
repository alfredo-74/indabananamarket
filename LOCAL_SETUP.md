# OrderFlowAI - Local Setup Guide

Run everything on your Chromebook with no Replit confusion.

## Prerequisites

1. **Node.js 18+** installed
2. **Python 3** installed (you already have this for IBKR bridge)
3. **IB Gateway** running on port 4002

## Quick Start (5 minutes)

### Step 1: Install Dependencies

```bash
cd ~/workspace  # or wherever you want the project
npm install
```

### Step 2: Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# Database (stays on Replit - no changes needed)
DATABASE_URL="your_database_url_from_replit"

# Safety Key (use the same one)
SAFETY_AUTH_KEY="295d67de43a97a278f18d9891a2e7fc24fc829f37fd7dd357cd5dadfd9c03605"

# IBKR Credentials
IBKR_USERNAME="fredpaper74"
IBKR_PASSWORD="m!j8r5C%WF3W-#2"

# Session Secret (generate random string)
SESSION_SECRET="your-random-session-secret-here"

# Node Environment
NODE_ENV=development
```

**To get DATABASE_URL from Replit:**
1. Open your Replit project
2. Go to Secrets (lock icon in sidebar)
3. Copy the `DATABASE_URL` value

### Step 3: Start the Node.js Server

```bash
npm run dev
```

Server will start on http://localhost:5000

### Step 4: Start the Python IBKR Bridge

In a **separate terminal**:

```bash
cd ~/workspace  # same directory
export SAFETY_AUTH_KEY="295d67de43a97a278f18d9891a2e7fc24fc829f37fd7dd357cd5dadfd9c03605"
export IBKR_USERNAME="fredpaper74"
export IBKR_PASSWORD="m!j8r5C%WF3W-#2"

python3 server/ibkr_bridge_local.py
```

### Step 5: Open the Trading Interface

Open your browser to: **http://localhost:5000**

## Verify It's Working

You should see:
- ✅ Real ES prices (6750-6770 range, not 6002 mock data)
- ✅ "IBKR Connected" status
- ✅ CVA values: VAH 6899.5, VAL 6822.5
- ✅ Trade recommendations appear when setups form

## Troubleshooting

**Problem: "Cannot connect to database"**
- Check DATABASE_URL is correct in `.env.local`
- Verify Replit database is accessible

**Problem: "IBKR Bridge disconnected"**
- Make sure IB Gateway is running on port 4002
- Check IBKR credentials are correct
- Verify Python bridge is running with correct environment variables

**Problem: "No trade recommendations"**
- Wait for a candle to complete (1-minute bars)
- Verify you're in RTH (9:30 AM - 4:00 PM ET)
- Check CVA is initialized (needs 3+ days of data)

## Stopping the System

1. **Ctrl+C** in Node.js terminal
2. **Ctrl+C** in Python bridge terminal
3. Close IB Gateway (optional)

## Why This Works Better

**Before:** Dev server (mock) ⟷ Production server (real) ⟷ Python bridge
- Confusing which server has what data
- Can't see auto-trader logs in real-time
- Hard to debug

**Now:** Python bridge → Node.js server (localhost) → Browser
- One unified system
- See everything happening in real-time
- Easy to debug and verify trades

## Auto-Trading

The auto-trader runs automatically when:
- ✅ IBKR bridge connected
- ✅ In RTH (9:30 AM - 4:00 PM ET)
- ✅ High-probability setup detected (75%+ confidence)
- ✅ CVA initialized with 3+ days data
- ✅ Safety checks pass

When a valid setup appears, you'll see:
```
[AUTO-TRADE] 🎯 EXECUTING: VA BREAKOUT SHORT @ 6752.25 (75% confidence)
[AUTO-TRADE] ✅ Order queued: SHORT 1 MES
```

Then watch your Python bridge terminal for IBKR order confirmation.
