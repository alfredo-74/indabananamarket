import type { VolumetricCandle } from "@shared/schema";

export class VolumetricCandleBuilder {
  private currentCandle: Partial<VolumetricCandle> | null = null;
  private candleInterval: number = 60000; // 1 minute candles
  private lastCandleTime: number = 0;

  constructor(intervalMs: number = 60000) {
    this.candleInterval = intervalMs;
  }

  /**
   * Process a tick and update/create candles
   * FIXED: Uses accumulated_volume instead of current_volume
   */
  processTick(price: number, volume: number, isBuy: boolean, timestamp: number): VolumetricCandle | null {
    const candleTime = Math.floor(timestamp / this.candleInterval) * this.candleInterval;

    // Start new candle if needed
    if (!this.currentCandle || candleTime > this.lastCandleTime) {
      const completedCandle = this.currentCandle ? this.finalizeCandle() : null;
      
      this.currentCandle = {
        timestamp: candleTime,
        open: price,
        high: price,
        low: price,
        close: price,
        accumulated_volume: volume,
        buy_volume: isBuy ? volume : 0,
        sell_volume: isBuy ? 0 : volume,
        cumulative_delta: isBuy ? volume : -volume,
      };
      
      this.lastCandleTime = candleTime;
      return completedCandle;
    }

    // Update current candle
    if (this.currentCandle) {
      this.currentCandle.high = Math.max(this.currentCandle.high!, price);
      this.currentCandle.low = Math.min(this.currentCandle.low!, price);
      this.currentCandle.close = price;
      
      // FIXED: accumulated_volume (not current_volume)
      this.currentCandle.accumulated_volume = (this.currentCandle.accumulated_volume || 0) + volume;
      
      if (isBuy) {
        this.currentCandle.buy_volume = (this.currentCandle.buy_volume || 0) + volume;
        this.currentCandle.cumulative_delta = (this.currentCandle.cumulative_delta || 0) + volume;
      } else {
        this.currentCandle.sell_volume = (this.currentCandle.sell_volume || 0) + volume;
        this.currentCandle.cumulative_delta = (this.currentCandle.cumulative_delta || 0) - volume;
      }
    }

    return null;
  }

  /**
   * Force complete the current candle (for end of session or forced update)
   */
  finalizeCandle(): VolumetricCandle | null {
    if (!this.currentCandle) return null;

    const candle: VolumetricCandle = {
      timestamp: this.currentCandle.timestamp!,
      open: this.currentCandle.open!,
      high: this.currentCandle.high!,
      low: this.currentCandle.low!,
      close: this.currentCandle.close!,
      accumulated_volume: this.currentCandle.accumulated_volume || 0,
      buy_volume: this.currentCandle.buy_volume || 0,
      sell_volume: this.currentCandle.sell_volume || 0,
      cumulative_delta: this.currentCandle.cumulative_delta || 0,
    };

    return candle;
  }

  getCurrentCandle(): VolumetricCandle | null {
    if (!this.currentCandle) return null;
    return this.finalizeCandle();
  }
}
