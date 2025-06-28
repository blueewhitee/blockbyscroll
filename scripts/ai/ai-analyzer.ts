/**
 * Main AI content analyzer that orchestrates the analysis process
 */

import { GeminiProvider, AIAnalysisResponse, AIAnalysisRequest, GeminiConfig } from './providers/gemini-provider';

export interface AnalyzerConfig {
  enabled: boolean;
  provider: 'gemini';
  geminiConfig: GeminiConfig;
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
  private provider: GeminiProvider;
  private cache = new Map<string, CacheEntry>();
  private isProcessing = false;

  constructor(config: AnalyzerConfig) {
    this.config = config;
    this.provider = new GeminiProvider(config.geminiConfig);
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

      // Perform analysis
      const analysis = await this.provider.analyzeContent(request);

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
    currentMaxScrolls: number
  ): {
    newMaxScrolls: number;
    shouldShowOverlay: boolean;
    overlayMessage: string;
    overlayType: 'warning' | 'encouragement' | 'break';
  } {
    const { recommended_action, bonus_scrolls, reasoning, break_suggestion } = analysis;

    switch (recommended_action) {
      case 'bonus_scrolls':
        return {
          newMaxScrolls: currentMaxScrolls + bonus_scrolls,
          shouldShowOverlay: true,
          overlayMessage: `🎉 Productive content detected! Added ${bonus_scrolls} bonus scrolls. ${reasoning}`,
          overlayType: 'encouragement'
        };

      case 'show_warning':
        return {
          newMaxScrolls: currentMaxScrolls,
          shouldShowOverlay: true,
          overlayMessage: `⚠️ Warning: ${reasoning}. Consider taking a break soon.`,
          overlayType: 'warning'
        };

      case 'immediate_break':
        return {
          newMaxScrolls: currentMaxScrolls,
          shouldShowOverlay: true,
          overlayMessage: `🛑 Time for a break! ${reasoning}${break_suggestion ? ` Try: ${break_suggestion}` : ''}`,
          overlayType: 'break'
        };

      case 'maintain_limit':
      default:
        return {
          newMaxScrolls: currentMaxScrolls,
          shouldShowOverlay: false,
          overlayMessage: reasoning,
          overlayType: 'warning'
        };
    }
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
        provider: this.config.provider
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
        provider: this.config.provider
      }
    };
  }

  /**
   * Update analyzer configuration
   */
  public updateConfig(newConfig: Partial<AnalyzerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.geminiConfig) {
      this.provider.updateConfig(newConfig.geminiConfig);
    }
  }

  /**
   * Test the AI provider connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      return await this.provider.testConnection();
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
      provider: this.config.provider,
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
  provider: 'gemini',
  geminiConfig: {
    apiKey: 'AIzaSyCYsgshv7TI7I2y5o6O6jvsaiB6PRRa30E',
    model: 'gemini-1.5-flash',
    temperature: 0.3,
    maxTokens: 1000
  },
  analysisThreshold: 3, // Trigger when 3 scrolls remaining
  cacheEnabled: true,
  cacheDurationMs: 10 * 60 * 1000 // 10 minutes
}; 