# IB Gateway Bridge Setup Guide

This guide shows you how to connect your local IB Gateway (running on your ChromeOS) to your cloud trading system on Replit, so you get real market data from Interactive Brokers.

## How It Works

```
Your ChromeOS Computer          →          Replit Cloud
┌──────────────────┐                      ┌──────────────────┐
│  IB Gateway      │                      │  Trading System  │
│  (Paper Trading) │                      │  (Runs 24/7)     │
│  Port 7497       │                      │                  │
└────────┬─────────┘                      └────────┬─────────┘
         │                                         │
         │                                         │
    ┌────▼──────────┐                             │
    │ Bridge Script │─────WebSocket Connection────┘
    │ (Python)      │
    └───────────────┘
```

The bridge script runs on your computer and forwards price data from IB Gateway to Replit.

**NEW:** The bridge now automatically detects the correct ES futures contract month - no manual updates needed!

## What You Need

1. **IB Gateway** installed on your ChromeOS
2. **Python 3** with two libraries: `ib_insync` and `websockets`
3. **Your IBKR paper trading account** (username: fredpaper74)

## Step-by-Step Setup

### Step 1: Install Python Libraries (One-Time Setup)

Open your Linux terminal on ChromeOS and create a virtual environment:

```bash
# Create virtual environment (only once)
python3 -m venv ibkr_env

# Activate it
source ibkr_env/bin/activate

# Install required packages
pip install ib_insync websockets
```

### Step 2: Start IB Gateway

1. Open IB Gateway on your ChromeOS
2. Log in with:
   - **Username:** fredpaper74
   - **Password:** m!j8r5C%WF3W-#2
3. Select **Paper Trading** mode
4. Make sure it connects successfully

**Important:** Check that IB Gateway is set to port **7497**:
- Click **Configure** → **Settings** → **API** → **Settings**
- Socket port should be: **7497**
- Check "Enable ActiveX and Socket Clients"

### Step 3: Download the Bridge Script

1. In this Replit project, find the file `ibkr_bridge_download.py`
2. Copy all the code from that file
3. On your ChromeOS, create a new file:
   ```bash
   nano ibkr_bridge_download.py
   ```
4. Paste the code and save (Ctrl+X, then Y, then Enter)

### Step 4: Run the Bridge

Make sure your virtual environment is activated:

```bash
source ibkr_env/bin/activate
```

Then run the bridge with your Replit URL:

```bash
python3 ibkr_bridge_download.py wss://ee197047-83ec-40d0-a112-c38e62a21590-00-2lvxbobtxixs9.kirk.replit.dev/bridge
```

**Important:** 
- Use `wss://` (not `https://`)
- Add `/bridge` at the end
- Use your actual Replit URL from your browser address bar

## What You Should See

### When the Bridge Starts Successfully:

```
============================================================
IBKR BRIDGE - Real-time Data Forwarder
============================================================

📝 Using IB Gateway credentials from environment
🌐 Replit URL: wss://ee197047-83ec-40d0-a112-c38e62a21590-00-2lvxbobtxixs9.kirk.replit.dev/bridge

Connecting to IB Gateway on 127.0.0.1:7497...
✓ Connected to IB Gateway
📅 Calculated front month contract: ES 202503
✓ Contract qualified: ES 202503
✓ Subscribed to ES market data
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
- Check it's on port **7497** (not 7496 or 4002)
- In IB Gateway settings, verify "Enable ActiveX and Socket Clients" is checked

### "ERROR: URL must start with wss://"

**Fix:**
- Use `wss://` instead of `https://`
- Correct format: `wss://your-project.replit.dev/bridge`

### "server rejected WebSocket connection: HTTP 400"

**Fix:**
- Make sure your Replit URL is correct
- Check it ends with `/bridge`
- Verify your trading system is running on Replit

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
3. Run: `python3 ibkr_bridge_download.py wss://[your-url]/bridge`
4. Keep terminal open while trading
5. Press Ctrl+C to stop

**Optional - Run in background:**
```bash
screen -S ibkr
source ibkr_env/bin/activate
python3 ibkr_bridge_download.py wss://[your-url]/bridge
```
- Press Ctrl+A then D to detach
- To check it later: `screen -r ibkr`

## Normal Operation

### With Bridge Connected (Live Data):
- Green "IBKR Connected" indicator
- Real ES prices from IB Gateway (current front month contract)
- All trading algorithms use real market data
- Auto-trading can execute real (paper) trades

### Without Bridge (Simulated Data):
- Yellow/Red connection indicator  
- Simulated price movements
- Algorithms still work for testing
- No real market data required

Both modes work - the system adapts automatically!

## Security Note

The bridge only **reads** market data from IB Gateway. It doesn't execute trades directly. All trading happens through your Replit system controls.

Your IBKR password is only used on your local computer and never sent to Replit.

## Need Help?

If something isn't working:

1. Check the terminal output for error messages
2. Verify IB Gateway is logged in and active (port 7497)
3. Make sure you're using `wss://` URL format with `/bridge` at the end
4. Activate virtual environment: `source ibkr_env/bin/activate`
5. Try restarting both IB Gateway and the bridge script
