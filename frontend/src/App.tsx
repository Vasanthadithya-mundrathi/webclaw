import { useState, useEffect } from 'react';
import { loadSettings } from './workspace/settings';
import Onboarding from './ui/Onboarding';
import Chat from './ui/Chat';
import Settings from './ui/Settings';
import { ClawMeshPanel } from './ui/ClawMesh';
import { WorkspaceExplorer } from './ui/WorkspaceExplorer';
import { startChannelBridge, stopChannelBridge } from './agent/channel-bridge';
import './App.css';

type View = 'chat' | 'workspace' | 'settings' | 'mesh';

const NAV_ITEMS: { id: View; label: string; icon: React.ReactNode }[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    id: 'workspace',
    label: 'Workspace',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    id: 'mesh',
    label: 'Mesh',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

export default function App() {
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [view, setView] = useState<View>('chat');
  const [collapsed, setCollapsed] = useState(false);
  const [settings, setSettings] = useState(() => loadSettings());

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    setOnboardingDone(s.onboardingComplete);

    // Manage backend bridge
    if (s.backendBridgeEnabled && s.onboardingComplete) {
      startChannelBridge(
        (msg) => console.log('[Bridge]', msg),
        async (tool) => {
          console.warn(`[Bridge] High-risk tool ${tool} auto-rejected in background mode.`);
          return false;
        }
      );
    } else {
      stopChannelBridge();
    }
  }, [onboardingDone]);

  if (!onboardingDone) {
    return <Onboarding onComplete={() => setOnboardingDone(true)} />;
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/logo.svg" alt="WebClaw" />
            {!collapsed && 'WebClaw'}
          </div>
          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {collapsed
                ? <><polyline points="9 18 15 12 9 6"/></>
                : <><polyline points="15 18 9 12 15 6"/></>}
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          {!collapsed && <div className="sidebar-section-label">Navigation</div>}
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? 'active' : ''}`}
              onClick={() => setView(item.id)}
            >
              {item.icon}
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div
            style={{
              fontSize: '.7rem', color: 'var(--muted)',
              padding: '.25rem .5rem',
              display: collapsed ? 'none' : 'block',
            }}
          >
            🦀 Part of Clawland
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        {view === 'chat' && <Chat />}
        {view === 'workspace' && (
          <div style={{ padding: '24px', maxWidth: '680px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 700, color: '#e2e8f0' }}>Workspace</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
                Files, memories, and genes stored privately in your browser.
              </p>
            </div>
            <WorkspaceExplorer />
          </div>
        )}
        {view === 'mesh' && (
          <div style={{ padding: '24px', maxWidth: '640px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 700, color: '#e2e8f0' }}>Claw Mesh</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
                Connect WebClaw tabs as peers. Delegate tasks between agents without any server.
              </p>
            </div>
            <ClawMeshPanel providerConfig={settings.provider} />
          </div>
        )}
        {view === 'settings' && <Settings />}
      </main>
    </div>
  );
}
