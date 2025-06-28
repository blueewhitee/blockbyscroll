/**
 * Content extraction and formatting utilities for LLM consumption
 */

import { VisibleElement } from './viewport-detector';

export interface ScrapedContent {
  url: string;
  domain: string;
  timestamp: number;
  scrollPosition: number;
  content: ContentItem[];
  metadata: {
    totalElements: number;
    totalTextLength: number;
    viewportSize: { width: number; height: number };
  };
}

export interface ContentItem {
  type: 'heading' | 'paragraph' | 'post' | 'article' | 'other';
  text: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  visibilityRatio: number;
  priority: number; // Higher priority = more important content
}

export class ContentExtractor {
  
  /**
   * Extract and format content for LLM analysis
   */
  public extractContent(visibleElements: VisibleElement[]): ScrapedContent {
    const url = window.location.href;
    const domain = window.location.hostname.replace(/^www\./, '');
    const timestamp = Date.now();
    const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;

    const contentItems: ContentItem[] = this.processVisibleElements(visibleElements);
    
    return {
      url,
      domain,
      timestamp,
      scrollPosition,
      content: contentItems,
      metadata: {
        totalElements: contentItems.length,
        totalTextLength: contentItems.reduce((sum, item) => sum + item.text.length, 0),
        viewportSize: {
          width: window.innerWidth || document.documentElement.clientWidth,
          height: window.innerHeight || document.documentElement.clientHeight
        }
      }
    };
  }

  /**
   * Process visible elements and categorize content
   */
  private processVisibleElements(visibleElements: VisibleElement[]): ContentItem[] {
    const contentItems: ContentItem[] = [];

    visibleElements.forEach((visibleElement) => {
      const { element, text, boundingRect, visibilityRatio } = visibleElement;
      
      if (text.trim().length < 10) return; // Skip short content

      const contentType = this.determineContentType(element);
      const priority = this.calculatePriority(element, text, visibilityRatio, contentType);

      contentItems.push({
        type: contentType,
        text: this.cleanText(text),
        position: {
          x: Math.round(boundingRect.left),
          y: Math.round(boundingRect.top)
        },
        size: {
          width: Math.round(boundingRect.width),
          height: Math.round(boundingRect.height)
        },
        visibilityRatio: Math.round(visibilityRatio * 100) / 100,
        priority
      });
    });

    // Sort by priority (highest first) and return top content
    return contentItems
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 20); // Limit to top 20 most important pieces of content
  }

  /**
   * Determine the type of content based on element
   */
  private determineContentType(element: Element): ContentItem['type'] {
    const tagName = element.tagName.toLowerCase();
    const className = element.className || '';
    const id = element.id || '';
    const combinedText = `${className} ${id}`.toLowerCase();

    // Check for headings
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      return 'heading';
    }

    // Check for posts (social media)
    if (combinedText.includes('post') || 
        combinedText.includes('tweet') || 
        element.hasAttribute('data-testid')) {
      return 'post';
    }

    // Check for articles
    if (tagName === 'article' || 
        combinedText.includes('article') || 
        combinedText.includes('story')) {
      return 'article';
    }

    // Check for paragraphs
    if (tagName === 'p') {
      return 'paragraph';
    }

    return 'other';
  }

  /**
   * Calculate priority score for content (1-10)
   */
  private calculatePriority(
    element: Element, 
    text: string, 
    visibilityRatio: number, 
    contentType: ContentItem['type']
  ): number {
    let priority = 1;

    // Base priority by content type
    const typePriorities = {
      'heading': 8,
      'article': 7,
      'post': 6,
      'paragraph': 4,
      'other': 2
    };
    priority = typePriorities[contentType];

    // Boost for visibility
    priority += visibilityRatio * 2;

    // Boost for text length (longer content often more important)
    if (text.length > 200) priority += 1;
    if (text.length > 500) priority += 1;

    // Boost for center of viewport
    const rect = element.getBoundingClientRect();
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const distanceFromCenter = Math.sqrt(
      Math.pow(rect.left + rect.width/2 - centerX, 2) + 
      Math.pow(rect.top + rect.height/2 - centerY, 2)
    );
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
    const centerBoost = 1 - (distanceFromCenter / maxDistance);
    priority += centerBoost;

    // Penalize very short or very long text
    if (text.length < 20) priority -= 1;
    if (text.length > 2000) priority -= 0.5;

    return Math.max(1, Math.min(10, Math.round(priority * 10) / 10));
  }

  /**
   * Clean and normalize text content
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\n+/g, ' ') // Newlines to spaces
      .trim()
      .substring(0, 1000); // Limit text length for API efficiency
  }

  /**
   * Format content for LLM API consumption
   */
  public formatForLLM(scrapedContent: ScrapedContent): string {
    const llmData = {
      domain: scrapedContent.domain,
      timestamp: new Date(scrapedContent.timestamp).toISOString(),
      content_summary: {
        total_items: scrapedContent.content.length,
        total_text_length: scrapedContent.metadata.totalTextLength
      },
      visible_content: scrapedContent.content.map(item => ({
        type: item.type,
        text: item.text,
        priority: item.priority,
        visibility: item.visibilityRatio
      })),
      page_context: {
        url: scrapedContent.url,
        scroll_position: scrapedContent.scrollPosition,
        viewport: scrapedContent.metadata.viewportSize
      }
    };

    return JSON.stringify(llmData, null, 2);
  }

  /**
   * Create a condensed version for API efficiency
   */
  public formatCondensedForLLM(scrapedContent: ScrapedContent): string {
    // Get only the most important content (priority >= 6)
    const importantContent = scrapedContent.content
      .filter(item => item.priority >= 6)
      .slice(0, 10)
      .map(item => ({
        type: item.type,
        text: item.text.substring(0, 300), // Limit text length
        priority: item.priority
      }));

    const condensedData = {
      domain: scrapedContent.domain,
      content: importantContent,
      context: {
        total_elements: scrapedContent.content.length,
        scroll_position: scrapedContent.scrollPosition
      }
    };

    return JSON.stringify(condensedData);
  }
} 