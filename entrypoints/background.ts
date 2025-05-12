export default defineBackground(() => {
  console.log('ScrollStop background initialized', { id: browser.runtime.id });

  // Initialize default settings when extension is installed
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') {
      browser.storage.sync.set({
        maxScrolls: 30,  // Default max scrolls to 30
        scrollCount: 0,  // Initial scroll count
        distractingSites: ['youtube.com', 'x.com', 'reddit.com'], // Re-confirm Default sites
        resetInterval: 0, // 0 means no auto reset
        lastResetTime: Date.now() // Track when the counter was last reset
      });
      console.log('ScrollStop: Default settings initialized');
    }
  });

  // Handle messages from popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_SETTINGS') {
      browser.storage.sync.get(['maxScrolls', 'scrollCount', 'distractingSites', 'resetInterval', 'lastResetTime']).then(sendResponse);
      return true; // Required for async response
    }
    
    if (message.type === 'SAVE_SETTINGS') {
      browser.storage.sync.set({ 
        maxScrolls: message.maxScrolls,
        distractingSites: message.distractingSites,
        resetInterval: message.resetInterval
      }).then(() => {
        // Notify content script about updated settings
        updateAllContentScripts({
          type: 'SETTINGS_UPDATED',
          maxScrolls: message.maxScrolls,
          distractingSites: message.distractingSites,
          resetInterval: message.resetInterval
        });
        
        sendResponse({ success: true });
      });
      return true; // Required for async response
    }
    
    if (message.type === 'RESET_COUNTER') {
      const resetTime = Date.now();
      browser.storage.sync.set({ 
        scrollCount: 0,
        lastResetTime: resetTime
      }).then(() => {
        // Notify content script to reset counter
        updateAllContentScripts({ 
          type: 'RESET_COUNTER',
          lastResetTime: resetTime
        });
        
        sendResponse({ success: true });
      });
      return true; // Required for async response
    }
  });

  // Helper function to update all content scripts
  function updateAllContentScripts(message) {
    browser.storage.sync.get(['distractingSites']).then(result => {
      const sites = result.distractingSites || ['youtube.com', 'x.com', 'reddit.com']; // Re-confirm fallback
      
      // Create URL patterns for each site
      const urlPatterns = sites.flatMap(site => {
        // Handle both http and https
        return [`*://*.${site}/*`];
      });
      
      browser.tabs.query({ url: urlPatterns }).then(tabs => {
        for (const tab of tabs) {
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, message)
              .catch(err => console.error('Error sending message to tab:', err));
          }
        }
      });
    });
  }

  // Check for time-based reset periodically
  function checkTimeBasedReset() {
    browser.storage.sync.get(['resetInterval', 'lastResetTime', 'scrollCount']).then(result => {
      const resetInterval = result.resetInterval || 0;
      const lastResetTime = result.lastResetTime || Date.now();
      const scrollCount = result.scrollCount || 0;
      
      // Skip if reset interval is 0 (disabled) or if counter is already 0
      if (resetInterval <= 0 || scrollCount === 0) return;
      
      const now = Date.now();
      const timeSinceReset = now - lastResetTime;
      const resetIntervalMs = resetInterval * 60 * 1000; // Convert minutes to ms
      
      // If it's time for a reset
      if (timeSinceReset >= resetIntervalMs) {
        browser.storage.sync.set({ 
          scrollCount: 0,
          lastResetTime: now
        }).then(() => {
          updateAllContentScripts({ 
            type: 'RESET_COUNTER',
            lastResetTime: now
          });
        });
      }
    });
  }

  // Check for time-based reset every minute
  setInterval(checkTimeBasedReset, 60 * 1000);
});
