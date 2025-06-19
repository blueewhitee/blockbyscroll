import { useState, useEffect } from 'react';
import './App.css';

export default function App() {
  const [maxScrolls, setMaxScrolls] = useState<number>(30);
  const [maxScrollsInput, setMaxScrollsInput] = useState<string>(() => maxScrolls.toString());
  const [currentScrolls, setCurrentScrolls] = useState<number>(0);
  const [currentDomain, setCurrentDomain] = useState<string>('');
  const [scrollCounts, setScrollCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [distractingSites, setDistractingSites] = useState<string[]>(['youtube.com', 'x.com', 'reddit.com','instagram.com','facebook.com', 'instagram.com']);
  const [newSite, setNewSite] = useState<string>('');
  const [resetInterval, setResetInterval] = useState<number>(0);
  const [customLimits, setCustomLimits] = useState<Record<string, number>>({});
  const [editingSite, setEditingSite] = useState<string | null>(null);
  const [customLimitInput, setCustomLimitInput] = useState<string>('');  const [youtubeSettings, setYoutubeSettings] = useState<{
    hideShorts: boolean;
    hideHomeFeed: boolean;
  }>({ hideShorts: false, hideHomeFeed: false });
  const [instagramSettings, setInstagramSettings] = useState<{
    hideReels: boolean;
  }>({ hideReels: false });
  const [editMode, setEditMode] = useState<boolean>(false);
  const [showPomodoroPopup, setShowPomodoroPopup] = useState<boolean>(false);
  const [pomodoroMinutes, setPomodoroMinutes] = useState<string>("25");
  const [showPomodoroCompletePopup, setShowPomodoroCompletePopup] = useState<boolean>(false);
  const [completedPomodoroDuration, setCompletedPomodoroDuration] = useState<number>(25);

  useEffect(() => {
    // Check for URL parameters to handle pomodoro completion popup
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const duration = urlParams.get('duration');
    
    if (action === 'pomodoro_complete' && duration) {
      const durationNum = parseInt(duration, 10);
      if (!isNaN(durationNum)) {
        setCompletedPomodoroDuration(durationNum);
        setShowPomodoroCompletePopup(true);
        return; // Skip the normal tab querying if showing completion popup
      }
    }

    // Get current active tab to identify the current domain
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.url) {
        try {
          const url = new URL(activeTab.url);
          const domain = url.hostname.replace(/^www\./, '');
          setCurrentDomain(domain);
        } catch (error) {
          console.error('Error parsing URL:', error);
        }
      }
    });

    // Load settings from storage
    browser.runtime.sendMessage({ type: 'GET_SETTINGS' })
      .then((settings) => {
        const loadedMaxScrolls = settings.maxScrolls || 30;
        setMaxScrolls(loadedMaxScrolls);
        
        const loadedScrollCounts = settings.scrollCounts || {};
        setScrollCounts(loadedScrollCounts);
        
        const loadedDistractingSites = settings.distractingSites || ['youtube.com', 'x.com', 'reddit.com','instagram.com','facebook.com'];
        setDistractingSites(loadedDistractingSites);
        
        // Load custom limits if they exist
        if (settings.customLimits) {
          setCustomLimits(settings.customLimits);
        }
          // Load YouTube settings if they exist
        if (settings.youtubeSettings) {
          setYoutubeSettings(settings.youtubeSettings);
        }
        
        // Load Instagram settings if they exist
        if (settings.instagramSettings) {
          setInstagramSettings(settings.instagramSettings);
        }
        
        setResetInterval(settings.resetInterval || 0);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error loading settings:', error);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (currentDomain && Object.keys(scrollCounts).length > 0) {
      const matchingDomain = distractingSites.find(site => currentDomain.includes(site));
      
      if (matchingDomain) {
        setCurrentScrolls(scrollCounts[matchingDomain] || 0);
      } else {
        setCurrentScrolls(0);
      }
    }
  }, [currentDomain, scrollCounts, distractingSites]);

  useEffect(() => {
    if (maxScrolls.toString() !== maxScrollsInput) { 
        setMaxScrollsInput(maxScrolls.toString());
    }
  }, [maxScrolls]);

  const handleMaxScrollsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMaxScrollsInput(e.target.value);
  };

  const handleMaxScrollsBlur = () => {
    let num = parseInt(maxScrollsInput);
    if (isNaN(num) || num < 1) {
      num = 30;
    }
    setMaxScrolls(num);
  };

  const handleEditSite = (site: string) => {
    setEditingSite(site);
    setCustomLimitInput(customLimits[site]?.toString() || '');
  };

  const handleCustomLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomLimitInput(e.target.value);
  };
  const handleYoutubeSettingToggle = (setting: 'hideShorts' | 'hideHomeFeed') => {
    setYoutubeSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };  const handleInstagramSettingToggle = (setting: 'hideReels') => {
    setInstagramSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const saveCustomLimit = () => {
    if (!editingSite) return;
    
    const limit = parseInt(customLimitInput);
    if (!isNaN(limit) && limit > 0) {
      setCustomLimits(prev => ({ ...prev, [editingSite]: limit }));
    } else if (customLimitInput === '') {
      setCustomLimits(prev => {
        const updated = { ...prev };
        delete updated[editingSite];
        return updated;
      });
    }
    
    if (isEditingYoutube) {
      browser.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        maxScrolls,
        distractingSites,
        resetInterval,        customLimits: !isNaN(limit) && limit > 0 ? 
          {...customLimits, [editingSite]: limit} : 
          {...customLimits},
        youtubeSettings,
        instagramSettings
      })
      .then(() => {
        setSaveStatus('Saved!');
        setTimeout(() => setSaveStatus(''), 2000);
      })
      .catch(error => {
        console.error('Error saving settings:', error);
        setSaveStatus('Error saving');
      });
    }
    
    setEditingSite(null);
  };

  const handleSave = () => {
    setSaveStatus('Saving...');
    let currentNumVal = parseInt(maxScrollsInput);
    if (isNaN(currentNumVal) || currentNumVal < 1) {
        currentNumVal = 30;
    }
    setMaxScrolls(currentNumVal);

    const scrollsToSave = currentNumVal;

    browser.runtime.sendMessage({      type: 'SAVE_SETTINGS',
      maxScrolls: scrollsToSave,
      distractingSites,
      resetInterval,
      customLimits,
      youtubeSettings,
      instagramSettings
    })
      .then(() => {
        setSaveStatus('Saved!');
        setTimeout(() => setSaveStatus(''), 2000);
      })
      .catch(error => {
        console.error('Error saving settings:', error);
        setSaveStatus('Error saving');
      });
  };

  const handleReset = () => {
    setShowPomodoroPopup(true);
  };

  const handlePomodoroDone = () => {
    const minutes = parseInt(pomodoroMinutes);
    if (!isNaN(minutes) && minutes > 0) {
      setSaveStatus('Starting pomodoro timer...');
      
      browser.tabs.query({ active: true, currentWindow: true })
        .then(tabs => {
          if (tabs.length === 0) return;
          const activeTab = tabs[0];
          
          return browser.runtime.sendMessage({ 
            type: 'SET_POMODORO', 
            minutes: minutes,
            sourceTabId: activeTab.id 
          });
        })
        .then(() => {
          console.log('Pomodoro timer started successfully');
          setSaveStatus(`Pomodoro set for ${minutes} minutes!`);
            const successMessage = document.createElement('div');
          successMessage.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background-color: rgba(76, 175, 80, 0.95); color: white; padding: 20px;
            border-radius: 10px; text-align: center; font-weight: bold;
            z-index: 10000; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
          `;
          successMessage.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 10px;">🍅</div>
            <div style="font-size: 18px; margin-bottom: 5px;">Pomodoro Timer Started!</div>
            <div style="font-size: 16px; opacity: 0.9;">${minutes} minute${minutes !== 1 ? 's' : ''}</div>
          `;
          document.body.appendChild(successMessage);
          
          setTimeout(() => {
            document.body.removeChild(successMessage);
            window.close();
          }, 1500);
        })
        .catch(error => {
          console.error('Error setting pomodoro:', error);
          setSaveStatus('Error setting pomodoro');
        });
    }
    setShowPomodoroPopup(false);
  };

  const handlePomodoroCompleteStart5MinBreak = () => {
    const breakDuration = Math.round(completedPomodoroDuration / 5) || 5;
    browser.runtime.sendMessage({ 
      type: 'START_BREAK', 
      minutes: breakDuration 
    });
    window.close();
  };

  const handlePomodoroCompleteStopAndReset = () => {
    browser.runtime.sendMessage({ type: 'STOP_POMODORO_AND_RESET' });
    window.close();
  };

  const handleAddSite = () => {
    if (newSite.trim() === '') return;

    let formattedSite = newSite.trim().toLowerCase();
    formattedSite = formattedSite
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];

    if (formattedSite && !distractingSites.includes(formattedSite)) {
      setDistractingSites([...distractingSites, formattedSite]);
      setScrollCounts(prev => ({ ...prev, [formattedSite]: 0 }));
      setNewSite('');
    }
  };

  const handleRemoveSite = (siteToRemove: string) => {
    setDistractingSites(distractingSites.filter(site => site !== siteToRemove));
    setScrollCounts(prev => {
      const updated = { ...prev };
      delete updated[siteToRemove];
      return updated;
    });
    setCustomLimits(prev => {
      const updated = { ...prev };
      delete updated[siteToRemove];
      return updated;
    });
  };

  const handleResetIntervalChange = (value: number) => {
    setResetInterval(value);
  };

  const getFaviconUrl = (domain: string) => {
    return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=16`;
  };

  const getEffectiveLimit = (site: string): number => {
    return customLimits[site] || maxScrolls;
  };

  const isEditingYoutube = editingSite?.includes('youtube.com') || false;

  const toggleEditMode = () => {
    setEditMode(!editMode);
  };

  useEffect(() => {
    // Check if this popup was opened for pomodoro completion
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const duration = urlParams.get('duration');
    
    if (action === 'pomodoro_complete' && duration) {
      setCompletedPomodoroDuration(parseInt(duration));
      setShowPomodoroCompletePopup(true);
    }
  }, []);

  if (isLoading) {
    return <div className="loading">Loading settings...</div>;
  }
  return (
    <div className="container breathing-background">
      <header>
        <h1>NoMoScroll</h1>
        <p className="subtitle">Focus and control your browsing habits</p>
      </header>
      
      <div className="stat-card">
        <div className="stat-label">Current Scrolls</div>
        <div className="stat-value">
          {currentScrolls} / {currentDomain && getEffectiveLimit(distractingSites.find(site => currentDomain.includes(site)) || '')}
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ 
              width: `${Math.min(100, (currentScrolls / (currentDomain ? getEffectiveLimit(distractingSites.find(site => currentDomain.includes(site)) || '') : maxScrolls)) * 100)}%` 
            }}
          />
        </div>
      </div>
      
      <div className="settings-group">
        <label htmlFor="max-scrolls">Global scroll limit:</label>
        <input
          id="max-scrolls"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={maxScrollsInput}
          onChange={handleMaxScrollsInputChange}
          onBlur={handleMaxScrollsBlur}
        />
        <p style={{fontSize: '12px', color: 'var(--secondary-text)', margin: '4px 0'}}>
          Click a site icon to set custom limits.
        </p>
      </div>      <div className="settings-group">
        <label htmlFor="reset-interval">Auto-reset counter after:</label>        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <div className="inline-input" style={{ flex: '0 0 auto' }}>
            <input
              id="reset-interval"
              type="number"
              min="0"
              value={resetInterval}
              onChange={(e) => handleResetIntervalChange(Math.max(0, parseInt(e.target.value) || 0))}
              className="small-input"
              style={{ width: '80px', fontSize: '14px', fontWeight: '600' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--secondary-text)', marginLeft: '6px' }}>minutes</span>
          </div>
            {/* Only show toggle section if at least one site is in the blocklist */}
          {(distractingSites.some(site => site.includes('youtube.com')) || distractingSites.some(site => site.includes('instagram.com'))) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '15px' }}>
              {/* YouTube Shorts Toggle - only show if youtube.com is in distractingSites */}
              {distractingSites.some(site => site.includes('youtube.com')) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <img 
                    src={getFaviconUrl('youtube.com')} 
                    alt="YouTube" 
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--text-color)', whiteSpace: 'nowrap' }}>Block Shorts</span>
                  <div 
                    onClick={() => handleYoutubeSettingToggle('hideShorts')}
                    style={{
                      position: 'relative',
                      display: 'inline-block',
                      width: '30px',
                      height: '16px',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={youtubeSettings.hideShorts}
                      onChange={() => {}}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span 
                      style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: youtubeSettings.hideShorts ? 'var(--primary-color)' : '#ccc',
                        borderRadius: '16px',
                        transition: '.3s'
                      }}
                    >
                      <span 
                        style={{
                          position: 'absolute',
                          content: '""',
                          height: '12px',
                          width: '12px',                          left: youtubeSettings.hideShorts ? '16px' : '2px',
                          bottom: '2px',
                          backgroundColor: '#ffffff',
                          borderRadius: '50%',
                          transition: '.3s'
                        }}
                      />
                    </span>
                  </div>
                </div>
              )}

              {/* Instagram Reels Toggle - only show if instagram.com is in distractingSites */}
              {distractingSites.some(site => site.includes('instagram.com')) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <img 
                    src={getFaviconUrl('instagram.com')} 
                    alt="Instagram" 
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--text-color)', whiteSpace: 'nowrap' }}>Block Reels</span>
                  <div 
                    onClick={() => handleInstagramSettingToggle('hideReels')}
                    style={{
                      position: 'relative',
                      display: 'inline-block',
                      width: '30px',
                      height: '16px',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={instagramSettings.hideReels}
                      onChange={() => {}}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span 
                      style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: instagramSettings.hideReels ? 'var(--primary-color)' : '#ccc',
                        borderRadius: '16px',
                        transition: '.3s'
                      }}
                    >
                      <span 
                        style={{
                          position: 'absolute',
                          content: '""',
                          height: '12px',
                          width: '12px',                          left: instagramSettings.hideReels ? '16px' : '2px',
                          bottom: '2px',
                          backgroundColor: '#ffffff',
                          borderRadius: '50%',
                          transition: '.3s'
                        }}
                      />
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="settings-group">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <label>Blocked Sites:</label>
        </div>
        <div className="sites-container" style={{ position: 'relative' }}>
          {distractingSites.map((site) => (
            <div 
              key={site} 
              className="site-item" 
              title={customLimits[site] ? `${site} (Custom limit: ${customLimits[site]})` : site}
              onDoubleClick={() => handleRemoveSite(site)}
              onClick={(e) => {
                if (editMode) {
                  handleRemoveSite(site);
                } else {
                  handleEditSite(site);
                }
              }}
              style={{ 
                position: 'relative',
                cursor: editMode ? 'pointer' : 'default'
              }}
            >
              <img src={getFaviconUrl(site)} alt={`${site} favicon`} className="site-favicon" />
              <span className="site-name">{site}</span>
              {customLimits[site] && (
                <span 
                  className="custom-limit-badge" 
                  style={{
                    position: 'absolute',
                    bottom: '-5px',
                    right: '-5px',
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    borderRadius: '8px',
                    padding: '0 4px',
                    fontSize: '9px',
                    fontWeight: 'bold'
                  }}
                >
                  {customLimits[site]}
                </span>
              )}
              {editMode && (
                <div
                  className="site-delete-overlay"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '20px',
                    fontWeight: 'bold',
                    backgroundColor: 'transparent',
                    transition: 'background-color 0.2s',
                    zIndex: 5,
                    opacity: 0,
                    borderRadius: '4px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(220, 53, 69, 0.85)';
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.opacity = '0';
                  }}
                >
                  ✕
                </div>
              )}
            </div>
          ))}
          {distractingSites.length === 0 && (
            <p style={{textAlign: 'center', color: 'var(--secondary-text)', fontSize: '13px', margin: '10px 0'}}>
              No sites added yet.
            </p>
          )}
          
          <button 
            onClick={toggleEditMode} 
            className={editMode ? "save-button" : "reset-button"}
            style={{
              position: 'absolute',
              top: '0',
              right: '0',
              padding: '4px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              border: 'none',
              borderRadius: '4px',
              zIndex: 10
            }}
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
        </div>        {showPomodoroPopup && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.3)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
            }}
          >            <div 
              style={{
                backgroundColor: '#ffffff',
                padding: '15px',
                borderRadius: '8px',
                width: '280px',
                boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
                border: '1px solid #dddddd'
              }}
            >              <h3 style={{margin: '0 0 10px', color: '#333333'}}>Set Pomodoro Timer</h3>
              <p style={{margin: '0 0 15px', fontSize: '13px', color: '#666666'}}>
                Set your focus time in minutes.
              </p>              <input
                type="number"
                min="1"
                value={pomodoroMinutes}
                onChange={(e) => setPomodoroMinutes(e.target.value)}
                placeholder="Enter minutes"
                className="small-input"
                style={{
                  width: '100%',
                  padding: '12px',
                  marginBottom: '15px',
                  borderRadius: '8px',
                  border: '2px solid var(--border-color)',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              />

              <div style={{display: 'flex', justifyContent: 'space-between', gap: '10px'}}>
                <button 
                  onClick={() => setShowPomodoroPopup(false)} 
                  className="reset-button"
                  style={{
                    padding: '8px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    flex: 1
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handlePomodoroDone}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    flex: 1
                  }}
                >
                  Start
                </button>
              </div>
            </div>
          </div>
        )}        {showPomodoroCompletePopup && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.3)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
            }}
          >            <div 
              style={{
                backgroundColor: '#ffffff',
                padding: '25px',
                borderRadius: '12px',
                width: '350px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                textAlign: 'center',
                border: '1px solid #dddddd'
              }}
            >
              <div style={{fontSize: '48px', marginBottom: '15px'}}>🎉</div>
              <h2 style={{margin: '0 0 10px', color: '#333333', fontSize: '22px', fontWeight: '600'}}>Pomodoro Complete!</h2>              <p style={{margin: '0 0 20px', fontSize: '15px', color: '#666666', lineHeight: '1.5'}}>
                Great work! You've completed your {completedPomodoroDuration}-minute pomodoro session.
              </p>
              <p style={{margin: '0 0 25px', fontSize: '14px', color: '#cccccc'}}>
                Would you like to take a {Math.round(completedPomodoroDuration / 5) || 5}-minute break or stop the timer?
              </p>
              <div style={{display: 'flex', gap: '12px', justifyContent: 'center'}}>
                <button 
                  onClick={handlePomodoroCompleteStart5MinBreak}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1976d2'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2196f3'}
                >
                  Start Break ({Math.round(completedPomodoroDuration / 5) || 5}m)
                </button>
                <button 
                  onClick={handlePomodoroCompleteStopAndReset}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d32f2f'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f44336'}
                >
                  Stop & Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {editingSite && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
            }}
          >            <div 
              style={{
                backgroundColor: 'rgba(26, 26, 46, 0.95)',
                padding: '15px',
                borderRadius: '8px',
                width: '280px',
                boxShadow: '0 3px 10px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}
            >
              <h3 style={{margin: '0 0 10px', color: '#ffffff'}}>Custom limit for {editingSite}</h3>
              <p style={{margin: '0 0 15px', fontSize: '13px'}}>
                Set a custom scroll limit for this site or leave empty to use the global limit.
              </p>              <input
                type="number"
                min="1"
                value={customLimitInput}
                onChange={handleCustomLimitChange}
                placeholder="Enter custom limit"
                className="small-input"
                style={{
                  width: '100%',
                  padding: '12px',
                  marginBottom: '15px',
                  borderRadius: '8px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff'
                }}
              />
              
              {isEditingYoutube && (
                <div style={{marginBottom: '15px'}}>
                  <h4 style={{margin: '15px 0 10px', borderTop: '1px solid #eee', paddingTop: '15px'}}>Hide Tabs</h4>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                    <label htmlFor="hide-shorts" style={{fontSize: '14px'}}>Hide Shorts</label>
                    <div 
                      className="toggle-switch"
                      onClick={() => handleYoutubeSettingToggle('hideShorts')}
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                        width: '40px',
                        height: '20px',
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        id="hide-shorts"
                        type="checkbox"
                        checked={youtubeSettings.hideShorts}
                        onChange={() => {}}
                        style={{
                          opacity: 0,
                          width: 0,
                          height: 0
                        }}
                      />
                      <span 
                        className="toggle-slider"
                        style={{
                          position: 'absolute',
                          cursor: 'pointer',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: youtubeSettings.hideShorts ? 'var(--primary-color)' : '#ccc',
                          borderRadius: '34px',
                          transition: '.4s'
                        }}
                      >
                        <span                          style={{
                            position: 'absolute',
                            content: '""',
                            height: '16px',
                            width: '16px',
                            left: youtubeSettings.hideShorts ? '22px' : '2px',
                            bottom: '2px',
                            backgroundColor: '#ffffff',
                            borderRadius: '50%',
                            transition: '.4s'
                          }}
                        />
                      </span>
                    </div>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <label htmlFor="hide-home-feed" style={{fontSize: '14px'}}>Hide Home Feed<br/>and Redirect to Subscriptions</label>
                    <div 
                      className="toggle-switch"
                      onClick={() => handleYoutubeSettingToggle('hideHomeFeed')}
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                        width: '40px',
                        height: '20px',
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        id="hide-home-feed"
                        type="checkbox"
                        checked={youtubeSettings.hideHomeFeed}
                        onChange={() => {}}
                        style={{
                          opacity: 0,
                          width: 0,
                          height: 0
                        }}
                      />
                      <span 
                        className="toggle-slider"
                        style={{
                          position: 'absolute',
                          cursor: 'pointer',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: youtubeSettings.hideHomeFeed ? 'var(--primary-color)' : '#ccc',
                          borderRadius: '34px',
                          transition: '.4s'
                        }}
                      >
                        <span                          style={{
                            position: 'absolute',
                            content: '""',
                            height: '16px',
                            width: '16px',
                            left: youtubeSettings.hideHomeFeed ? '22px' : '2px',
                            bottom: '2px',
                            backgroundColor: '#ffffff',
                            borderRadius: '50%',
                            transition: '.4s'
                          }}
                        />
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div style={{display: 'flex', justifyContent: 'space-between', gap: '10px'}}>
                <button 
                  onClick={() => setEditingSite(null)} 
                  className="reset-button"
                  style={{
                    padding: '8px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    flex: 1
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={saveCustomLimit}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    flex: 1
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="add-site">
          <input
            type="text"
            placeholder="e.g. news.com, social.network"
            value={newSite}
            onChange={(e) => setNewSite(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSite()}
          />
          <button onClick={handleAddSite} className="add-site-plus-button" aria-label="Add site">
            +
          </button>
        </div>
        <div className="button-group" style={{ marginTop: '10px' }}>
          <button className="reset-button" onClick={handleReset}>
            Set Pomodoro
          </button>
          <button className="save-button" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
      
      <div className="status-message">{saveStatus}</div>
    </div>
  );
}
