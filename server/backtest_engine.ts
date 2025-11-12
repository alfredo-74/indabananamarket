import { VolumetricCandleBuilder } from "./volumetric_candle_builder";
import { VWAPCalculator } from "./vwap_calculator";
import { RegimeDetector } from "./regime_detector";
import { AutoTrader } from "./auto_trader";
import type {
  VolumetricCandle,
  BacktestParameters,
  BacktestResult,
  BacktestMetrics,
  Trade,
  Position,
  MarketData,
} from "@shared/schema";

export class BacktestEngine {
  /**
   * Run a backtest with given parameters
   * Simulates the trading strategy on historical/generated data
   */
  async runBacktest(params: BacktestParameters, historicalData?: VolumetricCandle[]): Promise<BacktestResult> {
    // Initialize modules with backtest parameters
    const candleBuilder = new VolumetricCandleBuilder(60000);
    const vwapCalculator = new VWAPCalculator(params.vwap_lookback);
    const regimeDetector = new RegimeDetector(params.cd_threshold);
    const autoTrader = new AutoTrader();

    // Use real historical data if available, otherwise generate mock data
    let candles: VolumetricCandle[];
    if (historicalData && historicalData.length > 0) {
      // Use real IBKR historical data
      candles = historicalData.slice(0, params.num_candles);
      console.log(`Running backtest on ${candles.length} real IBKR candles`);
    } else {
      // Fallback to mock data generation
      candles = this.generateMockCandles(params.num_candles);
      console.log(`Running backtest on ${candles.length} mock candles (no IBKR data available)`);
    }

    // Track trading state
    let position: Position = {
      contracts: 0,
      entry_price: null,
      current_price: candles[0]?.close || 6004,  // ES pricing for display
      unrealized_pnl: 0,
      realized_pnl: 0,
      side: "FLAT",
    };

    let capital = params.initial_capital;
    const trades: Trade[] = [];
    const equityCurve: { timestamp: number; equity: number }[] = [];
    let tradeIdCounter = 0;

    // Simulate trading through historical data
    for (let i = 0; i < candles.length; i++) {
      const currentCandles = candles.slice(0, i + 1);
      const currentCandle = candles[i];

      // Calculate VWAP
      const vwap = vwapCalculator.calculate(currentCandles);

      // Detect regime
      const previousRegime = i > 0 
        ? regimeDetector.detectRegime(candles[i - 1].cumulative_delta)
        : "ROTATIONAL";
      const regime = regimeDetector.detectRegime(
        currentCandle.cumulative_delta,
        previousRegime
      );

      // Update position current price
      position.current_price = currentCandle.close;

      // Calculate unrealized P&L
      if (position.contracts !== 0 && position.entry_price !== null) {
        const priceDiff = position.side === "LONG"
          ? position.current_price - position.entry_price
          : position.entry_price - position.current_price;
        position.unrealized_pnl = priceDiff * Math.abs(position.contracts) * 5; // MES multiplier
      }

      // Analyze market for trade signals
      const marketData: MarketData = {
        symbol: "ES",  // Display ES symbol
        last_price: currentCandle.close,
        bid: currentCandle.close - 0.25,
        ask: currentCandle.close + 0.25,
        volume: currentCandle.accumulated_volume,
        timestamp: currentCandle.timestamp,
      };

      const signal = autoTrader.analyzeMarket(marketData, vwap, regime, position);

      // Execute trade if signal present
      if (signal.action !== "NONE" && signal.action !== "CLOSE") {
        // Open new position
        const trade: Trade = {
          id: `bt_${tradeIdCounter++}`,
          timestamp: currentCandle.timestamp,
          type: signal.action,
          entry_price: signal.entry_price,
          exit_price: null,
          contracts: signal.quantity,
          pnl: null,
          duration_ms: null,
          regime: regime,
          cumulative_delta: currentCandle.cumulative_delta,
          status: "OPEN",
        };

        trades.push(trade);

        // Update position
        if (signal.action === "BUY") {
          position.contracts = signal.quantity;
          position.side = "LONG";
          position.entry_price = signal.entry_price;
        } else if (signal.action === "SELL") {
          position.contracts = -signal.quantity;
          position.side = "SHORT";
          position.entry_price = signal.entry_price;
        }
      } else if (signal.action === "CLOSE" && position.contracts !== 0) {
        // Close existing position
        const exitPrice = currentCandle.close;
        const priceDiff = position.side === "LONG"
          ? exitPrice - position.entry_price!
          : position.entry_price! - exitPrice;
        const grossPnl = priceDiff * Math.abs(position.contracts) * 5; // MES multiplier
        
        // Deduct commission: $0.62 per contract per side = $1.24 round trip
        const commission = 1.24 * Math.abs(position.contracts);
        const netPnl = grossPnl - commission;

        const closeTrade: Trade = {
          id: `bt_${tradeIdCounter++}`,
          timestamp: currentCandle.timestamp,
          type: position.side === "LONG" ? "SELL" : "BUY",
          entry_price: exitPrice,
          exit_price: exitPrice,
          contracts: Math.abs(position.contracts),
          pnl: netPnl, // Store net P&L (after commission)
          duration_ms: null,
          regime: regime,
          cumulative_delta: currentCandle.cumulative_delta,
          status: "CLOSED",
        };

        trades.push(closeTrade);

        // Update capital and position (using net P&L)
        capital += netPnl;
        position.realized_pnl += netPnl;
        position.contracts = 0;
        position.side = "FLAT";
        position.entry_price = null;
        position.unrealized_pnl = 0;
      }

      // Track equity curve
      const currentEquity = capital + position.unrealized_pnl;
      equityCurve.push({
        timestamp: currentCandle.timestamp,
        equity: currentEquity,
      });
    }

    // Calculate performance metrics
    const metrics = this.calculateMetrics(trades, params.initial_capital, capital);

    return {
      parameters: params,
      metrics,
      trades,
      equity_curve: equityCurve,
    };
  }

  /**
   * Calculate performance metrics from trade history
   */
  private calculateMetrics(
    trades: Trade[],
    initialCapital: number,
    finalCapital: number
  ): BacktestMetrics {
    const closedTrades = trades.filter(t => t.status === "CLOSED" && t.pnl !== null);

    const totalTrades = closedTrades.length;
    const winningTrades = closedTrades.filter(t => t.pnl! > 0).length;
    const losingTrades = closedTrades.filter(t => t.pnl! < 0).length;

    const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;

    // Calculate commissions: $1.24 per round trip
    const totalCommissions = totalTrades * 1.24;
    
    // Total P&L is already net (after commissions) from our trade calculation
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    // Gross P&L = Net P&L + Commissions
    const grossPnl = totalPnl + totalCommissions;

    const wins = closedTrades.filter(t => t.pnl! > 0);
    const losses = closedTrades.filter(t => t.pnl! < 0);

    const avgWin = wins.length > 0
      ? wins.reduce((sum, t) => sum + t.pnl!, 0) / wins.length
      : 0;

    const avgLoss = losses.length > 0
      ? Math.abs(losses.reduce((sum, t) => sum + t.pnl!, 0) / losses.length)
      : 0;

    const profitFactor = avgLoss > 0 && wins.length > 0
      ? (wins.reduce((sum, t) => sum + t.pnl!, 0)) / Math.abs(losses.reduce((sum, t) => sum + t.pnl!, 0))
      : wins.length > 0 ? Infinity : 0;

    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = initialCapital;
    let equity = initialCapital;

    for (const trade of closedTrades) {
      equity += trade.pnl || 0;
      if (equity > peak) {
        peak = equity;
      }
      const drawdown = (peak - equity) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // Simple Sharpe ratio calculation (assuming daily returns)
    const returns = closedTrades.map(t => (t.pnl || 0) / initialCapital);
    const avgReturn = returns.length > 0
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : 0;

    const variance = returns.length > 1
      ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)
      : 0;

    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : null; // Annualized

    const returnPct = ((finalCapital - initialCapital) / initialCapital) * 100;

    return {
      total_trades: totalTrades,
      winning_trades: winningTrades,
      losing_trades: losingTrades,
      win_rate: winRate,
      gross_pnl: grossPnl,
      total_commissions: totalCommissions,
      total_pnl: totalPnl, // Net P&L after commissions
      avg_win: avgWin,
      avg_loss: avgLoss,
      profit_factor: profitFactor,
      max_drawdown: maxDrawdown,
      sharpe_ratio: sharpeRatio,
      final_capital: finalCapital,
      return_pct: returnPct,
    };
  }

  /**
   * Generate mock historical candles for backtesting
   * In production, replace this with real historical data loading
   * Note: Generates ES price levels for display (trades execute on MES)
   */
  private generateMockCandles(numCandles: number): VolumetricCandle[] {
    const candles: VolumetricCandle[] = [];
    let price = 6004;  // ES pricing for display
    let cumulativeDelta = 0;
    const startTime = Date.now() - numCandles * 60000; // Go back in time

    for (let i = 0; i < numCandles; i++) {
      const timestamp = startTime + i * 60000;

      // Random walk with drift
      const priceChange = (Math.random() - 0.48) * 2; // Slight upward bias
      price += priceChange;

      const open = i === 0 ? price : candles[i - 1].close;
      const high = price + Math.random() * 1.5;
      const low = price - Math.random() * 1.5;
      const close = price;

      // Simulate order flow
      const buyVolume = Math.floor(Math.random() * 20) + 5;
      const sellVolume = Math.floor(Math.random() * 20) + 5;
      const delta = buyVolume - sellVolume;
      cumulativeDelta += delta;

      candles.push({
        timestamp,
        open,
        high,
        low,
        close,
        accumulated_volume: buyVolume + sellVolume,
        buy_volume: buyVolume,
        sell_volume: sellVolume,
        cumulative_delta: cumulativeDelta,
      });
    }

    return candles;
  }

  /**
   * Optimize parameters by running multiple backtests
   * Grid search over parameter ranges
   */
  async optimizeParameters(
    cdThresholds: number[],
    vwapLookbacks: number[],
    numCandles: number,
    initialCapital: number,
    historicalData?: VolumetricCandle[]
  ): Promise<BacktestResult[]> {
    const results: BacktestResult[] = [];

    for (const cdThreshold of cdThresholds) {
      for (const vwapLookback of vwapLookbacks) {
        const params: BacktestParameters = {
          cd_threshold: cdThreshold,
          vwap_lookback: vwapLookback,
          num_candles: numCandles,
          initial_capital: initialCapital,
        };

        const result = await this.runBacktest(params, historicalData);
        results.push(result);
      }
    }

    // Sort by Sharpe ratio (best risk-adjusted returns)
    results.sort((a, b) => {
      const sharpeA = a.metrics.sharpe_ratio || -Infinity;
      const sharpeB = b.metrics.sharpe_ratio || -Infinity;
      return sharpeB - sharpeA;
    });

    return results;
  }
}
