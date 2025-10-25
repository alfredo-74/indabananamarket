import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { VolumetricCandleBuilder } from "./volumetric_candle_builder";
import { VWAPCalculator } from "./vwap_calculator";
import { RegimeDetector } from "./regime_detector";
import { SessionAwareRegimeManager } from "./session_aware_regime_manager";
import { SessionDetector } from "./session_detector";
import { KeyLevelsDetector } from "./key_levels_detector";
import { AutoTrader } from "./auto_trader";
import { BacktestEngine } from "./backtest_engine";
import { PerformanceAnalyzer } from "./performance_analyzer";
import type {
  SystemStatus,
  MarketData,
  VolumetricCandle,
  VWAPData,
  Position,
  Trade,
  WebSocketMessage,
  SessionStats,
  KeyLevels,
} from "@shared/schema";
import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize business logic modules
const candleBuilder = new VolumetricCandleBuilder(60000); // 1-minute candles
const vwapCalculator = new VWAPCalculator(10); // 10-candle lookback
const regimeDetector = new RegimeDetector(50); // ±50 CD threshold (legacy, replaced by session-aware)
const sessionRegimeManager = new SessionAwareRegimeManager(30, 50); // ETH ±30, RTH ±50
const sessionDetector = new SessionDetector();
const keyLevelsDetector = new KeyLevelsDetector(20); // 20-candle lookback for swing levels
const autoTrader = new AutoTrader(); // Automated trading strategy
const performanceAnalyzer = new PerformanceAnalyzer(); // Account performance analysis

// IBKR Python bridge process
let ibkrProcess: any = null;
let ibkrConnected = false;

// Mock data generator for development (until IBKR connects)
// Using current ES price levels (Dec 2024) - display ES prices, trade MES
let mockPrice = 6004.0;  // ES contract pricing for display
let mockTick = 0;

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Initialize WebSocket server on /ws path
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws' 
  });

  // WebSocket connection handler
  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Broadcast function to all connected WebSocket clients
  function broadcast(message: WebSocketMessage) {
    const messageStr = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  // Initialize system status with $2,000 starting capital (default before IBKR connection)
  // NOTE: Capital will be updated from IBKR account balance when connection is established
  await storage.setSystemStatus({
    ibkr_connected: false,
    market_data_active: false,
    auto_trading_enabled: false,
    last_update: Date.now(),
    capital: 2000, // Default fallback - will be replaced by real IBKR balance
    daily_pnl: 0,
    account_currency: "USD", // Default to USD for ES/MES futures
    usd_to_account_rate: 1.0, // 1:1 for USD accounts
    account_type: null, // Will be detected when IBKR connects
    data_delay_seconds: 900, // Assume 15-minute delay for delayed data (will be updated)
  });

  // Initialize starting capital for performance tracking
  await storage.setStartingCapital(2000);

  // Initialize position
  await storage.setPosition({
    contracts: 0,
    entry_price: null,
    current_price: mockPrice,
    unrealized_pnl: 0,
    realized_pnl: 0,
    side: "FLAT",
  });

  // Start IBKR connector (attempts connection but may fail in dev)
  function startIBKRConnector() {
    try {
      const pythonPath = process.env.PYTHON_PATH || 'python3';
      const scriptPath = join(__dirname, 'ibkr_connector.py');
      
      ibkrProcess = spawn(pythonPath, [scriptPath], {
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
        },
      });

      ibkrProcess.stdout.on('data', async (data: Buffer) => {
        try {
          const lines = data.toString().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              const response = JSON.parse(line);
              
              if (response.success !== undefined) {
                ibkrConnected = response.success;
                const status = await storage.getSystemStatus();
                if (status) {
                  status.ibkr_connected = response.success;
                  status.market_data_active = response.success;
                  await storage.setSystemStatus(status);
                  
                  // If connected, request account info
                  if (response.success && ibkrProcess) {
                    ibkrProcess.stdin.write(JSON.stringify({ action: 'get_account_info' }) + '\n');
                  }
                }
              }
              
              // Handle account info response
              if (response.account_currency) {
                const status = await storage.getSystemStatus();
                if (status) {
                  status.account_currency = response.account_currency;
                  status.usd_to_account_rate = response.usd_to_account_rate;
                  status.account_type = response.account_type;
                  status.data_delay_seconds = 900; // 15-minute delay for delayed data
                  
                  // Update capital from IBKR account balance
                  if (response.account_balance && response.account_balance > 0) {
                    status.capital = response.account_balance;
                    console.log(`Updated capital from IBKR: $${response.account_balance.toFixed(2)}`);
                  }
                  
                  await storage.setSystemStatus(status);
                  
                  // Broadcast status update with real balance
                  broadcast({
                    type: "system_status",
                    data: status,
                  });
                }
              }
              
              if (response.symbol) {
                // Market data received
                await storage.setMarketData(response);
                broadcast({
                  type: "market_data",
                  data: response,
                });
              }
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      ibkrProcess.stderr.on('data', (data: Buffer) => {
        console.error('IBKR error:', data.toString());
      });

      ibkrProcess.on('exit', (code: number) => {
        console.log(`IBKR process exited with code ${code}`);
        ibkrConnected = false;
      });
    } catch (error) {
      console.error('Failed to start IBKR connector:', error);
      ibkrConnected = false;
    }
  }

  // Attempt to start IBKR connector
  startIBKRConnector();

  // Simulate market data updates (500ms interval)
  setInterval(async () => {
    // Generate mock tick data for development
    const volatility = 0.25;
    const tickChange = (Math.random() - 0.5) * volatility;
    mockPrice += tickChange;
    mockTick++;

    const isBuy = Math.random() > 0.5;
    const timestamp = Date.now();

    // Update market data (ES pricing for display)
    const marketData: MarketData = {
      symbol: "ES",  // Display ES symbol (professional standard)
      last_price: mockPrice,
      bid: mockPrice - 0.25,
      ask: mockPrice + 0.25,
      volume: mockTick,
      timestamp,
    };

    await storage.setMarketData(marketData);
    broadcast({
      type: "market_data",
      data: marketData,
    });

    // Process tick through candle builder
    const completedCandle = candleBuilder.processTick(mockPrice, 1, isBuy, timestamp);

    if (completedCandle) {
      await storage.addCandle(completedCandle);
      broadcast({
        type: "candle_update",
        data: completedCandle,
      });
    }

    // Calculate VWAP
    const candles = await storage.getCandles();
    if (candles.length > 0) {
      const vwap = vwapCalculator.calculate(candles);
      await storage.setVWAPData(vwap);
      broadcast({
        type: "vwap_update",
        data: vwap,
      });

      // Session-aware regime detection
      const latestCandle = candles[candles.length - 1];
      const tickDelta = isBuy ? 1 : -1; // Delta for this tick
      const regimeUpdate = sessionRegimeManager.updateRegime(timestamp, tickDelta);

      // Store regime data (use current session's regime)
      await storage.setRegime(regimeUpdate.regime, 
        regimeUpdate.session === "ETH" ? regimeUpdate.ethCD : regimeUpdate.rthCD);
      
      broadcast({
        type: "regime_change",
        data: {
          regime: regimeUpdate.regime,
          cumulative_delta: regimeUpdate.session === "ETH" ? regimeUpdate.ethCD : regimeUpdate.rthCD,
        },
      });

      // Update session stats
      const sessionStats: SessionStats = sessionDetector.createSessionStats(
        timestamp,
        regimeUpdate.ethCD,
        regimeUpdate.rthCD,
        sessionRegimeManager.getSessionRegime("ETH"),
        sessionRegimeManager.getSessionRegime("RTH")
      );
      await storage.setSessionStats(sessionStats);
      broadcast({
        type: "session_update",
        data: sessionStats,
      });

      // Update key levels periodically (when candle completes)
      if (completedCandle) {
        const previousDayCandles = await storage.getPreviousDayCandles();
        const keyLevels = keyLevelsDetector.detectKeyLevels(
          candles,
          vwap,
          previousDayCandles
        );
        await storage.setKeyLevels(keyLevels);
        broadcast({
          type: "key_levels_update",
          data: keyLevels,
        });
      }

      // Auto-trading logic (if enabled)
      const status = await storage.getSystemStatus();
      const position = await storage.getPosition();
      
      if (status && status.auto_trading_enabled && position) {
        const signal = autoTrader.analyzeMarket(
          marketData,
          vwap,
          regimeUpdate.regime,
          position
        );

        // Execute trade if signal is not NONE
        if (signal.action !== "NONE" && signal.action !== "CLOSE") {
          // Open new position
          const trade = await storage.addTrade({
            timestamp,
            type: signal.action,
            entry_price: signal.entry_price,
            exit_price: null,
            contracts: signal.quantity,
            pnl: null,
            duration_ms: null,
            regime: regimeUpdate.regime,
            cumulative_delta: latestCandle.cumulative_delta,
            status: "OPEN",
          });

          // Update position
          if (signal.action === "BUY") {
            position.contracts = signal.quantity;
            position.side = "LONG";
            position.entry_price = signal.entry_price;
          } else if (signal.action === "SELL") {
            position.contracts = -signal.quantity;
            position.side = "SHORT";
            position.entry_price = signal.entry_price;
          }

          await storage.setPosition(position);

          console.log(`[AUTO-TRADE] ${signal.action} ${signal.quantity} @ ${signal.entry_price.toFixed(2)} - ${signal.reason}`);
          
          broadcast({
            type: "trade_executed",
            data: trade,
          });
        } else if (signal.action === "CLOSE" && position.contracts !== 0) {
          // Close existing position
          const exitPrice = marketData.last_price;
          const priceDiff = position.side === "LONG"
            ? exitPrice - position.entry_price!
            : position.entry_price! - exitPrice;
          const pnl = priceDiff * Math.abs(position.contracts) * 5; // MES multiplier $5/point

          const trade = await storage.addTrade({
            timestamp,
            type: position.side === "LONG" ? "SELL" : "BUY",
            entry_price: exitPrice,
            exit_price: exitPrice,
            contracts: Math.abs(position.contracts),
            pnl,
            duration_ms: null,
            regime: regimeUpdate.regime,
            cumulative_delta: latestCandle.cumulative_delta,
            status: "CLOSED",
          });

          // Update position
          position.realized_pnl += pnl;
          position.contracts = 0;
          position.side = "FLAT";
          position.entry_price = null;
          position.unrealized_pnl = 0;

          await storage.setPosition(position);

          // Update daily P&L in system status
          if (status) {
            status.daily_pnl += pnl;
            await storage.setSystemStatus(status);
          }

          console.log(`[AUTO-TRADE] CLOSE @ ${exitPrice.toFixed(2)} - ${signal.reason} - P&L: $${pnl.toFixed(2)}`);
          
          broadcast({
            type: "trade_executed",
            data: trade,
          });
        }
      }
    }

    // Update system status
    const status = await storage.getSystemStatus();
    if (status) {
      status.last_update = timestamp;
      status.market_data_active = true;
      await storage.setSystemStatus(status);
      broadcast({
        type: "system_status",
        data: status,
      });
    }

    // Update position with current price
    const position = await storage.getPosition();
    if (position) {
      position.current_price = mockPrice;
      
      if (position.entry_price !== null && position.contracts !== 0) {
        const priceDiff = position.side === "LONG" 
          ? mockPrice - position.entry_price 
          : position.entry_price - mockPrice;
        position.unrealized_pnl = priceDiff * position.contracts * 5; // MES multiplier
      }
      
      await storage.setPosition(position);
      broadcast({
        type: "position_update",
        data: position,
      });
    }
  }, 500);

  // API Routes
  
  // GET /api/status - System status
  app.get("/api/status", async (req, res) => {
    const status = await storage.getSystemStatus();
    res.json(status || {
      ibkr_connected: false,
      market_data_active: false,
      auto_trading_enabled: false,
      last_update: Date.now(),
      capital: 100000,
      daily_pnl: 0,
    });
  });

  // GET /api/market-data - Current market data
  app.get("/api/market-data", async (req, res) => {
    const data = await storage.getMarketData();
    res.json(data || {
      symbol: "ES",  // Display ES symbol
      last_price: mockPrice,
      bid: mockPrice - 0.25,
      ask: mockPrice + 0.25,
      volume: 0,
      timestamp: Date.now(),
    });
  });

  // GET /api/candles - Volumetric candles
  app.get("/api/candles", async (req, res) => {
    const candles = await storage.getCandles();
    res.json(candles);
  });

  // GET /api/vwap - VWAP data
  app.get("/api/vwap", async (req, res) => {
    const vwap = await storage.getVWAPData();
    res.json(vwap || {
      vwap: null,
      sd1_upper: null,
      sd1_lower: null,
      sd2_upper: null,
      sd2_lower: null,
      sd3_upper: null,
      sd3_lower: null,
      lookback_candles: 10,
    });
  });

  // GET /api/regime - Current regime
  app.get("/api/regime", async (req, res) => {
    const regime = await storage.getRegime();
    res.json(regime || {
      regime: "ROTATIONAL",
      cumulative_delta: 0,
    });
  });

  // GET /api/position - Current position
  app.get("/api/position", async (req, res) => {
    const position = await storage.getPosition();
    res.json(position || {
      contracts: 0,
      entry_price: null,
      current_price: mockPrice,
      unrealized_pnl: 0,
      realized_pnl: 0,
      side: "FLAT",
    });
  });

  // GET /api/trades - Trade history
  app.get("/api/trades", async (req, res) => {
    const trades = await storage.getTrades();
    res.json(trades);
  });

  // POST /api/trade - Execute trade
  app.post("/api/trade", async (req, res) => {
    const { action, quantity } = req.body;

    if (!action || !quantity) {
      return res.status(400).json({ error: "Missing action or quantity" });
    }

    const marketData = await storage.getMarketData();
    const position = await storage.getPosition();
    
    if (!marketData || !position) {
      return res.status(500).json({ error: "System not ready" });
    }

    const trade = await storage.addTrade({
      timestamp: Date.now(),
      type: action === "BUY" ? "BUY" : "SELL",
      entry_price: marketData.last_price,
      exit_price: null,
      contracts: quantity,
      pnl: null,
      duration_ms: null,
      regime: (await storage.getRegime())?.regime || "ROTATIONAL",
      cumulative_delta: (await storage.getRegime())?.cumulative_delta || 0,
      status: "OPEN",
    });

    // Update position
    if (action === "BUY") {
      position.contracts += quantity;
      position.side = "LONG";
      position.entry_price = marketData.last_price;
    } else {
      position.contracts -= quantity;
      if (position.contracts === 0) {
        position.side = "FLAT";
        position.entry_price = null;
      } else if (position.contracts < 0) {
        position.side = "SHORT";
        position.entry_price = marketData.last_price;
      }
    }

    await storage.setPosition(position);

    broadcast({
      type: "trade_executed",
      data: trade,
    });

    res.json(trade);
  });

  // POST /api/emergency-stop - Emergency stop all trading
  app.post("/api/emergency-stop", async (req, res) => {
    const position = await storage.getPosition();
    
    if (position && position.contracts !== 0) {
      // Close position
      const action = position.contracts > 0 ? "SELL" : "BUY";
      const quantity = Math.abs(position.contracts);
      
      // Execute closing trade
      const marketData = await storage.getMarketData();
      if (marketData) {
        await storage.addTrade({
          timestamp: Date.now(),
          type: action,
          entry_price: marketData.last_price,
          exit_price: null,
          contracts: quantity,
          pnl: position.unrealized_pnl,
          duration_ms: null,
          regime: (await storage.getRegime())?.regime || "ROTATIONAL",
          cumulative_delta: (await storage.getRegime())?.cumulative_delta || 0,
          status: "CLOSED",
        });
      }
      
      position.contracts = 0;
      position.side = "FLAT";
      position.entry_price = null;
      position.realized_pnl += position.unrealized_pnl;
      position.unrealized_pnl = 0;
      
      await storage.setPosition(position);
    }

    const status = await storage.getSystemStatus();
    if (status) {
      status.auto_trading_enabled = false;
      await storage.setSystemStatus(status);
    }

    res.json({ success: true, message: "Emergency stop executed" });
  });

  // POST /api/trading/apply-params - Apply backtest parameters to live trading
  app.post("/api/trading/apply-params", async (req, res) => {
    try {
      const { cd_threshold, vwap_lookback } = req.body;

      if (!cd_threshold || !vwap_lookback) {
        return res.status(400).json({ 
          error: "Missing required parameters: cd_threshold, vwap_lookback" 
        });
      }

      // Update regime detector with new threshold
      regimeDetector.setThreshold(cd_threshold);

      // Update VWAP calculator with new lookback
      vwapCalculator.setLookback(vwap_lookback);

      res.json({ 
        success: true, 
        message: "Parameters applied to live trading",
        parameters: { cd_threshold, vwap_lookback }
      });
    } catch (error) {
      console.error("Apply parameters error:", error);
      res.status(500).json({ error: "Failed to apply parameters" });
    }
  });

  // POST /api/backtest/run - Run a backtest with given parameters
  app.post("/api/backtest/run", async (req, res) => {
    try {
      const { cd_threshold, vwap_lookback, num_candles, initial_capital } = req.body;

      if (!cd_threshold || !vwap_lookback || !num_candles || !initial_capital) {
        return res.status(400).json({ 
          error: "Missing required parameters: cd_threshold, vwap_lookback, num_candles, initial_capital" 
        });
      }

      const backtestEngine = new BacktestEngine();
      const result = await backtestEngine.runBacktest({
        cd_threshold,
        vwap_lookback,
        num_candles,
        initial_capital,
      });

      res.json(result);
    } catch (error) {
      console.error("Backtest error:", error);
      res.status(500).json({ error: "Backtest failed" });
    }
  });

  // POST /api/backtest/optimize - Run parameter optimization
  app.post("/api/backtest/optimize", async (req, res) => {
    try {
      const { 
        cd_thresholds, 
        vwap_lookbacks, 
        num_candles, 
        initial_capital 
      } = req.body;

      if (!cd_thresholds || !vwap_lookbacks || !num_candles || !initial_capital) {
        return res.status(400).json({ 
          error: "Missing required parameters: cd_thresholds, vwap_lookbacks, num_candles, initial_capital" 
        });
      }

      const backtestEngine = new BacktestEngine();
      const results = await backtestEngine.optimizeParameters(
        cd_thresholds,
        vwap_lookbacks,
        num_candles,
        initial_capital
      );

      res.json(results);
    } catch (error) {
      console.error("Optimization error:", error);
      res.status(500).json({ error: "Optimization failed" });
    }
  });

  // GET /api/session - Get current session stats
  app.get("/api/session", async (req, res) => {
    const sessionStats = await storage.getSessionStats();
    
    if (!sessionStats) {
      // Return default session stats if not initialized yet
      return res.json({
        current_session: "RTH",
        session_start_time: Date.now(),
        next_session_time: Date.now() + 3600000, // 1 hour from now
        eth_cumulative_delta: 0,
        rth_cumulative_delta: 0,
        eth_regime: null,
        rth_regime: null,
      });
    }

    res.json(sessionStats);
  });

  // GET /api/key-levels - Get current key levels
  app.get("/api/key-levels", async (req, res) => {
    const keyLevels = await storage.getKeyLevels();
    
    if (!keyLevels) {
      // Return empty key levels if not initialized yet
      return res.json({
        previous_day_high: null,
        previous_day_low: null,
        previous_day_close: null,
        previous_day_vwap: null,
        swing_high: null,
        swing_low: null,
        volume_poc: null,
        last_updated: Date.now(),
      });
    }

    res.json(keyLevels);
  });

  // GET /api/account-analysis - Get comprehensive account performance analysis
  app.get("/api/account-analysis", async (req, res) => {
    try {
      const trades = await storage.getTrades();
      const systemStatus = await storage.getSystemStatus();
      const startingCapital = await storage.getStartingCapital();
      
      if (!systemStatus) {
        return res.status(500).json({ error: "System status not initialized" });
      }

      const currentCapital = systemStatus.capital;

      // Parse query parameters for time period filtering
      const { period } = req.query;
      let periodStart: number | undefined;
      const periodEnd = Date.now();

      if (period === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        periodStart = today.getTime();
      } else if (period === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        periodStart = weekAgo.getTime();
      } else if (period === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        periodStart = monthAgo.getTime();
      }
      // If no period specified, use all-time data

      const analysis = performanceAnalyzer.calculateAnalysis(
        trades,
        startingCapital,
        currentCapital,
        periodStart,
        periodEnd
      );

      res.json(analysis);
    } catch (error) {
      console.error("Account analysis error:", error);
      res.status(500).json({ error: "Failed to calculate account analysis" });
    }
  });

  return httpServer;
}
