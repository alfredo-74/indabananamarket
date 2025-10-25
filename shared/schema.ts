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
  account_currency: z.string(), // Account base currency (GBP, USD, etc.)
  usd_to_account_rate: z.number(), // Exchange rate for USD to account currency
  account_type: z.enum(["PAPER", "LIVE"]).nullable(), // Account type
  data_delay_seconds: z.number().nullable(), // Market data delay in seconds (null = real-time)
});

export const controlSettingsSchema = z.object({
  auto_trading: z.boolean(),
  volume_target: z.number(),
  cd_threshold: z.number(),
  symbol: z.string(),
});

export const backtestParametersSchema = z.object({
  cd_threshold: z.number(),
  vwap_lookback: z.number(),
  num_candles: z.number(), // How many historical candles to test with
  initial_capital: z.number(),
});

export const backtestMetricsSchema = z.object({
  total_trades: z.number(),
  winning_trades: z.number(),
  losing_trades: z.number(),
  win_rate: z.number(),
  gross_pnl: z.number(), // P&L before commissions
  total_commissions: z.number(), // Total commission costs
  total_pnl: z.number(), // Net P&L after commissions
  avg_win: z.number(),
  avg_loss: z.number(),
  profit_factor: z.number(),
  max_drawdown: z.number(),
  sharpe_ratio: z.number().nullable(),
  final_capital: z.number(),
  return_pct: z.number(),
});

export const backtestResultSchema = z.object({
  parameters: backtestParametersSchema,
  metrics: backtestMetricsSchema,
  trades: z.array(tradeSchema),
  equity_curve: z.array(z.object({
    timestamp: z.number(),
    equity: z.number(),
  })),
});

export type VolumetricCandle = z.infer<typeof volumetricCandleSchema>;
export type VWAPData = z.infer<typeof vwapDataSchema>;
export type RegimeState = z.infer<typeof regimeStateSchema>;
export type Position = z.infer<typeof positionSchema>;
export type Trade = z.infer<typeof tradeSchema>;
export type MarketData = z.infer<typeof marketDataSchema>;
export type SystemStatus = z.infer<typeof systemStatusSchema>;
export type ControlSettings = z.infer<typeof controlSettingsSchema>;
export type BacktestParameters = z.infer<typeof backtestParametersSchema>;
export type BacktestMetrics = z.infer<typeof backtestMetricsSchema>;
export type BacktestResult = z.infer<typeof backtestResultSchema>;

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
