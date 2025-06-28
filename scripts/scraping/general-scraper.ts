/**
 * General scraper for extracting content from any website in the block list
 */

import { ViewportDetector } from './viewport-detector';
import { ContentExtractor, ScrapedContent } from './content-extractor';
import { ScrollBuffer } from './scroll-buffer';

export interface ScrapingConfig {
  distractingSites: string[];
  enabled: boolean;
  minScrollsForAnalysis: number;
}

export interface ScrapingResult {
  success: boolean;
  data?: string; // JSON formatted for LLM
  error?: string;
  metadata?: {
    domain: string;
    contentItems: number;
    scrollPosition: number;
    timestamp: number;
  };
}

export class GeneralScraper {
  private viewportDetector: ViewportDetector;
  private contentExtractor: ContentExtractor;
  private scrollBuffer: ScrollBuffer;
  private config: ScrapingConfig;
  private isInitialized = false;

  constructor(config: ScrapingConfig) {
    this.config = config;
    this.viewportDetector = new ViewportDetector();
    this.contentExtractor = new ContentExtractor();
    this.scrollBuffer = new ScrollBuffer();
  }

  /**
   * Initialize the scraper (call when content script loads)
   */
  public initialize(): boolean {
    if (!this.config.enabled) {
      console.log('SCRAPER: Scraping is disabled');
      return false;
    }

    if (!this.isOnMonitoredSite()) {
      console.log('SCRAPER: Current site not in block list');
      return false;
    }

    this.isInitialized = true;
    console.log('SCRAPER: Initialized for site:', this.getCurrentDomain());
    return true;
  }

  /**
   * Check if current site is in the block list
   */
  private isOnMonitoredSite(): boolean {
    const currentDomain = this.getCurrentDomain();
    return this.config.distractingSites.some(site => 
      currentDomain.includes(site) || site.includes(currentDomain)
    );
  }

  /**
   * Get current domain
   */
  private getCurrentDomain(): string {
    return window.location.hostname.replace(/^www\./, '');
  }

  /**
   * Capture current visible content and add to buffer
   */
  public captureCurrentContent(): void {
    if (!this.isInitialized) {
      console.log('SCRAPER: Not initialized, skipping capture');
      return;
    }

    try {
      // Get visible elements
      const visibleElements = this.viewportDetector.getVisibleElements();
      
      if (visibleElements.length === 0) {
        console.log('SCRAPER: No visible elements found');
        return;
      }

      // Extract and format content
      const scrapedContent = this.contentExtractor.extractContent(visibleElements);
      
      // Add to scroll buffer
      this.scrollBuffer.addSnapshot(scrapedContent);

      console.log(`SCRAPER: Captured ${scrapedContent.content.length} content items`);
      
    } catch (error) {
      console.error('SCRAPER: Error capturing content:', error);
    }
  }

  /**
   * Get combined content from last 3 scrolls for LLM analysis
   */
  public getContentForAnalysis(): ScrapingResult {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'Scraper not initialized'
      };
    }

    if (!this.scrollBuffer.hasEnoughContentForAnalysis()) {
      return {
        success: false,
        error: 'Not enough scroll data for analysis'
      };
    }

    try {
      // Get formatted content for LLM
      const llmFormattedData = this.scrollBuffer.formatForLLM();
      const { aggregatedContent } = this.scrollBuffer.getCombinedContent();

      return {
        success: true,
        data: llmFormattedData,
        metadata: {
          domain: aggregatedContent.domain,
          contentItems: aggregatedContent.content.length,
          scrollPosition: aggregatedContent.scrollPosition,
          timestamp: aggregatedContent.timestamp
        }
      };

    } catch (error) {
      console.error('SCRAPER: Error getting content for analysis:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<ScrapingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Re-initialize if settings changed
    if (newConfig.distractingSites || newConfig.enabled !== undefined) {
      this.isInitialized = false;
      if (this.config.enabled) {
        this.initialize();
      }
    }
  }

  /**
   * Check if ready for AI analysis (when 3 scrolls remaining)
   */
  public shouldTriggerAnalysis(currentScrollCount: number, maxScrolls: number): boolean {
    if (!this.isInitialized) return false;
    
    const scrollsRemaining = maxScrolls - currentScrollCount;
    return scrollsRemaining <= 3 && this.scrollBuffer.hasEnoughContentForAnalysis();
  }

  /**
   * Clear buffer (use when scroll counter resets)
   */
  public clearBuffer(): void {
    this.scrollBuffer.clear();
    console.log('SCRAPER: Buffer cleared');
  }

  /**
   * Get current status for debugging
   */
  public getStatus(): {
    initialized: boolean;
    onMonitoredSite: boolean;
    domain: string;
    bufferStatus: any;
    config: ScrapingConfig;
  } {
    return {
      initialized: this.isInitialized,
      onMonitoredSite: this.isOnMonitoredSite(),
      domain: this.getCurrentDomain(),
      bufferStatus: this.scrollBuffer.getStatus(),
      config: this.config
    };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.viewportDetector.destroy();
    this.scrollBuffer.clear();
    this.isInitialized = false;
    console.log('SCRAPER: Destroyed and cleaned up');
  }
}

// Factory function to create scraper instance
export function createScraper(config: ScrapingConfig): GeneralScraper {
  return new GeneralScraper(config);
}

// Helper function to validate scraping config
export function validateScrapingConfig(config: any): config is ScrapingConfig {
  return (
    typeof config === 'object' &&
    Array.isArray(config.distractingSites) &&
    typeof config.enabled === 'boolean' &&
    typeof config.minScrollsForAnalysis === 'number'
  );
} 