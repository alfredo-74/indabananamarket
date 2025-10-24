import type { VWAPData, RegimeState, Position, MarketData } from "@shared/schema";

export interface TradeSignal {
  action: "BUY" | "SELL" | "CLOSE" | "NONE";
  quantity: number;
  reason: string;
  entry_price: number;
  stop_loss?: number;
  take_profit?: number;
}

export class AutoTrader {
  private maxPositionSize: number = 1; // Max 1 MES contract for $2,000 account
  private minCapital: number = 2000;

  /**
   * Analyze market conditions and generate trade signals
   * 
   * Strategy:
   * - ROTATIONAL: Mean reversion at SD±3, targeting VWAP
   * - DIRECTIONAL_BULLISH: Long at SD-1, targets at SD+1/+2/+3
   * - DIRECTIONAL_BEARISH: Short at SD+1, targets at SD-1/-2/-3
   */
  analyzeMarket(
    marketData: MarketData,
    vwap: VWAPData,
    regime: RegimeState,
    position: Position
  ): TradeSignal {
    // Safety check: VWAP must be calculated
    if (
      vwap.vwap === null ||
      vwap.sd1_upper === null ||
      vwap.sd1_lower === null ||
      vwap.sd3_upper === null ||
      vwap.sd3_lower === null
    ) {
      return {
        action: "NONE",
        quantity: 0,
        reason: "VWAP not yet calculated (need 10 candles)",
        entry_price: marketData.last_price,
      };
    }

    const currentPrice = marketData.last_price;

    // Check for exit signals first (if we have a position)
    if (position.contracts !== 0) {
      const exitSignal = this.checkExitConditions(
        currentPrice,
        vwap,
        regime,
        position
      );
      if (exitSignal.action !== "NONE") {
        return exitSignal;
      }
    }

    // Don't open new positions if we already have one
    if (position.contracts !== 0) {
      return {
        action: "NONE",
        quantity: 0,
        reason: "Position already open",
        entry_price: currentPrice,
      };
    }

    // Check for entry signals based on regime
    switch (regime) {
      case "ROTATIONAL":
        return this.checkRotationalEntry(currentPrice, vwap);

      case "DIRECTIONAL_BULLISH":
        return this.checkBullishEntry(currentPrice, vwap);

      case "DIRECTIONAL_BEARISH":
        return this.checkBearishEntry(currentPrice, vwap);

      default:
        return {
          action: "NONE",
          quantity: 0,
          reason: "Unknown regime",
          entry_price: currentPrice,
        };
    }
  }

  /**
   * ROTATIONAL regime: Mean reversion strategy
   * Enter when price reaches SD±3, target VWAP
   */
  private checkRotationalEntry(
    currentPrice: number,
    vwap: VWAPData
  ): TradeSignal {
    // Buy signal: Price below SD-3 (oversold)
    if (vwap.sd3_lower !== null && currentPrice <= vwap.sd3_lower) {
      return {
        action: "BUY",
        quantity: this.maxPositionSize,
        reason: "ROTATIONAL: Price at SD-3 (oversold), targeting VWAP",
        entry_price: currentPrice,
        take_profit: vwap.vwap!,
        stop_loss: vwap.sd3_lower - 2, // Stop 2 points below entry
      };
    }

    // Sell signal: Price above SD+3 (overbought)
    if (vwap.sd3_upper !== null && currentPrice >= vwap.sd3_upper) {
      return {
        action: "SELL",
        quantity: this.maxPositionSize,
        reason: "ROTATIONAL: Price at SD+3 (overbought), targeting VWAP",
        entry_price: currentPrice,
        take_profit: vwap.vwap!,
        stop_loss: vwap.sd3_upper + 2, // Stop 2 points above entry
      };
    }

    return {
      action: "NONE",
      quantity: 0,
      reason: "ROTATIONAL: Waiting for SD±3 entry",
      entry_price: currentPrice,
    };
  }

  /**
   * DIRECTIONAL_BULLISH regime: Trend following (long bias)
   * Enter long at SD-1, targets at SD+1/+2/+3
   */
  private checkBullishEntry(
    currentPrice: number,
    vwap: VWAPData
  ): TradeSignal {
    // Buy signal: Price at or below SD-1 (pullback in uptrend)
    if (vwap.sd1_lower !== null && currentPrice <= vwap.sd1_lower) {
      return {
        action: "BUY",
        quantity: this.maxPositionSize,
        reason: "DIRECTIONAL_BULLISH: Long entry at SD-1 pullback",
        entry_price: currentPrice,
        take_profit: vwap.sd2_upper!, // Target SD+2
        stop_loss: vwap.sd2_lower!, // Stop at SD-2
      };
    }

    return {
      action: "NONE",
      quantity: 0,
      reason: "DIRECTIONAL_BULLISH: Waiting for SD-1 pullback",
      entry_price: currentPrice,
    };
  }

  /**
   * DIRECTIONAL_BEARISH regime: Trend following (short bias)
   * Enter short at SD+1, targets at SD-1/-2/-3
   */
  private checkBearishEntry(
    currentPrice: number,
    vwap: VWAPData
  ): TradeSignal {
    // Sell signal: Price at or above SD+1 (rally in downtrend)
    if (vwap.sd1_upper !== null && currentPrice >= vwap.sd1_upper) {
      return {
        action: "SELL",
        quantity: this.maxPositionSize,
        reason: "DIRECTIONAL_BEARISH: Short entry at SD+1 rally",
        entry_price: currentPrice,
        take_profit: vwap.sd2_lower!, // Target SD-2
        stop_loss: vwap.sd2_upper!, // Stop at SD+2
      };
    }

    return {
      action: "NONE",
      quantity: 0,
      reason: "DIRECTIONAL_BEARISH: Waiting for SD+1 rally",
      entry_price: currentPrice,
    };
  }

  /**
   * Check exit conditions for open positions
   */
  private checkExitConditions(
    currentPrice: number,
    vwap: VWAPData,
    regime: RegimeState,
    position: Position
  ): TradeSignal {
    const isLong = position.contracts > 0;
    const isShort = position.contracts < 0;

    // Exit LONG positions
    if (isLong) {
      // Take profit conditions
      if (regime === "ROTATIONAL" && vwap.vwap !== null) {
        // ROTATIONAL: Exit at VWAP
        if (currentPrice >= vwap.vwap) {
          return {
            action: "CLOSE",
            quantity: Math.abs(position.contracts),
            reason: "ROTATIONAL: Target VWAP reached",
            entry_price: currentPrice,
          };
        }
      } else if (regime === "DIRECTIONAL_BULLISH") {
        // DIRECTIONAL: Exit at SD+2 or SD+3
        if (vwap.sd2_upper !== null && currentPrice >= vwap.sd2_upper) {
          return {
            action: "CLOSE",
            quantity: Math.abs(position.contracts),
            reason: "DIRECTIONAL_BULLISH: Target SD+2 reached",
            entry_price: currentPrice,
          };
        }
      }

      // Stop loss: Exit if regime flips to bearish
      if (regime === "DIRECTIONAL_BEARISH") {
        return {
          action: "CLOSE",
          quantity: Math.abs(position.contracts),
          reason: "Regime changed to BEARISH - closing LONG",
          entry_price: currentPrice,
        };
      }
    }

    // Exit SHORT positions
    if (isShort) {
      // Take profit conditions
      if (regime === "ROTATIONAL" && vwap.vwap !== null) {
        // ROTATIONAL: Exit at VWAP
        if (currentPrice <= vwap.vwap) {
          return {
            action: "CLOSE",
            quantity: Math.abs(position.contracts),
            reason: "ROTATIONAL: Target VWAP reached",
            entry_price: currentPrice,
          };
        }
      } else if (regime === "DIRECTIONAL_BEARISH") {
        // DIRECTIONAL: Exit at SD-2 or SD-3
        if (vwap.sd2_lower !== null && currentPrice <= vwap.sd2_lower) {
          return {
            action: "CLOSE",
            quantity: Math.abs(position.contracts),
            reason: "DIRECTIONAL_BEARISH: Target SD-2 reached",
            entry_price: currentPrice,
          };
        }
      }

      // Stop loss: Exit if regime flips to bullish
      if (regime === "DIRECTIONAL_BULLISH") {
        return {
          action: "CLOSE",
          quantity: Math.abs(position.contracts),
          reason: "Regime changed to BULLISH - closing SHORT",
          entry_price: currentPrice,
        };
      }
    }

    return {
      action: "NONE",
      quantity: 0,
      reason: "Holding position",
      entry_price: currentPrice,
    };
  }

  /**
   * Calculate position size based on account capital and risk
   * For $2,000 account, we use 1 MES contract max
   */
  calculatePositionSize(capital: number): number {
    if (capital < this.minCapital) {
      return 0; // Not enough capital
    }
    return this.maxPositionSize;
  }
}
