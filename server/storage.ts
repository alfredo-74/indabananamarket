import type {
  VolumetricCandle,
  VWAPData,
  RegimeState,
  Position,
  Trade,
  MarketData,
  SystemStatus,
  SessionStats,
  KeyLevels,
  TimeAndSalesEntry,
  DomSnapshot,
  VolumeProfile,
  AbsorptionEvent,
  DiscordLevel,
  FootprintBar,
  InsertDailyProfile,
  InsertCompositeProfile,
  InsertHistoricalCVA,
  OrderTrackingDB,
  RejectedOrderDB,
  SafetyConfigDB,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { 
  dailyProfiles, 
  compositeProfiles, 
  historicalCVAs,
  positions,
  trades,
  systemStatus,
  marketData,
  orderTracking,
  rejectedOrders,
  safetyConfig,
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  getCandles(): Promise<VolumetricCandle[]>;
  addCandle(candle: VolumetricCandle): Promise<void>;
  getLatestCandle(): Promise<VolumetricCandle | undefined>;
  
  getVWAPData(): Promise<VWAPData | undefined>;
  setVWAPData(vwap: VWAPData): Promise<void>;
  
  getRegime(): Promise<{ regime: RegimeState; cumulative_delta: number } | undefined>;
  setRegime(regime: RegimeState, cumulativeDelta: number): Promise<void>;
  
  getPosition(): Promise<Position | undefined>;
  setPosition(position: Position): Promise<void>;
  
  getTrades(): Promise<Trade[]>;
  addTrade(trade: Omit<Trade, "id">): Promise<Trade>;
  updateTrade(id: string, updates: Partial<Trade>): Promise<Trade | undefined>;
  
  getMarketData(): Promise<MarketData | undefined>;
  setMarketData(data: MarketData): Promise<void>;
  
  getSystemStatus(): Promise<SystemStatus | undefined>;
  setSystemStatus(status: SystemStatus): Promise<void>;
  
  getSessionStats(): Promise<SessionStats | undefined>;
  setSessionStats(stats: SessionStats): Promise<void>;
  
  getKeyLevels(): Promise<KeyLevels | undefined>;
  setKeyLevels(levels: KeyLevels): Promise<void>;
  
  getPreviousDayCandles(): Promise<VolumetricCandle[]>;
  setPreviousDayCandles(candles: VolumetricCandle[]): Promise<void>;
  
  getStartingCapital(): Promise<number>;
  setStartingCapital(capital: number): Promise<void>;
  
  getHistoricalBars(): Promise<VolumetricCandle[]>;
  setHistoricalBars(bars: VolumetricCandle[]): Promise<void>;
  
  // Order Flow Analysis
  getTimeAndSales(limit?: number): Promise<TimeAndSalesEntry[]>;
  addTimeAndSalesEntry(entry: TimeAndSalesEntry): Promise<void>;
  
  getDomSnapshot(): Promise<DomSnapshot | undefined>;
  setDomSnapshot(snapshot: DomSnapshot): Promise<void>;
  
  getVolumeProfile(): Promise<VolumeProfile | undefined>;
  setVolumeProfile(profile: VolumeProfile): Promise<void>;
  
  getAbsorptionEvents(limit?: number): Promise<AbsorptionEvent[]>;
  addAbsorptionEvent(event: AbsorptionEvent): Promise<void>;
  
  getDiscordLevels(): Promise<DiscordLevel[]>;
  setDiscordLevels(levels: DiscordLevel[]): Promise<void>;
  
  // Daily Volume Profiles (for CVA composition)
  getDailyProfiles(): Promise<Array<{ date: string; profile: VolumeProfile }>>;
  addDailyProfile(date: string, profile: VolumeProfile): Promise<void>;
  
  // Footprint Analysis (PRO Course Stage 3)
  getFootprintBars(limit?: number): Promise<FootprintBar[]>;
  addFootprintBar(bar: FootprintBar): Promise<void>;
  getLatestFootprintBar(): Promise<FootprintBar | undefined>;
  
  // Production Safety (Order Tracking, Reject Replay, Trading Fence)
  trackOrder(orderId: string, signal: any, timestamp: number): Promise<void>;
  updateOrderStatus(orderId: string, status: string, filledPrice?: number, filledTime?: number, rejectReason?: string): Promise<void>;
  getOrderTracking(orderId: string): Promise<any | undefined>;
  getPendingOrders(): Promise<any[]>;
  
  addRejectedOrder(orderId: string, signal: any, rejectReason: string, rejectTime: number): Promise<void>;
  getRecentRejections(minutesAgo: number): Promise<any[]>;
  
  getSafetyConfig(): Promise<any | undefined>;
  updateSafetyConfig(updates: Partial<any>): Promise<void>;
}

export class MemStorage implements IStorage {
  private candles: VolumetricCandle[] = [];
  private vwapData: VWAPData | undefined;
  private regime: { regime: RegimeState; cumulative_delta: number } | undefined;
  private position: Position | undefined;
  private trades: Map<string, Trade> = new Map();
  private marketData: MarketData | undefined;
  private systemStatus: SystemStatus | undefined;
  private sessionStats: SessionStats | undefined;
  private keyLevels: KeyLevels | undefined;
  private previousDayCandles: VolumetricCandle[] = [];
  private startingCapital: number = 2000; // Default starting capital
  private historicalBars: VolumetricCandle[] = [];
  
  // Order Flow Analysis
  private timeAndSales: TimeAndSalesEntry[] = [];
  private domSnapshot: DomSnapshot | undefined;
  private volumeProfile: VolumeProfile | undefined;
  private absorptionEvents: AbsorptionEvent[] = [];
  private discordLevels: DiscordLevel[] = [];
  private dailyProfiles: Array<{ date: string; profile: VolumeProfile }> = [];
  private footprintBars: FootprintBar[] = [];

  async getCandles(): Promise<VolumetricCandle[]> {
    return this.candles;
  }

  async addCandle(candle: VolumetricCandle): Promise<void> {
    this.candles.push(candle);
    if (this.candles.length > 100) {
      this.candles = this.candles.slice(-100);
    }
  }

  async getLatestCandle(): Promise<VolumetricCandle | undefined> {
    return this.candles[this.candles.length - 1];
  }

  async getVWAPData(): Promise<VWAPData | undefined> {
    return this.vwapData;
  }

  async setVWAPData(vwap: VWAPData): Promise<void> {
    this.vwapData = vwap;
  }

  async getRegime(): Promise<{ regime: RegimeState; cumulative_delta: number } | undefined> {
    return this.regime;
  }

  async setRegime(regime: RegimeState, cumulativeDelta: number): Promise<void> {
    this.regime = { regime, cumulative_delta: cumulativeDelta };
  }

  async getPosition(): Promise<Position | undefined> {
    return this.position;
  }

  async setPosition(position: Position): Promise<void> {
    this.position = position;
  }

  async getTrades(): Promise<Trade[]> {
    return Array.from(this.trades.values());
  }

  async addTrade(trade: Omit<Trade, "id">): Promise<Trade> {
    const id = randomUUID();
    const newTrade: Trade = { ...trade, id };
    this.trades.set(id, newTrade);
    return newTrade;
  }

  async updateTrade(id: string, updates: Partial<Trade>): Promise<Trade | undefined> {
    const trade = this.trades.get(id);
    if (!trade) return undefined;
    const updated = { ...trade, ...updates };
    this.trades.set(id, updated);
    return updated;
  }

  async getMarketData(): Promise<MarketData | undefined> {
    return this.marketData;
  }

  async setMarketData(data: MarketData): Promise<void> {
    this.marketData = data;
  }

  async getSystemStatus(): Promise<SystemStatus | undefined> {
    return this.systemStatus;
  }

  async setSystemStatus(status: SystemStatus): Promise<void> {
    this.systemStatus = status;
  }

  async getSessionStats(): Promise<SessionStats | undefined> {
    return this.sessionStats;
  }

  async setSessionStats(stats: SessionStats): Promise<void> {
    this.sessionStats = stats;
  }

  async getKeyLevels(): Promise<KeyLevels | undefined> {
    return this.keyLevels;
  }

  async setKeyLevels(levels: KeyLevels): Promise<void> {
    this.keyLevels = levels;
  }

  async getPreviousDayCandles(): Promise<VolumetricCandle[]> {
    return this.previousDayCandles;
  }

  async setPreviousDayCandles(candles: VolumetricCandle[]): Promise<void> {
    this.previousDayCandles = candles;
  }

  async getStartingCapital(): Promise<number> {
    return this.startingCapital;
  }

  async setStartingCapital(capital: number): Promise<void> {
    this.startingCapital = capital;
  }

  async getHistoricalBars(): Promise<VolumetricCandle[]> {
    return this.historicalBars;
  }

  async setHistoricalBars(bars: VolumetricCandle[]): Promise<void> {
    this.historicalBars = bars;
  }

  // Order Flow Analysis Methods
  
  async getTimeAndSales(limit: number = 500): Promise<TimeAndSalesEntry[]> {
    const allEntries = this.timeAndSales;
    return allEntries.slice(-limit); // Return most recent entries
  }

  async addTimeAndSalesEntry(entry: TimeAndSalesEntry): Promise<void> {
    this.timeAndSales.push(entry);
    // Keep only last 1000 entries in memory
    if (this.timeAndSales.length > 1000) {
      this.timeAndSales = this.timeAndSales.slice(-1000);
    }
  }

  async getDomSnapshot(): Promise<DomSnapshot | undefined> {
    return this.domSnapshot;
  }

  async setDomSnapshot(snapshot: DomSnapshot): Promise<void> {
    this.domSnapshot = snapshot;
  }

  async getVolumeProfile(): Promise<VolumeProfile | undefined> {
    return this.volumeProfile;
  }

  async setVolumeProfile(profile: VolumeProfile): Promise<void> {
    this.volumeProfile = profile;
  }

  async getAbsorptionEvents(limit: number = 100): Promise<AbsorptionEvent[]> {
    const allEvents = this.absorptionEvents;
    return allEvents.slice(-limit); // Return most recent events
  }

  async addAbsorptionEvent(event: AbsorptionEvent): Promise<void> {
    this.absorptionEvents.push(event);
    // Keep only last 200 events in memory
    if (this.absorptionEvents.length > 200) {
      this.absorptionEvents = this.absorptionEvents.slice(-200);
    }
  }

  async getDiscordLevels(): Promise<DiscordLevel[]> {
    return this.discordLevels;
  }

  async setDiscordLevels(levels: DiscordLevel[]): Promise<void> {
    this.discordLevels = levels;
  }
  
  async getDailyProfiles(): Promise<Array<{ date: string; profile: VolumeProfile }>> {
    try {
      const dbProfiles = await db.select().from(dailyProfiles).orderBy(desc(dailyProfiles.date)).limit(10);
      return dbProfiles.map(p => ({
        date: p.date,
        profile: p.profile_data
      }));
    } catch (error) {
      console.error("[DB] Failed to load daily profiles, using memory:", error);
      return this.dailyProfiles;
    }
  }
  
  async addDailyProfile(date: string, profile: VolumeProfile): Promise<void> {
    const hvnArray: number[] = Array.from(profile.hvn_levels);
    const lvnArray: number[] = Array.from(profile.lvn_levels);
    
    const insertData: InsertDailyProfile = {
      date,
      poc: profile.poc,
      vah: profile.vah,
      val: profile.val,
      total_volume: profile.total_volume,
      profile_type: profile.profile_type,
      hvn_levels: hvnArray,
      lvn_levels: lvnArray,
      profile_data: profile as any,
    };
    
    try {
      await db.insert(dailyProfiles)
        .values([insertData])
        .onConflictDoUpdate({
          target: dailyProfiles.date,
          set: {
            poc: insertData.poc,
            vah: insertData.vah,
            val: insertData.val,
            total_volume: insertData.total_volume,
            profile_type: insertData.profile_type,
            hvn_levels: hvnArray,
            lvn_levels: lvnArray,
            profile_data: insertData.profile_data || { levels: [], total_volume: 0, poc: 0, vah: 0, val: 0, hvn_levels: [], lvn_levels: [] },
          },
        });
      console.log(`[DB] ✅ Persisted daily profile for ${date}`);
    } catch (error) {
      console.error(`[DB] ⚠️  Failed to persist daily profile for ${date}:`, error);
    }
    
    // Also update memory cache
    const existingIndex = this.dailyProfiles.findIndex(d => d.date === date);
    if (existingIndex !== -1) {
      this.dailyProfiles[existingIndex] = { date, profile };
    } else {
      this.dailyProfiles.push({ date, profile });
    }
    
    // Sort by date (newest first)
    this.dailyProfiles.sort((a, b) => b.date.localeCompare(a.date));
    
    // Keep only last 10 days
    if (this.dailyProfiles.length > 10) {
      this.dailyProfiles = this.dailyProfiles.slice(0, 10);
    }
  }
  
  async getFootprintBars(limit: number = 100): Promise<FootprintBar[]> {
    // CRITICAL: Backfill missing imbalance_direction for legacy data
    return this.footprintBars.slice(-limit).map(bar => ({
      ...bar,
      price_levels: bar.price_levels.map((level: any) => {
        // If level already has imbalance_direction, keep it
        if ('imbalance_direction' in level && level.imbalance_direction) {
          return level;
        }
        // Backfill for legacy data: calculate from delta
        const direction: "BID" | "ASK" | "NEUTRAL" = 
          level.imbalanced 
            ? (level.delta > 0 ? "ASK" : "BID")
            : "NEUTRAL";
        return {
          ...level,
          imbalance_direction: direction,
        };
      }),
    }));
  }
  
  async addFootprintBar(bar: FootprintBar): Promise<void> {
    this.footprintBars.push(bar);
    // Keep only last 100 bars in memory
    if (this.footprintBars.length > 100) {
      this.footprintBars = this.footprintBars.slice(-100);
    }
  }
  
  async getLatestFootprintBar(): Promise<FootprintBar | undefined> {
    return this.footprintBars.length > 0
      ? this.footprintBars[this.footprintBars.length - 1]
      : undefined;
  }
  
  // Production Safety - MUST use database storage (implemented in PgStorage)
  async trackOrder(orderId: string, signal: any, timestamp: number): Promise<void> {
    throw new Error("Production safety requires database storage - use PgStorage");
  }
  
  async updateOrderStatus(orderId: string, status: string, filledPrice?: number, filledTime?: number, rejectReason?: string): Promise<void> {
    throw new Error("Production safety requires database storage - use PgStorage");
  }
  
  async getOrderTracking(orderId: string): Promise<any | undefined> {
    throw new Error("Production safety requires database storage - use PgStorage");
  }
  
  async getPendingOrders(): Promise<any[]> {
    throw new Error("Production safety requires database storage - use PgStorage");
  }
  
  async addRejectedOrder(orderId: string, signal: any, rejectReason: string, rejectTime: number): Promise<void> {
    throw new Error("Production safety requires database storage - use PgStorage");
  }
  
  async getRecentRejections(minutesAgo: number): Promise<any[]> {
    throw new Error("Production safety requires database storage - use PgStorage");
  }
  
  async getSafetyConfig(): Promise<any | undefined> {
    throw new Error("Production safety requires database storage - use PgStorage");
  }
  
  async updateSafetyConfig(updates: Partial<any>): Promise<void> {
    throw new Error("Production safety requires database storage - use PgStorage");
  }
}

// Database-backed storage for critical persistent data
export class PgStorage extends MemStorage {
  async getPosition(): Promise<Position | undefined> {
    const result = await db.select().from(positions).limit(1);
    if (result.length === 0) return undefined;
    
    const row = result[0];
    return {
      contracts: row.contracts,
      entry_price: row.entry_price,
      current_price: row.current_price,
      unrealized_pnl: row.unrealized_pnl,
      realized_pnl: row.realized_pnl,
      side: row.side as "LONG" | "SHORT" | "FLAT",
    };
  }

  async setPosition(position: Position): Promise<void> {
    const existing = await db.select().from(positions).limit(1);
    
    if (existing.length === 0) {
      await db.insert(positions).values({
        contracts: position.contracts,
        entry_price: position.entry_price,
        current_price: position.current_price,
        unrealized_pnl: position.unrealized_pnl,
        realized_pnl: position.realized_pnl,
        side: position.side,
      });
    } else {
      await db.update(positions)
        .set({
          contracts: position.contracts,
          entry_price: position.entry_price,
          current_price: position.current_price,
          unrealized_pnl: position.unrealized_pnl,
          realized_pnl: position.realized_pnl,
          side: position.side,
          updated_at: new Date(),
        })
        .where(eq(positions.id, existing[0].id));
    }
  }

  async getTrades(): Promise<Trade[]> {
    const result = await db.select().from(trades).orderBy(desc(trades.timestamp)).limit(100);
    return result.map(row => ({
      id: row.id,
      timestamp: row.timestamp.getTime(),
      type: row.type as "BUY" | "SELL",
      entry_price: row.entry_price,
      exit_price: row.exit_price,
      contracts: row.contracts,
      pnl: row.pnl,
      duration_ms: row.duration_ms,
      regime: row.regime,
      cumulative_delta: row.cumulative_delta,
      status: row.status as "OPEN" | "CLOSED",
      orderflow_signal: row.orderflow_signal || undefined,
      confidence: row.confidence || undefined,
      absorption_event: row.absorption_event || undefined,
      dom_signal: row.dom_signal || undefined,
      tape_signal: row.tape_signal || undefined,
      profile_context: row.profile_context || undefined,
    }));
  }

  async addTrade(trade: Omit<Trade, "id">): Promise<Trade> {
    const id = randomUUID();
    const newTrade: Trade = { ...trade, id };
    
    await db.insert(trades).values({
      id,
      timestamp: new Date(trade.timestamp),
      type: trade.type,
      entry_price: trade.entry_price,
      exit_price: trade.exit_price,
      contracts: trade.contracts,
      pnl: trade.pnl,
      duration_ms: trade.duration_ms,
      regime: trade.regime,
      cumulative_delta: trade.cumulative_delta,
      status: trade.status,
      orderflow_signal: trade.orderflow_signal,
      confidence: trade.confidence,
      absorption_event: trade.absorption_event,
      dom_signal: trade.dom_signal,
      tape_signal: trade.tape_signal,
      profile_context: trade.profile_context,
    });
    
    return newTrade;
  }

  async getSystemStatus(): Promise<SystemStatus | undefined> {
    const result = await db.select().from(systemStatus).limit(1);
    if (result.length === 0) return undefined;
    
    const row = result[0];
    return {
      ibkr_connected: row.ibkr_connected,
      market_data_active: row.market_data_active,
      auto_trading_enabled: row.auto_trading_enabled,
      last_update: row.last_update.getTime(),
      capital: row.capital,
      daily_pnl: row.daily_pnl,
      account_balance: row.account_balance || undefined,
      account_currency: row.account_currency || 'GBP',
      usd_to_account_rate: row.usd_to_account_rate || 1.0,
      account_type: row.account_type as "PAPER" | "LIVE" | null,
      data_delay_seconds: row.data_delay_seconds || null,
    };
  }

  async setSystemStatus(status: SystemStatus): Promise<void> {
    const existing = await db.select().from(systemStatus).limit(1);
    
    if (existing.length === 0) {
      await db.insert(systemStatus).values({
        ibkr_connected: status.ibkr_connected,
        market_data_active: status.market_data_active,
        auto_trading_enabled: status.auto_trading_enabled,
        last_update: new Date(status.last_update),
        capital: status.capital,
        daily_pnl: status.daily_pnl,
        account_balance: status.account_balance,
        account_currency: status.account_currency || 'GBP',
        usd_to_account_rate: status.usd_to_account_rate || 1.0,
        account_type: status.account_type,
        data_delay_seconds: status.data_delay_seconds,
      });
    } else {
      await db.update(systemStatus)
        .set({
          ibkr_connected: status.ibkr_connected,
          market_data_active: status.market_data_active,
          auto_trading_enabled: status.auto_trading_enabled,
          last_update: new Date(status.last_update),
          capital: status.capital,
          daily_pnl: status.daily_pnl,
          account_balance: status.account_balance,
          account_currency: status.account_currency || 'GBP',
          usd_to_account_rate: status.usd_to_account_rate || 1.0,
          account_type: status.account_type,
          data_delay_seconds: status.data_delay_seconds,
          updated_at: new Date(),
        })
        .where(eq(systemStatus.id, existing[0].id));
    }
  }

  async getMarketData(): Promise<MarketData | undefined> {
    const result = await db.select().from(marketData).limit(1);
    if (result.length === 0) return undefined;
    
    const row = result[0];
    return {
      symbol: row.symbol,
      last_price: row.last_price,
      bid: row.bid,
      ask: row.ask,
      volume: row.volume,
      timestamp: row.timestamp.getTime(),
    };
  }

  async setMarketData(data: MarketData): Promise<void> {
    const existing = await db.select().from(marketData).limit(1);
    
    if (existing.length === 0) {
      await db.insert(marketData).values({
        symbol: data.symbol,
        last_price: data.last_price,
        bid: data.bid,
        ask: data.ask,
        volume: data.volume,
        timestamp: new Date(data.timestamp),
      });
    } else {
      await db.update(marketData)
        .set({
          symbol: data.symbol,
          last_price: data.last_price,
          bid: data.bid,
          ask: data.ask,
          volume: data.volume,
          timestamp: new Date(data.timestamp),
          updated_at: new Date(),
        })
        .where(eq(marketData.id, existing[0].id));
    }
  }
  
  // Production Safety Methods - Database-backed for persistence
  async trackOrder(orderId: string, signal: any, timestamp: number): Promise<void> {
    const signal_id = `${signal.action}_${signal.entry_price.toFixed(2)}_${signal.quantity}`;
    await db.insert(orderTracking).values({
      order_id: orderId,
      signal_id: signal_id,
      action: signal.action,
      quantity: signal.quantity,
      entry_price: signal.entry_price,
      status: 'PENDING',
    });
  }
  
  async updateOrderStatus(orderId: string, status: string, filledPrice?: number, filledTime?: number, rejectReason?: string): Promise<void> {
    await db.update(orderTracking)
      .set({
        status,
        filled_price: filledPrice || null,
        filled_time: filledTime ? new Date(filledTime) : null,
        reject_reason: rejectReason || null,
        updated_at: new Date(),
      })
      .where(eq(orderTracking.order_id, orderId));
  }
  
  async getOrderTracking(orderId: string): Promise<OrderTrackingDB | undefined> {
    const result = await db.select()
      .from(orderTracking)
      .where(eq(orderTracking.order_id, orderId))
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getPendingOrders(): Promise<OrderTrackingDB[]> {
    return await db.select()
      .from(orderTracking)
      .where(eq(orderTracking.status, 'PENDING'));
  }
  
  async addRejectedOrder(orderId: string, signal: any, rejectReason: string, rejectTime: number): Promise<void> {
    const signal_id = `${signal.action}_${signal.entry_price.toFixed(2)}_${signal.quantity}`;
    const expiresAt = new Date(rejectTime + 30 * 60 * 1000); // 30 minutes from now
    await db.insert(rejectedOrders).values({
      signal_id: signal_id,
      reason: rejectReason,
      price: signal.entry_price,
      expires_at: expiresAt,
    });
  }
  
  async getRecentRejections(minutesAgo: number): Promise<RejectedOrderDB[]> {
    const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000);
    return await db.select()
      .from(rejectedOrders)
      .where(sql`${rejectedOrders.timestamp} >= ${cutoffTime}`);
  }
  
  async getSafetyConfig(): Promise<SafetyConfigDB | undefined> {
    const result = await db.select().from(safetyConfig).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }
  
  async updateSafetyConfig(updates: Partial<SafetyConfigDB>): Promise<void> {
    const existing = await db.select().from(safetyConfig).limit(1);
    
    if (existing.length === 0) {
      // Create initial config with defaults
      await db.insert(safetyConfig).values({
        max_drawdown_gbp: updates.max_drawdown_gbp || -500,
        max_position_size: updates.max_position_size || 1,
        trading_fence_enabled: updates.trading_fence_enabled !== undefined ? updates.trading_fence_enabled : true,
        position_reconciliation_enabled: updates.position_reconciliation_enabled !== undefined ? updates.position_reconciliation_enabled : true,
        reject_replay_cooldown_minutes: updates.reject_replay_cooldown_minutes || 30,
        circuit_breaker_enabled: updates.circuit_breaker_enabled !== undefined ? updates.circuit_breaker_enabled : true,
      });
    } else {
      // Update existing config
      await db.update(safetyConfig)
        .set({
          ...updates,
          updated_at: new Date(),
        })
        .where(eq(safetyConfig.id, existing[0].id));
    }
  }
}

// Use database storage for critical persistent data
export const storage = new PgStorage();
