import type { VolumetricCandle, VWAPData } from "@shared/schema";

export class VWAPCalculator {
  private lookbackCandles: number = 10; // FIXED: Changed from 50 to 10 for faster initial results

  constructor(lookback: number = 10) {
    this.lookbackCandles = lookback;
  }

  /**
   * Calculate VWAP and standard deviation bands
   * FIXED: NaN values are converted to null for JSON serialization
   * FIXED: Lookback reduced to 10 candles
   */
  calculate(candles: VolumetricCandle[]): VWAPData {
    if (candles.length === 0) {
      return {
        vwap: null,
        sd1_upper: null,
        sd1_lower: null,
        sd2_upper: null,
        sd2_lower: null,
        sd3_upper: null,
        sd3_lower: null,
        lookback_candles: this.lookbackCandles,
      };
    }

    // Use last N candles (FIXED: 10 instead of 50)
    const recentCandles = candles.slice(-this.lookbackCandles);

    if (recentCandles.length === 0) {
      return {
        vwap: null,
        sd1_upper: null,
        sd1_lower: null,
        sd2_upper: null,
        sd2_lower: null,
        sd3_upper: null,
        sd3_lower: null,
        lookback_candles: this.lookbackCandles,
      };
    }

    // Calculate VWAP
    let sumPriceVolume = 0;
    let sumVolume = 0;

    for (const candle of recentCandles) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      sumPriceVolume += typicalPrice * candle.accumulated_volume;
      sumVolume += candle.accumulated_volume;
    }

    if (sumVolume === 0) {
      return {
        vwap: null,
        sd1_upper: null,
        sd1_lower: null,
        sd2_upper: null,
        sd2_lower: null,
        sd3_upper: null,
        sd3_lower: null,
        lookback_candles: this.lookbackCandles,
      };
    }

    const vwap = sumPriceVolume / sumVolume;

    // Calculate standard deviation
    let sumSquaredDiff = 0;
    for (const candle of recentCandles) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      const diff = typicalPrice - vwap;
      sumSquaredDiff += diff * diff * candle.accumulated_volume;
    }

    const variance = sumSquaredDiff / sumVolume;
    const stdDev = Math.sqrt(variance);

    // FIXED: Convert NaN to null for JSON compatibility
    const safeNumber = (value: number): number | null => {
      return isNaN(value) || !isFinite(value) ? null : value;
    };

    return {
      vwap: safeNumber(vwap),
      sd1_upper: safeNumber(vwap + stdDev),
      sd1_lower: safeNumber(vwap - stdDev),
      sd2_upper: safeNumber(vwap + 2 * stdDev),
      sd2_lower: safeNumber(vwap - 2 * stdDev),
      sd3_upper: safeNumber(vwap + 3 * stdDev),
      sd3_lower: safeNumber(vwap - 3 * stdDev),
      lookback_candles: this.lookbackCandles,
    };
  }

  /**
   * Update lookback period dynamically if needed
   */
  setLookback(lookback: number): void {
    this.lookbackCandles = lookback;
  }

  getLookback(): number {
    return this.lookbackCandles;
  }
}
