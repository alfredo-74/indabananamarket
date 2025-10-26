import type { DomSnapshot } from "@shared/schema";

/**
 * DOM (Depth of Market) Processor
 * 
 * Processes Level 2 market data showing bid/ask liquidity at each price level
 * This reveals where large orders are resting and can indicate support/resistance
 * 
 * Foundation Course Principle:
 * "The DOM shows passive liquidity - the limit orders waiting to be filled.
 *  Large size at a level often acts as support (bid) or resistance (ask).
 *  Sudden changes in DOM liquidity can signal institutional activity."
 */

export class DomProcessor {
  private currentSnapshot: DomSnapshot | undefined;

  /**
   * Update DOM snapshot with new market depth data
   * 
   * @param bids - Array of bid levels [price, size]
   * @param asks - Array of ask levels [price, size]
   * @param currentPrice - Current market price
   */
  updateSnapshot(
    bids: Array<[number, number]>,
    asks: Array<[number, number]>,
    currentPrice: number
  ): DomSnapshot {
    const timestamp = Date.now();

    // Combine bids and asks into a single level array
    // Create a map of all unique prices
    const priceMap = new Map<number, { bid_size: number; ask_size: number; bid_orders: number; ask_orders: number }>();

    // Add bid data
    for (const [price, size] of bids) {
      if (!priceMap.has(price)) {
        priceMap.set(price, { bid_size: 0, ask_size: 0, bid_orders: 0, ask_orders: 0 });
      }
      const level = priceMap.get(price)!;
      level.bid_size = size;
      level.bid_orders = 1; // IBKR doesn't provide order count
    }

    // Add ask data
    for (const [price, size] of asks) {
      if (!priceMap.has(price)) {
        priceMap.set(price, { bid_size: 0, ask_size: 0, bid_orders: 0, ask_orders: 0 });
      }
      const level = priceMap.get(price)!;
      level.ask_size = size;
      level.ask_orders = 1; // IBKR doesn't provide order count
    }

    // Convert to array and sort by price (descending)
    const levels = Array.from(priceMap.entries())
      .map(([price, data]) => ({
        price,
        bid_size: data.bid_size,
        ask_size: data.ask_size,
        bid_orders: data.bid_orders,
        ask_orders: data.ask_orders,
      }))
      .sort((a, b) => b.price - a.price); // Highest price first

    // Find best bid and ask
    const bestBid = bids.length > 0 ? Math.max(...bids.map(([p]) => p)) : 0;
    const bestAsk = asks.length > 0 ? Math.min(...asks.map(([p]) => p)) : 0;
    const spread = bestAsk - bestBid;

    this.currentSnapshot = {
      timestamp,
      levels,
      best_bid: bestBid,
      best_ask: bestAsk,
      spread,
    };

    return this.currentSnapshot;
  }

  /**
   * Get current DOM snapshot
   */
  getSnapshot(): DomSnapshot | undefined {
    return this.currentSnapshot;
  }

  /**
   * Calculate total bid/ask volume
   */
  getTotalVolumes(): { bid_volume: number; ask_volume: number } {
    if (!this.currentSnapshot) {
      return { bid_volume: 0, ask_volume: 0 };
    }

    let bidVolume = 0;
    let askVolume = 0;

    for (const level of this.currentSnapshot.levels) {
      bidVolume += level.bid_size;
      askVolume += level.ask_size;
    }

    return { bid_volume: bidVolume, ask_volume: askVolume };
  }

  /**
   * Find largest bid/ask liquidity levels (potential support/resistance)
   * 
   * @param side - "BID" or "ASK"
   * @param topN - Number of top levels to return
   */
  getLargestLevels(
    side: "BID" | "ASK",
    topN: number = 3
  ): Array<{ price: number; size: number }> {
    if (!this.currentSnapshot) {
      return [];
    }

    const levelsWithSize = this.currentSnapshot.levels
      .map((level) => ({
        price: level.price,
        size: side === "BID" ? level.bid_size : level.ask_size,
      }))
      .filter((level) => level.size > 0);

    return [...levelsWithSize]
      .sort((a, b) => b.size - a.size)
      .slice(0, topN);
  }

  /**
   * Detect liquidity imbalance
   * 
   * Strong imbalance can predict short-term direction:
   * - Ratio > 0.65: Heavy bid side (potential upward pressure)
   * - Ratio < 0.35: Heavy ask side (potential downward pressure)
   */
  getImbalance(): {
    ratio: number;
    signal: "BULLISH" | "BEARISH" | "NEUTRAL";
    bid_volume: number;
    ask_volume: number;
  } {
    const { bid_volume, ask_volume } = this.getTotalVolumes();
    const totalVolume = bid_volume + ask_volume;
    const ratio = totalVolume > 0 ? bid_volume / totalVolume : 0.5;

    let signal: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    if (ratio > 0.65) {
      signal = "BULLISH";
    } else if (ratio < 0.35) {
      signal = "BEARISH";
    }

    return {
      ratio,
      signal,
      bid_volume,
      ask_volume,
    };
  }

  /**
   * Detect "stacked" liquidity - multiple large orders close together
   * This often indicates institutional activity
   * 
   * @param side - "BID" or "ASK"
   * @param minSize - Minimum size to consider "large"
   * @param maxPriceRange - Maximum price range to check (e.g., 5 ticks)
   */
  detectStackedLiquidity(
    side: "BID" | "ASK",
    minSize: number = 100,
    maxPriceRange: number = 5
  ): {
    detected: boolean;
    price_range: [number, number] | null;
    total_size: number;
    level_count: number;
  } {
    if (!this.currentSnapshot) {
      return { detected: false, price_range: null, total_size: 0, level_count: 0 };
    }

    // Filter large orders on the specified side
    const largeLevels = this.currentSnapshot.levels
      .filter((level) => {
        const size = side === "BID" ? level.bid_size : level.ask_size;
        return size >= minSize;
      })
      .map((level) => ({
        price: level.price,
        size: side === "BID" ? level.bid_size : level.ask_size,
      }));

    if (largeLevels.length < 2) {
      return { detected: false, price_range: null, total_size: 0, level_count: 0 };
    }

    // Sort by price
    const sorted = [...largeLevels].sort((a, b) => 
      side === "BID" ? b.price - a.price : a.price - b.price
    );

    // Check if levels are within price range
    const priceRange = Math.abs(sorted[0].price - sorted[sorted.length - 1].price);
    
    if (priceRange <= maxPriceRange) {
      const totalSize = sorted.reduce((sum, level) => sum + level.size, 0);
      
      return {
        detected: true,
        price_range: [sorted[0].price, sorted[sorted.length - 1].price],
        total_size: totalSize,
        level_count: sorted.length,
      };
    }

    return { detected: false, price_range: null, total_size: 0, level_count: 0 };
  }

  /**
   * Clear DOM data
   */
  clear(): void {
    this.currentSnapshot = undefined;
  }
}
