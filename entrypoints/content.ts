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
    let distractingSites = ['youtube.com', 'x.com', 'reddit.com']; // Default sites
    let resetInterval = 0; // Default: no auto reset
    let lastResetTime = Date.now();
    let customLimits: Record<string, number> = {}; // Custom scroll limits per domain
    let adBlockerCompatMode = true; // Enable compatibility mode for ad blockers
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
            console.log('CONTENT SCRIPT: Setting pomodoro overlay display to block.');
            if (pomodoroOverlay) pomodoroOverlay.style.display = 'block';
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
          document.body.appendChild(modalOverlay);
          console.log('CONTENT SCRIPT: Simplified pomodoro completion modal added to DOM.');
          
          // Simplified button handlers with minimal event listeners
          const stopBtn = document.getElementById('pomodoro-stop-btn-modal');
          const breakBtn = document.getElementById('pomodoro-break-btn-modal');
          
          if (stopBtn) {
            stopBtn.onclick = () => {
              console.log('CONTENT SCRIPT: Stop button clicked');
              modalOverlay.style.display = 'none';
              
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
              modalOverlay.style.display = 'none';
              
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
        }
      } else if (message.type === 'BREAK_COMPLETE_PROMPT') {
        console.log('CONTENT SCRIPT: BREAK_COMPLETE_PROMPT received. Last work duration:', message.lastPomodoroWorkDuration);
        removeCompletionModal(); // Clear any other modals
        if (pomodoroOverlay) pomodoroOverlay.style.display = 'none'; // Hide timer overlay
        stopLocalPomodoroUpdate();

        const lastWorkDuration = message.lastPomodoroWorkDuration || 25; // Default if undefined
        const modalId = 'pomodoro-break-over-modal-unique';

        let existingModal = document.getElementById(modalId);
        if (existingModal) existingModal.remove();

        const modalOverlay = document.createElement('div');
        modalOverlay.id = modalId;
        modalOverlay.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background-color: rgba(0, 0, 0, 0.75); display: flex; align-items: center;
          justify-content: center; z-index: 2147483647;
        `;
        
        modalOverlay.innerHTML = `
          <div style="background-color: white; padding: 28px; border-radius: 14px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35); max-width: 460px; text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            
            <div style="font-size: 54px; margin-bottom: 20px; color: #2196f3;">☕</div>
            <h2 style="margin-top: 0; color: #333; font-size: 24px; font-weight: 600;">Break Over!</h2>
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 12px 0 20px 0;">
              Your break is finished. Ready to start another ${lastWorkDuration} minute Pomodoro session?
            </p>
            <div style="display: flex; justify-content: space-around; gap: 15px; margin-top: 25px;">
              <button id="pomodoro-stop-after-break-btn" style="flex: 1; padding: 14px 20px; background-color: #f44336; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; transition: all 0.2s; font-weight: 500; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">Stop</button>
              <button id="pomodoro-start-new-btn" style="flex: 1; padding: 14px 20px; background-color: #4caf50; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; transition: all 0.2s; font-weight: 500; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">Start (${lastWorkDuration} min)</button>
            </div>
          </div>
        `;
        
        document.body.appendChild(modalOverlay);
        console.log('CONTENT SCRIPT: Pomodoro break over modal added to DOM.');

        const stopBtn = document.getElementById('pomodoro-stop-after-break-btn');
        const startBtn = document.getElementById('pomodoro-start-new-btn');

        if (stopBtn) {
          stopBtn.onclick = () => {
            console.log('CONTENT SCRIPT: Stop after break clicked');
            modalOverlay.remove();
            browser.runtime.sendMessage({ type: 'USER_ACKNOWLEDGED_BREAK_END' })
              .catch(err => console.error('CONTENT SCRIPT: Error sending USER_ACKNOWLEDGED_BREAK_END:', err));
          };
        }

        if (startBtn) {
          startBtn.onclick = () => {
            console.log('CONTENT SCRIPT: Start new Pomodoro after break clicked');
            modalOverlay.remove();
            browser.runtime.sendMessage({ type: 'RESTART_POMODORO', duration: lastWorkDuration })
              .catch(err => console.error('CONTENT SCRIPT: Error sending RESTART_POMODORO:', err));
          };
        }
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
            if (pomodoroOverlay) pomodoroOverlay.style.display = 'block';
            
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
        if (pomodoroOverlay && document.body.contains(pomodoroOverlay)) {
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
        pomodoroOverlay.style.cssText = `
          position: fixed;
          background-color: rgba(76, 175, 80, 0.85);
          color: white;
          padding: 6px 10px;
          border-radius: 20px;
          font-weight: bold;
          z-index: 2147483647; /* Maximum z-index to ensure visibility */
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          display: none; /* Start hidden, will be shown by handler */
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid rgba(255, 255, 255, 0.3);
          /* animation: pomodoroFadeIn 0.5s ease-in-out; // Animation applied on show */
          font-size: 12px;
        `;
        
        const isLocalPdf = window.location.protocol === 'file:' && window.location.pathname.endsWith('.pdf');

        if (isLocalPdf) {
          pomodoroOverlay.style.bottom = '20px';
          pomodoroOverlay.style.right = '20px';
        } else {
          pomodoroOverlay.style.top = '20px';
          pomodoroOverlay.style.right = '20px';
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

        const tryAppendAndResolve = () => {
          if (document.body) {
            if (!document.body.contains(pomodoroOverlay)) {
              document.body.appendChild(pomodoroOverlay);
              console.log('CONTENT SCRIPT: Pomodoro overlay appended to DOM.');
            }
            // Apply animation when it's about to be shown
            if (isLocalPdf) {
                pomodoroOverlay.style.animation = 'pomodoroFadeInUp 0.3s ease-out';
            } else {
                pomodoroOverlay.style.animation = 'pomodoroFadeInDown 0.3s ease-out';
            }
            pomodoroOverlay.style.opacity = '1'; // Ensure opacity is set
            resolve();
          } else {
            console.log('CONTENT SCRIPT: document.body not ready, retrying append Pomodoro overlay.');
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
        distractingSites: ['youtube.com', 'x.com', 'reddit.com'], // Fallback
        resetInterval: 0,
        lastResetTime: Date.now(),
        customLimits: {}, // Custom scroll limits per domain
        youtubeSettings: { hideShorts: false, hideHomeFeed: false }, // YouTube-specific settings
        adBlockerCompatMode: true // Enable compatibility mode for ad blockers
      });
      
      maxScrolls = result.maxScrolls;
      distractingSites = result.distractingSites;
      resetInterval = result.resetInterval;
      lastResetTime = result.lastResetTime;
      customLimits = result.customLimits;
      youtubeSettings = result.youtubeSettings;
      adBlockerCompatMode = result.adBlockerCompatMode;
      
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
