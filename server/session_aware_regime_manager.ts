import { RegimeDetector } from "./regime_detector";
import { SessionDetector } from "./session_detector";
import type { RegimeState, SessionType } from "@shared/schema";

/**
 * Manages session-aware regime detection with separate tracking for ETH and RTH
 * 
 * ETH (Extended Trading Hours): Uses ±30 threshold (thinner volume)
 * RTH (Regular Trading Hours): Uses ±50 threshold (normal volume)
 * 
 * Smart regime transition: When RTH opens, blends ETH regime with new RTH data
 * instead of hard reset
 */
export class SessionAwareRegimeManager {
  private ethRegimeDetector: RegimeDetector;
  private rthRegimeDetector: RegimeDetector;
  private sessionDetector: SessionDetector;

  // Session-specific cumulative delta tracking
  private ethCumulativeDelta: number = 0;
  private rthCumulativeDelta: number = 0;

  // Session-specific regime states
  private ethRegime: RegimeState = "ROTATIONAL";
  private rthRegime: RegimeState = "ROTATIONAL";

  // Previous session and timestamp for transition detection
  private previousSession: SessionType | null = null;
  private lastTimestamp: number = 0;

  constructor(ethThreshold: number = 30, rthThreshold: number = 50) {
    this.ethRegimeDetector = new RegimeDetector(ethThreshold);
    this.rthRegimeDetector = new RegimeDetector(rthThreshold);
    this.sessionDetector = new SessionDetector();
  }

  /**
   * Update cumulative delta and detect regime for current session
   * Returns the current session's regime
   */
  updateRegime(
    timestamp: number,
    tickDelta: number // Delta for this tick (positive for buy, negative for sell)
  ): {
    regime: RegimeState;
    session: SessionType;
    ethCD: number;
    rthCD: number;
    transitioned: boolean;
  } {
    const currentSession = this.sessionDetector.detectSession(timestamp);
    
    // Check if we transitioned to a new session
    const transitioned = this.previousSession !== null && 
                         this.previousSession !== currentSession &&
                         this.lastTimestamp !== 0;

    if (transitioned) {
      this.handleSessionTransition(currentSession);
    }

    // Update cumulative delta for current session
    if (currentSession === "ETH") {
      this.ethCumulativeDelta += tickDelta;
      this.ethRegime = this.ethRegimeDetector.detectRegime(
        this.ethCumulativeDelta,
        this.ethRegime
      );
    } else {
      this.rthCumulativeDelta += tickDelta;
      this.rthRegime = this.rthRegimeDetector.detectRegime(
        this.rthCumulativeDelta,
        this.rthRegime
      );
    }

    this.previousSession = currentSession;
    this.lastTimestamp = timestamp;

    return {
      regime: currentSession === "ETH" ? this.ethRegime : this.rthRegime,
      session: currentSession,
      ethCD: this.ethCumulativeDelta,
      rthCD: this.rthCumulativeDelta,
      transitioned,
    };
  }

  /**
   * Handle session transition when market opens/closes
   * PRO COURSE: Cumulative delta is FLUSHED at RTH open (9:30 AM ET)
   * Clean start for each session - no data contamination
   */
  private handleSessionTransition(newSession: SessionType): void {
    if (newSession === "RTH") {
      // Transitioning from ETH to RTH (market open at 9:30 AM ET)
      // PRO COURSE REQUIREMENT: FLUSH cumulative delta at RTH open
      // No overnight data should contaminate RTH trading signals
      this.rthCumulativeDelta = 0;
      
      // Start with rotational regime but will quickly adjust based on actual flow
      this.rthRegime = "ROTATIONAL";

      console.log(
        `[Session Transition] ETH→RTH: CD FLUSHED at RTH open (was ${this.ethCumulativeDelta.toFixed(1)}). ` +
        `RTH CD reset to 0 per PRO course methodology.`
      );
    } else {
      // Transitioning from RTH to ETH (market close at 4:00 PM ET)
      // Reset ETH cumulative delta (overnight session is fresh start)
      this.ethCumulativeDelta = 0;
      this.ethRegime = "ROTATIONAL";

      console.log(`[Session Transition] RTH→ETH: Fresh ETH session started, CD reset to 0`);
    }
  }

  /**
   * Get current regime for specified session
   */
  getSessionRegime(session: SessionType): RegimeState {
    return session === "ETH" ? this.ethRegime : this.rthRegime;
  }

  /**
   * Get current cumulative delta for specified session
   */
  getSessionCD(session: SessionType): number {
    return session === "ETH" ? this.ethCumulativeDelta : this.rthCumulativeDelta;
  }

  /**
   * Get both session regimes
   */
  getAllSessionData(): {
    ethRegime: RegimeState;
    rthRegime: RegimeState;
    ethCD: number;
    rthCD: number;
  } {
    return {
      ethRegime: this.ethRegime,
      rthRegime: this.rthRegime,
      ethCD: this.ethCumulativeDelta,
      rthCD: this.rthCumulativeDelta,
    };
  }

  /**
   * Update thresholds for session-specific regime detection
   */
  setThresholds(ethThreshold: number, rthThreshold: number): void {
    this.ethRegimeDetector.setThreshold(ethThreshold);
    this.rthRegimeDetector.setThreshold(rthThreshold);
  }

  /**
   * Get current thresholds
   */
  getThresholds(): { eth: number; rth: number } {
    return {
      eth: this.ethRegimeDetector.getThreshold(),
      rth: this.rthRegimeDetector.getThreshold(),
    };
  }

  /**
   * Reset all session data (useful for backtesting or new trading day)
   */
  reset(): void {
    this.ethCumulativeDelta = 0;
    this.rthCumulativeDelta = 0;
    this.ethRegime = "ROTATIONAL";
    this.rthRegime = "ROTATIONAL";
    this.previousSession = null;
    this.lastTimestamp = 0;
  }
}
