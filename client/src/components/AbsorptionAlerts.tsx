import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { AbsorptionEvent } from "@shared/schema";
import { ShieldCheck, ShieldAlert } from "lucide-react";

export function AbsorptionAlerts() {
  const { data: events = [], isLoading } = useQuery<AbsorptionEvent[]>({
    queryKey: ["/api/absorption-events"],
    refetchInterval: 1000, // Refresh every second
  });

  if (isLoading) {
    return (
      <Card className="h-full p-4">
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground text-sm">Loading absorption data...</div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <div className="border-b px-4 py-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Absorption Events
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Large volume absorbed without price movement
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {events.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No absorption events detected
            </div>
          ) : (
            <div className="space-y-3">
              {[...events].reverse().map((event, index) => (
                <AbsorptionCard 
                  key={`${event.timestamp}-${index}`} 
                  event={event} 
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

function AbsorptionCard({ event }: { event: AbsorptionEvent }) {
  const time = new Date(event.timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const isBuyAbsorption = event.side === "BUY_ABSORPTION";
  const icon = isBuyAbsorption ? ShieldCheck : ShieldAlert;
  const IconComponent = icon;

  return (
    <div
      className={`p-3 rounded-lg border ${
        isBuyAbsorption 
          ? "border-green-500/30 bg-green-500/5" 
          : "border-red-500/30 bg-red-500/5"
      }`}
      data-testid={`absorption-event-${event.timestamp}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <IconComponent 
            className={`h-4 w-4 ${isBuyAbsorption ? "text-green-400" : "text-red-400"}`}
          />
          <Badge 
            variant={isBuyAbsorption ? "default" : "destructive"}
            className="text-xs"
            data-testid="absorption-side"
          >
            {isBuyAbsorption ? "BUY SUPPORT" : "SELL RESISTANCE"}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {time}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">Price</div>
          <div className="font-semibold tabular-nums" data-testid="absorption-price">
            {event.price.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Ratio</div>
          <div className="font-semibold tabular-nums" data-testid="absorption-ratio">
            {event.ratio.toFixed(1)}:1
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Aggressive Vol</div>
          <div className="font-semibold tabular-nums">
            {event.aggressive_volume}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Price Change</div>
          <div className={`font-semibold tabular-nums ${
            event.price_change > 0 ? "text-green-400" : event.price_change < 0 ? "text-red-400" : ""
          }`}>
            {event.price_change > 0 ? "+" : ""}{event.price_change.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="mt-2 text-xs text-muted-foreground">
        {isBuyAbsorption 
          ? "Selling pressure absorbed by buyers - potential support level" 
          : "Buying pressure absorbed by sellers - potential resistance level"}
      </div>
    </div>
  );
}
