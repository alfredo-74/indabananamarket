import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Draggable from "react-draggable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, AlertTriangle, Zap, Target, Power, Move } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { 
  SystemStatus, 
  MarketData, 
  VolumeProfile,
  AbsorptionEvent,
  CompositeProfileData,
  ValueMigrationData,
  DailyHypothesis,
  OrderFlowSignal,
  TradeRecommendation
} from "@shared/schema";

const GRID_COLS = 4;
const GRID_ROWS = 3;
const GAP_PERCENT = 1.5; // Gap as percentage of viewport width
const MARGIN_PERCENT = 1.5; // Margin as percentage of viewport width

function GridWindow({ 
  title, 
  children, 
  gridPosition,
  windowId,
  onDragStart,
  onDragStop,
  testId = ""
}: { 
  title: string; 
  children: React.ReactNode; 
  gridPosition: { col: number; row: number };
  windowId: string;
  onDragStart: (id: string) => void;
  onDragStop: (id: string, col: number, row: number) => void;
  testId?: string;
}) {
  const containerWidth = window.innerWidth;
  const containerHeight = window.innerHeight - 80 - 64;
  
  const margin = (MARGIN_PERCENT / 100) * containerWidth;
  const gap = (GAP_PERCENT / 100) * containerWidth;
  const winWidth = (containerWidth - margin * 2 - gap * (GRID_COLS - 1)) / GRID_COLS;
  const winHeight = (containerHeight - margin * 2 - gap * (GRID_ROWS - 1)) / GRID_ROWS;
  
  const x = margin + gridPosition.col * (winWidth + gap);
  const y = margin + gridPosition.row * (winHeight + gap);
  
  return (
    <Draggable
      position={{ x, y }}
      onStart={() => onDragStart(windowId)}
      onStop={(_e, data) => {
        const col = Math.max(0, Math.min(GRID_COLS - 1, Math.round((data.x - margin) / (winWidth + gap))));
        const row = Math.max(0, Math.min(GRID_ROWS - 1, Math.round((data.y - margin) / (winHeight + gap))));
        onDragStop(windowId, col, row);
      }}
      bounds="parent"
    >
      <div 
        className="bg-gray-950/95 backdrop-blur-sm border-2 border-green-900/40 rounded-sm overflow-hidden cursor-move"
        style={{ 
          width: `${winWidth}px`,
          height: `${winHeight}px`
        }}
        data-testid={testId}
      >
        <div className="px-2 py-1 bg-green-950/30 border-b border-green-900/40 flex items-center gap-2">
          <Move className="h-3 w-3 text-green-600" />
          <div className="text-[10px] text-green-500 uppercase tracking-wider font-bold">{title}</div>
        </div>
        <div className="p-2 h-[calc(100%-32px)] overflow-y-auto">
          {children}
        </div>
      </div>
    </Draggable>
  );
}

export default function F1CommandCenter() {
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

  const { data: compositeProfile } = useQuery<CompositeProfileData>({ 
    queryKey: ["/api/composite-profile"],
    refetchInterval: 60000,
  });
  
  const { data: valueMigration } = useQuery<ValueMigrationData>({ 
    queryKey: ["/api/value-migration"],
    refetchInterval: 10000,
  });
  
  const { data: hypothesis } = useQuery<DailyHypothesis>({ 
    queryKey: ["/api/daily-hypothesis"],
    refetchInterval: 60000,
  });
  
  const { data: orderFlowSignals } = useQuery<OrderFlowSignal[]>({ 
    queryKey: ["/api/orderflow-signals"],
    refetchInterval: 2000,
  });

  const { data: candles } = useQuery<any[]>({ 
    queryKey: ["/api/candles"],
    refetchInterval: 5000,
  });

  const { data: vwapData } = useQuery<any>({ 
    queryKey: ["/api/vwap"],
    refetchInterval: 1000,
  });

  const { data: tradeRecommendations } = useQuery<TradeRecommendation[]>({ 
    queryKey: ["/api/trade-recommendations"],
    refetchInterval: 5000,
  });

  const { data: footprintBars } = useQuery<any[]>({
    queryKey: ["/api/footprint"],
    refetchInterval: 5000,
  });

  const { data: cvaStacking } = useQuery<any>({
    queryKey: ["/api/cva-stacking"],
    refetchInterval: 60000,
  });

  const { data: openingDrive } = useQuery<any>({
    queryKey: ["/api/opening-drive"],
    refetchInterval: 5000,
  });

  const { data: eightyPercentRule } = useQuery<any>({
    queryKey: ["/api/eighty-percent-rule"],
    refetchInterval: 5000,
  });

  const { data: valueShiftSignals } = useQuery<any[]>({
    queryKey: ["/api/value-shift"],
    refetchInterval: 10000,
  });

  const toggleAutoTradingMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch("/api/auto-trading/toggle", {
        method: "POST",
        body: JSON.stringify({ enabled }),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to toggle auto-trading");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/status"] });
    },
  });

  const latestCandle = candles && candles.length > 0 ? candles[candles.length - 1] : null;
  const marketCondition = hypothesis?.condition || "UNKNOWN";
  const cumulativeDelta = latestCandle?.cumulative_delta || 0;
  const buyPressure = valueMigration ? Math.max(0, valueMigration.migration_strength * 50) : (cumulativeDelta > 0 ? Math.min(100, cumulativeDelta) : 50);
  const sellPressure = valueMigration ? Math.max(0, -valueMigration.migration_strength * 50) : (cumulativeDelta < 0 ? Math.min(100, Math.abs(cumulativeDelta)) : 50);
  const deltaStrength = valueMigration ? Math.round(valueMigration.migration_strength * 100) : cumulativeDelta;
  const latestFootprint = footprintBars && footprintBars.length > 0 ? footprintBars[footprintBars.length - 1] : null;

  const [windowPositions, setWindowPositions] = useState<Record<string, { col: number; row: number }>>({
    'pressure': { col: 0, row: 0 },
    'orderflow': { col: 1, row: 0 },
    'setups': { col: 2, row: 0 },
    'opening-drive': { col: 3, row: 0 },
    'value-areas': { col: 0, row: 1 },
    'footprint': { col: 1, row: 1 },
    'hypothesis': { col: 2, row: 1 },
    'eighty-percent': { col: 3, row: 1 },
    'cva-levels': { col: 0, row: 2 },
    'value-shift': { col: 1, row: 2 },
    'system-status': { col: 2, row: 2 },
    'account': { col: 3, row: 2 },
  });

  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleDragStart = (id: string) => {
    setDraggingId(id);
  };

  const handleDragStop = (id: string, col: number, row: number) => {
    col = Math.max(0, Math.min(GRID_COLS - 1, col));
    row = Math.max(0, Math.min(GRID_ROWS - 1, row));

    const targetId = Object.keys(windowPositions).find(
      key => windowPositions[key].col === col && windowPositions[key].row === row
    );

    if (targetId && targetId !== id) {
      setWindowPositions(prev => ({
        ...prev,
        [id]: { col, row },
        [targetId]: prev[id]
      }));
    } else {
      setWindowPositions(prev => ({
        ...prev,
        [id]: { col, row }
      }));
    }

    setDraggingId(null);
  };

  const hasValidCVA = compositeProfile && compositeProfile.composite_poc > 0;
  const hasValidDVA = volumeProfile && volumeProfile.poc > 0;
  const hasVWAP = vwapData && vwapData.vwap > 0;
  const hasHypothesis = hypothesis && hypothesis.confidence > 0;
  const hasActiveSignals = (absorptionEvents && absorptionEvents.length > 0) || (orderFlowSignals && orderFlowSignals.length > 0);

  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col overflow-hidden">
      <div className="h-20 border-b border-green-900 flex items-center px-6 justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className={status?.ibkr_connected ? "text-green-600" : "text-gray-600"}>IBKR </span>
            <span className={status?.ibkr_connected ? "font-bold text-green-400" : "text-gray-500"}>DATA</span>
          </div>
          <div className="text-3xl font-bold text-yellow-400 tracking-wider">{marketCondition}</div>
          <div className="text-2xl text-green-400 font-bold tabular-nums">
            ES {marketData?.last_price?.toFixed(2) || "6003.30"}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Traffic Lights */}
          <div className="flex items-center gap-2">
            <div className={`h-4 w-4 rounded-full ${hasValidCVA ? "bg-green-500 shadow-lg shadow-green-500/50" : "bg-red-600"}`} />
            <span className="text-sm text-gray-400 uppercase tracking-wide font-bold">CVA</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-4 w-4 rounded-full ${hasValidDVA ? "bg-green-500 shadow-lg shadow-green-500/50" : "bg-red-600"}`} />
            <span className="text-sm text-gray-400 uppercase tracking-wide font-bold">DVA</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-4 w-4 rounded-full ${hasVWAP ? "bg-green-500 shadow-lg shadow-green-500/50" : "bg-red-600"}`} />
            <span className="text-sm text-gray-400 uppercase tracking-wide font-bold">VWAP</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-4 w-4 rounded-full ${hasHypothesis ? "bg-green-500 shadow-lg shadow-green-500/50" : "bg-red-600"}`} />
            <span className="text-sm text-gray-400 uppercase tracking-wide font-bold">Hypothesis</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-4 w-4 rounded-full ${hasActiveSignals ? "bg-green-500 shadow-lg shadow-green-500/50 animate-pulse" : "bg-red-600"}`} />
            <span className="text-sm text-gray-400 uppercase tracking-wide font-bold">Signals</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-4 w-4 rounded-full ${status?.auto_trading_enabled ? "bg-green-500 shadow-lg shadow-green-500/50 animate-pulse" : "bg-gray-600"}`} />
            <span className="text-sm text-gray-400 uppercase tracking-wide font-bold">Auto-Trading</span>
          </div>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <GridWindow
          windowId="pressure"
          gridPosition={windowPositions['pressure']}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          title="PRESSURE GAUGES"
          testId="window-pressure"
        >
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-green-400">BUY</span>
                <span className="text-green-400 font-bold">{buyPressure}%</span>
              </div>
              <div className="h-2 bg-gray-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-500"
                  style={{ width: `${buyPressure}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-red-400">SELL</span>
                <span className="text-red-400 font-bold">{sellPressure}%</span>
              </div>
              <div className="h-2 bg-gray-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-500"
                  style={{ width: `${sellPressure}%` }}
                />
              </div>
            </div>
            <div className="pt-2 border-t border-gray-800">
              <div className="text-[10px] text-gray-500 mb-1">CUMULATIVE DELTA</div>
              <div className={`text-2xl font-bold tabular-nums ${deltaStrength >= 0 ? "text-green-400" : "text-red-400"}`}>
                {deltaStrength >= 0 ? "+" : ""}{deltaStrength}
              </div>
            </div>
          </div>
        </GridWindow>

        <GridWindow
          windowId="orderflow"
          gridPosition={windowPositions['orderflow']}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          title="ORDER FLOW SIGNALS"
          testId="window-orderflow"
        >
          <div className="space-y-1.5 overflow-y-auto max-h-36">
            {absorptionEvents && absorptionEvents.slice(0, 3).map((event, i) => (
              <div 
                key={`abs-${i}`} 
                className={`p-1.5 rounded border text-[10px] ${
                  event.side === "BUY_ABSORPTION" 
                    ? "bg-green-950/30 border-green-800" 
                    : "bg-red-950/30 border-red-800"
                }`}
                data-testid={`signal-absorption-${i}`}
              >
                <div className="flex items-center gap-1.5">
                  <div className={`h-1.5 w-1.5 rounded-full ${
                    event.side === "BUY_ABSORPTION" 
                      ? "bg-green-500 animate-pulse" 
                      : "bg-red-500 animate-pulse"
                  }`} />
                  <span className={`font-bold ${
                    event.side === "BUY_ABSORPTION" ? "text-green-400" : "text-red-400"
                  }`}>
                    ABS {event.ratio?.toFixed(1)}:1 @ {event.price?.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}

            {orderFlowSignals && orderFlowSignals.slice(0, 4).map((signal, i) => (
              <div 
                key={`sig-${i}`} 
                className="p-1.5 rounded border bg-yellow-950/20 border-yellow-800/50 text-[10px]"
                data-testid={`signal-${signal.signal_type}-${i}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                  <span className="font-bold text-yellow-400">
                    {signal.signal_type.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-gray-400 pl-3">{signal.description}</div>
              </div>
            ))}

            {(!absorptionEvents || absorptionEvents.length === 0) && 
             (!orderFlowSignals || orderFlowSignals.length === 0) && (
              <div className="text-center text-gray-600 py-4 text-[10px]">
                Waiting for signals...
              </div>
            )}
          </div>
        </GridWindow>

        <GridWindow
          windowId="setups"
          gridPosition={windowPositions['setups']}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          title="HIGH-PROBABILITY SETUPS"
          testId="window-setups"
        >
          <div className="space-y-1.5 overflow-y-auto max-h-36">
            {tradeRecommendations && tradeRecommendations.filter(r => r.active).slice(0, 2).map((rec, i) => (
              <div 
                key={i}
                className={`p-2 rounded border text-[10px] ${
                  rec.direction === "LONG" 
                    ? "bg-green-950/30 border-green-800" 
                    : "bg-red-950/30 border-red-800"
                }`}
                data-testid={`recommendation-${i}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-bold ${
                    rec.direction === "LONG" ? "text-green-400" : "text-red-400"
                  }`}>
                    {rec.setup_type.replace(/_/g, " ")}
                  </span>
                  <Badge variant={rec.confidence >= 75 ? "default" : "secondary"} className="text-[9px] h-4">
                    {rec.confidence}%
                  </Badge>
                </div>
                <div className="text-gray-400 mb-1">{rec.context_reason}</div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  <div>
                    <span className="text-gray-600">Entry:</span>
                    <span className="text-white font-bold ml-1">{rec.entry_price?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Stop:</span>
                    <span className="text-red-400 ml-1">{rec.stop_loss?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Target:</span>
                    <span className="text-green-400 ml-1">{rec.target_1?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">R:R:</span>
                    <span className="text-yellow-400 ml-1">{rec.risk_reward_ratio?.toFixed(1)}:1</span>
                  </div>
                </div>
              </div>
            ))}
            {(!tradeRecommendations || tradeRecommendations.filter(r => r.active).length === 0) && (
              <div className="text-center text-gray-600 py-6 text-[10px]">
                No high-probability setups detected
              </div>
            )}
          </div>
        </GridWindow>

        <GridWindow
          windowId="opening-drive"
          gridPosition={windowPositions['opening-drive']}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          title="OPENING DRIVE"
          testId="window-opening-drive"
        >
          {openingDrive && openingDrive.detected ? (
            <div className="space-y-1.5 text-[10px]">
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span className={`font-bold ${openingDrive.direction === "BULLISH" ? "text-green-400" : "text-red-400"}`}>
                  {openingDrive.direction} DRIVE
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Confidence:</span>
                <span className="text-yellow-400">{openingDrive.confidence}%</span>
              </div>
              {openingDrive.entry_level && (
                <div className="flex justify-between pt-1 border-t border-gray-800">
                  <span className="text-gray-500">Entry Level:</span>
                  <span className="text-green-400 font-bold">{openingDrive.entry_level.toFixed(2)}</span>
                </div>
              )}
              <div className="text-gray-400 mt-1">{openingDrive.description}</div>
            </div>
          ) : (
            <div className="text-center text-gray-600 py-4 text-[10px]">
              No opening drive detected
            </div>
          )}
        </GridWindow>

        <GridWindow
          windowId="value-areas"
          gridPosition={windowPositions['value-areas']}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          title={volumeProfile ? "DVA (TODAY'S VALUE AREA)" : "VWAP LEVELS"}
          testId="window-value-areas"
        >
          <div className="flex flex-col items-center justify-center h-full space-y-2 text-sm">
            <div className="text-center">
              <div className="text-gray-500 text-[10px]">{volumeProfile ? "VAH:" : "+SD1:"}</div>
              <div className="text-green-400 font-bold tabular-nums text-lg">
                {volumeProfile?.vah?.toFixed(2) || vwapData?.sd1_upper?.toFixed(2) || "----"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-[10px]">{volumeProfile ? "POC:" : "VWAP:"}</div>
              <div className="text-yellow-400 font-bold tabular-nums text-lg">
                {volumeProfile?.poc?.toFixed(2) || vwapData?.vwap?.toFixed(2) || "----"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-[10px]">{volumeProfile ? "VAL:" : "-SD1:"}</div>
              <div className="text-red-400 font-bold tabular-nums text-lg">
                {volumeProfile?.val?.toFixed(2) || vwapData?.sd1_lower?.toFixed(2) || "----"}
              </div>
            </div>
          </div>
        </GridWindow>

        <GridWindow
          windowId="footprint"
          gridPosition={windowPositions['footprint']}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          title="FOOTPRINT (BID/ASK)"
          testId="window-footprint"
        >
          {latestFootprint ? (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>POC: <span className="text-yellow-400 font-bold">{latestFootprint.poc_price?.toFixed(2)}</span></span>
                <span>Delta: <span className={`font-bold ${latestFootprint.bar_delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {latestFootprint.bar_delta >= 0 ? "+" : ""}{latestFootprint.bar_delta}
                </span></span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>Stacked Buy: <span className="text-green-400">{latestFootprint.stacked_buying || 0}</span></span>
                <span>Stacked Sell: <span className="text-red-400">{latestFootprint.stacked_selling || 0}</span></span>
              </div>
              {latestFootprint.price_levels && latestFootprint.price_levels.slice(0, 5).map((level: any, i: number) => (
                <div key={i} className="flex justify-between text-[9px] py-0.5 border-t border-gray-800/50">
                  <span className="text-gray-600">{level.price?.toFixed(2)}</span>
                  <span className="text-green-400">{level.bid_volume}</span>
                  <span className="text-red-400">{level.ask_volume}</span>
                  <span className={level.imbalance_direction === "BID" ? "text-green-500 font-bold" : level.imbalance_direction === "ASK" ? "text-red-500 font-bold" : "text-gray-600"}>
                    {level.imbalance_ratio?.toFixed(1)}:1
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-600 py-4 text-[10px]">
              Waiting for footprint data...
            </div>
          )}
        </GridWindow>

        <GridWindow
          windowId="hypothesis"
          gridPosition={windowPositions['hypothesis']}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          title="DAILY HYPOTHESIS"
          testId="window-hypothesis"
        >
          {hypothesis && hypothesis.confidence > 0 ? (
            <div className="space-y-2 text-[10px]">
              <div>
                <span className="text-gray-500">CONDITION: </span>
                <span className={`font-bold ${
                  hypothesis.bias === "BULLISH" ? "text-green-400" : 
                  hypothesis.bias === "BEARISH" ? "text-red-400" : "text-yellow-400"
                }`}>
                  {hypothesis.condition.replace(/_/g, " ")}
                </span>
              </div>
              <div>
                <span className="text-gray-500">STRATEGY: </span>
                <span className="text-gray-300">{hypothesis.primary_strategy}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-800">
                <div>
                  <span className="text-gray-600">R1:</span>
                  <span className="text-red-400 ml-1">{hypothesis.key_levels?.resistance_1?.toFixed(2) || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-600">S1:</span>
                  <span className="text-green-400 ml-1">{hypothesis.key_levels?.support_1?.toFixed(2) || "N/A"}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-600 py-4 text-[10px]">
              Generating hypothesis...
            </div>
          )}
        </GridWindow>

        <GridWindow
          windowId="eighty-percent"
          gridPosition={windowPositions['eighty-percent']}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          title="80% RULE"
          testId="window-eighty-percent"
        >
          {eightyPercentRule && eightyPercentRule.detected ? (
            <div className="space-y-1.5 text-[10px]">
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span className="text-green-400 font-bold">DETECTED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Completion:</span>
                <span className="text-yellow-400">{eightyPercentRule.completion_percentage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Expected:</span>
                <span className={`font-bold ${eightyPercentRule.expected_direction === "CONTINUATION" ? "text-green-400" : "text-yellow-400"}`}>
                  {eightyPercentRule.expected_direction}
                </span>
              </div>
              {eightyPercentRule.fade_entry && (
                <div className="flex justify-between pt-1 border-t border-gray-800">
                  <span className="text-gray-500">Fade Entry:</span>
                  <span className="text-red-400 font-bold">{eightyPercentRule.fade_entry.toFixed(2)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-600 py-4 text-[10px]">
              No 80% rule setup
            </div>
          )}
        </GridWindow>

        <GridWindow
          windowId="cva-levels"
          gridPosition={windowPositions['cva-levels']}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          title="CVA (5-DAY) + DVA COMPARISON"
          testId="window-chart"
        >
          <div className="space-y-2 text-[10px]">
            <div className="flex gap-4">
              <div className="space-y-0.5">
                <div className="text-cyan-400 font-bold">CVA (5-DAY)</div>
                <div className="text-gray-500">VAH: <span className="text-cyan-400">{compositeProfile?.composite_vah?.toFixed(2) || "—"}</span></div>
                <div className="text-gray-500 pl-3">POC: <span className="text-cyan-400">{compositeProfile?.composite_poc?.toFixed(2) || "—"}</span></div>
                <div className="text-gray-500">VAL: <span className="text-cyan-400">{compositeProfile?.composite_val?.toFixed(2) || "—"}</span></div>
              </div>
              <div className="border-l border-green-900/30"></div>
              <div className="space-y-0.5">
                <div className="text-yellow-400 font-bold">DVA (DAILY)</div>
                <div className="text-gray-500">VAH: <span className="text-yellow-400">{volumeProfile?.vah?.toFixed(2) || "—"}</span></div>
                <div className="text-gray-500 pl-3">POC: <span className="text-yellow-400">{volumeProfile?.poc?.toFixed(2) || "—"}</span></div>
                <div className="text-gray-500">VAL: <span className="text-yellow-400">{volumeProfile?.val?.toFixed(2) || "—"}</span></div>
              </div>
            </div>
            {cvaStacking && cvaStacking.stacked_levels && cvaStacking.stacked_levels.length > 0 && (
              <div className="pt-2 border-t border-gray-800">
                <div className="text-white font-bold mb-1">STACKED CVA LEVELS</div>
                <div className="space-y-0.5">
                  {cvaStacking.stacked_levels.slice(0, 3).map((level: any, i: number) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-gray-500">Level {i + 1}:</span>
                      <span className="text-cyan-400">{level.level?.toFixed(2)} ({level.count}x)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </GridWindow>

        <GridWindow
          windowId="value-shift"
          gridPosition={windowPositions['value-shift']}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          title="VALUE SHIFT SIGNALS"
          testId="window-value-shift"
        >
          <div className="space-y-1.5 overflow-y-auto max-h-36">
            {valueShiftSignals && valueShiftSignals.slice(0, 5).map((signal: any, i: number) => (
              <div 
                key={i}
                className={`p-1.5 rounded border text-[10px] ${
                  signal.bias === "BULLISH" 
                    ? "bg-green-950/30 border-green-800" 
                    : signal.bias === "BEARISH" 
                    ? "bg-red-950/30 border-red-800"
                    : "bg-yellow-950/30 border-yellow-800"
                }`}
                data-testid={`value-shift-${i}`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`font-bold ${
                    signal.bias === "BULLISH" ? "text-green-400" : 
                    signal.bias === "BEARISH" ? "text-red-400" : "text-yellow-400"
                  }`}>
                    {signal.condition_type?.replace(/_/g, " ")}
                  </span>
                  <span className="text-gray-500">{signal.confidence}%</span>
                </div>
                <div className="text-gray-400">{signal.trade_implication}</div>
              </div>
            ))}
            {(!valueShiftSignals || valueShiftSignals.length === 0) && (
              <div className="text-center text-gray-600 py-6 text-[10px]">
                No value shift signals
              </div>
            )}
          </div>
        </GridWindow>

        <GridWindow
          windowId="system-status"
          gridPosition={windowPositions['system-status']}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          title="SYSTEM STATUS"
          testId="window-status"
        >
          <div className="space-y-2">
            <div className="space-y-1.5 text-[10px]">
              <div className="flex items-center gap-1.5">
                <div className={`h-1.5 w-1.5 rounded-full ${status?.auto_trading_enabled ? "bg-green-500 animate-pulse" : "bg-gray-600"}`} />
                <span className="text-gray-400">Auto Trading:</span>
                <span className={status?.auto_trading_enabled ? "text-green-400" : "text-gray-600"}>
                  {status?.auto_trading_enabled ? "ON" : "OFF"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span className="text-gray-400">Market Data:</span>
                <span className="text-green-400">STREAM</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`h-1.5 w-1.5 rounded-full ${status?.ibkr_connected ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-gray-400">IBKR:</span>
                <span className={status?.ibkr_connected ? "text-green-400" : "text-red-400"}>
                  {status?.ibkr_connected ? "CONN" : "DISC"}
                </span>
              </div>
            </div>
            
            <Button
              onClick={() => toggleAutoTradingMutation.mutate(!status?.auto_trading_enabled)}
              disabled={toggleAutoTradingMutation.isPending}
              size="sm"
              variant={status?.auto_trading_enabled ? "destructive" : "default"}
              className="w-full text-[10px] h-6"
              data-testid="button-toggle-autotrading"
            >
              <Power className="h-3 w-3 mr-1" />
              {status?.auto_trading_enabled ? "DISABLE" : "ENABLE"}
            </Button>
          </div>
        </GridWindow>

        <GridWindow
          windowId="account"
          gridPosition={windowPositions['account']}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          title="ACCOUNT"
          testId="window-account"
        >
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Balance:</span>
              <span className="text-green-400 font-bold tabular-nums">
                £{status?.capital?.toFixed(0) || "0"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Daily P&L:</span>
              <span className={`font-bold tabular-nums ${
                (status?.daily_pnl || 0) >= 0 ? "text-green-400" : "text-red-400"
              }`}>
                {(status?.daily_pnl || 0) >= 0 ? "+" : ""}£{status?.daily_pnl?.toFixed(2) || "0.00"}
              </span>
            </div>
          </div>
        </GridWindow>
      </div>

      <div className="h-16 border-t border-green-900 flex items-center justify-around px-6 text-sm" data-testid="footer-stats">
        <div className="flex flex-col items-center">
          <span className="text-gray-500 text-xs">Volume</span>
          <span className="text-green-400 font-bold tabular-nums">{volumeProfile?.total_volume.toLocaleString() || "0"}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-gray-500 text-xs">Profile</span>
          <span className="text-yellow-400 font-bold text-lg">{volumeProfile?.profile_type || "D"}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-gray-500 text-xs">Signals</span>
          <span className="text-green-400 font-bold tabular-nums">{(absorptionEvents?.length || 0) + (orderFlowSignals?.length || 0)}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-gray-500 text-xs">CVA Days</span>
          <span className="text-cyan-400 font-bold">{compositeProfile?.days_included || 0}/5</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-gray-500 text-xs">Last Update</span>
          <span className="text-gray-400 tabular-nums text-xs">
            {status ? new Date(status.last_update).toLocaleTimeString() : "--:--:--"}
          </span>
        </div>
      </div>
    </div>
  );
}
