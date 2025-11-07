/**
 * Auto-Trading Orchestrator - Missing Critical Component
 * 
 * Ties together:
 * - AutoTrader signal generation
 * - ProductionSafetyManager validation
 * - Pending orders queue
 * 
 * Orchestrates automatic trade execution when auto_trading_enabled is true
 */

import type { IStorage } from "./storage";
import type { AutoTrader, TradeSignal } from "./auto_trader";
import type { ProductionSafetyManager } from "./production_safety_manager";

export interface PendingOrder {
  id: string;
  action: "BUY" | "SELL" | "CLOSE";
  quantity: number;
  timestamp: number;
  status: "PENDING" | "EXECUTED" | "FAILED" | "EXPIRED";
}

export class AutoTradingOrchestrator {
  private storage: IStorage;
  private autoTrader: AutoTrader;
  private safetyManager: ProductionSafetyManager;
  private pendingOrders: Map<string, PendingOrder>;
  private lastSignalId: string | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 1000; // 1s trailing timer
  private readonly MIN_CONFIDENCE = 75; // 75% confidence required
  
  constructor(
    storage: IStorage,
    autoTrader: AutoTrader,
    safetyManager: ProductionSafetyManager,
    pendingOrders: Map<string, PendingOrder>
  ) {
    this.storage = storage;
    this.autoTrader = autoTrader;
    this.safetyManager = safetyManager;
    this.pendingOrders = pendingOrders;
  }
  
  /**
   * Event-driven market data handler
   * Called whenever new market data arrives via /api/bridge/data
   */
  onMarketDataUpdate(): void {
    // Debounce to avoid excessive analysis (wait for bar completion)
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.analyzeAndExecute().catch(err => {
        console.error('[ORCHESTRATOR] ❌ Analysis failed:', err);
      });
    }, this.DEBOUNCE_MS);
  }
  
  /**
   * Core orchestration logic
   * 1. Check auto_trading_enabled
   * 2. Call autoTrader.analyzeMarket()
   * 3. Validate signal confidence >= 75%
   * 4. Run safety checks
   * 5. Create pending order if all pass
   */
  private async analyzeAndExecute(): Promise<void> {
    try {
      // Step 1: Check if auto-trading is enabled
      const systemStatus = await this.storage.getSystemStatus();
      if (!systemStatus || !systemStatus.auto_trading_enabled) {
        return; // Auto-trading disabled, do nothing
      }
      
      // Step 2: Gather market data for analysis
      const [marketData, absorptionEvents, domSnapshot, timeAndSales, volumeProfile, position] = 
        await Promise.all([
          this.storage.getMarketData(),
          this.storage.getAbsorptionEvents(50),
          this.storage.getDomSnapshot(),
          this.storage.getTimeAndSales(100),
          this.storage.getVolumeProfile(),
          this.storage.getPosition(),
        ]);
      
      if (!marketData || !position) {
        console.log('[ORCHESTRATOR] ⚠️ Market data or position not available');
        return;
      }
      
      // Step 3: Analyze market using AutoTrader
      const signal = this.autoTrader.analyzeMarket(
        marketData,
        absorptionEvents || [],
        domSnapshot || null,
        timeAndSales || [],
        volumeProfile || null,
        position
      );
      
      // Step 4: Check if signal is actionable
      if (signal.action === "NONE") {
        return; // No trade signal
      }
      
      // Step 5: Validate confidence threshold (75%+)
      if (signal.confidence && signal.confidence < this.MIN_CONFIDENCE) {
        console.log(`[ORCHESTRATOR] 📊 Signal confidence too low: ${signal.confidence}% < ${this.MIN_CONFIDENCE}%`);
        return;
      }
      
      // Step 6: Generate signal ID for idempotency
      const signalId = this.generateSignalId(signal);
      
      // Step 7: Prevent duplicate execution of same signal
      if (signalId === this.lastSignalId) {
        return; // Same signal as last time, don't re-execute
      }
      
      // Step 8: Run safety checks via ProductionSafetyManager
      const safetyStatus = await this.safetyManager.canExecuteTrade(
        signal,
        position,
        systemStatus.daily_pnl || 0,
        systemStatus.ibkr_connected || false
      );
      
      if (!safetyStatus.trading_allowed) {
        console.log(`[ORCHESTRATOR] 🚨 Safety check FAILED: ${safetyStatus.reason}`);
        console.log(`[ORCHESTRATOR]    Violations: ${safetyStatus.violations.join(', ')}`);
        return;
      }
      
      // Step 9: All checks passed - create pending order
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const order: PendingOrder = {
        id: orderId,
        action: signal.action === "CLOSE" ? "CLOSE" : signal.action,
        quantity: signal.quantity,
        timestamp: Date.now(),
        status: "PENDING",
      };
      
      this.pendingOrders.set(orderId, order);
      this.lastSignalId = signalId;
      
      // Track order in safety manager
      await this.safetyManager.trackOrder(signal, orderId);
      
      console.log('═'.repeat(70));
      console.log(`[ORCHESTRATOR] 🚀 AUTO-TRADE SIGNAL DETECTED`);
      console.log(`   Action: ${signal.action} ${signal.quantity} MES`);
      console.log(`   Price: ${signal.entry_price?.toFixed(2)}`);
      console.log(`   Confidence: ${signal.confidence}%`);
      console.log(`   Reason: ${signal.reason}`);
      console.log(`   Order ID: ${orderId}`);
      console.log(`   Safety Status: ✅ ${safetyStatus.reason}`);
      console.log('═'.repeat(70));
      
    } catch (error) {
      console.error('[ORCHESTRATOR] ❌ Execution error:', error);
    }
  }
  
  /**
   * Generate unique signal ID for idempotency
   * Handles missing or short reason strings safely
   */
  private generateSignalId(signal: TradeSignal): string {
    const reason = (signal.reason || 'NO_REASON').substring(0, 20);
    return `${signal.action}_${signal.entry_price?.toFixed(2)}_${reason}`;
  }
  
  /**
   * Reset orchestrator state (for testing or manual reset)
   */
  reset(): void {
    this.lastSignalId = null;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
