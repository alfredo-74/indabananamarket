import { Badge } from "@/components/ui/badge";
import type { SystemStatus, MarketData } from "@shared/schema";
import { Activity, TrendingUp, DollarSign, Clock } from "lucide-react";

interface SystemHeaderProps {
  status: SystemStatus | null;
  marketData: MarketData | null;
}

export function SystemHeader({ status, marketData }: SystemHeaderProps) {
  const formatCurrency = (value: number) => {
    // Convert USD to GBP (assuming 0.79 rate)
    const gbpValue = value * 0.79;
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
    }).format(gbpValue);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const connectionStatus = status?.ibkr_connected ? "online" : "offline";
  const marketDataStatus = status?.market_data_active ? "online" : "offline";

  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between" data-testid="header-system">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight font-sans">OrderFlowAI</h1>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant={connectionStatus === "online" ? "default" : "secondary"}
            className="gap-1.5"
            data-testid="badge-ibkr-status"
          >
            <div className={`h-2 w-2 rounded-full ${connectionStatus === "online" ? "bg-status-online" : "bg-status-offline"}`} />
            <span className="text-xs font-medium">IBKR</span>
          </Badge>

          <Badge
            variant={marketDataStatus === "online" ? "default" : "secondary"}
            className="gap-1.5"
            data-testid="badge-market-data-status"
          >
            <div className={`h-2 w-2 rounded-full ${marketDataStatus === "online" ? "bg-status-online" : "bg-status-offline"}`} />
            <span className="text-xs font-medium">Market Data</span>
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2" data-testid="text-market-ticker">
        {marketData && (
          <div className="flex items-center gap-1 px-3 py-1.5 bg-accent rounded-md">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium font-sans">{marketData.symbol}</span>
            <span className="text-lg font-bold font-mono tabular-nums ml-2">
              {marketData.last_price.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2" data-testid="text-capital">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Capital</span>
          <span className="text-base font-semibold font-mono tabular-nums">
            {status ? formatCurrency(status.capital) : "£0.00"}
          </span>
        </div>

        <div className="flex items-center gap-2" data-testid="text-daily-pnl">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Daily P&L</span>
          <span className={`text-base font-semibold font-mono tabular-nums ${status && status.daily_pnl >= 0 ? "text-trading-profit" : "text-trading-loss"}`}>
            {status ? formatCurrency(status.daily_pnl) : "£0.00"}
          </span>
        </div>

        <div className="flex items-center gap-2" data-testid="text-timestamp">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-mono tabular-nums text-muted-foreground">
            {status ? formatTime(status.last_update) : "--:--:--"}
          </span>
        </div>
      </div>
    </header>
  );
}
