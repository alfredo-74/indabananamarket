#!/bin/bash
# Quick start script for local trading system

echo "================================"
echo "OrderFlowAI - Local Trading System"
echo "================================"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ ERROR: .env.local not found!"
    echo ""
    echo "Create .env.local from template:"
    echo "  cp .env.local.template .env.local"
    echo "  nano .env.local  # Edit and add your DATABASE_URL"
    echo ""
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Load environment variables
export $(cat .env.local | grep -v '^#' | xargs)

echo "✅ Configuration loaded"
echo "✅ Database: ${DATABASE_URL:0:30}..."
echo "✅ Safety key: ${SAFETY_AUTH_KEY:0:10}..."
echo ""
echo "🚀 Starting Node.js server on http://localhost:5000"
echo ""
echo "Next steps:"
echo "1. Open another terminal"
echo "2. Run the Python bridge: python3 server/ibkr_bridge_local.py"
echo "3. Open browser: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop the server"
echo "================================"
echo ""

# Start Node.js server
npm run dev
