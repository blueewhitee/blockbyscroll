/**
 * Main AI content analyzer that orchestrates the analysis process
 */

import { PatternTracker } from './pattern-tracker';

// Updated interface to support new behavioral analysis
export interface AIAnalysisResponse {
  // New primary fields from enhanced backend
  user_pattern?: 'Deep Focus/Learning' | 'Active Socializing' | 'Intentional Leisure' | 
                'Casual Browsing/Catch-up' | 'Passive Consumption/Doomscrolling' | 
                'Anxiety-Driven Information Seeking';
  addiction_risk: number;
  educational_value: number;
  recommended_action: 'session_extension' | 'gentle_reward' | 'maintain_limit' | 
                     'show_warning' | 'immediate_break' | 'bonus_scrolls'; // Added new actions + legacy
  bonus_scrolls: number;
  reasoning: string;
  break_suggestion?: string;
  
  // Legacy fields (optional, for backward compatibility)
  content_type?: 'productive' | 'neutral' | 'entertainment' | 'doomscroll' | 'unknown';
  confidence_score?: number;
}

export interface AIAnalysisRequest {
  content: string;
  context: {
    scrollCount: number;
    maxScrolls: number;
    domain: string;
    timestamp: number;
    timeOfDay: string;
    scrollTime: number; // minutes spent scrolling
  };
}

export interface AnalyzerConfig {
  enabled: boolean;
  analysisThreshold: number; // Scrolls remaining to trigger analysis
  cacheEnabled: boolean;
  cacheDurationMs: number;
}

export interface AnalysisResult {
  success: boolean;
  analysis?: AIAnalysisResponse;
  error?: string;
  cached?: boolean;
  metadata: {
    timestamp: number;
    processingTimeMs: number;
    contentLength: number;
    provider: string;
  };
}

interface CacheEntry {
  result: AIAnalysisResponse;
  timestamp: number;
  contentHash: string;
}

export class AIContentAnalyzer {
  private config: AnalyzerConfig;
  private cache = new Map<string, CacheEntry>();
  private isProcessing = false;
  private patternTracker: PatternTracker;

  constructor(config: AnalyzerConfig) {
    this.config = config;
    this.patternTracker = new PatternTracker();
  }

  /**
   * Analyze content and provide recommendations for scroll behavior
   */
  public async analyzeContent(
    contentData: string,
    context: {
      scrollCount: number;
      maxScrolls: number;
      domain: string;
      scrollStartTime: number;
    }
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    if (!this.config.enabled) {
      return this.createErrorResult('AI analysis is disabled', startTime, contentData.length);
    }

    if (this.isProcessing) {
      return this.createErrorResult('Analysis already in progress', startTime, contentData.length);
    }

    this.isProcessing = true;

    try {
      // Check cache first
      if (this.config.cacheEnabled) {
        const cachedResult = this.getCachedResult(contentData, context.domain);
        if (cachedResult) {
          this.isProcessing = false;
          return this.createSuccessResult(cachedResult, startTime, contentData.length, true);
        }
      }

      // Prepare analysis request
      const request: AIAnalysisRequest = {
        content: contentData,
        context: {
          scrollCount: context.scrollCount,
          maxScrolls: context.maxScrolls,
          domain: context.domain,
          timestamp: Date.now(),
          timeOfDay: new Date().toLocaleTimeString(),
          scrollTime: Math.round((Date.now() - context.scrollStartTime) / 60000) // Convert to minutes
        }
      };

      // Perform analysis by sending message to background script with retry
      let response;
      let lastError;
      const maxRetries = 2;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          console.log(`AI ANALYZER: Analysis attempt ${attempt + 1}/${maxRetries + 1}`);
          
          response = await Promise.race([
            browser.runtime.sendMessage({
              type: 'AI_ANALYZE_CONTENT',
              content: request.content,
              context: request.context
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Analysis request timed out after 30 seconds')), 30000)
            )
          ]);
          
          if (response && response.success) {
            break; // Success, exit retry loop
          }
          
          lastError = new Error(response?.error || 'Analysis failed in background script');
          if (attempt < maxRetries) {
            console.log(`AI ANALYZER: Attempt ${attempt + 1} failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
          }
        } catch (error) {
          lastError = error;
          if (attempt < maxRetries) {
            console.log(`AI ANALYZER: Attempt ${attempt + 1} failed with error, retrying...`, error);
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
          }
        }
      }

      if (!response || !response.success) {
        throw lastError || new Error('All retry attempts failed');
      }
      
      const analysis = response.analysis;

      // Cache the result
      if (this.config.cacheEnabled) {
        this.cacheResult(contentData, context.domain, analysis);
      }

      this.isProcessing = false;
      return this.createSuccessResult(analysis, startTime, contentData.length, false);

    } catch (error) {
      this.isProcessing = false;
      console.error('AI ANALYZER: Error during analysis:', error);
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown analysis error',
        startTime,
        contentData.length
      );
    }
  }

  /**
   * Check if analysis should be triggered based on current scroll state
   */
  public shouldTriggerAnalysis(currentScrollCount: number, maxScrolls: number): boolean {
    if (!this.config.enabled || this.isProcessing) {
      return false;
    }

    const scrollsRemaining = maxScrolls - currentScrollCount;
    return scrollsRemaining <= this.config.analysisThreshold;
  }

  /**
   * Apply the AI recommendations to scroll behavior
   */
  public applyRecommendations(
    analysis: AIAnalysisResponse,
    currentMaxScrolls: number,
    domain: string = '',
    scrollCount: number = 0
  ): {
    newMaxScrolls: number;
    shouldShowOverlay: boolean;
    overlayMessage: string;
    overlayType: 'warning' | 'encouragement' | 'break';
    userPattern?: string;
  } {
    const { recommended_action, bonus_scrolls, reasoning, break_suggestion, user_pattern } = analysis;

    // Track the user pattern if available
    if (user_pattern && domain) {
      this.patternTracker.trackPattern(
        user_pattern, 
        domain, 
        scrollCount, 
        analysis.addiction_risk || 0, 
        analysis.educational_value || 0
      );
    }

    switch (recommended_action) {
      case 'session_extension':
        return {
          newMaxScrolls: currentMaxScrolls + (bonus_scrolls || 15), // Default 15-20 scrolls for deep learning
          shouldShowOverlay: true,
          overlayMessage: `🎯 Deep Focus Detected! Keep learning! ${reasoning}`,
          overlayType: 'encouragement',
          userPattern: user_pattern
        };

      case 'gentle_reward':
        return {
          newMaxScrolls: currentMaxScrolls + (bonus_scrolls || 3), // Default 3-5 scrolls for quality content
          shouldShowOverlay: true,
          overlayMessage: `😊 Quality Time! Enjoying some quality content! ${reasoning}`,
          overlayType: 'encouragement',
          userPattern: user_pattern
        };

      case 'bonus_scrolls': // Legacy support
        return {
          newMaxScrolls: currentMaxScrolls + bonus_scrolls,
          shouldShowOverlay: true,
          overlayMessage: `🎉 Productive content detected! Added ${bonus_scrolls} bonus scrolls. ${reasoning}`,
          overlayType: 'encouragement',
          userPattern: user_pattern
        };

      case 'show_warning':
        return {
          newMaxScrolls: currentMaxScrolls,
          shouldShowOverlay: true,
          overlayMessage: `⚠️ Check Your Focus: ${reasoning}. Consider taking a break soon.`,
          overlayType: 'warning',
          userPattern: user_pattern
        };

      case 'immediate_break':
        return {
          newMaxScrolls: currentMaxScrolls,
          shouldShowOverlay: true,
          overlayMessage: `🛑 Time for a Break! ${reasoning}${break_suggestion ? ` Try: ${break_suggestion}` : ''}`,
          overlayType: 'break',
          userPattern: user_pattern
        };

      case 'maintain_limit':
      default:
        return {
          newMaxScrolls: currentMaxScrolls,
          shouldShowOverlay: true,
          overlayMessage: `📱 Mindful Browsing: ${reasoning || 'Continue browsing mindfully'}`,
          overlayType: 'warning',
          userPattern: user_pattern
        };
    }
  }

  /**
   * Get the pattern tracker instance
   */
  public getPatternTracker(): PatternTracker {
    return this.patternTracker;
  }

  /**
   * Get cached analysis result if available and valid
   */
  private getCachedResult(content: string, domain: string): AIAnalysisResponse | null {
    const contentHash = this.hashContent(content);
    const cacheKey = `${domain}_${contentHash}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.config.cacheDurationMs) {
      console.log('AI ANALYZER: Using cached result');
      return cached.result;
    }

    if (cached) {
      this.cache.delete(cacheKey); // Remove expired cache
    }

    return null;
  }

  /**
   * Cache analysis result
   */
  private cacheResult(content: string, domain: string, result: AIAnalysisResponse): void {
    const contentHash = this.hashContent(content);
    const cacheKey = `${domain}_${contentHash}`;
    
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      contentHash
    });

    // Clean up old cache entries (keep only last 50)
    if (this.cache.size > 50) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      entries.slice(0, entries.length - 50).forEach(([key]) => {
        this.cache.delete(key);
      });
    }
  }

  /**
   * Simple content hash for caching
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Create success result
   */
  private createSuccessResult(
    analysis: AIAnalysisResponse,
    startTime: number,
    contentLength: number,
    cached: boolean
  ): AnalysisResult {
    return {
      success: true,
      analysis,
      cached,
      metadata: {
        timestamp: Date.now(),
        processingTimeMs: Date.now() - startTime,
        contentLength,
        provider: 'gemini' // This will need to be updated if a new provider is added
      }
    };
  }

  /**
   * Create error result
   */
  private createErrorResult(
    error: string,
    startTime: number,
    contentLength: number
  ): AnalysisResult {
    return {
      success: false,
      error,
      metadata: {
        timestamp: Date.now(),
        processingTimeMs: Date.now() - startTime,
        contentLength,
        provider: 'gemini' // This will need to be updated if a new provider is added
      }
    };
  }

  /**
   * Update analyzer configuration
   */
  public updateConfig(newConfig: Partial<AnalyzerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Test the AI provider connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      // Ask background script to test the connection
      const response = await browser.runtime.sendMessage({ type: 'TEST_BACKEND_CONNECTION' });
      return response.success && response.connected;
    } catch (error) {
      console.error('AI ANALYZER: Connection test failed:', error);
      return false;
    }
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
    console.log('AI ANALYZER: Cache cleared');
  }

  /**
   * Get analyzer status
   */
  public getStatus(): {
    enabled: boolean;
    provider: string;
    isProcessing: boolean;
    cacheSize: number;
    config: AnalyzerConfig;
  } {
    return {
      enabled: this.config.enabled,
      provider: 'gemini', // This will need to be updated if a new provider is added
      isProcessing: this.isProcessing,
      cacheSize: this.cache.size,
      config: this.config
    };
  }
}

// Factory function for creating analyzer
export function createAIAnalyzer(config: AnalyzerConfig): AIContentAnalyzer {
  return new AIContentAnalyzer(config);
}

// Default configuration
export const DEFAULT_ANALYZER_CONFIG: AnalyzerConfig = {
  enabled: true,
  analysisThreshold: 3, // Trigger when 3 scrolls remaining
  cacheEnabled: true,
  cacheDurationMs: 10 * 60 * 1000 // 10 minutes
}; 