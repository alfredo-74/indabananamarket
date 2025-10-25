# IBKR Local Bridge Setup

This script runs on **your local computer** and forwards market data from IB Gateway to your Replit trading system.

## Prerequisites

1. **IB Gateway** running on your computer
2. **Python 3** installed on your computer
3. **ib_insync** library installed

## Step 1: Install Required Library

Open a terminal/command prompt on your computer and run:

```bash
pip install ib-insync requests
```

## Step 2: Configure IB Gateway

1. Open IB Gateway and log in with your **paper trading account**
2. Go to **Configure → Settings → API → Settings**
3. Make sure these are set:
   - ✓ Enable ActiveX and Socket Clients
   - ✓ Socket port: **4002**
   - ✓ **Uncheck** "Allow connections from localhost only" (you already did this)

## Step 3: Get Your Replit URL

Your Replit app URL is shown in the browser address bar. It looks like:
```
https://xxxxxxxxx.replit.dev
```

Copy this URL - you'll need it in the next step.

## Step 4: Run the Bridge Script

1. Download the `ibkr_local_bridge.py` file from this Replit to your computer
2. Open a terminal/command prompt on your computer
3. Navigate to where you saved the file
4. Run:
   ```bash
   python ibkr_local_bridge.py
   ```
5. When prompted, paste your Replit URL

## What You Should See

If everything works correctly, you'll see:

```
============================================================
IBKR Local Bridge - Connects IB Gateway to Replit
============================================================

Enter your Replit app URL: https://xxxxx.replit.dev

Connecting to IB Gateway on localhost:4002...
✓ Connected to IB Gateway!
✓ Account Balance: $1,000,000.00
✓ ES Contract: 202503
✓ MES Contract: 202503
✓ Subscribed to ES market data

📊 Streaming market data to Replit...

ES: $6003.50 | Sent to Replit
```

## Troubleshooting

### "Connection refused" error
- Make sure IB Gateway is running and logged in
- Check that the port in IB Gateway is set to **4002**
- Verify "Enable ActiveX and Socket Clients" is checked

### "Invalid URL" error
- Make sure you copied the full URL including `https://`
- Don't include anything after `.replit.dev`

### Data not showing in Replit
- Check that your Replit app is running (green indicator)
- Refresh your browser on the Replit app
- The IBKR badge in the header should turn green when connected

## Keeping It Running

- Keep this terminal window open while trading
- The script will continue running until you press Ctrl+C
- If it disconnects, just run it again

## Security Note

This script only **reads** market data from IB Gateway. It does not execute trades without your explicit permission through the Replit interface.
