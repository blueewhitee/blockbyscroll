export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'], // Match all sites, we'll filter in the main function
  main() {
    // Get the current hostname
    const currentHost = window.location.hostname.replace(/^www\./, '');
    
    // Initialize variables
    let scrollCount = 0;
    let maxScrolls = 30; // Default value to 30
    let isBlocked = false;
    let distractingSites = ['youtube.com', 'x.com', 'reddit.com']; // Re-confirm Default sites
    let resetInterval = 0; // Default: no auto reset
    let lastResetTime = Date.now();
    
    // Check if current site is in the distracting sites list
    function isDistractingSite() {
      return distractingSites.some(site => currentHost.includes(site));
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
      <button id="scroll-stop-reset" style="
        padding: 8px 16px;
        margin-top: 20px;
        background-color: #1DA1F2;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
      ">Reset and Continue</button>
      <p style="margin-top: 20px; font-size: 14px;">You can adjust your scroll limit in the extension popup.</p>
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
        scrollCount: 0,
        distractingSites: ['youtube.com', 'x.com', 'reddit.com'], // Re-confirm fallback
        resetInterval: 0,
        lastResetTime: Date.now()
      });
      
      maxScrolls = result.maxScrolls;
      scrollCount = result.scrollCount;
      distractingSites = result.distractingSites;
      resetInterval = result.resetInterval;
      lastResetTime = result.lastResetTime;
      
      // Only proceed if current site is in the distracting sites list
      if (!isDistractingSite()) {
        console.log(`ScrollStop not active on ${currentHost} (not in distraction list)`);
        return;
      }
      
      console.log(`ScrollStop loaded on ${currentHost}`);
      
      // Add elements to DOM now that we know this is a distracting site
      document.body.appendChild(overlay);
      document.body.appendChild(counter);
      counter.style.display = 'block';
      
      // Set up event listener for reset button
      document.getElementById('scroll-stop-reset')?.addEventListener('click', () => {
        isBlocked = false;
        overlay.style.display = 'none';
        scrollCount = 0;
        lastResetTime = Date.now();
        saveScrollCount();
      });
      
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
    
    // Save scroll count to storage
    function saveScrollCount() {
      browser.storage.sync.set({ 
        scrollCount,
        lastResetTime
      });
      updateCounter();
    }
    
    function updateCounter() {
      counter.textContent = `Scrolls: ${scrollCount}/${maxScrolls}`;
      
      // Also update timer display if reset interval is enabled
      if (resetInterval > 0) {
        const now = Date.now();
        const timeSinceReset = now - lastResetTime;
        const resetIntervalMs = resetInterval * 60 * 1000;
        const timeRemaining = Math.max(0, resetIntervalMs - timeSinceReset);
        
        // Convert to minutes and seconds
        const minutesRemaining = Math.floor(timeRemaining / (60 * 1000));
        const secondsRemaining = Math.floor((timeRemaining % (60 * 1000)) / 1000);
        
        counter.textContent += ` | Reset in: ${minutesRemaining}m ${secondsRemaining}s`;
      }
    }
    
    // Detect scrolling
    function setupScrollListener() {
      let lastScrollTop = window.scrollY;
      let scrollTimeout: number;
      
      window.addEventListener('scroll', () => {
        if (isBlocked) return;
        
        clearTimeout(scrollTimeout);
        
        scrollTimeout = window.setTimeout(() => {
          const currentScrollTop = window.scrollY;
          const scrollDelta = Math.abs(currentScrollTop - lastScrollTop);
          
          // Only count significant scrolls
          if (scrollDelta > 100) {
            scrollCount++;
            saveScrollCount();
            
            if (scrollCount >= maxScrolls) {
              isBlocked = true;
              overlay.style.display = 'flex';
            }
          }
          
          lastScrollTop = currentScrollTop;
        }, 300);
      });
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
        
        updateCounter();
        
        if (scrollCount >= maxScrolls && !isBlocked) {
          isBlocked = true;
          overlay.style.display = 'flex';
        }
      } else if (message.type === 'RESET_COUNTER') {
        scrollCount = 0;
        isBlocked = false;
        overlay.style.display = 'none';
        
        if (message.lastResetTime) {
          lastResetTime = message.lastResetTime;
        }
        
        saveScrollCount();
      }
    });
    
    // Initialize
    getSettings();
  },
});
