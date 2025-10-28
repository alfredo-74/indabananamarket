/**
 * High-Probability Setup Recognizer
 * 
 * G7FX PRO Course: Combining Context + Order Flow for Trade Recommendations
 * 
 * This engine implements rule-based discretionary trading logic from the PRO course:
 * - Value Area Fades (mean reversion from VAH/VAL extremes)
 * - Value Area Breakouts (initiative trading beyond value)
 * - VWAP Bounces (SD-1/SD-2 reversals)
 * - 80% Rule (overnight inventory)
 * - Opening Drive Recognition
 * 
 * CRITICAL: NO machine learning. Pure rule-based logic following PRO methodology.
 * Context (profiles, VWAP, migration) = 90%
 * Order Flow signals = 10% (confirmation only)
 */

import type { CompositeProfileData, ValueMigrationData, DailyHypothesis, OrderFlowSignal } from "@shared/schema";

export interface TradeRecommendation {
  setup_type: 
    | "VA_FADE_LONG"
    | "VA_FADE_SHORT"
    | "VA_BREAKOUT_LONG"
    | "VA_BREAKOUT_SHORT"
    | "VWAP_BOUNCE_LONG"
    | "VWAP_BOUNCE_SHORT"
    | "RULE_80_LONG"
    | "RULE_80_SHORT"
    | "OPENING_DRIVE_LONG"
    | "OPENING_DRIVE_SHORT";
  
  direction: "LONG" | "SHORT";
  entry_price: number;
  stop_loss: number;
  target_1: number;
  target_2: number;
  confidence: number; // 0-100
  risk_reward_ratio: number;
  
  context_reason: string; // Why this setup (profiles, VWAP, migration)
  orderflow_confirmation: string; // Order flow signals that confirm
  invalidation_criteria: string; // What invalidates this trade
  
  timestamp: number;
  active: boolean; // Is this setup still valid?
}

export interface MarketContext {
  currentPrice: number;
  compositeProfile: CompositeProfileData;
  valueMigration: ValueMigrationData;
  hypothesis: DailyHypothesis;
  orderFlowSignals: OrderFlowSignal[];
  vwap: number;
  vwapSD1Upper: number;
  vwapSD1Lower: number;
  vwapSD2Upper: number;
  vwapSD2Lower: number;
  volumeProfile: {
    poc: number;
    vah: number;
    val: number;
  };
}

export class HighProbabilitySetupRecognizer {
  private activeRecommendations: TradeRecommendation[] = [];
  private maxRecommendations = 5;

  /**
   * Main entry point: Analyze market and generate trade recommendations
   */
  generateRecommendations(context: MarketContext): TradeRecommendation[] {
    const newRecommendations: TradeRecommendation[] = [];

    // 1. Value Area Fades (Mean Reversion from Extremes)
    const vaFade = this.detectValueAreaFade(context);
    if (vaFade) newRecommendations.push(vaFade);

    // 2. Value Area Breakouts (Initiative Trading)
    const vaBreakout = this.detectValueAreaBreakout(context);
    if (vaBreakout) newRecommendations.push(vaBreakout);

    // 3. VWAP Bounces (Standard Deviation Reversals)
    const vwapBounce = this.detectVWAPBounce(context);
    if (vwapBounce) newRecommendations.push(vwapBounce);

    // 4. 80% Rule (Overnight Inventory)
    const rule80 = this.detectRule80Setup(context);
    if (rule80) newRecommendations.push(rule80);

    // 5. Opening Drive
    const openingDrive = this.detectOpeningDrive(context);
    if (openingDrive) newRecommendations.push(openingDrive);

    // Update active recommendations
    this.activeRecommendations.push(...newRecommendations);
    this.cleanOldRecommendations();
    
    // Invalidate recommendations that no longer apply
    this.validateActiveRecommendations(context);

    return this.activeRecommendations.filter((r) => r.active);
  }

  /**
   * Detect Value Area Fade Setup
   * 
   * Price at VAH/VAL extreme with order flow showing exhaustion
   * High probability mean reversion back to POC/VWAP
   */
  private detectValueAreaFade(context: MarketContext): TradeRecommendation | null {
    const { currentPrice, compositeProfile, orderFlowSignals, vwap } = context;
    const { composite_vah, composite_val, composite_poc } = compositeProfile;

    // Check if price is at composite VAH (fade short setup)
    const atVAH = currentPrice >= composite_vah && currentPrice <= composite_vah * 1.001;
    
    // Check if price is at composite VAL (fade long setup)
    const atVAL = currentPrice <= composite_val && currentPrice >= composite_val * 0.999;

    if (!atVAH && !atVAL) return null;

    // Look for exhaustion signals in order flow
    const exhaustion = orderFlowSignals.find(
      (s) => s.signal_type.includes("EXHAUSTION") || s.signal_type === "LACK_OF_PARTICIPATION"
    );

    const lackOfParticipation = orderFlowSignals.find((s) => s.signal_type === "LACK_OF_PARTICIPATION");

    if (atVAH && (exhaustion?.direction === "BEARISH" || lackOfParticipation?.direction === "BEARISH")) {
      // Fade from VAH (SHORT setup)
      const entry = composite_vah;
      const stop = composite_vah * 1.002; // 2 ticks above VAH
      const target1 = composite_poc; // First target: POC
      const target2 = vwap; // Second target: VWAP
      
      const risk = stop - entry;
      const reward = entry - target2;
      
      return {
        setup_type: "VA_FADE_SHORT",
        direction: "SHORT",
        entry_price: entry,
        stop_loss: stop,
        target_1: target1,
        target_2: target2,
        confidence: 80,
        risk_reward_ratio: reward / risk,
        context_reason: `Price at CVA VAH (${composite_vah.toFixed(2)}). Composite POC at ${composite_poc.toFixed(2)}. High probability mean reversion to value.`,
        orderflow_confirmation: exhaustion 
          ? `${exhaustion.signal_type}: ${exhaustion.description}` 
          : "Lack of participation confirming weakness",
        invalidation_criteria: `Price closes above ${stop.toFixed(2)} (VAH + 2 ticks)`,
        timestamp: Date.now(),
        active: true,
      };
    }

    if (atVAL && (exhaustion?.direction === "BULLISH" || lackOfParticipation?.direction === "BULLISH")) {
      // Fade from VAL (LONG setup)
      const entry = composite_val;
      const stop = composite_val * 0.998; // 2 ticks below VAL
      const target1 = composite_poc;
      const target2 = vwap;
      
      const risk = entry - stop;
      const reward = target2 - entry;
      
      return {
        setup_type: "VA_FADE_LONG",
        direction: "LONG",
        entry_price: entry,
        stop_loss: stop,
        target_1: target1,
        target_2: target2,
        confidence: 80,
        risk_reward_ratio: reward / risk,
        context_reason: `Price at CVA VAL (${composite_val.toFixed(2)}). Composite POC at ${composite_poc.toFixed(2)}. High probability mean reversion to value.`,
        orderflow_confirmation: exhaustion 
          ? `${exhaustion.signal_type}: ${exhaustion.description}` 
          : "Lack of participation confirming strength",
        invalidation_criteria: `Price closes below ${stop.toFixed(2)} (VAL - 2 ticks)`,
        timestamp: Date.now(),
        active: true,
      };
    }

    return null;
  }

  /**
   * Detect Value Area Breakout Setup
   * 
   * Price breaking above VAH or below VAL with initiative buying/selling
   * Confirms new directional move (NOT mean reversion)
   */
  private detectValueAreaBreakout(context: MarketContext): TradeRecommendation | null {
    const { currentPrice, compositeProfile, orderFlowSignals } = context;
    const { composite_vah, composite_val, composite_poc } = compositeProfile;

    // Check for initiative trading signals
    const initiativeBuying = orderFlowSignals.find((s) => s.signal_type === "INITIATIVE_BUYING");
    const initiativeSelling = orderFlowSignals.find((s) => s.signal_type === "INITIATIVE_SELLING");
    const stackedImbalance = orderFlowSignals.find((s) => s.signal_type === "STACKED_IMBALANCE");

    // Breakout above VAH (LONG setup)
    const aboveVAH = currentPrice > composite_vah * 1.001;
    if (aboveVAH && (initiativeBuying || (stackedImbalance?.direction === "BULLISH"))) {
      const entry = currentPrice;
      const stop = composite_vah; // Stop at VAH (rejection = failed breakout)
      const target1 = entry + (entry - composite_poc) * 0.5; // Project POC-to-VAH distance
      const target2 = entry + (entry - composite_poc); // Full projection
      
      const risk = entry - stop;
      const reward = target2 - entry;
      
      return {
        setup_type: "VA_BREAKOUT_LONG",
        direction: "LONG",
        entry_price: entry,
        stop_loss: stop,
        target_1: target1,
        target_2: target2,
        confidence: 75,
        risk_reward_ratio: reward / risk,
        context_reason: `Breakout above CVA VAH (${composite_vah.toFixed(2)}). Initiative buying confirms new business.`,
        orderflow_confirmation: initiativeBuying 
          ? initiativeBuying.description 
          : stackedImbalance?.description || "Strong buy imbalances",
        invalidation_criteria: `Price closes back below VAH (${composite_vah.toFixed(2)})`,
        timestamp: Date.now(),
        active: true,
      };
    }

    // Breakout below VAL (SHORT setup)
    const belowVAL = currentPrice < composite_val * 0.999;
    if (belowVAL && (initiativeSelling || (stackedImbalance?.direction === "BEARISH"))) {
      const entry = currentPrice;
      const stop = composite_val;
      const target1 = entry - (composite_poc - entry) * 0.5;
      const target2 = entry - (composite_poc - entry);
      
      const risk = stop - entry;
      const reward = entry - target2;
      
      return {
        setup_type: "VA_BREAKOUT_SHORT",
        direction: "SHORT",
        entry_price: entry,
        stop_loss: stop,
        target_1: target1,
        target_2: target2,
        confidence: 75,
        risk_reward_ratio: reward / risk,
        context_reason: `Breakout below CVA VAL (${composite_val.toFixed(2)}). Initiative selling confirms new business.`,
        orderflow_confirmation: initiativeSelling 
          ? initiativeSelling.description 
          : stackedImbalance?.description || "Strong sell imbalances",
        invalidation_criteria: `Price closes back above VAL (${composite_val.toFixed(2)})`,
        timestamp: Date.now(),
        active: true,
      };
    }

    return null;
  }

  /**
   * Detect VWAP Bounce Setup
   * 
   * Price at VWAP SD-1 or SD-2 with absorption or responsive trading
   * High probability bounce back to VWAP
   */
  private detectVWAPBounce(context: MarketContext): TradeRecommendation | null {
    const { currentPrice, vwap, vwapSD1Lower, vwapSD1Upper, vwapSD2Lower, orderFlowSignals } = context;

    // Check for absorption or responsive trading
    const absorption = orderFlowSignals.find((s) => 
      s.signal_type === "ABSORPTION_BUY" || s.signal_type === "ABSORPTION_SELL"
    );
    const responsive = orderFlowSignals.find((s) => s.signal_type.includes("RESPONSIVE"));

    // Bounce from SD-1 Lower (LONG setup)
    const atSD1Lower = Math.abs(currentPrice - vwapSD1Lower) < vwapSD1Lower * 0.001;
    if (atSD1Lower && (absorption?.signal_type === "ABSORPTION_BUY" || responsive?.direction === "BULLISH")) {
      const entry = vwapSD1Lower;
      const stop = vwapSD2Lower;
      const target1 = vwap;
      const target2 = vwapSD1Upper;
      
      const risk = entry - stop;
      const reward = target1 - entry;
      
      return {
        setup_type: "VWAP_BOUNCE_LONG",
        direction: "LONG",
        entry_price: entry,
        stop_loss: stop,
        target_1: target1,
        target_2: target2,
        confidence: 70,
        risk_reward_ratio: reward / risk,
        context_reason: `Price at VWAP -SD1 (${vwapSD1Lower.toFixed(2)}). Mean reversion setup to VWAP (${vwap.toFixed(2)}).`,
        orderflow_confirmation: absorption ? `Buy absorption at ${entry.toFixed(2)}` : "Responsive buying",
        invalidation_criteria: `Price breaks below ${vwapSD2Lower.toFixed(2)} (VWAP -SD2)`,
        timestamp: Date.now(),
        active: true,
      };
    }

    // Bounce from SD-1 Upper (SHORT setup)
    const atSD1Upper = Math.abs(currentPrice - vwapSD1Upper) < vwapSD1Upper * 0.001;
    if (atSD1Upper && (absorption?.signal_type === "ABSORPTION_SELL" || responsive?.direction === "BEARISH")) {
      const entry = vwapSD1Upper;
      const stop = context.vwapSD2Upper;
      const target1 = vwap;
      const target2 = vwapSD1Lower;
      
      const risk = stop - entry;
      const reward = entry - target1;
      
      return {
        setup_type: "VWAP_BOUNCE_SHORT",
        direction: "SHORT",
        entry_price: entry,
        stop_loss: stop,
        target_1: target1,
        target_2: target2,
        confidence: 70,
        risk_reward_ratio: reward / risk,
        context_reason: `Price at VWAP +SD1 (${vwapSD1Upper.toFixed(2)}). Mean reversion setup to VWAP (${vwap.toFixed(2)}).`,
        orderflow_confirmation: absorption ? `Sell absorption at ${entry.toFixed(2)}` : "Responsive selling",
        invalidation_criteria: `Price breaks above ${stop.toFixed(2)} (VWAP +SD2)`,
        timestamp: Date.now(),
        active: true,
      };
    }

    return null;
  }

  /**
   * Detect 80% Rule Setup
   * 
   * If price travels 80% of overnight range in first hour, expect continuation
   * Based on James Dalton's Mind Over Markets
   * 
   * NOTE: Requires overnight high/low data (to be implemented in future enhancement)
   */
  private detectRule80Setup(context: MarketContext): TradeRecommendation | null {
    // TODO: Implement 80% rule once overnight data is added to hypothesis
    // For now, return null (can be enhanced later with overnight session tracking)
    return null;
  }

  /**
   * Detect Opening Drive Setup
   * 
   * Strong directional move in first 30 minutes
   * Look for continuation or exhaustion
   */
  private detectOpeningDrive(context: MarketContext): TradeRecommendation | null {
    // Implementation depends on having session time data
    // For now, return null (can be enhanced with session tracking)
    return null;
  }

  /**
   * Validate active recommendations against current market
   */
  private validateActiveRecommendations(context: MarketContext): void {
    const { currentPrice } = context;

    for (const rec of this.activeRecommendations) {
      if (!rec.active) continue;

      // Invalidate if stop hit
      if (rec.direction === "LONG" && currentPrice <= rec.stop_loss) {
        rec.active = false;
      }
      if (rec.direction === "SHORT" && currentPrice >= rec.stop_loss) {
        rec.active = false;
      }

      // Invalidate if target 2 hit (trade complete)
      if (rec.direction === "LONG" && currentPrice >= rec.target_2) {
        rec.active = false;
      }
      if (rec.direction === "SHORT" && currentPrice <= rec.target_2) {
        rec.active = false;
      }
    }
  }

  /**
   * Clean old recommendations (older than 1 hour)
   */
  private cleanOldRecommendations(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.activeRecommendations = this.activeRecommendations.filter(
      (r) => r.timestamp > oneHourAgo
    );
  }

  /**
   * Get all active recommendations
   */
  getActiveRecommendations(): TradeRecommendation[] {
    return this.activeRecommendations.filter((r) => r.active);
  }
}
