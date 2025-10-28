/**
 * F1 Command Center - Professional Trading Interface
 * 
 * Inspired by Formula 1 steering wheel design:
 * - High contrast (green/red/yellow on black)
 * - Quick-glance traffic light indicators
 * - Tactical button/gauge layout
 * - Minimal charts, maximum context
 * 
 * G7FX PRO Course: 90% Context, 10% Order Flow
 */

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Zap, Target } from "lucide-react";
import type { 
  SystemStatus, 
  MarketData, 
  VolumeProfile,
  AbsorptionEvent,
  CompositeProfileData,
  ValueMigrationData,
  DailyHypothesis,
  OrderFlowSignal
} from "@shared/schema";

export default function F1CommandCenter() {
  // Core system data
  const { data: status } = useQuery<SystemStatus>({
    queryKey: ["/api/status"],
    refetchInterval: 1000,
  });

  const { data: marketData } = useQuery<MarketData>({
    queryKey: ["/api/market-data"],
    refetchInterval: 500,
  });

  const { data: volumeProfile } = useQuery<VolumeProfile>({
    queryKey: ["/api/volume-profile"],
    refetchInterval: 5000,
  });

  const { data: absorptionEvents } = useQuery<AbsorptionEvent[]>({
    queryKey: ["/api/absorption-events"],
    refetchInterval: 1000,
  });

  // PRO system data
  const { data: compositeProfile } = useQuery<CompositeProfileData>({ 
    queryKey: ["/api/composite-profile"],
    refetchInterval: 60000, // Update every minute
  });
  
  const { data: valueMigration } = useQuery<ValueMigrationData>({ 
    queryKey: ["/api/value-migration"],
    refetchInterval: 10000, // Update every 10 seconds
  });
  
  const { data: hypothesis } = useQuery<DailyHypothesis>({ 
    queryKey: ["/api/daily-hypothesis"],
    refetchInterval: 60000, // Update every minute
  });
  
  const { data: orderFlowSignals } = useQuery<OrderFlowSignal[]>({ 
    queryKey: ["/api/orderflow-signals"],
    refetchInterval: 2000, // Update every 2 seconds
  });

  // Derive display values from PRO data
  const marketCondition = hypothesis?.condition || "UNKNOWN";
  const buyPressure = valueMigration ? Math.max(0, valueMigration.migration_strength * 10) : 50;
  const sellPressure = valueMigration ? Math.max(0, -valueMigration.migration_strength * 10) : 50;
  const deltaStrength = valueMigration ? Math.round(valueMigration.migration_strength * 100) : 0;

  return (
    <div className="h-screen flex flex-col bg-black text-green-400 font-mono overflow-hidden">
      {/* F1-Style Header: Large Regime Indicator */}
      <div className="h-24 border-b border-green-900 flex items-center justify-center relative">
        <div className="absolute top-4 left-6 flex gap-3">
          <Badge variant={status?.ibkr_connected ? "default" : "secondary"} className="gap-1.5" data-testid="badge-ibkr">
            <div className={`h-2 w-2 rounded-full ${status?.ibkr_connected ? "bg-green-500" : "bg-gray-600"}`} />
            <span className="text-xs">IBKR</span>
          </Badge>
          <Badge variant={status?.market_data_active ? "default" : "secondary"} className="gap-1.5" data-testid="badge-data">
            <div className={`h-2 w-2 rounded-full ${status?.market_data_active ? "bg-green-500" : "bg-gray-600"}`} />
            <span className="text-xs">DATA</span>
          </Badge>
        </div>

        {/* Traffic Light Market Regime */}
        <div className="flex items-center gap-6" data-testid="regime-indicator">
          {/* Traffic Light Visual */}
          <div className="flex flex-col gap-2 p-3 bg-gray-950 rounded border border-gray-800">
            <div className={`h-4 w-4 rounded-full ${marketCondition.includes("BULLISH") ? "bg-green-500 shadow-lg shadow-green-500/50" : "bg-gray-800"}`} />
            <div className={`h-4 w-4 rounded-full ${marketCondition === "BALANCE" || marketCondition === "BREAKOUT_PENDING" ? "bg-yellow-500 shadow-lg shadow-yellow-500/50" : "bg-gray-800"}`} />
            <div className={`h-4 w-4 rounded-full ${marketCondition.includes("BEARISH") ? "bg-red-500 shadow-lg shadow-red-500/50" : "bg-gray-800"}`} />
          </div>

          {/* Regime Label */}
          <div className="text-center">
            <div className={`text-4xl font-bold tracking-wider ${
              marketCondition.includes("BULLISH") ? "text-green-500" :
              marketCondition.includes("BEARISH") ? "text-red-500" :
              "text-yellow-500"
            }`}>
              {marketCondition.replace("_", " ")}
            </div>
            <div className="text-sm text-gray-500 mt-1">MARKET REGIME</div>
          </div>
        </div>

        {/* Price Display */}
        <div className="absolute top-4 right-6 text-right">
          <div className="text-xs text-gray-500">ES {marketData?.symbol || ""}</div>
          <div className="text-2xl font-bold text-green-400 tabular-nums">
            {marketData?.last_price.toFixed(2) || "----"}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 grid grid-cols-3 gap-3 p-3 overflow-hidden">
        {/* LEFT: Pressure Gauges & Delta */}
        <div className="flex flex-col gap-3">
          {/* Buy/Sell Pressure Meters */}
          <Card className="bg-gray-950 border-green-900 p-4 flex-1" data-testid="pressure-gauges">
            <div className="text-xs text-green-500 mb-3 uppercase tracking-wider">Market Pressure</div>
            
            {/* Buy Pressure */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-green-400">BUY</span>
                <span className="text-green-400 font-bold">{buyPressure}%</span>
              </div>
              <div className="h-3 bg-gray-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-500"
                  style={{ width: `${buyPressure}%` }}
                />
              </div>
            </div>

            {/* Sell Pressure */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-red-400">SELL</span>
                <span className="text-red-400 font-bold">{sellPressure}%</span>
              </div>
              <div className="h-3 bg-gray-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-500"
                  style={{ width: `${sellPressure}%` }}
                />
              </div>
            </div>

            {/* Cumulative Delta Gauge */}
            <div className="mt-6 pt-4 border-t border-gray-800">
              <div className="text-xs text-gray-500 mb-2 uppercase">Cumulative Delta</div>
              <div className={`text-3xl font-bold tabular-nums ${deltaStrength >= 0 ? "text-green-400" : "text-red-400"}`}>
                {deltaStrength >= 0 ? "+" : ""}{deltaStrength}
              </div>
              <div className="flex gap-2 mt-2">
                {deltaStrength >= 0 ? <TrendingUp className="h-4 w-4 text-green-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
                <span className="text-xs text-gray-500">
                  {deltaStrength >= 0 ? "Buying pressure building" : "Selling pressure building"}
                </span>
              </div>
            </div>
          </Card>

          {/* Value Areas */}
          <Card className="bg-gray-950 border-green-900 p-4" data-testid="value-areas">
            <div className="text-xs text-green-500 mb-3 uppercase tracking-wider">Value Areas</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">VAH:</span>
                <span className="text-green-400 font-bold tabular-nums">
                  {volumeProfile?.vah.toFixed(2) || "----"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">POC:</span>
                <span className="text-yellow-400 font-bold tabular-nums">
                  {volumeProfile?.poc.toFixed(2) || "----"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">VAL:</span>
                <span className="text-red-400 font-bold tabular-nums">
                  {volumeProfile?.val.toFixed(2) || "----"}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* CENTER: Order Flow Signals */}
        <div className="flex flex-col gap-3">
          <Card className="bg-gray-950 border-green-900 p-4 flex-1 overflow-hidden" data-testid="orderflow-signals">
            <div className="text-xs text-green-500 mb-3 uppercase tracking-wider flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Order Flow Signals
            </div>
            
            <div className="space-y-2 overflow-y-auto max-h-full">
              {/* Absorption Events */}
              {absorptionEvents && absorptionEvents.slice(0, 5).map((event, i) => (
                <div 
                  key={`abs-${i}`} 
                  className={`p-2 rounded border ${
                    event.side === "BUY_ABSORPTION" 
                      ? "bg-green-950/30 border-green-800" 
                      : "bg-red-950/30 border-red-800"
                  }`}
                  data-testid={`signal-absorption-${i}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`h-2 w-2 rounded-full ${
                      event.side === "BUY_ABSORPTION" 
                        ? "bg-green-500 shadow-lg shadow-green-500/50 animate-pulse" 
                        : "bg-red-500 shadow-lg shadow-red-500/50 animate-pulse"
                    }`} />
                    <span className={`text-xs font-bold ${
                      event.side === "BUY_ABSORPTION" ? "text-green-400" : "text-red-400"
                    }`}>
                      ABSORPTION
                    </span>
                    <span className="text-xs text-gray-500">
                      {event.ratio.toFixed(1)}:1 @ {event.price.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}

              {/* Advanced Order Flow Signals */}
              {orderFlowSignals && orderFlowSignals.slice(0, 5).map((signal, i) => {
                // Color scheme based on signal type
                const getSignalStyle = () => {
                  if (signal.signal_type === "LACK_OF_PARTICIPATION") {
                    return {
                      bg: "bg-yellow-950/30",
                      border: "border-yellow-800",
                      text: "text-yellow-400",
                      glow: "bg-yellow-500 shadow-yellow-500/50"
                    };
                  } else if (signal.signal_type === "STACKED_IMBALANCE") {
                    return signal.direction === "BULLISH"
                      ? { bg: "bg-blue-950/30", border: "border-blue-800", text: "text-blue-400", glow: "bg-blue-500 shadow-blue-500/50" }
                      : { bg: "bg-orange-950/30", border: "border-orange-800", text: "text-orange-400", glow: "bg-orange-500 shadow-orange-500/50" };
                  } else if (signal.signal_type === "TRAPPED_TRADERS") {
                    return { bg: "bg-purple-950/30", border: "border-purple-800", text: "text-purple-400", glow: "bg-purple-500 shadow-purple-500/50" };
                  } else if (signal.signal_type.includes("INITIATIVE")) {
                    return signal.direction === "BULLISH"
                      ? { bg: "bg-cyan-950/30", border: "border-cyan-800", text: "text-cyan-400", glow: "bg-cyan-500 shadow-cyan-500/50" }
                      : { bg: "bg-pink-950/30", border: "border-pink-800", text: "text-pink-400", glow: "bg-pink-500 shadow-pink-500/50" };
                  } else if (signal.signal_type.includes("EXHAUSTION")) {
                    return { bg: "bg-red-950/30", border: "border-red-800", text: "text-red-400", glow: "bg-red-500 shadow-red-500/50" };
                  }
                  return { bg: "bg-gray-950/30", border: "border-gray-800", text: "text-gray-400", glow: "bg-gray-500 shadow-gray-500/50" };
                };

                const style = getSignalStyle();
                const signalName = signal.signal_type.replace(/_/g, " ");

                return (
                  <div 
                    key={`sig-${i}`} 
                    className={`p-2 rounded border ${style.bg} ${style.border}`}
                    data-testid={`signal-${signal.signal_type}-${i}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`h-2 w-2 rounded-full ${style.glow} ${signal.actionable ? "animate-pulse" : ""}`} />
                      <span className={`text-xs font-bold ${style.text}`}>
                        {signalName}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">{signal.description}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-600">
                        Conf: {signal.confidence}%
                      </span>
                      {signal.actionable && (
                        <span className="text-xs text-green-500 font-bold">ACTIONABLE</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Placeholder when no signals */}
              {(!absorptionEvents || absorptionEvents.length === 0) && 
               (!orderFlowSignals || orderFlowSignals.length === 0) && (
                <div className="text-center text-gray-600 py-8">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <div className="text-xs">Waiting for order flow signals...</div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT: Trade Recommendations & Context */}
        <div className="flex flex-col gap-3">
          {/* Daily Hypothesis */}
          <Card className="bg-gray-950 border-green-900 p-4" data-testid="daily-hypothesis">
            <div className="text-xs text-green-500 mb-3 uppercase tracking-wider flex items-center gap-2">
              <Target className="h-4 w-4" />
              Daily Hypothesis
            </div>
            <div className="space-y-2">
              <div className="text-xs text-gray-500 uppercase">Condition</div>
              <div className="text-lg font-bold text-red-400">TREND DOWN</div>
              
              <div className="text-xs text-gray-500 uppercase mt-3">Strategy</div>
              <div className="text-xs text-gray-300">
                Sell bounces to VWAP or VAH, cover at support
              </div>

              <div className="text-xs text-gray-500 uppercase mt-3">Key Levels</div>
              <div className="text-xs text-gray-300 space-y-1">
                <div className="flex justify-between">
                  <span>R1:</span>
                  <span className="text-red-400 tabular-nums">6010.00</span>
                </div>
                <div className="flex justify-between">
                  <span>S1:</span>
                  <span className="text-green-400 tabular-nums">5995.00</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Account Info */}
          <Card className="bg-gray-950 border-green-900 p-4" data-testid="account-info">
            <div className="text-xs text-green-500 mb-3 uppercase tracking-wider">Account</div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Balance:</span>
                <span className="text-green-400 font-bold tabular-nums">
                  £{status?.capital.toFixed(0) || "0"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Daily P&L:</span>
                <span className={`font-bold tabular-nums ${
                  (status?.daily_pnl || 0) >= 0 ? "text-green-400" : "text-red-400"
                }`}>
                  {(status?.daily_pnl || 0) >= 0 ? "+" : ""}£{status?.daily_pnl.toFixed(2) || "0.00"}
                </span>
              </div>
            </div>
          </Card>

          {/* System Status */}
          <Card className="bg-gray-950 border-green-900 p-4 flex-1" data-testid="system-status">
            <div className="text-xs text-green-500 mb-3 uppercase tracking-wider">System Status</div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${status?.auto_trading_enabled ? "bg-green-500" : "bg-gray-600"}`} />
                <span className="text-gray-400">Auto Trading:</span>
                <span className={status?.auto_trading_enabled ? "text-green-400" : "text-gray-600"}>
                  {status?.auto_trading_enabled ? "ENABLED" : "DISABLED"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-gray-400">Market Data:</span>
                <span className="text-green-400">STREAMING</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <span className="text-gray-400">Account:</span>
                <span className="text-yellow-400">{status?.account_type || "UNKNOWN"}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Footer: Quick Stats */}
      <div className="h-12 border-t border-green-900 flex items-center justify-around px-6 text-xs" data-testid="footer-stats">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Volume:</span>
          <span className="text-green-400 font-bold tabular-nums">{volumeProfile?.total_volume.toLocaleString() || "0"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Profile:</span>
          <span className="text-yellow-400 font-bold">{volumeProfile?.profile_type || "D"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Signals:</span>
          <span className="text-green-400 font-bold tabular-nums">{absorptionEvents?.length || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Last Update:</span>
          <span className="text-gray-400 tabular-nums">
            {status ? new Date(status.last_update).toLocaleTimeString() : "--:--:--"}
          </span>
        </div>
      </div>
    </div>
  );
}
