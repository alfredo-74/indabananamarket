# OrderFlowAI - Quick Start Checklist

Print this out or keep it on your screen while setting up!

---

## ☐ BEFORE YOU START

- [ ] IB Gateway is running and showing "Connected"
- [ ] You have Node.js installed (`node --version` shows v18 or higher)
- [ ] You have the project files on your Chromebook

---

## ☐ ONE-TIME SETUP (Do Once)

### 1. Get Your Database URL
- [ ] Open Replit in browser
- [ ] Click lock icon (Secrets) in left sidebar
- [ ] Copy the DATABASE_URL value
- [ ] Save it in a notepad file

### 2. Create Configuration File
- [ ] Open terminal
- [ ] Go to project folder: `cd ~/orderflow-ai`
- [ ] Copy template: `cp .env.local.template .env.local`
- [ ] Edit file: `nano .env.local`
- [ ] Paste your DATABASE_URL
- [ ] Save: Ctrl+X, then Y, then Enter

### 3. Install Dependencies
- [ ] In terminal: `npm install`
- [ ] Wait 1-2 minutes for it to finish

---

## ☐ EVERY DAY STARTUP

### Terminal 1 - Start Server
```bash
cd ~/orderflow-ai
./start-local.sh
```
- [ ] See "🚀 Starting Node.js server"
- [ ] Leave this window open

### Terminal 2 - Start Bridge
Open NEW terminal, then:
```bash
cd ~/orderflow-ai
export SAFETY_AUTH_KEY="295d67de43a97a278f18d9891a2e7fc24fc829f37fd7dd357cd5dadfd9c03605"
export IBKR_USERNAME="fredpaper74"
export IBKR_PASSWORD='m!j8r5C%WF3W-#2'
python3 server/ibkr_bridge_local.py
```
- [ ] See "✅ Connected to IBKR"
- [ ] See "🎯 Streaming market data"
- [ ] Leave this window open

### Browser - Open Interface
- [ ] Open browser
- [ ] Go to: `http://localhost:5000`
- [ ] See F1 Command Center
- [ ] Check "IBKR Connected" is green
- [ ] Check ES price is in 6750-6770 range (not 6002)

---

## ☐ VERIFY IT'S WORKING

Check these 3 things:

1. **Connection Status**
   - [ ] "IBKR Connected" shows green

2. **Real Data**
   - [ ] ES price is around 6760 (not 6002)
   - [ ] Price updates every second

3. **CVA Loaded**
   - [ ] VAH shows ~6899
   - [ ] POC shows ~6872
   - [ ] VAL shows ~6822

---

## ☐ WHEN YOU'RE DONE

1. Terminal 1: Press `Ctrl + C`
2. Terminal 2: Press `Ctrl + C`
3. Close browser tab
4. (Optional) Close IB Gateway

---

## 🆘 HELP - Common Problems

**"Cannot connect to database"**
→ Check DATABASE_URL in .env.local

**"IBKR Bridge disconnected"**
→ Make sure IB Gateway is running on port 4002

**Price shows 6002 (mock data)**
→ Python bridge isn't running or isn't connected

**"Command not found" errors**
→ Make sure you're in the right folder (`cd ~/orderflow-ai`)

---

## 📞 Need Help?

If you get stuck:
1. Take a screenshot of the error
2. Copy the error text from terminal
3. Ask for help with the specific error message

---

## 🎯 What Success Looks Like

When everything is working, you'll see:
- ✅ Two terminal windows with green checkmarks
- ✅ Browser showing real ES prices updating
- ✅ CVA values displayed
- ✅ "IBKR Connected" in green

When a trade setup appears:
- 🎯 Terminal 1 shows: "EXECUTING: VA BREAKOUT SHORT"
- 📝 Terminal 2 shows: "Order placed: SELL 1 MES"
- 💰 Browser shows position change and P&L

---

**You're all set! The system will auto-trade on 75%+ confidence setups.**
