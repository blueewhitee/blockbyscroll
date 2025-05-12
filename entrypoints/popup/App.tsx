import { useState, useEffect } from 'react';
import './App.css';

export default function App() {
  const [maxScrolls, setMaxScrolls] = useState<number>(20);
  const [currentScrolls, setCurrentScrolls] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [distractingSites, setDistractingSites] = useState<string[]>(['twitter.com', 'x.com']);
  const [newSite, setNewSite] = useState<string>('');
  const [resetInterval, setResetInterval] = useState<number>(0);

  useEffect(() => {
    // Load settings from storage
    browser.runtime.sendMessage({ type: 'GET_SETTINGS' })
      .then((settings) => {
        setMaxScrolls(settings.maxScrolls || 20);
        setCurrentScrolls(settings.scrollCount || 0);
        setDistractingSites(settings.distractingSites || ['twitter.com', 'x.com']);
        setResetInterval(settings.resetInterval || 0);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error loading settings:', error);
        setIsLoading(false);
      });
  }, []);

  const handleSave = () => {
    setSaveStatus('Saving...');
    browser.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      maxScrolls,
      distractingSites,
      resetInterval
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
      setNewSite('');
    }
  };

  const handleRemoveSite = (siteToRemove: string) => {
    setDistractingSites(distractingSites.filter(site => site !== siteToRemove));
  };

  const handleResetIntervalChange = (value: number) => {
    setResetInterval(value);
  };

  const getFaviconUrl = (domain: string) => {
    return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=16`;
  };

  if (isLoading) {
    return <div className="loading">Loading settings...</div>;
  }

  return (
    <div className="container">
      <header>
        <h1>ScrollStop</h1>
        <p className="subtitle">Focus and control your browsing habits</p>
      </header>
      
      <div className="stat-card">
        <div className="stat-label">Current Scrolls</div>
        <div className="stat-value">{currentScrolls} / {maxScrolls}</div>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${Math.min(100, (currentScrolls / maxScrolls) * 100)}%` }}
          />
        </div>
      </div>
      
      <div className="settings-group">
        <label htmlFor="max-scrolls">Scroll limit per session:</label>
        <input
          id="max-scrolls"
          type="number"
          min="1"
          max="1000"
          value={maxScrolls}
          onChange={(e) => setMaxScrolls(Math.max(1, parseInt(e.target.value) || 1))}
        />
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
            <div key={site} className="site-item">
              <img src={getFaviconUrl(site)} alt={`${site} favicon`} className="site-favicon" />
              <span className="site-name">{site}</span>
              <button
                className="remove-site"
                onClick={() => handleRemoveSite(site)}
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
        <div className="add-site">
          <input
            type="text"
            placeholder="e.g. news.com, social.network"
            value={newSite}
            onChange={(e) => setNewSite(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSite()}
          />
          <button onClick={handleAddSite}>Add Site</button>
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
