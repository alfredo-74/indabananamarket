import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TimeAndSalesEntry } from "@shared/schema";
import { ArrowUp, ArrowDown } from "lucide-react";

export function TimeAndSalesPanel() {
  const { data: entries = [], isLoading } = useQuery<TimeAndSalesEntry[]>({
    queryKey: ["/api/time-and-sales"],
    refetchInterval: 500, // Refresh every 500ms for real-time feel
  });

  if (isLoading) {
    return (
      <Card className="h-full p-4">
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground text-sm">Loading Time & Sales...</div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <div className="border-b px-4 py-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Time & Sales
        </h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Header */}
          <div className="grid grid-cols-[80px_80px_100px_60px] gap-2 px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground border-b mb-1">
            <div>Time</div>
            <div className="text-right">Price</div>
            <div className="text-right">Volume</div>
            <div className="text-center">Side</div>
          </div>

          {/* Entries - reversed to show most recent first */}
          {entries.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No transactions yet
            </div>
          ) : (
            <div className="space-y-0.5">
              {[...entries].reverse().map((entry, index) => (
                <TimeAndSalesRow 
                  key={`${entry.timestamp}-${index}`} 
                  entry={entry} 
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

function TimeAndSalesRow({ entry }: { entry: TimeAndSalesEntry }) {
  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const isBuy = entry.side === "BUY";
  
  return (
    <div
      className={`grid grid-cols-[80px_80px_100px_60px] gap-2 px-2 py-1 text-sm tabular-nums rounded transition-colors ${
        isBuy 
          ? "hover:bg-green-500/10 text-green-400" 
          : "hover:bg-red-500/10 text-red-400"
      }`}
      data-testid={`tas-row-${entry.timestamp}`}
    >
      <div className="text-muted-foreground text-xs font-mono">
        {time}
      </div>
      <div className={`text-right font-semibold ${isBuy ? "text-green-400" : "text-red-400"}`}>
        {entry.price.toFixed(2)}
      </div>
      <div className="text-right font-medium">
        {entry.volume}
      </div>
      <div className="flex items-center justify-center">
        {isBuy ? (
          <div className="flex items-center gap-1 text-green-400" data-testid="side-buy">
            <ArrowUp className="h-3 w-3" />
            <span className="text-xs font-bold">B</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-red-400" data-testid="side-sell">
            <ArrowDown className="h-3 w-3" />
            <span className="text-xs font-bold">S</span>
          </div>
        )}
      </div>
    </div>
  );
}
