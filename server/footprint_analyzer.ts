import type { TimeAndSalesEntry } from "@shared/schema";

/**
 * Footprint Analysis Engine
 * 
 * Stage 3 Order Flow (5% edge) - The Microscope View
 * 
 * Builds footprint charts showing bid/ask volume at each price level
 * Detects imbalances, delta clusters, and POC shifts within bars
 * 
 * Based on G7FX PRO Course Module 3.3-3.9
 */

export interface FootprintPriceLevel {
  price: number;
  bid_volume: number;  // Volume traded at bid (sellers)
  ask_volume: number;  // Volume traded at ask (buyers)
  delta: number;       // ask_volume - bid_volume
  total_volume: number;
  imbalance_ratio: number; // Ratio of dominant side to weaker side
  imbalanced: boolean;     // True if ratio >= 2:1
}

export interface FootprintBar {
  start_time: number;
  end_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  
  // Footprint-specific data
  price_levels: FootprintPriceLevel[];
  total_bid_volume: number;
  total_ask_volume: number;
  bar_delta: number;  // Total ask_volume - bid_volume for entire bar
  poc_price: number;  // Point of Control - price with highest volume
  
  // Imbalance detection
  stacked_buying: boolean;  // 3+ consecutive levels with ask dominance
  stacked_selling: boolean; // 3+ consecutive levels with bid dominance
  imbalance_count: number;  // Number of imbalanced levels
  
  // Delta statistics
  max_positive_delta: number; // Strongest buying level
  max_negative_delta: number; // Strongest selling level
  delta_at_poc: number;       // Delta at POC (indicates if POC was buying or selling)
}

export class FootprintAnalyzer {
  private currentBar: FootprintBar | null = null;
  private completedBars: FootprintBar[] = [];
  private barDurationMs: number;
  private tickSize: number;
  private maxBars: number;
  
  // Imbalance thresholds
  private imbalanceRatioThreshold: number = 2.0; // 2:1 ratio
  private stackedImbalanceCount: number = 3;     // 3+ consecutive levels
  
  constructor(
    barDurationMs: number = 5 * 60 * 1000, // 5 minutes
    tickSize: number = 0.25,  // ES tick size
    maxBars: number = 100
  ) {
    this.barDurationMs = barDurationMs;
    this.tickSize = tickSize;
    this.maxBars = maxBars;
  }
  
  /**
   * Process a tick and update footprint data
   */
  processTick(entry: TimeAndSalesEntry): FootprintBar | null {
    // Initialize or check if we need a new bar
    if (!this.currentBar) {
      this.initializeBar(entry.timestamp);
    } else if (entry.timestamp >= this.currentBar.end_time) {
      // Bar completed, finalize it
      const completedBar = this.finalizeBar();
      this.initializeBar(entry.timestamp);
      
      // Add the tick to the new bar
      this.addTickToBar(entry);
      
      return completedBar;
    }
    
    // Add tick to current bar
    this.addTickToBar(entry);
    
    return null;
  }
  
  /**
   * Initialize a new footprint bar
   */
  private initializeBar(timestamp: number): void {
    const startTime = Math.floor(timestamp / this.barDurationMs) * this.barDurationMs;
    
    this.currentBar = {
      start_time: startTime,
      end_time: startTime + this.barDurationMs,
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      price_levels: [],
      total_bid_volume: 0,
      total_ask_volume: 0,
      bar_delta: 0,
      poc_price: 0,
      stacked_buying: false,
      stacked_selling: false,
      imbalance_count: 0,
      max_positive_delta: 0,
      max_negative_delta: 0,
      delta_at_poc: 0,
    };
  }
  
  /**
   * Add a tick to the current bar's footprint
   */
  private addTickToBar(entry: TimeAndSalesEntry): void {
    if (!this.currentBar) return;
    
    // Update OHLC
    if (this.currentBar.open === 0) {
      this.currentBar.open = entry.price;
      this.currentBar.high = entry.price;
      this.currentBar.low = entry.price;
    } else {
      this.currentBar.high = Math.max(this.currentBar.high, entry.price);
      this.currentBar.low = Math.min(this.currentBar.low, entry.price);
    }
    this.currentBar.close = entry.price;
    
    // Find or create price level
    let priceLevel = this.currentBar.price_levels.find(
      (level) => Math.abs(level.price - entry.price) < this.tickSize / 2
    );
    
    if (!priceLevel) {
      priceLevel = {
        price: entry.price,
        bid_volume: 0,
        ask_volume: 0,
        delta: 0,
        total_volume: 0,
        imbalance_ratio: 1.0,
        imbalanced: false,
      };
      this.currentBar.price_levels.push(priceLevel);
    }
    
    // Update volume based on aggressor side
    if (entry.side === "BUY") {
      // Buyer aggressed, took liquidity at ask
      priceLevel.ask_volume += entry.volume;
      this.currentBar.total_ask_volume += entry.volume;
    } else {
      // Seller aggressed, hit liquidity at bid
      priceLevel.bid_volume += entry.volume;
      this.currentBar.total_bid_volume += entry.volume;
    }
    
    // Recalculate price level stats
    priceLevel.total_volume = priceLevel.bid_volume + priceLevel.ask_volume;
    priceLevel.delta = priceLevel.ask_volume - priceLevel.bid_volume;
    
    // Calculate imbalance ratio
    const maxVol = Math.max(priceLevel.bid_volume, priceLevel.ask_volume);
    const minVol = Math.min(priceLevel.bid_volume, priceLevel.ask_volume);
    priceLevel.imbalance_ratio = minVol > 0 ? maxVol / minVol : maxVol;
    priceLevel.imbalanced = priceLevel.imbalance_ratio >= this.imbalanceRatioThreshold;
  }
  
  /**
   * Finalize current bar and analyze footprint patterns
   */
  private finalizeBar(): FootprintBar {
    if (!this.currentBar) {
      throw new Error("No current bar to finalize");
    }
    
    // Sort price levels by price (ascending)
    this.currentBar.price_levels.sort((a, b) => a.price - b.price);
    
    // Calculate bar-level statistics
    this.currentBar.bar_delta = this.currentBar.total_ask_volume - this.currentBar.total_bid_volume;
    
    // Find POC (price with highest volume)
    let maxVolume = 0;
    for (const level of this.currentBar.price_levels) {
      if (level.total_volume > maxVolume) {
        maxVolume = level.total_volume;
        this.currentBar.poc_price = level.price;
        this.currentBar.delta_at_poc = level.delta;
      }
    }
    
    // Detect stacked imbalances
    this.detectStackedImbalances();
    
    // Find max deltas
    for (const level of this.currentBar.price_levels) {
      if (level.delta > this.currentBar.max_positive_delta) {
        this.currentBar.max_positive_delta = level.delta;
      }
      if (level.delta < this.currentBar.max_negative_delta) {
        this.currentBar.max_negative_delta = level.delta;
      }
    }
    
    // Count imbalanced levels
    this.currentBar.imbalance_count = this.currentBar.price_levels.filter(
      (level) => level.imbalanced
    ).length;
    
    // Store completed bar
    this.completedBars.push(this.currentBar);
    if (this.completedBars.length > this.maxBars) {
      this.completedBars.shift();
    }
    
    const completedBar = this.currentBar;
    this.currentBar = null;
    
    return completedBar;
  }
  
  /**
   * Detect stacked buying or selling (3+ consecutive imbalanced levels)
   */
  private detectStackedImbalances(): void {
    if (!this.currentBar || this.currentBar.price_levels.length < this.stackedImbalanceCount) {
      return;
    }
    
    let consecutiveBuying = 0;
    let consecutiveSelling = 0;
    
    for (const level of this.currentBar.price_levels) {
      if (level.imbalanced) {
        if (level.delta > 0) {
          // Buying imbalance
          consecutiveBuying++;
          consecutiveSelling = 0;
        } else {
          // Selling imbalance
          consecutiveSelling++;
          consecutiveBuying = 0;
        }
        
        if (consecutiveBuying >= this.stackedImbalanceCount) {
          this.currentBar.stacked_buying = true;
        }
        if (consecutiveSelling >= this.stackedImbalanceCount) {
          this.currentBar.stacked_selling = true;
        }
      } else {
        // Reset counters if not imbalanced
        consecutiveBuying = 0;
        consecutiveSelling = 0;
      }
    }
  }
  
  /**
   * Get current incomplete bar (for real-time display)
   */
  getCurrentBar(): FootprintBar | null {
    return this.currentBar;
  }
  
  /**
   * Get completed bars
   */
  getCompletedBars(limit?: number): FootprintBar[] {
    if (limit) {
      return this.completedBars.slice(-limit);
    }
    return [...this.completedBars];
  }
  
  /**
   * Get most recent completed bar
   */
  getLatestBar(): FootprintBar | null {
    return this.completedBars.length > 0
      ? this.completedBars[this.completedBars.length - 1]
      : null;
  }
  
  /**
   * Force completion of current bar (useful for session boundaries)
   */
  forceCompleteBar(): FootprintBar | null {
    if (this.currentBar) {
      return this.finalizeBar();
    }
    return null;
  }
  
  /**
   * Clear all data (session reset)
   */
  clear(): void {
    this.currentBar = null;
    this.completedBars = [];
  }
}
