#!/bin/bash
# ============================================================================
# IBKR Trading System Startup Script (ChromeOS Local)
# ============================================================================
# Launches both Node.js server and IBKR bridge with auto-reconnect
# Run from ~/Bananas directory
# ============================================================================

set -e  # Exit on error

echo "========================================================================"
echo "🏎️  IBKR TRADING SYSTEM - LOCAL STARTUP"
echo "========================================================================"

# Check if running from correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from ~/Bananas directory"
    echo "   Run: cd ~/Bananas && ./start.sh"
    exit 1
fi

# Auto-load environment variables from .env.local
if [ -f ".env.local" ]; then
    echo "📄 Loading environment from .env.local"
    set -a  # Automatically export all variables
    source .env.local
    set +a  # Stop auto-exporting
else
    echo "⚠️  Warning: .env.local not found - using existing environment variables"
fi

# Check required environment variables
missing_vars=0

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set"
    missing_vars=1
fi

if [ -z "$SAFETY_AUTH_KEY" ]; then
    echo "❌ SAFETY_AUTH_KEY not set"
    missing_vars=1
fi

if [ -z "$SESSION_SECRET" ]; then
    echo "❌ SESSION_SECRET not set"
    missing_vars=1
fi

if [ -z "$IBKR_USERNAME" ]; then
    echo "❌ IBKR_USERNAME not set"
    missing_vars=1
fi

if [ -z "$IBKR_PASSWORD" ]; then
    echo "❌ IBKR_PASSWORD not set"
    missing_vars=1
fi

if [ $missing_vars -eq 1 ]; then
    echo ""
    echo "💡 Set environment variables first:"
    echo "   export DATABASE_URL=\"postgresql://...\""
    echo "   export SAFETY_AUTH_KEY=\"your-key\""
    echo "   export SESSION_SECRET=\"your-secret\""
    echo "   export IBKR_USERNAME=\"your-username\""
    echo "   export IBKR_PASSWORD=\"your-password\""
    exit 1
fi

echo "✅ Environment variables validated"

# Cleanup function for graceful shutdown
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    if [ ! -z "$NODE_PID" ]; then
        echo "   Stopping Node.js server (PID: $NODE_PID)"
        kill $NODE_PID 2>/dev/null || true
    fi
    echo "   Stopping IBKR bridge"
    # IBKR bridge is in foreground, will be killed by Ctrl+C
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Node.js server in background
echo ""
echo "========================================================================"
echo "📦 Starting Node.js Server"
echo "========================================================================"
npm run dev > /tmp/nodejs-server.log 2>&1 &
NODE_PID=$!

echo "✅ Node.js server started (PID: $NODE_PID)"
echo "   Logs: /tmp/nodejs-server.log"
echo "   Waiting 5 seconds for server to initialize..."
sleep 5

# Check if Node.js server is running
if ! kill -0 $NODE_PID 2>/dev/null; then
    echo "❌ Node.js server failed to start. Check logs:"
    tail -20 /tmp/nodejs-server.log
    exit 1
fi

# Check if server is responding on port 5000
if ! curl -s http://localhost:5000/api/status > /dev/null 2>&1; then
    echo "⚠️  Warning: Server not responding on port 5000 yet"
    echo "   Waiting 5 more seconds..."
    sleep 5
fi

if curl -s http://localhost:5000/api/status > /dev/null 2>&1; then
    echo "✅ Server responding on http://localhost:5000"
else
    echo "❌ Server not responding. Check logs:"
    tail -20 /tmp/nodejs-server.log
    kill $NODE_PID 2>/dev/null || true
    exit 1
fi

# Start IBKR bridge in foreground (with auto-reconnect built-in)
echo ""
echo "========================================================================"
echo "🔌 Starting IBKR Bridge (AUTO-RECONNECT ENABLED)"
echo "========================================================================"
echo "   Press Ctrl+C to stop both services"
echo "========================================================================"
echo ""

# Run bridge in foreground - it will auto-reconnect on disconnect
python3 server/ibkr_bridge_local.py

# If we reach here, bridge exited (only happens on Ctrl+C)
cleanup
