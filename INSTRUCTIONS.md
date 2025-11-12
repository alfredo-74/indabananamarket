# Quick Reference Guide - OrderFlowAI Trading System

**Fast command lookup for daily operations, IB Gateway management, and Git workflows**

---

## 🔧 IB Gateway Management (ChromeOS Flex)

### Remove Old Installation

```bash
# 1. Find existing installation
ls -la ~/Jts/
ls -la ~/.local/share/Jts/

# 2. Stop any running instances
pkill -f ibgateway
pkill -f java.*ibgateway

# 3. Remove installation directories
rm -rf ~/Jts
rm -rf ~/.local/share/Jts

# 4. Remove desktop shortcuts (if any)
rm -f ~/.local/share/applications/ibgateway*.desktop
rm -f ~/Desktop/IB\ Gateway*

# 5. Clean up configuration
rm -rf ~/.config/ibgateway

# 6. Verify removal
ps aux | grep ibgateway  # Should show nothing
```

### Fresh Installation

```bash
# 1. Install dependencies
sudo apt update
sudo apt install -y openjdk-17-jdk xvfb x11vnc curl unzip \
  libxtst6 libxrender1 libxi6 libgtk-3-0

# 2. Verify Java installation
java -version  # Should show version 11+ (17 recommended)

# 3. Download IB Gateway (stable version recommended)
cd ~
curl -o ibgateway-stable.sh \
  https://download.interactivebrokers.com/installers/ibgateway/stable-standalone/ibgateway-stable-standalone-linux-x64.sh

# 4. Make installer executable
chmod +x ibgateway-stable.sh

# 5. Run installer with virtual display (ChromeOS)
Xvfb :1 -ac -screen 0 1024x768x24 &
export DISPLAY=:1
./ibgateway-stable.sh

# 6. Installation completes at ~/Jts/ibgateway/
```

### Launch IB Gateway

```bash
# Standard launch (ChromeOS - requires virtual display)
Xvfb :1 -ac -screen 0 1024x768x24 &
export DISPLAY=:1
~/Jts/ibgateway/*/ibgateway &

# With VNC access for remote GUI
x11vnc -display :1 -forever -shared -bg
# Then connect VNC viewer to localhost:5900

# Verify running
ps aux | grep ibgateway
netstat -an | grep 4001  # Should show LISTEN
```

### Configure IB Gateway API Access

**First-time setup after launch**:

1. Click Configure → Settings → API → Settings
2. Enable options:
   - ✅ Enable ActiveX and Socket Clients
   - ✅ Allow connections from localhost only
   - ⬜ Read-Only API (unchecked for trading)
3. Set Socket Port: **4002** (Gateway) or **4001** (TWS)
4. Click OK and restart IB Gateway

### Stop IB Gateway

```bash
# Graceful shutdown
pkill -f ibgateway

# Force kill if needed
pkill -9 -f ibgateway

# Stop virtual display
pkill Xvfb
```

---

## 🚀 Server Operations

### Start Development Server

```bash
# Method 1: Local ChromeOS
cd ~/indabananamarket  # or your project directory
npm run dev

# Method 2: Using start script (if available)
./start.sh

# Server starts at http://localhost:3000
```

### Production Server

```bash
# Build production assets
npm run build

# Start production server
npm run start

# Or use PM2 for process management
npm install -g pm2
pm2 start dist/index.js --name orderflow-trading
pm2 save
pm2 startup  # Enable auto-start on reboot
```

### Restart Server (Replit)

**Workflow**: "Start application" workflow auto-restarts after code changes

**Manual restart**:
1. Stop workflow in Replit UI
2. Click "Run" or restart "Start application" workflow

### Check Server Status

```bash
# Check if server is running
curl http://localhost:3000/api/status

# Check IBKR connection status
curl http://localhost:3000/api/status | grep ibkr_connected

# View running processes
ps aux | grep "tsx server/index.ts"

# Check port usage
netstat -an | grep 3000
```

### View Logs

```bash
# Follow development logs
npm run dev  # Logs to console

# Production logs with PM2
pm2 logs orderflow-trading

# System logs (if using systemd)
journalctl -u orderflow-trading -f
```

---

## 📦 Package Management

### Install New Package

```bash
# Production dependency
npm install package-name

# Development dependency
npm install -D package-name

# Python dependency
pip install package-name
```

### Update Dependencies

```bash
# Update all npm packages
npm update

# Update specific package
npm install package-name@latest

# Check for outdated packages
npm outdated
```

### Reinstall Dependencies

```bash
# Clean reinstall
rm -rf node_modules package-lock.json
npm install

# Python dependencies
pip install -r requirements.txt --upgrade
```

---

## 🗄️ Database Operations

### Schema Management

```bash
# Push schema changes to database (safe)
npm run db:push

# Force push (bypasses data-loss warnings)
npm run db:push --force

# Run TypeScript type checking
npm run check
```

### Backup & Restore

```bash
# Create backup
pg_dump -U postgres indabananamarket > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql -U postgres indabananamarket < backup_20251111_120000.sql

# Backup specific tables
pg_dump -U postgres -t trades -t positions indabananamarket > trades_backup.sql
```

### Database Access

```bash
# Connect to database
psql -U postgres -d indabananamarket

# Common queries
SELECT * FROM trades ORDER BY timestamp DESC LIMIT 10;
SELECT * FROM positions WHERE contracts != 0;
SELECT * FROM system_status ORDER BY timestamp DESC LIMIT 1;

# Exit psql
\q
```

### Database Maintenance

```bash
# Check database size
psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('indabananamarket'));"

# Vacuum database
psql -U postgres -d indabananamarket -c "VACUUM ANALYZE;"

# Reset database (DANGER - deletes all data)
psql -U postgres -c "DROP DATABASE indabananamarket;"
psql -U postgres -c "CREATE DATABASE indabananamarket;"
npm run db:push --force
```

---

## 🔄 Git Workflows

### Pull Latest Changes

```bash
# Local ChromeOS
cd ~/indabananamarket
git pull origin main

# Replit
# Use Git pane → Pull button
# OR Shell tab: git pull origin main
```

### Commit and Push Changes

```bash
# Check status
git status

# Stage all changes
git add .

# Commit with message
git commit -m "Description of changes"

# Push to GitHub
git push origin main
```

### Sync Between Platforms

**Local → GitHub → Replit**:
```bash
# 1. On local ChromeOS
git add .
git commit -m "Local changes"
git push origin main

# 2. On Replit
# Click Git pane → Pull button
# OR run in Shell: git pull origin main
```

**Replit → GitHub → Local**:
```bash
# 1. On Replit
# Git pane → Commit & Push

# 2. On local ChromeOS
cd ~/indabananamarket
git pull origin main
```

### Resolve Conflicts

```bash
# Pull with conflicts
git pull origin main

# View conflicted files
git status

# Edit files to resolve conflicts
# Then stage and commit
git add .
git commit -m "Resolved merge conflicts"
git push origin main
```

### Undo Changes

```bash
# Discard local changes (unstaged)
git checkout -- filename.ts

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Revert to specific commit
git reset --hard commit-hash
```

---

## 🔐 Environment Management

### Setup Environment Variables

```bash
# Copy example file
cp .env.example .env

# Edit with your credentials
nano .env  # or use your preferred editor

# Required variables:
# DATABASE_URL=postgresql://postgres:password@localhost:5432/indabananamarket
# SESSION_SECRET=your-random-secret-key
# IBKR_USERNAME=your-ibkr-username
# IBKR_PASSWORD=your-ibkr-password
# SAFETY_AUTH_KEY=your-safety-auth-key
# NODE_ENV=development
```

### Verify Environment

```bash
# Check environment variables are loaded
npm run dev  # Should not show "missing variables" errors

# Test database connection
psql -U postgres -d indabananamarket -c "SELECT 1;"

# Test IBKR credentials (after starting server)
curl http://localhost:3000/api/status
```

---

## 🛡️ Safety & Emergency Commands

### Check Auto-Trading Status

```bash
# Get status
curl http://localhost:3000/api/auto-trading/status

# Enable auto-trading
curl -X POST http://localhost:3000/api/auto-trading/enable \
  -H "X-Safety-Auth: your-safety-key"

# Disable auto-trading (EMERGENCY)
curl -X POST http://localhost:3000/api/auto-trading/disable \
  -H "X-Safety-Auth: your-safety-key"
```

### Check Position

```bash
# Current position
curl http://localhost:3000/api/position

# Recent trades
curl http://localhost:3000/api/trades
```

### Safety Manager Status

```bash
# Get safety configuration
curl http://localhost:3000/api/safety/status \
  -H "X-Safety-Auth: your-safety-key"

# Update safety settings
curl -X POST http://localhost:3000/api/safety/configure \
  -H "Content-Type: application/json" \
  -H "X-Safety-Auth: your-safety-key" \
  -d '{
    "max_position_size": 1,
    "trading_fence_enabled": true,
    "circuit_breaker_enabled": true
  }'
```

### Emergency Shutdown

```bash
# 1. Disable auto-trading
curl -X POST http://localhost:3000/api/auto-trading/disable \
  -H "X-Safety-Auth: your-safety-key"

# 2. Stop server
pkill -f "tsx server/index.ts"
# OR if using PM2
pm2 stop orderflow-trading

# 3. Close positions manually via IB Gateway/TWS
```

---

## 📊 Testing & Debugging

### API Endpoint Testing

```bash
# Market data
curl http://localhost:3000/api/market-data

# Volume profile
curl http://localhost:3000/api/volume-profile

# Order flow signals
curl http://localhost:3000/api/orderflow-signals

# Value migration
curl http://localhost:3000/api/value-migration

# Trade recommendations
curl http://localhost:3000/api/trade-recommendations
```

### Check Logs for Errors

```bash
# Development mode (stdout)
npm run dev 2>&1 | grep ERROR

# Production mode with PM2
pm2 logs orderflow-trading --lines 100 | grep ERROR

# Check for specific issues
grep "IBKR" ~/.pm2/logs/orderflow-trading-out.log
grep "database" ~/.pm2/logs/orderflow-trading-error.log
```

### WebSocket Testing

```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:3000

# Should receive real-time updates
```

---

## 🔍 System Diagnostics

### Check All Services

```bash
# PostgreSQL
systemctl status postgresql
psql -U postgres -c "SELECT version();"

# Node.js
node --version  # Should be 20+

# Python
python3 --version  # Should be 3.11+
pip list | grep ib-insync

# IB Gateway
ps aux | grep ibgateway
netstat -an | grep 4001

# Server
curl http://localhost:3000/api/status
```

### Performance Monitoring

```bash
# System resources
htop

# Database connections
psql -U postgres -d indabananamarket -c "SELECT count(*) FROM pg_stat_activity;"

# Network connections
netstat -an | grep ESTABLISHED
```

---

## 📝 Quick Troubleshooting

### Server Won't Start
```bash
# Check port 3000 is free
netstat -an | grep 3000
# If occupied, kill process
lsof -ti:3000 | xargs kill -9

# Check environment variables
cat .env | grep DATABASE_URL

# Reinstall dependencies
rm -rf node_modules && npm install
```

### IB Gateway Connection Failed
```bash
# Verify IB Gateway running
ps aux | grep ibgateway

# Check API enabled
# Open IB Gateway → Configure → Settings → API

# Test port
telnet localhost 4001  # Should connect

# Restart bridge
pkill -f ibkr_connector.py
# Server will auto-restart bridge
```

### Database Connection Error
```bash
# Test PostgreSQL
psql -U postgres -d indabananamarket -c "SELECT 1;"

# Check DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://postgres:password@localhost:5432/indabananamarket

# Restart PostgreSQL
sudo systemctl restart postgresql
```

---

## 📚 Additional Resources

- **README.md**: System overview and architecture
- **replit.md**: Replit-specific operational notes
- **IB Gateway Docs**: https://interactivebrokers.github.io/tws-api/
- **PostgreSQL Docs**: https://www.postgresql.org/docs/

---

**Last Updated**: November 2025  
**Platform**: ChromeOS Flex / Replit  
**For Support**: Review README.md troubleshooting section
