import { GeneralScraper, ScrapingConfig, ScrapingResult } from '../scripts/scraping/general-scraper';
import { AIContentAnalyzer, AnalysisResult, DEFAULT_ANALYZER_CONFIG } from '../scripts/ai/ai-analyzer';

// Video overlay configuration interface
interface VideoOverlayConfig {
  enabled: boolean;
  opacity: number;
  autoPlayOnReveal: boolean;
  buttonText: string;
  buttonColor: string;
}

// Video overlay manager class
class VideoOverlayManager {
  private config: VideoOverlayConfig;
  private observer: MutationObserver | null = null;
  private processedVideos = new WeakSet<Element>();
  private intersectionObserver: IntersectionObserver | null = null;
  private styleElement: HTMLStyleElement | null = null;
  
  constructor(config: VideoOverlayConfig) {
    this.config = config;
    this.initializeStyles();
    this.createIntersectionObserver();
  }
  
  private initializeStyles(): void {
    // Remove existing styles if any
    if (this.styleElement) {
      this.styleElement.remove();
    }
    
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'x-video-overlay-styles';
    this.styleElement.textContent = `
      .x-video-container {
        position: relative !important;
        display: inline-block !important;
        width: 100% !important;
        height: 100% !important;
      }
      
      .x-video-overlay {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0, 0, 0, ${this.config.opacity}) !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        z-index: 10 !important;
        cursor: pointer !important;
        transition: opacity 0.2s ease !important;
        border-radius: inherit !important;
      }
      
      .x-video-overlay:hover {
        background: rgba(0, 0, 0, ${Math.min(this.config.opacity + 0.1, 1)}) !important;
      }
      
      .x-video-overlay.hidden {
        display: none !important;
      }
      
      .x-view-video-btn {
        background: ${this.config.buttonColor} !important;
        color: white !important;
        border: none !important;
        padding: 12px 24px !important;
        border-radius: 24px !important;
        font-weight: 600 !important;
        font-size: 15px !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        text-align: center !important;
        white-space: nowrap !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        pointer-events: auto !important;
      }
      
      .x-view-video-btn:hover {
        background: #1a91da !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
      }
      
      .x-view-video-btn:active {
        transform: translateY(0) !important;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2) !important;
      }
      
      /* Ensure videos don't interfere with overlay */
      .x-video-container video {
        pointer-events: none !important;
      }
      
      .x-video-container.revealed video {
        pointer-events: auto !important;
      }
      
      /* Handle different video container types */
      [data-testid="videoPlayer"] .x-video-overlay,
      [data-testid="VideoPlayer"] .x-video-overlay,
      .video-player .x-video-overlay,
      .Video .x-video-overlay {
        border-radius: 16px !important;
      }
      
      /* Mobile responsiveness */
      @media (max-width: 768px) {
        .x-view-video-btn {
          padding: 10px 20px !important;
          font-size: 14px !important;
        }
      }
      
      /* Handle promoted content */
      [data-testid="placementTracking"] .x-video-overlay {
        background: rgba(0, 0, 0, ${Math.min(this.config.opacity + 0.1, 1)}) !important;
      }
      
      [data-testid="placementTracking"] .x-view-video-btn::after {
        content: " (Ad)" !important;
        font-size: 12px !important;
        opacity: 0.8 !important;
      }
    `;
    
    document.head.appendChild(this.styleElement);
  }
  
  private createIntersectionObserver(): void {
    // Use IntersectionObserver for performance - only process visible videos
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.processVideoElement(entry.target);
          }
        });
      },
      {
        rootMargin: '50px', // Start processing videos 50px before they enter viewport
        threshold: 0.1
      }
    );
  }
  
  public initialize(): void {
    if (!this.isXdotCom()) {
      return;
    }
    
    console.log('VIDEO OVERLAY: Initializing video overlay manager for X.com');
    
    // Process existing videos
    this.scanForVideos();
    
    // Start observing for new videos
    this.startMutationObserver();
  }
  
  private isXdotCom(): boolean {
    return window.location.hostname.includes('x.com') || window.location.hostname.includes('twitter.com');
  }
  
  private scanForVideos(): void {
    // Multiple selectors to catch different video types
    const videoSelectors = [
      'video',
      '[data-testid="videoPlayer"] video',
      '[data-testid="VideoPlayer"] video',
      '.video-player video',
      '.Video video',
      '[data-testid="placementTracking"] video', // Promoted videos
      '.media-inline video' // Inline media
    ];
    
    videoSelectors.forEach(selector => {
      const videos = document.querySelectorAll(selector);
      videos.forEach(video => {
        if (this.intersectionObserver && !this.processedVideos.has(video)) {
          this.intersectionObserver.observe(video);
        }
      });
    });
  }
  
  private startMutationObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    this.observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      
      mutations.forEach(mutation => {
        // Check for new nodes containing videos
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            
            // Check if the added node is a video or contains videos
            if (element.tagName === 'VIDEO' || element.querySelector('video')) {
              shouldScan = true;
            }
            
            // Check for X.com specific video containers
            if (element.matches('[data-testid*="video"], [data-testid*="Video"], .video-player, .Video') ||
                element.querySelector('[data-testid*="video"], [data-testid*="Video"], .video-player, .Video')) {
              shouldScan = true;
            }
          }
        });
      });
      
      if (shouldScan) {
        // Debounce scanning to avoid excessive processing
        setTimeout(() => this.scanForVideos(), 100);
      }
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  private processVideoElement(videoElement: Element): void {
    if (!videoElement || this.processedVideos.has(videoElement)) {
      return;
    }
    
    const video = videoElement as HTMLVideoElement;
    
    // Mark as processed
    this.processedVideos.add(video);
    
    // Find the appropriate container for the overlay
    const container = this.findVideoContainer(video);
    if (!container) {
      console.warn('VIDEO OVERLAY: Could not find suitable container for video');
      return;
    }
    
    // Create overlay
    this.createVideoOverlay(video, container);
  }
  
  private findVideoContainer(video: HTMLVideoElement): Element | null {
    // Look for X.com specific video containers
    let current = video.parentElement;
    
    while (current && current !== document.body) {
      // Check for X.com video containers
      if (current.matches('[data-testid*="video"], [data-testid*="Video"], .video-player, .Video, .media-inline') ||
          current.hasAttribute('data-testid') && current.getAttribute('data-testid')?.includes('video')) {
        return current;
      }
      
      // If we find a container with specific dimensions, use it
      const style = window.getComputedStyle(current);
      if (style.position === 'relative' || style.position === 'absolute') {
        const rect = current.getBoundingClientRect();
        if (rect.width > 100 && rect.height > 100) {
          return current;
        }
      }
      
      current = current.parentElement;
    }
    
    // Fallback: use video's direct parent
    return video.parentElement;
  }
  
  private createVideoOverlay(video: HTMLVideoElement, container: Element): void {
    // Check if overlay already exists
    if (container.querySelector('.x-video-overlay')) {
      return;
    }
    
    // Ensure container has relative positioning
    const containerElement = container as HTMLElement;
    if (window.getComputedStyle(containerElement).position === 'static') {
      containerElement.style.position = 'relative';
    }
    
    // Add container class
    containerElement.classList.add('x-video-container');
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'x-video-overlay';
    
    // Create button
    const button = document.createElement('button');
    button.className = 'x-view-video-btn';
    button.textContent = this.config.buttonText;
    button.setAttribute('aria-label', 'Click to reveal and play video');
    
    // Handle click events
    const handleClick = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      this.revealVideo(video, overlay, containerElement);
    };
    
    button.addEventListener('click', handleClick);
    overlay.addEventListener('click', handleClick);
    
    // Append button to overlay
    overlay.appendChild(button);
    
    // Append overlay to container
    containerElement.appendChild(overlay);
    
    // Prevent video autoplay by default
    if (video.autoplay) {
      video.autoplay = false;
    }
    
    // Pause the video if it's playing
    if (!video.paused) {
      video.pause();
    }
    
    console.log('VIDEO OVERLAY: Created overlay for video in container', containerElement);
  }
  
  private revealVideo(video: HTMLVideoElement, overlay: HTMLElement, container: HTMLElement): void {
    // Hide overlay
    overlay.classList.add('hidden');
    
    // Mark container as revealed
    container.classList.add('revealed');
    
    // Handle auto-play setting
    if (this.config.autoPlayOnReveal) {
      video.play().catch(error => {
        console.log('VIDEO OVERLAY: Could not auto-play video (this is normal):', error);
      });
    }
    
    console.log('VIDEO OVERLAY: Video revealed');
    
    // Send analytics event if needed
    this.trackVideoReveal(video);
  }
  
  private trackVideoReveal(video: HTMLVideoElement): void {
    // Optional: Track video reveals for analytics
    try {
      const videoData = {
        src: video.src || video.currentSrc,
        duration: video.duration,
        timestamp: Date.now(),
        url: window.location.href
      };
      
      console.log('VIDEO OVERLAY: Video revealed:', videoData);
    } catch (error) {
      // Ignore tracking errors
    }
  }
  
  public updateConfig(newConfig: Partial<VideoOverlayConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.initializeStyles();
  }
  
  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
    
    // Remove all overlays
    document.querySelectorAll('.x-video-overlay').forEach(overlay => {
      overlay.remove();
    });
    
    // Remove container classes
    document.querySelectorAll('.x-video-container').forEach(container => {
      container.classList.remove('x-video-container', 'revealed');
    });
    
    console.log('VIDEO OVERLAY: Manager destroyed');
  }
  
  public getStats(): { totalVideos: number, revealedVideos: number } {
    const totalVideos = document.querySelectorAll('.x-video-container').length;
    const revealedVideos = document.querySelectorAll('.x-video-container.revealed').length;
    
    return { totalVideos, revealedVideos };
  }
}

declare global {
  interface Window {
    _scrollStopObserver: MutationObserver | null;
    _twitterFixInterval: number | null;
    _youtubeSettingsObserver: MutationObserver | null;
    setTimeout(callback: (...args: any[]) => void, ms?: number): number;
    clearTimeout(timeoutId?: number): void;
    setInterval(callback: (...args: any[]) => void, ms?: number): number;
    clearInterval(intervalId?: number): void;
  }
  
  interface HTMLElement {
    _reelsObserved?: boolean;
  }
}

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*', 'file://*/*'], // Added file://*/*
  runAt: 'document_idle', // Added runAt
  main() {
    // Get the current hostname
    const currentHost = window.location.hostname.replace(/^www\./, '');
    
    // Initialize variables
    let scrollCount = 0;
    let maxScrolls = 30; // Default value to 30
    let isBlocked = false;
    let distractingSites = ['youtube.com', 'x.com', 'reddit.com','instagram.com','facebook.com']; // Default sites
    let resetInterval = 0; // Default: no auto reset
    let lastResetTime = Date.now();
    let customLimits: Record<string, number> = {}; // Custom scroll limits per domain
    let temporaryBonusScrolls: Record<string, number> = {}; // Temporary bonus scrolls per domain (reset on timer/manual reset)
    let adBlockerCompatMode = true; // Enable compatibility mode for ad blockers
    
    // AI Content Analysis variables
    let contentScraper: GeneralScraper | null = null;
    let aiAnalyzer: AIContentAnalyzer | null = null;
    let scrollStartTime = Date.now();
    let aiAnalysisEnabled = true; // Default enabled
    let hasTriggeredAIAnalysis = false; // Prevent multiple analyses per session
    let isAwaitingPostTriggerScrolls = false; // Flag for new analysis logic
    let postTriggerScrollCount = 0; // Counter for new analysis logic
    let isAnalysisInProgress = false; // Prevent race conditions
    
    // Grace period variables for pending analysis
    let isInGracePeriod = false; // Whether we're in grace period waiting for analysis
    let gracePeriodScrollsUsed = 0; // How many grace scrolls have been used
    let maxGracePeriodScrolls = 5; // Maximum extra scrolls allowed during grace period
    let gracePeriodStartTime = 0; // When grace period started
    let maxGracePeriodDuration = 15000; // 15 seconds max grace period
    
    // Video Overlay variables
    let videoOverlayManager: VideoOverlayManager | null = null;
    let videoOverlaySettings = {
      enabled: true,
      opacity: 0.9,
      autoPlayOnReveal: false,
      buttonText: 'View Video',
      buttonColor: '#1DA1F2'
    };
    
    // YouTube-specific settings
    let youtubeSettings = {
      hideShorts: false,
      hideHomeFeed: false
    };
    // Instagram-specific settings
    let instagramSettings = {
      hideReels: false
    };
    // Pomodoro settings
    let isPomodoroActive = false;
    let pomodoroRemainingMinutes = 0;
    let pomodoroRemainingSeconds = 0;
    let pomodoroDuration = 0;
    let pomodoroEndTime = 0;
    let pomodoroUpdateInterval: ReturnType<typeof globalThis.setInterval> | null = null;
    let pomodoroOverlay: HTMLElement;

    function checkIfPdf(): boolean {
      const isPdf = (
        (window.location.protocol === 'file:' && window.location.pathname.endsWith('.pdf')) ||
        window.location.pathname.endsWith('.pdf') ||
        document.contentType === 'application/pdf' ||
        document.querySelector('embed[type="application/pdf"]') !== null ||
        document.querySelector('object[type="application/pdf"]') !== null ||
        (document.body && document.body.children.length === 1 && document.body.children[0].tagName === 'EMBED' && (document.body.children[0] as HTMLEmbedElement).type === 'application/pdf') ||
        (document.documentElement && document.documentElement.innerHTML.includes('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai') && window.location.href.endsWith('.pdf'))
      );
      // console.log(`CONTENT SCRIPT: checkIfPdf() evaluated: ${isPdf}, Path: ${window.location.pathname}, Type: ${document.contentType}`); // Keep for debugging if needed
      return isPdf;
    }
    
    // Create overlay for when scrolling is blocked
    const overlay = document.createElement('div');
    overlay.id = 'scroll-stop-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: rgba(0, 0, 0, 0.95);
      color: white;
      display: none;
      z-index: 2147483647; /* Maximum z-index value */
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
      pointer-events: auto !important;
      touch-action: none;
    `;
    
    // Add warning elements to the overlay
    const overlayIcon = document.createElement('div');
    overlayIcon.innerHTML = '⚠️';
    overlayIcon.style.cssText = `
      font-size: 64px;
      margin-bottom: 20px;
    `;
    
    const overlayTitle = document.createElement('h2');
    overlayTitle.textContent = 'Scrolling Limit Reached';
    overlayTitle.style.cssText = `
      font-size: 28px;
      margin: 0 0 15px 0;
      color: #fff;
    `;
    
    const overlayMessage = document.createElement('p');
    overlayMessage.textContent = 'You\'ve reached your maximum number of scrolls for this site.';
    overlayMessage.style.cssText = `
      font-size: 18px;
      max-width: 500px;
      margin: 0 0 10px 0;
      color: #eee;
    `;
    
    const overlayHint = document.createElement('p');
    overlayHint.style.cssText = `
      font-size: 16px;
      max-width: 500px;
      margin: 10px 0 0 0;
      color: #bbb;
    `;
    
    // This will be updated dynamically when timer is set
    const overlayTimer = document.createElement('div');
    overlayTimer.id = 'scroll-stop-timer';
    overlayTimer.style.cssText = `
      font-size: 16px;
      margin-top: 20px;
      padding: 10px 15px;
      border-radius: 5px;
      background-color: rgba(255, 255, 255, 0.1);
    `;
    
    // Append all elements to the overlay
    overlay.appendChild(overlayIcon);
    overlay.appendChild(overlayTitle);
    overlay.appendChild(overlayMessage);
    overlay.appendChild(overlayHint);
    overlay.appendChild(overlayTimer);
    
    // Create pending analysis overlay
    const pendingOverlay = document.createElement('div');
    pendingOverlay.id = 'pending-analysis-overlay';
    pendingOverlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.95), rgba(99, 102, 241, 0.95));
      color: white;
      padding: 25px 35px;
      border-radius: 16px;
      max-width: 450px;
      text-align: center;
      z-index: 2147483645;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      display: none;
    `;
    
    pendingOverlay.innerHTML = `
      <div style="font-size: 24px; margin-bottom: 15px;">🔍</div>
      <h3 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 600;">Analyzing Your Session...</h3>
      <p style="margin: 0 0 15px 0; font-size: 14px; opacity: 0.9; line-height: 1.4;">
        You've reached your scroll limit. We're checking your activity to see if you deserve bonus scrolls.
      </p>
      <div id="grace-period-info" style="font-size: 13px; opacity: 0.8; margin-bottom: 15px;">
        You may continue for <span id="grace-scrolls-remaining">5</span> more scrolls while we analyze.
      </div>
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; opacity: 0.7;">
        <div class="spinner" style="
          width: 16px; 
          height: 16px; 
          border: 2px solid rgba(255,255,255,0.3); 
          border-top: 2px solid white; 
          border-radius: 50%; 
          animation: spin 1s linear infinite;
        "></div>
        <span>Please wait...</span>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    
    // Create a counter display
    const counter = document.createElement('div');
    counter.id = 'scroll-stop-counter';
    counter.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: rgba(29, 161, 242, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 20px;
      font-weight: bold;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: none;
      pointer-events: none;
    `;
    
    // Add listener for messages from the background script
    browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
      console.log('CONTENT SCRIPT: Received message:', JSON.stringify(message));

      // Helper function to remove the completion modal
      const removeCompletionModal = () => {
        const existingModal = document.getElementById('pomodoro-completion-modal-unique');
        if (existingModal) {
          try {
            existingModal.remove();
            console.log('CONTENT SCRIPT: Removed pomodoro completion modal.');
          } catch (e) {
            console.error('CONTENT SCRIPT: Error removing existing modal:', e);
          }
        }
        const breakOverModal = document.getElementById('pomodoro-break-over-modal-unique');
        if (breakOverModal) {
          try {
            breakOverModal.remove();
            console.log('CONTENT SCRIPT: Removed break over modal.');
          } catch (e) {
            console.error('CONTENT SCRIPT: Error removing break over modal:', e);
          }
        }
      };
      
      if (message.type === 'POMODORO_UPDATE') {
        removeCompletionModal(); // Remove modal before processing update
        console.log('CONTENT SCRIPT: POMODORO_UPDATE received. isActive:', message.isActive, 'Force display:', message.forceDisplay);
        if (message.isActive) {
          isPomodoroActive = true;
          pomodoroRemainingMinutes = message.remaining.minutes;
          pomodoroRemainingSeconds = message.remaining.seconds;
          pomodoroDuration = message.duration;
          const remainingMs = (message.remaining.minutes * 60 + message.remaining.seconds) * 1000;
          pomodoroEndTime = Date.now() + remainingMs;
          
          await createPomodoroOverlay(); // Await creation and DOM insertion
          
          updatePomodoroDisplay(message.remaining.minutes, message.remaining.seconds, message.duration, message.isBreak);
          
          if (message.forceDisplay || isPomodoroActive) {
            console.log('CONTENT SCRIPT: Attempting to show pomodoro overlay via POMODORO_UPDATE. Overlay object:', pomodoroOverlay, 'isPomodoroActive:', isPomodoroActive, 'forceDisplay:', message.forceDisplay);
            if (pomodoroOverlay) {
              pomodoroOverlay.style.setProperty('display', 'block', 'important'); // Ensure display:block overrides other styles
              console.log('CONTENT SCRIPT: Set pomodoro overlay display to block via POMODORO_UPDATE. Current display style:', pomodoroOverlay.style.display);
            } else {
              console.error('CONTENT SCRIPT: pomodoroOverlay is null or undefined when trying to show it in POMODORO_UPDATE.');
            }
          }
          
          if (pomodoroOverlay) {
            if (message.isBreak) {
              console.log('CONTENT SCRIPT: Setting break styling.');
              pomodoroOverlay.style.backgroundColor = 'rgba(33, 150, 243, 0.85)';
              const iconElement = pomodoroOverlay.querySelector('.pomodoro-icon');
              if (iconElement) iconElement.textContent = '☕';
            } else {
              console.log('CONTENT SCRIPT: Setting regular pomodoro styling.');
              pomodoroOverlay.style.backgroundColor = 'rgba(76, 175, 80, 0.85)';
              const iconElement = pomodoroOverlay.querySelector('.pomodoro-icon');
              if (iconElement) iconElement.textContent = '🍅';
            }
          }
          startLocalPomodoroUpdate();
        } else {
          console.log('CONTENT SCRIPT: POMODORO_UPDATE received: inactive.');
          isPomodoroActive = false;
          if (pomodoroOverlay) pomodoroOverlay.style.display = 'none';
          stopLocalPomodoroUpdate();
        }
      } else if (message.type === 'POMODORO_COMPLETE_PROMPT') {
        console.log('CONTENT SCRIPT: POMODORO_COMPLETE_PROMPT received. Duration:', message.duration);
        
        // Always hide the timer overlay when showing the completion modal
        if (pomodoroOverlay) pomodoroOverlay.style.display = 'none';
        stopLocalPomodoroUpdate();
        
        // Ensure we handle the message even if not focused by forcing the modal to appear
        setTimeout(() => { 
          // Add a small delay to ensure DOM is ready
          const duration = message.duration || 25;
          const breakDuration = Math.round(duration / 5) || 5;
          const modalId = 'pomodoro-completion-modal-unique';
          
          // First check if a modal already exists and remove it to avoid conflicts
          let existingModal = document.getElementById(modalId);
          if (existingModal) {
            try {
              existingModal.remove();
            } catch (e) {
              console.error('CONTENT SCRIPT: Error removing existing modal:', e);
            }
          }
          
          // Simplified modal creation with minimal DOM operations
          const modalOverlay = document.createElement('div');
          modalOverlay.id = modalId;
          modalOverlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(0, 0, 0, 0.75); display: flex; align-items: center;
            justify-content: center; z-index: 2147483647;
          `;
          
          // Create a single HTML string to minimize DOM operations
          modalOverlay.innerHTML = `
            <div style="background-color: white; padding: 28px; border-radius: 14px;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35); max-width: 460px; text-align: center;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              
              <div style="font-size: 54px; margin-bottom: 20px; color: #4caf50;">🎉</div>
              <h2 style="margin-top: 0; color: #333; font-size: 24px; font-weight: 600;">Pomodoro Complete!</h2>
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 12px 0;">
                Your ${duration} minute pomodoro session is complete. Great work!
              </p>
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Would you like to take a ${breakDuration} minute break or stop the timer and reset your scrolls?
              </p>
              <div style="display: flex; justify-content: space-around; gap: 15px; margin-top: 25px;">
                <button id="pomodoro-stop-btn-modal" style="flex: 1; padding: 14px 20px; background-color: #f44336; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; transition: all 0.2s; font-weight: 500; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">Stop & Reset</button>
                <button id="pomodoro-break-btn-modal" style="flex: 1; padding: 14px 20px; background-color: #2196f3; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; transition: all 0.2s; font-weight: 500; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">Start Break (${breakDuration}m)</button>
              </div>
            </div>
          `;
          
          // Add to DOM
          const isPdfPageForModal = checkIfPdf();
          const parentElement = isPdfPageForModal ? document.documentElement : document.body;

          if (parentElement) {
            parentElement.appendChild(modalOverlay);
            console.log(`CONTENT SCRIPT: Pomodoro completion modal added to ${isPdfPageForModal ? 'document.documentElement' : 'document.body'}.`);
          } else {
            console.error(`CONTENT SCRIPT: Could not find parentElement for completion modal. PDF: ${isPdfPageForModal}. Appending to body as fallback.`);
            document.body.appendChild(modalOverlay); // Fallback
          }
          
          // Simplified button handlers with minimal event listeners
          const stopBtn = document.getElementById('pomodoro-stop-btn-modal');
          const breakBtn = document.getElementById('pomodoro-break-btn-modal');
            if (stopBtn) {
            stopBtn.onclick = () => {
              console.log('CONTENT SCRIPT: Stop button clicked');
              modalOverlay.remove(); // Remove the modal completely
              
              browser.runtime.sendMessage({ type: 'STOP_POMODORO_AND_RESET' })
                .then(() => {
                  isPomodoroActive = false;
                })
                .catch(err => {
                  console.error('CONTENT SCRIPT: Error sending stop message:', err);
                  isPomodoroActive = false;
                });
            };
          }
          
          if (breakBtn) {
            breakBtn.onclick = () => {
              console.log('CONTENT SCRIPT: Break button clicked');
              modalOverlay.remove(); // Remove the modal completely
              
              browser.runtime.sendMessage({ type: 'START_BREAK', minutes: breakDuration })
                .catch(err => console.error('CONTENT SCRIPT: Error sending break message:', err));
            };
          }
        }, 100); // Correctly close setTimeout and add delay
      } else if (message.type === 'BREAK_COMPLETE') {
        removeCompletionModal(); // Remove modal before processing update
        // Reset the pomodoro UI when break is complete
        isPomodoroActive = false;
        if (pomodoroOverlay) {
          pomodoroOverlay.style.display = 'none';
        }
        stopLocalPomodoroUpdate();
        
        // Notify the user that break is complete
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          background-color: rgba(33, 150, 243, 0.9);
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-weight: bold;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
          z-index: 2147483647;
          animation: fadeIn 0.5s, fadeOut 0.5s 4.5s;
        `;
        
        notification.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="font-size: 20px;">☕</div>
            <div>Break complete! Ready to focus again?</div>
          </div>
        `;
        
        // Add animation keyframes
        const style = document.createElement('style');
        style.innerHTML = `
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(20px); }
          }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // Remove notification after 5 seconds
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 5000);
        
        // Reset the scroll count if we're on a distracting site
        if (isDistractingSite()) {
          scrollCount = 0;
          lastResetTime = message.lastResetTime;
          updateCounter();
          setScrollBlocking(false);
        }      } else if (message.type === 'BREAK_COMPLETE_NOTIFICATION') {
        // We'll just show a notification that break is complete and the next Pomodoro started
        // No modal is needed as the Pomodoro automatically restarts now
        console.log('CONTENT SCRIPT: BREAK_COMPLETE_NOTIFICATION received');
        removeCompletionModal(); // Clear any other modals
        
        // Notify the user that break is complete and new Pomodoro started
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          background-color: rgba(76, 175, 80, 0.9); 
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-weight: bold;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
          z-index: 2147483647;
          animation: fadeIn 0.5s, fadeOut 0.5s 4.5s;
        `;
        
        const lastWorkDuration = message.lastPomodoroWorkDuration || 25;
        
        notification.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="font-size: 20px;">🍅</div>
            <div>Break complete! New ${lastWorkDuration} min Pomodoro started.</div>
          </div>
        `;
        
        document.body.appendChild(notification);
        
        // Remove notification after 5 seconds
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 5000);
      } else if (message.type === 'POMODORO_STOPPED_AND_RESET') {
        removeCompletionModal(); // Remove modal before processing update
        // Reset pomodoro UI
        isPomodoroActive = false;
        if (pomodoroOverlay) {
          pomodoroOverlay.style.display = 'none';
        }
        stopLocalPomodoroUpdate();
        
        // Reset scroll count
        if (isDistractingSite()) {
          scrollCount = 0;
          lastResetTime = message.lastResetTime;
          updateCounter();
          setScrollBlocking(false);
        }
      } else if (message.type === 'RESET_COUNTER') {
        scrollCount = 0;
        lastResetTime = message.lastResetTime;
        updateCounter();
        setScrollBlocking(false);
        // Reset AI analysis flag and new state variables
        hasTriggeredAIAnalysis = false;
        isAwaitingPostTriggerScrolls = false;
        postTriggerScrollCount = 0;
        isAnalysisInProgress = false;
        
        // Reset grace period state
        if (isInGracePeriod) {
          endGracePeriod(true);
        }
        isInGracePeriod = false;
        gracePeriodScrollsUsed = 0;
        
        // Clear scraper buffer
        if (contentScraper) {
          contentScraper.clearBuffer();
        }
        // Clear temporary bonus scrolls
        temporaryBonusScrolls = {};
      } else if (message.type === 'SETTINGS_UPDATED') {
        // Update local settings
        maxScrolls = message.maxScrolls;
        distractingSites = message.distractingSites;        resetInterval = message.resetInterval;
        customLimits = message.customLimits || {};
        youtubeSettings = message.youtubeSettings || { hideShorts: false, hideHomeFeed: false };
        instagramSettings = message.instagramSettings || { hideReels: false };
        videoOverlaySettings = message.videoOverlaySettings || videoOverlaySettings;
        
        // Apply YouTube-specific settings if needed
        if (currentHost.includes('youtube.com')) {
          injectYoutubeStylesheet();
          setupYoutubeObserver();
          handleYoutubeHomeRedirect();
        }

        // Apply Instagram-specific settings if needed
        if (currentHost.includes('instagram.com')) {
          handleInstagramReelsRedirect();
        }
        
        // Update Video Overlay Manager if needed
        if (currentHost.includes('x.com') || currentHost.includes('twitter.com')) {
          if (videoOverlaySettings.enabled && videoOverlayManager) {
            videoOverlayManager.updateConfig(videoOverlaySettings);
          } else if (videoOverlaySettings.enabled && !videoOverlayManager) {
            initializeVideoOverlay();
          } else if (!videoOverlaySettings.enabled && videoOverlayManager) {
            videoOverlayManager.destroy();
            videoOverlayManager = null;
          }
        }
        
        // Update the counter
        updateCounter();
        
        // Start/stop timer updates based on new settings
        if (resetInterval > 0) {
          startTimerUpdates();
        } else {
          stopTimerUpdates();
        }
      }
      
      // Return true for async message handling
      return true;
    });
    
    // Check pomodoro status from background script
    function checkPomodoroStatus() {
      console.log('Checking pomodoro status...');
      browser.runtime.sendMessage({ type: 'GET_POMODORO_STATUS' })
        .then(async status => {
          console.log('Got pomodoro status:', status);
          if (status && status.isActive) {
            isPomodoroActive = true;
            pomodoroRemainingMinutes = status.remaining.minutes;
            pomodoroRemainingSeconds = status.remaining.seconds;
            pomodoroDuration = status.duration;
            
            const remainingMs = (status.remaining.minutes * 60 + status.remaining.seconds) * 1000;
            pomodoroEndTime = Date.now() + remainingMs;
            
            await createPomodoroOverlay(); // Ensure overlay is ready

            updatePomodoroDisplay(status.remaining.minutes, status.remaining.seconds, status.duration, status.isBreak);
            console.log('CONTENT SCRIPT: Attempting to show pomodoro overlay from checkPomodoroStatus. Overlay object:', pomodoroOverlay, 'Status isActive:', status.isActive);
            if (pomodoroOverlay) {
              pomodoroOverlay.style.setProperty('display', 'block', 'important'); // Ensure display:block overrides other styles
              console.log('CONTENT SCRIPT: Set pomodoro overlay display to block from checkPomodoroStatus. Current display style:', pomodoroOverlay.style.display);
            } else {
              console.error('CONTENT SCRIPT: pomodoroOverlay is null or undefined when trying to show it in checkPomodoroStatus.');
            }
            
            if (status.isBreak && pomodoroOverlay) {
              console.log('CONTENT SCRIPT: Setting break styling on refresh.');
              pomodoroOverlay.style.backgroundColor = 'rgba(33, 150, 243, 0.85)';
              const iconElement = pomodoroOverlay.querySelector('.pomodoro-icon');
              if (iconElement) iconElement.textContent = '☕';
            }
            
            startLocalPomodoroUpdate();
          } else {
            isPomodoroActive = false;
            if (pomodoroOverlay) pomodoroOverlay.style.display = 'none';
            stopLocalPomodoroUpdate();
          }
        })
        .catch(err => {
          console.error('Error checking pomodoro status:', err);
        });
    }
    
    // Create pomodoro timer overlay
    function createPomodoroOverlay(): Promise<void> {
      return new Promise((resolve) => {
        if (pomodoroOverlay && (document.body.contains(pomodoroOverlay) || (document.documentElement && document.documentElement.contains(pomodoroOverlay)))) {
          console.log('CONTENT SCRIPT: Pomodoro overlay already exists in DOM.');
          resolve();
          return;
        }

        if (pomodoroOverlay) { // Exists but not in DOM (detached)
          try {
            pomodoroOverlay.remove();
            console.log('CONTENT SCRIPT: Removed detached pomodoroOverlay before recreating.');
          } catch (e) {
            console.error('CONTENT SCRIPT: Error removing detached pomodoroOverlay:', e);
          }
        }
        
        console.log('CONTENT SCRIPT: Creating new pomodoro overlay element.');
        pomodoroOverlay = document.createElement('div');
        pomodoroOverlay.id = 'pomodoro-timer-overlay';
        // Base CSS - will be customized below
        let cssText = `
          position: fixed;
          background-color: rgba(76, 175, 80, 0.85);
          color: white;
          padding: 6px 10px;
          border-radius: 20px;
          font-weight: bold;
          z-index: 2147483647 !important; /* Maximum z-index to ensure visibility, added !important */
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          display: none; /* Start hidden, will be shown by handler */
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid rgba(255, 255, 255, 0.3);
          font-size: 12px;
        `;
        pomodoroOverlay.style.cssText = cssText; // Apply the base CSS string
        
        // Detect PDF files - both local files and web-served PDFs
        const isPdfFile = checkIfPdf();
        // The detailed log is now in checkIfPdf, so this one can be simpler or removed.
        console.log(`CONTENT SCRIPT: createPomodoroOverlay: isPdfFile = ${isPdfFile}`);

        if (isPdfFile) {
          pomodoroOverlay.style.setProperty('position', 'fixed', 'important');
          pomodoroOverlay.style.setProperty('bottom', '20px', 'important');
          pomodoroOverlay.style.setProperty('right', '20px', 'important');
          pomodoroOverlay.style.setProperty('top', 'unset', 'important');
          pomodoroOverlay.style.setProperty('left', 'unset', 'important');
          console.log('CONTENT SCRIPT: Applied PDF positioning styles with !important.');
        } else {
          pomodoroOverlay.style.top = '20px';
          pomodoroOverlay.style.right = '20px';
          pomodoroOverlay.style.bottom = 'unset';
          pomodoroOverlay.style.left = 'unset';
          console.log('CONTENT SCRIPT: Applied non-PDF positioning styles.');
        }
        // Opacity and animation will be handled when shown
        
        let pomodoroStyle = document.getElementById('pomodoro-animation-style');
        if (!pomodoroStyle) {
          pomodoroStyle = document.createElement('style');
          pomodoroStyle.id = 'pomodoro-animation-style';
          pomodoroStyle.innerHTML = `
            @keyframes pomodoroFadeInUp {
              0% { opacity: 0; transform: translateY(10px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes pomodoroFadeInDown {
              0% { opacity: 0; transform: translateY(-10px); }
              100% { opacity: 1; transform: translateY(0); }
            }
          `;
          document.head.appendChild(pomodoroStyle);
        }
        
        pomodoroOverlay.innerHTML = `
          <div style="display: flex; align-items: center;">
            <div class="pomodoro-icon" style="margin-right: 5px; font-size: 14px;">🍅</div>
            <div id="pomodoro-time" style="font-size: 12px; font-weight: bold;">00:00/00:00</div>
            <div style="margin-left: 5px; font-size: 10px; opacity: 0.8;">✕</div>
          </div>
        `;
        
        pomodoroOverlay.addEventListener('click', () => {
          if (confirm('Stop pomodoro timer?')) {
            stopLocalPomodoroUpdate();
            if (pomodoroOverlay) pomodoroOverlay.style.display = 'none';
            browser.runtime.sendMessage({ type: 'STOP_POMODORO' })
              .catch(err => console.error('Error stopping pomodoro:', err));
            isPomodoroActive = false;
          }
        });
        
        pomodoroOverlay.addEventListener('mouseenter', () => {
          browser.runtime.sendMessage({ type: 'GET_POMODORO_STATUS' })
            .then(status => {
              if (status && status.isActive) {
                pomodoroOverlay.style.backgroundColor = status.isBreak ? 'rgba(33, 150, 243, 1)' : 'rgba(76, 175, 80, 1)';
              } else {
                pomodoroOverlay.style.backgroundColor = 'rgba(76, 175, 80, 1)';
              }
            })
            .catch(() => { pomodoroOverlay.style.backgroundColor = 'rgba(76, 175, 80, 1)'; });
          pomodoroOverlay.style.transform = 'scale(1.05)';
        });
        
        pomodoroOverlay.addEventListener('mouseleave', () => {
          browser.runtime.sendMessage({ type: 'GET_POMODORO_STATUS' })
            .then(status => {
              if (status && status.isActive) {
                pomodoroOverlay.style.backgroundColor = status.isBreak ? 'rgba(33, 150, 243, 0.85)' : 'rgba(76, 175, 80, 0.85)';
              } else {
                 pomodoroOverlay.style.backgroundColor = 'rgba(76, 175, 80, 0.85)';
              }
            })
            .catch(() => { pomodoroOverlay.style.backgroundColor = 'rgba(76, 175, 80, 0.85)'; });
          pomodoroOverlay.style.transform = 'scale(1)';
        });

        const parentElement = isPdfFile ? document.documentElement : document.body;

        const tryAppendAndResolve = () => {
          if (parentElement) {
            if (!parentElement.contains(pomodoroOverlay)) {
              parentElement.appendChild(pomodoroOverlay);
              console.log(`CONTENT SCRIPT: Pomodoro overlay appended to ${isPdfFile ? 'document.documentElement' : 'document.body'}.`);
            }
            // Apply animation when it's about to be shown
            if (isPdfFile) {
                pomodoroOverlay.style.animation = 'pomodoroFadeInUp 0.3s ease-out';
                console.log('CONTENT SCRIPT: Applying PDF animation (FadeInUp).');
            } else {
                pomodoroOverlay.style.animation = 'pomodoroFadeInDown 0.3s ease-out';
                console.log('CONTENT SCRIPT: Applying non-PDF animation (FadeInDown).');
            }
            pomodoroOverlay.style.opacity = '1'; // Ensure opacity is set
            resolve();
          } else {
            console.log(`CONTENT SCRIPT: ${isPdfFile ? 'document.documentElement' : 'document.body'} not ready, retrying append Pomodoro overlay.`);
            setTimeout(tryAppendAndResolve, 100);
          }
        };
        tryAppendAndResolve();
      });
    }
    
    // Initialize pomodoro immediately
    async function initializePomodoroFeatures() {
      console.log('Initializing pomodoro features...');
      await createPomodoroOverlay(); // Await creation
      console.log('CONTENT SCRIPT: Pomodoro overlay ensured by initializePomodoroFeatures.');
      
      setTimeout(() => {
        checkPomodoroStatus();
      }, 1000); // Keep delay for initial status check after load
    }
    
    // Execute initialization immediately for pomodoro features
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => initializePomodoroFeatures().catch(console.error));
    } else {
      initializePomodoroFeatures().catch(console.error);
    }
    
    // Also call getSettings immediately to initialize scroll blocking features
    getSettings();
    
    // Update the pomodoro display
    function updatePomodoroDisplay(minutes: number, seconds: number, duration: number, isBreak?: boolean) {
      pomodoroRemainingMinutes = minutes;
      pomodoroRemainingSeconds = seconds;
      pomodoroDuration = duration;
      
      // Format time as MM:SS/MM:00
      const timeDisplay = document.getElementById('pomodoro-time');
      if (timeDisplay) {
        const formattedMinutes = String(minutes).padStart(2, '0');
        const formattedSeconds = String(seconds).padStart(2, '0');
        const formattedTotal = String(duration).padStart(2, '0');
        timeDisplay.textContent = `${formattedMinutes}:${formattedSeconds}/${formattedTotal}:00`;
        
        // Update styling based on break status
        if (pomodoroOverlay) {
          if (isBreak) {
            pomodoroOverlay.style.backgroundColor = 'rgba(33, 150, 243, 0.85)';
            const iconElement = pomodoroOverlay.querySelector('.pomodoro-icon');
            if (iconElement) iconElement.textContent = '☕';
          } else {
            pomodoroOverlay.style.backgroundColor = 'rgba(76, 175, 80, 0.85)';
            const iconElement = pomodoroOverlay.querySelector('.pomodoro-icon');
            if (iconElement) iconElement.textContent = '🍅';
          }
        }
      } else {
        // If the element doesn't exist yet, we might need to recreate the overlay
        createPomodoroOverlay();
      }
    }
    
    // Get settings from storage
    async function getSettings() {
      const result = await browser.storage.sync.get({
        maxScrolls: 30, // Fallback to 30
        scrollCounts: {}, // New object structure for per-domain counts
        distractingSites: ['youtube.com', 'x.com', 'reddit.com','instagram.com','facebook.com'], // Fallback
        resetInterval: 0,
        lastResetTime: Date.now(),        customLimits: {}, // Custom scroll limits per domain
        youtubeSettings: { hideShorts: false, hideHomeFeed: false }, // YouTube-specific settings
        instagramSettings: { hideReels: false }, // Instagram-specific settings
        adBlockerCompatMode: true, // Enable compatibility mode for ad blockers
        videoOverlaySettings: { // Video overlay settings for X.com
          enabled: true,
          opacity: 0.9,
          autoPlayOnReveal: false,
          buttonText: 'View Video',
          buttonColor: '#1DA1F2'
        }
      });
      
      maxScrolls = result.maxScrolls;
      distractingSites = result.distractingSites;
      resetInterval = result.resetInterval;      lastResetTime = result.lastResetTime;
      customLimits = result.customLimits;
      youtubeSettings = result.youtubeSettings;
      instagramSettings = result.instagramSettings;
      adBlockerCompatMode = result.adBlockerCompatMode;
      videoOverlaySettings = result.videoOverlaySettings;
      
      // Only proceed with scroll blocking features if current site is in the distracting sites list
      if (!isDistractingSite()) {
        console.log(`ScrollStop not active on ${currentHost} (not in distraction list)`);
        return;
      }
      
      const domain = getMatchingDomain();
      scrollCount = result.scrollCounts[domain] || 0;
      
      const effectiveLimit = getEffectiveScrollLimit();
      console.log(`ScrollStop loaded on ${currentHost}, current scrolls: ${scrollCount}/${effectiveLimit} ${customLimits[domain] ? '(custom limit)' : '(global limit)'}`);
      
      // Add elements to DOM now that we know this is a distracting site
      document.body.appendChild(overlay);
      document.body.appendChild(pendingOverlay);
      document.body.appendChild(counter);
      counter.style.display = 'block';
      
      // Initialize AI Content Analysis
      await initializeAIAnalysis();
      
      // Initialize Video Overlay Manager for X.com
      initializeVideoOverlay();
      
      // Check if we should block based on current count
      const effectiveMax = getEffectiveScrollLimit();
      if (scrollCount >= effectiveMax) {
        // Fallback mechanism: if we're at the limit but haven't done analysis yet, force it
        if (!hasTriggeredAIAnalysis && (aiAnalyzer && contentScraper)) {
          console.log('AI CONTENT: Fallback analysis triggered at scroll limit');
          performAIAnalysis();
          hasTriggeredAIAnalysis = true;
        }
        setScrollBlocking(true);
      }
      
      // Check if reset should happen based on time
      checkTimeBasedReset();
      
      // Set up scroll event listener
      setupScrollListener();
      
      // Update counter
      updateCounter();
      
      // Start timer updates immediately if reset interval is enabled
      if (resetInterval > 0) {
        startTimerUpdates();
      }        // Apply YouTube-specific features if on YouTube
        if (currentHost.includes('youtube.com')) {
          console.log('Applying YouTube-specific settings:', youtubeSettings);
          injectYoutubeStylesheet();
          setupYoutubeObserver();
          handleYoutubeHomeRedirect();
        }

        // Apply Instagram-specific features if on Instagram
        if (currentHost.includes('instagram.com')) {
          console.log('Applying Instagram-specific settings:', instagramSettings);
          handleInstagramReelsRedirect();
        }
      
      // Periodically sync scroll count with storage to prevent inconsistencies
      setInterval(syncScrollCount, 10000); // Sync every 10 seconds
    }
    
    // Initialize Video Overlay Manager
    function initializeVideoOverlay() {
      if (!videoOverlaySettings.enabled) {
        console.log('VIDEO OVERLAY: Video overlay disabled');
        return;
      }
      
      // Only initialize on X.com/Twitter
      const currentDomain = window.location.hostname.replace(/^www\./, '');
      if (!currentDomain.includes('x.com') && !currentDomain.includes('twitter.com')) {
        console.log('VIDEO OVERLAY: Not on X.com/Twitter, skipping video overlay');
        return;
      }
      
      try {
        // Destroy existing manager if it exists
        if (videoOverlayManager) {
          videoOverlayManager.destroy();
        }
        
        // Create new video overlay manager
        videoOverlayManager = new VideoOverlayManager(videoOverlaySettings);
        videoOverlayManager.initialize();
        
        console.log('VIDEO OVERLAY: Manager initialized successfully for X.com');
      } catch (error) {
        console.error('VIDEO OVERLAY: Failed to initialize:', error);
      }
    }
    
    // Initialize AI Content Analysis system
    async function initializeAIAnalysis() {
      if (!aiAnalysisEnabled) {
        console.log('AI CONTENT: Analysis disabled');
        return;
      }

      try {
        console.log('AI CONTENT: Initializing analysis system...');
        
        // Initialize content scraper
        const scrapingConfig: ScrapingConfig = {
          distractingSites: distractingSites,
          enabled: aiAnalysisEnabled,
          minScrollsForAnalysis: 2
        };
        
        contentScraper = new GeneralScraper(scrapingConfig);
        
        // Initialize AI analyzer
        aiAnalyzer = new AIContentAnalyzer(DEFAULT_ANALYZER_CONFIG);
        
        // Test AI connection
        console.log('AI CONTENT: Testing backend connection...');
        const connectionTest = await aiAnalyzer.testConnection();
        if (!connectionTest) {
          console.warn('AI CONTENT: Connection test failed, but continuing with fallback');
        } else {
          console.log('AI CONTENT: Backend connection test successful');
        }
        
        // Initialize the scraper
        const scraperInitialized = contentScraper.initialize();
        if (scraperInitialized) {
          console.log('AI CONTENT: Analysis system initialized successfully for domain:', getMatchingDomain());
          
          // Start capturing content immediately
          contentScraper.captureCurrentContent();
          console.log('AI CONTENT: Initial content capture completed');
        } else {
          console.log('AI CONTENT: Scraper not initialized (site not monitored or disabled)');
          contentScraper = null;
          aiAnalyzer = null;
        }
        
      } catch (error) {
        console.error('AI CONTENT: Failed to initialize analysis system:', error);
        contentScraper = null;
        aiAnalyzer = null;
      }
    }

    // Perform AI content analysis and apply recommendations
    async function performAIAnalysis() {
      if (!contentScraper || !aiAnalyzer || hasTriggeredAIAnalysis || isAnalysisInProgress) {
        return;
      }

      try {
        console.log('AI CONTENT: Starting content analysis...');
        isAnalysisInProgress = true; // Set lock
        hasTriggeredAIAnalysis = true;
        
        // Show analysis indicator
        showAIAnalysisIndicator(true);
        
        // Get scraped content for analysis
        const scrapingResult = contentScraper.getContentForAnalysis();
        
        if (!scrapingResult.success || !scrapingResult.data) {
          console.log('AI CONTENT: Not enough content for analysis');
          showAIAnalysisIndicator(false);
          return;
        }

        // Additional validation: ensure minimum content length
        if (scrapingResult.data.length < 100) {
          console.log('AI CONTENT: Content too short for meaningful analysis:', scrapingResult.data.length, 'characters');
          showAIAnalysisIndicator(false);
          return;
        }

        console.log('AI CONTENT: Content validated for analysis:', scrapingResult.data.length, 'characters');

        // Analyze content with AI
        const analysisResult = await aiAnalyzer.analyzeContent(
          scrapingResult.data,
          {
            scrollCount: scrollCount,
            maxScrolls: getEffectiveScrollLimit(),
            domain: getMatchingDomain(),
            scrollStartTime: scrollStartTime
          }
        );

        showAIAnalysisIndicator(false);

        if (analysisResult.success && analysisResult.analysis) {
          console.log('AI CONTENT: Analysis completed:', analysisResult.analysis);
          
          // Apply AI recommendations with pattern tracking
          const domain = getMatchingDomain();
          const recommendations = aiAnalyzer.applyRecommendations(
            analysisResult.analysis,
            getEffectiveScrollLimit(),
            domain,
            scrollCount
          );
          
          // Check if we should end grace period based on results
          let grantedBonusScrolls = false;
          
          // Update scroll limit if bonus scrolls awarded
          if (recommendations.newMaxScrolls > getEffectiveScrollLimit()) {
            const currentLimit = getEffectiveScrollLimit();
            const bonusScrolls = recommendations.newMaxScrolls - currentLimit;
            
            // Add temporary bonus scrolls for this domain (does not persist across resets)
            temporaryBonusScrolls[domain] = (temporaryBonusScrolls[domain] || 0) + bonusScrolls;
            
            console.log(`AI CONTENT: Added ${bonusScrolls} temporary bonus scrolls. New effective limit: ${getEffectiveScrollLimit()}`);
            updateCounter();
            grantedBonusScrolls = true;
          }
          
          // End grace period if active
          if (isInGracePeriod) {
            endGracePeriod(true);
            
            // If no bonus scrolls were granted and user exceeded their original limit, block now
            if (!grantedBonusScrolls && scrollCount >= getEffectiveScrollLimit()) {
              setScrollBlocking(true);
            }
          }
          
          // Show recommendation overlay if needed
          if (recommendations.shouldShowOverlay) {
            showAIRecommendationOverlay(recommendations);
          }
          
          // Log pattern information if available
          if (recommendations.userPattern) {
            console.log(`AI CONTENT: User pattern detected: ${recommendations.userPattern}`);
          }
          
        } else {
          console.error('AI CONTENT: Analysis failed:', analysisResult.error);
          
          // End grace period on analysis failure
          if (isInGracePeriod) {
            endGracePeriod(false);
          }
        }
        
      } catch (error) {
        console.error('AI CONTENT: Error during AI analysis:', error);
        showAIAnalysisIndicator(false);
      } finally {
        isAnalysisInProgress = false; // Always clear lock
      }
    }

    // Show AI analysis indicator
    function showAIAnalysisIndicator(show: boolean) {
      let indicator = document.getElementById('ai-analysis-indicator');
      
      if (show && !indicator) {
        indicator = document.createElement('div');
        indicator.id = 'ai-analysis-indicator';
        indicator.innerHTML = '🤖 Analyzing content...';
        indicator.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background-color: rgba(76, 175, 80, 0.9);
          color: white;
          padding: 10px 15px;
          border-radius: 8px;
          font-weight: bold;
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 14px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(indicator);
      } else if (!show && indicator) {
        indicator.remove();
      }
    }

    // Grace period management functions
    function startGracePeriod() {
      isInGracePeriod = true;
      gracePeriodScrollsUsed = 0;
      gracePeriodStartTime = Date.now();
      
      // Show pending analysis overlay
      pendingOverlay.style.display = 'block';
      updateGracePeriodUI();
      
      console.log('GRACE PERIOD: Started - allowing up to', maxGracePeriodScrolls, 'extra scrolls');
      
      // Set timeout to end grace period if analysis takes too long
      setTimeout(() => {
        if (isInGracePeriod) {
          console.log('GRACE PERIOD: Timeout - ending grace period');
          endGracePeriod(false);
        }
      }, maxGracePeriodDuration);
    }
    
    function updateGracePeriodUI() {
      const remainingScrolls = maxGracePeriodScrolls - gracePeriodScrollsUsed;
      const graceScrollsElement = document.getElementById('grace-scrolls-remaining');
      if (graceScrollsElement) {
        graceScrollsElement.textContent = remainingScrolls.toString();
      }
    }
    
    function endGracePeriod(wasSuccessful: boolean) {
      if (!isInGracePeriod) return;
      
      isInGracePeriod = false;
      pendingOverlay.style.display = 'none';
      
      console.log('GRACE PERIOD: Ended -', wasSuccessful ? 'Analysis completed' : 'Timeout/limit reached');
      
      // If grace period ended without success (timeout or limit exceeded), block immediately
      if (!wasSuccessful) {
        setScrollBlocking(true);
      }
    }
    
    function useGraceScroll(): boolean {
      if (!isInGracePeriod) return false;
      
      gracePeriodScrollsUsed++;
      updateGracePeriodUI();
      
      console.log(`GRACE PERIOD: Used ${gracePeriodScrollsUsed}/${maxGracePeriodScrolls} grace scrolls`);
      
      // Check if grace period limit exceeded
      if (gracePeriodScrollsUsed >= maxGracePeriodScrolls) {
        console.log('GRACE PERIOD: Limit exceeded - ending grace period');
        endGracePeriod(false);
        return false;
      }
      
      return true;
    }

    // Show AI recommendation overlay with enhanced pattern information
    function showAIRecommendationOverlay(recommendations: any) {
      let aiOverlay = document.getElementById('ai-recommendation-overlay');
      
      if (aiOverlay) {
        aiOverlay.remove();
      }
      
      aiOverlay = document.createElement('div');
      aiOverlay.id = 'ai-recommendation-overlay';
      
      // Enhanced styling with pattern-aware colors
      const getPatternColor = (type: string) => {
        switch (type) {
          case 'encouragement':
            return 'rgba(76, 175, 80, 0.95)'; // Green for positive patterns
          case 'break':
            return 'rgba(244, 67, 54, 0.95)'; // Red for break needed
          case 'warning':
            return 'rgba(255, 152, 0, 0.95)'; // Orange for warnings
          default:
            return 'rgba(33, 150, 243, 0.95)'; // Blue for neutral
        }
      };
      
      aiOverlay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: ${getPatternColor(recommendations.overlayType)};
        color: white;
        padding: 30px;
        border-radius: 15px;
        max-width: 500px;
        text-align: center;
        z-index: 2147483646;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        backdrop-filter: blur(10px);
      `;
      
      // Get pattern emoji for display
      const getPatternEmoji = (pattern: string) => {
        const emojiMap: Record<string, string> = {
          'Deep Focus/Learning': '🎯',
          'Active Socializing': '👥', 
          'Intentional Leisure': '😊',
          'Casual Browsing/Catch-up': '📱',
          'Passive Consumption/Doomscrolling': '⚠️',
          'Anxiety-Driven Information Seeking': '😰'
        };
        return emojiMap[pattern] || '📱';
      };
      
      const patternDisplay = recommendations.userPattern 
        ? `<div style="font-size: 14px; margin-bottom: 10px; opacity: 0.9;">
             ${getPatternEmoji(recommendations.userPattern)} Pattern: ${recommendations.userPattern}
           </div>`
        : '';
      
      aiOverlay.innerHTML = `
        ${patternDisplay}
        <div style="font-size: 18px; margin-bottom: 15px; font-weight: bold;">
          ${recommendations.overlayMessage}
        </div>
        <button id="ai-overlay-close" style="
          background-color: rgba(255,255,255,0.2);
          border: 2px solid white;
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
          transition: all 0.2s ease;
        " onmouseover="this.style.backgroundColor='rgba(255,255,255,0.3)'" 
           onmouseout="this.style.backgroundColor='rgba(255,255,255,0.2)'">Continue</button>
      `;
      
      document.body.appendChild(aiOverlay);
      
      // Auto-close after 7 seconds (increased for pattern info) or on click
      const closeBtn = document.getElementById('ai-overlay-close');
      const closeOverlay = () => {
        if (aiOverlay) aiOverlay.remove();
      };
      
      if (closeBtn) {
        closeBtn.addEventListener('click', closeOverlay);
      }
      
      setTimeout(closeOverlay, 7000);
    }

    // Check if we should reset based on time
    function checkTimeBasedReset() {
      if (resetInterval <= 0) return; // Skip if disabled
      
      const now = Date.now();
      const timeSinceReset = now - lastResetTime;
      const resetIntervalMs = resetInterval * 60 * 1000; // Convert minutes to ms
      
      if (timeSinceReset >= resetIntervalMs) {
        // Reset the scroll count
        scrollCount = 0;
        // Unblock scrolling if it was blocked
        setScrollBlocking(false);
        // Update the last reset time
        lastResetTime = now;
        // Reset AI analysis flag and new state variables
        hasTriggeredAIAnalysis = false;
        isAwaitingPostTriggerScrolls = false;
        postTriggerScrollCount = 0;
        isAnalysisInProgress = false;
        
        // Reset grace period state
        if (isInGracePeriod) {
          endGracePeriod(true);
        }
        isInGracePeriod = false;
        gracePeriodScrollsUsed = 0;
        
        // Clear scraper buffer
        if (contentScraper) {
          contentScraper.clearBuffer();
        }
        // Clear temporary bonus scrolls
        temporaryBonusScrolls = {};
        
        // Use background script to ensure the reset is properly persisted
        browser.runtime.sendMessage({
          type: 'RESET_COUNTER'
        }).then(() => {
          console.log('Timer-based reset completed and persisted to storage');
          updateCounter();
        }).catch(err => {
          console.error('Error during timer-based reset:', err);
          // Fallback to direct storage update if the message fails
          saveScrollCount();
        });
      }
    }
    
    // Increment scroll count and save to storage via background script
    function incrementScrollCount() {
      const domain = getMatchingDomain();
      
      console.log(`SCROLL: Incrementing count for domain: ${domain}, current: ${scrollCount}`);
      
      // Capture content for AI analysis before incrementing
      if (contentScraper) {
        try {
          contentScraper.captureCurrentContent();
          console.log('SCROLL: Content captured successfully');
        } catch (error) {
          console.error('SCROLL: Error capturing content:', error);
        }
      } else {
        console.warn('SCROLL: Content scraper not available');
      }
      
      // Use the background script to handle the storage update
      browser.runtime.sendMessage({
        type: 'INCREMENT_SCROLL',
        domain: domain
      }).then(response => {
        if (response && response.success) {
          scrollCount = response.newCount;
          updateCounter();
          
          const effectiveMax = getEffectiveScrollLimit();
          const scrollsRemaining = effectiveMax - scrollCount;
          
          console.log(`SCROLL: Updated count - current: ${scrollCount}, remaining: ${scrollsRemaining}, effective max: ${effectiveMax}`);
          console.log(`SCROLL: Analysis state - triggered: ${hasTriggeredAIAnalysis}, awaiting: ${isAwaitingPostTriggerScrolls}, post-count: ${postTriggerScrollCount}, in-progress: ${isAnalysisInProgress}`);
          
          // New analysis logic: check if we are awaiting post-trigger scrolls
          if (isAwaitingPostTriggerScrolls) {
            postTriggerScrollCount++;
            console.log(`AI CONTENT: Post-trigger scroll ${postTriggerScrollCount}/3 captured.`);
            
            if (postTriggerScrollCount >= 3) {
              console.log(`AI CONTENT: Captured 3 post-trigger scrolls. Performing analysis.`);
              performAIAnalysis();
              isAwaitingPostTriggerScrolls = false; // Reset state
              hasTriggeredAIAnalysis = true; // Prevent re-triggering
            }
          } else if (aiAnalyzer && contentScraper && scrollsRemaining <= 10 && !hasTriggeredAIAnalysis) {
            // New trigger point: 10 scrolls remaining
            console.log(`AI CONTENT: Triggering analysis wait state with ${scrollsRemaining} scrolls remaining.`);
            isAwaitingPostTriggerScrolls = true;
            postTriggerScrollCount = 0;
          } else if (scrollsRemaining <= 5 && !hasTriggeredAIAnalysis && !isAwaitingPostTriggerScrolls && aiAnalyzer && contentScraper) {
            // Secondary trigger: if user somehow missed the 10-scroll trigger, catch them at 5 scrolls
            console.log(`AI CONTENT: Secondary trigger at ${scrollsRemaining} scrolls remaining - performing immediate analysis.`);
            performAIAnalysis();
            hasTriggeredAIAnalysis = true;
          }
          
          // Check against the effective limit (custom or global)
          if (scrollCount >= effectiveMax) {
            // If we're in grace period, check if we can use a grace scroll
            if (isInGracePeriod) {
              const canContinue = useGraceScroll();
              if (!canContinue) {
                // Grace period ended, block immediately
                return;
              }
            } else {
              // First time hitting limit - check if we should start grace period
              const shouldStartGrace = isAnalysisInProgress || (!hasTriggeredAIAnalysis && aiAnalyzer && contentScraper);
              
              if (shouldStartGrace) {
                // Start analysis if not already triggered
                if (!hasTriggeredAIAnalysis && aiAnalyzer && contentScraper) {
                  console.log('AI CONTENT: Analysis triggered at scroll limit');
                  performAIAnalysis();
                  hasTriggeredAIAnalysis = true;
                }
                
                // Start grace period
                startGracePeriod();
              } else {
                // No analysis available or already completed - block immediately
                setScrollBlocking(true);
              }
            }
          }
        } else {
          console.error('SCROLL: Failed to increment scroll count:', response);
        }
      }).catch(err => {
        console.error('SCROLL: Error incrementing scroll count:', err);
      });
    }
    
    // Save scroll count to storage
    function saveScrollCount() {
      const domain = getMatchingDomain();
      
      // Get current scrollCounts first
      browser.storage.sync.get(['scrollCounts']).then(result => {
        const scrollCounts = result.scrollCounts || {};
        scrollCounts[domain] = scrollCount;
        
        browser.storage.sync.set({ 
          scrollCounts,
          lastResetTime
        }).then(() => {
          updateCounter();
        });
      });
    }
    
    function updateCounter() {
      const effectiveMax = getEffectiveScrollLimit();
      counter.textContent = `Scrolls: ${scrollCount}/${effectiveMax}`;

      // Change counter color to red if 80% of scrolls are used (20% remaining)
      const eightyPercentUsedThreshold = effectiveMax * 0.8;
      if (effectiveMax > 0 && scrollCount >= eightyPercentUsedThreshold) {
        counter.style.backgroundColor = 'rgba(244, 67, 54, 0.8)'; // Red color
      } else {
        counter.style.backgroundColor = 'rgba(29, 161, 242, 0.8)'; // Original blue color
      }
      
      // Also update timer display if reset interval is enabled
      if (resetInterval > 0) {
        const now = Date.now();
        const timeSinceReset = now - lastResetTime;
        const resetIntervalMs = resetInterval * 60 * 1000;
        const timeRemaining = Math.max(0, resetIntervalMs - timeSinceReset);
        
        // Convert to minutes and seconds
        const minutesRemaining = Math.floor(timeRemaining / (60 * 1000));
        const secondsRemaining = Math.floor((timeRemaining % (60 * 1000)) / 1000);
        
        const timerText = `Reset in: ${minutesRemaining}m ${secondsRemaining}s`;
        counter.textContent += ` | ${timerText}`;
        
        // Update the timer in the overlay too
        const overlayTimer = document.getElementById('scroll-stop-timer');
        if (overlayTimer) {
          overlayTimer.textContent = timerText;
        }
        
        // Update hint text for reset timer
        overlayHint.textContent = 'Your scroll limit will reset automatically.';
      } else {
        // If no reset timer is set, update the message accordingly
        const overlayTimer = document.getElementById('scroll-stop-timer');
        if (overlayTimer) {
          overlayTimer.textContent = 'No auto-reset timer configured. Set one in the extension popup.';
        }
        
        // Update hint text for manual reset
        overlayHint.textContent = 'Close this tab or click the extension icon to reset your limit.';
      }
    }
    
    // Detect scrolling
    function setupScrollListener() {
      let lastScrollTop = window.scrollY;
      let scrollTimeout: any;
      let lastUrl = window.location.href;
      let lastShortsId = extractShortsId(window.location.href);
      
      // Function to extract shorts ID from URL
      function extractShortsId(url: string): string {
        const shortsMatch = url.match(/\/shorts\/([^/?]+)/);
        return shortsMatch ? shortsMatch[1] : '';
      }
      
      // Implement a throttled scroll counter to avoid too many DOM operations
      let isThrottled = false;
      const throttleTime = 250; // ms
      let wheelEventCount = 0; // Counter for wheel events
      
      // Simple scroll event for regular pages
      window.addEventListener('scroll', () => {
        if (isBlocked || isThrottled) return;
        
        isThrottled = true;
        setTimeout(() => { isThrottled = false; }, throttleTime);
        
        clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(() => {
          const currentScrollTop = window.scrollY;
          const scrollDelta = Math.abs(currentScrollTop - lastScrollTop);
          
          if (scrollDelta > 100) {
            incrementScrollCount();
          }
          
          lastScrollTop = currentScrollTop;
        }, 300);
      }, { passive: true }); // Add passive flag for better performance

      // Simplified URL change detection for YouTube Shorts
      if (currentHost.includes('youtube.com')) {
        console.log('YouTube detected - setting up simplified Shorts tracking');
        
        const urlCheckInterval = setInterval(() => {
          if (isBlocked) return;
          
          try {
            const currentUrl = window.location.href;
            
            // Only handle URL changes - this avoids many DOM operations
            if (currentUrl !== lastUrl) {
              // Process YouTube URL change
              handleYoutubeHomeRedirect();
              
              // Special handling for Shorts by ID comparison
              const currentShortsId = extractShortsId(currentUrl);
              const previousShortsId = lastShortsId;
              
              if (currentShortsId && (currentShortsId !== previousShortsId)) {
                console.log(`YouTube Shorts navigation: ${previousShortsId || 'none'} → ${currentShortsId}`);
                incrementScrollCount();
                lastShortsId = currentShortsId;
              }
              
              lastUrl = currentUrl;
            }
          } catch (err) {
            console.error('Error in YouTube URL check:', err);
          }
        }, 500);

        window.addEventListener('beforeunload', () => {
          clearInterval(urlCheckInterval);
        });
      }
      
      // Special handling for Instagram Reels - detect URL changes
      if (currentHost.includes('instagram.com')) {
        // Check for URL changes periodically
        const urlCheckInterval = setInterval(() => {
          if (isBlocked) return;
          
          const currentUrl = window.location.href;
          
          // Check if this is an Instagram Reels page
          const isReelsPage = currentUrl.includes('/reel/') || 
                            currentUrl.includes('/reels/') ||
                            document.querySelector('div[role="dialog"] video') !== null;
          
          // If URL changed and we're on a reels page, count it as a scroll
          if (isReelsPage && currentUrl !== lastUrl) {
            console.log('Instagram Reels navigation detected', { from: lastUrl, to: currentUrl });
            incrementScrollCount();
            lastUrl = currentUrl;
          }
        }, 500); // Check every 500ms

        // Also track swipe navigation which might not change URL
        const detectReelSwipes = () => {
          const reelContainers = document.querySelectorAll('div[role="dialog"], div[data-visualcompletion="ignore-dynamic"]');
          
          reelContainers.forEach(container => {
            // Use type assertion to bypass TypeScript check
            const containerElement = container as HTMLElement & { _reelsObserved?: boolean };
            
            if (!containerElement._reelsObserved) {
              containerElement._reelsObserved = true;
              
              // Set up mutation observer to detect new reels content
              const reelsObserver = new MutationObserver((mutations) => {
                // Check if we're potentially in a reel view
                const isInReelView = document.querySelector('div[role="dialog"] video') !== null;
                
                if (isInReelView && !isBlocked) {
                  // Look for key mutations that suggest navigation between reels
                  const significantChange = mutations.some(mutation => {
                    // Video source changed
                    return mutation.type === 'attributes' && 
                           mutation.target instanceof HTMLVideoElement ||
                           // New video element
                           mutation.addedNodes.length > 0 && 
                           Array.from(mutation.addedNodes).some(node => 
                             node instanceof HTMLElement && node.querySelector('video') !== null
                           );
                  });
                  
                  if (significantChange) {
                    console.log('Instagram Reels swipe navigation detected');
                    incrementScrollCount();
                  }
                }
              });
              
              reelsObserver.observe(container, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src', 'style']
              });
              
              // Clean up when page unloads
              window.addEventListener('beforeunload', () => {
                reelsObserver.disconnect();
              });
            }
          });
        };
        
        // Run initially
        detectReelSwipes();
        
        // And check periodically for new reel containers
        setInterval(detectReelSwipes, 2000);
        
        // Clean up interval when page unloads
        window.addEventListener('beforeunload', () => {
          clearInterval(urlCheckInterval);
        });
      }
    }
    
    // Create and inject the stylesheet for hiding YouTube elements
    function injectYoutubeStylesheet() {
      // If not YouTube, don't do anything
      if (!currentHost.includes('youtube.com')) return;

      const styleId = 'nomoscroll-youtube-styles';
      
      // Return if style element already exists
      if (document.getElementById(styleId)) return;
      
      // Create style element
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        /* Hide Shorts section in sidebar (when setting enabled) */
        ${youtubeSettings.hideShorts ? `
          /* Sidebar "Shorts" link */
          ytd-guide-section-renderer a[href="/shorts"],
          ytd-guide-entry-renderer a[href="/shorts"],
          ytd-mini-guide-entry-renderer a[href="/shorts"],
          /* Shorts chips at top of home */
          ytd-rich-shelf-renderer[is-shorts],
          ytd-rich-grid-row:has([is-shorts]),
          ytd-rich-section-renderer:has([is-shorts]),
          ytd-reel-shelf-renderer,
          ytd-rich-shelf-renderer:has(yt-formatted-string:contains("Shorts")),
          ytd-rich-section-renderer:has(yt-formatted-string:contains("Shorts")),
          /* Shorts carousel */
          ytd-rich-grid-row:has(ytd-rich-item-renderer:has([href*="/shorts/"])),
          ytd-grid-video-renderer:has(a[href*="/shorts/"]),
          ytd-video-renderer:has(a[href*="/shorts/"]),
          ytd-compact-video-renderer:has(a[href*="/shorts/"]),
          ytd-compact-radio-renderer:has(a[href*="/shorts/"]),
          /* Video grid items that are shorts */
          ytd-rich-item-renderer:has(a[href*="/shorts/"]) {
            display: none !important;
          }
        ` : ''}
      `;
      
      document.head.appendChild(style);
    }    // Function to handle YouTube home redirect
    function handleYoutubeHomeRedirect() {
      // Only proceed if we're on YouTube 
      if (!currentHost.includes('youtube.com')) return;
      
      const path = window.location.pathname;
      
      // Handle home/explore page redirection - depends on hideHomeFeed setting
      if (youtubeSettings.hideHomeFeed && (path === '/' || path === '/feed/explore')) {
        // Redirect to subscriptions
        window.location.href = 'https://www.youtube.com/feed/subscriptions';
        return; // Return early to avoid shorts check if we're already redirecting
      }
      
      // Handle shorts redirection - depends on hideShorts setting
      if (youtubeSettings.hideShorts && (path === '/shorts/' || path.startsWith('/shorts'))) {
        // Redirect to subscriptions
        window.location.href = 'https://www.youtube.com/feed/subscriptions';
      }
    }

    // Function to handle Instagram Reels redirect
    function handleInstagramReelsRedirect() {
      // Only proceed if we're on Instagram
      if (!currentHost.includes('instagram.com')) return;
      
      const path = window.location.pathname;
      
      // Handle reels redirection - depends on hideReels setting
      if (instagramSettings.hideReels && (path.includes('/reel/') || path === '/reels/' || path.startsWith('/reels'))) {
        // Redirect to home feed
        window.location.href = 'https://www.instagram.com/';
      }
    }

    // Set up observer to monitor YouTube DOM changes for persistent hiding
    function setupYoutubeObserver() {
      // Only run on YouTube
      if (!currentHost.includes('youtube.com')) return;
      
      // Clean up any existing observer
      if (window._youtubeSettingsObserver) {
        window._youtubeSettingsObserver.disconnect();
        window._youtubeSettingsObserver = null;
      }
      
      // If neither setting is enabled, don't need an observer
      if (!youtubeSettings.hideShorts) return;
      
      // Create a new observer to handle dynamically loaded content
      const observer = new MutationObserver(() => {
        // Re-inject the stylesheet to ensure newly loaded content is hidden
        injectYoutubeStylesheet();
      });
      
      // Start observing
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // Store the observer for cleanup
      window._youtubeSettingsObserver = observer;
    }
    
    // Timer update interval reference
    let timerUpdateInterval: ReturnType<typeof globalThis.setInterval> | null = null;
    
    function startTimerUpdates() {
      if (resetInterval > 0 && !timerUpdateInterval) {
        timerUpdateInterval = setInterval(() => {
          updateCounter();
          checkTimeBasedReset();
        }, 1000);
      }
    }
    
    function stopTimerUpdates() {
      if (timerUpdateInterval) {
        clearInterval(timerUpdateInterval);
        timerUpdateInterval = null;
      }
    }

    // Check if current site is in the distracting sites list
    function isDistractingSite() {
      return distractingSites.some(site => currentHost.includes(site));
    }
    
    // Find the specific domain from the distracting sites list that matches current host
    function getMatchingDomain() {
      return distractingSites.find(site => currentHost.includes(site)) || currentHost;
    }
    
    // Get effective scroll limit for current domain
    function getEffectiveScrollLimit() {
      const domain = getMatchingDomain();
      const baseLimit = customLimits[domain] || maxScrolls;
      const bonusScrolls = temporaryBonusScrolls[domain] || 0;
      return baseLimit + bonusScrolls;
    }
    
    // Block/unblock scrolling
    function setScrollBlocking(block: boolean) {
      isBlocked = block;
      
      if (block) {
        // Save current scroll position
        document.body.setAttribute('data-scroll-position', window.scrollY.toString());
        
        // Add event listeners to prevent scrolling
        window.addEventListener('wheel', preventWheelScroll, { passive: false });
        window.addEventListener('touchmove', preventWheelScroll, { passive: false });
        window.addEventListener('keydown', preventKeyScroll);
        
        // Fix body
        const scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
        
        // Show overlay
        overlay.style.display = 'flex';
      } else {
        // Remove event listeners
        window.removeEventListener('wheel', preventWheelScroll);
        window.removeEventListener('touchmove', preventWheelScroll);
        window.removeEventListener('keydown', preventKeyScroll);
        
        // Restore body
        const scrollY = parseInt(document.body.getAttribute('data-scroll-position') || '0', 10);
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
        
        // Hide overlay
        overlay.style.display = 'none';
      }
      
      // Note: We've removed the startTimerUpdates and stopTimerUpdates calls from here
      // since we now manage the timer independently of blocking status
    }
    
    // Event handlers for blocking scroll
    function preventWheelScroll(e: Event) {
      if (isBlocked) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
    
    function preventKeyScroll(e: KeyboardEvent) {
      // Space, Page Up/Down, End, Home, Up, Down
      const keys = [32, 33, 34, 35, 36, 38, 40];
      if (isBlocked && keys.includes(e.keyCode)) {
        e.preventDefault();
        return false;
      }
    }
    
    // Make sure to clean up when unloading
    window.addEventListener('beforeunload', () => {
      console.log('CLEANUP: Page unloading, cleaning up resources');
      
      stopTimerUpdates();
      stopLocalPomodoroUpdate();
      
      // Clean up AI analysis state
      if (isAnalysisInProgress) {
        console.log('CLEANUP: Analysis was in progress, clearing lock');
        isAnalysisInProgress = false;
      }
      
      // Clean up scraper resources
      if (contentScraper) {
        try {
          contentScraper.destroy();
          console.log('CLEANUP: Content scraper destroyed');
        } catch (error) {
          console.error('CLEANUP: Error destroying content scraper:', error);
        }
      }
      
      // Clean up YouTube observer
      if (window._youtubeSettingsObserver) {
        window._youtubeSettingsObserver.disconnect();
        window._youtubeSettingsObserver = null;
      }
      
      // Clean up video overlay manager
      if (videoOverlayManager) {
        try {
          videoOverlayManager.destroy();
          console.log('CLEANUP: Video overlay manager destroyed');
        } catch (error) {
          console.error('CLEANUP: Error destroying video overlay manager:', error);
        }
      }
    });
    
    // Handle tab visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('TAB: Tab became hidden');
        // Don't reset analysis state, but stop active processes
        if (isAnalysisInProgress) {
          console.log('TAB: Analysis in progress while tab hidden, will continue');
        }
      } else {
        console.log('TAB: Tab became visible');
        // Optionally restart content capture if scraper exists
        if (contentScraper && !isBlocked) {
          try {
            contentScraper.captureCurrentContent();
            console.log('TAB: Resumed content capture on tab focus');
          } catch (error) {
            console.error('TAB: Error resuming content capture:', error);
          }
        }
      }
    });

    // Set up fullscreen change detection
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    function handleFullscreenChange() {
      // Use standard property with fallbacks for older browsers
      const isFullScreen = 
        document.fullscreenElement || 
        // Using type assertions to avoid TypeScript errors for non-standard properties
        (document as any).webkitFullscreenElement || 
        (document as any).mozFullScreenElement || 
        (document as any).msFullscreenElement;
      
      if (isFullScreen) {
        // Hide counter when in fullscreen
        counter.style.display = 'none';
      } else if (isDistractingSite()) {
        // Show counter again when exiting fullscreen (only if still on a distracting site)
        counter.style.display = 'block';
      }
    }

    // Add this function to synchronize scroll count with storage
    function syncScrollCount() {
      const domain = getMatchingDomain();
      
      browser.storage.sync.get(['scrollCounts']).then(result => {
        const scrollCounts = result.scrollCounts || {};
        const storedCount = scrollCounts[domain] || 0;
        
        // If there's a discrepancy, use the stored value
        if (scrollCount !== storedCount) {
          console.log(`Scroll count sync: local=${scrollCount}, stored=${storedCount}`);
          scrollCount = storedCount;
          updateCounter();
          
          // Check if we should block based on current count
          const effectiveMax = getEffectiveScrollLimit();
          if (scrollCount >= effectiveMax) {
            setScrollBlocking(true);
          }
        }
      }).catch(err => {
        console.error('Error syncing scroll count:', err);
      });
    }
    
    // Start local pomodoro countdown
    function startLocalPomodoroUpdate() {
      // Clear any existing interval first
      if (pomodoroUpdateInterval) {
        clearInterval(pomodoroUpdateInterval);
        pomodoroUpdateInterval = null;
      }
      
      // Only start if pomodoro is active and we have a valid end time
      if (!isPomodoroActive || pomodoroEndTime <= 0) return;
      
      // Set up an interval to update every second
      pomodoroUpdateInterval = setInterval(() => {
        const now = Date.now();
        const remainingTime = Math.max(0, pomodoroEndTime - now);
        
        if (remainingTime <= 0) {
          // Timer has finished, stop the interval
          clearInterval(pomodoroUpdateInterval!);
          pomodoroUpdateInterval = null;
          
          // We'll let the POMODORO_COMPLETE message handle the cleanup
          return;
        }
        
        // Calculate minutes and seconds
        const minutes = Math.floor(remainingTime / (60 * 1000));
        const seconds = Math.floor((remainingTime % (60 * 1000)) / 1000);
        
        // Check with background script to determine if this is a break timer
        browser.runtime.sendMessage({ type: 'GET_POMODORO_STATUS' })
          .then(status => {
            if (status && status.isActive) {
              // Update the display with correct break status
              updatePomodoroDisplay(minutes, seconds, pomodoroDuration, status.isBreak);
            }
          })
          .catch(() => {
            // Fallback if there's an error getting the status
            updatePomodoroDisplay(minutes, seconds, pomodoroDuration, false);
          });
      }, 1000);
    }
    
    // Stop local pomodoro countdown
    function stopLocalPomodoroUpdate() {
      if (pomodoroUpdateInterval) {
        clearInterval(pomodoroUpdateInterval);
        pomodoroUpdateInterval = null;
      }
    }
  },
});
