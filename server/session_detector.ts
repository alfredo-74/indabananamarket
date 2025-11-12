import type { SessionType, SessionStats } from "@shared/schema";

export class SessionDetector {
  /**
   * Detect current trading session based on timestamp
   * 
   * ETH (Extended Trading Hours): 6 PM ET - 9:30 AM ET (next day)
   * RTH (Regular Trading Hours): 9:30 AM ET - 4 PM ET
   * 
   * Note: Handles ET timezone (UTC-5 for EST, UTC-4 for EDT)
   */
  detectSession(timestamp: number): SessionType {
    const date = new Date(timestamp);
    
    // Get hours and minutes in ET timezone
    // Use America/New_York to handle EST/EDT automatically
    const etTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
    
    const [hoursStr, minutesStr] = etTime.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    const totalMinutes = hours * 60 + minutes;
    
    // RTH: 9:30 AM - 4:00 PM ET (570 minutes - 960 minutes)
    const rthStart = 9 * 60 + 30;  // 9:30 AM = 570 minutes
    const rthEnd = 16 * 60;         // 4:00 PM = 960 minutes
    
    if (totalMinutes >= rthStart && totalMinutes < rthEnd) {
      return "RTH";
    } else {
      return "ETH";
    }
  }

  /**
   * Get time until next session transition
   */
  getNextSessionTime(currentTimestamp: number): { nextSession: SessionType; nextTime: number } {
    const currentSession = this.detectSession(currentTimestamp);
    const date = new Date(currentTimestamp);
    
    // Get current time in ET
    const etTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
    
    const [hoursStr, minutesStr] = etTime.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    const totalMinutes = hours * 60 + minutes;
    
    if (currentSession === "ETH") {
      // Next session is RTH at 9:30 AM ET
      const rthStartMinutes = 9 * 60 + 30;
      let minutesUntilRth: number;
      
      if (totalMinutes < rthStartMinutes) {
        // Same day transition
        minutesUntilRth = rthStartMinutes - totalMinutes;
      } else {
        // Next day transition (currently after 4 PM)
        minutesUntilRth = (24 * 60 - totalMinutes) + rthStartMinutes;
      }
      
      return {
        nextSession: "RTH",
        nextTime: currentTimestamp + (minutesUntilRth * 60 * 1000),
      };
    } else {
      // Next session is ETH at 4:00 PM ET (market close)
      const ethStartMinutes = 16 * 60;
      const minutesUntilEth = ethStartMinutes - totalMinutes;
      
      return {
        nextSession: "ETH",
        nextTime: currentTimestamp + (minutesUntilEth * 60 * 1000),
      };
    }
  }

  /**
   * Get session start time for current session
   */
  getSessionStartTime(currentTimestamp: number): number {
    const currentSession = this.detectSession(currentTimestamp);
    const date = new Date(currentTimestamp);
    
    // Get current time in ET
    const etTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
    
    const [hoursStr, minutesStr] = etTime.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    const totalMinutes = hours * 60 + minutes;
    
    if (currentSession === "RTH") {
      // RTH started at 9:30 AM today
      const minutesSinceRthStart = totalMinutes - (9 * 60 + 30);
      return currentTimestamp - (minutesSinceRthStart * 60 * 1000);
    } else {
      // ETH session - could have started yesterday at 4 PM or today at 4 PM
      if (totalMinutes < 9 * 60 + 30) {
        // Currently in overnight session, started yesterday at 4 PM
        const minutesSinceMidnight = totalMinutes;
        const minutesFromYesterday4pm = (24 * 60 - 16 * 60) + minutesSinceMidnight;
        return currentTimestamp - (minutesFromYesterday4pm * 60 * 1000);
      } else {
        // After 4 PM today
        const minutesSince4pm = totalMinutes - (16 * 60);
        return currentTimestamp - (minutesSince4pm * 60 * 1000);
      }
    }
  }

  /**
   * Check if we just transitioned to a new session
   */
  didSessionChange(previousTimestamp: number, currentTimestamp: number): boolean {
    const previousSession = this.detectSession(previousTimestamp);
    const currentSession = this.detectSession(currentTimestamp);
    return previousSession !== currentSession;
  }

  /**
   * Create session stats object
   */
  createSessionStats(
    currentTimestamp: number,
    ethCumulativeDelta: number,
    rthCumulativeDelta: number,
    ethRegime: any,
    rthRegime: any
  ): SessionStats {
    const currentSession = this.detectSession(currentTimestamp);
    const sessionStartTime = this.getSessionStartTime(currentTimestamp);
    const { nextTime } = this.getNextSessionTime(currentTimestamp);

    return {
      current_session: currentSession,
      session_start_time: sessionStartTime,
      next_session_time: nextTime,
      eth_cumulative_delta: ethCumulativeDelta,
      rth_cumulative_delta: rthCumulativeDelta,
      eth_regime: ethRegime,
      rth_regime: rthRegime,
    };
  }
}
