/**
 * User Behavior Pattern Tracker
 * Tracks and analyzes user browsing patterns for insights
 */

export interface PatternEntry {
  timestamp: number;
  pattern: string;
  domain: string;
  scrollCount: number;
  addictionRisk: number;
  educationalValue: number;
}

export interface PatternAnalytics {
  mostCommonPattern: string;
  averageAddictionRisk: number;
  averageEducationalValue: number;
  sessionDuration: number;
  patternsInSession: string[];
}

export class PatternTracker {
  private patterns: PatternEntry[] = [];
  private readonly maxPatterns = 50; // Keep only last 50 patterns
  private sessionStartTime = Date.now();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Track a new behavior pattern
   */
  trackPattern(
    pattern: string, 
    domain: string, 
    scrollCount: number, 
    addictionRisk: number = 0, 
    educationalValue: number = 0
  ): void {
    const entry: PatternEntry = {
      timestamp: Date.now(),
      pattern,
      domain,
      scrollCount,
      addictionRisk,
      educationalValue
    };

    this.patterns.push(entry);
    
    // Keep only the most recent patterns
    if (this.patterns.length > this.maxPatterns) {
      this.patterns = this.patterns.slice(-this.maxPatterns);
    }
    
    this.saveToStorage();
    console.log('PATTERN TRACKER: Tracked pattern:', pattern, 'for domain:', domain);
  }

  /**
   * Get recent patterns (last N)
   */
  getRecentPatterns(count: number = 10): string[] {
    return this.patterns
      .slice(-count)
      .map(p => p.pattern);
  }

  /**
   * Get the most common pattern in recent history
   */
  getMostCommonPattern(recentCount: number = 20): string {
    const recentPatterns = this.patterns.slice(-recentCount);
    
    if (recentPatterns.length === 0) {
      return 'Casual Browsing/Catch-up'; // Default
    }

    // Count pattern occurrences
    const patternCounts: Record<string, number> = {};
    recentPatterns.forEach(entry => {
      patternCounts[entry.pattern] = (patternCounts[entry.pattern] || 0) + 1;
    });

    // Find most common
    let mostCommon = 'Casual Browsing/Catch-up';
    let maxCount = 0;
    
    Object.entries(patternCounts).forEach(([pattern, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = pattern;
      }
    });

    return mostCommon;
  }

  /**
   * Get current session analytics
   */
  getSessionAnalytics(): PatternAnalytics {
    const sessionPatterns = this.patterns.filter(
      p => p.timestamp >= this.sessionStartTime
    );

    const averageAddictionRisk = sessionPatterns.length > 0
      ? sessionPatterns.reduce((sum, p) => sum + p.addictionRisk, 0) / sessionPatterns.length
      : 0;

    const averageEducationalValue = sessionPatterns.length > 0
      ? sessionPatterns.reduce((sum, p) => sum + p.educationalValue, 0) / sessionPatterns.length
      : 0;

    return {
      mostCommonPattern: this.getMostCommonPattern(),
      averageAddictionRisk,
      averageEducationalValue,
      sessionDuration: Math.round((Date.now() - this.sessionStartTime) / 60000), // minutes
      patternsInSession: sessionPatterns.map(p => p.pattern)
    };
  }

  /**
   * Get pattern statistics for a specific domain
   */
  getDomainPatterns(domain: string, count: number = 10): PatternEntry[] {
    return this.patterns
      .filter(p => p.domain === domain)
      .slice(-count);
  }

  /**
   * Reset session tracking
   */
  resetSession(): void {
    this.sessionStartTime = Date.now();
    console.log('PATTERN TRACKER: Session reset');
  }

  /**
   * Clear all pattern history
   */
  clearHistory(): void {
    this.patterns = [];
    this.sessionStartTime = Date.now();
    this.saveToStorage();
    console.log('PATTERN TRACKER: History cleared');
  }

  /**
   * Get pattern classification (for UI styling)
   */
  getPatternClassName(pattern: string): string {
    const classMap: Record<string, string> = {
      'Deep Focus/Learning': 'pattern-positive',
      'Active Socializing': 'pattern-social', 
      'Intentional Leisure': 'pattern-leisure',
      'Casual Browsing/Catch-up': 'pattern-neutral',
      'Passive Consumption/Doomscrolling': 'pattern-warning',
      'Anxiety-Driven Information Seeking': 'pattern-alert'
    };
    return classMap[pattern] || 'pattern-neutral';
  }

  /**
   * Get pattern emoji for display
   */
  getPatternEmoji(pattern: string): string {
    const emojiMap: Record<string, string> = {
      'Deep Focus/Learning': '🎯',
      'Active Socializing': '👥', 
      'Intentional Leisure': '😊',
      'Casual Browsing/Catch-up': '📱',
      'Passive Consumption/Doomscrolling': '⚠️',
      'Anxiety-Driven Information Seeking': '😰'
    };
    return emojiMap[pattern] || '📱';
  }

  /**
   * Load patterns from browser storage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const result = await browser.storage.local.get(['userPatterns', 'sessionStartTime']);
      
      if (result.userPatterns && Array.isArray(result.userPatterns)) {
        this.patterns = result.userPatterns;
      }
      
      if (result.sessionStartTime) {
        this.sessionStartTime = result.sessionStartTime;
      }
      
      console.log('PATTERN TRACKER: Loaded', this.patterns.length, 'patterns from storage');
    } catch (error) {
      console.error('PATTERN TRACKER: Error loading from storage:', error);
    }
  }

  /**
   * Save patterns to browser storage
   */
  private async saveToStorage(): Promise<void> {
    try {
      await browser.storage.local.set({ 
        userPatterns: this.patterns,
        sessionStartTime: this.sessionStartTime
      });
    } catch (error) {
      console.error('PATTERN TRACKER: Error saving to storage:', error);
    }
  }
} 