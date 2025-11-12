import type { AbsorptionEvent, TimeAndSalesEntry } from "@shared/schema";

/**
 * Absorption Detector
 * 
 * Detects when aggressive orders are absorbed by passive liquidity without price movement
 * This indicates strong support (buy absorption) or resistance (sell absorption)
 * 
 * Foundation Course Principle:
 * "Absorption occurs when large aggressive volume hits a price level but price doesn't move.
 *  This shows institutional players defending a level - often precedes reversals or breakouts."
 * 
 * Detection Logic:
 * 1. Identify aggressive volume hitting a price level
 * 2. Check if price failed to move despite the volume
 * 3. Compare aggressive volume to "normal" volume to determine significance
 */

export class AbsorptionDetector {
  private recentTicks: TimeAndSalesEntry[] = [];
  private absorptionEvents: AbsorptionEvent[] = [];
  private maxTickHistory: number;
  private maxEventHistory: number;
  private tickSize: number;

  constructor(maxTickHistory: number = 100, maxEventHistory: number = 50, tickSize: number = 0.25) {
    this.maxTickHistory = maxTickHistory;
    this.maxEventHistory = maxEventHistory;
    this.tickSize = tickSize;
  }

  /**
   * Process a new tick and check for absorption
   * 
   * @param tick - Time & Sales entry
   * @returns Absorption event if detected, null otherwise
   */
  processTick(tick: TimeAndSalesEntry): AbsorptionEvent | null {
    // Add tick to history
    this.recentTicks.push(tick);
    if (this.recentTicks.length > this.maxTickHistory) {
      this.recentTicks = this.recentTicks.slice(-this.maxTickHistory);
    }

    // Need at least 10 ticks to establish context
    if (this.recentTicks.length < 10) {
      return null;
    }

    // Check for absorption in the last few ticks
    const event = this.detectAbsorptionPattern(tick);
    
    // Store absorption event if detected
    if (event) {
      this.absorptionEvents.push(event);
      if (this.absorptionEvents.length > this.maxEventHistory) {
        this.absorptionEvents = this.absorptionEvents.slice(-this.maxEventHistory);
      }
    }
    
    return event;
  }

  /**
   * Detect absorption pattern
   * 
   * Absorption characteristics:
   * 1. Large aggressive volume at a price
   * 2. Price stays within 1-2 ticks (minimal movement)
   * 3. Volume is significantly above average
   */
  private detectAbsorptionPattern(currentTick: TimeAndSalesEntry): AbsorptionEvent | null {
    const lookbackWindow = 5; // Look at last 5 ticks
    const recentWindow = this.recentTicks.slice(-lookbackWindow);

    if (recentWindow.length < lookbackWindow) {
      return null;
    }

    // Calculate metrics for the window
    const prices = recentWindow.map((t) => t.price);
    const volumes = recentWindow.map((t) => t.volume);
    const totalVolume = volumes.reduce((sum, v) => sum + v, 0);
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    // Get average volume from earlier history (for comparison)
    const avgVolume = this.calculateAverageVolume();

    // Absorption criteria:
    // 1. High volume (2x average or more)
    // 2. Minimal price movement (within 2 ticks)
    const volumeThreshold = avgVolume * 2;
    const maxAllowedMove = this.tickSize * 2;

    if (totalVolume < volumeThreshold) {
      return null; // Not enough volume to be significant
    }

    if (priceRange > maxAllowedMove) {
      return null; // Too much price movement
    }

    // Determine absorption side (which side is absorbing the aggressive flow)
    const buyVolume = recentWindow
      .filter((t) => t.side === "BUY")
      .reduce((sum, t) => sum + t.volume, 0);
    
    const sellVolume = recentWindow
      .filter((t) => t.side === "SELL")
      .reduce((sum, t) => sum + t.volume, 0);

    let absorptionSide: "BUY_ABSORPTION" | "SELL_ABSORPTION";
    let aggressiveVolume: number;
    let passiveVolume: number;

    if (buyVolume > sellVolume) {
      // More buy volume but price didn't rise = sell side absorbed (resistance)
      absorptionSide = "SELL_ABSORPTION";
      aggressiveVolume = buyVolume;
      passiveVolume = sellVolume; // Passive sellers absorbed the buying
    } else {
      // More sell volume but price didn't fall = buy side absorbed (support)
      absorptionSide = "BUY_ABSORPTION";
      aggressiveVolume = sellVolume;
      passiveVolume = buyVolume; // Passive buyers absorbed the selling
    }

    const ratio = passiveVolume > 0 ? aggressiveVolume / passiveVolume : aggressiveVolume;

    // Absorption ratio should be significant (at least 2:1)
    if (ratio < 2.0) {
      return null;
    }

    // Calculate price change (should be minimal)
    const priceChange = currentTick.price - recentWindow[0].price;

    const event: AbsorptionEvent = {
      timestamp: currentTick.timestamp,
      price: currentTick.price,
      aggressive_volume: aggressiveVolume,
      passive_volume: passiveVolume,
      ratio,
      side: absorptionSide,
      price_change: priceChange,
    };

    return event;
  }

  /**
   * Calculate average volume from historical ticks
   */
  private calculateAverageVolume(): number {
    if (this.recentTicks.length === 0) {
      return 0;
    }

    // Use earlier portion of history (not the recent window we're analyzing)
    const historyForAvg = this.recentTicks.slice(0, -10);
    if (historyForAvg.length === 0) {
      return 1; // Fallback to avoid division by zero
    }

    const totalVolume = historyForAvg.reduce((sum, tick) => sum + tick.volume, 0);
    return totalVolume / historyForAvg.length;
  }

  /**
   * Get recent absorption events
   */
  getRecentEvents(secondsBack: number = 60): AbsorptionEvent[] {
    const cutoffTime = Date.now() - (secondsBack * 1000);
    return this.absorptionEvents.filter(event => event.timestamp >= cutoffTime);
  }

  /**
   * Get all absorption events
   */
  getAllEvents(): AbsorptionEvent[] {
    return [...this.absorptionEvents];
  }

  /**
   * Get recent ticks for analysis
   */
  getRecentTicks(limit: number = 20): TimeAndSalesEntry[] {
    return this.recentTicks.slice(-limit);
  }

  /**
   * Clear tick history and events
   */
  clear(): void {
    this.recentTicks = [];
    this.absorptionEvents = [];
  }

  /**
   * Get absorption statistics for a specific price level
   * 
   * Useful for identifying strong support/resistance zones
   */
  getAbsorptionAtLevel(
    targetPrice: number,
    tolerance: number = 0.5
  ): {
    total_absorption_events: number;
    buy_absorption_count: number;
    sell_absorption_count: number;
    avg_ratio: number;
  } {
    const absorptionEvents: Array<{ side: "BUY_ABSORPTION" | "SELL_ABSORPTION"; ratio: number }> = [];

    // Scan through recent ticks looking for absorption near target price
    for (let i = 10; i < this.recentTicks.length; i++) {
      const tick = this.recentTicks[i];
      
      if (Math.abs(tick.price - targetPrice) <= tolerance) {
        const event = this.detectAbsorptionPattern(tick);
        if (event) {
          absorptionEvents.push({ side: event.side, ratio: event.ratio });
        }
      }
    }

    const buyAbsorptionCount = absorptionEvents.filter((e) => e.side === "BUY_ABSORPTION").length;
    const sellAbsorptionCount = absorptionEvents.filter((e) => e.side === "SELL_ABSORPTION").length;
    const avgRatio = absorptionEvents.length > 0
      ? absorptionEvents.reduce((sum, e) => sum + e.ratio, 0) / absorptionEvents.length
      : 0;

    return {
      total_absorption_events: absorptionEvents.length,
      buy_absorption_count: buyAbsorptionCount,
      sell_absorption_count: sellAbsorptionCount,
      avg_ratio: avgRatio,
    };
  }
}
