import type { VolumetricCandle } from "@shared/schema";

/**
 * Opening Drive Detector
 * 
 * PRO Course Setup: Opening Drive
 * 
 * Detects strong directional momentum in first 30-60 minutes of RTH.
 * 
 * Key Characteristics:
 * - Price moves away from opening price with conviction
 * - Cumulative delta strongly positive (buying) or negative (selling)
 * - Little to no retracement (< 30% of initial move)
 * - Volume increasing on trend bars
 * 
 * Trade Idea: Join the opening drive after 1st pullback
 */

export interface OpeningDrive {
  detected: boolean;
  direction: "BULLISH" | "BEARISH" | null;
  strength: number; // 0-1 confidence score
  opening_price: number;
  current_price: number;
  price_move_ticks: number;
  cumulative_delta: number;
  retracement_pct: number;
  time_elapsed_minutes: number;
  valid_for_trade: boolean; // True if drive is strong enough to trade
  entry_level: number | null; // Suggested entry on pullback
}

export class OpeningDriveDetector {
  private rthOpenTime: number | null = null;
  private rthOpenPrice: number | null = null;
  private highSinceOpen: number | null = null;
  private lowSinceOpen: number | null = null;
  private tickSize: number;
  private maxDriveMinutes: number; // Opening drive window (30-60 min)
  
  constructor(
    tickSize: number = 0.25,
    maxDriveMinutes: number = 60
  ) {
    this.tickSize = tickSize;
    this.maxDriveMinutes = maxDriveMinutes;
  }
  
  /**
   * Set RTH open time and price
   */
  setRTHOpen(timestamp: number, price: number): void {
    this.rthOpenTime = timestamp;
    this.rthOpenPrice = price;
    this.highSinceOpen = price;
    this.lowSinceOpen = price;
  }
  
  /**
   * Detect opening drive from candles
   */
  detectOpeningDrive(
    candles: VolumetricCandle[],
    currentPrice: number,
    currentTime: number
  ): OpeningDrive {
    // Default: no drive detected
    const noDetection: OpeningDrive = {
      detected: false,
      direction: null,
      strength: 0,
      opening_price: 0,
      current_price: currentPrice,
      price_move_ticks: 0,
      cumulative_delta: 0,
      retracement_pct: 0,
      time_elapsed_minutes: 0,
      valid_for_trade: false,
      entry_level: null,
    };
    
    if (!this.rthOpenTime || !this.rthOpenPrice) {
      return noDetection;
    }
    
    // Calculate time elapsed since RTH open
    const timeElapsedMs = currentTime - this.rthOpenTime;
    const timeElapsedMinutes = timeElapsedMs / (60 * 1000);
    
    // Must be within opening drive window
    if (timeElapsedMinutes > this.maxDriveMinutes) {
      return noDetection;
    }
    
    // Update high/low since open
    if (this.highSinceOpen === null) this.highSinceOpen = currentPrice;
    if (this.lowSinceOpen === null) this.lowSinceOpen = currentPrice;
    this.highSinceOpen = Math.max(this.highSinceOpen, currentPrice);
    this.lowSinceOpen = Math.min(this.lowSinceOpen, currentPrice);
    
    // Get candles since RTH open
    const candlesSinceOpen = candles.filter(c => c.timestamp >= this.rthOpenTime!);
    
    if (candlesSinceOpen.length < 2) {
      return noDetection;
    }
    
    // Calculate cumulative delta since open
    const totalDelta = candlesSinceOpen.reduce((sum, c) => sum + c.cumulative_delta, 0);
    
    // Determine direction based on price move and delta
    const moveUp = currentPrice - this.rthOpenPrice;
    const moveDown = this.rthOpenPrice - currentPrice;
    const moveTicks = Math.max(Math.abs(moveUp), Math.abs(moveDown)) / this.tickSize;
    
    let direction: "BULLISH" | "BEARISH" | null = null;
    let retracement_pct = 0;
    
    if (moveUp > 0 && totalDelta > 0) {
      direction = "BULLISH";
      // Calculate retracement from high
      const totalRange = this.highSinceOpen - this.rthOpenPrice;
      const retracement = this.highSinceOpen - currentPrice;
      retracement_pct = totalRange > 0 ? (retracement / totalRange) * 100 : 0;
    } else if (moveDown > 0 && totalDelta < 0) {
      direction = "BEARISH";
      // Calculate retracement from low
      const totalRange = this.rthOpenPrice - this.lowSinceOpen;
      const retracement = currentPrice - this.lowSinceOpen;
      retracement_pct = totalRange > 0 ? (retracement / totalRange) * 100 : 0;
    }
    
    // Opening drive criteria:
    // 1. Move at least 5 ticks from open
    // 2. Cumulative delta aligned with direction
    // 3. Retracement < 40%
    // 4. Time elapsed 15-60 minutes
    
    const minMoveTicks = 5;
    const maxRetracementPct = 40;
    const minTimeMinutes = 15;
    
    const detected = 
      direction !== null &&
      moveTicks >= minMoveTicks &&
      retracement_pct <= maxRetracementPct &&
      timeElapsedMinutes >= minTimeMinutes;
    
    // Calculate strength (0-1)
    let strength = 0;
    if (detected) {
      const moveScore = Math.min(moveTicks / 10, 1.0); // 10+ ticks = max
      const deltaScore = Math.min(Math.abs(totalDelta) / 100, 1.0); // 100+ delta = max
      const retracementScore = 1.0 - (retracement_pct / 100);
      
      strength = (moveScore * 0.4) + (deltaScore * 0.4) + (retracementScore * 0.2);
    }
    
    // Valid for trade if strength >= 0.6 and retracement is happening (pullback opportunity)
    const validForTrade = detected && strength >= 0.6 && retracement_pct > 5 && retracement_pct < 30;
    
    // Entry level: 50% retracement of the opening drive
    let entryLevel: number | null = null;
    if (validForTrade && direction === "BULLISH") {
      const driveRange = this.highSinceOpen - this.rthOpenPrice;
      entryLevel = this.rthOpenPrice + (driveRange * 0.5);
    } else if (validForTrade && direction === "BEARISH") {
      const driveRange = this.rthOpenPrice - this.lowSinceOpen;
      entryLevel = this.rthOpenPrice - (driveRange * 0.5);
    }
    
    return {
      detected,
      direction,
      strength,
      opening_price: this.rthOpenPrice,
      current_price: currentPrice,
      price_move_ticks: moveTicks,
      cumulative_delta: totalDelta,
      retracement_pct,
      time_elapsed_minutes: timeElapsedMinutes,
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
    this.highSinceOpen = null;
    this.lowSinceOpen = null;
  }
}
