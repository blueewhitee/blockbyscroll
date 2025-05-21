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
  matches: ['http://*/*', 'https://*/*'], // Match all sites, we'll filter in the main function
  main() {
    // Get the current hostname
    const currentHost = window.location.hostname.replace(/^www\./, '');
    
    // Initialize variables
    let scrollCount = 0;
    let maxScrolls = 30; // Default value to 30
    let isBlocked = false;
    let distractingSites = ['youtube.com', 'x.com', 'reddit.com']; // Default sites
    let resetInterval = 0; // Default: no auto reset
    let lastResetTime = Date.now();
    let customLimits: Record<string, number> = {}; // Custom scroll limits per domain
    // YouTube-specific settings
    let youtubeSettings = {
      hideShorts: false,
      hideHomeFeed: false
    };
    // Pomodoro settings
    let isPomodoroActive = false;
    let pomodoroRemainingMinutes = 0;
    let pomodoroRemainingSeconds = 0;
    let pomodoroDuration = 0;
    let pomodoroEndTime = 0;
    let pomodoroUpdateInterval: ReturnType<typeof globalThis.setInterval> | null = null;
    let pomodoroOverlay: HTMLElement;
    
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
    browser.runtime.onMessage.addListener((message) => {
      console.log('Content script received message:', message);
      
      if (message.type === 'POMODORO_UPDATE') {
        if (message.isActive) {
          console.log('Pomodoro update received, activating timer display');
          isPomodoroActive = true;
          pomodoroRemainingMinutes = message.remaining.minutes;
          pomodoroRemainingSeconds = message.remaining.seconds;
          pomodoroDuration = message.duration;
          
          // Calculate and store the end time
          const remainingMs = (message.remaining.minutes * 60 + message.remaining.seconds) * 1000;
          pomodoroEndTime = Date.now() + remainingMs;
          
          // Make sure the overlay exists
          if (!pomodoroOverlay || !document.body.contains(pomodoroOverlay)) {
            console.log('Creating pomodoro overlay as it does not exist');
            createPomodoroOverlay();
          }
          
          // Update the display immediately
          updatePomodoroDisplay(message.remaining.minutes, message.remaining.seconds, message.duration);
          
          // Force display of the overlay
          pomodoroOverlay.style.display = 'block';
          
          // Start the local countdown
          startLocalPomodoroUpdate();
        } else {
          isPomodoroActive = false;
          if (pomodoroOverlay) {
            pomodoroOverlay.style.display = 'none';
          }
          stopLocalPomodoroUpdate();
        }
      } else if (message.type === 'POMODORO_COMPLETE') {
        isPomodoroActive = false;
        if (pomodoroOverlay) {
          pomodoroOverlay.style.display = 'none';
        }
        stopLocalPomodoroUpdate();
        
        // Reset the scroll count if we're on a distracting site
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
      } else if (message.type === 'SETTINGS_UPDATED') {
        // Update local settings
        maxScrolls = message.maxScrolls;
        distractingSites = message.distractingSites;
        resetInterval = message.resetInterval;
        customLimits = message.customLimits || {};
        youtubeSettings = message.youtubeSettings || { hideShorts: false, hideHomeFeed: false };
        
        // Apply YouTube-specific settings if needed
        if (currentHost.includes('youtube.com')) {
          injectYoutubeStylesheet();
          setupYoutubeObserver();
          handleYoutubeHomeRedirect();
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
        .then(status => {
          console.log('Got pomodoro status:', status);
          if (status && status.isActive) {
            isPomodoroActive = true;
            pomodoroRemainingMinutes = status.remaining.minutes;
            pomodoroRemainingSeconds = status.remaining.seconds;
            pomodoroDuration = status.duration;
            
            // Calculate and store the end time
            const remainingMs = (status.remaining.minutes * 60 + status.remaining.seconds) * 1000;
            pomodoroEndTime = Date.now() + remainingMs;
            
            // Update the display immediately
            updatePomodoroDisplay(status.remaining.minutes, status.remaining.seconds, status.duration);
            pomodoroOverlay.style.display = 'block';
            
            // Start the local countdown
            startLocalPomodoroUpdate();
          } else {
            isPomodoroActive = false;
            pomodoroOverlay.style.display = 'none';
            stopLocalPomodoroUpdate();
          }
        })
        .catch(err => {
          console.error('Error checking pomodoro status:', err);
        });
    }
    
    // Create pomodoro timer overlay
    function createPomodoroOverlay() {
      console.log('Creating pomodoro overlay element');
      
      // First check if it already exists
      if (pomodoroOverlay && document.body.contains(pomodoroOverlay)) {
        console.log('Pomodoro overlay already exists');
        return;
      }
      
      pomodoroOverlay = document.createElement('div');
      pomodoroOverlay.id = 'pomodoro-timer-overlay';
      pomodoroOverlay.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: rgba(76, 175, 80, 0.85);
        color: white;
        padding: 6px 10px;
        border-radius: 20px;
        font-weight: bold;
        z-index: 2147483647; /* Maximum z-index to ensure visibility */
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        display: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(2px);
        -webkit-backdrop-filter: blur(2px);
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid rgba(255, 255, 255, 0.3);
        animation: pomodoroFadeIn 0.5s ease-in-out;
        font-size: 12px;
      `;
      
      // Add keyframes for fade-in animation
      const style = document.createElement('style');
      style.innerHTML = `
        @keyframes pomodoroFadeIn {
          0% { opacity: 0; transform: translateY(-10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `;
      document.head.appendChild(style);
      
      pomodoroOverlay.innerHTML = `
        <div style="display: flex; align-items: center;">
          <div style="margin-right: 5px; font-size: 14px;">🍅</div>
          <div id="pomodoro-time" style="font-size: 12px; font-weight: bold;">00:00/00:00</div>
          <div style="margin-left: 5px; font-size: 10px; opacity: 0.8;">✕</div>
        </div>
      `;
      
      // Add click handler to stop pomodoro
      pomodoroOverlay.addEventListener('click', () => {
        // Show a confirmation dialog
        if (confirm('Stop pomodoro timer?')) {
          // Stop local timer
          stopLocalPomodoroUpdate();
          
          // Hide the overlay
          pomodoroOverlay.style.display = 'none';
          
          // Tell background script to stop timer
          browser.runtime.sendMessage({ type: 'STOP_POMODORO' });
          
          isPomodoroActive = false;
        }
      });
      
      // Add hover effect
      pomodoroOverlay.addEventListener('mouseenter', () => {
        pomodoroOverlay.style.backgroundColor = 'rgba(76, 175, 80, 1)';
        pomodoroOverlay.style.transform = 'scale(1.05)';
      });
      
      pomodoroOverlay.addEventListener('mouseleave', () => {
        pomodoroOverlay.style.backgroundColor = 'rgba(76, 175, 80, 0.95)';
        pomodoroOverlay.style.transform = 'scale(1)';
      });

      // Add to document body
      document.body.appendChild(pomodoroOverlay);
      
      console.log('Pomodoro overlay added to DOM');
    }
    
    // Initialize pomodoro immediately
    function initializePomodoroFeatures() {
      console.log('Initializing pomodoro features...');
      // Create and add the overlay (but keep it hidden until explicitly started)
      createPomodoroOverlay();
      
      // We will only check pomodoro status when explicitly triggered from the popup
      // The message listener will handle updates when a pomodoro is started
    }
    
    // Execute initialization immediately
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializePomodoroFeatures);
    } else {
      initializePomodoroFeatures();
    }
    
    // Also call getSettings immediately
    getSettings();
    
    // Update the pomodoro display
    function updatePomodoroDisplay(minutes: number, seconds: number, duration: number) {
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
        distractingSites: ['youtube.com', 'x.com', 'reddit.com'], // Fallback
        resetInterval: 0,
        lastResetTime: Date.now(),
        customLimits: {}, // Custom scroll limits per domain
        youtubeSettings: { hideShorts: false, hideHomeFeed: false } // YouTube-specific settings
      });
      
      maxScrolls = result.maxScrolls;
      distractingSites = result.distractingSites;
      resetInterval = result.resetInterval;
      lastResetTime = result.lastResetTime;
      customLimits = result.customLimits;
      youtubeSettings = result.youtubeSettings;
      
      // Check pomodoro status on initialization - for all sites
      checkPomodoroStatus();
      
      // Only proceed with other features if current site is in the distracting sites list
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
      document.body.appendChild(counter);
      counter.style.display = 'block';
      
      // Check if we should block based on current count
      const effectiveMax = getEffectiveScrollLimit();
      if (scrollCount >= effectiveMax) {
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
      }
      
      // Apply YouTube-specific features if on YouTube
      if (currentHost.includes('youtube.com')) {
        console.log('Applying YouTube-specific settings:', youtubeSettings);
        injectYoutubeStylesheet();
        setupYoutubeObserver();
        handleYoutubeHomeRedirect();
      }
      
      // Periodically sync scroll count with storage to prevent inconsistencies
      setInterval(syncScrollCount, 10000); // Sync every 10 seconds
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
      
      // Use the background script to handle the storage update
      browser.runtime.sendMessage({
        type: 'INCREMENT_SCROLL',
        domain: domain
      }).then(response => {
        if (response && response.success) {
          scrollCount = response.newCount;
          updateCounter();
          
          // Check against the effective limit (custom or global)
          const effectiveMax = getEffectiveScrollLimit();
          if (scrollCount >= effectiveMax) {
            setScrollBlocking(true);
          }
        }
      }).catch(err => {
        console.error('Error incrementing scroll count:', err);
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
      } else {
        // If no reset timer is set, update the message accordingly
        const overlayTimer = document.getElementById('scroll-stop-timer');
        if (overlayTimer) {
          overlayTimer.textContent = 'No auto-reset timer configured. Set one in the extension popup.';
        }
      }
    }
    
    // Detect scrolling
    function setupScrollListener() {
      let lastScrollTop = window.scrollY;
      let scrollTimeout: any;
      let lastUrl = window.location.href;
      
      // Set up scroll event listener for regular scrolling
      window.addEventListener('scroll', () => {
        if (isBlocked) return;
        
        clearTimeout(scrollTimeout);
        
        scrollTimeout = window.setTimeout(() => {
          const currentScrollTop = window.scrollY;
          const scrollDelta = Math.abs(currentScrollTop - lastScrollTop);
          
          // Only count significant scrolls
          if (scrollDelta > 100) {
            incrementScrollCount();
          }
          
          lastScrollTop = currentScrollTop;
        }, 300);
      });

      // Special handling for YouTube Shorts - detect URL changes
      if (currentHost.includes('youtube.com')) {
        console.log('YouTube detected - setting up special scroll detection');
        // Check for URL changes periodically 
        const urlCheckInterval = setInterval(() => {
          if (isBlocked) return;
          
          const currentUrl = window.location.href;
          
          // Only apply YouTube-specific features when URL changes
          if (currentUrl !== lastUrl) {
            console.log('YouTube URL changed from', lastUrl, 'to', currentUrl);
            handleYoutubeHomeRedirect();
            lastUrl = currentUrl;
          }
          
          // Check if this is a YouTube Shorts page
          const isShortsPage = currentUrl.includes('/shorts/');
          
          // For all YouTube pages (not just Shorts), detect regular scrolling  
          const currentScrollTop = window.scrollY;
          const scrollDelta = Math.abs(currentScrollTop - lastScrollTop);
          
          // Only count significant scrolls
          if (scrollDelta > 100) {
            console.log('YouTube scroll detected - delta:', scrollDelta);
            incrementScrollCount();
          }
          
          // Additional increment for Shorts navigation (but no URL update since we did it above)
          if (isShortsPage && currentUrl !== lastUrl) {
            console.log('YouTube Shorts navigation detected');
            incrementScrollCount();
          }
          
          // Update last scroll position
          lastScrollTop = currentScrollTop;
        }, 500); // Check every 500ms

        // Clean up interval when page unloads
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
    }

    // Function to handle YouTube home redirect
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
      return customLimits[domain] || maxScrolls;
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
      stopTimerUpdates();
      stopLocalPomodoroUpdate();
      
      // Clean up YouTube observer
      if (window._youtubeSettingsObserver) {
        window._youtubeSettingsObserver.disconnect();
        window._youtubeSettingsObserver = null;
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
        
        // Update the display
        updatePomodoroDisplay(minutes, seconds, pomodoroDuration);
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
