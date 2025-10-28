import type { VolumeProfile } from "@shared/schema";
import type { CompositeProfileData } from "./composite_profile";

/**
 * Value Migration Detector
 * 
 * G7FX PRO Course - Stage 2: Intraday Value Dynamics
 * 
 * Monitors how today's Developing Value Area (DVA) migrates relative to:
 * - Composite Value Area (CVA) from 5-day profile
 * - Yesterday's Value Area
 * - VWAP position
 * 
 * Value Migration Patterns:
 * - BULLISH: DVA consistently above CVA, price accepting higher
 * - BEARISH: DVA consistently below CVA, price accepting lower
 * - NEUTRAL: DVA overlapping CVA significantly (>70% overlap)
 * - BREAKOUT_PENDING: Narrow range, coiling for move
 */

export type ValueMigrationType = 
  | "BULLISH_MIGRATION" 
  | "BEARISH_MIGRATION" 
  | "NEUTRAL_OVERLAP" 
  | "BREAKOUT_PENDING"
  | "UNKNOWN";

export interface ValueMigrationData {
  migration_type: ValueMigrationType;
  dva_position: "ABOVE_CVA" | "BELOW_CVA" | "OVERLAPPING" | "UNKNOWN";
  overlap_percentage: number;
  dva_vah: number;
  dva_val: number;
  dva_poc: number;
  cva_vah: number;
  cva_val: number;
  cva_poc: number;
  value_range_pct: number; // DVA range as % of CVA range
  migration_strength: number; // 0-100, how strong the migration is
  description: string;
}

export class ValueMigrationDetector {
  /**
   * Analyze value migration between DVA (today) and CVA (composite)
   * 
   * @param developingProfile - Today's developing value area
   * @param compositeProfile - 5-day composite value area
   * @returns ValueMigrationData with classification and metrics
   */
  detectMigration(
    developingProfile: VolumeProfile | null,
    compositeProfile: CompositeProfileData | null
  ): ValueMigrationData {
    // Default response if missing data
    if (!developingProfile || !compositeProfile) {
      return {
        migration_type: "UNKNOWN",
        dva_position: "UNKNOWN",
        overlap_percentage: 0,
        dva_vah: 0,
        dva_val: 0,
        dva_poc: 0,
        cva_vah: 0,
        cva_val: 0,
        cva_poc: 0,
        value_range_pct: 0,
        migration_strength: 0,
        description: "Insufficient data for value migration analysis",
      };
    }

    const dvaVah = developingProfile.vah;
    const dvaVal = developingProfile.val;
    const dvaPoc = developingProfile.poc;
    const cvaVah = compositeProfile.composite_vah;
    const cvaVal = compositeProfile.composite_val;
    const cvaPoc = compositeProfile.composite_poc;

    // Calculate overlap
    const overlapHigh = Math.min(dvaVah, cvaVah);
    const overlapLow = Math.max(dvaVal, cvaVal);
    const overlapRange = Math.max(0, overlapHigh - overlapLow);
    const dvaRange = dvaVah - dvaVal;
    const cvaRange = cvaVah - cvaVal;
    const overlapPct = dvaRange > 0 ? (overlapRange / dvaRange) * 100 : 0;

    // Determine DVA position relative to CVA
    let dvaPosition: "ABOVE_CVA" | "BELOW_CVA" | "OVERLAPPING" | "UNKNOWN" = "UNKNOWN";
    
    if (overlapPct > 50) {
      dvaPosition = "OVERLAPPING";
    } else if (dvaVal > cvaVah) {
      dvaPosition = "ABOVE_CVA";
    } else if (dvaVah < cvaVal) {
      dvaPosition = "BELOW_CVA";
    } else {
      dvaPosition = "OVERLAPPING";
    }

    // Calculate value range percentage
    const valueRangePct = cvaRange > 0 ? (dvaRange / cvaRange) * 100 : 100;

    // Determine migration type and strength
    let migrationType: ValueMigrationType = "UNKNOWN";
    let migrationStrength = 0;
    let description = "";

    if (dvaPosition === "ABOVE_CVA") {
      // DVA completely above CVA = strong bullish migration
      const separation = dvaVal - cvaVah;
      const separationPct = cvaRange > 0 ? (separation / cvaRange) * 100 : 0;
      
      migrationType = "BULLISH_MIGRATION";
      migrationStrength = Math.min(100, 60 + separationPct * 2);
      description = `Value migrating higher. DVA ${separation.toFixed(2)} points above CVA. Bullish bias.`;
      
    } else if (dvaPosition === "BELOW_CVA") {
      // DVA completely below CVA = strong bearish migration
      const separation = cvaVal - dvaVah;
      const separationPct = cvaRange > 0 ? (separation / cvaRange) * 100 : 0;
      
      migrationType = "BEARISH_MIGRATION";
      migrationStrength = Math.min(100, 60 + separationPct * 2);
      description = `Value migrating lower. DVA ${separation.toFixed(2)} points below CVA. Bearish bias.`;
      
    } else if (overlapPct > 70) {
      // High overlap = neutral/balanced market
      migrationType = "NEUTRAL_OVERLAP";
      migrationStrength = Math.max(0, 50 - (overlapPct - 70) * 2);
      description = `DVA and CVA overlap ${overlapPct.toFixed(0)}%. Balanced market, trade edges.`;
      
    } else if (valueRangePct < 50) {
      // Narrow range = potential breakout pending
      migrationType = "BREAKOUT_PENDING";
      migrationStrength = Math.max(0, 50 - valueRangePct);
      description = `Value range compressed (${valueRangePct.toFixed(0)}% of normal). Breakout pending.`;
      
    } else {
      // Partial overlap = transitioning
      const pocAboveCva = dvaPoc > cvaPoc;
      migrationType = pocAboveCva ? "BULLISH_MIGRATION" : "BEARISH_MIGRATION";
      migrationStrength = 40;
      description = `Transitioning ${pocAboveCva ? "bullish" : "bearish"}. ${overlapPct.toFixed(0)}% overlap with CVA.`;
    }

    return {
      migration_type: migrationType,
      dva_position: dvaPosition,
      overlap_percentage: overlapPct,
      dva_vah: dvaVah,
      dva_val: dvaVal,
      dva_poc: dvaPoc,
      cva_vah: cvaVah,
      cva_val: cvaVal,
      cva_poc: cvaPoc,
      value_range_pct: valueRangePct,
      migration_strength: migrationStrength,
      description: description,
    };
  }

  /**
   * Determine if price is accepting outside value area (initiative trading)
   * vs responding back into value (responsive trading)
   */
  classifyTrading(
    currentPrice: number,
    vah: number,
    val: number,
    timeAtExtreme: number // minutes spent outside value
  ): "INITIATIVE" | "RESPONSIVE" {
    const isOutsideValue = currentPrice > vah || currentPrice < val;
    
    // If outside value for >30 minutes = initiative (new business)
    if (isOutsideValue && timeAtExtreme > 30) {
      return "INITIATIVE";
    }
    
    // If outside value but quickly returning = responsive (mean reversion)
    return "RESPONSIVE";
  }
}
