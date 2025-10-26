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
import { TimeAndSalesProcessor } from "./time_and_sales";
import { DomProcessor } from "./dom_processor";
import { VolumeProfileCalculator } from "./volume_profile";
import { AbsorptionDetector } from "./absorption_detector";
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
  OrderFlowSettings,
  AbsorptionEvent,
  DomSnapshot,
  TimeAndSalesEntry,
  VolumeProfile,
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
const performanceAnalyzer = new PerformanceAnalyzer(); // Account performance analysis

// Initialize Order Flow processors (Foundation Course methodology)
const timeAndSalesProcessor = new TimeAndSalesProcessor(100); // Keep last 100 transactions
const domProcessor = new DomProcessor();
const volumeProfileCalculator = new VolumeProfileCalculator();
const absorptionDetector = new AbsorptionDetector({
  min_volume_ratio: 2.0,
  lookback_seconds: 10,
  price_tolerance_ticks: 2
});

// Default Order Flow Settings for AutoTrader
const defaultOrderFlowSettings: OrderFlowSettings = {
  absorption_min_ratio: 2.0,
  absorption_lookback_seconds: 60,
  dom_depth_levels: 10,
  dom_imbalance_ratio: 2.5,
  tape_lookback_entries: 50,
  tape_pressure_ratio: 1.5,
  volume_profile_lookback_candles: 20,
  min_confidence_score: 60
};

const autoTrader = new AutoTrader(defaultOrderFlowSettings); // Order flow-based trading strategy

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

    // Process tick through Order Flow processors
    const tapeTick = timeAndSalesProcessor.processTick(mockPrice, 1, isBuy ? 'BUY' : 'SELL', timestamp);

    // Update DOM processor (mock data - will be replaced with real IBKR L2 data)
    const mockBids: Array<[number, number]> = [
      [mockPrice - 0.25, 10],
      [mockPrice - 0.50, 8],
      [mockPrice - 0.75, 12]
    ];
    const mockAsks: Array<[number, number]> = [
      [mockPrice + 0.25, 10],
      [mockPrice + 0.50, 8],
      [mockPrice + 0.75, 12]
    ];
    domProcessor.updateSnapshot(mockBids, mockAsks, mockPrice);

    // Detect absorption events
    const absorptionEvent = absorptionDetector.processTick(tapeTick);

    if (absorptionEvent) {
      console.log(`[ABSORPTION] ${absorptionEvent.side} @ ${absorptionEvent.price.toFixed(2)} - Ratio: ${absorptionEvent.ratio.toFixed(2)}:1`);
    }

    // Update volume profile when candle completes
    if (completedCandle) {
      volumeProfileCalculator.addCandle(completedCandle);
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
        // Get order flow data for analysis
        const absorptionEvents = absorptionDetector.getRecentEvents(60); // Last 60 seconds
        const domSnapshot = domProcessor.getSnapshot() || null;
        const timeAndSalesEntries = timeAndSalesProcessor.getEntries(50); // Last 50 entries
        const volumeProfile = volumeProfileCalculator.getProfile() || null;

        const signal = autoTrader.analyzeMarket(
          marketData,
          absorptionEvents,
          domSnapshot,
          timeAndSalesEntries,
          volumeProfile,
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

  // POST /api/ibkr-bridge - Receive data from local IBKR bridge
  app.post("/api/ibkr-bridge", async (req, res) => {
    try {
      const data = req.body;
      
      if (data.type === "connection") {
        // Update connection status and account balance
        const status = await storage.getSystemStatus();
        if (status) {
          status.ibkr_connected = data.connected;
          status.market_data_active = data.connected;
          if (data.account_balance) {
            status.capital = data.account_balance;
          }
          await storage.setSystemStatus(status);
          
          broadcast({
            type: "system_status",
            data: status,
          });
        }
      } else if (data.type === "market_data") {
        // Store and broadcast real market data from IB Gateway
        const marketData: MarketData = {
          symbol: data.symbol,
          last_price: data.last_price,
          bid: data.bid,
          ask: data.ask,
          volume: data.volume,
          timestamp: data.timestamp,
        };
        
        await storage.setMarketData(marketData);
        broadcast({
          type: "market_data",
          data: marketData,
        });
        
        // Process through candle builder
        const isBuy = Math.random() > 0.5; // We don't have tick direction from delayed data
        const completedCandle = candleBuilder.processTick(
          data.last_price,
          1,
          isBuy,
          data.timestamp
        );
        
        if (completedCandle) {
          await storage.addCandle(completedCandle);
          broadcast({
            type: "candle_update",
            data: completedCandle,
          });
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("IBKR bridge error:", error);
      res.status(500).json({ error: "Failed to process bridge data" });
    }
  });

  // POST /api/ibkr-historical - Receive historical data from IBKR bridge
  app.post("/api/ibkr-historical", async (req, res) => {
    try {
      const { bars } = req.body;
      
      if (!bars || !Array.isArray(bars)) {
        return res.status(400).json({ error: "Invalid bars data" });
      }

      console.log(`Received ${bars.length} historical bars from IBKR`);

      // Convert IBKR bars to volumetric candles
      const volumetricCandles: VolumetricCandle[] = bars.map((bar: any, index: number) => {
        // Estimate buy/sell volume (since IBKR doesn't provide this for historical data)
        const totalVolume = bar.volume || 0;
        const isUpCandle = bar.close > bar.open;
        const buyVolume = isUpCandle ? Math.ceil(totalVolume * 0.6) : Math.floor(totalVolume * 0.4);
        const sellVolume = totalVolume - buyVolume;
        const delta = buyVolume - sellVolume;
        
        // Calculate cumulative delta
        const prevCumulativeDelta = index > 0 
          ? (bars[index - 1] as any).cumulative_delta || 0 
          : 0;
        const cumulativeDelta = prevCumulativeDelta + delta;

        return {
          timestamp: bar.timestamp,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          accumulated_volume: totalVolume,
          buy_volume: buyVolume,
          sell_volume: sellVolume,
          cumulative_delta: cumulativeDelta,
        };
      });

      // Store historical bars
      await storage.setHistoricalBars(volumetricCandles);

      console.log(`✓ Stored ${volumetricCandles.length} historical candles for backtesting`);

      res.json({ 
        success: true, 
        message: `Stored ${volumetricCandles.length} historical candles`,
        bars_count: volumetricCandles.length
      });
    } catch (error) {
      console.error("Historical data error:", error);
      res.status(500).json({ error: "Failed to process historical data" });
    }
  });

  // GET /api/time-and-sales - Get Time & Sales data
  app.get("/api/time-and-sales", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const entries = await storage.getTimeAndSales(limit);
      res.json(entries);
    } catch (error) {
      console.error("Time & Sales error:", error);
      res.status(500).json({ error: "Failed to retrieve Time & Sales data" });
    }
  });

  // GET /api/dom - Get current Depth of Market snapshot
  app.get("/api/dom", async (req, res) => {
    try {
      const snapshot = await storage.getDomSnapshot();
      res.json(snapshot || null);
    } catch (error) {
      console.error("DOM error:", error);
      res.status(500).json({ error: "Failed to retrieve DOM data" });
    }
  });

  // GET /api/volume-profile - Get current Volume Profile
  app.get("/api/volume-profile", async (req, res) => {
    try {
      const profile = await storage.getVolumeProfile();
      res.json(profile || null);
    } catch (error) {
      console.error("Volume Profile error:", error);
      res.status(500).json({ error: "Failed to retrieve Volume Profile" });
    }
  });

  // GET /api/absorption-events - Get absorption events
  app.get("/api/absorption-events", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const events = await storage.getAbsorptionEvents(limit);
      res.json(events);
    } catch (error) {
      console.error("Absorption events error:", error);
      res.status(500).json({ error: "Failed to retrieve absorption events" });
    }
  });

  // GET /api/discord-levels - Get Discord levels
  app.get("/api/discord-levels", async (req, res) => {
    try {
      const levels = await storage.getDiscordLevels();
      res.json(levels);
    } catch (error) {
      console.error("Discord levels error:", error);
      res.status(500).json({ error: "Failed to retrieve Discord levels" });
    }
  });

  // POST /api/discord-levels - Set Discord levels (admin/setup)
  app.post("/api/discord-levels", async (req, res) => {
    try {
      const { levels } = req.body;
      if (!Array.isArray(levels)) {
        return res.status(400).json({ error: "Invalid levels data" });
      }
      await storage.setDiscordLevels(levels);
      res.json({ success: true, count: levels.length });
    } catch (error) {
      console.error("Discord levels set error:", error);
      res.status(500).json({ error: "Failed to set Discord levels" });
    }
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

      // Fetch real historical data from storage (if available)
      const historicalBars = await storage.getHistoricalBars();

      const backtestEngine = new BacktestEngine();
      const result = await backtestEngine.runBacktest({
        cd_threshold,
        vwap_lookback,
        num_candles,
        initial_capital,
      }, historicalBars);

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

      // Fetch real historical data from storage (if available)
      const historicalBars = await storage.getHistoricalBars();

      const backtestEngine = new BacktestEngine();
      const results = await backtestEngine.optimizeParameters(
        cd_thresholds,
        vwap_lookbacks,
        num_candles,
        initial_capital,
        historicalBars
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
