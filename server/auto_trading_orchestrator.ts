/**
 * Auto-Trading Orchestrator - PRO Course Integration
 * 
 * Implements G7FX PRO methodology (90/10 rule):
 * - 90% Context: Value Areas, Profiles, VWAP (TradeRecommendations)
 * - 10% Order Flow: Confirmation signals (absorption, imbalances)
 * 
 * Ties together:
 * - HighProbabilitySetupRecognizer (PRIMARY: PRO methodology)
 * - OrderFlowStrategy (SECONDARY: confirmation filter)
 * - ProductionSafetyManager (validation)
 * - Pending orders queue
 */

import type { IStorage } from "./storage";
import type { AutoTrader, TradeSignal } from "./auto_trader";
import type { ProductionSafetyManager } from "./production_safety_manager";
import type { HighProbabilitySetupRecognizer, TradeRecommendation } from "./high_probability_setup_recognizer";
import type { CompositeProfileManager } from "./composite_profile";
import type { ValueMigrationDetector } from "./value_migration_detector";
import type { HypothesisGenerator } from "./hypothesis_generator";
import type { OrderFlowSignalDetector } from "./orderflow_signal_detector";

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
  private setupRecognizer: HighProbabilitySetupRecognizer;
  private compositeProfileSystem: CompositeProfileManager;
  private valueMigrationDetector: ValueMigrationDetector;
  private hypothesisGenerator: HypothesisGenerator;
  private orderFlowSignalDetector: OrderFlowSignalDetector;
  private safetyManager: ProductionSafetyManager;
  private pendingOrders: Map<string, PendingOrder>;
  private lastSignalId: string | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 1000; // 1s trailing timer
  private readonly MIN_CONFIDENCE = 75; // 75% confidence required
  private readonly MAX_POSITION_SIZE = 1; // 1 MES contract
  
  constructor(
    storage: IStorage,
    autoTrader: AutoTrader,
    setupRecognizer: HighProbabilitySetupRecognizer,
    compositeProfileSystem: CompositeProfileManager,
    valueMigrationDetector: ValueMigrationDetector,
    hypothesisGenerator: HypothesisGenerator,
    orderFlowSignalDetector: OrderFlowSignalDetector,
    safetyManager: ProductionSafetyManager,
    pendingOrders: Map<string, PendingOrder>
  ) {
    this.storage = storage;
    this.autoTrader = autoTrader;
    this.setupRecognizer = setupRecognizer;
    this.compositeProfileSystem = compositeProfileSystem;
    this.valueMigrationDetector = valueMigrationDetector;
    this.hypothesisGenerator = hypothesisGenerator;
    this.orderFlowSignalDetector = orderFlowSignalDetector;
    this.safetyManager = safetyManager;
    this.pendingOrders = pendingOrders;
  }
  
  /**
   * Event-driven market data handler
   * Called whenever new market data arrives via /api/bridge/data
   */
  onMarketDataUpdate(): void {
    console.log('[ORCHESTRATOR] 📥 onMarketDataUpdate() called - debouncing for 1s');
    
    // Debounce to avoid excessive analysis (wait for bar completion)
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      console.log('[ORCHESTRATOR] ⏰ Debounce timer fired - calling analyzeAndExecute()');
      this.analyzeAndExecute().catch(err => {
        console.error('[ORCHESTRATOR] ❌ Analysis failed:', err);
      });
    }, this.DEBOUNCE_MS);
  }
  
  /**
   * Core orchestration logic - PRO Course 90/10 Rule
   * 
   * PRIMARY (90%): Context-based setups from PRO methodology
   * SECONDARY (10%): Order flow confirmation
   * 
   * Flow:
   * 1. Check auto_trading_enabled
   * 2. Generate PRO methodology trade recommendations
   * 3. Filter for high-confidence setups (75%+)
   * 4. Use order flow analysis for confirmation boost
   * 5. Run safety checks
   * 6. Create pending order if all pass
   */
  private async analyzeAndExecute(): Promise<void> {
    try {
      console.log('[ORCHESTRATOR] 🔄 analyzeAndExecute() triggered');
      
      // Step 1: Check if auto-trading is enabled
      const systemStatus = await this.storage.getSystemStatus();
      if (!systemStatus || !systemStatus.auto_trading_enabled) {
        console.log('[ORCHESTRATOR] ⏸️ Auto-trading disabled, exiting');
        return; // Auto-trading disabled, do nothing
      }
      
      console.log('[ORCHESTRATOR] ✅ Auto-trading enabled, continuing...');
      
      // Step 2: Gather market data from storage and PRO managers
      const [
        marketData,
        position,
        vwapData,
        volumeProfile,
        absorptionEvents,
        domSnapshot,
        timeAndSales
      ] = await Promise.all([
        this.storage.getMarketData(),
        this.storage.getPosition(),
        this.storage.getVWAPData(),
        this.storage.getVolumeProfile(),
        this.storage.getAbsorptionEvents(50),
        this.storage.getDomSnapshot(),
        this.storage.getTimeAndSales(100),
      ]);
      
      if (!marketData || !position) {
        console.log('[ORCHESTRATOR] ⏸️ Missing critical data - Market:', !!marketData, 'Position:', !!position);
        return; // Missing critical data
      }
      
      // Don't open new positions if we already have one
      if (position.contracts !== 0) {
        console.log('[ORCHESTRATOR] ⏸️ Already in position:', position.contracts);
        return;
      }
      
      // Step 3: Get PRO methodology context from managers
      const compositeProfile = this.compositeProfileSystem.getCompositeProfile();
      if (!compositeProfile) {
        console.log('[ORCHESTRATOR] ⏸️ No composite profile available');
        return; // Need composite profile for PRO setups
      }
      
      const migration = this.valueMigrationDetector.detectMigration(volumeProfile || null, compositeProfile);
      
      // Generate hypothesis (using mock overnight data for now)
      const overnightHigh = marketData.last_price * 1.005;
      const overnightLow = marketData.last_price * 0.995;
      const hypothesis = this.hypothesisGenerator.generateHypothesis(
        overnightHigh,
        overnightLow,
        marketData.last_price,
        compositeProfile,
        null,
        migration,
        vwapData || null
      );
      
      const orderFlowSignals = this.orderFlowSignalDetector.getRecentSignals(20);
      
      // Validate VWAP data is complete
      if (!vwapData || vwapData.vwap === null || vwapData.sd1_upper === null || 
          vwapData.sd1_lower === null || vwapData.sd2_upper === null || vwapData.sd2_lower === null) {
        console.log('[ORCHESTRATOR] ⏸️ Incomplete VWAP data - exists:', !!vwapData, 'vwap:', vwapData?.vwap);
        return; // Need complete VWAP data
      }
      
      console.log('[ORCHESTRATOR] ✅ All data validated, generating PRO setups...');
      
      // Build market context for PRO methodology
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
          poc: volumeProfile?.poc || marketData.last_price,
          vah: volumeProfile?.vah || marketData.last_price,
          val: volumeProfile?.val || marketData.last_price,
        },
      };
      
      // Step 4: Generate PRO methodology trade recommendations (90% - CONTEXT)
      const recommendations = this.setupRecognizer.generateRecommendations(context);
      
      console.log(`[ORCHESTRATOR] 🎯 Generated ${recommendations.length} recommendations, Hypothesis: ${hypothesis.bias}`);
      
      // Filter for high-confidence active setups that MATCH hypothesis direction (PRO 90% rule)
      const validSetups = recommendations
        .filter(r => {
          // Must be active and meet minimum confidence
          if (!r.active || r.confidence < this.MIN_CONFIDENCE) {
            console.log(`[PRO-90/10] ⏭️ Skipped ${r.setup_type} - Active:${r.active} Confidence:${r.confidence}% < ${this.MIN_CONFIDENCE}%`);
            return false;
          }
          
          // CRITICAL: Only trade in direction aligned with daily hypothesis
          if (hypothesis.bias === 'BEARISH' && r.direction === 'LONG') {
            console.log(`[PRO-90/10] ❌ Rejected ${r.setup_type} - LONG conflicts with BEARISH hypothesis`);
            return false;
          }
          if (hypothesis.bias === 'BULLISH' && r.direction === 'SHORT') {
            console.log(`[PRO-90/10] ❌ Rejected ${r.setup_type} - SHORT conflicts with BULLISH hypothesis`);
            return false;
          }
          
          console.log(`[PRO-90/10] ✅ Accepted ${r.setup_type} - ${r.direction} @ ${r.confidence}% confidence`);
          return true;
        })
        .sort((a, b) => b.confidence - a.confidence);
      
      if (validSetups.length === 0) {
        console.log('[ORCHESTRATOR] ⏸️ No valid setups after filtering - waiting for better opportunity');
        return; // No high-confidence setups available that match hypothesis
      }
      
      // Step 5: Get the best setup and apply order flow confirmation (10% - ORDER FLOW)
      const bestSetup = validSetups[0];
      let finalConfidence = bestSetup.confidence;
      let confirmationDetails = bestSetup.orderflow_confirmation;
      
      // Use AutoTrader's OrderFlowStrategy for confirmation boost
      const orderflowSignal = this.autoTrader['orderflowStrategy'].analyzeOrderFlow(
        marketData.last_price,
        absorptionEvents || [],
        domSnapshot || null,
        timeAndSales || [],
        volumeProfile || null
      );
      
      // Apply order flow boost: Strong confirmation = +10-15%, Weak = +0-5%
      if (orderflowSignal.type !== 'NONE') {
        const directionMatches = 
          (bestSetup.direction === 'LONG' && orderflowSignal.type === 'LONG') ||
          (bestSetup.direction === 'SHORT' && orderflowSignal.type === 'SHORT');
        
        if (directionMatches) {
          // Order flow confirms the setup direction
          const boost = Math.min(15, orderflowSignal.confidence * 0.15);
          finalConfidence = Math.min(100, finalConfidence + boost);
          confirmationDetails += ` | OF Boost: +${boost.toFixed(0)}% (${orderflowSignal.reason})`;
          
          console.log(`[PRO-90/10] ✅ Order flow CONFIRMS ${bestSetup.setup_type} (+${boost.toFixed(0)}% confidence)`);
        } else if (orderflowSignal.confidence > 50) {
          // Strong opposite order flow = warning
          console.log(`[PRO-90/10] ⚠️ Order flow CONTRADICTS ${bestSetup.setup_type} - holding back`);
          return; // Don't trade against strong opposing order flow
        }
      }
      
      // Log the decision-making process
      console.log('─'.repeat(70));
      console.log(`[PRO-90/10] 📊 SETUP DETECTED: ${bestSetup.setup_type}`);
      console.log(`[CONTEXT-90%] ${bestSetup.context_reason}`);
      console.log(`[ORDERFLOW-10%] ${confirmationDetails}`);
      console.log(`[CONFIDENCE] Base: ${bestSetup.confidence}% → Final: ${finalConfidence.toFixed(0)}%`);
      console.log(`[ENTRY] ${marketData.last_price.toFixed(2)} | Stop: ${bestSetup.stop_loss.toFixed(2)} | Target: ${bestSetup.target_1.toFixed(2)}`);
      console.log(`[R:R] ${bestSetup.risk_reward_ratio.toFixed(2)}:1`);
      console.log('─'.repeat(70));
      
      // Step 6: Convert to TradeSignal for safety checks
      const signal: TradeSignal = {
        action: bestSetup.direction === 'LONG' ? 'BUY' : 'SELL',
        quantity: this.MAX_POSITION_SIZE,
        reason: `${bestSetup.setup_type}: ${bestSetup.context_reason}`,
        entry_price: bestSetup.entry_price,
        stop_loss: bestSetup.stop_loss,
        take_profit: bestSetup.target_1,
        confidence: finalConfidence,
        orderflow_signals: {
          absorption: confirmationDetails,
          profile_context: `${bestSetup.setup_type} - ${bestSetup.context_reason}`,
        },
      };
      
      // Step 7: Generate signal ID for idempotency
      const signalId = this.generateSignalId(signal);
      
      // Prevent duplicate execution of same signal
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
        action: signal.action as "BUY" | "SELL", // Safe: signal.action is always BUY or SELL at this point
        quantity: signal.quantity,
        timestamp: Date.now(),
        status: "PENDING",
      };
      
      this.pendingOrders.set(orderId, order);
      this.lastSignalId = signalId;
      
      // Track order in safety manager
      await this.safetyManager.trackOrder(signal, orderId);
      
      console.log('═'.repeat(70));
      console.log(`[ORCHESTRATOR] 🚀 AUTO-TRADE EXECUTING`);
      console.log(`   Setup: ${bestSetup.setup_type}`);
      console.log(`   Action: ${signal.action} ${signal.quantity} MES @ ${signal.entry_price?.toFixed(2)}`);
      console.log(`   Stop: ${signal.stop_loss?.toFixed(2)} | Target: ${signal.take_profit?.toFixed(2)}`);
      console.log(`   Confidence: ${finalConfidence.toFixed(0)}% (PRO: ${bestSetup.confidence}% + OF Boost)`);
      console.log(`   Order ID: ${orderId}`);
      console.log(`   Safety: ✅ ${safetyStatus.reason}`);
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
