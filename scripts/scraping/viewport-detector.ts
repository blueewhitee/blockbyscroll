/**
 * Viewport detection utilities for identifying visible content
 */

export interface VisibleElement {
  element: Element;
  text: string;
  boundingRect: DOMRect;
  visibilityRatio: number;
}

export class ViewportDetector {
  private observer: IntersectionObserver | null = null;
  private visibleElements: Set<Element> = new Set();

  constructor() {
    this.initializeObserver();
  }

  private initializeObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.1) {
            this.visibleElements.add(entry.target);
          } else {
            this.visibleElements.delete(entry.target);
          }
        });
      },
      {
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
        rootMargin: '0px'
      }
    );
  }

  /**
   * Get all currently visible elements with meaningful content
   */
  public getVisibleElements(): VisibleElement[] {
    const contentSelectors = [
      'article', 'main', 'section', 'div[role="main"]',
      '[data-testid*="tweet"]', '[data-testid*="post"]',
      '.post', '.article', '.content', '.entry',
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      '.video-title', '.title', '.headline',
      '[class*="post"]', '[class*="article"]', '[class*="content"]'
    ];

    const allElements = document.querySelectorAll(contentSelectors.join(', '));
    const visibleElements: VisibleElement[] = [];

    allElements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const isInViewport = this.isElementInViewport(rect);
      
      if (isInViewport) {
        const text = this.extractElementText(element);
        if (text.trim().length > 10) { // Only elements with meaningful text
          visibleElements.push({
            element,
            text,
            boundingRect: rect,
            visibilityRatio: this.calculateVisibilityRatio(rect)
          });
        }
      }
    });

    return visibleElements.sort((a, b) => b.visibilityRatio - a.visibilityRatio);
  }

  /**
   * Check if element is currently in viewport
   */
  private isElementInViewport(rect: DOMRect): boolean {
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;

    return (
      rect.top < windowHeight &&
      rect.bottom > 0 &&
      rect.left < windowWidth &&
      rect.right > 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  /**
   * Calculate how much of the element is visible (0-1)
   */
  private calculateVisibilityRatio(rect: DOMRect): number {
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;

    const visibleHeight = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
    const visibleWidth = Math.min(rect.right, windowWidth) - Math.max(rect.left, 0);
    
    const visibleArea = Math.max(0, visibleHeight) * Math.max(0, visibleWidth);
    const totalArea = rect.width * rect.height;

    return totalArea > 0 ? visibleArea / totalArea : 0;
  }

  /**
   * Extract text content from element, excluding navigation and ads
   */
  private extractElementText(element: Element): string {
    // Skip navigation, ads, and other non-content elements
    const skipSelectors = [
      'nav', 'header', 'footer', 'aside',
      '.ad', '.advertisement', '.sponsored',
      '.navigation', '.menu', '.sidebar',
      'button', 'input', 'select', 'textarea',
      '[class*="ad-"]', '[class*="ads-"]',
      '[aria-label*="advertisement"]'
    ];

    if (skipSelectors.some(selector => element.matches(selector))) {
      return '';
    }

    // Remove child elements that are ads or navigation
    const clone = element.cloneNode(true) as Element;
    skipSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    return clone.textContent?.trim() || '';
  }

  /**
   * Get viewport dimensions and scroll position
   */
  public getViewportInfo(): {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
  } {
    return {
      width: window.innerWidth || document.documentElement.clientWidth,
      height: window.innerHeight || document.documentElement.clientHeight,
      scrollX: window.pageXOffset || document.documentElement.scrollLeft,
      scrollY: window.pageYOffset || document.documentElement.scrollTop
    };
  }

  /**
   * Cleanup observer
   */
  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.visibleElements.clear();
  }
} 