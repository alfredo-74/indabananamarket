import type { VolumetricCandle, CompositeProfileData, VolumeProfile } from "@shared/schema";

/**
 * Enhanced Value Shift Detector
 * 
 * PRO Course: Value Expectations Framework (7 Conditions)
 * 
 * Detects shifts in market value structure using 7 key conditions:
 * 1. Balance Area Breakdown - Price breaks out of balanced value
 * 2. Building Above Value - Price consistently builds new value above CVA
 * 3. Building Below Value - Price consistently builds new value below CVA
 * 4. POC Holding as Support - POC acts as support (bullish)
 * 5. POC Holding as Resistance - POC acts as resistance (bearish)
 * 6. Value Migration Confirmed - DVA moves away from CVA with conviction
 * 7. Value Rejection - Price enters value but gets quickly rejected
 */

export type ValueShiftCondition =
  | "BALANCE_BREAKDOWN"
  | "BUILDING_ABOVE_VALUE"
  | "BUILDING_BELOW_VALUE"
  | "POC_SUPPORT"
  | "POC_RESISTANCE"
  | "VALUE_MIGRATION_CONFIRMED"
  | "VALUE_REJECTION"
  | "NONE";

export interface ValueShiftSignal {
  condition: ValueShiftCondition;
  detected: boolean;
  confidence: number; // 0-1
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  description: string;
  key_level: number | null; // Important price level (POC, VAH, VAL)
  trade_implication: string;
}

export class ValueShiftDetector {
  private previousDVA: VolumeProfile | null = null;
  private pocTests: Array<{ timestamp: number; price: number; poc: number; result: "HELD" | "FAILED" }> = [];
  private maxPOCTestHistory: number = 10;
  private tickSize: number;
  
  constructor(tickSize: number = 0.25) {
    this.tickSize = tickSize;
  }
  
  /**
   * Detect all 7 value shift conditions
   */
  detectValueShift(
    currentDVA: VolumeProfile,
    cva: CompositeProfileData,
    candles: VolumetricCandle[],
    currentPrice: number
  ): ValueShiftSignal[] {
    const signals: ValueShiftSignal[] = [];
    
    // Condition 1: Balance Area Breakdown
    const balanceBreakdown = this.detectBalanceBreakdown(currentDVA, cva, currentPrice, candles);
    if (balanceBreakdown.detected) {
      signals.push(balanceBreakdown);
    }
    
    // Condition 2 & 3: Building Above/Below Value
    const buildingAbove = this.detectBuildingAboveValue(currentDVA, cva);
    if (buildingAbove.detected) {
      signals.push(buildingAbove);
    }
    
    const buildingBelow = this.detectBuildingBelowValue(currentDVA, cva);
    if (buildingBelow.detected) {
      signals.push(buildingBelow);
    }
    
    // Condition 4 & 5: POC Holding as Support/Resistance
    const pocSupport = this.detectPOCSupport(cva, currentPrice, candles);
    if (pocSupport.detected) {
      signals.push(pocSupport);
    }
    
    const pocResistance = this.detectPOCResistance(cva, currentPrice, candles);
    if (pocResistance.detected) {
      signals.push(pocResistance);
    }
    
    // Condition 6: Value Migration Confirmed
    const migrationConfirmed = this.detectValueMigrationConfirmed(currentDVA, cva);
    if (migrationConfirmed.detected) {
      signals.push(migrationConfirmed);
    }
    
    // Condition 7: Value Rejection
    const valueRejection = this.detectValueRejection(currentDVA, cva, currentPrice, candles);
    if (valueRejection.detected) {
      signals.push(valueRejection);
    }
    
    // Update previous DVA for next iteration
    this.previousDVA = currentDVA;
    
    return signals;
  }
  
  /**
   * Condition 1: Balance Area Breakdown
   */
  private detectBalanceBreakdown(
    dva: VolumeProfile,
    cva: CompositeProfileData,
    currentPrice: number,
    candles: VolumetricCandle[]
  ): ValueShiftSignal {
    const noSignal: ValueShiftSignal = {
      condition: "BALANCE_BREAKDOWN",
      detected: false,
      confidence: 0,
      direction: "NEUTRAL",
      description: "",
      key_level: null,
      trade_implication: "",
    };
    
    // Balanced market: DVA overlaps CVA significantly (>70%)
    const dvaRange = dva.vah - dva.val;
    const cvaRange = cva.composite_vah - cva.composite_val;
    
    if (dvaRange === 0 || cvaRange === 0) return noSignal;
    
    const overlapTop = Math.min(dva.vah, cva.composite_vah);
    const overlapBottom = Math.max(dva.val, cva.composite_val);
    const overlapRange = overlapTop - overlapBottom;
    const overlapPct = (overlapRange / cvaRange) * 100;
    
    // Not balanced enough
    if (overlapPct < 70) return noSignal;
    
    // Breakdown: price moves outside value area with momentum
    const breakingAbove = currentPrice > Math.max(dva.vah, cva.composite_vah);
    const breakingBelow = currentPrice < Math.min(dva.val, cva.composite_val);
    
    if (!breakingAbove && !breakingBelow) return noSignal;
    
    // Check for momentum (last 3 candles trending)
    const recentCandles = candles.slice(-3);
    if (recentCandles.length < 3) return noSignal;
    
    const allBullish = recentCandles.every(c => c.close > c.open);
    const allBearish = recentCandles.every(c => c.close < c.open);
    
    if (breakingAbove && allBullish) {
      const breakoutLevel = Math.max(dva.vah, cva.composite_vah);
      return {
        condition: "BALANCE_BREAKDOWN",
        detected: true,
        confidence: 0.75,
        direction: "BULLISH",
        description: `Balance area breakdown: Price broke above ${breakoutLevel.toFixed(2)} with bullish momentum`,
        key_level: breakoutLevel,
        trade_implication: "Join breakout or wait for retest of breakout level as support",
      };
    } else if (breakingBelow && allBearish) {
      const breakdownLevel = Math.min(dva.val, cva.composite_val);
      return {
        condition: "BALANCE_BREAKDOWN",
        detected: true,
        confidence: 0.75,
        direction: "BEARISH",
        description: `Balance area breakdown: Price broke below ${breakdownLevel.toFixed(2)} with bearish momentum`,
        key_level: breakdownLevel,
        trade_implication: "Join breakdown or wait for retest of breakdown level as resistance",
      };
    }
    
    return noSignal;
  }
  
  /**
   * Condition 2: Building Above Value
   */
  private detectBuildingAboveValue(dva: VolumeProfile, cva: CompositeProfileData): ValueShiftSignal {
    const noSignal: ValueShiftSignal = {
      condition: "BUILDING_ABOVE_VALUE",
      detected: false,
      confidence: 0,
      direction: "NEUTRAL",
      description: "",
      key_level: null,
      trade_implication: "",
    };
    
    // DVA is completely above CVA
    const dvaAboveCVA = dva.val > cva.composite_vah;
    
    if (!dvaAboveCVA) return noSignal;
    
    // Calculate how far above
    const distanceAbove = dva.val - cva.composite_vah;
    const cvaRange = cva.composite_vah - cva.composite_val;
    const distancePct = (distanceAbove / cvaRange) * 100;
    
    // Confidence increases with distance
    const confidence = Math.min(distancePct / 50, 1.0); // 50%+ distance = max confidence
    
    return {
      condition: "BUILDING_ABOVE_VALUE",
      detected: true,
      confidence,
      direction: "BULLISH",
      description: `New value building ${distancePct.toFixed(0)}% above composite value area`,
      key_level: cva.composite_vah,
      trade_implication: "Strong uptrend - buy pullbacks to CVA VAH or DVA VAL",
    };
  }
  
  /**
   * Condition 3: Building Below Value
   */
  private detectBuildingBelowValue(dva: VolumeProfile, cva: CompositeProfileData): ValueShiftSignal {
    const noSignal: ValueShiftSignal = {
      condition: "BUILDING_BELOW_VALUE",
      detected: false,
      confidence: 0,
      direction: "NEUTRAL",
      description: "",
      key_level: null,
      trade_implication: "",
    };
    
    // DVA is completely below CVA
    const dvaBelowCVA = dva.vah < cva.composite_val;
    
    if (!dvaBelowCVA) return noSignal;
    
    // Calculate how far below
    const distanceBelow = cva.composite_val - dva.vah;
    const cvaRange = cva.composite_vah - cva.composite_val;
    const distancePct = (distanceBelow / cvaRange) * 100;
    
    // Confidence increases with distance
    const confidence = Math.min(distancePct / 50, 1.0);
    
    return {
      condition: "BUILDING_BELOW_VALUE",
      detected: true,
      confidence,
      direction: "BEARISH",
      description: `New value building ${distancePct.toFixed(0)}% below composite value area`,
      key_level: cva.composite_val,
      trade_implication: "Strong downtrend - sell rallies to CVA VAL or DVA VAH",
    };
  }
  
  /**
   * Condition 4: POC Holding as Support
   */
  private detectPOCSupport(
    cva: CompositeProfileData,
    currentPrice: number,
    candles: VolumetricCandle[]
  ): ValueShiftSignal {
    const noSignal: ValueShiftSignal = {
      condition: "POC_SUPPORT",
      detected: false,
      confidence: 0,
      direction: "NEUTRAL",
      description: "",
      key_level: null,
      trade_implication: "",
    };
    
    const poc = cva.composite_poc;
    if (poc === 0) return noSignal;
    
    // Check recent candles for POC tests
    const recentCandles = candles.slice(-10);
    let testCount = 0;
    let holdCount = 0;
    
    for (const candle of recentCandles) {
      // Did price test POC from above?
      const testedPOC = candle.low <= poc + this.tickSize && candle.low >= poc - this.tickSize;
      
      if (testedPOC) {
        testCount++;
        
        // Did it hold (close above POC)?
        if (candle.close > poc) {
          holdCount++;
        }
      }
    }
    
    // Need at least 2 tests
    if (testCount < 2) return noSignal;
    
    // POC held in majority of tests
    const holdRate = holdCount / testCount;
    
    if (holdRate >= 0.67) { // 67%+ hold rate
      return {
        condition: "POC_SUPPORT",
        detected: true,
        confidence: holdRate,
        direction: "BULLISH",
        description: `POC (${poc.toFixed(2)}) held as support ${holdCount}/${testCount} times`,
        key_level: poc,
        trade_implication: "Buy at POC support with tight stop below",
      };
    }
    
    return noSignal;
  }
  
  /**
   * Condition 5: POC Holding as Resistance
   */
  private detectPOCResistance(
    cva: CompositeProfileData,
    currentPrice: number,
    candles: VolumetricCandle[]
  ): ValueShiftSignal {
    const noSignal: ValueShiftSignal = {
      condition: "POC_RESISTANCE",
      detected: false,
      confidence: 0,
      direction: "NEUTRAL",
      description: "",
      key_level: null,
      trade_implication: "",
    };
    
    const poc = cva.composite_poc;
    if (poc === 0) return noSignal;
    
    // Check recent candles for POC tests
    const recentCandles = candles.slice(-10);
    let testCount = 0;
    let rejectCount = 0;
    
    for (const candle of recentCandles) {
      // Did price test POC from below?
      const testedPOC = candle.high >= poc - this.tickSize && candle.high <= poc + this.tickSize;
      
      if (testedPOC) {
        testCount++;
        
        // Did it reject (close below POC)?
        if (candle.close < poc) {
          rejectCount++;
        }
      }
    }
    
    // Need at least 2 tests
    if (testCount < 2) return noSignal;
    
    // POC rejected in majority of tests
    const rejectRate = rejectCount / testCount;
    
    if (rejectRate >= 0.67) { // 67%+ reject rate
      return {
        condition: "POC_RESISTANCE",
        detected: true,
        confidence: rejectRate,
        direction: "BEARISH",
        description: `POC (${poc.toFixed(2)}) held as resistance ${rejectCount}/${testCount} times`,
        key_level: poc,
        trade_implication: "Sell at POC resistance with tight stop above",
      };
    }
    
    return noSignal;
  }
  
  /**
   * Condition 6: Value Migration Confirmed
   */
  private detectValueMigrationConfirmed(dva: VolumeProfile, cva: CompositeProfileData): ValueShiftSignal {
    const noSignal: ValueShiftSignal = {
      condition: "VALUE_MIGRATION_CONFIRMED",
      detected: false,
      confidence: 0,
      direction: "NEUTRAL",
      description: "",
      key_level: null,
      trade_implication: "",
    };
    
    // Require previous DVA to detect migration
    if (!this.previousDVA) return noSignal;
    
    // Calculate overlap with CVA
    const overlapTop = Math.min(dva.vah, cva.composite_vah);
    const overlapBottom = Math.max(dva.val, cva.composite_val);
    const overlapRange = overlapTop - overlapBottom;
    const cvaRange = cva.composite_vah - cva.composite_val;
    const overlapPct = (overlapRange / cvaRange) * 100;
    
    // Migration confirmed: DVA moving away from CVA (low overlap)
    if (overlapPct > 50) return noSignal; // Too much overlap
    
    // Determine direction
    const dvaPOC = dva.poc;
    const cvaPOC = cva.composite_poc;
    const previousDVAPOC = this.previousDVA.poc;
    
    // DVA POC moving away from CVA POC
    const currentDistance = Math.abs(dvaPOC - cvaPOC);
    const previousDistance = Math.abs(previousDVAPOC - cvaPOC);
    
    const movingAway = currentDistance > previousDistance;
    
    if (!movingAway) return noSignal;
    
    if (dvaPOC > cvaPOC) {
      return {
        condition: "VALUE_MIGRATION_CONFIRMED",
        detected: true,
        confidence: 0.8,
        direction: "BULLISH",
        description: `Value migrating higher: DVA POC (${dvaPOC.toFixed(2)}) moving away from CVA POC (${cvaPOC.toFixed(2)})`,
        key_level: cvaPOC,
        trade_implication: "Trend continuation - buy pullbacks to CVA POC",
      };
    } else {
      return {
        condition: "VALUE_MIGRATION_CONFIRMED",
        detected: true,
        confidence: 0.8,
        direction: "BEARISH",
        description: `Value migrating lower: DVA POC (${dvaPOC.toFixed(2)}) moving away from CVA POC (${cvaPOC.toFixed(2)})`,
        key_level: cvaPOC,
        trade_implication: "Trend continuation - sell rallies to CVA POC",
      };
    }
  }
  
  /**
   * Condition 7: Value Rejection
   */
  private detectValueRejection(
    dva: VolumeProfile,
    cva: CompositeProfileData,
    currentPrice: number,
    candles: VolumetricCandle[]
  ): ValueShiftSignal {
    const noSignal: ValueShiftSignal = {
      condition: "VALUE_REJECTION",
      detected: false,
      confidence: 0,
      direction: "NEUTRAL",
      description: "",
      key_level: null,
      trade_implication: "",
    };
    
    // Check last 3-5 candles for rejection pattern
    const recentCandles = candles.slice(-5);
    if (recentCandles.length < 3) return noSignal;
    
    // Did price enter value area?
    const cvaVAH = cva.composite_vah;
    const cvaVAL = cva.composite_val;
    
    let enteredValue = false;
    let rejectionCandle: VolumetricCandle | null = null;
    
    for (const candle of recentCandles) {
      const candleInValue = candle.close >= cvaVAL && candle.close <= cvaVAH;
      
      if (candleInValue) {
        enteredValue = true;
      } else if (enteredValue && !candleInValue) {
        // Rejected from value
        rejectionCandle = candle;
        break;
      }
    }
    
    if (!rejectionCandle) return noSignal;
    
    // Rejection from above (bearish)
    if (rejectionCandle.close < cvaVAL) {
      return {
        condition: "VALUE_REJECTION",
        detected: true,
        confidence: 0.7,
        direction: "BEARISH",
        description: `Price rejected from value area, now trading below VAL (${cvaVAL.toFixed(2)})`,
        key_level: cvaVAL,
        trade_implication: "Sell rallies to VAL - value rejection indicates weak acceptance",
      };
    }
    
    // Rejection from below (bullish)
    if (rejectionCandle.close > cvaVAH) {
      return {
        condition: "VALUE_REJECTION",
        detected: true,
        confidence: 0.7,
        direction: "BULLISH",
        description: `Price rejected from value area, now trading above VAH (${cvaVAH.toFixed(2)})`,
        key_level: cvaVAH,
        trade_implication: "Buy pullbacks to VAH - value rejection indicates strong demand",
      };
    }
    
    return noSignal;
  }
  
  /**
   * Reset for new trading day
   */
  reset(): void {
    this.previousDVA = null;
    this.pocTests = [];
  }
}
