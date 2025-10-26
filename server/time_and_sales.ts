import type { TimeAndSalesEntry } from "@shared/schema";

/**
 * Time & Sales Processor
 * 
 * Processes real-time market transactions (aggressive orders)
 * This is the purest form of order flow data - showing every trade that executes
 * 
 * Foundation Course Principle:
 * "Every tick up or down is caused by aggressive orders consuming passive liquidity"
 */

export class TimeAndSalesProcessor {
  private entries: TimeAndSalesEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries: number = 1000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Process a new transaction from the market
   * 
   * @param price - Execution price
   * @param volume - Number of contracts traded
   * @param side - BUY (aggressor took ask) or SELL (aggressor hit bid)
   * @param timestamp - Time of execution
   */
  processTick(
    price: number,
    volume: number,
    side: "BUY" | "SELL",
    timestamp: number = Date.now()
  ): TimeAndSalesEntry {
    const entry: TimeAndSalesEntry = {
      timestamp,
      price,
      volume,
      side,
    };

    this.entries.push(entry);

    // Keep only most recent entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    return entry;
  }

  /**
   * Get recent Time & Sales entries
   */
  getEntries(limit: number = 100): TimeAndSalesEntry[] {
    return this.entries.slice(-limit);
  }

  /**
   * Get all entries within a time window
   */
  getEntriesInTimeWindow(
    startTime: number,
    endTime: number
  ): TimeAndSalesEntry[] {
    return this.entries.filter(
      (entry) => entry.timestamp >= startTime && entry.timestamp <= endTime
    );
  }

  /**
   * Calculate buying vs selling pressure over recent period
   * 
   * Returns ratio of buy volume to total volume
   * > 0.6 = Bullish pressure (60%+ buying)
   * < 0.4 = Bearish pressure (60%+ selling)
   */
  getBuySellPressure(lookbackMinutes: number = 5): {
    buy_volume: number;
    sell_volume: number;
    total_volume: number;
    buy_ratio: number;
    pressure: "BULLISH" | "BEARISH" | "NEUTRAL";
  } {
    const now = Date.now();
    const lookbackMs = lookbackMinutes * 60 * 1000;
    const startTime = now - lookbackMs;

    const recentEntries = this.getEntriesInTimeWindow(startTime, now);

    let buyVolume = 0;
    let sellVolume = 0;

    for (const entry of recentEntries) {
      if (entry.side === "BUY") {
        buyVolume += entry.volume;
      } else {
        sellVolume += entry.volume;
      }
    }

    const totalVolume = buyVolume + sellVolume;
    const buyRatio = totalVolume > 0 ? buyVolume / totalVolume : 0.5;

    let pressure: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    if (buyRatio > 0.6) {
      pressure = "BULLISH";
    } else if (buyRatio < 0.4) {
      pressure = "BEARISH";
    }

    return {
      buy_volume: buyVolume,
      sell_volume: sellVolume,
      total_volume: totalVolume,
      buy_ratio: buyRatio,
      pressure,
    };
  }

  /**
   * Detect large trades (institutional flow)
   * 
   * Trades above threshold are likely institutional
   */
  getLargeTrades(
    threshold: number = 50,
    lookbackMinutes: number = 60
  ): TimeAndSalesEntry[] {
    const now = Date.now();
    const lookbackMs = lookbackMinutes * 60 * 1000;
    const startTime = now - lookbackMs;

    const recentEntries = this.getEntriesInTimeWindow(startTime, now);

    return recentEntries.filter((entry) => entry.volume >= threshold);
  }

  /**
   * Clear all entries (useful for session reset)
   */
  clear(): void {
    this.entries = [];
  }
}
