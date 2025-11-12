import { VolumeProfileCalculator } from "./volume_profile";
import type { VolumeProfile } from "@shared/schema";

/**
 * Composite Profile System
 * 
 * G7FX PRO Course - Stage 1: Context Development
 * 
 * Tracks multi-day volume profiles to create Composite Value Area (CVA)
 * Used for pre-market hypothesis generation and identifying longer-term value
 * 
 * Key Concepts:
 * - CVA (Composite Value Area): 5-day merged profile showing accepted value zones
 * - Pre-market roadmap: If price opens outside CVA, likely to test it
 * - Value migration: Compare today's DVA to CVA to identify trend/balance
 */

export interface CompositeProfileData {
  composite_vah: number;
  composite_val: number;
  composite_poc: number;
  total_volume: number;
  days_included: number;
  oldest_day: number;
  newest_day: number;
  profile_shape: "P" | "b" | "D" | "DOUBLE" | null;
}

export class CompositeProfileManager {
  private dailyProfiles: Array<{ date: string; profile: VolumeProfile }> = [];
  private maxDays: number;
  private tickSize: number;

  constructor(maxDays: number = 5, tickSize: number = 0.25) {
    this.maxDays = maxDays;
    this.tickSize = tickSize;
  }

  /**
   * Add a completed daily profile to the composite
   * 
   * @param date - Trading date (YYYY-MM-DD format)
   * @param profile - Completed volume profile for that day
   */
  addDailyProfile(date: string, profile: VolumeProfile): void {
    // Check if this date already exists
    const existingIndex = this.dailyProfiles.findIndex((d) => d.date === date);
    if (existingIndex !== -1) {
      // Update existing
      this.dailyProfiles[existingIndex] = { date, profile };
    } else {
      // Add new
      this.dailyProfiles.push({ date, profile });
    }

    // Sort by date (newest first)
    this.dailyProfiles.sort((a, b) => b.date.localeCompare(a.date));

    // Keep only maxDays
    if (this.dailyProfiles.length > this.maxDays) {
      this.dailyProfiles = this.dailyProfiles.slice(0, this.maxDays);
    }
  }

  /**
   * Calculate the current composite profile
   * Merges all daily profiles into a single composite value area
   */
  getCompositeProfile(): CompositeProfileData | null {
    if (this.dailyProfiles.length === 0) {
      return null;
    }

    // Merge all daily profiles into a single profile
    const compositeCalculator = new VolumeProfileCalculator(this.tickSize);

    for (const dailyData of this.dailyProfiles) {
      const profile = dailyData.profile;
      
      // Add each level from the daily profile to composite
      for (const level of profile.levels) {
        if (level.buy_volume > 0) {
          compositeCalculator.addTransaction(level.price, level.buy_volume, "BUY");
        }
        if (level.sell_volume > 0) {
          compositeCalculator.addTransaction(level.price, level.sell_volume, "SELL");
        }
      }
    }

    // Calculate composite profile
    const oldestDay = this.dailyProfiles[this.dailyProfiles.length - 1]?.date || "";
    const newestDay = this.dailyProfiles[0]?.date || "";
    
    const compositeProfile = compositeCalculator.getProfile(
      new Date(oldestDay).getTime(),
      new Date(newestDay).getTime()
    );

    return {
      composite_vah: compositeProfile.vah,
      composite_val: compositeProfile.val,
      composite_poc: compositeProfile.poc,
      total_volume: compositeProfile.total_volume,
      days_included: this.dailyProfiles.length,
      oldest_day: new Date(oldestDay).getTime(),
      newest_day: new Date(newestDay).getTime(),
      profile_shape: compositeProfile.profile_type,
    };
  }

  /**
   * Get yesterday's profile for comparison
   */
  getYesterdayProfile(): VolumeProfile | null {
    if (this.dailyProfiles.length < 2) {
      return null;
    }
    // Second entry is yesterday (first is today)
    return this.dailyProfiles[1].profile;
  }

  /**
   * Get today's profile (if it exists)
   */
  getTodayProfile(): VolumeProfile | null {
    if (this.dailyProfiles.length === 0) {
      return null;
    }
    return this.dailyProfiles[0].profile;
  }

  /**
   * Clear all profiles (for testing or reset)
   */
  clear(): void {
    this.dailyProfiles = [];
  }

  /**
   * Get all daily profiles
   */
  getAllProfiles(): Array<{ date: string; profile: VolumeProfile }> {
    return this.dailyProfiles;
  }
}
