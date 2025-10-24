import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { WebSocketMessage } from "@shared/schema";

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case "candle_update":
              queryClient.invalidateQueries({ queryKey: ["/api/candles"] });
              break;

            case "market_data":
              queryClient.setQueryData(["/api/market-data"], message.data);
              break;

            case "vwap_update":
              queryClient.setQueryData(["/api/vwap"], message.data);
              break;

            case "regime_change":
              queryClient.setQueryData(["/api/regime"], message.data);
              break;

            case "position_update":
              queryClient.setQueryData(["/api/position"], message.data);
              break;

            case "trade_executed":
              queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
              break;

            case "system_status":
              queryClient.setQueryData(["/api/status"], message.data);
              break;
          }
        } catch (error) {
          console.error("WebSocket message parse error:", error);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("Attempting to reconnect WebSocket...");
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        ws.close();
      };

      wsRef.current = ws;
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [queryClient]);

  return { isConnected };
}
