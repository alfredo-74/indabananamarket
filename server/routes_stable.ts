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
import { FootprintAnalyzer } from "./footprint_analyzer";
import { CVAStackingManager } from "./cva_stacking_manager";
import { OpeningDriveDetector } from "./opening_drive_detector";
import { EightyPercentRuleDetector } from "./eighty_percent_rule_detector";
import { ValueShiftDetector } from "./value_shift_detector";
import { ProductionSafetyManager } from "./production_safety_manager";
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
  FootprintBar,
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
const footprintAnalyzer = new FootprintAnalyzer(5 * 60 * 1000, 0.25, 100); // 5-min bars, ES tick size, max 100 bars
const cvaStackingManager = new CVAStackingManager(30, 2, 0.25); // 30 days history, 2 ticks tolerance, ES tick size
const openingDriveDetector = new OpeningDriveDetector(0.25, 60); // ES tick size, 60-min window
const eightyPercentRuleDetector = new EightyPercentRuleDetector(60); // 60-min detection window
const valueShiftDetector = new ValueShiftDetector(0.25); // ES tick size

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

// Production Safety Manager - Critical safety features for real money trading
// MUST be initialized before processing any trades to prevent race conditions
let safetyManager: ProductionSafetyManager | null = null;
let safetyManagerReady = false;

// Initialize safety manager and wait for it to be ready
(async () => {
  try {
    safetyManager = await ProductionSafetyManager.create(storage);
    safetyManagerReady = true;
    console.log('[SAFETY] ✅ Production Safety Manager initialized and ready');
  } catch (error) {
    console.error('[SAFETY] ❌ FATAL: Failed to initialize Production Safety Manager:', error);
    process.exit(1); // Cannot trade safely without safety manager
  }
})();

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
  let bridgeLastHeartbeat = Date.now(); // Initialize to now to prevent "never connected" spam on startup
  let lastStatusUpdate = 0; // Throttle database status updates
  const BRIDGE_TIMEOUT_MS = 60000; // 60 seconds without data = disconnected (allows quiet market periods + slower tick intervals)

  app.post('/api/bridge/data', async (req, res) => {
    try {
      const message = req.body;
      
      // Log ALL incoming bridge messages for debugging (skip high-frequency market_data/dom_update)
      if (message.type !== 'market_data' && message.type !== 'dom_update') {
        console.log(`[BRIDGE] Received message type: ${message.type}`);
      }
      
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
        // CRITICAL: Update heartbeat IMMEDIATELY - do NOT touch mockPrice
        bridgeLastHeartbeat = Date.now();
        
        // Update connection status in database (throttled to once per 5 seconds)
        const timeSinceLastStatusUpdate = Date.now() - (lastStatusUpdate || 0);
        if (!ibkrConnected || timeSinceLastStatusUpdate > 5000) {
          if (!ibkrConnected) {
            console.log('✓ IBKR Bridge reconnected - real data flowing');
          }
          ibkrConnected = true;
          lastStatusUpdate = Date.now();
          
          const status = await storage.getSystemStatus();
          if (status) {
            status.ibkr_connected = true;
            status.market_data_active = true;
            status.data_delay_seconds = 0;
            await storage.setSystemStatus(status);
          }
        }

        // Process REAL bridge data - completely separate from mock system
        const timestamp = Date.now();
        const price = message.last_price;
        const volume = message.volume || 1;
        const isBuy = message.bid && message.ask ? (price >= (message.bid + message.ask) / 2) : (Math.random() > 0.5);
        
        // Broadcast real market data IMMEDIATELY (this stops mock data from appearing in UI)
        const realMarketData: MarketData = {
          symbol: "ES",
          last_price: price,
          bid: message.bid || price - 0.25,
          ask: message.ask || price + 0.25,
          volume: message.volume || 0,
          timestamp,
        };
        
        await storage.setMarketData(realMarketData);
        broadcast({
          type: "market_data",
          data: realMarketData,
        });
        
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
        
        // 4. Process tick through footprint analyzer (PRO Course Stage 3)
        const completedFootprintBar = footprintAnalyzer.processTick(tapeTick);
        if (completedFootprintBar) {
          await storage.addFootprintBar(completedFootprintBar);
          console.log(`[FOOTPRINT] Bar completed: POC=${completedFootprintBar.poc_price.toFixed(2)}, Delta=${completedFootprintBar.bar_delta.toFixed(0)}, Imbalances=${completedFootprintBar.imbalance_count}, Stacked Buy=${completedFootprintBar.stacked_buying}, Stacked Sell=${completedFootprintBar.stacked_selling}`);
          
          // 5. Analyze footprint imbalances for order flow signals (PRO Course integration)
          const recentFootprintBars = await storage.getFootprintBars(5); // Last 5 bars for analysis
          const footprintSignals = orderFlowSignalDetector.analyzeFootprintImbalances(
            recentFootprintBars.map(bar => {
              // Calculate consecutive imbalance counts from price levels
              let buyStackCount = 0;
              let sellStackCount = 0;
              let consecutiveBuy = 0;
              let consecutiveSell = 0;
              
              const sortedLevels = [...bar.price_levels].sort((a, b) => a.price - b.price);
              for (const level of sortedLevels) {
                if (level.imbalanced && level.imbalance_direction === "ASK") {
                  consecutiveBuy++;
                  buyStackCount = Math.max(buyStackCount, consecutiveBuy);
                  consecutiveSell = 0;
                } else if (level.imbalanced && level.imbalance_direction === "BID") {
                  consecutiveSell++;
                  sellStackCount = Math.max(sellStackCount, consecutiveSell);
                  consecutiveBuy = 0;
                } else {
                  consecutiveBuy = 0;
                  consecutiveSell = 0;
                }
              }
              
              return {
                timestamp: bar.start_time,
                price_levels: bar.price_levels,
                poc: bar.poc_price,
                cumulative_delta: bar.bar_delta,
                stacked_imbalances: {
                  buy_stacks: buyStackCount,
                  sell_stacks: sellStackCount,
                },
              };
            })
          );
          
          // Log any new footprint-derived signals
          if (footprintSignals.length > 0) {
            console.log(`[FOOTPRINT → ORDER FLOW] Generated ${footprintSignals.length} signals from footprint analysis`);
            for (const signal of footprintSignals) {
              console.log(`  - ${signal.signal_type}: ${signal.description}`);
            }
          }
          
          // Broadcast footprint update via WebSocket
          broadcast({
            type: "footprint_update",
            data: completedFootprintBar,
          });
        }
        
        // 5. Process tick through candle builder
        const completedCandle = candleBuilder.processTick(price, volume, isBuy, timestamp);
        
        if (completedCandle) {
          // New candle completed - add to storage
          await storage.addCandle(completedCandle);
          console.log(`[CANDLE] Completed ${new Date(completedCandle.timestamp).toLocaleTimeString()} - O:${completedCandle.open.toFixed(2)} H:${completedCandle.high.toFixed(2)} L:${completedCandle.low.toFixed(2)} C:${completedCandle.close.toFixed(2)} Vol:${completedCandle.accumulated_volume} CD:${completedCandle.cumulative_delta.toFixed(0)}`);
          
          // Recalculate VWAP from all stored candles (including this new one)
          const allCandles = await storage.getCandles();
          if (allCandles.length > 0) {
            const vwap = vwapCalculator.calculate(allCandles);
            await storage.setVWAPData(vwap);
            console.log(`[VWAP] Recalculated from ${allCandles.length} candles - VWAP: ${vwap.vwap?.toFixed(2) || 'N/A'}, Upper: ${vwap.upper_band?.toFixed(2) || 'N/A'}, Lower: ${vwap.lower_band?.toFixed(2) || 'N/A'}`);
            
            // Broadcast VWAP update to clients
            broadcast({
              type: "vwap_update",
              data: vwap,
            });
          }
          
          // Save updated volume profile to storage (built from ticks, not candles)
          const volumeProfile = volumeProfileCalculator.getProfile();
          if (volumeProfile) {
            await storage.setVolumeProfile(volumeProfile);
            console.log(`[VOLUME PROFILE] Updated: POC=${volumeProfile.poc.toFixed(2)}, VAH=${volumeProfile.vah.toFixed(2)}, VAL=${volumeProfile.val.toFixed(2)}, Levels=${volumeProfile.levels.length}`);
          }
        }
        
        res.json({ type: 'ack' });
      }
      else if (message.type === 'dom_update') {
        // Handle Level II DOM data
        bridgeLastHeartbeat = Date.now();
        console.log(`[DOM] Received ${message.bids?.length || 0} bids, ${message.asks?.length || 0} asks`);
        
        // Get current price from market data (not from mockPrice)
        const currentMarketData = await storage.getMarketData();
        const currentPrice = currentMarketData?.last_price || 0;
        
        // Update DOM processor with real Level II data
        const domSnapshot = domProcessor.updateSnapshot(
          message.bids || [],
          message.asks || [],
          currentPrice
        );
        
        // Store DOM snapshot
        await storage.setDomSnapshot(domSnapshot);
        
        res.json({ type: 'ack' });
      }
      else if (message.type === 'historical_bars') {
        // Handle historical data for CVA calculation
        bridgeLastHeartbeat = Date.now();
        const { date, bars } = message;
        
        if (!date || !bars || bars.length === 0) {
          console.log(`[CVA] Skipping invalid day: ${date}`);
          return res.json({ type: 'ack' });
        }
        
        console.log(`[CVA] Processing ${date}: ${bars.length} bars`);
        
        // Build volume profile from 5-minute bars for this day
        const dailyProfileCalc = new VolumeProfileCalculator(0.25);
        
        for (const bar of bars) {
          // Estimate buy/sell volume from bar data
          const totalVol = bar.volume;
          const isGreen = bar.close > bar.open;
          const buyVolume = isGreen ? totalVol * 0.6 : totalVol * 0.4;
          const sellVolume = totalVol - buyVolume;
          
          // Add each price level to the profile
          dailyProfileCalc.addTransaction(bar.close, buyVolume, 'BUY');
          dailyProfileCalc.addTransaction(bar.close, sellVolume, 'SELL');
        }
        
        const dailyProfile = dailyProfileCalc.getProfile();
        if (dailyProfile) {
          // Add this day's profile to the composite
          compositeProfileSystem.addDailyProfile(date, dailyProfile);
          console.log(`[CVA] Added ${date} to composite - POC: ${dailyProfile.poc.toFixed(2)}, VAH: ${dailyProfile.vah.toFixed(2)}, VAL: ${dailyProfile.val.toFixed(2)}`);
          
          // PERSIST TO DATABASE
          await storage.addDailyProfile(date, dailyProfile);
          
          // Update CVA stacking with the new composite
          const cva = compositeProfileSystem.getCompositeProfile();
          if (cva) {
            cvaStackingManager.addHistoricalCVA(date, cva, null);
          }
          
          // PRE-INITIALIZE VWAP: Store historical bars as candles for VWAP calculation
          // This ensures VWAP works immediately on startup without waiting for first live candle
          for (const bar of bars) {
            const volumetricCandle: VolumetricCandle = {
              timestamp: new Date(bar.date).getTime(),
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              accumulated_volume: bar.volume,
              cumulative_delta: 0, // Historical bars don't have delta data
              buy_volume: 0,
              sell_volume: 0,
            };
            await storage.addCandle(volumetricCandle);
          }
          
          // Calculate VWAP from all stored candles (historical + any live ones)
          const allCandles = await storage.getCandles();
          if (allCandles.length > 0) {
            const vwap = vwapCalculator.calculate(allCandles);
            await storage.setVWAPData(vwap);
            console.log(`[VWAP] Pre-initialized from ${allCandles.length} candles - VWAP: ${vwap.vwap?.toFixed(2) || 'N/A'}`);
            
            // Broadcast VWAP to clients so UI updates immediately
            broadcast({
              type: "vwap_update",
              data: vwap,
            });
          }
        }
        
        res.json({ type: 'ack' });
      }
      else if (message.type === 'portfolio_update') {
        // Handle portfolio/position updates from IBKR
        bridgeLastHeartbeat = Date.now();
        
        const { contracts, entry_price, unrealized_pnl } = message;
        
        // CRITICAL SERVER-SIDE SANITY CHECK: Reject corrupt entry prices
        // ES/MES trade between 1000-15000. Anything else is corrupt data.
        if (entry_price && (entry_price < 1000 || entry_price > 15000)) {
          console.log(`[CORRUPT DATA] BLOCKING portfolio update - entry price ${entry_price} outside valid range (1000-15000)`);
          console.log(`[CORRUPT DATA] This corrupt data from IBKR will NOT update the database`);
          res.json({ type: 'ack', message: 'Rejected - corrupt entry price' });
          return;
        }
        
        const currentPosition = await storage.getPosition();
        const status = await storage.getSystemStatus();
        
        // Check if a trade just closed (position went from non-zero to zero)
        if (currentPosition && currentPosition.contracts !== 0 && contracts === 0) {
          // Trade closed! Record it
          const realized_pnl = unrealized_pnl || 0; // The final P&L when trade closed
          const trade_side = currentPosition.side;
          const exit_time = Date.now();
          
          // Create trade record matching schema
          const trade = {
            timestamp: exit_time - 60000, // Entry time estimate (1 min ago)
            type: trade_side === "LONG" ? "BUY" : "SELL" as "BUY" | "SELL",
            entry_price: currentPosition.entry_price || 0,
            exit_price: mockPrice,
            contracts: Math.abs(currentPosition.contracts),
            pnl: realized_pnl,
            duration_ms: 60000, // Estimate
            regime: "UNKNOWN",
            cumulative_delta: 0,
            status: "CLOSED" as "CLOSED",
            orderflow_signal: "Manual close via bridge",
          };
          
          await storage.addTrade(trade);
          console.log(`[PORTFOLIO] Trade closed: ${trade_side} ${Math.abs(currentPosition.contracts)}x @ ${trade.entry_price.toFixed(2)} → ${trade.exit_price.toFixed(2)}, P&L: ${realized_pnl >= 0 ? '+' : ''}$${realized_pnl.toFixed(2)}`);
          
          // Update daily P&L
          if (status) {
            status.daily_pnl = (status.daily_pnl || 0) + realized_pnl;
            await storage.setSystemStatus(status);
          }
        }
        
        // Update position
        await storage.setPosition({
          contracts,
          entry_price: contracts !== 0 ? entry_price : null,
          current_price: mockPrice,
          unrealized_pnl: contracts !== 0 ? unrealized_pnl : 0,
          realized_pnl: 0,
          side: contracts > 0 ? "LONG" : contracts < 0 ? "SHORT" : "FLAT",
        });
        
        console.log(`[PORTFOLIO] Position update: ${contracts} contracts, uPnL: ${unrealized_pnl?.toFixed(2) || 0}`);
        res.json({ type: 'ack' });
      }
      else if (message.type === 'account_data') {
        // Handle account data from IBKR
        bridgeLastHeartbeat = Date.now();
        
        const { account_balance, net_liquidation, available_funds, unrealized_pnl, realized_pnl, daily_pnl } = message;
        const status = await storage.getSystemStatus();
        
        if (status) {
          // Update system status with IBKR account data
          status.account_balance = account_balance || 0;
          status.daily_pnl = daily_pnl || 0;
          
          await storage.setSystemStatus(status);
          
          console.log(`[ACCOUNT] Balance: $${account_balance?.toFixed(2)}, NetLiq: $${net_liquidation?.toFixed(2)}, Daily P&L: ${daily_pnl >= 0 ? '+' : ''}$${daily_pnl?.toFixed(2)}`);
        }
        
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

  // Initialize bridge status as disconnected on startup (prevents stale "connected" status from previous session)
  const initBridgeStatus = async () => {
    const status = await storage.getSystemStatus();
    if (status) {
      if (status.ibkr_connected || status.market_data_active) {
        console.log('[INIT] Resetting bridge status to disconnected on startup');
        status.ibkr_connected = false;
        status.market_data_active = false;
        await storage.setSystemStatus(status);
      }
    }
    ibkrConnected = false;
  };
  
  // Run initialization immediately (await ensures it completes before routes handle requests)
  await initBridgeStatus();

  // Check for bridge timeout every 2 seconds (fast detection for real trading)
  setInterval(async () => {
    const status = await storage.getSystemStatus();
    if (!status) return;
    
    const timeSinceLastData = Date.now() - bridgeLastHeartbeat;
    const bridgeActive = timeSinceLastData < BRIDGE_TIMEOUT_MS;
    
    // Update connection status if it changed
    if (bridgeActive !== status.ibkr_connected || bridgeActive !== status.market_data_active) {
      if (bridgeActive) {
        console.log('✓ IBKR Bridge connected - real data flowing');
        status.ibkr_connected = true;
        status.market_data_active = true;
        status.data_delay_seconds = 0;
      } else {
        const displayTime = bridgeLastHeartbeat === 0 
          ? 'never connected' 
          : `no data for ${Math.round(timeSinceLastData / 1000)}s`;
        console.log(`✗ IBKR Bridge disconnected - ${displayTime}`);
        status.ibkr_connected = false;
        status.market_data_active = false;
        
        // CRITICAL: Clear all pending orders when bridge disconnects
        const clearedCount = pendingOrders.size;
        pendingOrders.clear();
        if (clearedCount > 0) {
          console.log(`[SAFETY] Cleared ${clearedCount} pending orders due to bridge disconnect`);
        }
      }
      
      await storage.setSystemStatus(status);
      ibkrConnected = bridgeActive;
    }
  }, 2000); // Check every 2 seconds for immediate feedback

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
        
        // Save to storage AND add to composite profile system
        if (dailyProfile.poc > 0) {
          await storage.addDailyProfile(date, dailyProfile);
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
    const now = Date.now();
    const MAX_ORDER_AGE_MS = 30000; // 30 seconds - prevent phantom positions from old orders
    
    // Filter for PENDING orders that are less than 30 seconds old
    const pending = Array.from(pendingOrders.values()).filter(o => {
      if (o.status !== 'PENDING') return false;
      
      const age = now - o.timestamp;
      if (age > MAX_ORDER_AGE_MS) {
        // Order expired - mark as EXPIRED and remove from queue
        console.log(`[PHANTOM FIX] Order ${o.id} expired (age: ${Math.round(age / 1000)}s) - ${o.action} ${o.quantity}`);
        pendingOrders.delete(o.id);
        return false;
      }
      
      return true;
    });
    
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

  // Mock data generator REMOVED - system only shows real IBKR data
  

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

  // POST /api/position/force-sync - Force sync position from IBKR (clears phantom positions)
  app.post("/api/position/force-sync", async (req, res) => {
    try {
      // Reset position to FLAT in database
      await storage.setPosition({
        contracts: 0,
        entry_price: null,
        current_price: mockPrice,
        unrealized_pnl: 0,
        realized_pnl: 0,
        side: "FLAT",
      });
      
      // Broadcast updated position
      broadcast({
        type: "position_update",
        data: {
          contracts: 0,
          entry_price: null,
          current_price: mockPrice,
          unrealized_pnl: 0,
          realized_pnl: 0,
          side: "FLAT",
        },
      });
      
      res.json({ 
        success: true, 
        message: "Position reset to FLAT. Awaiting next update from IBKR bridge." 
      });
    } catch (error) {
      console.error("Force sync error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to sync position" 
      });
    }
  });

  // GET /api/trades - Trade history
  app.get("/api/trades", async (req, res) => {
    const trades = await storage.getTrades();
    res.json(trades);
  });

  // DISABLED OLD ENDPOINT - Use /api/bridge/data instead
  // This old endpoint was causing price blinking by writing market data without heartbeat checks
  app.post("/api/ibkr-bridge", async (req, res) => {
    try {
      // Reject all requests - bridge should use /api/bridge/data endpoint
      console.log('[DEPRECATED] /api/ibkr-bridge endpoint called - redirecting to /api/bridge/data');
      res.status(410).json({ 
        error: 'This endpoint is deprecated. Use /api/bridge/data instead.',
        message: 'Please update your bridge to use the new endpoint'
      });
    } catch (error) {
      console.error("IBKR bridge error:", error);
      res.status(500).json({ error: "Failed to process bridge data" });
    }
  });

  // OLD CODE KEPT FOR REFERENCE (completely disabled):
  /*
  app.post("/api/ibkr-bridge-OLD", async (req, res) => {
    try {
      const data = req.body;
      
      if (data.type === "connection") {
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
        const marketData: MarketData = {
          symbol: data.symbol,
          last_price: data.last_price,
          bid: data.bid,
          ask: data.ask,
          volume: data.volume,
          timestamp: data.timestamp,
        };
        
        // [DISABLED - CODE REMOVED]
      }
      res.json({ success: true - DISABLED });
    } catch (error) {
      console.error("IBKR bridge error:", error);
      res.status(500).json({ error: "Failed to process bridge data" });
    }
  });
  */

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
  
  // GET /api/footprint - Get footprint bars (PRO Course Stage 3 - Order Flow)
  app.get("/api/footprint", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const bars = await storage.getFootprintBars(limit);
      res.json(bars);
    } catch (error) {
      console.error("Footprint bars error:", error);
      res.status(500).json({ error: "Failed to retrieve footprint bars" });
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
  
  // GET /api/cva-stacking - Get stacked CVA levels (PRO Course - Historical CVA Reference Levels)
  app.get("/api/cva-stacking", async (req, res) => {
    try {
      const stackedLevels = cvaStackingManager.getStackedLevels();
      const historicalCVAs = cvaStackingManager.getHistoricalCVAs(10); // Last 10 days
      
      res.json({
        stacked_levels: stackedLevels,
        historical_cvas: historicalCVAs,
      });
    } catch (error) {
      console.error("CVA stacking error:", error);
      res.status(500).json({ error: "Failed to retrieve CVA stacking data" });
    }
  });
  
  // GET /api/opening-drive - Get opening drive detection (PRO Course Setup)
  app.get("/api/opening-drive", async (req, res) => {
    try {
      const candles = await storage.getCandles();
      const marketData = await storage.getMarketData();
      
      if (!marketData || candles.length === 0) {
        return res.json({
          detected: false,
          direction: null,
          strength: 0,
          opening_price: 0,
          current_price: marketData?.last_price || 0,
          price_move_ticks: 0,
          cumulative_delta: 0,
          retracement_pct: 0,
          time_elapsed_minutes: 0,
          valid_for_trade: false,
          entry_level: null,
        });
      }
      
      const openingDrive = openingDriveDetector.detectOpeningDrive(
        candles,
        marketData.last_price,
        Date.now()
      );
      
      res.json(openingDrive);
    } catch (error) {
      console.error("Opening drive error:", error);
      res.status(500).json({ error: "Failed to detect opening drive" });
    }
  });
  
  // GET /api/eighty-percent-rule - Get 80% Rule detection (PRO Course Setup)
  app.get("/api/eighty-percent-rule", async (req, res) => {
    try {
      const candles = await storage.getCandles();
      const marketData = await storage.getMarketData();
      
      if (!marketData || candles.length === 0) {
        return res.json({
          detected: false,
          direction: null,
          confidence: 0,
          opening_price: 0,
          opening_position: null,
          value_area_high: 0,
          value_area_low: 0,
          value_traveled_pct: 0,
          time_elapsed_minutes: 0,
          triggered_time: null,
          valid_for_trade: false,
          entry_level: null,
        });
      }
      
      const eightyPercentRule = eightyPercentRuleDetector.detect80PercentRule(
        candles,
        marketData.last_price,
        Date.now()
      );
      
      res.json(eightyPercentRule);
    } catch (error) {
      console.error("80% rule error:", error);
      res.status(500).json({ error: "Failed to detect 80% rule" });
    }
  });
  
  // GET /api/value-shift - Get enhanced value shift signals (PRO Course - 7 Conditions)
  app.get("/api/value-shift", async (req, res) => {
    try {
      await syncCompositeProfile(storage);
      
      const volumeProfile = await storage.getVolumeProfile();
      const marketData = await storage.getMarketData();
      const candles = await storage.getCandles();
      
      if (!volumeProfile || !marketData || candles.length === 0) {
        return res.json([]);
      }
      
      const compositeProfile = compositeProfileSystem.getCompositeProfile();
      
      if (!compositeProfile) {
        return res.json([]);
      }
      
      const valueShiftSignals = valueShiftDetector.detectValueShift(
        volumeProfile,
        compositeProfile,
        candles,
        marketData.last_price
      );
      
      res.json(valueShiftSignals);
    } catch (error) {
      console.error("Value shift error:", error);
      res.status(500).json({ error: "Failed to detect value shift signals" });
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
    
    // Activate trading fence on emergency stop (if safety manager ready)
    if (safetyManagerReady && safetyManager) {
      await safetyManager.activateTradingFence("Emergency stop activated");
    } else {
      console.log(`[SAFETY] ⚠️ Cannot activate fence - safety manager not yet initialized`);
    }

    res.json({ success: true, message: "Emergency stop executed - trading fence activated" });
  });

  // SAFETY ENDPOINTS - CRITICAL: These control trading safety features
  // SECURITY: Require auth key in environment - REFUSE TO START without it
  const SAFETY_AUTH_KEY = process.env.SAFETY_AUTH_KEY;
  if (!SAFETY_AUTH_KEY || SAFETY_AUTH_KEY.length < 32) {
    console.error("❌ FATAL: SAFETY_AUTH_KEY environment variable must be set and be at least 32 characters!");
    console.error("❌ This key protects trading safety endpoints from unauthorized access.");
    console.error("❌ Generate one with: openssl rand -hex 32");
    process.exit(1); // Refuse to start without proper security
  }
  console.log("✅ Safety authentication key validated");
  
  const requireSafetyAuth = (req: any, res: any, next: any) => {
    const authKey = req.headers['x-safety-auth-key'];
    if (!authKey || authKey !== SAFETY_AUTH_KEY) {
      console.warn(`[SECURITY] ⚠️ Unauthorized safety endpoint access attempt from ${req.ip} to ${req.path}`);
      return res.status(401).json({ error: "Unauthorized - invalid safety auth key" });
    }
    next();
  };

  // GET /api/safety/status - Get production safety status (read-only, no auth required)
  app.get("/api/safety/status", async (req, res) => {
    try {
      if (!safetyManagerReady || !safetyManager) {
        return res.status(503).json({ error: "Safety Manager not initialized - server starting up" });
      }
      const status = await storage.getSystemStatus();
      const daily_pnl = status?.daily_pnl || 0;
      const safetyStatus = safetyManager.getSafetyStatus(daily_pnl);
      res.json(safetyStatus);
    } catch (error) {
      console.error("Safety status error:", error);
      res.status(500).json({ error: "Failed to get safety status" });
    }
  });

  // POST /api/safety/config - Update safety configuration (REQUIRES AUTH)
  app.post("/api/safety/config", requireSafetyAuth, async (req, res) => {
    try {
      if (!safetyManagerReady || !safetyManager) {
        return res.status(503).json({ error: "Safety Manager not initialized - server starting up" });
      }
      
      // Validate required fields
      const { max_drawdown_gbp, max_position_size } = req.body;
      if (max_drawdown_gbp !== undefined && (typeof max_drawdown_gbp !== 'number' || max_drawdown_gbp > 0)) {
        return res.status(400).json({ error: "max_drawdown_gbp must be a negative number" });
      }
      if (max_position_size !== undefined && (typeof max_position_size !== 'number' || max_position_size < 1)) {
        return res.status(400).json({ error: "max_position_size must be a positive number" });
      }
      
      safetyManager.updateConfig(req.body);
      const newConfig = safetyManager.getConfig();
      console.log(`[SECURITY] Safety config updated by ${req.ip}:`, newConfig);
      res.json({ success: true, config: newConfig });
    } catch (error) {
      console.error("Safety config update error:", error);
      res.status(500).json({ error: "Failed to update safety config" });
    }
  });

  // POST /api/safety/fence/deactivate - Manually deactivate trading fence (REQUIRES AUTH)
  app.post("/api/safety/fence/deactivate", requireSafetyAuth, async (req, res) => {
    try {
      if (!safetyManagerReady || !safetyManager) {
        return res.status(503).json({ error: "Safety Manager not initialized - server starting up" });
      }
      
      await safetyManager.deactivateTradingFence();
      const status = await storage.getSystemStatus();
      const daily_pnl = status?.daily_pnl || 0;
      const safetyStatus = safetyManager.getSafetyStatus(daily_pnl);
      console.log(`[SECURITY] Trading fence deactivated by ${req.ip}`);
      res.json({ success: true, safety_status: safetyStatus });
    } catch (error) {
      console.error("Trading fence deactivation error:", error);
      res.status(500).json({ error: "Failed to deactivate trading fence" });
    }
  });

  // POST /api/order-confirmation - Handle order confirmation from IBKR bridge (REQUIRES AUTH)
  // SECURITY: This endpoint can manipulate order tracking - MUST be protected
  // The Python bridge must send the same auth key as other safety endpoints
  app.post("/api/order-confirmation", requireSafetyAuth, async (req, res) => {
    try {
      if (!safetyManagerReady || !safetyManager) {
        return res.status(503).json({ error: "Safety Manager not initialized - server starting up" });
      }
      
      const { order_id, status: orderStatus, filled_price, filled_time, reject_reason } = req.body;
      
      // Validate required fields
      if (!order_id || typeof order_id !== 'string') {
        return res.status(400).json({ error: "Missing or invalid order_id" });
      }
      if (!orderStatus || !['FILLED', 'REJECTED', 'CANCELLED'].includes(orderStatus)) {
        return res.status(400).json({ error: "Invalid status - must be FILLED, REJECTED, or CANCELLED" });
      }
      if (filled_price !== undefined && filled_price !== null && typeof filled_price !== 'number') {
        return res.status(400).json({ error: "filled_price must be a number" });
      }

      await safetyManager.processOrderConfirmation({
        order_id,
        status: orderStatus,
        filled_price,
        filled_time,
        reject_reason,
      });

      res.json({ success: true, message: "Order confirmation processed" });
    } catch (error) {
      console.error("Order confirmation processing error:", error);
      res.status(500).json({ error: "Failed to process order confirmation" });
    }
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

  // Initialize composite profile (will be populated from IBKR historical data via bridge)
  syncCompositeProfile(storage).then(() => {
    console.log("✓ Composite profile initialized");
  });

  // Periodic sync of composite profile (every 60 seconds)
  setInterval(async () => {
    await syncCompositeProfile(storage);
  }, 60000);

  return httpServer;
}
