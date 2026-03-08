import { useState } from 'react';
import { loadSettings, updateSettings } from '../workspace/settings';
import { PROVIDER_MODELS } from '../providers/adapter';
import type { Provider } from '../types';

export default function Settings() {
  const [settings, setSettings] = useState(loadSettings);
  
  const save = (patch: Parameters<typeof updateSettings>[0]) => {
    const updated = updateSettings(patch);
    setSettings(updated);
  };

  return (
    <div className="settings-panel">
      <div className="settings-title">Settings</div>

      {/* LLM Provider */}
      <div className="settings-section">
        <div className="settings-section-title">⚡ AI Provider</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Provider</div>
              <div className="settings-row-sub">Which AI service to use</div>
            </div>
            <select
              className="form-select"
              style={{ width: 180 }}
              value={settings.provider.provider}
              onChange={e => save({
                provider: {
                  ...settings.provider,
                  provider: e.target.value as Provider,
                  model: PROVIDER_MODELS[e.target.value][0],
                }
              })}
            >
              {Object.keys(PROVIDER_MODELS).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Model</div>
              <div className="settings-row-sub">Select model from your provider</div>
            </div>
            <select
              className="form-select"
              style={{ width: 280 }}
              value={settings.provider.model}
              onChange={e => save({ provider: { ...settings.provider, model: e.target.value } })}
            >
              {PROVIDER_MODELS[settings.provider.provider].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">API Key</div>
              <div className="settings-row-sub">Stored only in this browser</div>
            </div>
            <input
              className="form-input"
              style={{ width: 280 }}
              type="password"
              value={settings.provider.apiKey}
              onChange={e => save({ provider: { ...settings.provider, apiKey: e.target.value } })}
              placeholder="Enter API key…"
            />
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="settings-section">
        <div className="settings-section-title">🔒 Security</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Trust Shield</div>
              <div className="settings-row-sub">
                {settings.trustShieldEnabled
                  ? 'ON — External content tagged [UNTRUSTED], high-risk tools require confirmation'
                  : 'OFF — Full autonomous mode, no confirmations'}
              </div>
            </div>
            <button
              className={`toggle ${settings.trustShieldEnabled ? '' : 'off'}`}
              onClick={() => save({ trustShieldEnabled: !settings.trustShieldEnabled })}
              title={settings.trustShieldEnabled ? 'Click to disable' : 'Click to enable'}
            />
          </div>
        </div>
      </div>

      {/* Channels */}
      <div className="settings-section">
        <div className="settings-section-title">📡 Channels</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Backend Bridge</div>
              <div className="settings-row-sub">
                {settings.backendBridgeEnabled
                  ? 'ON — Listening to Telegram & Discord via local backend'
                  : 'OFF — Disconnected from local backend'}
              </div>
            </div>
            <button
              className={`toggle ${settings.backendBridgeEnabled ? '' : 'off'}`}
              onClick={() => save({ backendBridgeEnabled: !settings.backendBridgeEnabled })}
              title={settings.backendBridgeEnabled ? 'Click to disable' : 'Click to enable'}
            />
          </div>
        </div>
      </div>

      {/* Reset */}
      <div className="settings-section">
        <div className="settings-section-title">🔄 Reset</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Re-run Onboarding</div>
              <div className="settings-row-sub">Clear settings and restart setup wizard</div>
            </div>
            <button
              className="btn-secondary"
              onClick={() => {
                if (confirm('Reset all settings?')) {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Version info */}
      <div style={{ paddingTop: '.5rem', fontSize: '.75rem', color: 'var(--muted)' }}>
        WebClaw v0.1.0 · Part of the <a href="https://github.com/Clawland-AI" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Clawland ecosystem</a>
      </div>
    </div>
  );
}
