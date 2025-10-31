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
import { CompositeProfileManager } from "./composite_profile";
import { ValueMigrationDetector } from "./value_migration_detector";
import { HypothesisGenerator } from "./hypothesis_generator";
import { OrderFlowSignalDetector } from "./orderflow_signal_detector";
import { HighProbabilitySetupRecognizer } from "./high_probability_setup_recognizer";
import type { OrderFlowSettings } from "./orderflow_strategy";
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
  AbsorptionEvent,
  DomSnapshot,
  TimeAndSalesEntry,
  VolumeProfile,
  CompositeProfileData,
  ValueMigrationData,
  DailyHypothesis,
  OrderFlowSignal,
  TradeRecommendation,
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
const absorptionDetector = new AbsorptionDetector(100, 50, 0.25); // maxTickHistory, maxEventHistory, tickSize

// Initialize PRO Course Systems (Market/Volume Profile + Advanced Order Flow)
const compositeProfileSystem = new CompositeProfileManager(5); // 5-day CVA
const valueMigrationDetector = new ValueMigrationDetector();
const hypothesisGenerator = new HypothesisGenerator();
const orderFlowSignalDetector = new OrderFlowSignalDetector();
const setupRecognizer = new HighProbabilitySetupRecognizer(); // PRO Course trade setups

// Helper function to sync completed daily profiles into composite system
// NOTE: This builds CVA from COMPLETED daily profiles, NOT today's intraday profile
async function syncCompositeProfile(storage: typeof import("./storage").storage) {
  try {
    // Load completed daily profiles from storage (up to 5 days)
    const dailyProfiles = await storage.getDailyProfiles();
    
    // Clear and reload composite system with stored profiles
    const newComposite = new CompositeProfileManager(5);
    for (const { date, profile } of dailyProfiles) {
      if (profile.poc > 0) {
        newComposite.addDailyProfile(date, profile);
      }
    }
    
    // Replace global composite system
    Object.assign(compositeProfileSystem, newComposite);
  } catch (error) {
    console.error("Error syncing composite profile:", error);
  }
}

// Helper function to populate mock historical daily profiles for testing
async function populateMockHistoricalProfiles(storage: typeof import("./storage").storage) {
  const tickSize = 0.25;
  const basePrice = 6850; // ES futures base price
  
  // Generate 5 days of mock completed daily profiles with different price ranges
  const mockProfiles = [
    { date: "2025-10-25", pocOffset: -5, vahOffset: -4, valOffset: -6, volume: 1500000000 },
    { date: "2025-10-26", pocOffset: -3, vahOffset: -2, valOffset: -4, volume: 1600000000 },
    { date: "2025-10-27", pocOffset: 0, vahOffset: 1, valOffset: -1, volume: 1700000000 },
    { date: "2025-10-28", pocOffset: 2, vahOffset: 3, valOffset: 1, volume: 1650000000 },
    { date: "2025-10-29", pocOffset: 4, vahOffset: 5, valOffset: 3, volume: 1550000000 },
  ];
  
  for (const { date, pocOffset, vahOffset, valOffset, volume } of mockProfiles) {
    const profile: VolumeProfile = {
      levels: [
        {
          price: basePrice + vahOffset,
          total_volume: Math.floor(volume * 0.4),
          buy_volume: Math.floor(volume * 0.25),
          sell_volume: Math.floor(volume * 0.15),
          delta: Math.floor(volume * 0.1),
          tpo_count: 0
        },
        {
          price: basePrice + pocOffset,
          total_volume: Math.floor(volume * 0.6), // POC has highest volume
          buy_volume: Math.floor(volume * 0.35),
          sell_volume: Math.floor(volume * 0.25),
          delta: Math.floor(volume * 0.1),
          tpo_count: 0
        },
        {
          price: basePrice + valOffset,
          total_volume: Math.floor(volume * 0.3),
          buy_volume: Math.floor(volume * 0.15),
          sell_volume: Math.floor(volume * 0.15),
          delta: 0,
          tpo_count: 0
        }
      ],
      poc: basePrice + pocOffset,
      vah: basePrice + vahOffset,
      val: basePrice + valOffset,
      total_volume: volume,
      profile_type: "P",
      hvn_levels: [basePrice + pocOffset],
      lvn_levels: []
    };
    
    await storage.addDailyProfile(date, profile);
    console.log(`[MOCK DATA] Added daily profile for ${date}: POC=${profile.poc}, VAH=${profile.vah}, VAL=${profile.val}`);
  }
}

// Default Order Flow Settings for AutoTrader
const defaultOrderFlowSettings: OrderFlowSettings = {
  absorption_threshold: 2.0,
  absorption_lookback: 60,
  dom_imbalance_threshold: 2.0,
  dom_depth_levels: 10,
  tape_volume_threshold: 50,
  tape_ratio_threshold: 1.5,
  tape_lookback_seconds: 60,
  use_poc_magnet: true,
  use_vah_val_boundaries: true,
  stop_loss_ticks: 8,
  take_profit_ticks: 16,
  min_confidence: 60,
};

const autoTrader = new AutoTrader(defaultOrderFlowSettings); // Order flow-based trading strategy

// IBKR Python bridge process
let ibkrProcess: any = null;
let ibkrConnected = false;

// Mock data generator for development (until IBKR connects)
// Using current ES price levels (Dec 2024) - display ES prices, trade MES
let mockPrice = 6004.0;  // ES contract pricing for display
let mockTick = 0;

// Order execution queue for IBKR bridge
interface PendingOrder {
  id: string;
  action: "BUY" | "SELL";
  quantity: number;
  timestamp: number;
  status: "PENDING" | "EXECUTED" | "FAILED";
  result?: any;
}

const pendingOrders: Map<string, PendingOrder> = new Map();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Initialize WebSocket server on /ws path (for frontend clients)
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

  // HTTP endpoint for IBKR bridge (more reliable than WebSocket for external connections)
  let bridgeLastHeartbeat = 0;
  const BRIDGE_TIMEOUT_MS = 10000; // 10 seconds without data = disconnected

  app.post('/api/bridge/data', async (req, res) => {
    try {
      const message = req.body;
      
      if (message.type === 'handshake') {
        console.log('✓ IBKR Bridge connected via HTTP');
        ibkrConnected = true;
        bridgeLastHeartbeat = Date.now();
        const status = await storage.getSystemStatus();
        if (status) {
          status.ibkr_connected = true;
          status.market_data_active = true;
          status.data_delay_seconds = 0;
          await storage.setSystemStatus(status);
        }
        res.json({ type: 'ack', message: 'Connected to trading system' });
      }
      else if (message.type === 'market_data') {
        mockPrice = message.last_price;
        bridgeLastHeartbeat = Date.now();
        if (!ibkrConnected) {
          console.log('✓ IBKR Bridge reconnected via HTTP');
          ibkrConnected = true;
          const status = await storage.getSystemStatus();
          if (status) {
            status.ibkr_connected = true;
            status.market_data_active = true;
            status.data_delay_seconds = 0;
            await storage.setSystemStatus(status);
          }
        }

        // CRITICAL FIX: Feed tick into candle builder and order flow systems
        const timestamp = Date.now();
        const price = message.last_price;
        const volume = message.volume || 1; // Default to 1 contract if not provided
        const isBuy = message.bid && message.ask ? (price >= (message.bid + message.ask) / 2) : (Math.random() > 0.5);
        
        // 1. Add tick to Time & Sales and process for absorption
        const tapeTick = timeAndSalesProcessor.processTick(price, volume, isBuy ? "BUY" : "SELL", timestamp);
        
        // 2. Build Volume Profile from real tick data (not candles)
        volumeProfileCalculator.addTransaction(price, volume, isBuy ? "BUY" : "SELL");
        
        // 3. Process tick for absorption detection
        const absorption = absorptionDetector.processTick(tapeTick);
        if (absorption) {
          await storage.addAbsorptionEvent(absorption);
          console.log(`[ABSORPTION] ${absorption.side} @ ${absorption.price.toFixed(2)} - Ratio: ${absorption.ratio.toFixed(2)}:1`);
        }
        
        // 3. Process tick through candle builder
        const completedCandle = candleBuilder.processTick(price, volume, isBuy, timestamp);
        
        if (completedCandle) {
          // New candle completed - add to storage
          await storage.addCandle(completedCandle);
          
          // Save updated volume profile to storage (built from ticks, not candles)
          const volumeProfile = volumeProfileCalculator.getProfile();
          if (volumeProfile) {
            await storage.setVolumeProfile(volumeProfile);
            console.log(`[VOLUME PROFILE] Updated: POC=${volumeProfile.poc.toFixed(2)}, VAH=${volumeProfile.vah.toFixed(2)}, VAL=${volumeProfile.val.toFixed(2)}, Levels=${volumeProfile.levels.length}`);
          }
          
          console.log(`[CANDLE] ${new Date(completedCandle.timestamp).toLocaleTimeString()} - O:${completedCandle.open.toFixed(2)} H:${completedCandle.high.toFixed(2)} L:${completedCandle.low.toFixed(2)} C:${completedCandle.close.toFixed(2)} Vol:${completedCandle.accumulated_volume} CD:${completedCandle.cumulative_delta.toFixed(0)}`);
        }
        
        res.json({ type: 'ack' });
      }
      else if (message.type === 'dom_update') {
        // Handle Level II DOM data
        bridgeLastHeartbeat = Date.now();
        console.log(`[DOM] Received ${message.bids?.length || 0} bids, ${message.asks?.length || 0} asks`);
        
        // Update DOM processor with real Level II data
        const domSnapshot = domProcessor.updateSnapshot(
          message.bids || [],
          message.asks || [],
          mockPrice
        );
        
        // Store DOM snapshot
        await storage.setDomSnapshot(domSnapshot);
        
        res.json({ type: 'ack' });
      }
      else {
        res.json({ type: 'ack' });
      }
    } catch (error) {
      console.error('Bridge data error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Check for bridge timeout every 5 seconds
  setInterval(async () => {
    if (ibkrConnected && Date.now() - bridgeLastHeartbeat > BRIDGE_TIMEOUT_MS) {
      console.log('✗ IBKR Bridge timeout - no data received');
      ibkrConnected = false;
      const status = await storage.getSystemStatus();
      if (status) {
        status.ibkr_connected = false;
        status.market_data_active = false;
        await storage.setSystemStatus(status);
      }
    }
  }, 5000);

  console.log('✓ Bridge HTTP endpoint initialized at /api/bridge/data');

  // POST /api/bridge/initialize-cva - Fetch historical data and build CVA
  app.post('/api/bridge/initialize-cva', async (req, res) => {
    try {
      const { days } = req.body;
      
      if (!days || !Array.isArray(days)) {
        return res.status(400).json({ error: 'Invalid historical data format' });
      }
      
      console.log(`[CVA INIT] Received ${days.length} days of historical data`);
      
      // Process each day's bars into a volume profile
      for (const dayData of days) {
        const { date, bars } = dayData;
        
        if (!date || !bars || bars.length === 0) {
          console.log(`[CVA INIT] Skipping invalid day: ${date}`);
          continue;
        }
        
        // Build volume profile from 5-minute bars
        const dailyProfileCalc = new VolumeProfileCalculator(0.25);
        
        for (const bar of bars) {
          // Estimate buy/sell volume from bar data
          // Simple heuristic: if close > open, assume more buying, else more selling
          const totalVol = bar.volume;
          const isGreen = bar.close > bar.open;
          const buyVolume = isGreen ? totalVol * 0.6 : totalVol * 0.4;
          const sellVolume = totalVol - buyVolume;
          
          // Add mid-point of bar as transaction price
          const price = (bar.high + bar.low) / 2;
          dailyProfileCalc.addTransaction(price, buyVolume, "BUY");
          dailyProfileCalc.addTransaction(price, sellVolume, "SELL");
        }
        
        // Get the completed daily profile
        const dailyProfile = dailyProfileCalc.getProfile(
          bars[0].timestamp,
          bars[bars.length - 1].timestamp
        );
        
        // Add to composite profile system
        if (dailyProfile.poc > 0) {
          compositeProfileSystem.addDailyProfile(date, dailyProfile);
          console.log(`[CVA INIT] Added ${date}: POC ${dailyProfile.poc.toFixed(2)}, VAH ${dailyProfile.vah.toFixed(2)}, VAL ${dailyProfile.val.toFixed(2)}`);
        }
      }
      
      const compositeProfile = compositeProfileSystem.getCompositeProfile();
      if (compositeProfile) {
        console.log(`[CVA INIT] ✓ Composite Value Area built from ${compositeProfile.days_included} days`);
        console.log(`[CVA INIT]   CVA POC: ${compositeProfile.composite_poc.toFixed(2)}`);
        console.log(`[CVA INIT]   CVA VAH: ${compositeProfile.composite_vah.toFixed(2)}`);
        console.log(`[CVA INIT]   CVA VAL: ${compositeProfile.composite_val.toFixed(2)}`);
        res.json({ success: true, cva: compositeProfile });
      } else {
        res.json({ success: false, error: 'Failed to build CVA' });
      }
    } catch (error) {
      console.error('[CVA INIT] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Order execution endpoints for IBKR bridge
  // POST /api/execute-order - Add order to execution queue
  app.post('/api/execute-order', async (req, res) => {
    try {
      const { action, quantity } = req.body;
      
      if (!action || !quantity) {
        return res.status(400).json({ error: 'Missing action or quantity' });
      }
      
      if (action !== 'BUY' && action !== 'SELL') {
        return res.status(400).json({ error: 'Action must be BUY or SELL' });
      }
      
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const order: PendingOrder = {
        id: orderId,
        action,
        quantity,
        timestamp: Date.now(),
        status: 'PENDING',
      };
      
      pendingOrders.set(orderId, order);
      console.log(`[ORDER QUEUE] Added ${action} ${quantity} (ID: ${orderId})`);
      
      res.json({ success: true, orderId });
    } catch (error) {
      console.error('Execute order error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/pending-orders - Bridge polls for orders to execute
  app.get('/api/pending-orders', (req, res) => {
    const pending = Array.from(pendingOrders.values()).filter(o => o.status === 'PENDING');
    res.json(pending);
  });

  // POST /api/order-result - Bridge reports execution results
  app.post('/api/order-result', async (req, res) => {
    try {
      const { orderId, status, result } = req.body;
      
      const order = pendingOrders.get(orderId);
      if (order) {
        order.status = status;
        order.result = result;
        console.log(`[ORDER RESULT] ${orderId}: ${status} - ${JSON.stringify(result)}`);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Order result error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

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

  // DISABLED: Backend no longer connects to IBKR directly
  // The local bridge script (ibkr_bridge_download.py) handles IBKR connection
  // and sends data to /api/bridge/data endpoint
  // startIBKRConnector();

  // Simulate market data updates (500ms interval)
  setInterval(async () => {
    // If bridge is connected, mockPrice is already being updated by real data
    // Otherwise, generate mock tick data for development
    if (!ibkrConnected) {
      const volatility = 0.25;
      const tickChange = (Math.random() - 0.5) * volatility;
      mockPrice += tickChange;
    }
    
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
      console.log(`[CANDLE] ${new Date(completedCandle.timestamp).toLocaleTimeString()} - O:${completedCandle.open.toFixed(2)} H:${completedCandle.high.toFixed(2)} L:${completedCandle.low.toFixed(2)} C:${completedCandle.close.toFixed(2)} Vol:${completedCandle.accumulated_volume} CD:${completedCandle.cumulative_delta.toFixed(0)}`);
    }

    // Process tick through Order Flow processors
    const tapeTick = timeAndSalesProcessor.processTick(mockPrice, 1, isBuy ? 'BUY' : 'SELL', timestamp);
    
    // Build Volume Profile from real tick data
    volumeProfileCalculator.addTransaction(mockPrice, 1, isBuy ? 'BUY' : 'SELL');

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

    // Save volume profile when candle completes (profile built from ticks, not candles)
    if (completedCandle) {
      const volumeProfile = volumeProfileCalculator.getProfile();
      if (volumeProfile) {
        await storage.setVolumeProfile(volumeProfile);
      }
    }

    // Calculate VWAP and run advanced order flow detection
    const allCandles = await storage.getCandles();
    if (allCandles.length > 0) {
      const vwap = vwapCalculator.calculate(allCandles);
      await storage.setVWAPData(vwap);
      broadcast({
        type: "vwap_update",
        data: vwap,
      });

      // ADVANCED ORDER FLOW SIGNAL DETECTION (PRO Course)
      // Detect: Lack of Participation, Stacked Imbalances, Trapped Traders, Initiative/Responsive, Exhaustion
      const storedVolumeProfile = await storage.getVolumeProfile();
      
      if (allCandles.length >= 10 && storedVolumeProfile) {
        // Build arrays for signal detection
        const recentCandles = allCandles.slice(-20);
        const recentPrices = recentCandles.map(c => c.close);
        const recentDeltas = recentCandles.map(c => c.cumulative_delta);
        const recentVolumes = recentCandles.map(c => c.accumulated_volume);
        
        // Get recent imbalances from time & sales
        const recentTicks = timeAndSalesProcessor.getEntries(50);
        const imbalances: Array<{ price: number; ratio: number; direction: "BUY" | "SELL" }> = [];
        
        // Build imbalance data from consecutive ticks
        for (let i = 1; i < recentTicks.length; i++) {
          const prev = recentTicks[i - 1];
          const curr = recentTicks[i];
          
          // Check for buy/sell imbalance
          const buyVolume = curr.side === 'BUY' ? curr.volume : 0;
          const sellVolume = curr.side === 'SELL' ? curr.volume : 0;
          
          if (buyVolume > 0 && sellVolume === 0) {
            imbalances.push({ price: curr.price, ratio: buyVolume, direction: "BUY" });
          } else if (sellVolume > 0 && buyVolume === 0) {
            imbalances.push({ price: curr.price, ratio: sellVolume, direction: "SELL" });
          }
        }
        
        const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
        const currentCandle = allCandles[allCandles.length - 1];
        
        // Process market data through advanced order flow detector
        const newSignals = orderFlowSignalDetector.processMarketData({
          currentPrice: mockPrice,
          currentDelta: currentCandle.cumulative_delta,
          currentVolume: currentCandle.accumulated_volume,
          recentPrices,
          recentDeltas,
          recentVolumes,
          recentImbalances: imbalances,
          vah: storedVolumeProfile.vah,
          val: storedVolumeProfile.val,
          avgVolume,
          timeOutsideValue: 0 // TODO: Track time outside value
        });
        
        // Log any new signals
        for (const signal of newSignals) {
          console.log(`[ORDER FLOW] ${signal.signal_type} - ${signal.direction} @ ${signal.price.toFixed(2)} - ${signal.description} (Confidence: ${signal.confidence}%)`);
        }
      }

      // Session-aware regime detection
      const latestCandle = allCandles[allCandles.length - 1];
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
          allCandles,
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
        // SAFETY: Only trade during RTH (9:30 AM - 4:00 PM ET) for best liquidity
        // This respects ET timezone regardless of user's local time (handles DST automatically)
        const currentSession = sessionDetector.detectSession(timestamp);
        
        // If we're in ETH and have an open position, close it
        if (currentSession === "ETH" && position.contracts !== 0) {
          const exitPrice = marketData.last_price;
          const priceDiff = position.side === "LONG"
            ? exitPrice - position.entry_price!
            : position.entry_price! - exitPrice;
          const pnl = priceDiff * Math.abs(position.contracts) * 5; // MES multiplier

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

          position.realized_pnl += pnl;
          position.contracts = 0;
          position.side = "FLAT";
          position.entry_price = null;
          position.unrealized_pnl = 0;
          autoTrader.resetPositionEntryTime();

          await storage.setPosition(position);

          console.log(`[AUTO-TRADE] ❌ ETH session detected - closing position @ ${exitPrice.toFixed(2)} - P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`);
          
          broadcast({
            type: "trade_executed",
            data: trade,
          });
          
          if (status) {
            status.daily_pnl += pnl;
            await storage.setSystemStatus(status);
          }
        }
        
        // Only execute new trades during RTH
        if (currentSession === "RTH") {
        // ONLY trade on high-probability PRO Course setups (75%+ confidence)
        // No fallback strategies - strict adherence to PRO methodology
        const compositeProfile = compositeProfileSystem.getCompositeProfile();
        const volumeProfile = volumeProfileCalculator.getProfile();
        
        // Initialize signal to NONE (only trade if we have a valid high-probability setup)
        let signal: any = { action: "NONE", reason: "No high-probability setup detected" };
        
        // Only trade if we have full PRO Course context with VALID CVA data
        // CVA must have actual values (not zeros) and at least 3 days of data
        const isValidCVA = compositeProfile && 
                          compositeProfile.composite_poc > 0 && 
                          compositeProfile.composite_vah > 0 &&
                          compositeProfile.composite_val > 0 &&
                          compositeProfile.days_included >= 3;
        
        if (volumeProfile && isValidCVA) {
          const migration = valueMigrationDetector.detectMigration(volumeProfile, compositeProfile);
          const overnightHigh = marketData.last_price * 1.005;
          const overnightLow = marketData.last_price * 0.995;
          const hypothesis = hypothesisGenerator.generateHypothesis(
            overnightHigh,
            overnightLow,
            marketData.last_price,
            compositeProfile,
            null,
            migration,
            vwap
          );
          
          const orderFlowSignals = orderFlowSignalDetector.getRecentSignals(20);
          
          // Build market context for recommendations (only if we have valid VWAP)
          if (vwap.vwap !== null && vwap.sd1_upper !== null && vwap.sd1_lower !== null && vwap.sd2_upper !== null && vwap.sd2_lower !== null) {
            const context = {
              currentPrice: marketData.last_price,
              compositeProfile,
              valueMigration: migration,
              hypothesis,
              orderFlowSignals,
              vwap: vwap.vwap,
              vwapSD1Upper: vwap.sd1_upper,
              vwapSD1Lower: vwap.sd1_lower,
              vwapSD2Upper: vwap.sd2_upper,
              vwapSD2Lower: vwap.sd2_lower,
              volumeProfile: {
                poc: volumeProfile.poc,
                vah: volumeProfile.val,
                val: volumeProfile.val,
              },
            };
            
            // Generate recommendations and evaluate with 75% minimum confidence
            const recommendations = setupRecognizer.generateRecommendations(context);
            signal = autoTrader.evaluateRecommendations(recommendations, position, 75);
          } else {
            signal = {
              action: "NONE",
              reason: "Insufficient VWAP data - need more candles for PRO Course setups"
            };
          }
        } else {
          const cvaStatus = compositeProfile 
            ? `CVA: ${compositeProfile.days_included}/5 days, POC=${compositeProfile.composite_poc.toFixed(2)}`
            : "CVA: not initialized";
          signal = {
            action: "NONE",
            reason: `Insufficient context - need valid CVA (3+ days) and DVA. ${cvaStatus}`
          };
        }

        // Log auto-trading decision (even if NONE)
        if (signal.action === "NONE") {
          console.log(`[AUTO-TRADE] No trade signal - ${signal.reason}`);
        }

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

          // Track position entry time for hold time enforcement
          autoTrader.setPositionEntryTime(timestamp);

          await storage.setPosition(position);

          console.log(`[AUTO-TRADE] ✅ ${signal.action} ${signal.quantity} @ ${signal.entry_price.toFixed(2)} - ${signal.reason}`);
          
          // SEND REAL ORDER TO IBKR
          if (ibkrConnected) {
            const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const order: PendingOrder = {
              id: orderId,
              action: signal.action,
              quantity: signal.quantity,
              timestamp: Date.now(),
              status: 'PENDING',
            };
            pendingOrders.set(orderId, order);
            console.log(`[IBKR ORDER] Queued ${signal.action} ${signal.quantity} MES (ID: ${orderId})`);
          } else {
            console.log(`[IBKR ORDER] ⚠ Bridge not connected - trade logged but not sent to IBKR`);
          }
          
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

          // Reset position entry time when position is closed
          autoTrader.resetPositionEntryTime();

          await storage.setPosition(position);

          console.log(`[AUTO-TRADE] ❌ CLOSE position - ${signal.reason} - P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`);

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
        } else {
          // ETH session - log that we're skipping
          console.log(`[AUTO-TRADE] Skipping - ETH session. Trading only during RTH (2:30 PM - 9:00 PM London / 9:30 AM - 4:00 PM ET)`);
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
    // Filter out invalid candles (timestamp 0 or null) before sending to frontend
    const validCandles = candles.filter(c => c && c.timestamp > 0);
    res.json(validCandles);
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

  // ==================== PRO COURSE ENDPOINTS ====================
  // Market/Volume Profile + Advanced Order Flow Analysis

  // GET /api/composite-profile - Get 5-day Composite Value Area
  app.get("/api/composite-profile", async (req, res) => {
    try {
      // Sync current volume profile before returning data
      await syncCompositeProfile(storage);
      
      const compositeData = compositeProfileSystem.getCompositeProfile();
      res.json(compositeData || { 
        composite_vah: 0, 
        composite_val: 0, 
        composite_poc: 0, 
        total_volume: 0, 
        days_included: 0,
        oldest_day: Date.now(),
        newest_day: Date.now(),
        profile_shape: null
      });
    } catch (error) {
      console.error("Composite profile error:", error);
      res.status(500).json({ error: "Failed to retrieve composite profile" });
    }
  });

  // GET /api/value-migration - Get Value Migration analysis (DVA vs CVA)
  app.get("/api/value-migration", async (req, res) => {
    try {
      // Sync composite profile first
      await syncCompositeProfile(storage);
      
      // Get current volume profile for DVA
      const volumeProfile = await storage.getVolumeProfile();
      if (!volumeProfile) {
        return res.json(null);
      }
      
      const compositeProfile = compositeProfileSystem.getCompositeProfile();
      const migration = valueMigrationDetector.detectMigration(volumeProfile, compositeProfile);
      res.json(migration);
    } catch (error) {
      console.error("Value migration error:", error);
      res.status(500).json({ error: "Failed to retrieve value migration data" });
    }
  });

  // GET /api/daily-hypothesis - Get pre-market hypothesis and trade plan
  app.get("/api/daily-hypothesis", async (req, res) => {
    try {
      // Sync composite profile first
      await syncCompositeProfile(storage);
      
      // Get current market data for hypothesis generation
      const volumeProfile = await storage.getVolumeProfile();
      const marketData = await storage.getMarketData();
      const vwapData = await storage.getVWAPData();
      
      if (!volumeProfile || !marketData) {
        return res.json(null);
      }
      
      const compositeProfile = compositeProfileSystem.getCompositeProfile();
      const migration = valueMigrationDetector.detectMigration(volumeProfile, compositeProfile);
      
      // For now, use mock overnight data (would come from pre-market session in production)
      const overnightHigh = marketData.last_price * 1.005;
      const overnightLow = marketData.last_price * 0.995;
      const openPrice = marketData.last_price;
      
      const hypothesis = hypothesisGenerator.generateHypothesis(
        overnightHigh,
        overnightLow,
        openPrice,
        compositeProfile,
        null, // yesterdayProfile - would be stored from previous day
        migration,
        vwapData || null
      );
      res.json(hypothesis);
    } catch (error) {
      console.error("Daily hypothesis error:", error);
      res.status(500).json({ error: "Failed to retrieve daily hypothesis" });
    }
  });

  // GET /api/orderflow-signals - Get advanced order flow signals
  app.get("/api/orderflow-signals", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const signals = orderFlowSignalDetector.getRecentSignals(limit);
      res.json(signals);
    } catch (error) {
      console.error("Order flow signals error:", error);
      res.status(500).json({ error: "Failed to retrieve order flow signals" });
    }
  });

  // GET /api/trade-recommendations - Get high-probability trade setups
  app.get("/api/trade-recommendations", async (req, res) => {
    try {
      // Sync composite profile first
      await syncCompositeProfile(storage);
      
      const marketData = await storage.getMarketData();
      const vwapData = await storage.getVWAPData();
      const volumeProfile = await storage.getVolumeProfile();
      
      if (!marketData || !vwapData || !volumeProfile) {
        return res.json([]);
      }
      
      const compositeProfile = compositeProfileSystem.getCompositeProfile();
      
      // Only generate recommendations if we have composite profile
      if (!compositeProfile) {
        return res.json([]);
      }
      
      const migration = valueMigrationDetector.detectMigration(volumeProfile, compositeProfile);
      
      // Generate hypothesis for context
      const overnightHigh = marketData.last_price * 1.005;
      const overnightLow = marketData.last_price * 0.995;
      const hypothesis = hypothesisGenerator.generateHypothesis(
        overnightHigh,
        overnightLow,
        marketData.last_price,
        compositeProfile,
        null,
        migration,
        vwapData
      );
      
      const orderFlowSignals = orderFlowSignalDetector.getRecentSignals(20);
      
      // Only generate recommendations if we have valid VWAP data
      if (vwapData.vwap === null || vwapData.sd1_upper === null || vwapData.sd1_lower === null || vwapData.sd2_upper === null || vwapData.sd2_lower === null) {
        return res.json([]);
      }
      
      // Build market context
      const context = {
        currentPrice: marketData.last_price,
        compositeProfile,
        valueMigration: migration,
        hypothesis,
        orderFlowSignals,
        vwap: vwapData.vwap,
        vwapSD1Upper: vwapData.sd1_upper,
        vwapSD1Lower: vwapData.sd1_lower,
        vwapSD2Upper: vwapData.sd2_upper,
        vwapSD2Lower: vwapData.sd2_lower,
        volumeProfile: {
          poc: volumeProfile.poc,
          vah: volumeProfile.vah,
          val: volumeProfile.val,
        },
      };
      
      const recommendations = setupRecognizer.generateRecommendations(context);
      res.json(recommendations);
    } catch (error) {
      console.error("Trade recommendations error:", error);
      res.status(500).json({ error: "Failed to generate trade recommendations" });
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

  // POST /api/auto-trading/toggle - Toggle auto-trading on/off
  app.post("/api/auto-trading/toggle", async (req, res) => {
    try {
      const { enabled } = req.body;
      
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled must be a boolean" });
      }

      const status = await storage.getSystemStatus();
      if (!status) {
        return res.status(500).json({ error: "System status not available" });
      }

      status.auto_trading_enabled = enabled;
      await storage.setSystemStatus(status);

      console.log(`[AUTO-TRADING] ${enabled ? "ENABLED" : "DISABLED"}`);

      broadcast({
        type: "system_status",
        data: status,
      });

      res.json({ success: true, enabled });
    } catch (error) {
      console.error("Auto-trading toggle error:", error);
      res.status(500).json({ error: "Failed to toggle auto-trading" });
    }
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

  // Populate mock historical daily profiles for testing CVA
  populateMockHistoricalProfiles(storage).then(async () => {
    console.log("✓ Mock historical daily profiles loaded");
    
    // Initialize composite profile with historical data
    await syncCompositeProfile(storage);
    console.log("✓ Composite profile initialized");
  });

  // Periodic sync of composite profile (every 60 seconds)
  setInterval(async () => {
    await syncCompositeProfile(storage);
  }, 60000);

  return httpServer;
}
