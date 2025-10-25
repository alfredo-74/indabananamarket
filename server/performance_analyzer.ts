import type { 
  Trade, 
  AccountAnalysis, 
  SessionPerformance, 
  RegimePerformance,
  SessionType,
  RegimeState,
} from "@shared/schema";

export class PerformanceAnalyzer {
  /**
   * Calculate comprehensive account analysis from trades
   */
  calculateAnalysis(
    trades: Trade[],
    startingCapital: number,
    currentCapital: number,
    periodStart?: number,
    periodEnd?: number
  ): AccountAnalysis {
    const now = Date.now();
    const start = periodStart || (trades.length > 0 ? trades[0].timestamp : now);
    const end = periodEnd || now;

    // Filter trades within the period
    const periodTrades = trades.filter(
      (t) => t.timestamp >= start && t.timestamp <= end && t.status === "CLOSED"
    );

    // Calculate overall metrics
    const totalTrades = periodTrades.length;
    const winningTrades = periodTrades.filter((t) => (t.pnl ?? 0) > 0);
    const losingTrades = periodTrades.filter((t) => (t.pnl ?? 0) < 0);
    
    const winCount = winningTrades.length;
    const lossCount = losingTrades.length;
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0));
    const totalPnl = periodTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

    const avgWin = winCount > 0 ? totalWins / winCount : 0;
    const avgLoss = lossCount > 0 ? totalLosses / lossCount : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    const largestWin = winningTrades.length > 0 
      ? Math.max(...winningTrades.map((t) => t.pnl ?? 0)) 
      : 0;
    const largestLoss = losingTrades.length > 0 
      ? Math.min(...losingTrades.map((t) => t.pnl ?? 0)) 
      : 0;

    // Calculate drawdown
    const { maxDrawdown, maxDrawdownPercent } = this.calculateDrawdown(periodTrades, startingCapital);

    // Calculate Sharpe ratio
    const sharpeRatio = this.calculateSharpeRatio(periodTrades);

    // Calculate ROI
    const roiPercent = startingCapital > 0 
      ? ((currentCapital - startingCapital) / startingCapital) * 100 
      : 0;

    // Calculate session breakdown
    const ethPerformance = this.calculateSessionPerformance(periodTrades, "ETH");
    const rthPerformance = this.calculateSessionPerformance(periodTrades, "RTH");

    // Calculate regime breakdown
    const regimePerformance = this.calculateRegimePerformance(periodTrades);

    // Calculate trading days
    const dayMs = 24 * 60 * 60 * 1000;
    const tradingDays = Math.ceil((end - start) / dayMs);

    return {
      starting_capital: startingCapital,
      current_capital: currentCapital,
      total_pnl: totalPnl,
      roi_percent: roiPercent,
      total_trades: totalTrades,
      winning_trades: winCount,
      losing_trades: lossCount,
      win_rate: winRate,
      profit_factor: profitFactor,
      avg_win: avgWin,
      avg_loss: avgLoss,
      largest_win: largestWin,
      largest_loss: largestLoss,
      max_drawdown: maxDrawdown,
      max_drawdown_percent: maxDrawdownPercent,
      sharpe_ratio: sharpeRatio,
      eth_performance: ethPerformance,
      rth_performance: rthPerformance,
      regime_performance: regimePerformance,
      period_start: start,
      period_end: end,
      trading_days: tradingDays,
    };
  }

  /**
   * Calculate maximum drawdown from trades
   */
  private calculateDrawdown(trades: Trade[], startingCapital: number): { 
    maxDrawdown: number; 
    maxDrawdownPercent: number 
  } {
    let peak = startingCapital;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let currentCapital = startingCapital;

    // Sort trades by timestamp
    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);

    for (const trade of sortedTrades) {
      currentCapital += trade.pnl ?? 0;

      // Update peak if we hit a new high
      if (currentCapital > peak) {
        peak = currentCapital;
      }

      // Calculate current drawdown
      const drawdown = peak - currentCapital;
      const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;

      // Update max drawdown if current is larger
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;
      }
    }

    return { maxDrawdown, maxDrawdownPercent };
  }

  /**
   * Calculate Sharpe ratio (annualized)
   * Assumes 252 trading days per year
   */
  private calculateSharpeRatio(trades: Trade[]): number | null {
    if (trades.length < 2) return null;

    const returns = trades.map((t) => t.pnl ?? 0);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // Calculate standard deviation
    const squaredDiffs = returns.map((r) => Math.pow(r - avgReturn, 2));
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return null;

    // Annualize the Sharpe ratio
    const sharpe = avgReturn / stdDev;
    const annualizedSharpe = sharpe * Math.sqrt(252); // Assume 252 trading days/year

    return annualizedSharpe;
  }

  /**
   * Calculate performance metrics for a specific session type
   */
  private calculateSessionPerformance(
    trades: Trade[],
    sessionType: SessionType
  ): SessionPerformance {
    // For now, we'll need to determine session from timestamp
    // Simplified: ETH is outside regular hours (9:30 AM - 4 PM ET)
    const sessionTrades = this.filterTradesBySession(trades, sessionType);

    const totalTrades = sessionTrades.length;
    const winningTrades = sessionTrades.filter((t) => (t.pnl ?? 0) > 0);
    const losingTrades = sessionTrades.filter((t) => (t.pnl ?? 0) < 0);

    const winCount = winningTrades.length;
    const lossCount = losingTrades.length;
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

    const totalPnl = sessionTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const avgTradePnl = totalTrades > 0 ? totalPnl / totalTrades : 0;

    const largestWin = winningTrades.length > 0 
      ? Math.max(...winningTrades.map((t) => t.pnl ?? 0)) 
      : 0;
    const largestLoss = losingTrades.length > 0 
      ? Math.min(...losingTrades.map((t) => t.pnl ?? 0)) 
      : 0;

    return {
      session_type: sessionType,
      total_trades: totalTrades,
      winning_trades: winCount,
      losing_trades: lossCount,
      win_rate: winRate,
      total_pnl: totalPnl,
      avg_trade_pnl: avgTradePnl,
      largest_win: largestWin,
      largest_loss: largestLoss,
    };
  }

  /**
   * Filter trades by session type based on timestamp
   */
  private filterTradesBySession(trades: Trade[], sessionType: SessionType): Trade[] {
    return trades.filter((trade) => {
      const date = new Date(trade.timestamp);
      // Convert to ET (UTC-5 or UTC-4 depending on DST)
      // For simplicity, using UTC-5 (EST)
      const etHours = (date.getUTCHours() - 5 + 24) % 24;
      const etMinutes = date.getUTCMinutes();
      const etTime = etHours * 60 + etMinutes; // Minutes since midnight ET

      const rthStart = 9 * 60 + 30; // 9:30 AM
      const rthEnd = 16 * 60; // 4:00 PM

      const isRTH = etTime >= rthStart && etTime < rthEnd;

      return sessionType === "RTH" ? isRTH : !isRTH;
    });
  }

  /**
   * Calculate performance metrics by regime
   */
  private calculateRegimePerformance(trades: Trade[]): RegimePerformance[] {
    const regimes: RegimeState[] = [
      "ROTATIONAL",
      "DIRECTIONAL_BULLISH",
      "DIRECTIONAL_BEARISH",
    ];

    return regimes.map((regime) => {
      const regimeTrades = trades.filter((t) => t.regime === regime);
      const totalTrades = regimeTrades.length;
      const winningTrades = regimeTrades.filter((t) => (t.pnl ?? 0) > 0);
      const losingTrades = regimeTrades.filter((t) => (t.pnl ?? 0) < 0);

      const winCount = winningTrades.length;
      const lossCount = losingTrades.length;
      const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

      const totalPnl = regimeTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
      const avgTradePnl = totalTrades > 0 ? totalPnl / totalTrades : 0;

      const largestWin = winningTrades.length > 0 
        ? Math.max(...winningTrades.map((t) => t.pnl ?? 0)) 
        : 0;
      const largestLoss = losingTrades.length > 0 
        ? Math.min(...losingTrades.map((t) => t.pnl ?? 0)) 
        : 0;

      return {
        regime,
        total_trades: totalTrades,
        winning_trades: winCount,
        losing_trades: lossCount,
        win_rate: winRate,
        total_pnl: totalPnl,
        avg_trade_pnl: avgTradePnl,
        largest_win: largestWin,
        largest_loss: largestLoss,
      };
    });
  }
}
