# OrderFlowAI Trading System - Replit Workspace Notes

> **For comprehensive system documentation, see [README.md](./README.md)**  
> **For command quick-reference, see [INSTRUCTIONS.md](./INSTRUCTIONS.md)**

This file contains Replit-specific operational notes and development workflows.

---

## Quick Start on Replit

### Running the Application

The **"Start application"** workflow is configured to run:
```bash
npm run dev
```

This starts:
1. Express.js backend server (port 3000)
2. Vite frontend dev server
3. WebSocket server for real-time data streaming
4. Python IBKR bridge (auto-started by Node.js server)

**Access**: Click "Open website" or navigate to the Replit preview URL

### Environment Configuration

**Required Secrets** (set in Replit Secrets panel):
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Random secret for session encryption
- `IBKR_USERNAME` - Interactive Brokers username
- `IBKR_PASSWORD` - Interactive Brokers password
- `SAFETY_AUTH_KEY` - Authorization key for safety endpoints
- `NODE_ENV` - Set to `development`

**Database**: Uses Replit's built-in PostgreSQL database (automatically configured via `DATABASE_URL`)

---

## Replit-Specific Behaviors

### Automatic Workflow Restarts

The "Start application" workflow **automatically restarts** when you:
- Save changes to any `.ts`, `.tsx`, or `.py` file
- Install new npm packages
- Modify environment secrets

**Manual restart**: Stop and restart the "Start application" workflow via the Tools panel

### Git Integration

**Important**: Replit does NOT automatically pull from GitHub. You must manually sync:

1. **Pull from GitHub**:
   - Use Git pane → Pull button
   - OR run in Shell: `git pull origin main`

2. **Push to GitHub**:
   - Git pane → Stage files → Commit → Push
   - OR Shell commands:
     ```bash
     git add .
     git commit -m "Description"
     git push origin main
     ```

**Multi-platform workflow**:
- Local ChromeOS: `git push origin main`
- Replit: Use Git pane to pull changes
- Keep both environments synchronized manually

### WebSocket Connections

Replit uses a reverse proxy that may affect WebSocket connections. If you see WebSocket errors:
- Check the browser console for connection issues
- Verify the WebSocket URL uses the correct Replit domain
- Ensure `NODE_ENV=development` is set
- Try refreshing the preview window

### Port Binding

- **Backend**: Binds to `0.0.0.0:3000` (required for Replit)
- **Frontend**: Served via Vite on same port (proxied)
- **IB Gateway**: Connects to localhost:4001 or 4002 (not exposed externally)

---

## Development Workflow

### Making Code Changes

1. Edit files in the workspace
2. Workflow auto-restarts (watch console output)
3. Refresh preview to see changes
4. Commit and push to GitHub when stable

### Database Schema Changes

```bash
# Push schema changes
npm run db:push

# Force push (if data-loss warning)
npm run db:push --force

# TypeScript type checking
npm run check
```

### Installing Packages

**Node.js**:
```bash
npm install package-name
```

**Python**:
```bash
pip install package-name
# Then update pyproject.toml if needed
```

Workflow auto-restarts after package installation.

---

## Debugging on Replit

### Check Application Status

```bash
# API status endpoint
curl https://your-repl.replit.dev/api/status

# Check if IBKR bridge is connected
curl https://your-repl.replit.dev/api/status | grep ibkr_connected
```

### View Logs

- **Workflow Console**: Shows real-time server logs
- **Browser Console**: Shows frontend errors and WebSocket status
- **Shell Tab**: Run `npm run dev` to see full output

### Common Issues

**"Cannot find module" errors**:
- Run `npm install` in Shell
- Check `package.json` dependencies match local version

**Database connection errors**:
- Verify `DATABASE_URL` is set in Secrets
- Check database is running (Replit auto-manages PostgreSQL)

**IBKR connection fails**:
- IB Gateway must be running separately (not on Replit)
- Replit cannot run IB Gateway's GUI
- Use local ChromeOS or VPS for IB Gateway
- Python bridge will show "Disconnected" if Gateway unavailable

**WebSocket connection failed**:
- Check browser console for exact error
- Verify server is running (green indicator)
- Try hard refresh (Ctrl+Shift+R)

---

## Replit vs Local Development

| Feature | Replit | Local ChromeOS |
|---------|--------|----------------|
| **Development** | ✅ Full support | ✅ Full support |
| **IB Gateway** | ❌ Cannot run GUI | ✅ Native support |
| **Database** | ✅ Managed PostgreSQL | ✅ Local PostgreSQL |
| **Hot Reload** | ✅ Auto-restart | ✅ Auto-restart |
| **Git Sync** | ⚠️ Manual pull | ✅ Standard workflow |
| **Trading Hours** | ⚠️ High latency | ✅ Low latency |
| **Production** | ⚠️ Dev only | ⚠️ Not recommended |

**Recommendation**: 
- Use **Replit** for development and remote access
- Use **Local ChromeOS** for active trading hours (requires IB Gateway)
- Use **Fly.io/VPS** for production deployment

---

## User Preferences

- **Communication style**: Simple, everyday language
- **Documentation**: Prefer quick-reference guides over lengthy explanations
- **Platform**: Multi-platform development (ChromeOS Flex, Replit, GitHub sync)

---

## System Architecture Summary

**For full architecture details, see [README.md](./README.md)**

**Tech Stack**:
- Frontend: React 18, TypeScript, Vite, shadcn/ui, Tailwind CSS
- Backend: Node.js, Express.js, TypeScript, WebSockets
- Database: PostgreSQL with Drizzle ORM
- Trading: Interactive Brokers via Python bridge (`ib_insync`)

**Key Components**:
- F1 Command Center UI (primary interface)
- Classic Trading Dashboard (secondary interface)
- Auto-Trading Orchestrator (PRO 90/10 Rule)
- Production Safety Manager (database-backed)
- Trade Reconciliation System (IBKR sync)
- Market Profile Analysis (5-day CVA, Value Migration)
- Order Flow Detection (absorption, imbalances, exhaustion)

---

## Additional Resources

- **[README.md](./README.md)** - System overview, architecture, setup guide
- **[INSTRUCTIONS.md](./INSTRUCTIONS.md)** - Quick command reference
- **package.json** - npm scripts and dependencies
- **pyproject.toml** - Python dependencies
- **.env.example** - Environment variable template

---

**Last Updated**: November 2025  
**Replit Workspace**: Development environment  
**Production**: Deploy to Fly.io or VPS for live trading