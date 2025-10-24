import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SystemHeader } from "@/components/SystemHeader";
import { ChartComponent } from "@/components/ChartComponent";
import { RegimeIndicator } from "@/components/RegimeIndicator";
import { LiveStatsPanel } from "@/components/LiveStatsPanel";
import { TradeHistoryTable } from "@/components/TradeHistoryTable";
import { ControlPanel } from "@/components/ControlPanel";
import type {
  SystemStatus,
  MarketData,
  VolumetricCandle,
  VWAPData,
  RegimeState,
  Position,
  Trade,
  ControlSettings,
} from "@shared/schema";

export default function TradingDashboard() {
  const [settings, setSettings] = useState<ControlSettings>({
    auto_trading: false,
    volume_target: 100,
    cd_threshold: 50,
    symbol: "MES",
  });

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

  const handleSettingsChange = (newSettings: Partial<ControlSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleEmergencyStop = async () => {
    try {
      const response = await fetch("/api/emergency-stop", {
        method: "POST",
      });
      if (!response.ok) {
        console.error("Emergency stop failed");
      }
    } catch (error) {
      console.error("Emergency stop error:", error);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background" data-testid="page-trading-dashboard">
      <SystemHeader status={systemStatus ?? null} marketData={marketData ?? null} />

      <div className="flex-1 overflow-hidden p-4 gap-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[auto_1fr_auto]">
        <div className="lg:col-span-2 flex items-center justify-between gap-4">
          {regimeData && (
            <RegimeIndicator
              regime={regimeData.regime}
              cumulativeDelta={regimeData.cumulative_delta}
            />
          )}
        </div>

        <div className="row-span-2 min-h-[400px]">
          <ChartComponent
            candles={candles ?? []}
            vwap={vwapData ?? null}
            isLoading={candlesLoading}
          />
        </div>

        <div className="row-span-2 overflow-hidden">
          <LiveStatsPanel
            vwap={vwapData ?? null}
            position={position ?? null}
            marketData={marketData ?? null}
          />
        </div>

        <div className="lg:col-span-2">
          <TradeHistoryTable trades={trades ?? []} />
        </div>

        <div className="lg:col-span-2">
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
