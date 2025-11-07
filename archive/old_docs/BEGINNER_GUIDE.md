# OrderFlowAI - Complete Beginner's Guide

**For complete beginners - assumes no technical experience.**

---

## What You'll Need

Before we start, you need these programs on your Chromebook:

1. **Node.js** - Runs the trading system server
2. **Python 3** - You already have this (it runs the IBKR bridge)
3. **IB Gateway** - Already installed and running on your computer
4. **A web browser** - Chrome, Edge, whatever you have

---

## Step 1: Get Node.js Installed

### Check if you already have Node.js:

1. Open a **terminal** on your Chromebook
   - Press `Ctrl + Alt + T` to open terminal
   
2. Type this and press Enter:
   ```bash
   node --version
   ```

3. **If you see a version number** (like `v18.0.0` or higher):
   - ✅ Great! Skip to Step 2
   
4. **If you see "command not found"**:
   - You need to install Node.js
   - Go to https://nodejs.org
   - Download the "LTS" version
   - Install it (just click Next/Next/Finish)
   - Restart your terminal and check again

---

## Step 2: Download the Project Files

You need to get these files from Replit to your Chromebook.

### Method A: Using Git (Recommended)

1. In your terminal, navigate to where you want the files:
   ```bash
   cd ~
   ```

2. Download the project:
   ```bash
   git clone https://github.com/YOUR_USERNAME/orderflow-ai.git
   ```
   
   **Note:** Replace with your actual GitHub URL, or use the Replit export option

### Method B: Download Manually

1. In Replit, click the three dots menu
2. Click "Download as zip"
3. Extract the zip file on your Chromebook
4. Remember where you put it (like `~/Downloads/orderflow-ai`)

---

## Step 3: Open the Project Folder

1. In your terminal, go to the project folder:
   ```bash
   cd ~/orderflow-ai
   ```
   
   **Replace `~/orderflow-ai` with wherever you put the files**

2. Check you're in the right place:
   ```bash
   ls
   ```
   
   You should see files like: `package.json`, `LOCAL_SETUP.md`, `start-local.sh`

---

## Step 4: Get Your Database URL from Replit

The system needs to connect to your database. Here's how to get the URL:

1. Open your Replit project in a web browser
2. Look at the left sidebar
3. Click the **lock icon** (Secrets)
4. Find **DATABASE_URL**
5. Click the **copy icon** next to it
6. Keep this copied somewhere safe (like a notepad file)

**It should look something like:**
```
postgresql://username:password@hostname/database
```

---

## Step 5: Create Your Configuration File

1. In your terminal (still in the project folder), type:
   ```bash
   cp .env.local.template .env.local
   ```

2. Now edit this file:
   ```bash
   nano .env.local
   ```

3. You'll see a template. **Change this line:**
   ```
   DATABASE_URL="postgresql://..."
   ```
   
   **Paste your DATABASE_URL** that you copied from Replit.

4. **The other values are already filled in:**
   - SAFETY_AUTH_KEY (already there)
   - IBKR_USERNAME (already there)
   - IBKR_PASSWORD (already there)
   
   **Leave them as they are!**

5. Save the file:
   - Press `Ctrl + X`
   - Press `Y` (yes, save)
   - Press `Enter`

---

## Step 6: Install Dependencies

Still in the terminal, in the project folder:

```bash
npm install
```

This will take 1-2 minutes. You'll see lots of text scrolling by. **This is normal!**

Wait until you see your cursor blinking again (meaning it's done).

---

## Step 7: Start the Trading System

### Terminal 1 - Start the Node.js Server

1. Make sure you're still in the project folder
2. Run:
   ```bash
   ./start-local.sh
   ```

3. **You should see:**
   ```
   ✅ Configuration loaded
   ✅ Database: postgresql://...
   🚀 Starting Node.js server on http://localhost:5000
   ```

4. **Leave this terminal window open!** Don't close it.

### Terminal 2 - Start the Python Bridge

1. Open a **NEW terminal window** (keep the first one running)
   - Press `Ctrl + Alt + T` again
   
2. Go to the project folder again:
   ```bash
   cd ~/orderflow-ai
   ```
   
   **Replace with your actual folder location**

3. Set environment variables:
   ```bash
   export SAFETY_AUTH_KEY="295d67de43a97a278f18d9891a2e7fc24fc829f37fd7dd357cd5dadfd9c03605"
   export IBKR_USERNAME="fredpaper74"
   export IBKR_PASSWORD='m!j8r5C%WF3W-#2'
   ```
   
   **Important:** Copy-paste these EXACTLY as shown (including the single quotes around password)

4. Run the Python bridge:
   ```bash
   python3 server/ibkr_bridge_local.py
   ```

5. **You should see:**
   ```
   🏎️  IBKR BRIDGE - LOCAL MODE
   🔗 Local URL: http://localhost:5000
   ✅ Connected to IBKR
   📊 Fetching historical data...
   🎯 Streaming market data...
   ```

6. **Leave this terminal open too!**

---

## Step 8: Open the Trading Interface

1. Open your web browser (Chrome, Edge, etc.)

2. Go to this address:
   ```
   http://localhost:5000
   ```

3. **You should see the F1 Command Center!**

---

## How to Know It's Working

### Check These Things:

1. **IBKR Connection Status:**
   - Should say "IBKR Connected" (green)
   
2. **ES Price:**
   - Should show **real price** like 6760-6770 range
   - **NOT** 6002 (that's mock data - means it's not working)

3. **CVA Values:**
   - Should show VAH around 6899
   - POC around 6872
   - VAL around 6822

4. **Terminal Windows:**
   - First terminal (Node.js): Should show logs like "WebSocket connected"
   - Second terminal (Python): Should show ticks coming in like "Tick: 6765.25"

---

## If Something Goes Wrong

### Problem: "Cannot connect to database"
- Check your DATABASE_URL in `.env.local` is correct
- Make sure you copied the FULL URL from Replit

### Problem: "IBKR Bridge disconnected"
- Make sure IB Gateway is running on port 4002
- Check IB Gateway shows "Connected" status

### Problem: Node.js server won't start
- Check you ran `npm install` first
- Check you're in the right folder
- Check `.env.local` file exists

### Problem: Still stuck?
Post the error message you see in the terminal and I'll help you fix it.

---

## How to Stop Everything

### To Stop for the Day:

1. **In Terminal 1** (Node.js server):
   - Press `Ctrl + C`
   
2. **In Terminal 2** (Python bridge):
   - Press `Ctrl + C`

3. **Close IB Gateway** (optional)

### To Start Again Tomorrow:

1. Open IB Gateway (if closed)
2. Open Terminal 1, run: `./start-local.sh`
3. Open Terminal 2, run the 3 export commands + Python bridge
4. Open browser to `http://localhost:5000`

---

## What Happens When a Trade Setup Appears?

When the system sees a 75%+ confidence setup:

1. **You'll see in Terminal 1 (Node.js):**
   ```
   [AUTO-TRADE] 🎯 EXECUTING: VA BREAKOUT SHORT @ 6752 (75% confidence)
   ```

2. **You'll see in Terminal 2 (Python):**
   ```
   📝 Order placed: SELL 1 MES
   ✅ Order filled at 6752.25
   ```

3. **You'll see on the website:**
   - Position changes from 0 to -1
   - Trade appears in trade history
   - P&L starts updating

---

## Quick Reference Card

**Start System:**
```bash
# Terminal 1
cd ~/orderflow-ai
./start-local.sh

# Terminal 2 (new window)
cd ~/orderflow-ai
export SAFETY_AUTH_KEY="295d67de43a97a278f18d9891a2e7fc24fc829f37fd7dd357cd5dadfd9c03605"
export IBKR_USERNAME="fredpaper74"
export IBKR_PASSWORD='m!j8r5C%WF3W-#2'
python3 server/ibkr_bridge_local.py

# Browser
http://localhost:5000
```

**Stop System:**
```bash
# Press Ctrl+C in both terminals
```

---

That's it! You're now running everything locally with no dev/production confusion.
