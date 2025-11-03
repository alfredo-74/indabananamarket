# IBKR Bridge Setup Instructions

## 📥 **Download & Install**

1. **Download the bridge file from Replit:**
   - Open: `server/ibkr_bridge_REAL_TIME_LEVEL2.py`
   - Click the download button
   - Save to your local machine

2. **Run the bridge on your local machine:**
   ```bash
   python3 ibkr_bridge_REAL_TIME_LEVEL2.py https://ee197047-83ec-40d0-a112-c38e62a21590-00-2lvxbobtxixs9.kirk.replit.dev
   ```

## ✨ **What This Bridge Does**

The updated bridge now forwards **ALL** data to Replit:

### 1. ✅ Market Data (Already Working)
- Real-time ES price quotes
- Bid/Ask spreads
- Volume data

### 2. ✅ Level II DOM (Already Working)
- 10 bid levels
- 10 ask levels
- Institutional order flow

### 3. ✅ Historical Data (Already Working)
- 5 days of 5-minute bars
- Sent on startup for CVA calculation

### 4. 🆕 **Portfolio Updates (NEW!)**
- Current position (LONG 1x MES, FLAT, etc.)
- Entry price (average cost)
- Unrealized P&L (live updates)
- Realized P&L (closed trades)
- Market price for position valuation

## 🔄 **When Portfolio Updates Are Sent**

The bridge automatically forwards portfolio data when:

1. **Initial connection** - Sends current position from IBKR
2. **Position changes** - When you enter/exit trades
3. **P&L updates** - Every time unrealized/realized P&L changes
4. **Order fills** - After market orders execute

## 📊 **Expected Output**

When running correctly, you'll see:

```
🔗 Replit URL: https://your-repl.replit.dev
Connecting to IB Gateway on port 4002...
✅ Connected to IBKR Paper Trading
✅ ES display contract: 202503
✅ MES trading contract: 202503
📊 Fetching 5 days of historical data...
✅ Received 390 bars
✅ Sent 2025-01-27: 78 bars
✅ Sent 2025-01-28: 78 bars
✅ Sent 2025-01-29: 78 bars
✅ Sent 2025-01-30: 78 bars
✅ Sent 2025-01-31: 78 bars
🎉 Historical data upload complete - 5 days sent
🚀 Starting real-time data stream...
📊 Position update: MES 1 @ 6873.50
📤 Portfolio update sent: POS=1, uPnL=$5.64
```

## 🎯 **What You'll See in Replit**

After running the updated bridge:

1. **CVA Window** - Shows 5-day composite value areas (not zeros!)
2. **Account Window** - Shows:
   - Position: LONG 1x MES @ 6873.50 (not FLAT!)
   - Unrealized P&L: $5.64 (live updates!)
   - Real IBKR account balance (not £2000 hardcoded)
3. **Pressure Gauges** - Shows buy/sell pressure (not 0%!)

## ⚠️ **Important Notes**

- The bridge must be **restarted** if Replit backend restarts (to re-send historical data)
- Portfolio updates happen **automatically** - no manual refresh needed
- The bridge runs on **your local machine** and connects to your IBKR Gateway
- Make sure IB Gateway is running on **port 4002** (paper trading)

## 🐛 **Troubleshooting**

**CVA shows zeros?**
- Restart the bridge to re-send 5 days of historical data

**Position shows FLAT but you have a position?**
- The new bridge code will fix this - just restart it

**Pressure gauges show 0%?**
- Frontend code has been updated - Replit workflow will restart automatically
