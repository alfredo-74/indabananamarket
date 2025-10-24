import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { VolumetricCandleBuilder } from "./volumetric_candle_builder";
import { VWAPCalculator } from "./vwap_calculator";
import { RegimeDetector } from "./regime_detector";
import type {
  SystemStatus,
  MarketData,
  VolumetricCandle,
  VWAPData,
  Position,
  Trade,
  WebSocketMessage,
} from "@shared/schema";
import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize business logic modules
const candleBuilder = new VolumetricCandleBuilder(60000); // 1-minute candles
const vwapCalculator = new VWAPCalculator(10); // 10-candle lookback
const regimeDetector = new RegimeDetector(50); // ±50 CD threshold

// IBKR Python bridge process
let ibkrProcess: any = null;
let ibkrConnected = false;

// Mock data generator for development (until IBKR connects)
// Using current MES price levels (Dec 2024)
let mockPrice = 5838.0;
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

  // Initialize system status with $2,000 starting capital
  await storage.setSystemStatus({
    ibkr_connected: false,
    market_data_active: false,
    auto_trading_enabled: false,
    last_update: Date.now(),
    capital: 2000,
    daily_pnl: 0,
  });

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

    // Update market data
    const marketData: MarketData = {
      symbol: "MES",
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

      // Detect regime
      const latestCandle = candles[candles.length - 1];
      const previousRegime = await storage.getRegime();
      const regime = regimeDetector.detectRegime(
        latestCandle.cumulative_delta,
        previousRegime?.regime
      );

      await storage.setRegime(regime, latestCandle.cumulative_delta);
      broadcast({
        type: "regime_change",
        data: {
          regime,
          cumulative_delta: latestCandle.cumulative_delta,
        },
      });
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
      symbol: "MES",
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

  return httpServer;
}
