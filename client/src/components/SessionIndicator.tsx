import { Badge } from "@/components/ui/badge";
import type { SessionType, SessionStats } from "@shared/schema";
import { Sun, Moon, Clock } from "lucide-react";

interface SessionIndicatorProps {
  sessionStats: SessionStats | null;
  className?: string;
}

export function SessionIndicator({ sessionStats, className = "" }: SessionIndicatorProps) {
  if (!sessionStats) {
    return (
      <div className={`flex flex-col gap-3 ${className}`} data-testid="container-session-indicator">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Session Status
        </span>
        <Badge className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border bg-muted text-muted-foreground border-border">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-bold uppercase tracking-wider font-sans">
            LOADING
          </span>
        </Badge>
      </div>
    );
  }

  const getSessionConfig = (session: SessionType) => {
    switch (session) {
      case "RTH":
        return {
          label: "RTH (Regular)",
          icon: Sun,
          bgClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
          description: "9:30 AM - 4:00 PM ET",
        };
      case "ETH":
        return {
          label: "ETH (Extended)",
          icon: Moon,
          bgClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
          description: "6:00 PM - 9:30 AM ET",
        };
    }
  };

  const config = getSessionConfig(sessionStats.current_session);
  const Icon = config.icon;

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Calculate time to next session
  const timeToNextSession = sessionStats.next_session_time - Date.now();

  return (
    <div className={`flex flex-col gap-3 ${className}`} data-testid="container-session-indicator">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Trading Session
        </span>
      </div>

      <Badge
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full border ${config.bgClass} transition-all duration-150`}
        data-testid={`badge-session-${sessionStats.current_session.toLowerCase()}`}
      >
        <Icon className="h-4 w-4" />
        <span className="text-sm font-bold uppercase tracking-wider font-sans">
          {config.label}
        </span>
      </Badge>

      <div className="space-y-2 mt-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Next Session
          </span>
          <span className="text-sm font-semibold font-mono tabular-nums" data-testid="text-time-to-next">
            {formatTime(timeToNextSession)}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {sessionStats.current_session} Delta
          </span>
          <span
            className={`text-lg font-bold font-mono tabular-nums ${sessionStats.current_session === "ETH" ? (sessionStats.eth_cumulative_delta >= 0 ? "text-trading-profit" : "text-trading-loss") : (sessionStats.rth_cumulative_delta >= 0 ? "text-trading-profit" : "text-trading-loss")}`}
            data-testid="text-session-delta"
          >
            {sessionStats.current_session === "ETH" 
              ? `${sessionStats.eth_cumulative_delta >= 0 ? "+" : ""}${sessionStats.eth_cumulative_delta.toFixed(0)}`
              : `${sessionStats.rth_cumulative_delta >= 0 ? "+" : ""}${sessionStats.rth_cumulative_delta.toFixed(0)}`
            }
          </span>
        </div>
      </div>
    </div>
  );
}
