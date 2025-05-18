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
  const [distractingSites, setDistractingSites] = useState<string[]>(['youtube.com', 'x.com', 'reddit.com']);
  const [newSite, setNewSite] = useState<string>('');
  const [resetInterval, setResetInterval] = useState<number>(0);
  // New state for custom limits
  const [customLimits, setCustomLimits] = useState<Record<string, number>>({});
  const [editingSite, setEditingSite] = useState<string | null>(null);
  const [customLimitInput, setCustomLimitInput] = useState<string>('');
  // New state for YouTube settings
  const [youtubeSettings, setYoutubeSettings] = useState<{
    hideShorts: boolean;
    hideHomeFeed: boolean;
  }>({ hideShorts: false, hideHomeFeed: false });
  // New state for edit mode
  const [editMode, setEditMode] = useState<boolean>(false);

  useEffect(() => {
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
        
        const loadedDistractingSites = settings.distractingSites || ['youtube.com', 'x.com', 'reddit.com'];
        setDistractingSites(loadedDistractingSites);
        
        // Load custom limits if they exist
        if (settings.customLimits) {
          setCustomLimits(settings.customLimits);
        }
        
        // Load YouTube settings if they exist
        if (settings.youtubeSettings) {
          setYoutubeSettings(settings.youtubeSettings);
        }
        
        setResetInterval(settings.resetInterval || 0);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error loading settings:', error);
        setIsLoading(false);
      });
  }, []);

  // Effect to find and set the current scroll count based on domain
  useEffect(() => {
    if (currentDomain && Object.keys(scrollCounts).length > 0) {
      // Find the matching domain from our distracting sites
      const matchingDomain = distractingSites.find(site => currentDomain.includes(site));
      
      if (matchingDomain) {
        // Show the count for this domain
        setCurrentScrolls(scrollCounts[matchingDomain] || 0);
      } else {
        // Not on a tracked site
        setCurrentScrolls(0);
      }
    }
  }, [currentDomain, scrollCounts, distractingSites]);

  // Effect to sync maxScrollsInput when maxScrolls changes
  useEffect(() => {
    // This effect ensures that if maxScrolls is changed programmatically
    // (e.g., on load, or after blur/save validation sets it),
    // the input field (maxScrollsInput) reflects this validated numeric state.
    if (maxScrolls.toString() !== maxScrollsInput) { // Only update if actually different
        setMaxScrollsInput(maxScrolls.toString());
    }
  }, [maxScrolls]); // CRITICAL: Only depend on maxScrolls

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

  // Handle edit site by double-clicking on a site icon
  const handleEditSite = (site: string) => {
    setEditingSite(site);
    setCustomLimitInput(customLimits[site]?.toString() || '');
  };

  // Handle custom limit input change
  const handleCustomLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomLimitInput(e.target.value);
  };

  // Handle YouTube settings toggle
  const handleYoutubeSettingToggle = (setting: 'hideShorts' | 'hideHomeFeed') => {
    setYoutubeSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  // Save custom limit for site
  const saveCustomLimit = () => {
    if (!editingSite) return;
    
    const limit = parseInt(customLimitInput);
    if (!isNaN(limit) && limit > 0) {
      setCustomLimits(prev => ({
        ...prev,
        [editingSite]: limit
      }));
    } else if (customLimitInput === '') {
      // Remove the custom limit if input is empty
      setCustomLimits(prev => {
        const updated = { ...prev };
        delete updated[editingSite];
        return updated;
      });
    }
    
    // Save settings immediately when closing the modal
    if (isEditingYoutube) {
      browser.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        maxScrolls,
        distractingSites,
        resetInterval,
        customLimits: !isNaN(limit) && limit > 0 ? 
          {...customLimits, [editingSite]: limit} : 
          {...customLimits},
        youtubeSettings
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

    browser.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      maxScrolls: scrollsToSave,
      distractingSites,
      resetInterval,
      customLimits,
      youtubeSettings // Save YouTube settings
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
    setSaveStatus('Resetting...');
    browser.runtime.sendMessage({ type: 'RESET_COUNTER' })
      .then(() => {
        // Update the local state after reset
        const resetCounts = { ...scrollCounts };
        distractingSites.forEach(site => {
          resetCounts[site] = 0;
        });
        setScrollCounts(resetCounts);
        setCurrentScrolls(0);
        
        setSaveStatus('Counter reset!');
        setTimeout(() => setSaveStatus(''), 2000);
      })
      .catch(error => {
        console.error('Error resetting counter:', error);
        setSaveStatus('Error resetting');
      });
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
      
      // Initialize scroll count for new site
      setScrollCounts(prev => ({
        ...prev,
        [formattedSite]: 0
      }));
      
      setNewSite('');
    }
  };

  const handleRemoveSite = (siteToRemove: string) => {
    setDistractingSites(distractingSites.filter(site => site !== siteToRemove));
    
    // Remove from scrollCounts and customLimits
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

  // Get the effective scroll limit for a site (custom or global)
  const getEffectiveLimit = (site: string): number => {
    return customLimits[site] || maxScrolls;
  };

  // Check if the editing site is YouTube
  const isEditingYoutube = editingSite?.includes('youtube.com') || false;

  // Toggle edit mode
  const toggleEditMode = () => {
    setEditMode(!editMode);
  };

  if (isLoading) {
    return <div className="loading">Loading settings...</div>;
  }

  return (
    <div className="container">
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
              width: `${Math.min(100, (currentScrolls / (
                currentDomain ? 
                getEffectiveLimit(distractingSites.find(site => currentDomain.includes(site)) || '') : 
                maxScrolls
              )) * 100)}%` 
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
      </div>

      <div className="settings-group">
        <label htmlFor="reset-interval">Auto-reset counter after:</label>
        <div className="inline-input">
          <input
            id="reset-interval"
            type="number"
            min="0"
            value={resetInterval}
            onChange={(e) => handleResetIntervalChange(Math.max(0, parseInt(e.target.value) || 0))}
            className="small-input"
          />
          <span className="unit-text">minutes</span>
          <span className="info-text">(0 = no auto reset)</span>
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
          
          {/* Edit/Done button positioned within the icon display area */}
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
        </div>

        {/* Custom limit editing modal with YouTube-specific options */}
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
          >
            <div 
              style={{
                backgroundColor: 'white',
                padding: '15px',
                borderRadius: '8px',
                width: '280px',
                boxShadow: '0 3px 10px rgba(0,0,0,0.3)'
              }}
            >
              <h3 style={{margin: '0 0 10px'}}>Custom limit for {editingSite}</h3>
              <p style={{margin: '0 0 15px', fontSize: '13px'}}>
                Set a custom scroll limit for this site or leave empty to use the global limit.
              </p>
              <input
                type="number"
                min="1"
                value={customLimitInput}
                onChange={handleCustomLimitChange}
                placeholder="Enter custom limit"
                style={{
                  width: '100%',
                  padding: '8px',
                  marginBottom: '15px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)'
                }}
              />
              
              {/* YouTube-specific settings */}
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
                        <span 
                          style={{
                            position: 'absolute',
                            content: '""',
                            height: '16px',
                            width: '16px',
                            left: youtubeSettings.hideShorts ? '22px' : '2px',
                            bottom: '2px',
                            backgroundColor: 'white',
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
                        <span 
                          style={{
                            position: 'absolute',
                            content: '""',
                            height: '16px',
                            width: '16px',
                            left: youtubeSettings.hideHomeFeed ? '22px' : '2px',
                            bottom: '2px',
                            backgroundColor: 'white',
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
            Reset Counter
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
