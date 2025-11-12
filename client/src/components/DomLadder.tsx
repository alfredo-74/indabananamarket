import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DomSnapshot } from "@shared/schema";
import { TrendingUp, TrendingDown } from "lucide-react";

export function DomLadder() {
  const { data: snapshot, isLoading } = useQuery<DomSnapshot | null>({
    queryKey: ["/api/dom"],
    refetchInterval: 500, // Real-time refresh
  });

  if (isLoading) {
    return (
      <Card className="h-full p-4">
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground text-sm">Loading DOM...</div>
        </div>
      </Card>
    );
  }

  if (!snapshot || snapshot.levels.length === 0) {
    return (
      <Card className="h-full p-4">
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground text-sm">No market depth data</div>
        </div>
      </Card>
    );
  }

  // Calculate max sizes for visualization
  const maxBidSize = Math.max(...snapshot.levels.map((l) => l.bid_size), 1);
  const maxAskSize = Math.max(...snapshot.levels.map((l) => l.ask_size), 1);
  const maxSize = Math.max(maxBidSize, maxAskSize);

  // Calculate bid/ask imbalance
  const totalBid = snapshot.levels.reduce((sum, l) => sum + l.bid_size, 0);
  const totalAsk = snapshot.levels.reduce((sum, l) => sum + l.ask_size, 0);
  const imbalanceRatio = totalBid + totalAsk > 0 
    ? (totalBid / (totalBid + totalAsk)) 
    : 0.5;

  return (
    <Card className="h-full flex flex-col">
      <div className="border-b px-4 py-3 space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Depth of Market
        </h3>
        
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Spread:</span>
            <span className="font-semibold tabular-nums">{snapshot.spread.toFixed(2)}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Imbalance:</span>
            <div className={`flex items-center gap-1 font-semibold tabular-nums ${
              imbalanceRatio > 0.6 ? "text-green-400" : imbalanceRatio < 0.4 ? "text-red-400" : "text-yellow-400"
            }`}>
              {imbalanceRatio > 0.6 && <TrendingUp className="h-3 w-3" />}
              {imbalanceRatio < 0.4 && <TrendingDown className="h-3 w-3" />}
              <span>{(imbalanceRatio * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Header */}
          <div className="grid grid-cols-[1fr_100px_1fr] gap-2 px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground border-b mb-1">
            <div className="text-right">Bid Size</div>
            <div className="text-center">Price</div>
            <div className="text-left">Ask Size</div>
          </div>

          {/* Levels */}
          <div className="space-y-0.5">
            {snapshot.levels.map((level, index) => (
              <DomLevel
                key={`${level.price}-${index}`}
                level={level}
                maxSize={maxSize}
                bestBid={snapshot.best_bid}
                bestAsk={snapshot.best_ask}
              />
            ))}
          </div>
        </div>
      </ScrollArea>
    </Card>
  );
}

interface DomLevelProps {
  level: {
    price: number;
    bid_size: number;
    ask_size: number;
    bid_orders: number;
    ask_orders: number;
  };
  maxSize: number;
  bestBid: number;
  bestAsk: number;
}

function DomLevel({ level, maxSize, bestBid, bestAsk }: DomLevelProps) {
  const isBestBid = level.price === bestBid && level.bid_size > 0;
  const isBestAsk = level.price === bestAsk && level.ask_size > 0;
  
  // Calculate bar widths (percentage of max)
  const bidWidthPercent = level.bid_size > 0 ? (level.bid_size / maxSize) * 100 : 0;
  const askWidthPercent = level.ask_size > 0 ? (level.ask_size / maxSize) * 100 : 0;

  return (
    <div
      className={`grid grid-cols-[1fr_100px_1fr] gap-2 px-2 py-1.5 text-sm tabular-nums rounded ${
        isBestBid || isBestAsk ? "ring-1 ring-primary/50" : ""
      }`}
      data-testid={`dom-level-${level.price}`}
    >
      {/* Bid Side */}
      <div className="relative flex items-center justify-end">
        {level.bid_size > 0 && (
          <>
            {/* Background bar */}
            <div
              className="absolute right-0 h-full bg-green-500/20 rounded"
              style={{ width: `${bidWidthPercent}%` }}
            />
            {/* Size text */}
            <div className="relative z-10 font-medium text-green-400 px-2">
              {level.bid_size}
            </div>
          </>
        )}
      </div>

      {/* Price */}
      <div className={`text-center font-semibold ${
        isBestBid 
          ? "text-green-400" 
          : isBestAsk 
            ? "text-red-400" 
            : "text-foreground"
      }`}>
        {level.price.toFixed(2)}
      </div>

      {/* Ask Side */}
      <div className="relative flex items-center justify-start">
        {level.ask_size > 0 && (
          <>
            {/* Background bar */}
            <div
              className="absolute left-0 h-full bg-red-500/20 rounded"
              style={{ width: `${askWidthPercent}%` }}
            />
            {/* Size text */}
            <div className="relative z-10 font-medium text-red-400 px-2">
              {level.ask_size}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
