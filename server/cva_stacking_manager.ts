import type { CompositeProfileData, ValueMigrationData } from "@shared/schema";

/**
 * CVA Stacking & Merging System
 * 
 * PRO Course Advanced Concept: Historical CVA Reference Levels
 * 
 * Tracks historical CVAs by migration character and merges similar profiles
 * to create dynamic support/resistance breakout levels.
 * 
 * Key Concept: When multiple CVAs with similar characteristics stack at 
 * similar price levels, those become high-probability breakout zones.
 */

export type CVACharacter = 
  | "BULLISH_MIGRATION"    // CVA migrating higher (building value above)
  | "BEARISH_MIGRATION"    // CVA migrating lower (building value below)
  | "BALANCED_ROTATION"    // CVA stable, price rotating around it
  | "BREAKOUT_PENDING";    // Price at CVA edge, testing for continuation

export interface HistoricalCVA {
  date: string;              // Trading date
  poc: number;               // Composite POC
  vah: number;               // Composite VAH
  val: number;               // Composite VAL
  character: CVACharacter;   // Migration character at end of day
  days_included: number;     // How many days went into this CVA
  migration_strength: number; // 0-1 score (from ValueMigrationDetector)
}

export interface StackedCVALevel {
  price_level: number;       // Merged price level (POC, VAH, or VAL)
  level_type: "POC" | "VAH" | "VAL";
  character: CVACharacter;   // Dominant character at this level
  occurrences: number;       // How many CVAs stacked here
  dates: string[];           // Dates of stacked CVAs
  strength: number;          // 0-1 confidence (more occurrences = higher)
  last_seen: string;         // Most recent date
}

export class CVAStackingManager {
  private historicalCVAs: HistoricalCVA[] = [];
  private stackedLevels: StackedCVALevel[] = [];
  private maxHistory: number;
  private priceToleranceTicks: number; // How close prices must be to "stack"
  private tickSize: number;
  
  constructor(
    maxHistory: number = 30,      // Keep 30 days of CVA history
    priceToleranceTicks: number = 2, // Within 2 ticks (0.50 ES points)
    tickSize: number = 0.25
  ) {
    this.maxHistory = maxHistory;
    this.priceToleranceTicks = priceToleranceTicks;
    this.tickSize = tickSize;
  }
  
  /**
   * Add a completed day's CVA to history
   */
  addHistoricalCVA(
    date: string,
    cva: CompositeProfileData,
    migration: ValueMigrationData | null
  ): void {
    // Determine CVA character from migration data
    const character = this.determineCVACharacter(migration);
    
    const historicalCVA: HistoricalCVA = {
      date,
      poc: cva.composite_poc,
      vah: cva.composite_vah,
      val: cva.composite_val,
      character,
      days_included: cva.days_included,
      migration_strength: migration?.migration_strength || 0,
    };
    
    this.historicalCVAs.push(historicalCVA);
    
    // Sort by date (newest first)
    this.historicalCVAs.sort((a, b) => b.date.localeCompare(a.date));
    
    // Trim to max history
    if (this.historicalCVAs.length > this.maxHistory) {
      this.historicalCVAs = this.historicalCVAs.slice(0, this.maxHistory);
    }
    
    // Rebuild stacked levels
    this.rebuildStackedLevels();
  }
  
  /**
   * Determine CVA character from migration data
   */
  private determineCVACharacter(migration: ValueMigrationData | null): CVACharacter {
    if (!migration) {
      return "BALANCED_ROTATION";
    }
    
    // Map migration type to CVA character
    const migrationType = migration.migration_type;
    
    if (migrationType === "BULLISH_MIGRATION") {
      return "BULLISH_MIGRATION";
    } else if (migrationType === "BEARISH_MIGRATION") {
      return "BEARISH_MIGRATION";
    } else if (migrationType === "NEUTRAL_OVERLAP") {
      return "BALANCED_ROTATION";
    } else if (migrationType === "BREAKOUT_PENDING") {
      return "BREAKOUT_PENDING";
    } else {
      return "BALANCED_ROTATION";
    }
  }
  
  /**
   * Rebuild stacked levels from historical CVAs
   */
  private rebuildStackedLevels(): void {
    this.stackedLevels = [];
    
    // For each historical CVA, extract POC, VAH, VAL
    const allLevels: Array<{
      price: number;
      type: "POC" | "VAH" | "VAL";
      character: CVACharacter;
      date: string;
    }> = [];
    
    for (const cva of this.historicalCVAs) {
      allLevels.push(
        { price: cva.poc, type: "POC", character: cva.character, date: cva.date },
        { price: cva.vah, type: "VAH", character: cva.character, date: cva.date },
        { price: cva.val, type: "VAL", character: cva.character, date: cva.date }
      );
    }
    
    // Group levels that are within price tolerance
    const tolerance = this.priceToleranceTicks * this.tickSize;
    const processedIndices = new Set<number>();
    
    for (let i = 0; i < allLevels.length; i++) {
      if (processedIndices.has(i)) continue;
      
      const baseLevel = allLevels[i];
      const stackedGroup: typeof allLevels = [baseLevel];
      processedIndices.add(i);
      
      // Find all levels within tolerance
      for (let j = i + 1; j < allLevels.length; j++) {
        if (processedIndices.has(j)) continue;
        
        const compareLevel = allLevels[j];
        if (Math.abs(compareLevel.price - baseLevel.price) <= tolerance) {
          stackedGroup.push(compareLevel);
          processedIndices.add(j);
        }
      }
      
      // If we have 2+ stacked levels, create a merged level
      if (stackedGroup.length >= 2) {
        // Average the prices
        const avgPrice = stackedGroup.reduce((sum, l) => sum + l.price, 0) / stackedGroup.length;
        
        // Determine dominant character (most frequent)
        const characterCounts = new Map<CVACharacter, number>();
        for (const level of stackedGroup) {
          characterCounts.set(level.character, (characterCounts.get(level.character) || 0) + 1);
        }
        
        let dominantCharacter: CVACharacter = "BALANCED_ROTATION";
        let maxCount = 0;
        for (const [char, count] of Array.from(characterCounts.entries())) {
          if (count > maxCount) {
            maxCount = count;
            dominantCharacter = char;
          }
        }
        
        // Determine dominant level type
        const typeCounts = new Map<"POC" | "VAH" | "VAL", number>();
        for (const level of stackedGroup) {
          typeCounts.set(level.type, (typeCounts.get(level.type) || 0) + 1);
        }
        
        let dominantType: "POC" | "VAH" | "VAL" = "POC";
        let maxTypeCount = 0;
        for (const [type, count] of Array.from(typeCounts.entries())) {
          if (count > maxTypeCount) {
            maxTypeCount = count;
            dominantType = type;
          }
        }
        
        // Calculate strength (more occurrences = stronger)
        const strength = Math.min(stackedGroup.length / 5, 1.0); // Cap at 5+ occurrences
        
        // Get dates
        const dates = stackedGroup.map(l => l.date).sort((a, b) => b.localeCompare(a));
        
        this.stackedLevels.push({
          price_level: avgPrice,
          level_type: dominantType,
          character: dominantCharacter,
          occurrences: stackedGroup.length,
          dates,
          strength,
          last_seen: dates[0],
        });
      }
    }
    
    // Sort stacked levels by strength (strongest first)
    this.stackedLevels.sort((a, b) => b.strength - a.strength);
  }
  
  /**
   * Get stacked levels (for breakout trading)
   */
  getStackedLevels(): StackedCVALevel[] {
    return [...this.stackedLevels];
  }
  
  /**
   * Get stacked levels near a specific price
   */
  getStackedLevelsNearPrice(price: number, range: number = 10): StackedCVALevel[] {
    return this.stackedLevels.filter(
      level => Math.abs(level.price_level - price) <= range
    );
  }
  
  /**
   * Get historical CVAs
   */
  getHistoricalCVAs(limit?: number): HistoricalCVA[] {
    if (limit) {
      return this.historicalCVAs.slice(0, limit);
    }
    return [...this.historicalCVAs];
  }
  
  /**
   * Clear all history (session reset)
   */
  clear(): void {
    this.historicalCVAs = [];
    this.stackedLevels = [];
  }
}
