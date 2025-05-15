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
      customLimits
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
          Click a site icon to set custom limits. use the ✕ to remove from blocklist.
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
        <label>Blocked Sites:</label>
        <div className="sites-container">
          {distractingSites.map((site) => (
            <div 
              key={site} 
              className="site-item" 
              title={customLimits[site] ? `${site} (Custom limit: ${customLimits[site]})` : site}
              onDoubleClick={() => handleRemoveSite(site)}
              onClick={() => handleEditSite(site)}
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
              <button
                className="remove-site-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveSite(site);
                }}
                aria-label={`Remove ${site}`}
                title={`Remove ${site}`}
              >
                ✕
              </button>
            </div>
          ))}
          {distractingSites.length === 0 && (
            <p style={{textAlign: 'center', color: 'var(--secondary-text)', fontSize: '13px', margin: '10px 0'}}>
              No sites added yet.
            </p>
          )}
        </div>

        {/* Custom limit editing modal */}
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
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <button 
                  onClick={() => setEditingSite(null)} 
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#f0f0f0',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
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
                    cursor: 'pointer'
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
          <button className="save-button" onClick={handleSave}>
            Save Settings
          </button>
          <button className="reset-button" onClick={handleReset}>
            Reset Counter
          </button>
        </div>
      </div>
      
      <div className="status-message">{saveStatus}</div>
    </div>
  );
}
