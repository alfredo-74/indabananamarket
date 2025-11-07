# IBKR Bridge Reconnection Test Guide

## Prerequisites
1. **IB Gateway running** on port 4002 (paper trading)
2. **Environment variables set** in your terminal:
   ```bash
   export DATABASE_URL="postgresql://..."
   export SAFETY_AUTH_KEY="295d67de43a97a278f18d9891a2e7fc24fc829f37fd7dd357cd9dadfd9c03605"
   export SESSION_SECRET="your-secret"
   export IBKR_USERNAME="fredpaper74"
   export IBKR_PASSWORD="m!j8r5C%WF3W-#2"
   ```

## Test 1: Initial Connection (10-Retry Logic)

### Steps:
1. Make sure IB Gateway is **NOT** running
2. From `~/Bananas` directory, run:
   ```bash
   ./start.sh
   ```

### Expected Behavior:
```
✅ Environment variables validated
✅ Node.js server started (PID: xxxxx)
✅ Server responding on http://localhost:5000
🔌 Starting IBKR Bridge (AUTO-RECONNECT ENABLED)
Connecting to IB Gateway on port 4002...
❌ Connection failed: [Errno 111] Connection refused
⏳ Waiting 1s before retry...
🔄 Retry attempt 1/10...
❌ Connection failed: [Errno 111] Connection refused
⏳ Waiting 2s before retry...
🔄 Retry attempt 2/10...
```

### Action:
1. While bridge is retrying, **start IB Gateway**
2. Bridge should automatically connect on next retry

### Success Criteria:
- ✅ Bridge retries up to 10 times with exponential backoff (1s, 2s, 4s, 8s, 16s, 30s max)
- ✅ Connects successfully when IB Gateway becomes available
- ✅ Shows "✅ CONNECTED to IBKR Paper Trading"

---

## Test 2: Auto-Reconnect (Connection Loss Recovery)

### Steps:
1. With bridge running and connected, **close IB Gateway**

### Expected Behavior:
```
❌ DISCONNECTED - IBKR connection lost
⚠️ Connection lost - attempting reconnect...
👋 Disconnected from IBKR
⏳ Waiting 5s before full reconnect attempt 1...
Connecting to IB Gateway on port 4002...
❌ Connection failed: [Errno 111] Connection refused
⏳ Waiting 5s before full reconnect attempt 2...
```

### Action:
1. While bridge is reconnecting, **restart IB Gateway**
2. Bridge should automatically reconnect

### Success Criteria:
- ✅ Bridge detects connection loss immediately
- ✅ Attempts reconnection in infinite loop (max 999 attempts)
- ✅ Reconnects when IB Gateway becomes available again
- ✅ Resumes data streaming without manual intervention

---

## Test 3: VWAP Green Indicator (30s Timeout Fix)

### Steps:
1. With bridge connected, open browser to `http://localhost:5000`
2. Observe VWAP indicator in F1 Command Center

### Expected Behavior:
- **Immediately after bridge connects**: VWAP indicator should be **GREEN**
- **Status should show**: "IBKR Bridge: Connected"
- **VWAP value should display**: Not "N/A" or "—"

### Success Criteria:
- ✅ VWAP turns green within 5 seconds of bridge connection
- ✅ VWAP value calculated from historical bars (7 days by default)
- ✅ No 30-second delay before VWAP appears
- ✅ Connection indicator stays green as long as bridge is connected

---

## Test 4: Connection State Logging

### Monitor Log Messages:

**Initial Connection:**
```
✅ CONNECTED to IBKR Paper Trading
✅ ES display contract: 202512
✅ MES trading contract: 202512
🚀 Starting real-time data stream...
```

**Connection Loss:**
```
❌ DISCONNECTED - IBKR connection lost
⚠️ Connection lost - attempting reconnect...
```

**Reconnection:**
```
🔄 Retry attempt 1/10...
✅ CONNECTED to IBKR Paper Trading
```

### Success Criteria:
- ✅ Clear state messages: CONNECTED / DISCONNECTED / RETRYING
- ✅ No cryptic error messages during normal operations
- ✅ Logs show current reconnection attempt number

---

## Test 5: Full System Stability (15-Minute Soak Test)

### Steps:
1. Leave system running for 15 minutes
2. Observe connection stability

### Expected Behavior:
- Bridge maintains connection without unexpected disconnects
- No false "connection lost" messages
- VWAP stays green throughout test period

### Success Criteria:
- ✅ No false disconnects due to network timeouts
- ✅ 30-second bridge timeout prevents false connection loss alerts
- ✅ Data continues streaming for entire 15-minute period

---

## Troubleshooting

### Bridge Won't Connect
- ✅ Check IB Gateway is running on port 4002
- ✅ Verify IBKR credentials are correct
- ✅ Ensure no firewall blocking localhost:4002

### VWAP Stays Red
- ✅ Check browser console for errors
- ✅ Verify bridge is sending historical data (look for "Sent YYYY-MM-DD: X bars" messages)
- ✅ Ensure Node.js server received historical data (check server logs)

### Reconnection Fails
- ✅ Check IB Gateway is actually running
- ✅ Verify no other applications using port 4002
- ✅ Look for error messages in bridge logs

---

## Success Summary

All tests pass if:
1. ✅ Bridge retries connection 10 times with exponential backoff
2. ✅ Auto-reconnect works when IB Gateway restarts
3. ✅ VWAP turns green immediately (no 30s delay)
4. ✅ Clear state logging (CONNECTED/DISCONNECTED/RETRYING)
5. ✅ System remains stable for 15+ minutes

## Quick Test Command
```bash
# From ~/Bananas directory
./start.sh
```

Press `Ctrl+C` to stop both services gracefully.
