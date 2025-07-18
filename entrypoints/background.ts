export default defineBackground(() => {
  console.log('🚀 ScrollStop background script initialized', { id: browser.runtime.id });
  console.log('📋 Background script timestamp:', new Date().toISOString());
  console.log('🔧 Background script ready to handle messages');

  // Track active scroll count operations to prevent race conditions
  const pendingOperations = new Map<string, boolean>(); // Added type
  // Track pomodoro timer
  let pomodoroTimer: NodeJS.Timeout | null = null; // Added type
  // Track pomodoro end time
  let pomodoroEndTime: number = 0; // Added type
  // Track if pomodoro is active
  let isPomodoroActive: boolean = false; // Added type
  // Track pomodoro duration in minutes
  let pomodoroDuration: number = 0; // Added type
  // Track if pomodoro is in break mode
  let isBreakActive: boolean = false; // Added type
  let pomodoroCompletionPromptFallbackTimer: NodeJS.Timeout | null = null; // Added type
  let lastPomodoroWorkDuration: number = 25; // Default to 25 minutes
  let isWaitingForCompletionChoice: boolean = false; // Track if we're waiting for user choice after completion

  // Reset pomodoro state on startup to prevent it from appearing automatically
  isPomodoroActive = false;
  isBreakActive = false;
  pomodoroEndTime = 0;
  pomodoroDuration = 0;
  if (pomodoroTimer) {
    clearTimeout(pomodoroTimer);
    pomodoroTimer = null;
  }

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

  // Handle break completion and auto-restart
  async function handleBreakCompletion(breakMinutes: number) {
    try {
      // Reset scroll counters
      const result = await browser.storage.sync.get(['distractingSites', 'scrollCounts']);
      const sites: string[] = result.distractingSites || ['youtube.com', 'x.com', 'reddit.com','instagram.com','facebook.com'];
      const scrollCounts: Record<string, number> = result.scrollCounts || {};
      const resetTime = Date.now();
      
      // Reset all domain-specific counters
      sites.forEach((site: string) => {
        scrollCounts[site] = 0;
      });
      
      // Save the reset counters
      await browser.storage.sync.set({ 
        scrollCounts: scrollCounts,
        lastResetTime: resetTime
      });
      
      // Show notification when break is complete
      try {
        browser.notifications.create({
          type: 'basic',
          iconUrl: browser.runtime.getURL('/icon/128.jpg'),
          title: 'Break Complete!',
          message: `Your ${breakMinutes} minute break is over.`
        });
      } catch (notificationError) {
        console.log('BACKGROUND: Break completion notification failed (this is normal):', notificationError);
      }
      
      console.log(`BACKGROUND: Break over, automatically starting new Pomodoro`);
      
      // Automatically restart the Pomodoro timer with the previous duration
      const minutes = lastPomodoroWorkDuration;
      
      // Convert minutes to milliseconds
      const pomodoroTime = minutes * 60 * 1000;
      
      // Save pomodoro end time and status
      pomodoroEndTime = Date.now() + pomodoroTime;
      isPomodoroActive = true;
      isBreakActive = false; // It's a work session now
      pomodoroDuration = minutes;
      
      // Create update message for new Pomodoro
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
        isActive: true,
        forceDisplay: true // Force display of the overlay
      };
      
      // Send update to all tabs
      updateAllContentScripts(updateMessage);
      
      // Notify content script about the auto-start of new Pomodoro
      updateAllContentScripts({
        type: 'BREAK_COMPLETE_NOTIFICATION',
        lastPomodoroWorkDuration: minutes,
        lastResetTime: resetTime
      });

      // Start sending updates to content scripts
      updatePomodoroStatus();

      // Set new pomodoro timer for the auto-started Pomodoro 
      pomodoroTimer = setTimeout(() => {
        handlePomodoroCompletion();
      }, pomodoroTime);
      
    } catch (error) {
      console.error('BACKGROUND: Error in handleBreakCompletion:', error);
      // Fallback: just notify that break is complete without auto-restart
      updateAllContentScripts({
        type: 'BREAK_COMPLETE_NOTIFICATION',
        lastPomodoroWorkDuration: lastPomodoroWorkDuration,
        lastResetTime: Date.now()
      });
    }
  }

  // Handle pomodoro completion (extracted to reusable function)
  function handlePomodoroCompletion() {
    console.log(`BACKGROUND: Pomodoro timer of ${pomodoroDuration} minutes completed!`);
    pomodoroTimer = null;
    
    // Show the completion popup
    console.log(`BACKGROUND: Pomodoro completed, showing prompt immediately.`);
    
    // Set flag to indicate we're waiting for user choice
    isWaitingForCompletionChoice = true;
    
    try {
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon/128.jpg'),
        title: 'Pomodoro Complete!',
        message: `Your ${pomodoroDuration} minute pomodoro session is complete. Check your page for options!`
      });
    } catch (notificationError) {
      console.log('BACKGROUND: Notification creation failed (this is normal):', notificationError);
    }
    
    updateAllContentScripts({
      type: 'POMODORO_COMPLETE_PROMPT',
      duration: pomodoroDuration,
      forceDisplay: true
    });
    
    // Start fallback timer
    if (pomodoroCompletionPromptFallbackTimer) clearTimeout(pomodoroCompletionPromptFallbackTimer);
    pomodoroCompletionPromptFallbackTimer = setTimeout(() => {
      if (isWaitingForCompletionChoice) {
        try {
          const params = new URLSearchParams({
              action: 'pomodoro_complete',
              duration: pomodoroDuration.toString(),
              completedAt: Date.now().toString()
          }).toString();
          browser.windows.create({
              url: browser.runtime.getURL(`/popup/index.html?${params}` as any),
              type: 'popup', width: 420, height: 350
          });
        } catch (popupError) {
          console.log('BACKGROUND: Popup creation failed:', popupError);
        }
        isWaitingForCompletionChoice = false;
        isPomodoroActive = false;
      }
    }, 10000);
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
      isActive: isPomodoroActive,
      isBreak: isBreakActive
    });
    
    // If timer is done, don't schedule another update
    if (remainingTime === 0) {
      isPomodoroActive = false;
      isBreakActive = false;
      return;
    }
    
    // Schedule next update in 1 second
    setTimeout(updatePomodoroStatus, 1000);
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
              educational_value: 5,
              addiction_risk: 5,
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
      browser.storage.sync.get(['maxScrolls', 'scrollCounts', 'distractingSites', 'resetInterval', 'lastResetTime', 'customLimits', 'youtubeSettings', 'instagramSettings', 'videoOverlaySettings']).then(sendResponse);
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
    
    if (message.type === 'SET_POMODORO' && message.minutes) {
      const minutes = message.minutes;
      const sourceTabId = message.sourceTabId;
      
      // If this is a work session (not a break being set), update lastPomodoroWorkDuration
      if (!isBreakActive) {
        lastPomodoroWorkDuration = minutes;
        console.log(`BACKGROUND: lastPomodoroWorkDuration updated to ${lastPomodoroWorkDuration} minutes.`);
      }
      
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
      const remainingSeconds = Math.floor(remainingTime % (60 * 1000) / 1000);
      
      const updateMessage = {
        type: 'POMODORO_UPDATE',
        remaining: {
          total: remainingTime,
          minutes: remainingMinutes,
          seconds: remainingSeconds
        },
        duration: pomodoroDuration,
        isActive: true,
        forceDisplay: true // Force display of the overlay
      };
      
      // Force notification to ALL tabs, including chrome:// tabs if possible
      console.log('IMPORTANT: Sending forced pomodoro update to all tabs');
      
      try {
        // Get ALL tabs
        browser.tabs.query({}).then(tabs => {
          console.log(`Found ${tabs.length} tabs to notify about pomodoro start`);
          // Send message to each tab individually
          for (const tab of tabs) {
            if (tab.id) {
              browser.tabs.sendMessage(tab.id, updateMessage)
                .catch(err => {
                  // This is normal for tabs that don't have our content script (like chrome:// URLs)
                  console.log(`Could not send to tab ${tab.id}: ${err.message}`);
                });
            }
          }
        });
      } catch (err) {
        console.error('Error notifying tabs about pomodoro:', err);
      }
      
      // Set new pomodoro timer
      pomodoroTimer = setTimeout(() => {
        handlePomodoroCompletion();
      }, pomodoroTime);
      
      // Show notification that pomodoro started
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon/128.jpg'), // Corrected path
        title: 'Pomodoro Started',
        message: `${minutes} minute pomodoro timer started. Stay focused!`
      });
      
      // Start sending regular updates to content scripts
      updatePomodoroStatus();
      
      sendResponse({ success: true });
      return true; // Required for async response
    }
    
    // Handle starting a break after pomodoro completion
    if (message.type === 'START_BREAK') {
      const breakMinutes = message.minutes || 5; // Default to 5-minute break
      
      console.log(`Starting ${breakMinutes} minute break. Previous work duration was ${lastPomodoroWorkDuration}min.`);
      
      // User made a choice, clear the waiting flag
      isWaitingForCompletionChoice = false;
      
      // Clear any existing timer
      if (pomodoroTimer) {
        clearTimeout(pomodoroTimer);
        pomodoroTimer = null;
      }
      
      // Convert minutes to milliseconds
      const breakTime = breakMinutes * 60 * 1000;
      
      // Save break end time and status
      pomodoroEndTime = Date.now() + breakTime;
      isPomodoroActive = true;
      isBreakActive = true;
      pomodoroDuration = breakMinutes;
      
      // Create update message for break
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
        isActive: true,
        isBreak: true // Flag to indicate this is a break
      };
      
      // Send update to all tabs
      updateAllContentScripts(updateMessage);
      
      // Set new timer for break
      pomodoroTimer = setTimeout(() => {
        // When break is done, handle the auto-restart properly
        handleBreakCompletion(breakMinutes);
      }, breakTime);
      
      // Show notification that break started
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon/128.jpg'), // Corrected path
        title: 'Break Started',
        message: `${breakMinutes} minute break timer started. Relax!`
      });
      
      // Start sending updates to content scripts
      updatePomodoroStatus();
      
      if (pomodoroCompletionPromptFallbackTimer) {
        clearTimeout(pomodoroCompletionPromptFallbackTimer);
        pomodoroCompletionPromptFallbackTimer = null;
        isWaitingForCompletionChoice = false;
        console.log('BACKGROUND: Cleared completion prompt fallback timer due to START_BREAK.');
      }
      
      sendResponse({ success: true });
      return true; // Required for async response
    }
    
    // Regular stop pomodoro without resetting counters
    if (message.type === 'STOP_POMODORO') {
      // Clear the timer
      if (pomodoroTimer) {
        clearTimeout(pomodoroTimer);
        pomodoroTimer = null;
      }
      
      // Update status
      isPomodoroActive = false;
      isBreakActive = false;
      pomodoroEndTime = 0;
      
      // Notify all tabs that pomodoro is stopped
      updateAllContentScripts({
        type: 'POMODORO_UPDATE',
        isActive: false
      });
      
      // Show notification
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon/128.jpg'), // Corrected path
        title: 'Pomodoro Stopped',
        message: 'Pomodoro timer has been manually stopped.'
      });
      
      sendResponse({ success: true });
      return true; // Required for async response
    }

    // New handler for restarting Pomodoro after break
    if (message.type === 'RESTART_POMODORO') {
      const minutes = message.duration;
      console.log(`BACKGROUND: Restarting Pomodoro for ${minutes} minutes after break.`);
      
      // Essentially re-triggering SET_POMODORO logic
      // Clear any existing timer
      if (pomodoroTimer) {
        clearTimeout(pomodoroTimer);
        pomodoroTimer = null;
      }
      
      const pomodoroTime = minutes * 60 * 1000;
      pomodoroEndTime = Date.now() + pomodoroTime;
      isPomodoroActive = true;
      isBreakActive = false; // It's a work session now
      pomodoroDuration = minutes;
      // lastPomodoroWorkDuration is already set from the previous work session

      const now = Date.now();
      const remainingTime = Math.max(0, pomodoroEndTime - now);
      const remainingMinutes = Math.floor(remainingTime / (60 * 1000));
      const remainingSeconds = Math.floor((remainingTime % (60 * 1000)) / 1000);
      
      const updateMessage = {
        type: 'POMODORO_UPDATE',
        remaining: { total: remainingTime, minutes: remainingMinutes, seconds: remainingSeconds },
        duration: pomodoroDuration,
        isActive: true,
        isBreak: false,
        forceDisplay: true
      };
      updateAllContentScripts(updateMessage);
      
      pomodoroTimer = setTimeout(() => {
        handlePomodoroCompletion();
      }, pomodoroTime);

      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon/128.jpg'), // Corrected path
        title: 'Pomodoro Started',
        message: `${minutes} minute pomodoro timer started. Stay focused!`
      });
      updatePomodoroStatus();
      sendResponse({ success: true });
      return true;
    }

    // New handler for user choosing to stop after break prompt
    if (message.type === 'USER_ACKNOWLEDGED_BREAK_END') {
      console.log('BACKGROUND: User acknowledged break end, not starting new Pomodoro.');
      isPomodoroActive = false;
      isBreakActive = false;
      if (pomodoroTimer) {
        clearTimeout(pomodoroTimer);
        pomodoroTimer = null;
      }
      pomodoroEndTime = 0;
      
      updateAllContentScripts({
        type: 'POMODORO_UPDATE',
        isActive: false,
        reason: 'user_stopped_after_break'
      });
      
      // Optional: Clear the fallback timer if it was set by POMODORO_COMPLETE_PROMPT
      if (pomodoroCompletionPromptFallbackTimer) {
        clearTimeout(pomodoroCompletionPromptFallbackTimer);
        pomodoroCompletionPromptFallbackTimer = null;
      }
      
      sendResponse({ success: true });
      return true;
    }
    
    // Handle stopping pomodoro/break and resetting counters
    if (message.type === 'STOP_POMODORO_AND_RESET') {
      // User made a choice, clear the waiting flag
      isWaitingForCompletionChoice = false;
      
      // Clear the timer
      if (pomodoroTimer) {
        clearTimeout(pomodoroTimer);
        pomodoroTimer = null;
      }
      
      // Update status
      isPomodoroActive = false;
      isBreakActive = false;
      pomodoroEndTime = 0;
      
      // Reset counters
      browser.storage.sync.get(['distractingSites', 'scrollCounts']).then(result => {
        const sites: string[] = result.distractingSites || ['youtube.com', 'x.com', 'reddit.com','instagram.com','facebook.com']; // Added type
        const scrollCounts: Record<string, number> = result.scrollCounts || {}; // Added type
        const resetTime = Date.now();
        
        // Reset all domain-specific counters
        sites.forEach((site: string) => { // Added type for site
          scrollCounts[site] = 0;
        });
        
        // Save the reset counters
        browser.storage.sync.set({ 
          scrollCounts: scrollCounts,
          lastResetTime: resetTime
        }).then(() => {
          // Notify all tabs that pomodoro is stopped and counters are reset
          updateAllContentScripts({
            type: 'POMODORO_STOPPED_AND_RESET',
            isActive: false,
            lastResetTime: resetTime
          });
          
          if (pomodoroCompletionPromptFallbackTimer) {
            clearTimeout(pomodoroCompletionPromptFallbackTimer);
            pomodoroCompletionPromptFallbackTimer = null;
            isWaitingForCompletionChoice = false;
            console.log('BACKGROUND: Cleared completion prompt fallback timer due to STOP_POMODORO_AND_RESET.');
          }
          
          sendResponse({ success: true });
        });
      });
      
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
          isBreak: isBreakActive,
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
      if (pomodoroEndTime <= Date.now()) {
        isPomodoroActive = false;
        isBreakActive = false; // Also reset break status
      }
        sendResponse({
          isActive: isPomodoroActive, 
          isBreak: isBreakActive, // Ensure isBreak is also part of the response
          remaining: { total: 0, minutes: 0, seconds: 0}, // Provide full structure for inactive state
          duration: 0
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
  });

  // Listener for keyboard shortcuts
  browser.commands.onCommand.addListener((command) => {
    if (command === "toggle-pomodoro") {
      console.log('BACKGROUND: Toggle Pomodoro command received');
      if (isPomodoroActive) {
        // If Pomodoro is active, stop it
        if (pomodoroTimer) {
          clearTimeout(pomodoroTimer);
          pomodoroTimer = null;
        }
        isPomodoroActive = false;
        isBreakActive = false;
        pomodoroEndTime = 0;
        updateAllContentScripts({
          type: 'POMODORO_UPDATE',
          isActive: false
        });
        browser.notifications.create({
          type: 'basic',
          iconUrl: browser.runtime.getURL('/icon/128.jpg'),
          title: 'Pomodoro Stopped',
          message: 'Pomodoro timer stopped via keyboard shortcut.'
        });
      } else {
        // If Pomodoro is not active, start it with the last used work duration or default
        const minutesToStart = lastPomodoroWorkDuration || 25;
        console.log(`BACKGROUND: Starting Pomodoro for ${minutesToStart} minutes via keyboard shortcut.`);

        if (pomodoroTimer) {
          clearTimeout(pomodoroTimer);
          pomodoroTimer = null;
        }

        const pomodoroTime = minutesToStart * 60 * 1000;
        pomodoroEndTime = Date.now() + pomodoroTime;
        isPomodoroActive = true;
        isBreakActive = false;
        pomodoroDuration = minutesToStart;
        lastPomodoroWorkDuration = minutesToStart; // Ensure this is set for the session

        const now = Date.now();
        const remainingTime = Math.max(0, pomodoroEndTime - now);
        const remainingMinutes = Math.floor(remainingTime / (60 * 1000));
        const remainingSeconds = Math.floor((remainingTime % (60 * 1000)) / 1000);

        const updateMessage = {
          type: 'POMODORO_UPDATE',
          remaining: { total: remainingTime, minutes: remainingMinutes, seconds: remainingSeconds },
          duration: pomodoroDuration,
          isActive: true,
          isBreak: false,
          forceDisplay: true
        };
        updateAllContentScripts(updateMessage);

        pomodoroTimer = setTimeout(() => {
          handlePomodoroCompletion();
        }, pomodoroTime);

        browser.notifications.create({
          type: 'basic',
          iconUrl: browser.runtime.getURL('/icon/128.jpg'),
          title: 'Pomodoro Started',
          message: `${minutesToStart} minute pomodoro timer started via keyboard shortcut.`
        });
        updatePomodoroStatus();
      }
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