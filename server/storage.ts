import type {
  VolumetricCandle,
  VWAPData,
  RegimeState,
  Position,
  Trade,
  MarketData,
  SystemStatus,
} from "@shared/schema";
import { randomUUID } from "crypto";

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
}

export class MemStorage implements IStorage {
  private candles: VolumetricCandle[] = [];
  private vwapData: VWAPData | undefined;
  private regime: { regime: RegimeState; cumulative_delta: number } | undefined;
  private position: Position | undefined;
  private trades: Map<string, Trade> = new Map();
  private marketData: MarketData | undefined;
  private systemStatus: SystemStatus | undefined;

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
}

export const storage = new MemStorage();
