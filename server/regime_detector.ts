import type { RegimeState } from "@shared/schema";

export class RegimeDetector {
  private cdThreshold: number = 50; // FIXED: Changed from ±500 to ±50 for tick-by-tick data
  private transitionBuffer: number = 10; // Hysteresis to prevent rapid regime switching

  constructor(threshold: number = 50) {
    this.cdThreshold = threshold;
  }

  /**
   * Detect market regime based on cumulative delta
   * FIXED: Threshold adjusted to ±50 (realistic for tick data with volume=1)
   * 
   * ROTATIONAL: -50 < CD < +50 (balanced buying/selling)
   * DIRECTIONAL_BULLISH: CD > +50 (strong buying pressure)
   * DIRECTIONAL_BEARISH: CD < -50 (strong selling pressure)
   */
  detectRegime(cumulativeDelta: number, previousRegime?: RegimeState): RegimeState {
    // Apply hysteresis for regime transitions to prevent flapping
    const upperThreshold = this.cdThreshold + this.transitionBuffer;
    const lowerThreshold = -this.cdThreshold - this.transitionBuffer;

    // Strong bullish: CD exceeds positive threshold
    if (cumulativeDelta > upperThreshold) {
      return "DIRECTIONAL_BULLISH";
    }

    // Strong bearish: CD exceeds negative threshold
    if (cumulativeDelta < lowerThreshold) {
      return "DIRECTIONAL_BEARISH";
    }

    // If we were in a directional regime, use inner threshold to stay in it
    // (hysteresis to prevent rapid switching)
    if (previousRegime === "DIRECTIONAL_BULLISH" && cumulativeDelta > this.cdThreshold) {
      return "DIRECTIONAL_BULLISH";
    }

    if (previousRegime === "DIRECTIONAL_BEARISH" && cumulativeDelta < -this.cdThreshold) {
      return "DIRECTIONAL_BEARISH";
    }

    // Default to rotational when within threshold range
    return "ROTATIONAL";
  }

  /**
   * Update threshold dynamically if needed
   */
  setThreshold(threshold: number): void {
    this.cdThreshold = threshold;
  }

  getThreshold(): number {
    return this.cdThreshold;
  }
}
