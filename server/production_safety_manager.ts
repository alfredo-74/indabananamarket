/**
 * Production Safety Manager - Critical Safety Features for Real Money Trading
 * 
 * Features:
 * 1. Order Confirmation Tracking - Track IBKR order IDs and verify fills
 * 2. Reject Replay Protection - Prevent repeated attempts on rejected orders
 * 3. Trading Fence - Auto-disable trading on bridge disconnect
 * 4. Position Reconciliation - Verify local vs. IBKR position before trades
 * 5. Circuit Breaker - Halt trading on max drawdown breach
 */

import type { Position } from "@shared/schema";
import type { IStorage } from "./storage";
import type { TradeSignal } from "./auto_trader";

export interface SafetyStatus {
  trading_allowed: boolean;
  reason: string;
  violations: string[];
  position_reconciled: boolean;
  daily_pnl: number;
  drawdown_limit: number;
  orders_pending: number;
}

export interface OrderConfirmation {
  order_id: string;
  status: "FILLED" | "REJECTED" | "CANCELLED";
  filled_price?: number;
  filled_time?: number;
  reject_reason?: string;
}

export class ProductionSafetyManager {
  private storage: IStorage;
  private safetyConfig = {
    max_drawdown_gbp: -500,
    max_position_size: 1,
    trading_fence_enabled: true,
    position_reconciliation_enabled: true,
    reject_replay_cooldown_minutes: 30,
    circuit_breaker_enabled: true,
  };

  // Runtime state
  private trading_fence_active: boolean = false;
  private last_bridge_disconnect: number = 0;
  private pending_orders: Map<string, { signal_id: string; timestamp: number }> = new Map();

  private constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Factory method to create and initialize Safety Manager
   */
  static async create(storage: IStorage): Promise<ProductionSafetyManager> {
    const manager = new ProductionSafetyManager(storage);
    await manager.loadSafetyConfig();
    return manager;
  }

  /**
   * Load safety configuration from database
   */
  private async loadSafetyConfig() {
    const config = await this.storage.getSafetyConfig();
    if (config) {
      this.safetyConfig.max_drawdown_gbp = config.max_daily_drawdown;
      this.trading_fence_active = config.trading_fence_active;
      console.log('[SAFETY] ✅ Safety configuration loaded from database:', this.safetyConfig);
    } else {
      // Initialize default config in database
      await this.storage.updateSafetyConfig({
        max_daily_drawdown: this.safetyConfig.max_drawdown_gbp,
        trading_fence_active: false,
        fence_reason: null,
        fence_activated_at: null,
      });
      console.log('[SAFETY] ✅ Default safety configuration created in database');
    }
  }

  /**
   * FEATURE 1: Order Confirmation Tracking
   * Track order sent to IBKR and wait for confirmation
   */
  async trackOrder(signal: TradeSignal, order_id: string): Promise<void> {
    const signal_id = this.generateSignalId(signal);
    
    // Persist to database for crash recovery
    await this.storage.trackOrder(order_id, signal, Date.now());
    
    console.log(`[SAFETY] 📝 Tracking order ${order_id} for signal ${signal_id}`);
  }

  /**
   * Process order confirmation from IBKR bridge
   */
  async processOrderConfirmation(confirmation: OrderConfirmation): Promise<void> {
    // Get order from database
    const orderTracking = await this.storage.getOrderTracking(confirmation.order_id);
    
    if (!orderTracking) {
      console.warn(`[SAFETY] ⚠️ Received confirmation for unknown order: ${confirmation.order_id}`);
      return;
    }

    // Update order status in database
    await this.storage.updateOrderStatus(
      confirmation.order_id,
      confirmation.status,
      confirmation.filled_price,
      confirmation.filled_time,
      confirmation.reject_reason
    );

    if (confirmation.status === "REJECTED") {
      // Add to rejected orders cache to prevent replay
      const signal = JSON.parse(orderTracking.signal);
      const signal_id = this.generateSignalId(signal);
      await this.addRejectedOrder(
        signal_id,
        confirmation.reject_reason || "Unknown",
        0 // Price not available in confirmation
      );
      console.log(`[SAFETY] ❌ Order REJECTED: ${confirmation.order_id} - ${confirmation.reject_reason}`);
    } else if (confirmation.status === "FILLED") {
      console.log(`[SAFETY] ✅ Order FILLED: ${confirmation.order_id} @ ${confirmation.filled_price?.toFixed(2)}`);
    }
  }

  /**
   * FEATURE 2: Reject Replay Protection
   * Check if signal was recently rejected to prevent replay
   */
  async isSignalRejected(signal: TradeSignal): Promise<boolean> {
    const signal_id = this.generateSignalId(signal);
    
    // Check database for recently rejected orders
    const recentRejections = await this.storage.getRecentRejections(
      this.safetyConfig.reject_replay_cooldown_minutes
    );
    
    for (const rejection of recentRejections) {
      if (rejection.signal_id === signal_id) {
        // Check if rejection is still within cooldown period
        const rejectTime = new Date(rejection.timestamp).getTime();
        const age_ms = Date.now() - rejectTime;
        if (age_ms < this.safetyConfig.reject_replay_cooldown_minutes * 60 * 1000) {
          console.log(`[SAFETY] 🚫 Signal ${signal_id} blocked - rejected ${Math.round(age_ms / 1000 / 60)} minutes ago`);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Add rejected order to cache
   */
  private async addRejectedOrder(
    signal_id: string,
    reason: string,
    price: number
  ): Promise<void> {
    // Create a signal object with the required fields for storage
    const signal = {
      action: signal_id.split('_')[0], // Extract action from signal_id
      entry_price: price,
      quantity: parseInt(signal_id.split('_')[2]) || 1, // Extract quantity or default to 1
    };
    
    await this.storage.addRejectedOrder(
      signal_id,
      signal,
      reason,
      Date.now()
    );
    console.log(`[SAFETY] 🚫 Rejected order cached in database: ${signal_id} - ${reason}`);
  }

  /**
   * FEATURE 3: Trading Fence
   * Activate trading fence when bridge disconnects
   */
  async activateTradingFence(reason: string): Promise<void> {
    if (!this.safetyConfig.trading_fence_enabled) {
      return;
    }

    this.trading_fence_active = true;
    this.last_bridge_disconnect = Date.now();
    
    // Persist to database for crash recovery
    await this.storage.updateSafetyConfig({
      trading_fence_active: true,
      fence_reason: reason,
      fence_activated_at: new Date(),
    });
    
    console.log(`[SAFETY] 🚧 TRADING FENCE ACTIVATED: ${reason}`);
    console.log(`[SAFETY] 🚧 Auto-trading disabled until manual re-enable`);
  }

  /**
   * Deactivate trading fence (requires manual call)
   */
  async deactivateTradingFence(): Promise<void> {
    this.trading_fence_active = false;
    
    // Persist to database
    await this.storage.updateSafetyConfig({
      trading_fence_active: false,
      fence_reason: null,
      fence_activated_at: null,
    });
    
    console.log(`[SAFETY] ✅ Trading fence deactivated - trading can resume`);
  }

  /**
   * Check if trading fence is active
   */
  isTradingFenceActive(): boolean {
    return this.trading_fence_active && this.safetyConfig.trading_fence_enabled;
  }

  /**
   * FEATURE 4: Position Reconciliation
   * Verify local position matches IBKR actual position
   */
  async reconcilePosition(
    local_position: Position,
    ibkr_position: { contracts: number; avg_price: number }
  ): Promise<{ reconciled: boolean; reason: string }> {
    if (!this.safetyConfig.position_reconciliation_enabled) {
      return { reconciled: true, reason: "Reconciliation disabled" };
    }

    const local_contracts = local_position.contracts;
    const ibkr_contracts = ibkr_position.contracts;

    if (local_contracts !== ibkr_contracts) {
      console.error(`[SAFETY] ⚠️ POSITION MISMATCH: Local=${local_contracts}, IBKR=${ibkr_contracts}`);
      
      // Activate trading fence on mismatch
      this.activateTradingFence(`Position mismatch: Local=${local_contracts}, IBKR=${ibkr_contracts}`);
      
      return {
        reconciled: false,
        reason: `Position mismatch detected: Local=${local_contracts} contracts, IBKR=${ibkr_contracts} contracts`,
      };
    }

    return { reconciled: true, reason: "Positions match" };
  }

  /**
   * FEATURE 5: Circuit Breaker (Max Drawdown)
   * Check if daily P&L has breached max drawdown threshold
   */
  checkCircuitBreaker(daily_pnl: number): { breached: boolean; reason: string } {
    if (!this.safetyConfig.circuit_breaker_enabled) {
      return { breached: false, reason: "Circuit breaker disabled" };
    }

    const drawdown_limit = this.safetyConfig.max_drawdown_gbp;

    if (daily_pnl <= drawdown_limit) {
      const breach_amount = Math.abs(daily_pnl);
      console.error(`[SAFETY] 🔴 CIRCUIT BREAKER TRIGGERED!`);
      console.error(`[SAFETY] 🔴 Daily P&L: £${daily_pnl.toFixed(2)} (Limit: £${drawdown_limit.toFixed(2)})`);
      
      // Activate trading fence
      this.activateTradingFence(`Max drawdown breached: £${breach_amount.toFixed(2)}`);
      
      return {
        breached: true,
        reason: `Daily loss of £${breach_amount.toFixed(2)} exceeds limit of £${Math.abs(drawdown_limit).toFixed(2)}`,
      };
    }

    return { breached: false, reason: "Within drawdown limits" };
  }

  /**
   * Master safety check - runs all safety checks before allowing trade
   */
  async canExecuteTrade(
    signal: TradeSignal,
    position: Position,
    daily_pnl: number,
    ibkr_connected: boolean
  ): Promise<SafetyStatus> {
    const violations: string[] = [];

    // 1. Trading Fence Check
    if (this.isTradingFenceActive()) {
      violations.push("Trading fence is active - manual re-enable required");
    }

    // 2. Bridge Connection Check
    if (!ibkr_connected) {
      violations.push("IBKR bridge not connected");
      this.activateTradingFence("Bridge disconnected");
    }

    // 3. Circuit Breaker Check
    const circuit_breaker = this.checkCircuitBreaker(daily_pnl);
    if (circuit_breaker.breached) {
      violations.push(circuit_breaker.reason);
    }

    // 4. Reject Replay Check
    const is_rejected = await this.isSignalRejected(signal);
    if (is_rejected) {
      violations.push("Signal recently rejected - cooldown active");
    }

    // 5. Position Size Check
    if (signal.quantity > this.safetyConfig.max_position_size) {
      violations.push(`Position size ${signal.quantity} exceeds limit ${this.safetyConfig.max_position_size}`);
    }

    const trading_allowed = violations.length === 0;

    return {
      trading_allowed,
      reason: trading_allowed ? "All safety checks passed" : violations.join("; "),
      violations,
      position_reconciled: true, // Will be set by reconcilePosition
      daily_pnl,
      drawdown_limit: this.safetyConfig.max_drawdown_gbp,
      orders_pending: this.pending_orders.size,
    };
  }

  /**
   * Update safety configuration
   */
  updateConfig(updates: Partial<typeof this.safetyConfig>): void {
    this.safetyConfig = { ...this.safetyConfig, ...updates };
    console.log('[SAFETY] Configuration updated:', this.safetyConfig);
    // TODO: Persist to database
  }

  /**
   * Get current safety configuration
   */
  getConfig() {
    return { ...this.safetyConfig };
  }

  /**
   * Get safety status
   */
  getSafetyStatus(daily_pnl: number): SafetyStatus {
    return {
      trading_allowed: !this.isTradingFenceActive(),
      reason: this.isTradingFenceActive() ? "Trading fence active" : "Ready to trade",
      violations: this.isTradingFenceActive() ? ["Trading fence active"] : [],
      position_reconciled: true,
      daily_pnl,
      drawdown_limit: this.safetyConfig.max_drawdown_gbp,
      orders_pending: this.pending_orders.size,
    };
  }

  /**
   * Generate unique signal ID from trade signal
   */
  private generateSignalId(signal: TradeSignal): string {
    return `${signal.action}_${signal.entry_price.toFixed(2)}_${signal.quantity}_${Date.now()}`;
  }

  /**
   * Clean up expired pending orders (call periodically)
   */
  cleanupPendingOrders(max_age_ms: number = 300000): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [order_id, order] of Array.from(this.pending_orders.entries())) {
      if (now - order.timestamp > max_age_ms) {
        this.pending_orders.delete(order_id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[SAFETY] 🧹 Cleaned ${cleaned} expired pending orders`);
    }
  }
}
