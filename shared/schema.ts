import { z } from "zod";

export const volumetricCandleSchema = z.object({
  timestamp: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  accumulated_volume: z.number(),
  cumulative_delta: z.number(),
  buy_volume: z.number(),
  sell_volume: z.number(),
});

export const vwapDataSchema = z.object({
  vwap: z.number().nullable(),
  sd1_upper: z.number().nullable(),
  sd1_lower: z.number().nullable(),
  sd2_upper: z.number().nullable(),
  sd2_lower: z.number().nullable(),
  sd3_upper: z.number().nullable(),
  sd3_lower: z.number().nullable(),
  lookback_candles: z.number(),
});

export const regimeStateSchema = z.enum([
  "ROTATIONAL",
  "DIRECTIONAL_BULLISH",
  "DIRECTIONAL_BEARISH",
  "TRANSITIONING",
]);

export const positionSchema = z.object({
  contracts: z.number(),
  entry_price: z.number().nullable(),
  current_price: z.number(),
  unrealized_pnl: z.number(),
  realized_pnl: z.number(),
  side: z.enum(["LONG", "SHORT", "FLAT"]),
});

export const tradeSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  type: z.enum(["BUY", "SELL"]),
  entry_price: z.number(),
  exit_price: z.number().nullable(),
  contracts: z.number(),
  pnl: z.number().nullable(),
  duration_ms: z.number().nullable(),
  regime: z.string(),
  cumulative_delta: z.number(),
  status: z.enum(["OPEN", "CLOSED"]),
});

export const marketDataSchema = z.object({
  symbol: z.string(),
  last_price: z.number(),
  bid: z.number(),
  ask: z.number(),
  volume: z.number(),
  timestamp: z.number(),
});

export const systemStatusSchema = z.object({
  ibkr_connected: z.boolean(),
  market_data_active: z.boolean(),
  auto_trading_enabled: z.boolean(),
  last_update: z.number(),
  capital: z.number(),
  daily_pnl: z.number(),
});

export const controlSettingsSchema = z.object({
  auto_trading: z.boolean(),
  volume_target: z.number(),
  cd_threshold: z.number(),
  symbol: z.string(),
});

export type VolumetricCandle = z.infer<typeof volumetricCandleSchema>;
export type VWAPData = z.infer<typeof vwapDataSchema>;
export type RegimeState = z.infer<typeof regimeStateSchema>;
export type Position = z.infer<typeof positionSchema>;
export type Trade = z.infer<typeof tradeSchema>;
export type MarketData = z.infer<typeof marketDataSchema>;
export type SystemStatus = z.infer<typeof systemStatusSchema>;
export type ControlSettings = z.infer<typeof controlSettingsSchema>;

export const webSocketMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("candle_update"),
    data: volumetricCandleSchema,
  }),
  z.object({
    type: z.literal("market_data"),
    data: marketDataSchema,
  }),
  z.object({
    type: z.literal("vwap_update"),
    data: vwapDataSchema,
  }),
  z.object({
    type: z.literal("regime_change"),
    data: z.object({
      regime: regimeStateSchema,
      cumulative_delta: z.number(),
    }),
  }),
  z.object({
    type: z.literal("position_update"),
    data: positionSchema,
  }),
  z.object({
    type: z.literal("trade_executed"),
    data: tradeSchema,
  }),
  z.object({
    type: z.literal("system_status"),
    data: systemStatusSchema,
  }),
]);

export type WebSocketMessage = z.infer<typeof webSocketMessageSchema>;
