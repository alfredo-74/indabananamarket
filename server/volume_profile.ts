import type { VolumeProfile, VolumeProfileLevel } from "@shared/schema";

/**
 * Volume Profile Calculator
 * 
 * Builds a horizontal volume histogram showing distribution of traded volume at each price
 * Implements Auction Market Theory (AMT) concepts
 * 
 * Foundation Course Principles:
 * - POC (Point of Control): Price with highest volume - strongest acceptance level
 * - Value Area: 70% of total volume - where "fair value" is established
 * - VAH/VAL: Value Area High/Low boundaries
 * - Profile Shape: Identifies market structure (balanced vs trending)
 */

export class VolumeProfileCalculator {
  private levels: Map<number, VolumeProfileLevel> = new Map();
  private tickSize: number;

  constructor(tickSize: number = 0.25) {
    this.tickSize = tickSize;
  }

  /**
   * Add a completed candle to the volume profile
   * 
   * @param candle - VolumetricCandle with OHLC and buy/sell volume
   */
  addCandle(candle: { open: number; high: number; low: number; close: number; buy_volume: number; sell_volume: number }): void {
    // Distribute volume across the candle's price range (high to low)
    // This creates a proper volume histogram instead of concentrating everything at close
    
    // Calculate price range and number of levels
    const priceRange = candle.high - candle.low;
    const numLevels = Math.max(1, Math.floor(priceRange / this.tickSize) + 1);
    
    // Distribute buy and sell volume proportionally across all price levels
    const buyVolumePerLevel = candle.buy_volume / numLevels;
    const sellVolumePerLevel = candle.sell_volume / numLevels;
    
    // Add volume at each tick level from low to high
    for (let i = 0; i < numLevels; i++) {
      const price = candle.low + (i * this.tickSize);
      
      if (buyVolumePerLevel > 0) {
        this.addTransaction(price, buyVolumePerLevel, "BUY");
      }
      
      if (sellVolumePerLevel > 0) {
        this.addTransaction(price, sellVolumePerLevel, "SELL");
      }
    }
  }

  /**
   * Add a transaction to the volume profile
   * 
   * @param price - Transaction price
   * @param volume - Transaction volume
   * @param side - BUY or SELL (determines aggressor direction)
   */
  addTransaction(price: number, volume: number, side: "BUY" | "SELL"): void {
    // Round price to nearest tick
    const roundedPrice = this.roundToTick(price);

    let level = this.levels.get(roundedPrice);
    if (!level) {
      level = {
        price: roundedPrice,
        total_volume: 0,
        buy_volume: 0,
        sell_volume: 0,
        delta: 0,
        tpo_count: 0,
      };
      this.levels.set(roundedPrice, level);
    }

    // Update volume
    level.total_volume += volume;
    if (side === "BUY") {
      level.buy_volume += volume;
    } else {
      level.sell_volume += volume;
    }
    level.delta = level.buy_volume - level.sell_volume;
  }

  /**
   * Calculate and return the complete Volume Profile
   * 
   * Returns POC, VAH, VAL, and all price levels
   */
  getProfile(periodStart: number = 0, periodEnd: number = Date.now()): VolumeProfile {
    const levelsArray = Array.from(this.levels.values())
      .sort((a, b) => b.price - a.price); // Sort by price descending

    if (levelsArray.length === 0) {
      return {
        levels: [],
        poc: 0,
        vah: 0,
        val: 0,
        total_volume: 0,
        profile_type: null,
        hvn_levels: [],
        lvn_levels: [],
        period_start: periodStart,
        period_end: periodEnd,
      };
    }

    // Calculate total volume
    const totalVolume = levelsArray.reduce((sum, level) => sum + level.total_volume, 0);

    // Find POC (Point of Control) - price with highest volume
    const poc = this.findPOC(levelsArray);

    // Find Value Area (70% of volume around POC)
    const { vah, val } = this.findValueArea(levelsArray, totalVolume, poc);

    // Determine profile type
    const profileType = this.classifyProfileType(levelsArray, poc, vah, val);

    // Find High Volume Nodes and Low Volume Nodes
    const { hvn, lvn } = this.findHVNandLVN(levelsArray, totalVolume);

    return {
      levels: levelsArray,
      poc,
      vah,
      val,
      total_volume: totalVolume,
      profile_type: profileType,
      hvn_levels: hvn,
      lvn_levels: lvn,
      period_start: periodStart,
      period_end: periodEnd,
    };
  }

  /**
   * Find Point of Control (price with highest volume)
   */
  private findPOC(levels: VolumeProfileLevel[]): number {
    if (levels.length === 0) return 0;

    let maxVolume = 0;
    let pocPrice = levels[0].price;

    for (const level of levels) {
      if (level.total_volume > maxVolume) {
        maxVolume = level.total_volume;
        pocPrice = level.price;
      }
    }

    return pocPrice;
  }

  /**
   * Find Value Area High and Low (70% of volume)
   * 
   * Algorithm: Start at POC, expand up/down to include 70% of total volume
   */
  private findValueArea(
    levels: VolumeProfileLevel[],
    totalVolume: number,
    poc: number
  ): { vah: number; val: number } {
    if (levels.length === 0) {
      return { vah: 0, val: 0 };
    }

    const targetVolume = totalVolume * 0.70;
    
    // Start at POC
    const pocIndex = levels.findIndex((l) => l.price === poc);
    if (pocIndex === -1) {
      return { vah: levels[0].price, val: levels[levels.length - 1].price };
    }

    let currentVolume = levels[pocIndex].total_volume;
    let upperIndex = pocIndex;
    let lowerIndex = pocIndex;

    // Expand up and down alternately, prioritizing the side with more volume
    while (currentVolume < targetVolume && (upperIndex > 0 || lowerIndex < levels.length - 1)) {
      const upperVolume = upperIndex > 0 ? levels[upperIndex - 1].total_volume : 0;
      const lowerVolume = lowerIndex < levels.length - 1 ? levels[lowerIndex + 1].total_volume : 0;

      if (upperVolume >= lowerVolume && upperIndex > 0) {
        upperIndex--;
        currentVolume += levels[upperIndex].total_volume;
      } else if (lowerIndex < levels.length - 1) {
        lowerIndex++;
        currentVolume += levels[lowerIndex].total_volume;
      } else if (upperIndex > 0) {
        upperIndex--;
        currentVolume += levels[upperIndex].total_volume;
      }
    }

    return {
      vah: levels[upperIndex].price,
      val: levels[lowerIndex].price,
    };
  }

  /**
   * Classify profile type based on distribution shape
   * 
   * - D: Balanced/normal distribution - rotational market
   * - P: Volume concentrated at top - bullish acceptance high
   * - b: Volume concentrated at bottom - bearish acceptance low
   * - DOUBLE: Two peaks - transitioning market
   */
  private classifyProfileType(
    levels: VolumeProfileLevel[],
    poc: number,
    vah: number,
    val: number
  ): "P" | "b" | "D" | "DOUBLE" | null {
    if (levels.length < 3) {
      return "D";
    }

    const pocIndex = levels.findIndex((l) => l.price === poc);
    const upperThird = levels.length / 3;
    const lowerThird = (2 * levels.length) / 3;

    // P-shaped: POC in upper third (trending up, acceptance at highs)
    if (pocIndex < upperThird) {
      return "P";
    }

    // b-shaped: POC in lower third (trending down, acceptance at lows)
    if (pocIndex > lowerThird) {
      return "b";
    }

    // Check for double distribution (two distinct volume peaks)
    const peaks = this.findVolumePeaks(levels);
    if (peaks.length >= 2) {
      return "DOUBLE";
    }

    return "D";
  }

  /**
   * Find local volume peaks (for double distribution detection)
   */
  private findVolumePeaks(levels: VolumeProfileLevel[]): number[] {
    const peaks: number[] = [];
    const minPeakVolume = Math.max(...levels.map((l) => l.total_volume)) * 0.5;

    for (let i = 1; i < levels.length - 1; i++) {
      const current = levels[i];
      const prev = levels[i - 1];
      const next = levels[i + 1];

      // Local peak: higher than neighbors and above threshold
      if (
        current.total_volume > prev.total_volume &&
        current.total_volume > next.total_volume &&
        current.total_volume >= minPeakVolume
      ) {
        peaks.push(current.price);
      }
    }

    return peaks;
  }

  /**
   * Find High Volume Nodes (HVN) and Low Volume Nodes (LVN)
   * 
   * HVN: Prices with significantly high volume - potential support/resistance
   * LVN: Prices with significantly low volume - areas price may move through quickly
   */
  private findHVNandLVN(
    levels: VolumeProfileLevel[],
    totalVolume: number
  ): { hvn: number[]; lvn: number[] } {
    if (levels.length === 0) {
      return { hvn: [], lvn: [] };
    }

    const avgVolume = totalVolume / levels.length;
    const hvnThreshold = avgVolume * 1.5; // 50% above average
    const lvnThreshold = avgVolume * 0.5; // 50% below average

    const hvn: number[] = [];
    const lvn: number[] = [];

    for (const level of levels) {
      if (level.total_volume >= hvnThreshold) {
        hvn.push(level.price);
      } else if (level.total_volume <= lvnThreshold) {
        lvn.push(level.price);
      }
    }

    return { hvn, lvn };
  }

  /**
   * Round price to nearest tick size
   */
  private roundToTick(price: number): number {
    return Math.round(price / this.tickSize) * this.tickSize;
  }

  /**
   * Get volume at a specific price
   */
  getVolumeAtPrice(price: number): number {
    const roundedPrice = this.roundToTick(price);
    const level = this.levels.get(roundedPrice);
    return level ? level.total_volume : 0;
  }

  /**
   * Clear all data (for session reset)
   */
  clear(): void {
    this.levels.clear();
  }

  /**
   * Get levels within price range
   */
  getLevelsInRange(minPrice: number, maxPrice: number): VolumeProfileLevel[] {
    return Array.from(this.levels.values())
      .filter((level) => level.price >= minPrice && level.price <= maxPrice)
      .sort((a, b) => b.price - a.price);
  }
}
