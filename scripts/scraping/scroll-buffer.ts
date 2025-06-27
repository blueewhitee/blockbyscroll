/**
 * Scroll buffer for tracking the last 3 scrolls of content
 */

import { ScrapedContent } from './content-extractor';

export interface ScrollSnapshot {
  scrollPosition: number;
  timestamp: number;
  content: ScrapedContent;
  scrollDirection: 'up' | 'down';
}

export class ScrollBuffer {
  private buffer: ScrollSnapshot[] = [];
  private maxBufferSize = 3;
  private lastScrollPosition = 0;
  private scrollThreshold = 100; // Minimum pixels to consider a "scroll"

  constructor() {
    this.lastScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
  }

  /**
   * Add new content snapshot to buffer
   */
  public addSnapshot(content: ScrapedContent): void {
    const currentScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    const scrollDifference = Math.abs(currentScrollPosition - this.lastScrollPosition);

    // Only add if there's been significant scrolling
    if (scrollDifference < this.scrollThreshold && this.buffer.length > 0) {
      return;
    }

    const scrollDirection: 'up' | 'down' = currentScrollPosition > this.lastScrollPosition ? 'down' : 'up';

    const snapshot: ScrollSnapshot = {
      scrollPosition: currentScrollPosition,
      timestamp: Date.now(),
      content,
      scrollDirection
    };

    // Add to buffer
    this.buffer.push(snapshot);

    // Maintain buffer size
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift(); // Remove oldest
    }

    this.lastScrollPosition = currentScrollPosition;
  }

  /**
   * Get all snapshots in chronological order
   */
  public getSnapshots(): ScrollSnapshot[] {
    return [...this.buffer];
  }

  /**
   * Get the most recent snapshot
   */
  public getLatestSnapshot(): ScrollSnapshot | null {
    return this.buffer.length > 0 ? this.buffer[this.buffer.length - 1] : null;
  }

  /**
   * Get combined content from all snapshots for LLM analysis
   */
  public getCombinedContent(): {
    aggregatedContent: ScrapedContent;
    snapshots: ScrollSnapshot[];
  } {
    if (this.buffer.length === 0) {
      throw new Error('No content in buffer');
    }

    const latestSnapshot = this.buffer[this.buffer.length - 1];
    const allContent: any[] = [];
    const seenTexts = new Set<string>();

    // Combine content from all snapshots, avoiding duplicates
    this.buffer.forEach((snapshot, index) => {
      snapshot.content.content.forEach(item => {
        // Use first 100 characters as key to avoid exact duplicates
        const textKey = item.text.substring(0, 100);
        if (!seenTexts.has(textKey)) {
          seenTexts.add(textKey);
          allContent.push({
            ...item,
            snapshotIndex: index,
            snapshotTimestamp: snapshot.timestamp,
            scrollPosition: snapshot.scrollPosition
          });
        }
      });
    });

    // Sort by priority and recency
    allContent.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.snapshotTimestamp - a.snapshotTimestamp;
    });

    const aggregatedContent: ScrapedContent = {
      url: latestSnapshot.content.url,
      domain: latestSnapshot.content.domain,
      timestamp: latestSnapshot.content.timestamp,
      scrollPosition: latestSnapshot.scrollPosition,
      content: allContent.slice(0, 30), // Limit to top 30 items
      metadata: {
        totalElements: allContent.length,
        totalTextLength: allContent.reduce((sum: number, item: any) => sum + item.text.length, 0),
        viewportSize: latestSnapshot.content.metadata.viewportSize
      }
    };

    return {
      aggregatedContent,
      snapshots: this.getSnapshots()
    };
  }

  /**
   * Format combined content for LLM with scroll context
   */
  public formatForLLM(): string {
    const { aggregatedContent, snapshots } = this.getCombinedContent();

    const llmData = {
      analysis_context: {
        domain: aggregatedContent.domain,
        url: aggregatedContent.url,
        scroll_behavior: {
          total_snapshots: snapshots.length,
          scroll_positions: snapshots.map(s => s.scrollPosition),
          scroll_directions: snapshots.map(s => s.scrollDirection),
          time_span_ms: snapshots.length > 1 ? 
            snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp : 0
        }
      },
      content_from_last_scrolls: aggregatedContent.content.map(item => ({
        type: item.type,
        text: item.text,
        priority: item.priority,
        visibility: item.visibilityRatio,
        from_scroll: item.snapshotIndex + 1, // 1-based indexing for clarity
        scroll_position: item.scrollPosition
      })),
      summary: {
        total_unique_content_items: aggregatedContent.content.length,
        total_text_length: aggregatedContent.metadata.totalTextLength,
        most_common_content_types: this.getContentTypeDistribution(aggregatedContent.content)
      }
    };

    return JSON.stringify(llmData, null, 2);
  }

  /**
   * Get distribution of content types for analysis
   */
  private getContentTypeDistribution(content: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    content.forEach(item => {
      distribution[item.type] = (distribution[item.type] || 0) + 1;
    });
    return distribution;
  }

  /**
   * Check if buffer has enough content for analysis
   */
  public hasEnoughContentForAnalysis(): boolean {
    return this.buffer.length >= 2; // At least 2 scrolls worth of content
  }

  /**
   * Clear the buffer
   */
  public clear(): void {
    this.buffer = [];
    this.lastScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
  }

  /**
   * Get buffer status for debugging
   */
  public getStatus(): {
    bufferSize: number;
    lastScrollPosition: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
  } {
    return {
      bufferSize: this.buffer.length,
      lastScrollPosition: this.lastScrollPosition,
      oldestTimestamp: this.buffer.length > 0 ? this.buffer[0].timestamp : null,
      newestTimestamp: this.buffer.length > 0 ? this.buffer[this.buffer.length - 1].timestamp : null
    };
  }
} 