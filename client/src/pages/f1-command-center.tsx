import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, AlertTriangle, Zap, Target, Power, Move, RefreshCw } from "lucide-react";
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
const GRID_ROWS = 4;
const GAP = 12;
const MARGIN = 12;

function useDraggable(
  onDragStart: () => void,
  onDragStop: (x: number, y: number) => void
) {
  const ref = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const currentPosRef = useRef({ x: 0, y: 0 });
  
  const onDragStartRef = useRef(onDragStart);
  const onDragStopRef = useRef(onDragStop);

  useEffect(() => {
    onDragStartRef.current = onDragStart;
    onDragStopRef.current = onDragStop;
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'BUTTON' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA' ||
        target.closest('button')
      ) {
        return;
      }
      
      isDraggingRef.current = true;
      const rect = element.getBoundingClientRect();
      startPosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      currentPosRef.current = { x: rect.left, y: rect.top };
      
      if (parentRef.current) {
        parentRef.current.style.zIndex = '1000';
      }
      element.setPointerCapture(e.pointerId);
      onDragStartRef.current();
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      
      e.preventDefault();
      const newX = e.clientX - startPosRef.current.x;
      const newY = e.clientY - startPosRef.current.y;
      
      currentPosRef.current = { x: newX, y: newY };
      requestAnimationFrame(() => {
        if (element) {
          element.style.transform = `translate(${newX - parseInt(element.style.left || '0')}px, ${newY - parseInt(element.style.top || '0')}px)`;
        }
      });
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      
      isDraggingRef.current = false;
      element.releasePointerCapture(e.pointerId);
      element.style.transform = '';
      if (parentRef.current) {
        parentRef.current.style.zIndex = '';
      }
      
      onDragStopRef.current(currentPosRef.current.x, currentPosRef.current.y);
    };

    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointermove', handlePointerMove);
    element.addEventListener('pointerup', handlePointerUp);
    element.addEventListener('pointercancel', handlePointerUp);

    return () => {
      element.removeEventListener('pointerdown', handlePointerDown);
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerup', handlePointerUp);
      element.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  return { ref, parentRef };
}

function GridWindow({ 
  title, 
  children, 
  gridPosition,
  windowId,
  onDragStart,
  onDragStop,
  testId = "",
  colSpan = 1,
  containerWidth,
  containerHeight
}: { 
  title: string; 
  children: React.ReactNode; 
  gridPosition: { col: number; row: number };
  windowId: string;
  onDragStart: (id: string) => void;
  onDragStop: (id: string, col: number, row: number) => void;
  testId?: string;
  colSpan?: number;
  containerWidth: number;
  containerHeight: number;
}) {
  const winWidth = (containerWidth - MARGIN * 2 - GAP * (GRID_COLS - 1)) / GRID_COLS;
  const winHeight = (containerHeight - MARGIN * 2 - GAP * (GRID_ROWS - 1)) / GRID_ROWS;
  
  const actualWidth = winWidth * colSpan + GAP * (colSpan - 1);
  
  const handleStart = useCallback(() => {
    onDragStart(windowId);
  }, [windowId, onDragStart]);

  const handleStop = useCallback((x: number, y: number) => {
    const col = Math.max(0, Math.min(GRID_COLS - 1, Math.round((x - MARGIN) / (winWidth + GAP))));
    const row = Math.max(0, Math.min(GRID_ROWS - 1, Math.round((y - MARGIN) / (winHeight + GAP))));
    onDragStop(windowId, col, row);
  }, [windowId, winWidth, winHeight, onDragStop]);

  const { ref: dragRef, parentRef } = useDraggable(handleStart, handleStop);
  
  return (
    <div
      ref={parentRef}
      style={{
        position: 'absolute',
        left: `${MARGIN + gridPosition.col * (winWidth + GAP)}px`,
        top: `${MARGIN + gridPosition.row * (winHeight + GAP)}px`,
        width: `${actualWidth}px`,
        height: `${winHeight}px`,
      }}
    >
      <div 
        ref={dragRef}
        className="bg-gray-950/95 backdrop-blur-sm border-2 border-green-900/40 rounded-sm overflow-hidden cursor-move h-full w-full"
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
    </div>
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

  const { data: position } = useQuery<any>({
    queryKey: ["/api/position"],
    refetchInterval: 1000,
  });

  const { data: trades } = useQuery<any[]>({
    queryKey: ["/api/trades"],
    refetchInterval: 5000,
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

  const closePositionMutation = useMutation({
    mutationFn: async () => {
      if (!position || position.contracts === 0) {
        throw new Error("No position to close");
      }
      
      const action = position.contracts > 0 ? "SELL" : "BUY";
      const quantity = Math.abs(position.contracts);
      
      return await apiRequest("POST", "/api/execute-order", { action, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/position"] });
    },
  });

  const forceSyncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/position/force-sync");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/position"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
    },
  });

  const testTradeMutation = useMutation({
    mutationFn: async (action: "BUY" | "SELL") => {
      return await apiRequest("POST", "/api/execute-order", { 
        action, 
        quantity: 1 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/position"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pending-orders"] });
    },
  });

  const latestCandle = candles && candles.length > 0 ? candles[candles.length - 1] : null;
  const marketCondition = hypothesis?.condition || "UNKNOWN";
  const cumulativeDelta = latestCandle?.cumulative_delta || 0;
  
  // Normalize cumulative delta to 0-100% range for pressure gauges
  // Use buy/sell volume ratio to calculate pressure
  const buyVolume = latestCandle?.buy_volume || 0;
  const sellVolume = latestCandle?.sell_volume || 0;
  const totalVolume = buyVolume + sellVolume;
  const buyPressure = totalVolume > 0 ? Math.round((buyVolume / totalVolume) * 100) : 50;
  const sellPressure = totalVolume > 0 ? Math.round((sellVolume / totalVolume) * 100) : 50;
  const deltaStrength = cumulativeDelta;
  
  const latestFootprint = footprintBars && footprintBars.length > 0 ? footprintBars[footprintBars.length - 1] : null;

  // Calculate trade statistics
  const closedTrades = trades?.filter(t => t.status === "CLOSED") || [];
  const winningTrades = closedTrades.filter(t => t.pnl > 0).length;
  const losingTrades = closedTrades.filter(t => t.pnl < 0).length;
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  
  // Calculate max drawdown
  let maxDrawdown = 0;
  let peak = 0;
  let runningPnl = 0;
  closedTrades.forEach(trade => {
    runningPnl += trade.pnl || 0;
    if (runningPnl > peak) peak = runningPnl;
    const drawdown = peak - runningPnl;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  });


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
  
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 1920, height: 1000 });

  useEffect(() => {
    const updateDimensions = () => {
      if (gridContainerRef.current) {
        const rect = gridContainerRef.current.getBoundingClientRect();
        setContainerDimensions({ width: rect.width, height: rect.height });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

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
          <div className={`text-sm ${status?.ibkr_connected ? "text-green-500 font-bold" : "text-gray-600"}`}>
            IBKR
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
        </div>
      </div>

      <div ref={gridContainerRef} className="flex-1 relative overflow-hidden">
        <GridWindow
          windowId="pressure"
          gridPosition={windowPositions['pressure']}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          title="PRESSURE GAUGES"
          testId="window-pressure"
          containerWidth={containerDimensions.width}
          containerHeight={containerDimensions.height}
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
          containerWidth={containerDimensions.width}
          containerHeight={containerDimensions.height}
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
          containerWidth={containerDimensions.width}
          containerHeight={containerDimensions.height}
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
          containerWidth={containerDimensions.width}
          containerHeight={containerDimensions.height}
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
          containerWidth={containerDimensions.width}
          containerHeight={containerDimensions.height}
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
          containerWidth={containerDimensions.width}
          containerHeight={containerDimensions.height}
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
          containerWidth={containerDimensions.width}
          containerHeight={containerDimensions.height}
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
          containerWidth={containerDimensions.width}
          containerHeight={containerDimensions.height}
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
          containerWidth={containerDimensions.width}
          containerHeight={containerDimensions.height}
          gridPosition={windowPositions['cva-levels']}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          title="CVA (5-DAY) + DVA COMPARISON"
          testId="window-chart"
        >
          <div className="flex flex-col items-center overflow-y-auto h-full space-y-3 text-[10px] p-2">
            <div className="flex gap-6">
              <div className="text-center space-y-1">
                <div className="text-cyan-400 font-bold text-xs mb-2">CVA (5-DAY)</div>
                <div className="space-y-0.5">
                  <div className="text-gray-500 text-[9px]">VAH</div>
                  <div className="text-cyan-400 font-bold text-sm">{compositeProfile?.composite_vah?.toFixed(2) || "—"}</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-gray-500 text-[9px]">POC</div>
                  <div className="text-cyan-400 font-bold text-sm">{compositeProfile?.composite_poc?.toFixed(2) || "—"}</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-gray-500 text-[9px]">VAL</div>
                  <div className="text-cyan-400 font-bold text-sm">{compositeProfile?.composite_val?.toFixed(2) || "—"}</div>
                </div>
              </div>
              <div className="border-l border-green-900/30"></div>
              <div className="text-center space-y-1">
                <div className="text-yellow-400 font-bold text-xs mb-2">DVA (DAILY)</div>
                <div className="space-y-0.5">
                  <div className="text-gray-500 text-[9px]">VAH</div>
                  <div className="text-yellow-400 font-bold text-sm">{volumeProfile?.vah?.toFixed(2) || "—"}</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-gray-500 text-[9px]">POC</div>
                  <div className="text-yellow-400 font-bold text-sm">{volumeProfile?.poc?.toFixed(2) || "—"}</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-gray-500 text-[9px]">VAL</div>
                  <div className="text-yellow-400 font-bold text-sm">{volumeProfile?.val?.toFixed(2) || "—"}</div>
                </div>
              </div>
            </div>
            {cvaStacking && cvaStacking.stacked_levels && cvaStacking.stacked_levels.length > 0 && (
              <div className="pt-2 border-t border-gray-800 text-center">
                <div className="text-white font-bold mb-1 text-xs">STACKED LEVELS</div>
                <div className="space-y-0.5">
                  {cvaStacking.stacked_levels.slice(0, 2).map((level: any, i: number) => (
                    <div key={i} className="text-cyan-400 text-[9px]">
                      {level.level?.toFixed(2)} ({level.count}x)
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </GridWindow>

        <GridWindow
          windowId="value-shift"
          containerWidth={containerDimensions.width}
          containerHeight={containerDimensions.height}
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
          containerWidth={containerDimensions.width}
          containerHeight={containerDimensions.height}
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
          </div>
        </GridWindow>

        <GridWindow
          windowId="account"
          containerWidth={containerDimensions.width}
          containerHeight={containerDimensions.height}
          gridPosition={windowPositions['account']}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          title="ACCOUNT"
          testId="window-account"
        >
          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span className="text-gray-500">Balance:</span>
              <span className="text-green-400 font-bold tabular-nums">
                £{status?.account_balance?.toFixed(0) || status?.capital?.toFixed(0) || "0"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Position:</span>
              <span className={`font-bold tabular-nums ${
                position?.side === "LONG" ? "text-green-400" : 
                position?.side === "SHORT" ? "text-red-400" : 
                "text-gray-500"
              }`}>
                {position?.side || "FLAT"} {position?.contracts ? `${position.contracts}x` : ""}
              </span>
            </div>
            {position && position.entry_price !== null && position.contracts !== 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Entry:</span>
                <span className="text-cyan-400 font-bold tabular-nums">
                  {position.entry_price.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Unreal P&L:</span>
              <span className={`font-bold tabular-nums ${
                (position?.unrealized_pnl || 0) >= 0 ? "text-green-400" : "text-red-400"
              }`}>
                {(position?.unrealized_pnl || 0) >= 0 ? "+" : ""}£{position?.unrealized_pnl?.toFixed(2) || "0.00"}
              </span>
            </div>
            
            <Button
              onClick={() => forceSyncMutation.mutate()}
              disabled={forceSyncMutation.isPending}
              size="sm"
              variant="outline"
              className="w-full text-[10px] h-6 mt-1"
              data-testid="button-force-sync"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${forceSyncMutation.isPending ? 'animate-spin' : ''}`} />
              {forceSyncMutation.isPending ? "SYNCING..." : "FORCE SYNC"}
            </Button>
            
            <div className="border-t border-gray-800 pt-1 mt-1"></div>
            
            <div className="flex justify-between">
              <span className="text-gray-500">Total P&L:</span>
              <span className={`font-bold tabular-nums ${
                totalPnl >= 0 ? "text-green-400" : "text-red-400"
              }`}>
                {totalPnl >= 0 ? "+" : ""}£{totalPnl.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Wins / Losses:</span>
              <span className="font-mono tabular-nums">
                <span className="text-green-400">{winningTrades}</span>
                <span className="text-gray-600"> / </span>
                <span className="text-red-400">{losingTrades}</span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Max DD:</span>
              <span className="text-red-400 font-bold tabular-nums">
                -£{maxDrawdown.toFixed(2)}
              </span>
            </div>
            
            {trades && trades.length > 0 && (
              <>
                <div className="border-t border-gray-800 pt-1 mt-1"></div>
                <div className="text-gray-500 text-[9px] font-bold mb-0.5">RECENT TRADES</div>
                <div className="space-y-0.5 max-h-24 overflow-y-auto">
                  {trades.slice(0, 5).reverse().map((trade: any) => (
                    <div 
                      key={trade.id} 
                      className={`grid grid-cols-4 gap-1 p-0.5 rounded text-[8px] ${
                        trade.status === "OPEN" 
                          ? "bg-blue-950/30" 
                          : trade.pnl >= 0 
                          ? "bg-green-950/30"
                          : "bg-red-950/30"
                      }`}
                      data-testid={`trade-${trade.id}`}
                    >
                      <div className={`font-bold ${
                        trade.type === "BUY" ? "text-green-400" : "text-red-400"
                      }`}>
                        {trade.type}
                      </div>
                      <div className="text-right text-cyan-400 tabular-nums">
                        {trade.entry_price?.toFixed(2)}
                      </div>
                      <div className={`text-right font-bold tabular-nums ${
                        trade.pnl >= 0 ? "text-green-400" : "text-red-400"
                      }`}>
                        {trade.pnl !== null && trade.pnl !== 0 ? `${trade.pnl >= 0 ? "+" : ""}£${trade.pnl.toFixed(2)}` : "--"}
                      </div>
                      <div className={`text-center font-bold ${
                        trade.status === "OPEN" ? "text-blue-400" : "text-gray-500"
                      }`}>
                        {trade.status}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
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
