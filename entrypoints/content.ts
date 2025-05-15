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
    let customLimits: Record<string, number> = {}; // Custom limits per domain
    
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
    
    // Create overlay for when scrolling is blocked
    const overlay = document.createElement('div');
    overlay.id = 'scroll-stop-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.85);
      color: white;
      display: none;
      z-index: 10000;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    
    const message = document.createElement('div');
    message.innerHTML = `
      <h1>Scroll limit reached</h1>
      <p>You've reached your scrolling limit for ${currentHost}.</p>
      <p style="margin-top: 20px; font-size: 16px;">Your scroll counter will reset automatically based on your timer settings.</p>
      <p id="scroll-stop-timer" style="margin-top: 15px; font-size: 18px; color: #1DA1F2;"></p>
      <p style="margin-top: 10px; font-size: 14px;">You can adjust your scroll limit and reset timer in the extension popup.</p>
    `;
    
    overlay.appendChild(message);
    
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
    `;
    
    // Get settings from storage
    async function getSettings() {
      const result = await browser.storage.sync.get({
        maxScrolls: 30, // Fallback to 30
        scrollCounts: {}, // New object structure for per-domain counts
        distractingSites: ['youtube.com', 'x.com', 'reddit.com'], // Fallback
        resetInterval: 0,
        lastResetTime: Date.now(),
        customLimits: {} // Custom scroll limits per domain
      });
      
      maxScrolls = result.maxScrolls;
      distractingSites = result.distractingSites;
      resetInterval = result.resetInterval;
      lastResetTime = result.lastResetTime;
      customLimits = result.customLimits;
      
      // Only proceed if current site is in the distracting sites list
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
        isBlocked = true;
        overlay.style.display = 'flex';
        
        // Start regular timer updates when overlay is visible
        if (resetInterval > 0) {
          const timerUpdateInterval = setInterval(() => {
            updateCounter();
            
            // Check if we should unblock based on time
            const now = Date.now();
            const timeSinceReset = now - lastResetTime;
            const resetIntervalMs = resetInterval * 60 * 1000;
            
            if (timeSinceReset >= resetIntervalMs) {
              isBlocked = false;
              overlay.style.display = 'none';
              clearInterval(timerUpdateInterval);
            }
          }, 1000);
          
          // Clean up interval when overlay is hidden
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.attributeName === 'style' && overlay.style.display === 'none') {
                clearInterval(timerUpdateInterval);
                observer.disconnect();
              }
            });
          });
          
          observer.observe(overlay, { attributes: true });
        }
      }
      
      // Check if reset should happen based on time
      checkTimeBasedReset();
      
      // Set up scroll event listener
      setupScrollListener();
      
      // Set up timer if needed
      if (resetInterval > 0) {
        setInterval(() => {
          checkTimeBasedReset();
          updateCounter();
        }, 1000);
      }
      
      updateCounter();
    }
    
    // Check if we should reset based on time
    function checkTimeBasedReset() {
      if (resetInterval <= 0) return; // Skip if disabled
      
      const now = Date.now();
      const timeSinceReset = now - lastResetTime;
      const resetIntervalMs = resetInterval * 60 * 1000; // Convert minutes to ms
      
      if (timeSinceReset >= resetIntervalMs) {
        scrollCount = 0;
        isBlocked = false;
        overlay.style.display = 'none';
        lastResetTime = now;
        saveScrollCount();
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
            isBlocked = true;
            overlay.style.display = 'flex';
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
      let scrollTimeout: number;
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
        // Check for URL changes periodically 
        const urlCheckInterval = setInterval(() => {
          if (isBlocked) return;
          
          const currentUrl = window.location.href;
          
          // Check if this is a YouTube Shorts page
          const isShortsPage = currentUrl.includes('/shorts/');
          
          // If URL changed and we're on a shorts page, count it as a scroll
          if (isShortsPage && currentUrl !== lastUrl) {
            console.log('YouTube Shorts navigation detected', { from: lastUrl, to: currentUrl });
            incrementScrollCount();
            lastUrl = currentUrl;
          }
        }, 500); // Check every 500ms

        // Clean up interval when page unloads
        window.addEventListener('beforeunload', () => {
          clearInterval(urlCheckInterval);
        });
      }
    }
    
    // Listen for messages from popup/background
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === 'SETTINGS_UPDATED') {
        maxScrolls = message.maxScrolls;
        
        if (message.distractingSites) {
          distractingSites = message.distractingSites;
          
          // If current site is no longer in the list, remove overlay and counter
          if (!isDistractingSite()) {
            counter.style.display = 'none';
            overlay.style.display = 'none';
            return;
          } else {
            counter.style.display = 'block';
          }
        }
        
        if (message.resetInterval !== undefined) {
          resetInterval = message.resetInterval;
        }
        
        if (message.customLimits) {
          customLimits = message.customLimits;
        }
        
        updateCounter();
        
        // Check if we should block based on updated settings
        const effectiveMax = getEffectiveScrollLimit();
        if (scrollCount >= effectiveMax && !isBlocked) {
          isBlocked = true;
          overlay.style.display = 'flex';
        } else if (scrollCount < effectiveMax && isBlocked) {
          // If the limit was increased and we're now below it, unblock
          isBlocked = false;
          overlay.style.display = 'none';
        }
      } else if (message.type === 'RESET_COUNTER') {
        scrollCount = 0;
        isBlocked = false;
        overlay.style.display = 'none';
        
        if (message.lastResetTime) {
          lastResetTime = message.lastResetTime;
        }
        
        updateCounter();
      }
    });
    
    // Initialize
    getSettings();
  },
});
