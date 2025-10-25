import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { VWAPData, Position, MarketData } from "@shared/schema";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface LiveStatsPanelProps {
  vwap: VWAPData | null;
  position: Position | null;
  marketData: MarketData | null;
}

export function LiveStatsPanel({ vwap, position, marketData }: LiveStatsPanelProps) {
  const formatPrice = (value: number | null) => {
    if (value === null || isNaN(value)) return "--";
    return value.toFixed(2);
  };

  const formatCurrency = (value: number) => {
    // Convert USD to GBP (assuming 0.79 rate)
    const gbpValue = value * 0.79;
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
    }).format(gbpValue);
  };

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto" data-testid="container-live-stats">
      <Card className="p-6 space-y-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Current Market
        </h3>

        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground font-sans">Price</span>
            <span className="text-2xl font-bold font-mono tabular-nums" data-testid="text-current-price">
              {marketData ? marketData.last_price.toFixed(2) : "--"}
            </span>
          </div>

          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground font-sans">VWAP</span>
            <span className="text-lg font-semibold font-mono tabular-nums" data-testid="text-vwap">
              {formatPrice(vwap?.vwap ?? null)}
            </span>
          </div>

          {marketData && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground font-sans">Bid</span>
                  <span className="font-mono tabular-nums" data-testid="text-bid">
                    {marketData.bid.toFixed(2)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground font-sans">Ask</span>
                  <span className="font-mono tabular-nums" data-testid="text-ask">
                    {marketData.ask.toFixed(2)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          VWAP Standard Deviations
        </h3>

        <div className="space-y-2.5 text-sm">
          {[
            { label: "+3 SD", value: vwap?.sd3_upper, key: "sd3-upper" },
            { label: "+2 SD", value: vwap?.sd2_upper, key: "sd2-upper" },
            { label: "+1 SD", value: vwap?.sd1_upper, key: "sd1-upper" },
            { label: "VWAP", value: vwap?.vwap, key: "vwap", highlight: true },
            { label: "-1 SD", value: vwap?.sd1_lower, key: "sd1-lower" },
            { label: "-2 SD", value: vwap?.sd2_lower, key: "sd2-lower" },
            { label: "-3 SD", value: vwap?.sd3_lower, key: "sd3-lower" },
          ].map((item) => (
            <div
              key={item.key}
              className={`flex justify-between items-center ${item.highlight ? "text-primary font-semibold" : ""}`}
            >
              <span className="text-xs font-sans">{item.label}</span>
              <span className="font-mono tabular-nums" data-testid={`text-${item.key}`}>
                {formatPrice(item.value ?? null)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Position Status
        </h3>

        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground font-sans">Side</span>
            <div className="flex items-center gap-2">
              {position?.side === "LONG" && <TrendingUp className="h-4 w-4 text-trading-profit" />}
              {position?.side === "SHORT" && <TrendingDown className="h-4 w-4 text-trading-loss" />}
              {position?.side === "FLAT" && <Minus className="h-4 w-4 text-muted-foreground" />}
              <span className="text-base font-semibold font-sans" data-testid="text-position-side">
                {position?.side ?? "FLAT"}
              </span>
            </div>
          </div>

          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground font-sans">Contracts</span>
            <span className="text-base font-semibold font-mono tabular-nums" data-testid="text-contracts">
              {position?.contracts ?? 0}
            </span>
          </div>

          {position && position.entry_price !== null && (
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted-foreground font-sans">Entry</span>
              <span className="text-base font-mono tabular-nums" data-testid="text-entry-price">
                {position.entry_price.toFixed(2)}
              </span>
            </div>
          )}

          <Separator />

          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground font-sans">Unrealized P&L</span>
            <span
              className={`text-xl font-bold font-mono tabular-nums ${position && position.unrealized_pnl >= 0 ? "text-trading-profit" : "text-trading-loss"}`}
              data-testid="text-unrealized-pnl"
            >
              {position ? formatCurrency(position.unrealized_pnl) : "£0.00"}
            </span>
          </div>

          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground font-sans">Realized P&L</span>
            <span
              className={`text-base font-semibold font-mono tabular-nums ${position && position.realized_pnl >= 0 ? "text-trading-profit" : "text-trading-loss"}`}
              data-testid="text-realized-pnl"
            >
              {position ? formatCurrency(position.realized_pnl) : "£0.00"}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
