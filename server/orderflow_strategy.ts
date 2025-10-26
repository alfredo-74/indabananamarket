/**
 * OrderFlowStrategy
 * 
 * Institutional-grade order flow trading strategy that combines:
 * - Absorption detection (institutional defense/aggression)
 * - DOM imbalance analysis (order book pressure)
 * - Time & Sales flow (buy/sell pressure ratios)
 * - Volume Profile context (POC, VAH, VAL as key levels)
 * 
 * Follows professional prop firm methodology from Foundation Course.
 */

import type { 
  AbsorptionEvent, 
  DomSnapshot, 
  TimeAndSalesEntry,
  VolumeProfile 
} from '@shared/schema';

export interface OrderFlowSignal {
  type: 'LONG' | 'SHORT' | 'NONE';
  confidence: number; // 0-100
  reason: string;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  signals: {
    absorption?: string;
    dom_imbalance?: string;
    tape_pressure?: string;
    profile_context?: string;
  };
}

export interface OrderFlowSettings {
  // Absorption settings
  absorption_threshold: number; // Minimum absorption ratio (e.g., 2.0 = 2:1 volume ratio)
  absorption_lookback: number; // Minutes to look back for absorption events
  
  // DOM settings
  dom_imbalance_threshold: number; // Minimum bid/ask imbalance ratio (e.g., 2.0 = 2:1)
  dom_depth_levels: number; // Number of price levels to analyze (default: 10)
  
  // Time & Sales settings
  tape_volume_threshold: number; // Minimum volume for "large" order
  tape_ratio_threshold: number; // Buy/sell ratio threshold (e.g., 1.5 = 60/40 split)
  tape_lookback_seconds: number; // Seconds to analyze tape flow
  
  // Volume Profile settings
  use_poc_magnet: boolean; // Use POC as price magnet
  use_vah_val_boundaries: boolean; // Use VAH/VAL as support/resistance
  
  // Risk management
  stop_loss_ticks: number; // Ticks for stop loss (MES = 0.25 per tick)
  take_profit_ticks: number; // Ticks for take profit
  
  // General
  min_confidence: number; // Minimum confidence to take trade (0-100)
}

export class OrderFlowStrategy {
  private settings: OrderFlowSettings;
  
  constructor(settings: OrderFlowSettings) {
    this.settings = settings;
  }
  
  /**
   * Analyze current order flow and generate trading signal
   */
  analyzeOrderFlow(
    currentPrice: number,
    absorptionEvents: AbsorptionEvent[],
    domSnapshot: DomSnapshot | null,
    timeAndSales: TimeAndSalesEntry[],
    volumeProfile: VolumeProfile | null
  ): OrderFlowSignal {
    const signals: OrderFlowSignal['signals'] = {};
    let confidence = 0;
    let biasLong = 0; // Positive = bullish, negative = bearish
    let biasShort = 0;
    
    // 1. ABSORPTION ANALYSIS
    const absorptionSignal = this.analyzeAbsorption(absorptionEvents, currentPrice);
    if (absorptionSignal) {
      signals.absorption = absorptionSignal.reason;
      if (absorptionSignal.type === 'LONG') {
        biasLong += absorptionSignal.weight;
        confidence += 30; // Absorption is strong signal (30%)
      } else if (absorptionSignal.type === 'SHORT') {
        biasShort += absorptionSignal.weight;
        confidence += 30;
      }
    }
    
    // 2. DOM IMBALANCE ANALYSIS
    const domSignal = this.analyzeDomImbalance(domSnapshot, currentPrice);
    if (domSignal) {
      signals.dom_imbalance = domSignal.reason;
      if (domSignal.type === 'LONG') {
        biasLong += domSignal.weight;
        confidence += 25; // DOM is good confirmation (25%)
      } else if (domSignal.type === 'SHORT') {
        biasShort += domSignal.weight;
        confidence += 25;
      }
    }
    
    // 3. TIME & SALES PRESSURE ANALYSIS
    const tapeSignal = this.analyzeTapePressure(timeAndSales);
    if (tapeSignal) {
      signals.tape_pressure = tapeSignal.reason;
      if (tapeSignal.type === 'LONG') {
        biasLong += tapeSignal.weight;
        confidence += 20; // Tape adds conviction (20%)
      } else if (tapeSignal.type === 'SHORT') {
        biasShort += tapeSignal.weight;
        confidence += 20;
      }
    }
    
    // 4. VOLUME PROFILE CONTEXT
    const profileSignal = this.analyzeVolumeProfile(volumeProfile, currentPrice);
    if (profileSignal) {
      signals.profile_context = profileSignal.reason;
      confidence += 25; // Profile context is important (25%)
    }
    
    // DETERMINE FINAL SIGNAL
    const netBias = biasLong - biasShort;
    
    if (Math.abs(netBias) < 0.5) {
      // No clear bias
      return {
        type: 'NONE',
        confidence: 0,
        reason: 'No clear order flow bias',
        entry_price: currentPrice,
        stop_loss: currentPrice,
        take_profit: currentPrice,
        signals,
      };
    }
    
    // Check minimum confidence threshold
    if (confidence < this.settings.min_confidence) {
      return {
        type: 'NONE',
        confidence,
        reason: `Confidence ${confidence}% below threshold ${this.settings.min_confidence}%`,
        entry_price: currentPrice,
        stop_loss: currentPrice,
        take_profit: currentPrice,
        signals,
      };
    }
    
    const type = netBias > 0 ? 'LONG' : 'SHORT';
    const tickSize = 0.25; // MES tick size
    
    const stop_loss = type === 'LONG'
      ? currentPrice - (this.settings.stop_loss_ticks * tickSize)
      : currentPrice + (this.settings.stop_loss_ticks * tickSize);
      
    const take_profit = type === 'LONG'
      ? currentPrice + (this.settings.take_profit_ticks * tickSize)
      : currentPrice - (this.settings.take_profit_ticks * tickSize);
    
    const reasons = Object.values(signals).filter(Boolean).join(' + ');
    
    return {
      type,
      confidence,
      reason: reasons || 'Order flow confluence',
      entry_price: currentPrice,
      stop_loss,
      take_profit,
      signals,
    };
  }
  
  /**
   * Analyze recent absorption events for institutional activity
   */
  private analyzeAbsorption(
    events: AbsorptionEvent[],
    currentPrice: number
  ): { type: 'LONG' | 'SHORT'; weight: number; reason: string } | null {
    if (!events || events.length === 0) return null;
    
    // Filter recent events (within lookback window)
    const cutoffTime = Date.now() - (this.settings.absorption_lookback * 60 * 1000);
    const recentEvents = events.filter(e => e.timestamp >= cutoffTime);
    
    if (recentEvents.length === 0) return null;
    
    // Find events near current price (within 1 point)
    const nearbyEvents = recentEvents.filter(e => 
      Math.abs(e.price - currentPrice) <= 1.0
    );
    
    if (nearbyEvents.length === 0) return null;
    
    // Get the strongest recent absorption event
    const strongestEvent = nearbyEvents.reduce((max, event) => 
      event.ratio > max.ratio ? event : max
    );
    
    if (strongestEvent.ratio < this.settings.absorption_threshold) {
      return null;
    }
    
    // BUY_ABSORPTION = sellers absorbed at support = bullish
    // SELL_ABSORPTION = buyers absorbed at resistance = bearish
    const type = strongestEvent.side === 'BUY_ABSORPTION' ? 'LONG' : 'SHORT';
    const weight = Math.min(strongestEvent.ratio / 3.0, 2.0); // Cap at 2.0
    
    const reason = `${strongestEvent.side === 'BUY_ABSORPTION' ? 'Buy' : 'Sell'} absorption ${strongestEvent.ratio.toFixed(1)}:1 @ ${strongestEvent.price.toFixed(2)}`;
    
    return { type, weight, reason };
  }
  
  /**
   * Analyze DOM bid/ask imbalance
   */
  private analyzeDomImbalance(
    dom: DomSnapshot | null,
    currentPrice: number
  ): { type: 'LONG' | 'SHORT'; weight: number; reason: string } | null {
    if (!dom || !dom.levels || dom.levels.length === 0) return null;
    
    const topLevels = dom.levels.slice(0, this.settings.dom_depth_levels);
    
    const bidVolume = topLevels.reduce((sum, level) => sum + level.bid_size, 0);
    const askVolume = topLevels.reduce((sum, level) => sum + level.ask_size, 0);
    
    if (bidVolume === 0 || askVolume === 0) return null;
    
    const ratio = Math.max(bidVolume, askVolume) / Math.min(bidVolume, askVolume);
    
    if (ratio < this.settings.dom_imbalance_threshold) return null;
    
    const type = bidVolume > askVolume ? 'LONG' : 'SHORT';
    const weight = Math.min(ratio / 2.0, 1.5); // Cap at 1.5
    
    const reason = type === 'LONG'
      ? `Bid stack ${ratio.toFixed(1)}:1 (${bidVolume} vs ${askVolume})`
      : `Ask stack ${ratio.toFixed(1)}:1 (${askVolume} vs ${bidVolume})`;
    
    return { type, weight, reason };
  }
  
  /**
   * Analyze Time & Sales tape for buy/sell pressure
   */
  private analyzeTapePressure(
    tapeData: TimeAndSalesEntry[]
  ): { type: 'LONG' | 'SHORT'; weight: number; reason: string } | null {
    if (!tapeData || tapeData.length === 0) return null;
    
    // Filter recent tape (within lookback seconds)
    const cutoffTime = Date.now() - (this.settings.tape_lookback_seconds * 1000);
    const recentTape = tapeData.filter(t => t.timestamp >= cutoffTime);
    
    if (recentTape.length === 0) return null;
    
    // Calculate buy/sell volumes
    const buyVolume = recentTape
      .filter(t => t.side === 'BUY')
      .reduce((sum, t) => sum + t.volume, 0);
      
    const sellVolume = recentTape
      .filter(t => t.side === 'SELL')
      .reduce((sum, t) => sum + t.volume, 0);
    
    if (buyVolume === 0 || sellVolume === 0) return null;
    
    const ratio = Math.max(buyVolume, sellVolume) / Math.min(buyVolume, sellVolume);
    
    if (ratio < this.settings.tape_ratio_threshold) return null;
    
    const type = buyVolume > sellVolume ? 'LONG' : 'SHORT';
    const weight = Math.min(ratio / 2.0, 1.5); // Cap at 1.5
    
    const reason = type === 'LONG'
      ? `Buy pressure ${ratio.toFixed(1)}:1 (${buyVolume} vs ${sellVolume})`
      : `Sell pressure ${ratio.toFixed(1)}:1 (${sellVolume} vs ${buyVolume})`;
    
    return { type, weight, reason };
  }
  
  /**
   * Analyze Volume Profile for context
   */
  private analyzeVolumeProfile(
    profile: VolumeProfile | null,
    currentPrice: number
  ): { reason: string } | null {
    if (!profile) return null;
    
    const contexts: string[] = [];
    
    // Check proximity to POC (Point of Control = highest volume)
    if (this.settings.use_poc_magnet && profile.poc) {
      const distanceToPoc = Math.abs(currentPrice - profile.poc);
      if (distanceToPoc <= 2.0) {
        contexts.push(`Near POC @ ${profile.poc.toFixed(2)}`);
      }
    }
    
    // Check VAH/VAL boundaries
    if (this.settings.use_vah_val_boundaries) {
      if (profile.vah && currentPrice >= profile.vah) {
        contexts.push(`Above VAH ${profile.vah.toFixed(2)} (strong)`);
      } else if (profile.val && currentPrice <= profile.val) {
        contexts.push(`Below VAL ${profile.val.toFixed(2)} (weak)`);
      } else if (profile.vah && profile.val) {
        contexts.push(`In value area ${profile.val.toFixed(2)}-${profile.vah.toFixed(2)}`);
      }
    }
    
    if (contexts.length === 0) return null;
    
    return { reason: contexts.join(', ') };
  }
  
  /**
   * Update strategy settings
   */
  updateSettings(newSettings: Partial<OrderFlowSettings>) {
    this.settings = { ...this.settings, ...newSettings };
  }
  
  /**
   * Get current settings
   */
  getSettings(): OrderFlowSettings {
    return { ...this.settings };
  }
}

// Default order flow settings based on Foundation Course methodology
export const DEFAULT_ORDERFLOW_SETTINGS: OrderFlowSettings = {
  // Absorption
  absorption_threshold: 2.0, // 2:1 ratio minimum
  absorption_lookback: 5, // 5 minutes
  
  // DOM
  dom_imbalance_threshold: 2.0, // 2:1 bid/ask ratio
  dom_depth_levels: 10, // Top 10 levels
  
  // Tape
  tape_volume_threshold: 10, // 10 contracts = "large"
  tape_ratio_threshold: 1.5, // 60/40 buy/sell split
  tape_lookback_seconds: 60, // 1 minute
  
  // Volume Profile
  use_poc_magnet: true,
  use_vah_val_boundaries: true,
  
  // Risk Management
  stop_loss_ticks: 8, // 2 points (8 ticks * 0.25)
  take_profit_ticks: 16, // 4 points (16 ticks * 0.25)
  
  // Confidence
  min_confidence: 60, // Need 60% confidence minimum
};
