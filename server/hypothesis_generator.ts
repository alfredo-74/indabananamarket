import type { VolumeProfile, VWAPData } from "@shared/schema";
import type { CompositeProfileData } from "./composite_profile";
import type { ValueMigrationData } from "./value_migration_detector";

/**
 * Hypothesis Generator
 * 
 * G7FX PRO Course - Stage 1: Context Development
 * 
 * Professional trading requires a daily hypothesis developed PRE-MARKET
 * This analyzes context (profiles, value areas, overnight action) to classify
 * expected market behavior and identify high-probability trade setups
 * 
 * Market Condition Classifications:
 * - TREND_UP: Strong bullish value migration, trade long pullbacks
 * - TREND_DOWN: Strong bearish value migration, trade short bounces
 * - BALANCE: Value overlap, trade fades from edges back to POC
 * - BREAKOUT_PENDING: Compressed range, wait for direction then follow
 * - OPENING_DRIVE: Open outside value, apply 80% rule if entering VA
 */

export type MarketCondition = 
  | "TREND_UP" 
  | "TREND_DOWN" 
  | "BALANCE" 
  | "BREAKOUT_PENDING"
  | "OPENING_DRIVE"
  | "UNKNOWN";

export interface DailyHypothesis {
  condition: MarketCondition;
  confidence: number; // 0-100
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  primary_strategy: string;
  key_levels: {
    resistance_1: number;
    resistance_2: number;
    support_1: number;
    support_2: number;
    pivot: number;
  };
  expected_behavior: string;
  trade_plan: string;
  invalidation_criteria: string;
}

export class HypothesisGenerator {
  /**
   * Generate daily trading hypothesis from market context
   * 
   * @param overnightHigh - Overnight session high
   * @param overnightLow - Overnight session low
   * @param openPrice - RTH open price
   * @param compositeProfile - 5-day CVA
   * @param yesterdayProfile - Yesterday's profile
   * @param valueMigration - Current value migration data
   * @param vwap - Current VWAP data
   * @returns DailyHypothesis with trade plan
   */
  generateHypothesis(
    overnightHigh: number,
    overnightLow: number,
    openPrice: number,
    compositeProfile: CompositeProfileData | null,
    yesterdayProfile: VolumeProfile | null,
    valueMigration: ValueMigrationData | null,
    vwap: VWAPData | null
  ): DailyHypothesis {
    // Default if insufficient data
    if (!compositeProfile) {
      return this.unknownHypothesis();
    }

    const cvaVah = compositeProfile.composite_vah;
    const cvaVal = compositeProfile.composite_val;
    const cvaPoc = compositeProfile.composite_poc;

    // Determine where we opened relative to value
    const openedAboveValue = openPrice > cvaVah;
    const openedBelowValue = openPrice < cvaVal;
    const openedInValue = !openedAboveValue && !openedBelowValue;

    // Check yesterday's position relative to composite
    let yesterdayBias: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    if (yesterdayProfile) {
      if (yesterdayProfile.val > cvaVah) {
        yesterdayBias = "BULLISH"; // Yesterday's value above composite = strong trend up
      } else if (yesterdayProfile.vah < cvaVal) {
        yesterdayBias = "BEARISH"; // Yesterday's value below composite = strong trend down
      }
    }

    // Check value migration
    let migrationBias: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    if (valueMigration) {
      if (valueMigration.migration_type === "BULLISH_MIGRATION") {
        migrationBias = "BULLISH";
      } else if (valueMigration.migration_type === "BEARISH_MIGRATION") {
        migrationBias = "BEARISH";
      }
    }

    // Check overnight range
    const onRange = overnightHigh - overnightLow;
    const avgRange = cvaVah - cvaVal; // Use CVA range as reference
    const narrowRange = onRange < avgRange * 0.5;

    // Generate hypothesis based on context
    if ((openedAboveValue || openedBelowValue) && !openedInValue) {
      // Opening Drive scenario
      return this.openingDriveHypothesis(
        openedAboveValue,
        openPrice,
        cvaVah,
        cvaVal,
        cvaPoc
      );
    } else if (narrowRange) {
      // Breakout Pending scenario
      return this.breakoutPendingHypothesis(
        cvaVah,
        cvaVal,
        cvaPoc,
        yesterdayBias
      );
    } else if (yesterdayBias === "BULLISH" && migrationBias === "BULLISH") {
      // Trend Up scenario
      return this.trendUpHypothesis(cvaVah, cvaVal, cvaPoc, vwap);
    } else if (yesterdayBias === "BEARISH" && migrationBias === "BEARISH") {
      // Trend Down scenario
      return this.trendDownHypothesis(cvaVah, cvaVal, cvaPoc, vwap);
    } else {
      // Balance scenario (default)
      return this.balanceHypothesis(cvaVah, cvaVal, cvaPoc);
    }
  }

  private openingDriveHypothesis(
    openedAbove: boolean,
    openPrice: number,
    vah: number,
    val: number,
    poc: number
  ): DailyHypothesis {
    if (openedAbove) {
      return {
        condition: "OPENING_DRIVE",
        confidence: 75,
        bias: "BULLISH",
        primary_strategy: "80% Rule - If price enters value, 80% chance it reaches opposite side",
        key_levels: {
          resistance_1: openPrice + (openPrice - vah) * 0.5,
          resistance_2: openPrice + (openPrice - vah),
          support_1: vah,
          support_2: poc,
          pivot: vah,
        },
        expected_behavior: "Opened above value. If accepted, expect continuation higher. If rejected into value, apply 80% rule to VAL.",
        trade_plan: "Long: Above VAH with acceptance. Short: If enters value, target VAL (80% rule).",
        invalidation_criteria: "Quick return to value without retest of VAH indicates weakness",
      };
    } else {
      return {
        condition: "OPENING_DRIVE",
        confidence: 75,
        bias: "BEARISH",
        primary_strategy: "80% Rule - If price enters value, 80% chance it reaches opposite side",
        key_levels: {
          resistance_1: poc,
          resistance_2: val,
          support_1: openPrice - (val - openPrice) * 0.5,
          support_2: openPrice - (val - openPrice),
          pivot: val,
        },
        expected_behavior: "Opened below value. If accepted, expect continuation lower. If rejected into value, apply 80% rule to VAH.",
        trade_plan: "Short: Below VAL with acceptance. Long: If enters value, target VAH (80% rule).",
        invalidation_criteria: "Quick return to value without retest of VAL indicates strength",
      };
    }
  }

  private breakoutPendingHypothesis(
    vah: number,
    val: number,
    poc: number,
    bias: "BULLISH" | "BEARISH" | "NEUTRAL"
  ): DailyHypothesis {
    return {
      condition: "BREAKOUT_PENDING",
      confidence: 60,
      bias: bias,
      primary_strategy: "Wait for breakout direction, then follow with initiative",
      key_levels: {
        resistance_1: vah,
        resistance_2: vah + (vah - poc),
        support_1: val,
        support_2: val - (poc - val),
        pivot: poc,
      },
      expected_behavior: "Narrow overnight range suggests compression. Breakout likely. Direction TBD.",
      trade_plan: "Fade early chop. Once direction clear (break VAH or VAL), follow with initiative.",
      invalidation_criteria: "Continued tight range without breakout = remain patient",
    };
  }

  private trendUpHypothesis(
    vah: number,
    val: number,
    poc: number,
    vwap: VWAPData | null
  ): DailyHypothesis {
    const vwapLevel = vwap?.vwap || poc;
    return {
      condition: "TREND_UP",
      confidence: 85,
      bias: "BULLISH",
      primary_strategy: "Buy pullbacks to VWAP or VAL, sell at resistance",
      key_levels: {
        resistance_1: vah,
        resistance_2: vah + (vah - poc),
        support_1: vwapLevel,
        support_2: val,
        pivot: poc,
      },
      expected_behavior: "Value migrating higher. Buy dips, sell spikes.",
      trade_plan: "Long at VWAP or VAL. Target VAH then measured move. Trail stops.",
      invalidation_criteria: "Break below VAL with acceptance = trend over",
    };
  }

  private trendDownHypothesis(
    vah: number,
    val: number,
    poc: number,
    vwap: VWAPData | null
  ): DailyHypothesis {
    const vwapLevel = vwap?.vwap || poc;
    return {
      condition: "TREND_DOWN",
      confidence: 85,
      bias: "BEARISH",
      primary_strategy: "Sell bounces to VWAP or VAH, cover at support",
      key_levels: {
        resistance_1: vah,
        resistance_2: vwap?.vwap || poc,
        support_1: val,
        support_2: val - (poc - val),
        pivot: poc,
      },
      expected_behavior: "Value migrating lower. Sell rips, cover dips.",
      trade_plan: "Short at VWAP or VAH. Target VAL then measured move. Trail stops.",
      invalidation_criteria: "Break above VAH with acceptance = trend over",
    };
  }

  private balanceHypothesis(vah: number, val: number, poc: number): DailyHypothesis {
    return {
      condition: "BALANCE",
      confidence: 70,
      bias: "NEUTRAL",
      primary_strategy: "Fade value area edges back to POC",
      key_levels: {
        resistance_1: vah,
        resistance_2: vah + (vah - poc) * 0.5,
        support_1: val,
        support_2: val - (poc - val) * 0.5,
        pivot: poc,
      },
      expected_behavior: "Balanced market. Trade from edge to edge. Mean reversion.",
      trade_plan: "Short at VAH, target POC then VAL. Long at VAL, target POC then VAH.",
      invalidation_criteria: "Break and hold outside value = transition to trend",
    };
  }

  private unknownHypothesis(): DailyHypothesis {
    return {
      condition: "UNKNOWN",
      confidence: 0,
      bias: "NEUTRAL",
      primary_strategy: "Wait for context to develop",
      key_levels: {
        resistance_1: 0,
        resistance_2: 0,
        support_1: 0,
        support_2: 0,
        pivot: 0,
      },
      expected_behavior: "Insufficient data for hypothesis",
      trade_plan: "Observe and develop thesis",
      invalidation_criteria: "N/A",
    };
  }
}
