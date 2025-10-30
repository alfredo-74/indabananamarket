#!/bin/bash
# Download IBKR Bridge scripts to your home directory

echo "Downloading IBKR Bridge scripts..."
echo ""

# Download paper account version (delayed data)
if [ -f "ibkr_bridge_REAL_TIME_LEVEL2.py" ]; then
    cp ibkr_bridge_REAL_TIME_LEVEL2.py ~/ibkr_bridge_REAL_TIME_LEVEL2.py
    chmod +x ~/ibkr_bridge_REAL_TIME_LEVEL2.py
    echo "✓ Downloaded: ~/ibkr_bridge_REAL_TIME_LEVEL2.py"
    echo "  (Paper account port 4002 - delayed data)"
fi

# Download live account test version
if [ -f "ibkr_bridge_LIVE_READONLY.py" ]; then
    cp ibkr_bridge_LIVE_READONLY.py ~/ibkr_bridge_LIVE_READONLY.py
    chmod +x ~/ibkr_bridge_LIVE_READONLY.py
    echo "✓ Downloaded: ~/ibkr_bridge_LIVE_READONLY.py"
    echo "  (Live account port 4001 - READ-ONLY test)"
fi

echo ""
echo "======================================================================"
echo "NEXT STEPS - TEST YOUR CME SUBSCRIPTION"
echo "======================================================================"
echo ""
echo "1. Open IB Gateway and select LIVE mode (account: fredpaper74)"
echo "2. Run the test script:"
echo "   python3 ~/ibkr_bridge_LIVE_READONLY.py https://your-replit-url"
echo ""
echo "This will test if your CME subscription works on the LIVE account."
echo "NO TRADES will be executed - it's READ-ONLY mode for data only."
echo ""
echo "IF IT WORKS (no Error 354):"
echo "  → Your CME subscription is valid"
echo "  → IBKR just blocks API access for paper accounts"
echo "  → Contact IBKR to enable API access for paper trading"
echo ""
echo "IF IT FAILS (still Error 354):"
echo "  → Your 'Trader Workstation' subscription doesn't support API"
echo "  → You need 'CME Real-Time (NP,L2) Non-Display (API)' subscription"
echo ""
