import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Trade } from "@shared/schema";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TradeHistoryTableProps {
  trades: Trade[];
}

export function TradeHistoryTable({ trades }: TradeHistoryTableProps) {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "--";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return "--";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const sortedTrades = [...trades].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <Card className="p-6" data-testid="container-trade-history">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Trade History
        </h3>
        <Badge variant="secondary" className="font-mono tabular-nums" data-testid="badge-trade-count">
          {trades.length} {trades.length === 1 ? "Trade" : "Trades"}
        </Badge>
      </div>

      <ScrollArea className="h-64">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium uppercase tracking-wide">Time</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide">Type</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-right">Entry</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-right">Exit</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-right">Contracts</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-right">P&L</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-right">Duration</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTrades.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">
                  No trades yet
                </TableCell>
              </TableRow>
            ) : (
              sortedTrades.map((trade) => (
                <TableRow key={trade.id} className="hover-elevate" data-testid={`row-trade-${trade.id}`}>
                  <TableCell className="font-mono tabular-nums text-sm" data-testid={`text-trade-time-${trade.id}`}>
                    {formatTime(trade.timestamp)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {trade.type === "BUY" ? (
                        <TrendingUp className="h-3.5 w-3.5 text-trading-profit" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-trading-loss" />
                      )}
                      <span className="text-sm font-medium font-sans">{trade.type}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm" data-testid={`text-trade-entry-${trade.id}`}>
                    {trade.entry_price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm" data-testid={`text-trade-exit-${trade.id}`}>
                    {trade.exit_price !== null ? trade.exit_price.toFixed(2) : "--"}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm" data-testid={`text-trade-contracts-${trade.id}`}>
                    {trade.contracts}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono tabular-nums text-sm font-semibold ${
                      trade.pnl !== null && trade.pnl >= 0 ? "text-trading-profit" : "text-trading-loss"
                    }`}
                    data-testid={`text-trade-pnl-${trade.id}`}
                  >
                    {formatCurrency(trade.pnl)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm" data-testid={`text-trade-duration-${trade.id}`}>
                    {formatDuration(trade.duration_ms)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={trade.status === "OPEN" ? "default" : "secondary"}
                      className="text-xs"
                      data-testid={`badge-trade-status-${trade.id}`}
                    >
                      {trade.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </Card>
  );
}
