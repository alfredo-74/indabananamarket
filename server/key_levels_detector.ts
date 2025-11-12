import type { VolumetricCandle, KeyLevels, VWAPData } from "@shared/schema";

export class KeyLevelsDetector {
  private swingLookback: number = 20; // Candles to look back for swing highs/lows

  constructor(swingLookback: number = 20) {
    this.swingLookback = swingLookback;
  }

  /**
   * Detect key levels from candle history
   */
  detectKeyLevels(
    candles: VolumetricCandle[],
    currentVwap: VWAPData | null,
    previousDayCandles: VolumetricCandle[]
  ): KeyLevels {
    const timestamp = Date.now();

    // Calculate previous day levels
    const prevDayHigh = this.getPreviousDayHigh(previousDayCandles);
    const prevDayLow = this.getPreviousDayLow(previousDayCandles);
    const prevDayClose = this.getPreviousDayClose(previousDayCandles);
    const prevDayVwap = this.getPreviousDayVWAP(previousDayCandles);

    // Calculate swing levels from recent candles
    const swingHigh = this.getSwingHigh(candles);
    const swingLow = this.getSwingLow(candles);

    // Calculate volume POC (Point of Control)
    const volumePOC = this.getVolumePOC(candles);

    return {
      previous_day_high: prevDayHigh,
      previous_day_low: prevDayLow,
      previous_day_close: prevDayClose,
      previous_day_vwap: prevDayVwap,
      swing_high: swingHigh,
      swing_low: swingLow,
      volume_poc: volumePOC,
      last_updated: timestamp,
    };
  }

  /**
   * Get previous day's high
   */
  private getPreviousDayHigh(previousDayCandles: VolumetricCandle[]): number | null {
    if (previousDayCandles.length === 0) return null;
    return Math.max(...previousDayCandles.map(c => c.high));
  }

  /**
   * Get previous day's low
   */
  private getPreviousDayLow(previousDayCandles: VolumetricCandle[]): number | null {
    if (previousDayCandles.length === 0) return null;
    return Math.min(...previousDayCandles.map(c => c.low));
  }

  /**
   * Get previous day's close (last candle)
   */
  private getPreviousDayClose(previousDayCandles: VolumetricCandle[]): number | null {
    if (previousDayCandles.length === 0) return null;
    return previousDayCandles[previousDayCandles.length - 1].close;
  }

  /**
   * Calculate previous day's VWAP
   */
  private getPreviousDayVWAP(previousDayCandles: VolumetricCandle[]): number | null {
    if (previousDayCandles.length === 0) return null;

    let sumPriceVolume = 0;
    let sumVolume = 0;

    for (const candle of previousDayCandles) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      sumPriceVolume += typicalPrice * candle.accumulated_volume;
      sumVolume += candle.accumulated_volume;
    }

    if (sumVolume === 0) return null;
    return sumPriceVolume / sumVolume;
  }

  /**
   * Get swing high from recent candles
   * A swing high is a local maximum where the high is higher than surrounding candles
   */
  private getSwingHigh(candles: VolumetricCandle[]): number | null {
    if (candles.length < this.swingLookback) return null;

    const recentCandles = candles.slice(-this.swingLookback);
    let swingHigh: number | null = null;

    // Find the highest high in the lookback period
    // In a more sophisticated implementation, you'd look for actual swing points
    // (where high is higher than X candles before and after)
    for (let i = 2; i < recentCandles.length - 2; i++) {
      const candle = recentCandles[i];
      const prev1 = recentCandles[i - 1];
      const prev2 = recentCandles[i - 2];
      const next1 = recentCandles[i + 1];
      const next2 = recentCandles[i + 2];

      // Check if this is a swing high (higher than 2 candles on each side)
      if (
        candle.high > prev1.high &&
        candle.high > prev2.high &&
        candle.high > next1.high &&
        candle.high > next2.high
      ) {
        if (swingHigh === null || candle.high > swingHigh) {
          swingHigh = candle.high;
        }
      }
    }

    // If no swing high found, use the highest high in the period
    if (swingHigh === null) {
      swingHigh = Math.max(...recentCandles.map(c => c.high));
    }

    return swingHigh;
  }

  /**
   * Get swing low from recent candles
   * A swing low is a local minimum where the low is lower than surrounding candles
   */
  private getSwingLow(candles: VolumetricCandle[]): number | null {
    if (candles.length < this.swingLookback) return null;

    const recentCandles = candles.slice(-this.swingLookback);
    let swingLow: number | null = null;

    // Find the lowest low in the lookback period
    for (let i = 2; i < recentCandles.length - 2; i++) {
      const candle = recentCandles[i];
      const prev1 = recentCandles[i - 1];
      const prev2 = recentCandles[i - 2];
      const next1 = recentCandles[i + 1];
      const next2 = recentCandles[i + 2];

      // Check if this is a swing low (lower than 2 candles on each side)
      if (
        candle.low < prev1.low &&
        candle.low < prev2.low &&
        candle.low < next1.low &&
        candle.low < next2.low
      ) {
        if (swingLow === null || candle.low < swingLow) {
          swingLow = candle.low;
        }
      }
    }

    // If no swing low found, use the lowest low in the period
    if (swingLow === null) {
      swingLow = Math.min(...recentCandles.map(c => c.low));
    }

    return swingLow;
  }

  /**
   * Get Volume Point of Control (price level with highest volume)
   */
  private getVolumePOC(candles: VolumetricCandle[]): number | null {
    if (candles.length === 0) return null;

    // Create a price-volume map
    // Round prices to nearest 0.25 tick for ES
    const volumeByPrice = new Map<number, number>();

    for (const candle of candles) {
      // Use typical price for the candle
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      const roundedPrice = Math.round(typicalPrice * 4) / 4; // Round to nearest 0.25

      const currentVolume = volumeByPrice.get(roundedPrice) || 0;
      volumeByPrice.set(roundedPrice, currentVolume + candle.accumulated_volume);
    }

    // Find price with highest volume
    let maxVolume = 0;
    let pocPrice: number | null = null;

    for (const [price, volume] of Array.from(volumeByPrice.entries())) {
      if (volume > maxVolume) {
        maxVolume = volume;
        pocPrice = price;
      }
    }

    return pocPrice;
  }

  /**
   * Calculate confluence score for a given price level
   * Returns 0-100 score based on how many key levels align with the price
   */
  calculateConfluence(price: number, keyLevels: KeyLevels, tolerance: number = 2.0): number {
    let confluenceCount = 0;
    const maxPossibleConfluence = 7; // Number of key levels we track

    // Check proximity to each key level
    if (keyLevels.previous_day_high !== null && 
        Math.abs(price - keyLevels.previous_day_high) <= tolerance) {
      confluenceCount++;
    }

    if (keyLevels.previous_day_low !== null && 
        Math.abs(price - keyLevels.previous_day_low) <= tolerance) {
      confluenceCount++;
    }

    if (keyLevels.previous_day_close !== null && 
        Math.abs(price - keyLevels.previous_day_close) <= tolerance) {
      confluenceCount++;
    }

    if (keyLevels.previous_day_vwap !== null && 
        Math.abs(price - keyLevels.previous_day_vwap) <= tolerance) {
      confluenceCount++;
    }

    if (keyLevels.swing_high !== null && 
        Math.abs(price - keyLevels.swing_high) <= tolerance) {
      confluenceCount++;
    }

    if (keyLevels.swing_low !== null && 
        Math.abs(price - keyLevels.swing_low) <= tolerance) {
      confluenceCount++;
    }

    if (keyLevels.volume_poc !== null && 
        Math.abs(price - keyLevels.volume_poc) <= tolerance) {
      confluenceCount++;
    }

    // Return score as percentage
    return (confluenceCount / maxPossibleConfluence) * 100;
  }

  /**
   * Update swing lookback period
   */
  setSwingLookback(lookback: number): void {
    this.swingLookback = lookback;
  }

  getSwingLookback(): number {
    return this.swingLookback;
  }
}
