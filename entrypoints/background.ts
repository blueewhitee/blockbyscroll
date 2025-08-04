export default defineBackground(() => {
  console.log('🚀 ScrollStop background script initialized', { id: browser.runtime.id });
  console.log('📋 Background script timestamp:', new Date().toISOString());
  console.log('🔧 Background script ready to handle messages');

  // Track active scroll count operations to prevent race conditions
  const pendingOperations = new Map<string, boolean>(); // Added type

  // Initialize default settings when extension is installed
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') {
      const defaultSites: string[] = ['youtube.com', 'x.com', 'reddit.com','instagram.com','facebook.com']; // Added type
      // Initialize with an empty object for domain-specific scroll counts
      const scrollCounts: Record<string, number> = {}; // Added type
      
      // Initialize each default site with 0 scrolls
      defaultSites.forEach((site: string) => { // Added type for site
        scrollCounts[site] = 0;
      });
      
      browser.storage.sync.set({
        maxScrolls: 30,  // Default max scrolls to 30
        scrollCounts: scrollCounts,  // Object to track per-domain scrolls
        distractingSites: defaultSites, // Default sites
        resetInterval: 30, // Default to 30 minutes for auto reset
        lastResetTime: Date.now(), // Track when the counter was last reset        customLimits: {}, // Store custom limits per domain
        youtubeSettings: {  // YouTube-specific settings
          hideShorts: false,
          hideHomeFeed: false
        },
        instagramSettings: {  // Instagram-specific settings
          hideReels: false
        },
        videoOverlaySettings: {  // Video overlay settings for X.com
          enabled: true,
          opacity: 0.9,
          autoPlayOnReveal: false,
          buttonText: 'View Video',
          buttonColor: '#1DA1F2'
        }
      });
      console.log('ScrollStop: Default settings initialized');
    }
  });

  // Helper function to update all content scripts
  function updateAllContentScripts(message: any) { // Added type for message
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

  // Handle messages from popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 BACKGROUND: Received message:', { type: message.type, sender: sender.tab?.url });
    
    // Test message handler to verify message passing works
    if (message.type === 'TEST_BACKGROUND') {
      console.log('✅ BACKGROUND: Test message received successfully');
      sendResponse({ success: true, message: 'Background script is working!' });
      return true;
    }
    
    if (message.type === 'TEST_BACKEND_CONNECTION') {
      (async () => {
        try {
          const response = await fetch('https://nomoscroll-backend-815059150602.asia-south1.run.app/api/test');
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.connected) {
              sendResponse({ success: true, connected: true });
              return;
            }
          }
          sendResponse({ success: false, connected: false });
        } catch (error: any) {
          console.error('BACKGROUND: Backend connection test failed:', error);
          sendResponse({ success: false, connected: false, error: error.message });
        }
      })();
      return true; // Keep channel open for async response
    }
    
    // Handle AI content analysis requests
    if (message.type === 'AI_ANALYZE_CONTENT') {
      (async () => {
        try {
          // Validate payload
          if (!message.content || typeof message.content !== 'string' || !message.context) {
            throw new Error('Invalid payload format');
          }

          // Timeout setup (15 seconds to prevent hanging)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
            console.error('⏰ BACKGROUND: Fetch timeout after 15s');
          }, 15000);

          console.log('📤 BACKGROUND: Sending to backend:', {
            contentPreview: message.content.substring(0, 100) + '...',
            context: message.context
          });

          const response = await fetch('https://nomoscroll-backend-815059150602.asia-south1.run.app/api/analyze', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: message.content,
              context: message.context,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ BACKGROUND: Backend error:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          console.log('✅ BACKGROUND: Backend response:', data);

          // Relaxed validation: Check for success and data, ignore extra fields like timestamp/requestId
          if (data.success && data.data) {
            console.log('✅ BACKGROUND: Valid response format');
            sendResponse({ success: true, analysis: data.data });
          } else {
            console.error('❌ BACKGROUND: Invalid response format:', data);
            throw new Error('Invalid response format from backend');
          }
        } catch (error: any) { // Fixed linter error by typing as any
          console.error('❌ BACKGROUND: API call failed:', error?.message || 'Unknown error', error?.stack);
          sendResponse({
            success: false,
            error: error?.message || 'Unknown error',
            analysis: {
              content_type: 'unknown',
              confidence_score: 0,
              educational_value: 0.5, // Changed to 0.0-1.0 scale to match backend
              addiction_risk: 0.5, // Changed to 0.0-1.0 scale to match backend
              recommended_action: 'maintain_limit',
              bonus_scrolls: 0,
              reasoning: 'API unavailable, maintaining original scroll limit'
            }
          });
        }
      })();
      return true; // Keep channel open for async response
    }

    if (message.type === 'GET_SETTINGS') {
      browser.storage.sync.get(['maxScrolls', 'scrollCounts', 'distractingSites', 'resetInterval', 'lastResetTime', 'customLimits', 'youtubeSettings', 'instagramSettings', 'videoOverlaySettings', 'smartScrollEnabled']).then(sendResponse);
      return true; // Required for async response
    }
    
    if (message.type === 'SAVE_SETTINGS') {      browser.storage.sync.set({ 
        maxScrolls: message.maxScrolls,
        distractingSites: message.distractingSites,
        resetInterval: message.resetInterval,
        customLimits: message.customLimits || {},
        youtubeSettings: message.youtubeSettings || { hideShorts: false, hideHomeFeed: false },
        instagramSettings: message.instagramSettings || { hideReels: false },
        videoOverlaySettings: message.videoOverlaySettings || { enabled: true, opacity: 0.9, autoPlayOnReveal: false, buttonText: 'View Video', buttonColor: '#1DA1F2' }
      }).then(() => {
        // Notify content script about updated settings
        updateAllContentScripts({
          type: 'SETTINGS_UPDATED',
          maxScrolls: message.maxScrolls,
          distractingSites: message.distractingSites,
          resetInterval: message.resetInterval,
          customLimits: message.customLimits || {},
          youtubeSettings: message.youtubeSettings || { hideShorts: false, hideHomeFeed: false },
          instagramSettings: message.instagramSettings || { hideReels: false },
          videoOverlaySettings: message.videoOverlaySettings || { enabled: true, opacity: 0.9, autoPlayOnReveal: false, buttonText: 'View Video', buttonColor: '#1DA1F2' }
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
        const sites: string[] = result.distractingSites || ['youtube.com', 'x.com', 'reddit.com','instagram.com','facebook.com']; // Added type
        const scrollCounts: Record<string, number> = result.scrollCounts || {}; // Added type
        
        // Reset all domain-specific counters
        sites.forEach((site: string) => { // Added type for site
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
        const scrollCounts: Record<string, number> = result.scrollCounts || {}; // Added type
        
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
    
    // Handle Smart Scroll toggle
    if (message.type === 'TOGGLE_SMART_SCROLL') {
      console.log('BACKGROUND: Smart Scroll toggled to:', message.enabled);
      
      // Store the Smart Scroll state in browser storage
      browser.storage.sync.set({ 
        smartScrollEnabled: message.enabled 
      }).then(() => {
        console.log('BACKGROUND: Smart Scroll state saved:', message.enabled);
        
        // Notify all content scripts about the state change
        updateAllContentScripts({
          type: 'SMART_SCROLL_STATE_CHANGED',
          enabled: message.enabled
        });
        
        sendResponse({ success: true });
      }).catch(error => {
        console.error('BACKGROUND: Error saving Smart Scroll state:', error);
        sendResponse({ success: false, error: error.message });
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
      const resetInterval: number = result.resetInterval || 0; // Added type
      const lastResetTime: number = result.lastResetTime || Date.now(); // Added type
      const scrollCounts: Record<string, number> = result.scrollCounts || {}; // Added type
      const sites: string[] = result.distractingSites || ['youtube.com', 'x.com', 'reddit.com','instagram.com','facebook.com']; // Added type
      
      console.log(`Reset check - interval: ${resetInterval}min, scrollCounts:`, scrollCounts);
      
      // Skip if reset interval is 0 (disabled)
      if (resetInterval <= 0) {
        console.log('Auto-reset disabled, skipping check');
        return;
      }
      
      // Check if any site has scrolls
      const hasScrolls = sites.some((site: string) => (scrollCounts[site] || 0) > 0); // Added type for site
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
        sites.forEach((site: string) => { // Added type for site
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