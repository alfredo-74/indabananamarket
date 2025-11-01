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

export const sessionTypeSchema = z.enum([
  "ETH", // Extended Trading Hours (6 PM - 9:30 AM ET)
  "RTH", // Regular Trading Hours (9:30 AM - 4 PM ET)
]);

export const sessionStatsSchema = z.object({
  current_session: sessionTypeSchema,
  session_start_time: z.number(),
  next_session_time: z.number(),
  eth_cumulative_delta: z.number(),
  rth_cumulative_delta: z.number(),
  eth_regime: regimeStateSchema.nullable(),
  rth_regime: regimeStateSchema.nullable(),
});

export const keyLevelsSchema = z.object({
  previous_day_high: z.number().nullable(),
  previous_day_low: z.number().nullable(),
  previous_day_close: z.number().nullable(),
  previous_day_vwap: z.number().nullable(),
  swing_high: z.number().nullable(),
  swing_low: z.number().nullable(),
  volume_poc: z.number().nullable(), // Point of Control - highest volume price
  last_updated: z.number(),
});

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
  // Order Flow Signals
  orderflow_signal: z.string().optional(), // Main reason for trade (e.g., "Absorption + DOM imbalance")
  confidence: z.number().optional(), // Confidence level 0-100
  absorption_event: z.string().optional(), // e.g., "Buy absorption 2.5:1 @ 6000"
  dom_signal: z.string().optional(), // e.g., "Bid stack 3:1"
  tape_signal: z.string().optional(), // e.g., "Buy pressure 2:1"
  profile_context: z.string().optional(), // e.g., "Near POC @ 6005"
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
  symbol: z.string(),
  
  // Order Flow Settings
  absorption_threshold: z.number(), // Min absorption ratio
  absorption_lookback: z.number(), // Minutes
  dom_imbalance_threshold: z.number(), // Min bid/ask ratio
  dom_depth_levels: z.number(), // Price levels to analyze
  tape_volume_threshold: z.number(), // Large order size
  tape_ratio_threshold: z.number(), // Buy/sell ratio
  tape_lookback_seconds: z.number(), // Seconds
  use_poc_magnet: z.boolean(),
  use_vah_val_boundaries: z.boolean(),
  stop_loss_ticks: z.number(),
  take_profit_ticks: z.number(),
  min_confidence: z.number(), // Min confidence %
  
  // Legacy (deprecated but kept for compatibility)
  volume_target: z.number().optional(),
  cd_threshold: z.number().optional(),
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

export const sessionPerformanceSchema = z.object({
  session_type: sessionTypeSchema,
  total_trades: z.number(),
  winning_trades: z.number(),
  losing_trades: z.number(),
  win_rate: z.number(),
  total_pnl: z.number(),
  avg_trade_pnl: z.number(),
  largest_win: z.number(),
  largest_loss: z.number(),
});

export const regimePerformanceSchema = z.object({
  regime: regimeStateSchema,
  total_trades: z.number(),
  winning_trades: z.number(),
  losing_trades: z.number(),
  win_rate: z.number(),
  total_pnl: z.number(),
  avg_trade_pnl: z.number(),
  largest_win: z.number(),
  largest_loss: z.number(),
});

export const accountAnalysisSchema = z.object({
  // Overall Performance
  starting_capital: z.number(),
  current_capital: z.number(),
  total_pnl: z.number(),
  roi_percent: z.number(),
  
  // Trade Statistics
  total_trades: z.number(),
  winning_trades: z.number(),
  losing_trades: z.number(),
  win_rate: z.number(),
  profit_factor: z.number(),
  avg_win: z.number(),
  avg_loss: z.number(),
  largest_win: z.number(),
  largest_loss: z.number(),
  
  // Risk Metrics
  max_drawdown: z.number(),
  max_drawdown_percent: z.number(),
  sharpe_ratio: z.number().nullable(),
  
  // Session Breakdown
  eth_performance: sessionPerformanceSchema,
  rth_performance: sessionPerformanceSchema,
  
  // Regime Breakdown
  regime_performance: z.array(regimePerformanceSchema),
  
  // Time Period
  period_start: z.number(),
  period_end: z.number(),
  trading_days: z.number(),
});

// Order Flow Analysis Schemas (Foundation Course)

export const timeAndSalesEntrySchema = z.object({
  timestamp: z.number(),
  price: z.number(),
  volume: z.number(),
  side: z.enum(["BUY", "SELL"]), // BUY = aggressor bought at ask, SELL = aggressor sold at bid
});

export const domLevelSchema = z.object({
  price: z.number(),
  bid_size: z.number(), // Passive buy orders at this level
  ask_size: z.number(), // Passive sell orders at this level
  bid_orders: z.number(), // Number of bid orders
  ask_orders: z.number(), // Number of ask orders
});

export const domSnapshotSchema = z.object({
  timestamp: z.number(),
  levels: z.array(domLevelSchema),
  best_bid: z.number(),
  best_ask: z.number(),
  spread: z.number(),
});

export const volumeProfileLevelSchema = z.object({
  price: z.number(),
  total_volume: z.number(),
  buy_volume: z.number(),
  sell_volume: z.number(),
  delta: z.number(), // buy_volume - sell_volume
  tpo_count: z.number().optional(), // Time Price Opportunity count (30-min periods)
});

export const volumeProfileSchema = z.object({
  levels: z.array(volumeProfileLevelSchema),
  poc: z.number(), // Point of Control - price with highest volume
  vah: z.number(), // Value Area High (70% volume upper bound)
  val: z.number(), // Value Area Low (70% volume lower bound)
  total_volume: z.number(),
  profile_type: z.enum(["P", "b", "D", "DOUBLE"]).nullable(), // P=trending up, b=trending down, D=balanced, DOUBLE=two distributions
  hvn_levels: z.array(z.number()), // High Volume Nodes
  lvn_levels: z.array(z.number()), // Low Volume Nodes
  period_start: z.number(),
  period_end: z.number(),
});

// Footprint Analysis Schemas (PRO Course Stage 3 - Order Flow)

export const footprintPriceLevelSchema = z.object({
  price: z.number(),
  bid_volume: z.number(),   // Volume traded at bid (sellers)
  ask_volume: z.number(),   // Volume traded at ask (buyers)
  delta: z.number(),        // ask_volume - bid_volume
  total_volume: z.number(),
  imbalance_ratio: z.number(), // Ratio of dominant side to weaker side
  imbalanced: z.boolean(),     // True if ratio >= 2:1
});

export const footprintBarSchema = z.object({
  start_time: z.number(),
  end_time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  
  // Footprint-specific data
  price_levels: z.array(footprintPriceLevelSchema),
  total_bid_volume: z.number(),
  total_ask_volume: z.number(),
  bar_delta: z.number(),  // Total ask_volume - bid_volume for entire bar
  poc_price: z.number(),  // Point of Control - price with highest volume
  
  // Imbalance detection
  stacked_buying: z.boolean(),  // 3+ consecutive levels with ask dominance
  stacked_selling: z.boolean(), // 3+ consecutive levels with bid dominance
  imbalance_count: z.number(),  // Number of imbalanced levels
  
  // Delta statistics
  max_positive_delta: z.number(), // Strongest buying level
  max_negative_delta: z.number(), // Strongest selling level
  delta_at_poc: z.number(),       // Delta at POC (indicates if POC was buying or selling)
});

export const absorptionEventSchema = z.object({
  timestamp: z.number(),
  price: z.number(),
  aggressive_volume: z.number(), // Volume of aggressive orders
  passive_volume: z.number(), // Volume absorbed by passive orders
  ratio: z.number(), // aggressive / passive
  side: z.enum(["BUY_ABSORPTION", "SELL_ABSORPTION"]), // Which side absorbed
  price_change: z.number(), // Price movement despite absorption
});

export const discordLevelSchema = z.object({
  price: z.number(),
  type: z.enum(["SUPPORT", "RESISTANCE", "PIVOT"]),
  strength: z.number(), // 1-5, where 5 is strongest (monthly/weekly)
  timeframe: z.enum(["MONTHLY", "WEEKLY", "DAILY", "INTRADAY"]),
  description: z.string().optional(),
});

// G7FX PRO Course Schemas (Advanced Context & Order Flow)

export const compositeProfileDataSchema = z.object({
  composite_vah: z.number(),
  composite_val: z.number(),
  composite_poc: z.number(),
  total_volume: z.number(),
  days_included: z.number(),
  oldest_day: z.number(),
  newest_day: z.number(),
  profile_shape: z.enum(["P", "b", "D", "DOUBLE"]).nullable(),
});

export const valueMigrationDataSchema = z.object({
  migration_type: z.enum([
    "BULLISH_MIGRATION",
    "BEARISH_MIGRATION",
    "NEUTRAL_OVERLAP",
    "BREAKOUT_PENDING",
    "UNKNOWN",
  ]),
  dva_position: z.enum(["ABOVE_CVA", "BELOW_CVA", "OVERLAPPING", "UNKNOWN"]),
  overlap_percentage: z.number(),
  dva_vah: z.number(),
  dva_val: z.number(),
  dva_poc: z.number(),
  cva_vah: z.number(),
  cva_val: z.number(),
  cva_poc: z.number(),
  value_range_pct: z.number(),
  migration_strength: z.number(),
  description: z.string(),
});

// CVA Stacking System (PRO Course - Historical CVA Reference Levels)

export const cvaCharacterSchema = z.enum([
  "BULLISH_MIGRATION",
  "BEARISH_MIGRATION",
  "BALANCED_ROTATION",
  "BREAKOUT_PENDING",
]);

export const historicalCVASchema = z.object({
  date: z.string(),
  poc: z.number(),
  vah: z.number(),
  val: z.number(),
  character: cvaCharacterSchema,
  days_included: z.number(),
  migration_strength: z.number(),
});

export const stackedCVALevelSchema = z.object({
  price_level: z.number(),
  level_type: z.enum(["POC", "VAH", "VAL"]),
  character: cvaCharacterSchema,
  occurrences: z.number(),
  dates: z.array(z.string()),
  strength: z.number(),
  last_seen: z.string(),
});

export const marketConditionSchema = z.enum([
  "TREND_UP",
  "TREND_DOWN",
  "BALANCE",
  "BREAKOUT_PENDING",
  "OPENING_DRIVE",
  "UNKNOWN",
]);

export const dailyHypothesisSchema = z.object({
  condition: marketConditionSchema,
  confidence: z.number(),
  bias: z.enum(["BULLISH", "BEARISH", "NEUTRAL"]),
  primary_strategy: z.string(),
  key_levels: z.object({
    resistance_1: z.number(),
    resistance_2: z.number(),
    support_1: z.number(),
    support_2: z.number(),
    pivot: z.number(),
  }),
  expected_behavior: z.string(),
  trade_plan: z.string(),
  invalidation_criteria: z.string(),
});

export const orderFlowSignalSchema = z.object({
  signal_type: z.enum([
    "LACK_OF_PARTICIPATION",
    "STACKED_IMBALANCE",
    "TRAPPED_TRADERS",
    "INITIATIVE_BUYING",
    "INITIATIVE_SELLING",
    "RESPONSIVE_BUYING",
    "RESPONSIVE_SELLING",
    "EXHAUSTION_BULL",
    "EXHAUSTION_BEAR",
    "ABSORPTION_BUY",
    "ABSORPTION_SELL",
  ]),
  timestamp: z.number(),
  price: z.number(),
  strength: z.number(),
  direction: z.enum(["BULLISH", "BEARISH", "NEUTRAL"]),
  description: z.string(),
  confidence: z.number(),
  actionable: z.boolean(),
});

export const tradeRecommendationSchema = z.object({
  setup_type: z.enum([
    "VA_FADE_LONG",
    "VA_FADE_SHORT",
    "VA_BREAKOUT_LONG",
    "VA_BREAKOUT_SHORT",
    "VWAP_BOUNCE_LONG",
    "VWAP_BOUNCE_SHORT",
    "RULE_80_LONG",
    "RULE_80_SHORT",
    "OPENING_DRIVE_LONG",
    "OPENING_DRIVE_SHORT",
  ]),
  direction: z.enum(["LONG", "SHORT"]),
  entry_price: z.number(),
  stop_loss: z.number(),
  target_1: z.number(),
  target_2: z.number(),
  confidence: z.number(),
  risk_reward_ratio: z.number(),
  context_reason: z.string(),
  orderflow_confirmation: z.string(),
  invalidation_criteria: z.string(),
  timestamp: z.number(),
  active: z.boolean(),
});

export type VolumetricCandle = z.infer<typeof volumetricCandleSchema>;
export type VWAPData = z.infer<typeof vwapDataSchema>;
export type RegimeState = z.infer<typeof regimeStateSchema>;
export type SessionType = z.infer<typeof sessionTypeSchema>;
export type SessionStats = z.infer<typeof sessionStatsSchema>;
export type KeyLevels = z.infer<typeof keyLevelsSchema>;
export type Position = z.infer<typeof positionSchema>;
export type Trade = z.infer<typeof tradeSchema>;
export type MarketData = z.infer<typeof marketDataSchema>;
export type SystemStatus = z.infer<typeof systemStatusSchema>;
export type ControlSettings = z.infer<typeof controlSettingsSchema>;
export type BacktestParameters = z.infer<typeof backtestParametersSchema>;
export type BacktestMetrics = z.infer<typeof backtestMetricsSchema>;
export type BacktestResult = z.infer<typeof backtestResultSchema>;
export type SessionPerformance = z.infer<typeof sessionPerformanceSchema>;
export type RegimePerformance = z.infer<typeof regimePerformanceSchema>;
export type AccountAnalysis = z.infer<typeof accountAnalysisSchema>;
export type TimeAndSalesEntry = z.infer<typeof timeAndSalesEntrySchema>;
export type DomLevel = z.infer<typeof domLevelSchema>;
export type DomSnapshot = z.infer<typeof domSnapshotSchema>;
export type VolumeProfileLevel = z.infer<typeof volumeProfileLevelSchema>;
export type VolumeProfile = z.infer<typeof volumeProfileSchema>;
export type FootprintPriceLevel = z.infer<typeof footprintPriceLevelSchema>;
export type FootprintBar = z.infer<typeof footprintBarSchema>;
export type AbsorptionEvent = z.infer<typeof absorptionEventSchema>;
export type DiscordLevel = z.infer<typeof discordLevelSchema>;
export type CompositeProfileData = z.infer<typeof compositeProfileDataSchema>;
export type ValueMigrationData = z.infer<typeof valueMigrationDataSchema>;
export type CVACharacter = z.infer<typeof cvaCharacterSchema>;
export type HistoricalCVA = z.infer<typeof historicalCVASchema>;
export type StackedCVALevel = z.infer<typeof stackedCVALevelSchema>;
export type MarketCondition = z.infer<typeof marketConditionSchema>;
export type DailyHypothesis = z.infer<typeof dailyHypothesisSchema>;
export type OrderFlowSignal = z.infer<typeof orderFlowSignalSchema>;
export type TradeRecommendation = z.infer<typeof tradeRecommendationSchema>;

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
  z.object({
    type: z.literal("session_update"),
    data: sessionStatsSchema,
  }),
  z.object({
    type: z.literal("key_levels_update"),
    data: keyLevelsSchema,
  }),
  z.object({
    type: z.literal("time_and_sales"),
    data: timeAndSalesEntrySchema,
  }),
  z.object({
    type: z.literal("dom_update"),
    data: domSnapshotSchema,
  }),
  z.object({
    type: z.literal("volume_profile_update"),
    data: volumeProfileSchema,
  }),
  z.object({
    type: z.literal("absorption_detected"),
    data: absorptionEventSchema,
  }),
  z.object({
    type: z.literal("composite_profile_update"),
    data: compositeProfileDataSchema,
  }),
  z.object({
    type: z.literal("value_migration_update"),
    data: valueMigrationDataSchema,
  }),
  z.object({
    type: z.literal("daily_hypothesis_update"),
    data: dailyHypothesisSchema,
  }),
  z.object({
    type: z.literal("orderflow_signal"),
    data: orderFlowSignalSchema,
  }),
  z.object({
    type: z.literal("footprint_update"),
    data: footprintBarSchema,
  }),
]);

export type WebSocketMessage = z.infer<typeof webSocketMessageSchema>;
