import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/lib/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { NavigationHeader } from "@/components/NavigationHeader";
import { SystemHeader } from "@/components/SystemHeader";
import { ChartComponent } from "@/components/ChartComponent";
import { RegimeIndicator } from "@/components/RegimeIndicator";
import { SessionIndicator } from "@/components/SessionIndicator";
import { LiveStatsPanel } from "@/components/LiveStatsPanel";
import { TradeHistoryTable } from "@/components/TradeHistoryTable";
import { ControlPanel } from "@/components/ControlPanel";
import { TimeAndSalesPanel } from "@/components/TimeAndSalesPanel";
import { DomLadder } from "@/components/DomLadder";
import { AbsorptionAlerts } from "@/components/AbsorptionAlerts";
import type {
  SystemStatus,
  MarketData,
  VolumetricCandle,
  VWAPData,
  RegimeState,
  Position,
  Trade,
  ControlSettings,
  SessionStats,
  KeyLevels,
} from "@shared/schema";

export default function TradingDashboard() {
  const [settings, setSettings] = useState<ControlSettings>({
    auto_trading: false,
    symbol: "MES",
    // Order Flow Settings (from Foundation Course)
    absorption_threshold: 2.0,
    absorption_lookback: 5,
    dom_imbalance_threshold: 2.0,
    dom_depth_levels: 10,
    tape_volume_threshold: 10,
    tape_ratio_threshold: 1.5,
    tape_lookback_seconds: 60,
    use_poc_magnet: true,
    use_vah_val_boundaries: true,
    stop_loss_ticks: 8,
    take_profit_ticks: 16,
    min_confidence: 60,
  });

  const { isConnected } = useWebSocket();
  const { toast } = useToast();

  useEffect(() => {
    if (isConnected) {
      toast({
        title: "Connected",
        description: "Real-time data streaming active",
      });
    }
  }, [isConnected, toast]);

  const { data: systemStatus } = useQuery<SystemStatus>({
    queryKey: ["/api/status"],
    refetchInterval: 1000,
  });

  const { data: marketData } = useQuery<MarketData>({
    queryKey: ["/api/market-data"],
    refetchInterval: 500,
  });

  const { data: candles, isLoading: candlesLoading } = useQuery<VolumetricCandle[]>({
    queryKey: ["/api/candles"],
    refetchInterval: 1000,
  });

  const { data: vwapData } = useQuery<VWAPData>({
    queryKey: ["/api/vwap"],
    refetchInterval: 1000,
  });

  const { data: regimeData } = useQuery<{ regime: RegimeState; cumulative_delta: number }>({
    queryKey: ["/api/regime"],
    refetchInterval: 1000,
  });

  const { data: position } = useQuery<Position>({
    queryKey: ["/api/position"],
    refetchInterval: 500,
  });

  const { data: trades } = useQuery<Trade[]>({
    queryKey: ["/api/trades"],
    refetchInterval: 2000,
  });

  const { data: sessionStats } = useQuery<SessionStats>({
    queryKey: ["/api/session"],
    refetchInterval: 1000,
  });

  const { data: keyLevels } = useQuery<KeyLevels>({
    queryKey: ["/api/key-levels"],
    refetchInterval: 5000,
  });

  const handleSettingsChange = (newSettings: Partial<ControlSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleEmergencyStop = async () => {
    try {
      const response = await fetch("/api/emergency-stop", {
        method: "POST",
      });
      if (response.ok) {
        toast({
          title: "Emergency Stop Executed",
          description: "All positions closed and trading halted",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Emergency stop failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Emergency stop error:", error);
      toast({
        title: "Error",
        description: "Failed to execute emergency stop",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background" data-testid="page-trading-dashboard">
      <NavigationHeader />
      <SystemHeader status={systemStatus ?? null} marketData={marketData ?? null} />

      <div className="flex-1 overflow-auto p-4 gap-4">
        {/* Top Indicators */}
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          {regimeData && (
            <RegimeIndicator
              regime={regimeData.regime}
              cumulativeDelta={regimeData.cumulative_delta}
            />
          )}
          <SessionIndicator sessionStats={sessionStats ?? null} />
        </div>

        {/* Main Order Flow Layout: 90/10 Rule (90% order flow data, 10% chart) */}
        <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_300px] gap-4 mb-4" style={{ height: "600px" }}>
          {/* Left: Time & Sales */}
          <div className="h-full">
            <TimeAndSalesPanel />
          </div>

          {/* Center: Chart (Smaller for 90/10 rule) */}
          <div className="h-full min-h-[400px]">
            <ChartComponent
              candles={candles ?? []}
              vwap={vwapData ?? null}
              keyLevels={keyLevels ?? null}
              isLoading={candlesLoading}
            />
          </div>

          {/* Right: DOM */}
          <div className="h-full">
            <DomLadder />
          </div>
        </div>

        {/* Secondary Row: Absorption + Stats */}
        <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_300px] gap-4 mb-4" style={{ height: "400px" }}>
          {/* Left: Absorption Alerts */}
          <div className="h-full">
            <AbsorptionAlerts />
          </div>

          {/* Center: Trade History */}
          <div className="h-full">
            <TradeHistoryTable trades={trades ?? []} />
          </div>

          {/* Right: Live Stats */}
          <div className="h-full overflow-hidden">
            <LiveStatsPanel
              vwap={vwapData ?? null}
              position={position ?? null}
              marketData={marketData ?? null}
            />
          </div>
        </div>

        {/* Control Panel */}
        <div className="mb-4">
          <ControlPanel
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onEmergencyStop={handleEmergencyStop}
          />
        </div>
      </div>
    </div>
  );
}
