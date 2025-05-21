export default defineBackground(() => {
  console.log('ScrollStop background initialized', { id: browser.runtime.id });

  // Track active scroll count operations to prevent race conditions
  const pendingOperations = new Map();
  // Track pomodoro timer
  let pomodoroTimer = null;
  // Track pomodoro end time
  let pomodoroEndTime = 0;
  // Track if pomodoro is active
  let isPomodoroActive = false;
  // Track pomodoro duration in minutes
  let pomodoroDuration = 0;

  // Reset pomodoro state on startup to prevent it from appearing automatically
  isPomodoroActive = false;
  pomodoroEndTime = 0;
  pomodoroDuration = 0;
  if (pomodoroTimer) {
    clearTimeout(pomodoroTimer);
    pomodoroTimer = null;
  }

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
        customLimits: {}, // Store custom limits per domain
        youtubeSettings: {  // YouTube-specific settings
          hideShorts: false,
          hideHomeFeed: false
        }
      });
      console.log('ScrollStop: Default settings initialized');
    }
  });

  // Helper function to update all content scripts
  function updateAllContentScripts(message) {
    console.log('Sending message to all tabs:', message);
    
    // Use a more inclusive approach to notify all tabs
    browser.tabs.query({}).then(tabs => {
      console.log(`Found ${tabs.length} tabs to notify`);
      let notificationPromises = [];
      
      for (const tab of tabs) {
        if (tab.id) {
          console.log(`Sending message to tab ${tab.id} (${tab.url || 'unknown url'})`);
          
          // Add each message sending operation to our promises array
          const notifyPromise = browser.tabs.sendMessage(tab.id, message)
            .catch(err => {
              // Suppress errors - some tabs may not have the content script running
              console.log(`Notification to tab ${tab.id} failed: ${err.message}`);
              return false; // Signal that this tab wasn't notified
            });
          
          notificationPromises.push(notifyPromise);
        }
      }
      
      // Wait for all notifications to complete
      Promise.allSettled(notificationPromises).then(results => {
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== false).length;
        console.log(`Successfully notified ${successCount} out of ${tabs.length} tabs`);
      });
    });
  }

  // Check and update pomodoro timer status
  function updatePomodoroStatus() {
    if (!isPomodoroActive) return;
    
    const now = Date.now();
    const remainingTime = Math.max(0, pomodoroEndTime - now);
    const remainingMinutes = Math.floor(remainingTime / (60 * 1000));
    const remainingSeconds = Math.floor((remainingTime % (60 * 1000)) / 1000);
    
    // Send update to content scripts
    updateAllContentScripts({
      type: 'POMODORO_UPDATE',
      remaining: {
        total: remainingTime,
        minutes: remainingMinutes,
        seconds: remainingSeconds
      },
      duration: pomodoroDuration,
      isActive: isPomodoroActive
    });
    
    // If timer is done, don't schedule another update
    if (remainingTime === 0) {
      isPomodoroActive = false;
      return;
    }
    
    // Schedule next update in 1 second
    setTimeout(updatePomodoroStatus, 1000);
  }

  // Handle messages from popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_SETTINGS') {
      browser.storage.sync.get(['maxScrolls', 'scrollCounts', 'distractingSites', 'resetInterval', 'lastResetTime', 'customLimits', 'youtubeSettings']).then(sendResponse);
      return true; // Required for async response
    }
    
    if (message.type === 'SAVE_SETTINGS') {
      browser.storage.sync.set({ 
        maxScrolls: message.maxScrolls,
        distractingSites: message.distractingSites,
        resetInterval: message.resetInterval,
        customLimits: message.customLimits || {},
        youtubeSettings: message.youtubeSettings || { hideShorts: false, hideHomeFeed: false }
      }).then(() => {
        // Notify content script about updated settings
        updateAllContentScripts({
          type: 'SETTINGS_UPDATED',
          maxScrolls: message.maxScrolls,
          distractingSites: message.distractingSites,
          resetInterval: message.resetInterval,
          customLimits: message.customLimits || {},
          youtubeSettings: message.youtubeSettings || { hideShorts: false, hideHomeFeed: false }
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
    
    if (message.type === 'SET_POMODORO' && message.minutes) {
      const minutes = message.minutes;
      const sourceTabId = message.sourceTabId;
      
      console.log(`Starting ${minutes} minute pomodoro timer from tab ${sourceTabId}`);
      
      // Clear any existing timer
      if (pomodoroTimer) {
        clearTimeout(pomodoroTimer);
        pomodoroTimer = null;
      }
      
      // Convert minutes to milliseconds
      const pomodoroTime = minutes * 60 * 1000;
      
      // Save pomodoro end time and status
      pomodoroEndTime = Date.now() + pomodoroTime;
      isPomodoroActive = true;
      pomodoroDuration = minutes;
      
      // Create update message
      const now = Date.now();
      const remainingTime = Math.max(0, pomodoroEndTime - now);
      const remainingMinutes = Math.floor(remainingTime / (60 * 1000));
      const remainingSeconds = Math.floor((remainingTime % (60 * 1000)) / 1000);
      
      const updateMessage = {
        type: 'POMODORO_UPDATE',
        remaining: {
          total: remainingTime,
          minutes: remainingMinutes,
          seconds: remainingSeconds
        },
        duration: pomodoroDuration,
        isActive: true
      };
      
      // If we have a source tab ID, update it first for immediate feedback
      if (sourceTabId) {
        console.log(`Sending immediate update to source tab ${sourceTabId}`);
        browser.tabs.sendMessage(sourceTabId, updateMessage)
          .catch(err => console.log(`Error sending to source tab: ${err.message}`));
      }
      
      // Then send immediate update to all tabs
      console.log('Sending immediate pomodoro update to all tabs');
      updateAllContentScripts(updateMessage);
      
      // Set new pomodoro timer
      pomodoroTimer = setTimeout(() => {
        // When pomodoro timer is done, reset counters
        browser.storage.sync.get(['distractingSites', 'scrollCounts']).then(result => {
          const sites = result.distractingSites || ['youtube.com', 'x.com', 'reddit.com'];
          const scrollCounts = result.scrollCounts || {};
          const resetTime = Date.now();
          
          // Reset all domain-specific counters
          sites.forEach(site => {
            scrollCounts[site] = 0;
          });
          
          // Save the reset counters
          browser.storage.sync.set({ 
            scrollCounts: scrollCounts,
            lastResetTime: resetTime
          }).then(() => {
            // Notify content script to reset counter
            updateAllContentScripts({ 
              type: 'POMODORO_COMPLETE',
              lastResetTime: resetTime
            });
            
            // Show notification when pomodoro is complete
            browser.notifications.create({
              type: 'basic',
              iconUrl: browser.runtime.getURL('icons/icon-128.png'),
              title: 'Pomodoro Complete!',
              message: `Your ${minutes} minute pomodoro session is complete. Take a break!`
            });
            
            pomodoroTimer = null;
            isPomodoroActive = false;
          });
        });
      }, pomodoroTime);
      
      // Show notification that pomodoro started
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('icons/icon-128.png'),
        title: 'Pomodoro Started',
        message: `${minutes} minute pomodoro timer started. Stay focused!`
      });
      
      // Start sending regular updates to content scripts
      updatePomodoroStatus();
      
      sendResponse({ success: true });
      return true; // Required for async response
    }
    
    if (message.type === 'STOP_POMODORO') {
      // Clear the timer
      if (pomodoroTimer) {
        clearTimeout(pomodoroTimer);
        pomodoroTimer = null;
      }
      
      // Update status
      isPomodoroActive = false;
      pomodoroEndTime = 0;
      
      // Notify all tabs that pomodoro is stopped
      updateAllContentScripts({
        type: 'POMODORO_UPDATE',
        isActive: false
      });
      
      // Show notification
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('icons/icon-128.png'),
        title: 'Pomodoro Stopped',
        message: 'Pomodoro timer has been manually stopped.'
      });
      
      sendResponse({ success: true });
      return true; // Required for async response
    }
    
    if (message.type === 'GET_POMODORO_STATUS') {
      if (isPomodoroActive && pomodoroEndTime > Date.now()) {
        const now = Date.now();
        const remainingTime = Math.max(0, pomodoroEndTime - now);
        const remainingMinutes = Math.floor(remainingTime / (60 * 1000));
        const remainingSeconds = Math.floor((remainingTime % (60 * 1000)) / 1000);
        
        // Only report active if there's actually time remaining
        if (remainingTime > 0) {
          sendResponse({
            isActive: true,
            remaining: {
              total: remainingTime,
              minutes: remainingMinutes,
              seconds: remainingSeconds
            },
            duration: pomodoroDuration
          });
          return true;
        }
      }
      
      // Default to inactive state if any condition fails
      isPomodoroActive = false;
      sendResponse({
        isActive: false
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
        const operationId = `reset_${Date.now()}`;
        pendingOperations.set(operationId, true);
        
        // Reset all counters
        sites.forEach(site => {
          scrollCounts[site] = 0;
        });
        
        // Save the reset counters
        browser.storage.sync.set({ 
          scrollCounts: scrollCounts,
          lastResetTime: Date.now()
        }).then(() => {
          // Notify content script to reset counter
          updateAllContentScripts({ 
            type: 'RESET_COUNTER',
            lastResetTime: Date.now()
          });
          
          pendingOperations.delete(operationId);
        });
      }
    });
  }
});