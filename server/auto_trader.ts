import type { Position, MarketData, AbsorptionEvent, DomSnapshot, TimeAndSalesEntry, VolumeProfile } from "@shared/schema";
import { OrderFlowStrategy, type OrderFlowSignal, type OrderFlowSettings } from './orderflow_strategy';

export interface TradeSignal {
  action: "BUY" | "SELL" | "CLOSE" | "NONE";
  quantity: number;
  reason: string;
  entry_price: number;
  stop_loss?: number;
  take_profit?: number;
  // Order Flow Metadata
  confidence?: number;
  orderflow_signals?: {
    absorption?: string;
    dom_imbalance?: string;
    tape_pressure?: string;
    profile_context?: string;
  };
}

export class AutoTrader {
  private maxPositionSize: number = 1; // Max 1 MES contract for small account
  private minCapital: number = 2000;
  private orderflowStrategy: OrderFlowStrategy;

  constructor(settings: OrderFlowSettings) {
    this.orderflowStrategy = new OrderFlowStrategy(settings);
  }

  /**
   * Analyze market using Order Flow methodology from Foundation Course
   * Replaces VWAP/regime-based trading with institutional order flow analysis
   */
  analyzeMarket(
    marketData: MarketData,
    absorptionEvents: AbsorptionEvent[],
    domSnapshot: DomSnapshot | null,
    timeAndSales: TimeAndSalesEntry[],
    volumeProfile: VolumeProfile | null,
    position: Position
  ): TradeSignal {
    const currentPrice = marketData.last_price;

    // Check for exit signals first (if we have a position)
    if (position.contracts !== 0) {
      const exitSignal = this.checkExitConditions(
        currentPrice,
        position,
        absorptionEvents,
        domSnapshot
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

    // Get order flow signal from strategy
    const orderflowSignal = this.orderflowStrategy.analyzeOrderFlow(
      currentPrice,
      absorptionEvents,
      domSnapshot,
      timeAndSales,
      volumeProfile
    );

    // Convert order flow signal to trade signal
    return this.convertToTradeSignal(orderflowSignal);
  }

  /**
   * Convert OrderFlowSignal to TradeSignal for execution
   */
  private convertToTradeSignal(orderflowSignal: OrderFlowSignal): TradeSignal {
    if (orderflowSignal.type === 'NONE') {
      return {
        action: 'NONE',
        quantity: 0,
        reason: orderflowSignal.reason,
        entry_price: orderflowSignal.entry_price,
        confidence: orderflowSignal.confidence,
      };
    }

    const action = orderflowSignal.type === 'LONG' ? 'BUY' : 'SELL';

    return {
      action,
      quantity: this.maxPositionSize,
      reason: `${orderflowSignal.reason} (${orderflowSignal.confidence}% confidence)`,
      entry_price: orderflowSignal.entry_price,
      stop_loss: orderflowSignal.stop_loss,
      take_profit: orderflowSignal.take_profit,
      confidence: orderflowSignal.confidence,
      orderflow_signals: orderflowSignal.signals,
    };
  }

  /**
   * Check exit conditions using order flow
   * - Take profit hit
   * - Stop loss hit
   * - Adverse order flow (absorption reversing, DOM flipping)
   */
  private checkExitConditions(
    currentPrice: number,
    position: Position,
    absorptionEvents: AbsorptionEvent[],
    domSnapshot: DomSnapshot | null
  ): TradeSignal {
    const isLong = position.contracts > 0;
    const isShort = position.contracts < 0;

    // For simplicity, we'll rely on the IBKR bracket orders for take profit/stop loss
    // But we can add order flow-based early exit logic here in the future

    // Check for adverse absorption (institutional activity against our position)
    if (absorptionEvents && absorptionEvents.length > 0) {
      const recentAbsorption = absorptionEvents.filter(
        e => Date.now() - e.timestamp < 60000 // Last 1 minute
      );

      if (recentAbsorption.length > 0) {
        const latestAbsorption = recentAbsorption[recentAbsorption.length - 1];

        // If we're LONG and see SELL_ABSORPTION (buyers being absorbed at resistance)
        if (isLong && latestAbsorption.side === 'SELL_ABSORPTION' && latestAbsorption.ratio >= 2.0) {
          return {
            action: 'CLOSE',
            quantity: Math.abs(position.contracts),
            reason: `Adverse absorption detected: Buyers absorbed ${latestAbsorption.ratio.toFixed(1)}:1 @ ${latestAbsorption.price.toFixed(2)}`,
            entry_price: currentPrice,
          };
        }

        // If we're SHORT and see BUY_ABSORPTION (sellers being absorbed at support)
        if (isShort && latestAbsorption.side === 'BUY_ABSORPTION' && latestAbsorption.ratio >= 2.0) {
          return {
            action: 'CLOSE',
            quantity: Math.abs(position.contracts),
            reason: `Adverse absorption detected: Sellers absorbed ${latestAbsorption.ratio.toFixed(1)}:1 @ ${latestAbsorption.price.toFixed(2)}`,
            entry_price: currentPrice,
          };
        }
      }
    }

    // Check for DOM flip (order book pressure reversing)
    if (domSnapshot && domSnapshot.levels && domSnapshot.levels.length > 0) {
      const topLevels = domSnapshot.levels.slice(0, 10);
      const bidVolume = topLevels.reduce((sum, l) => sum + l.bid_size, 0);
      const askVolume = topLevels.reduce((sum, l) => sum + l.ask_size, 0);

      if (bidVolume > 0 && askVolume > 0) {
        const ratio = Math.max(bidVolume, askVolume) / Math.min(bidVolume, askVolume);

        // Strong adverse DOM imbalance
        if (ratio >= 3.0) {
          if (isLong && askVolume > bidVolume) {
            return {
              action: 'CLOSE',
              quantity: Math.abs(position.contracts),
              reason: `DOM flipped bearish: ${ratio.toFixed(1)}:1 ask pressure`,
              entry_price: currentPrice,
            };
          }

          if (isShort && bidVolume > askVolume) {
            return {
              action: 'CLOSE',
              quantity: Math.abs(position.contracts),
              reason: `DOM flipped bullish: ${ratio.toFixed(1)}:1 bid pressure`,
              entry_price: currentPrice,
            };
          }
        }
      }
    }

    return {
      action: "NONE",
      quantity: 0,
      reason: "Holding position - order flow remains favorable",
      entry_price: currentPrice,
    };
  }

  /**
   * Update order flow strategy settings
   */
  updateSettings(newSettings: Partial<OrderFlowSettings>) {
    this.orderflowStrategy.updateSettings(newSettings);
  }

  /**
   * Get current strategy settings
   */
  getSettings(): OrderFlowSettings {
    return this.orderflowStrategy.getSettings();
  }

  /**
   * Calculate position size based on account capital and risk
   * For small accounts, we use 1 MES contract max
   */
  calculatePositionSize(capital: number): number {
    if (capital < this.minCapital) {
      return 0; // Not enough capital
    }
    return this.maxPositionSize;
  }
}
