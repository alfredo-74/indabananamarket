# IB Gateway Bridge Setup Guide

This guide shows you how to connect your local IB Gateway (running on your ChromeOS) to your cloud trading system on Replit, so you get real market data from Interactive Brokers.

## How It Works

```
Your ChromeOS Computer          →          Replit Cloud
┌──────────────────┐                      ┌──────────────────┐
│  IB Gateway      │                      │  Trading System  │
│  (Paper Trading) │                      │  (Runs 24/7)     │
│  Port 4002       │                      │                  │
└────────┬─────────┘                      └────────┬─────────┘
         │                                         │
         │                                         │
    ┌────▼──────────┐                             │
    │ Bridge Script │────────HTTP Connection──────┘
    │ (Python)      │
    └───────────────┘
```

The bridge script runs on your computer and forwards price data from IB Gateway to Replit using simple HTTP requests.

**NEW:** The bridge now automatically detects the correct ES futures contract month - no manual updates needed!

## What You Need

1. **IB Gateway** installed on your ChromeOS
2. **Python 3** with two libraries: `ib_insync` and `requests`
3. **Your IBKR paper trading account** (username: fredpaper74)

## Step-by-Step Setup

### Step 1: Get Your SAFETY_AUTH_KEY (REQUIRED - New Security Feature)

**The production safety system now requires authentication** to prevent unauthorized access to trading controls.

1. **In Replit**, click **"Tools"** → **"Secrets"** in the left sidebar
2. Find the secret named `SAFETY_AUTH_KEY`
3. Click the **eye icon** to reveal the 64-character key
4. **Copy the entire key**

5. **Set it as an environment variable** on your ChromeOS/computer:

```bash
# In your Linux terminal (ChromeOS), run:
export SAFETY_AUTH_KEY="paste-your-64-character-key-here"
```

**IMPORTANT:** You must set this in the same terminal session where you run the bridge script!

**Why is this needed?** 
- Protects order confirmation tracking
- Prevents unauthorized safety fence deactivation  
- Secures trading configuration changes
- Required for real money trading safety

### Step 2: Install Python Libraries (One-Time Setup)

Open your Linux terminal on ChromeOS and create a virtual environment:

```bash
# Create virtual environment (only once)
python3 -m venv ibkr_env

# Activate it
source ibkr_env/bin/activate

# Install required packages
pip install ib_insync requests
```

### Step 3: Start IB Gateway

1. Open IB Gateway on your ChromeOS
2. Log in with:
   - **Username:** fredpaper74
   - **Password:** m!j8r5C%WF3W-#2
3. Select **Paper Trading** mode
4. Make sure it connects successfully

**Important:** Check that IB Gateway is set to port **4002** (paper trading):
- Click **Configure** → **Settings** → **API** → **Settings**
- Socket port should be: **4002** (paper trading) or **4001** (live trading)
- Check "Enable ActiveX and Socket Clients"
- Note: TWS uses ports 7497 (paper) / 7496 (live) - but IB Gateway uses 4002/4001

### Step 4: Download the Bridge Script

**IMPORTANT:** Use the **V2 bridge** (`ibkr_bridge_v2.py`) which includes production safety features!

1. In this Replit project, find the file `server/ibkr_bridge_v2.py`
2. Copy all the code from that file
3. On your ChromeOS, create a new file:
   ```bash
   nano ibkr_bridge_v2.py
   ```
4. Paste the code and save (Ctrl+X, then Y, then Enter)

### Step 5: Run the Bridge

**IMPORTANT:** Run these commands in order:

```bash
# 1. Activate virtual environment
source ibkr_env/bin/activate

# 2. Set your SAFETY_AUTH_KEY (copy from Replit Secrets!)
export SAFETY_AUTH_KEY="paste-your-64-character-key-here"

# 3. Run the bridge
python3 ibkr_bridge_v2.py
```

The bridge automatically connects to `https://inthabananamarket.replit.app`

**Important:** 
- Use `https://` (your regular Replit URL)
- Just copy it from your browser address bar - that's it!

## What You Should See

### When the Bridge Starts Successfully:

```
============================================================
IBKR BRIDGE - Real-time Data Forwarder
============================================================

🌐 Replit URL: https://ee197047-83ec-40d0-a112-c38e62a21590-00-2lvxbobtxixs9.kirk.replit.dev

Connecting to IB Gateway on 127.0.0.1:4002...
✓ Connected to IB Gateway
📅 Calculated front month contract: ES 202503
✓ Contract qualified: ES 202503
✓ Subscribed to ES market data
Connecting to Replit at https://...
✓ Connected to Replit trading system

============================================================
✓ BRIDGE ACTIVE - Forwarding ES data to Replit
Press Ctrl+C to stop
============================================================

📊 ES @ 6004.25 → Sent to Replit
📊 ES @ 6004.50 → Sent to Replit
```

### In Your Trading System:

- **System Status window** will show **green** "IBKR Connected"
- **ES price** will update with real market data
- Prices will match what you see in IB Gateway

## Troubleshooting

### "Connection refused" when connecting to IB Gateway

**Fix:**
- Make sure IB Gateway is running and logged in
- Check it's on port **4002** for paper trading (or 4001 for live)
- In IB Gateway settings, verify "Enable ActiveX and Socket Clients" is checked
- Note: IB Gateway uses port 4002 (paper) / 4001 (live), NOT TWS ports 7497/7496

### "Failed to connect to Replit"

**Fix:**
- The bridge automatically uses `https://inthabananamarket.replit.app`
- Verify your trading system is running on Replit
- Make sure you have internet connection

### "❌ SAFETY_AUTH_KEY not set"

**Fix:**
- Set the environment variable: `export SAFETY_AUTH_KEY="your-key"`
- Must be set in the same terminal where you run the bridge
- Copy the exact key from Replit Secrets (Tools → Secrets)

### "❌ Order confirmation UNAUTHORIZED"

**Fix:**
- Your SAFETY_AUTH_KEY doesn't match the server
- Get the correct key from Replit Secrets
- Make sure there are no extra spaces when copying

### No market data showing

**Fix:**
- The bridge will automatically find the front month ES contract
- Ensure you're logged into IB Gateway paper trading mode
- ES futures should have free delayed data
- Try restarting the bridge script

### "No security definition has been found"

**Don't worry!** The script has automatic fallback:
- It first tries to calculate the current front month
- If that fails, it lets IB Gateway auto-select the contract
- You should still see "✓ Subscribed to ES market data"

## Keeping the Bridge Running

**Each time you start the bridge:**

1. Open terminal on ChromeOS
2. Activate virtual environment: `source ibkr_env/bin/activate`
3. Set SAFETY_AUTH_KEY: `export SAFETY_AUTH_KEY="your-key"`
4. Run: `python3 ibkr_bridge_v2.py`
5. Keep terminal open while trading
6. Press Ctrl+C to stop

**Optional - Run in background:**
```bash
screen -S ibkr
source ibkr_env/bin/activate
export SAFETY_AUTH_KEY="your-64-character-key-here"
python3 ibkr_bridge_v2.py
```
- Press Ctrl+A then D to detach
- To check it later: `screen -r ibkr`

**Pro Tip:** Save the key in a file (`.ibkr_env`) and source it:
```bash
echo 'export SAFETY_AUTH_KEY="your-key"' > ~/.ibkr_env
source ~/.ibkr_env
python3 ibkr_bridge_v2.py
```

## Automatic CVA Historical Data Recovery

**When you first run the bridge, it automatically:**
1. ✅ Fetches the last **7 days** of historical 5-minute bar data from IBKR (configurable)
2. ✅ Rebuilds daily Market Profile and Volume Profile for each day
3. ✅ Persists them to the database (survives server restarts)
4. ✅ Reconstructs the 5-day Composite Value Area (CVA)

This means **your CVA will be automatically recovered** the first time you connect the bridge! No manual intervention needed.

**Default behavior (7 days):**
```bash
python3 ibkr_bridge_v2.py
# Fetches last 7 days automatically
```

**Custom number of days:**
```bash
python3 ibkr_bridge_v2.py --historical-days 10
# Fetches last 10 days
```

**Skip historical fetch (for testing):**
```bash
python3 ibkr_bridge_v2.py --skip-historical
# Only streams real-time data, no historical fetch
```

**You'll see in the terminal:**
```
📊 Historical data: 7 days
📊 Fetching 7 days of historical data...
✅ Received 2184 bars
✅ Sent 2025-10-31: 312 bars
✅ Sent 2025-11-01: 312 bars
✅ Sent 2025-11-04: 312 bars
✅ Sent 2025-11-05: 312 bars
✅ Sent 2025-11-06: 312 bars
✅ Sent 2025-11-07: 312 bars
✅ Sent 2025-11-08: 312 bars
🎉 Historical data upload complete - 7 days sent
```

**In the trading system:**
- Daily profiles stored in database (check `/api/composite-profile`)
- CVA VAH, VAL, and POC populate immediately (5-day rolling window)
- All 7 PRO course systems have full context
- Value Migration detection activates
- CVA Stacking system builds 30-day historical archive

**Note:** The system uses the most recent 5 days for CVA calculation, but fetching 7 days ensures you have backup data and can recover from weekends/holidays.

## Normal Operation

### With Bridge Connected (Live Data):
- Green "IBKR Connected" indicator
- Real ES prices from IB Gateway (current front month contract)
- **5-day CVA automatically built from historical data**
- All trading algorithms use real market data with full context
- Auto-trading can execute real (paper) trades

### Without Bridge (Simulated Data):
- Yellow/Red connection indicator  
- Simulated price movements
- **No CVA data** (requires real historical bars from IBKR)
- Algorithms still work for testing (using simulated profiles)
- No real market data required

Both modes work - the system adapts automatically!

## Security Note

The bridge only **reads** market data from IB Gateway. It doesn't execute trades directly. All trading happens through your Replit system controls.

Your IBKR password is only used on your local computer and never sent to Replit.

## Need Help?

If something isn't working:

1. Check the terminal output for error messages
2. Verify IB Gateway is logged in and active (port 4002 for paper trading)
3. Make sure you're using `https://` URL format (copy from browser)
4. Activate virtual environment: `source ibkr_env/bin/activate`
5. Try restarting both IB Gateway and the bridge script
