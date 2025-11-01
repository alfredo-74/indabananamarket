import type { VolumetricCandle, CompositeProfileData } from "@shared/schema";

/**
 * 80% Rule Detector
 * 
 * PRO Course Setup: 80% Overnight Inventory Completion
 * 
 * If price opens in the upper 20% of value area and trades down through
 * 80% of the value area in the first hour, we expect continued downside.
 * Vice versa for opens in lower 20% that trade up through 80%.
 * 
 * This represents large overnight inventory being completed/rejected.
 * 
 * Trade Idea: Fade the opening range after 80% rule triggers
 */

export interface EightyPercentRule {
  detected: boolean;
  direction: "EXPECTING_DOWNSIDE" | "EXPECTING_UPSIDE" | null;
  confidence: number; // 0-1 score
  opening_price: number;
  opening_position: "UPPER_20" | "LOWER_20" | "MIDDLE" | null; // Where price opened in VA
  value_area_high: number;
  value_area_low: number;
  value_traveled_pct: number; // How much of VA has been traveled
  time_elapsed_minutes: number;
  triggered_time: number | null; // When 80% was completed
  valid_for_trade: boolean;
  entry_level: number | null; // Suggested entry level
}

export class EightyPercentRuleDetector {
  private rthOpenTime: number | null = null;
  private rthOpenPrice: number | null = null;
  private cvaAtOpen: CompositeProfileData | null = null;
  private maxDetectionMinutes: number; // Must happen in first hour
  private rule80Triggered: boolean = false;
  private triggerTime: number | null = null;
  
  constructor(maxDetectionMinutes: number = 60) {
    this.maxDetectionMinutes = maxDetectionMinutes;
  }
  
  /**
   * Set RTH open and CVA snapshot
   */
  setRTHOpen(timestamp: number, price: number, cva: CompositeProfileData): void {
    this.rthOpenTime = timestamp;
    this.rthOpenPrice = price;
    this.cvaAtOpen = cva;
    this.rule80Triggered = false;
    this.triggerTime = null;
  }
  
  /**
   * Detect 80% rule from candles
   */
  detect80PercentRule(
    candles: VolumetricCandle[],
    currentPrice: number,
    currentTime: number
  ): EightyPercentRule {
    // Default: no detection
    const noDetection: EightyPercentRule = {
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
    };
    
    if (!this.rthOpenTime || !this.rthOpenPrice || !this.cvaAtOpen) {
      return noDetection;
    }
    
    // Calculate time elapsed
    const timeElapsedMs = currentTime - this.rthOpenTime;
    const timeElapsedMinutes = timeElapsedMs / (60 * 1000);
    
    // Must be within detection window
    if (timeElapsedMinutes > this.maxDetectionMinutes) {
      return noDetection;
    }
    
    const vah = this.cvaAtOpen.composite_vah;
    const val = this.cvaAtOpen.composite_val;
    const valueRange = vah - val;
    
    if (valueRange <= 0) {
      return noDetection;
    }
    
    // Determine where price opened in the value area
    const openPositionInVA = (this.rthOpenPrice - val) / valueRange; // 0 = VAL, 1 = VAH
    
    let openingPosition: "UPPER_20" | "LOWER_20" | "MIDDLE" | null = null;
    if (openPositionInVA >= 0.8) {
      openingPosition = "UPPER_20";
    } else if (openPositionInVA <= 0.2) {
      openingPosition = "LOWER_20";
    } else {
      openingPosition = "MIDDLE";
    }
    
    // 80% rule only applies to opens in upper/lower 20%
    if (openingPosition === "MIDDLE") {
      return noDetection;
    }
    
    // Get candles since RTH open
    const candlesSinceOpen = candles.filter(c => c.timestamp >= this.rthOpenTime!);
    
    // Find the high and low since open
    let highSinceOpen = this.rthOpenPrice;
    let lowSinceOpen = this.rthOpenPrice;
    
    for (const candle of candlesSinceOpen) {
      highSinceOpen = Math.max(highSinceOpen, candle.high);
      lowSinceOpen = Math.min(lowSinceOpen, candle.low);
    }
    
    // Calculate how much of VA has been traveled
    let valueTraveledPct = 0;
    let direction: "EXPECTING_DOWNSIDE" | "EXPECTING_UPSIDE" | null = null;
    let detected = false;
    
    if (openingPosition === "UPPER_20") {
      // Opened in upper 20%, expecting downside if trades through 80% of VA
      const travelDistance = this.rthOpenPrice - lowSinceOpen;
      valueTraveledPct = (travelDistance / valueRange) * 100;
      
      if (valueTraveledPct >= 80) {
        detected = true;
        direction = "EXPECTING_DOWNSIDE";
        
        if (!this.rule80Triggered) {
          this.rule80Triggered = true;
          this.triggerTime = currentTime;
        }
      }
    } else if (openingPosition === "LOWER_20") {
      // Opened in lower 20%, expecting upside if trades through 80% of VA
      const travelDistance = highSinceOpen - this.rthOpenPrice;
      valueTraveledPct = (travelDistance / valueRange) * 100;
      
      if (valueTraveledPct >= 80) {
        detected = true;
        direction = "EXPECTING_UPSIDE";
        
        if (!this.rule80Triggered) {
          this.rule80Triggered = true;
          this.triggerTime = currentTime;
        }
      }
    }
    
    // Calculate confidence
    // Higher confidence if:
    // 1. Triggered quickly (< 30 minutes)
    // 2. Price traveled beyond 80% (90%, 100%+)
    // 3. Cumulative delta supports direction
    
    let confidence = 0;
    if (detected) {
      const timeScore = timeElapsedMinutes < 30 ? 1.0 : 0.7;
      const travelScore = Math.min(valueTraveledPct / 100, 1.0);
      
      // Check cumulative delta alignment
      const totalDelta = candlesSinceOpen.reduce((sum, c) => sum + c.cumulative_delta, 0);
      const deltaAligned = 
        (direction === "EXPECTING_DOWNSIDE" && totalDelta < 0) ||
        (direction === "EXPECTING_UPSIDE" && totalDelta > 0);
      const deltaScore = deltaAligned ? 1.0 : 0.5;
      
      confidence = (timeScore * 0.3) + (travelScore * 0.4) + (deltaScore * 0.3);
    }
    
    // Valid for trade if confidence >= 0.7
    const validForTrade = detected && confidence >= 0.7;
    
    // Entry level: Fade the extreme (enter opposite to expected direction)
    let entryLevel: number | null = null;
    if (validForTrade && direction === "EXPECTING_DOWNSIDE") {
      // Enter short near the high of the opening range
      entryLevel = highSinceOpen - (valueRange * 0.1); // 10% below high
    } else if (validForTrade && direction === "EXPECTING_UPSIDE") {
      // Enter long near the low of the opening range
      entryLevel = lowSinceOpen + (valueRange * 0.1); // 10% above low
    }
    
    return {
      detected,
      direction,
      confidence,
      opening_price: this.rthOpenPrice,
      opening_position: openingPosition,
      value_area_high: vah,
      value_area_low: val,
      value_traveled_pct: valueTraveledPct,
      time_elapsed_minutes: timeElapsedMinutes,
      triggered_time: this.triggerTime,
      valid_for_trade: validForTrade,
      entry_level: entryLevel,
    };
  }
  
  /**
   * Reset for new trading day
   */
  reset(): void {
    this.rthOpenTime = null;
    this.rthOpenPrice = null;
    this.cvaAtOpen = null;
    this.rule80Triggered = false;
    this.triggerTime = null;
  }
}
