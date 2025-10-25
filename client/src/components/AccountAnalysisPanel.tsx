import { useQuery } from "@tanstack/react-query";
import type { AccountAnalysis } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Activity,
  BarChart3,
  Moon,
  Sun,
  LineChart,
} from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  subtitle?: string;
}

function MetricCard({ label, value, icon, trend, subtitle }: MetricCardProps) {
  return (
    <Card data-testid={`metric-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold flex items-center gap-2">
          {value}
          {trend === "up" && <TrendingUp className="w-4 h-4 text-green-500" />}
          {trend === "down" && <TrendingDown className="w-4 h-4 text-red-500" />}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface StatsTableProps {
  title: string;
  data: Array<{ label: string; value: string | number }>;
}

function StatsTable({ title, data }: StatsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((item, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center py-2 border-b last:border-b-0"
              data-testid={`stat-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className="text-sm font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AccountAnalysisPanel() {
  const { data: analysis, isLoading } = useQuery<AccountAnalysis>({
    queryKey: ["/api/account-analysis"],
  });

  if (isLoading || !analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account Analysis</CardTitle>
          <CardDescription>Loading performance data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Calculating metrics...</div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const overviewStats = [
    {
      label: "Starting Capital",
      value: formatCurrency(analysis.starting_capital),
    },
    { label: "Current Capital", value: formatCurrency(analysis.current_capital) },
    { label: "Total P&L", value: formatCurrency(analysis.total_pnl) },
    { label: "ROI", value: formatPercent(analysis.roi_percent) },
  ];

  const tradeStats = [
    { label: "Total Trades", value: analysis.total_trades },
    { label: "Winning Trades", value: analysis.winning_trades },
    { label: "Losing Trades", value: analysis.losing_trades },
    { label: "Win Rate", value: formatPercent(analysis.win_rate) },
    { label: "Profit Factor", value: analysis.profit_factor.toFixed(2) },
    { label: "Avg Win", value: formatCurrency(analysis.avg_win) },
    { label: "Avg Loss", value: formatCurrency(Math.abs(analysis.avg_loss)) },
    { label: "Largest Win", value: formatCurrency(analysis.largest_win) },
    { label: "Largest Loss", value: formatCurrency(Math.abs(analysis.largest_loss)) },
  ];

  const riskStats = [
    { label: "Max Drawdown", value: formatCurrency(analysis.max_drawdown) },
    {
      label: "Max Drawdown %",
      value: formatPercent(analysis.max_drawdown_percent),
    },
    {
      label: "Sharpe Ratio",
      value: analysis.sharpe_ratio?.toFixed(2) ?? "N/A",
    },
    { label: "Trading Days", value: analysis.trading_days },
  ];

  const sessionStats = [
    {
      label: "ETH Trades",
      value: analysis.eth_performance.total_trades,
    },
    {
      label: "ETH Win Rate",
      value: formatPercent(analysis.eth_performance.win_rate),
    },
    {
      label: "ETH P&L",
      value: formatCurrency(analysis.eth_performance.total_pnl),
    },
    {
      label: "RTH Trades",
      value: analysis.rth_performance.total_trades,
    },
    {
      label: "RTH Win Rate",
      value: formatPercent(analysis.rth_performance.win_rate),
    },
    {
      label: "RTH P&L",
      value: formatCurrency(analysis.rth_performance.total_pnl),
    },
  ];

  const regimeData = analysis.regime_performance.map((regime) => ({
    regime: regime.regime,
    trades: regime.total_trades,
    winRate: regime.win_rate,
    pnl: regime.total_pnl,
  }));

  return (
    <div className="space-y-6" data-testid="account-analysis-panel">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Account Performance Analysis</CardTitle>
          <CardDescription>
            Comprehensive breakdown of trading performance metrics
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Current Capital"
          value={formatCurrency(analysis.current_capital)}
          icon={<DollarSign className="h-4 w-4" />}
          trend={analysis.roi_percent > 0 ? "up" : analysis.roi_percent < 0 ? "down" : "neutral"}
          subtitle={`ROI: ${formatPercent(analysis.roi_percent)}`}
        />
        <MetricCard
          label="Total P&L"
          value={formatCurrency(analysis.total_pnl)}
          icon={<TrendingUp className="h-4 w-4" />}
          trend={analysis.total_pnl > 0 ? "up" : analysis.total_pnl < 0 ? "down" : "neutral"}
        />
        <MetricCard
          label="Win Rate"
          value={formatPercent(analysis.win_rate)}
          icon={<Target className="h-4 w-4" />}
          subtitle={`${analysis.winning_trades}/${analysis.total_trades} wins`}
        />
        <MetricCard
          label="Profit Factor"
          value={analysis.profit_factor.toFixed(2)}
          icon={<Activity className="h-4 w-4" />}
          subtitle={analysis.profit_factor > 1 ? "Profitable" : "Unprofitable"}
        />
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="trades" data-testid="tab-trades">
            <LineChart className="w-4 h-4 mr-2" />
            Trade Stats
          </TabsTrigger>
          <TabsTrigger value="risk" data-testid="tab-risk">
            <Activity className="w-4 h-4 mr-2" />
            Risk Metrics
          </TabsTrigger>
          <TabsTrigger value="sessions" data-testid="tab-sessions">
            <Sun className="w-4 h-4 mr-2" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="regimes" data-testid="tab-regimes">
            <TrendingUp className="w-4 h-4 mr-2" />
            Regimes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <StatsTable title="Account Overview" data={overviewStats} />
        </TabsContent>

        <TabsContent value="trades" className="space-y-4">
          <StatsTable title="Trading Statistics" data={tradeStats} />
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <StatsTable title="Risk Management" data={riskStats} />
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Moon className="w-5 h-5" />
                  ETH Performance
                </CardTitle>
                <CardDescription>Extended Trading Hours</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-3xl font-bold">
                  {formatCurrency(analysis.eth_performance.total_pnl)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Win Rate: {formatPercent(analysis.eth_performance.win_rate)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Trades: {analysis.eth_performance.total_trades}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sun className="w-5 h-5" />
                  RTH Performance
                </CardTitle>
                <CardDescription>Regular Trading Hours</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-3xl font-bold">
                  {formatCurrency(analysis.rth_performance.total_pnl)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Win Rate: {formatPercent(analysis.rth_performance.win_rate)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Trades: {analysis.rth_performance.total_trades}
                </div>
              </CardContent>
            </Card>
          </div>

          <StatsTable title="Session Comparison" data={sessionStats} />
        </TabsContent>

        <TabsContent value="regimes" className="space-y-4">
          <div className="grid gap-4">
            {regimeData.map((regime) => (
              <Card key={regime.regime}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{regime.regime.replace(/_/g, " ")}</span>
                    <Badge
                      variant={regime.pnl > 0 ? "default" : "destructive"}
                      data-testid={`regime-badge-${regime.regime}`}
                    >
                      {formatCurrency(regime.pnl)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold">{regime.trades}</div>
                      <div className="text-xs text-muted-foreground">Trades</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">
                        {formatPercent(regime.winRate)}
                      </div>
                      <div className="text-xs text-muted-foreground">Win Rate</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">
                        {formatCurrency(regime.pnl)}
                      </div>
                      <div className="text-xs text-muted-foreground">P&L</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
