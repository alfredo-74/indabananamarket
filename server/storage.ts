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
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { dailyProfiles, compositeProfiles, historicalCVAs } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

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
    const insertData: InsertDailyProfile = {
      date,
      poc: profile.poc,
      vah: profile.vah,
      val: profile.val,
      total_volume: profile.total_volume,
      profile_type: profile.profile_type,
      hvn_levels: [...profile.hvn_levels] as number[],
      lvn_levels: [...profile.lvn_levels] as number[],
      profile_data: profile as any,
    };
    
    try {
      await db.insert(dailyProfiles)
        .values(insertData)
        .onConflictDoUpdate({
          target: dailyProfiles.date,
          set: {
            poc: insertData.poc,
            vah: insertData.vah,
            val: insertData.val,
            total_volume: insertData.total_volume,
            profile_type: insertData.profile_type,
            hvn_levels: insertData.hvn_levels,
            lvn_levels: insertData.lvn_levels,
            profile_data: insertData.profile_data,
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
    return this.footprintBars.slice(-limit);
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
}

export const storage = new MemStorage();
