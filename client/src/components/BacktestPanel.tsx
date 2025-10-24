import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { BacktestResult } from "@shared/schema";
import { PlayCircle, Settings2, TrendingUp, TrendingDown, Activity } from "lucide-react";

export function BacktestPanel() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BacktestResult | null>(null);
  const [optimizeResults, setOptimizeResults] = useState<BacktestResult[]>([]);

  // Backtest parameters
  const [cdThreshold, setCdThreshold] = useState(50);
  const [vwapLookback, setVwapLookback] = useState(10);
  const [numCandles, setNumCandles] = useState(500);
  const [initialCapital, setInitialCapital] = useState(2000);

  const runBacktest = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/backtest/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cd_threshold: cdThreshold,
          vwap_lookback: vwapLookback,
          num_candles: numCandles,
          initial_capital: initialCapital,
        }),
      });

      if (!response.ok) {
        throw new Error("Backtest failed");
      }

      const result = await response.json();
      setResults(result);
    } catch (error) {
      console.error("Backtest error:", error);
    } finally {
      setLoading(false);
    }
  };

  const runOptimization = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/backtest/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cd_thresholds: [30, 40, 50, 60, 70],
          vwap_lookbacks: [5, 10, 15, 20],
          num_candles: numCandles,
          initial_capital: initialCapital,
        }),
      });

      if (!response.ok) {
        throw new Error("Optimization failed");
      }

      const optimizedResults = await response.json();
      setOptimizeResults(optimizedResults);
    } catch (error) {
      console.error("Optimization error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="panel-backtest">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Backtesting & Optimization</h2>
          <p className="text-muted-foreground">
            Test strategy parameters and optimize for best performance
          </p>
        </div>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single" data-testid="tab-single-backtest">
            Single Backtest
          </TabsTrigger>
          <TabsTrigger value="optimize" data-testid="tab-optimization">
            Parameter Optimization
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>
                Set parameters for backtesting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cd-threshold">CD Threshold (±)</Label>
                  <Input
                    id="cd-threshold"
                    type="number"
                    value={cdThreshold}
                    onChange={(e) => setCdThreshold(Number(e.target.value))}
                    data-testid="input-cd-threshold"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vwap-lookback">VWAP Lookback (candles)</Label>
                  <Input
                    id="vwap-lookback"
                    type="number"
                    value={vwapLookback}
                    onChange={(e) => setVwapLookback(Number(e.target.value))}
                    data-testid="input-vwap-lookback"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="num-candles">Number of Candles</Label>
                  <Input
                    id="num-candles"
                    type="number"
                    value={numCandles}
                    onChange={(e) => setNumCandles(Number(e.target.value))}
                    data-testid="input-num-candles"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initial-capital">Initial Capital ($)</Label>
                  <Input
                    id="initial-capital"
                    type="number"
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(Number(e.target.value))}
                    data-testid="input-initial-capital"
                  />
                </div>
              </div>

              <Button
                onClick={runBacktest}
                disabled={loading}
                className="w-full"
                data-testid="button-run-backtest"
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                {loading ? "Running Backtest..." : "Run Backtest"}
              </Button>
            </CardContent>
          </Card>

          {results && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <MetricCard
                      label="Total Trades"
                      value={results.metrics.total_trades}
                      icon={<Activity className="w-4 h-4" />}
                    />
                    <MetricCard
                      label="Win Rate"
                      value={`${(results.metrics.win_rate * 100).toFixed(1)}%`}
                      icon={<TrendingUp className="w-4 h-4" />}
                      positive={results.metrics.win_rate > 0.5}
                    />
                    <MetricCard
                      label="Total P&L"
                      value={`$${results.metrics.total_pnl.toFixed(2)}`}
                      positive={results.metrics.total_pnl > 0}
                    />
                    <MetricCard
                      label="Profit Factor"
                      value={results.metrics.profit_factor.toFixed(2)}
                      positive={results.metrics.profit_factor > 1}
                    />
                    <MetricCard
                      label="Max Drawdown"
                      value={`${(results.metrics.max_drawdown * 100).toFixed(1)}%`}
                      icon={<TrendingDown className="w-4 h-4" />}
                    />
                    <MetricCard
                      label="Return"
                      value={`${results.metrics.return_pct.toFixed(1)}%`}
                      positive={results.metrics.return_pct > 0}
                    />
                    <MetricCard
                      label="Sharpe Ratio"
                      value={results.metrics.sharpe_ratio?.toFixed(2) || "N/A"}
                      positive={(results.metrics.sharpe_ratio || 0) > 0}
                    />
                    <MetricCard
                      label="Avg Win"
                      value={`$${results.metrics.avg_win.toFixed(2)}`}
                    />
                    <MetricCard
                      label="Avg Loss"
                      value={`$${results.metrics.avg_loss.toFixed(2)}`}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Trade Log ({results.trades.length} trades)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card border-b">
                        <tr className="text-left">
                          <th className="p-2">Time</th>
                          <th className="p-2">Type</th>
                          <th className="p-2">Price</th>
                          <th className="p-2">Regime</th>
                          <th className="p-2">P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.trades.map((trade, idx) => (
                          <tr key={idx} className="border-b hover-elevate">
                            <td className="p-2 font-mono text-xs">
                              {new Date(trade.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="p-2">
                              <Badge variant={trade.type === "BUY" ? "default" : "destructive"}>
                                {trade.type}
                              </Badge>
                            </td>
                            <td className="p-2 font-mono">{trade.entry_price.toFixed(2)}</td>
                            <td className="p-2">
                              <Badge variant="outline">{trade.regime}</Badge>
                            </td>
                            <td className="p-2 font-mono">
                              {trade.pnl !== null ? (
                                <span className={trade.pnl >= 0 ? "text-green-500" : "text-red-500"}>
                                  ${trade.pnl.toFixed(2)}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="optimize" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Parameter Optimization</CardTitle>
              <CardDescription>
                Test multiple parameter combinations to find optimal settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Will test CD thresholds: 30, 40, 50, 60, 70 and VWAP lookbacks: 5, 10, 15, 20
              </p>
              <Button
                onClick={runOptimization}
                disabled={loading}
                className="w-full"
                data-testid="button-run-optimization"
              >
                <Settings2 className="w-4 h-4 mr-2" />
                {loading ? "Optimizing..." : "Run Optimization"}
              </Button>
            </CardContent>
          </Card>

          {optimizeResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Optimization Results</CardTitle>
                <CardDescription>
                  Ranked by Sharpe ratio (best to worst)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {optimizeResults.slice(0, 10).map((result, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                    >
                      <div className="space-y-1">
                        <div className="flex gap-2">
                          <Badge>CD: {result.parameters.cd_threshold}</Badge>
                          <Badge variant="outline">
                            VWAP Lookback: {result.parameters.vwap_lookback}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {result.metrics.total_trades} trades • Win Rate:{" "}
                          {(result.metrics.win_rate * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div
                          className={`text-lg font-bold ${
                            result.metrics.return_pct > 0 ? "text-green-500" : "text-red-500"
                          }`}
                        >
                          {result.metrics.return_pct.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Sharpe: {result.metrics.sharpe_ratio?.toFixed(2) || "N/A"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  positive,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  positive?: boolean;
}) {
  return (
    <div className="p-4 border rounded-md space-y-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={`text-2xl font-bold font-mono ${
          positive === true
            ? "text-green-500"
            : positive === false
            ? "text-red-500"
            : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
