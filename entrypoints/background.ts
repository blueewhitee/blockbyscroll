export default defineBackground(() => {
  console.log('ScrollStop background initialized', { id: browser.runtime.id });

  // Track active scroll count operations to prevent race conditions
  const pendingOperations = new Map();

  // Initialize default settings when extension is installed
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') {
      const defaultSites = ['youtube.com', 'x.com', 'reddit.com'];
      // Initialize with an empty object for domain-specific scroll counts
      const scrollCounts = {};
      
      // Initialize each default site with 0 scrolls
      defaultSites.forEach(site => {
        scrollCounts[site] = 0;
      });
      
      browser.storage.sync.set({
        maxScrolls: 30,  // Default max scrolls to 30
        scrollCounts: scrollCounts,  // Object to track per-domain scrolls
        distractingSites: defaultSites, // Default sites
        resetInterval: 30, // Default to 30 minutes for auto reset
        lastResetTime: Date.now(), // Track when the counter was last reset
        customLimits: {} // Store custom limits per domain
      });
      console.log('ScrollStop: Default settings initialized');
    }
  });

  // Handle messages from popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_SETTINGS') {
      browser.storage.sync.get(['maxScrolls', 'scrollCounts', 'distractingSites', 'resetInterval', 'lastResetTime', 'customLimits']).then(sendResponse);
      return true; // Required for async response
    }
    
    if (message.type === 'SAVE_SETTINGS') {
      browser.storage.sync.set({ 
        maxScrolls: message.maxScrolls,
        distractingSites: message.distractingSites,
        resetInterval: message.resetInterval,
        customLimits: message.customLimits || {}
      }).then(() => {
        // Notify content script about updated settings
        updateAllContentScripts({
          type: 'SETTINGS_UPDATED',
          maxScrolls: message.maxScrolls,
          distractingSites: message.distractingSites,
          resetInterval: message.resetInterval,
          customLimits: message.customLimits || {}
        });
        
        sendResponse({ success: true });
      });
      return true; // Required for async response
    }
    
    if (message.type === 'RESET_COUNTER') {
      const resetTime = Date.now();
      const operationId = `reset_${resetTime}`;
      
      // Track this operation
      pendingOperations.set(operationId, true);
      
      // Get current settings first
      browser.storage.sync.get(['distractingSites', 'scrollCounts']).then(result => {
        const sites = result.distractingSites || ['youtube.com', 'x.com', 'reddit.com'];
        const scrollCounts = result.scrollCounts || {};
        
        // Reset all domain-specific counters
        sites.forEach(site => {
          scrollCounts[site] = 0;
        });
        
        // Save the reset counters
        return browser.storage.sync.set({ 
          scrollCounts: scrollCounts,
          lastResetTime: resetTime
        }).then(() => {
          // Notify content script to reset counter
          updateAllContentScripts({ 
            type: 'RESET_COUNTER',
            lastResetTime: resetTime
          });
          
          pendingOperations.delete(operationId);
          sendResponse({ success: true });
        });
      }).catch(err => {
        console.error('Error resetting counters:', err);
        pendingOperations.delete(operationId);
        sendResponse({ success: false, error: err.message });
      });
      
      return true; // Required for async response
    }
    
    // New handler for domain-specific scroll increment
    if (message.type === 'INCREMENT_SCROLL' && message.domain) {
      const domain = message.domain;
      const operationId = `increment_${domain}_${Date.now()}`;
      
      // Track this operation
      pendingOperations.set(operationId, true);
      
      browser.storage.sync.get(['scrollCounts', 'distractingSites']).then(result => {
        const scrollCounts = result.scrollCounts || {};
        
        // Initialize the domain counter if it doesn't exist
        if (scrollCounts[domain] === undefined) {
          scrollCounts[domain] = 0;
        }
        
        // Increment the counter for this domain
        scrollCounts[domain] += 1;
        
        // Save the updated counter
        return browser.storage.sync.set({ scrollCounts }).then(() => {
          pendingOperations.delete(operationId);
          sendResponse({ success: true, newCount: scrollCounts[domain] });
        });
      }).catch(err => {
        console.error('Error incrementing scroll count:', err);
        pendingOperations.delete(operationId);
        sendResponse({ success: false, error: err.message });
      });
      
      return true; // Required for async response
    }
  });

  // Helper function to update all content scripts
  function updateAllContentScripts(message) {
    browser.storage.sync.get(['distractingSites']).then(result => {
      const sites = result.distractingSites || ['youtube.com', 'x.com', 'reddit.com']; // Fallback
      
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
    // Skip if there are pending storage operations to avoid conflicts
    if (pendingOperations.size > 0) {
      console.log('Skipping timer reset check due to pending operations');
      return;
    }
    
    console.log('Checking time-based reset...');
    browser.storage.sync.get(['resetInterval', 'lastResetTime', 'scrollCounts', 'distractingSites']).then(result => {
      const resetInterval = result.resetInterval || 0;
      const lastResetTime = result.lastResetTime || Date.now();
      const scrollCounts = result.scrollCounts || {};
      const sites = result.distractingSites || ['youtube.com', 'x.com', 'reddit.com'];
      
      console.log(`Reset check - interval: ${resetInterval}min, scrollCounts:`, scrollCounts);
      
      // Skip if reset interval is 0 (disabled)
      if (resetInterval <= 0) {
        console.log('Auto-reset disabled, skipping check');
        return;
      }
      
      // Check if any site has scrolls
      const hasScrolls = sites.some(site => (scrollCounts[site] || 0) > 0);
      if (!hasScrolls) {
        console.log('No sites have scrolls, skipping reset');
        return; // Skip if all counters are already 0
      }
      
      const now = Date.now();
      const timeSinceReset = now - lastResetTime;
      const resetIntervalMs = resetInterval * 60 * 1000; // Convert minutes to ms
      console.log(`Time since last reset: ${Math.floor(timeSinceReset/1000)}s, Reset interval: ${resetIntervalMs/1000}s`);
      
      // If it's time for a reset
      if (timeSinceReset >= resetIntervalMs) {
        console.log('Time for reset! Resetting all counters...');
        
        // Create an operation ID for this reset
        const operationId = `timer_reset_${now}`;
        pendingOperations.set(operationId, true);
        
        // Reset all domain-specific counters
        sites.forEach(site => {
          scrollCounts[site] = 0;
        });
        
        browser.storage.sync.set({ 
          scrollCounts: scrollCounts,
          lastResetTime: now
        }).then(() => {
          updateAllContentScripts({ 
            type: 'RESET_COUNTER',
            lastResetTime: now
          });
          pendingOperations.delete(operationId);
        }).catch(err => {
          console.error('Error during timer-based reset:', err);
          pendingOperations.delete(operationId);
        });
      }
    });
  }

  // Check for time-based reset every minute
  setInterval(checkTimeBasedReset, 60 * 1000);
});
