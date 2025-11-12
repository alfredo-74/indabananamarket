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

---

# 🚀 **Publishing to Production**

## Why Publish?

Publishing your app gives you:
- ✅ **Stable URL** - No more changing dev URLs
- ✅ **Better Performance** - Optimized production build
- ✅ **Auto-Scaling** - Handles traffic spikes automatically
- ✅ **Always Available** - Runs 24/7, even when you close Replit

## 📋 **Publishing Checklist**

### **Step 1: Publish Your Replit App**

1. **Click the "Publish" button** in your Replit workspace header
2. **Choose "Autoscale Deployment"** (best for web apps with WebSocket)
3. **Click "Publish"** and wait ~2-3 minutes
4. **Copy your published URL** - looks like: `https://your-app-name.replit.app`

### **Step 2: Configure Your Local Bridge**

1. **Download the latest bridge file** from Replit:
   - Open: `server/ibkr_bridge_REAL_TIME_LEVEL2.py`
   - Download to your local machine

2. **Edit the bridge configuration** at the top of the file:
   ```python
   # ============================================================================
   # CONFIGURATION - Change MODE to switch between dev and production
   # ============================================================================
   MODE = "production"  # Change from "dev" to "production"
   
   # Backend URLs for each mode
   BACKEND_URLS = {
       "dev": "http://localhost:5000",
       "production": "https://your-app-name.replit.app"  # Replace with YOUR published URL
   }
   # ============================================================================
   ```

3. **Replace the placeholder:**
   - Change `https://YOUR-PUBLISHED-APP.replit.app` 
   - To your actual published URL from Step 1

### **Step 3: Run the Bridge**

Simply double-click or run:
```bash
python3 ibkr_bridge_REAL_TIME_LEVEL2.py
```

The bridge will automatically use the production URL based on the MODE setting!

### **Step 4: Access Your Live App**

Open your published URL in a browser:
```
https://your-app-name.replit.app
```

You'll see the F1 Command Center running with real-time IBKR data! 🏎️

## 🔄 **Switching Between Dev and Production**

To switch modes, just edit **one line** in the bridge file:

**For Development:**
```python
MODE = "dev"  # Uses http://localhost:5000
```

**For Production:**
```python
MODE = "production"  # Uses your published URL
```

## ⚙️ **Auto-Trading Configuration**

The auto-trader is **already configured** and will work immediately after publishing!

- ✅ **RTH-Only Trading** - Only trades 9:30 AM - 4:00 PM ET
- ✅ **High-Probability Setups** - Based on G7FX PRO methodology
- ✅ **MES Contracts** - Micro futures for lower risk
- ✅ **Paper Trading** - Safe testing environment

## 📊 **Monitoring Your Live System**

After publishing, you can:

1. **Open the published URL** - See F1 Command Center
2. **Watch auto-trade signals** - HIGH-PROB SETUPS window
3. **Monitor positions** - ACCOUNT & P&L window
4. **Track order flow** - Real-time absorption events

## ⚠️ **Important Notes**

- ✅ Bridge runs **locally** (connects to local IBKR Gateway)
- ✅ Backend runs **in the cloud** (on Replit)
- ✅ You can access the UI from **anywhere** (phone, tablet, etc.)
- ✅ IBKR Gateway must be **running on your local machine**
- ✅ Auto-trading only happens during **RTH (9:30 AM - 4:00 PM ET)**

## 🎯 **Ready for Tomorrow's Market Open?**

1. ✅ Publish your app
2. ✅ Update bridge MODE to "production"
3. ✅ Add your published URL
4. ✅ Start IBKR Gateway (paper trading)
5. ✅ Run the bridge script
6. ✅ Open your published URL
7. ✅ Wait for 9:30 AM ET market open! 🔔
