/**
 * Order Flow Signal Detector
 * 
 * G7FX PRO Course - Stage 3: Order Flow Refinement
 * 
 * Detects advanced order flow patterns beyond basic absorption:
 * - Lack of Participation: Price moves but delta doesn't confirm (divergence)
 * - Stacked Imbalances: 3+ diagonal imbalances (strong directional signal)
 * - Trapped Traders: High volume at extremes followed by reversal
 * - Initiative vs Responsive: New business or mean reversion
 * - Exhaustion: Trend running out of steam (volume/delta declining)
 * 
 * These are the "10%" fine-tuning tools that confirm entries/exits
 * NEVER trade order flow without context (profiles, VWAP, value migration)
 */

export interface OrderFlowSignal {
  signal_type: 
    | "LACK_OF_PARTICIPATION"
    | "STACKED_IMBALANCE"
    | "TRAPPED_TRADERS"
    | "INITIATIVE_BUYING"
    | "INITIATIVE_SELLING"
    | "RESPONSIVE_BUYING"
    | "RESPONSIVE_SELLING"
    | "EXHAUSTION_BULL"
    | "EXHAUSTION_BEAR"
    | "ABSORPTION_BUY"
    | "ABSORPTION_SELL";
  
  timestamp: number;
  price: number;
  strength: number; // 0-100
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  description: string;
  confidence: number; // 0-100
  actionable: boolean; // Can this signal be traded immediately?
}

export interface DeltaDivergence {
  price_high: number;
  price_low: number;
  delta_high: number;
  delta_low: number;
  divergence_type: "BULLISH" | "BEARISH" | "HIDDEN_BULLISH" | "HIDDEN_BEARISH";
  strength: number;
}

export class OrderFlowSignalDetector {
  private recentSignals: OrderFlowSignal[] = [];
  private maxSignalsTracked = 100;

  /**
   * Detect lack of participation (delta divergence)
   * 
   * Price makes new high/low but delta doesn't confirm
   * Indicates exhaustion or absorption
   */
  detectLackOfParticipation(
    currentPrice: number,
    currentDelta: number,
    recentPrices: number[],
    recentDeltas: number[]
  ): OrderFlowSignal | null {
    if (recentPrices.length < 10 || recentDeltas.length < 10) {
      return null;
    }

    const recentHighPrice = Math.max(...recentPrices);
    const recentLowPrice = Math.min(...recentPrices);
    const recentHighDelta = Math.max(...recentDeltas);
    const recentLowDelta = Math.min(...recentDeltas);

    // Bearish divergence: Price making higher high, delta making lower high
    if (currentPrice > recentHighPrice && currentDelta < recentHighDelta) {
      const deltaDrop = ((recentHighDelta - currentDelta) / Math.abs(recentHighDelta)) * 100;
      
      return {
        signal_type: "LACK_OF_PARTICIPATION",
        timestamp: Date.now(),
        price: currentPrice,
        strength: Math.min(100, deltaDrop),
        direction: "BEARISH",
        description: `Price new high @ ${currentPrice.toFixed(2)} but delta declining. Bearish divergence.`,
        confidence: deltaDrop > 30 ? 75 : 50,
        actionable: deltaDrop > 30, // Only actionable if strong divergence
      };
    }

    // Bullish divergence: Price making lower low, delta making higher low
    if (currentPrice < recentLowPrice && currentDelta > recentLowDelta) {
      const deltaRise = ((currentDelta - recentLowDelta) / Math.abs(recentLowDelta)) * 100;
      
      return {
        signal_type: "LACK_OF_PARTICIPATION",
        timestamp: Date.now(),
        price: currentPrice,
        strength: Math.min(100, deltaRise),
        direction: "BULLISH",
        description: `Price new low @ ${currentPrice.toFixed(2)} but delta rising. Bullish divergence.`,
        confidence: deltaRise > 30 ? 75 : 50,
        actionable: deltaRise > 30,
      };
    }

    return null;
  }

  /**
   * Detect stacked imbalances (3+ consecutive imbalances in same direction)
   * 
   * Indicates strong directional momentum
   * Typically precedes large moves
   */
  detectStackedImbalances(
    recentImbalances: Array<{ price: number; ratio: number; direction: "BUY" | "SELL" }>
  ): OrderFlowSignal | null {
    if (recentImbalances.length < 3) {
      return null;
    }

    // Check last 5 imbalances
    const lastFive = recentImbalances.slice(-5);
    
    // Count consecutive buy imbalances
    let buyStack = 0;
    for (let i = lastFive.length - 1; i >= 0; i--) {
      if (lastFive[i].direction === "BUY" && lastFive[i].ratio > 2.0) {
        buyStack++;
      } else {
        break;
      }
    }

    // Count consecutive sell imbalances
    let sellStack = 0;
    for (let i = lastFive.length - 1; i >= 0; i--) {
      if (lastFive[i].direction === "SELL" && lastFive[i].ratio > 2.0) {
        sellStack++;
      } else {
        break;
      }
    }

    if (buyStack >= 3) {
      const avgRatio = lastFive.slice(-buyStack).reduce((sum, imb) => sum + imb.ratio, 0) / buyStack;
      return {
        signal_type: "STACKED_IMBALANCE",
        timestamp: Date.now(),
        price: lastFive[lastFive.length - 1].price,
        strength: Math.min(100, buyStack * 20 + (avgRatio - 2) * 10),
        direction: "BULLISH",
        description: `${buyStack} stacked buy imbalances (avg ${avgRatio.toFixed(1)}:1). Strong upward momentum.`,
        confidence: 80,
        actionable: true,
      };
    }

    if (sellStack >= 3) {
      const avgRatio = lastFive.slice(-sellStack).reduce((sum, imb) => sum + imb.ratio, 0) / sellStack;
      return {
        signal_type: "STACKED_IMBALANCE",
        timestamp: Date.now(),
        price: lastFive[lastFive.length - 1].price,
        strength: Math.min(100, sellStack * 20 + (avgRatio - 2) * 10),
        direction: "BEARISH",
        description: `${sellStack} stacked sell imbalances (avg ${avgRatio.toFixed(1)}:1). Strong downward momentum.`,
        confidence: 80,
        actionable: true,
      };
    }

    return null;
  }

  /**
   * Detect trapped traders
   * 
   * High volume at extreme price, followed by quick reversal
   * Indicates failed breakout and trapped positions
   */
  detectTrappedTraders(
    currentPrice: number,
    recentPrices: number[],
    recentVolumes: number[],
    lookbackBars: number = 10
  ): OrderFlowSignal | null {
    if (recentPrices.length < lookbackBars || recentVolumes.length < lookbackBars) {
      return null;
    }

    const recent = recentPrices.slice(-lookbackBars);
    const volumes = recentVolumes.slice(-lookbackBars);
    
    const highestPrice = Math.max(...recent);
    const lowestPrice = Math.min(...recent);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    
    const highIndex = recent.indexOf(highestPrice);
    const lowIndex = recent.indexOf(lowestPrice);
    
    // Trapped longs: High volume at top, now reversing down
    if (
      highIndex < recent.length - 3 && // Not current bar
      volumes[highIndex] > avgVolume * 1.5 && // High volume at top
      currentPrice < highestPrice * 0.998 // Reversed significantly
    ) {
      const drop = highestPrice - currentPrice;
      const dropPct = (drop / highestPrice) * 100;
      
      return {
        signal_type: "TRAPPED_TRADERS",
        timestamp: Date.now(),
        price: currentPrice,
        strength: Math.min(100, dropPct * 50),
        direction: "BEARISH",
        description: `Trapped longs @ ${highestPrice.toFixed(2)}. High volume failed breakout. Reversal.`,
        confidence: 70,
        actionable: true,
      };
    }

    // Trapped shorts: High volume at bottom, now reversing up
    if (
      lowIndex < recent.length - 3 &&
      volumes[lowIndex] > avgVolume * 1.5 &&
      currentPrice > lowestPrice * 1.002
    ) {
      const rally = currentPrice - lowestPrice;
      const rallyPct = (rally / lowestPrice) * 100;
      
      return {
        signal_type: "TRAPPED_TRADERS",
        timestamp: Date.now(),
        price: currentPrice,
        strength: Math.min(100, rallyPct * 50),
        direction: "BULLISH",
        description: `Trapped shorts @ ${lowestPrice.toFixed(2)}. High volume failed breakdown. Reversal.`,
        confidence: 70,
        actionable: true,
      };
    }

    return null;
  }

  /**
   * Classify trading as Initiative vs Responsive
   * 
   * Initiative: New business outside value area (trend potential)
   * Responsive: Trading back into value area (mean reversion)
   */
  classifyTradingType(
    currentPrice: number,
    vah: number,
    val: number,
    recentVolume: number,
    avgVolume: number,
    timeOutsideValue: number // minutes
  ): OrderFlowSignal {
    const isOutsideValue = currentPrice > vah || currentPrice < val;
    const highVolume = recentVolume > avgVolume * 1.2;

    if (isOutsideValue && highVolume && timeOutsideValue > 15) {
      // Initiative trading (new business)
      const direction = currentPrice > vah ? "BULLISH" : "BEARISH";
      const signalType = direction === "BULLISH" ? "INITIATIVE_BUYING" : "INITIATIVE_SELLING";
      
      return {
        signal_type: signalType,
        timestamp: Date.now(),
        price: currentPrice,
        strength: Math.min(100, 60 + timeOutsideValue),
        direction: direction,
        description: `Initiative ${direction.toLowerCase()} outside value. New business. Trend potential.`,
        confidence: 75,
        actionable: true,
      };
    } else if (isOutsideValue && !highVolume) {
      // Responsive trading (likely to mean revert)
      const direction = currentPrice > vah ? "BEARISH" : "BULLISH"; // Fade the move
      const signalType = direction === "BULLISH" ? "RESPONSIVE_BUYING" : "RESPONSIVE_SELLING";
      
      return {
        signal_type: signalType,
        timestamp: Date.now(),
        price: currentPrice,
        strength: 50,
        direction: direction,
        description: `Responsive trading. Low volume outside value. Likely mean reversion.`,
        confidence: 60,
        actionable: true,
      };
    }

    return {
      signal_type: "RESPONSIVE_BUYING",
      timestamp: Date.now(),
      price: currentPrice,
      strength: 0,
      direction: "NEUTRAL",
      description: "Inside value area. No clear initiative/responsive signal.",
      confidence: 0,
      actionable: false,
    };
  }

  /**
   * Detect exhaustion (trend running out of steam)
   * 
   * Price continuing but volume/delta declining
   */
  detectExhaustion(
    recentPrices: number[],
    recentVolumes: number[],
    recentDeltas: number[]
  ): OrderFlowSignal | null {
    if (recentPrices.length < 10) {
      return null;
    }

    const firstHalf = recentPrices.slice(0, 5);
    const secondHalf = recentPrices.slice(5, 10);
    
    const firstHalfVolume = recentVolumes.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const secondHalfVolume = recentVolumes.slice(5, 10).reduce((a, b) => a + b, 0) / 5;
    
    const firstHalfDelta = recentDeltas.slice(0, 5).reduce((a, b) => a + b, 0);
    const secondHalfDelta = recentDeltas.slice(5, 10).reduce((a, b) => a + b, 0);

    // Price trending up but volume/delta declining = bullish exhaustion
    const priceUp = secondHalf[secondHalf.length - 1] > firstHalf[0];
    const volumeDown = secondHalfVolume < firstHalfVolume * 0.8;
    const deltaDown = secondHalfDelta < firstHalfDelta * 0.5;

    if (priceUp && (volumeDown || deltaDown)) {
      return {
        signal_type: "EXHAUSTION_BULL",
        timestamp: Date.now(),
        price: recentPrices[recentPrices.length - 1],
        strength: 70,
        direction: "BEARISH",
        description: "Bullish trend exhausting. Volume/delta declining. Potential reversal.",
        confidence: volumeDown && deltaDown ? 80 : 60,
        actionable: volumeDown && deltaDown,
      };
    }

    // Price trending down but volume/delta declining = bearish exhaustion
    const priceDown = secondHalf[secondHalf.length - 1] < firstHalf[0];
    const deltaUp = secondHalfDelta > firstHalfDelta * 1.5; // Delta less negative

    if (priceDown && (volumeDown || deltaUp)) {
      return {
        signal_type: "EXHAUSTION_BEAR",
        timestamp: Date.now(),
        price: recentPrices[recentPrices.length - 1],
        strength: 70,
        direction: "BULLISH",
        description: "Bearish trend exhausting. Volume/delta declining. Potential reversal.",
        confidence: volumeDown && deltaUp ? 80 : 60,
        actionable: volumeDown && deltaUp,
      };
    }

    return null;
  }

  /**
   * Add signal to tracking
   */
  addSignal(signal: OrderFlowSignal): void {
    this.recentSignals.push(signal);
    if (this.recentSignals.length > this.maxSignalsTracked) {
      this.recentSignals.shift();
    }
  }

  /**
   * Get recent signals (for UI display)
   */
  getRecentSignals(count: number = 10): OrderFlowSignal[] {
    return this.recentSignals.slice(-count);
  }

  /**
   * Clear old signals
   */
  clearOldSignals(olderThan: number): void {
    const cutoff = Date.now() - olderThan;
    this.recentSignals = this.recentSignals.filter((s) => s.timestamp > cutoff);
  }

  /**
   * Process market data and detect all signal types
   * 
   * This is the main entry point that should be called on each market update
   */
  processMarketData(data: {
    currentPrice: number;
    currentDelta: number;
    currentVolume: number;
    recentPrices: number[];
    recentDeltas: number[];
    recentVolumes: number[];
    recentImbalances: Array<{ price: number; ratio: number; direction: "BUY" | "SELL" }>;
    vah: number;
    val: number;
    avgVolume: number;
    timeOutsideValue?: number;
  }): OrderFlowSignal[] {
    const newSignals: OrderFlowSignal[] = [];

    // 1. Lack of Participation (Delta Divergence)
    const lackOfParticipation = this.detectLackOfParticipation(
      data.currentPrice,
      data.currentDelta,
      data.recentPrices,
      data.recentDeltas
    );
    if (lackOfParticipation) {
      this.addSignal(lackOfParticipation);
      newSignals.push(lackOfParticipation);
    }

    // 2. Stacked Imbalances
    const stackedImbalance = this.detectStackedImbalances(data.recentImbalances);
    if (stackedImbalance) {
      this.addSignal(stackedImbalance);
      newSignals.push(stackedImbalance);
    }

    // 3. Trapped Traders
    const trappedTraders = this.detectTrappedTraders(
      data.currentPrice,
      data.recentPrices,
      data.recentVolumes
    );
    if (trappedTraders) {
      this.addSignal(trappedTraders);
      newSignals.push(trappedTraders);
    }

    // 4. Initiative vs Responsive
    if (data.timeOutsideValue !== undefined) {
      const tradingType = this.classifyTradingType(
        data.currentPrice,
        data.vah,
        data.val,
        data.currentVolume,
        data.avgVolume,
        data.timeOutsideValue
      );
      if (tradingType.actionable) {
        this.addSignal(tradingType);
        newSignals.push(tradingType);
      }
    }

    // 5. Exhaustion
    const exhaustion = this.detectExhaustion(
      data.recentPrices,
      data.recentVolumes,
      data.recentDeltas
    );
    if (exhaustion) {
      this.addSignal(exhaustion);
      newSignals.push(exhaustion);
    }

    // Clean up old signals (older than 1 hour)
    this.clearOldSignals(60 * 60 * 1000);

    return newSignals;
  }
}
