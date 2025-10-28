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

## What You Need

1. **IB Gateway** installed on your ChromeOS
2. **Python 3** with two libraries: `ib_insync` and `websockets`
3. **Your IBKR paper trading account** (username: fredpaper74)

## Step-by-Step Setup

### Step 1: Install Python Libraries

Open your Linux terminal on ChromeOS and run:

```bash
pip3 install ib_insync websockets
```

If that doesn't work, try:

```bash
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

Download the file `ibkr_bridge_download.py` from this Replit project to your ChromeOS.

You can copy the code from the file in this project and save it to your Downloads folder.

### Step 4: Find Your Replit URL

Your trading system is running at a URL like:

```
https://[something].replit.dev
```

Look in your browser address bar when you're viewing the trading system - copy that full URL.

### Step 5: Run the Bridge

In your Linux terminal on ChromeOS:

1. Navigate to where you saved the bridge script:
   ```bash
   cd ~/Downloads
   ```

2. Run the script with your Replit URL:
   ```bash
   python3 ibkr_bridge_download.py wss://[your-replit-url].replit.dev/bridge
   ```

**Example:**
```bash
python3 ibkr_bridge_download.py wss://ee197047-83ec-40d0-a112-c38e62a21590-00-2lvxbobtxixs9.replit.dev/bridge
```

Note: Change `https://` to `wss://` and add `/bridge` at the end!

## What You Should See

### When the Bridge Starts Successfully:

In your terminal, you'll see:

```
Connecting to IB Gateway at localhost:7497...
✓ Connected to IB Gateway
✓ Connected to Replit
Streaming market data...
ES @ 6004.25 → Sent to Replit
ES @ 6004.50 → Sent to Replit
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

### "WebSocket connection failed"

**Fix:**
- Double-check your Replit URL is correct
- Make sure you used `wss://` (not `https://`)
- Make sure you added `/bridge` at the end
- Check your Replit app is running (refresh the page)

### No market data showing

**Fix:**
- Ensure you're logged into IB Gateway paper trading mode
- ES futures should have free delayed data
- Try restarting the bridge script

### Bridge keeps disconnecting

**Fix:**
- Check your internet connection
- Keep the browser tab with your trading system open
- IB Gateway sometimes needs to be restarted

## Keeping the Bridge Running

The bridge needs to stay running to get live data. Here are two options:

**Option 1: Simple (Keep Terminal Open)**
- Just leave the terminal window open
- Press Ctrl+C to stop it when you're done

**Option 2: Run in Background**
```bash
screen -S ibkr
python3 ibkr_bridge_download.py wss://[your-url]/bridge
```
- Press Ctrl+A then D to detach
- To check it later: `screen -r ibkr`

## Normal Operation

### With Bridge Connected (Live Data):
- Green "IBKR Connected" indicator
- Real ES prices from IB Gateway
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
2. Verify IB Gateway is logged in and active
3. Make sure you're using the correct Replit URL with `wss://` and `/bridge`
4. Try restarting both IB Gateway and the bridge script
