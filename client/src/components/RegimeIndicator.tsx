import { Badge } from "@/components/ui/badge";
import type { RegimeState } from "@shared/schema";
import { TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";

interface RegimeIndicatorProps {
  regime: RegimeState;
  cumulativeDelta: number;
  className?: string;
}

export function RegimeIndicator({ regime, cumulativeDelta, className = "" }: RegimeIndicatorProps) {
  const getRegimeConfig = () => {
    switch (regime) {
      case "DIRECTIONAL_BULLISH":
        return {
          label: "BULLISH",
          icon: TrendingUp,
          bgClass: "bg-trading-bullish/10 text-trading-bullish border-trading-bullish/30",
        };
      case "DIRECTIONAL_BEARISH":
        return {
          label: "BEARISH",
          icon: TrendingDown,
          bgClass: "bg-trading-bearish/10 text-trading-bearish border-trading-bearish/30",
        };
      case "ROTATIONAL":
        return {
          label: "ROTATIONAL",
          icon: Minus,
          bgClass: "bg-trading-rotational/10 text-trading-rotational border-trading-rotational/30",
        };
      case "TRANSITIONING":
        return {
          label: "TRANSITIONING",
          icon: RefreshCw,
          bgClass: "bg-muted text-muted-foreground border-border",
        };
    }
  };

  const config = getRegimeConfig();
  const Icon = config.icon;

  return (
    <div className={`flex flex-col gap-3 ${className}`} data-testid="container-regime-indicator">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Market Regime
        </span>
      </div>

      <Badge
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full border ${config.bgClass} transition-all duration-150`}
        data-testid={`badge-regime-${regime.toLowerCase()}`}
      >
        <Icon className="h-4 w-4" />
        <span className="text-sm font-bold uppercase tracking-wider font-sans">
          {config.label}
        </span>
      </Badge>

      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Cumulative Delta
        </span>
        <span
          className={`text-xl font-bold font-mono tabular-nums ${cumulativeDelta >= 0 ? "text-trading-profit" : "text-trading-loss"}`}
          data-testid="text-cumulative-delta"
        >
          {cumulativeDelta >= 0 ? "+" : ""}
          {cumulativeDelta.toFixed(0)}
        </span>
      </div>
    </div>
  );
}
