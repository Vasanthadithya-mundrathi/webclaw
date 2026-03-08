import React, { useState, useEffect, useCallback } from 'react';
import {
  listWorkspaceFiles,
  readWorkspaceFile,
  writeWorkspaceFile,
} from '../workspace/opfs-manager';
import { readWorkspaceFile as readOpfsRaw } from '../workspace/opfs-manager';

// ── Helpers ───────────────────────────────────────────────────────────────────
function downloadBlob(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function deleteOpfsFile(filename: string) {
  const root = await navigator.storage.getDirectory();
  await (root as any).removeEntry(filename);
}

// ── Styles ────────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '12px',
  padding: '14px 16px',
  marginBottom: '10px',
};

const btn = (accent = false): React.CSSProperties => ({
  padding: '5px 12px',
  background: accent ? 'rgba(99,102,241,0.3)' : 'transparent',
  border: `1px solid ${accent ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`,
  borderRadius: '8px',
  color: accent ? '#a5b4fc' : '#94a3b8',
  cursor: 'pointer',
  fontSize: '12px',
});

// ── Component ──────────────────────────────────────────────────────────────────
export function WorkspaceExplorer() {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [genes, setGenes] = useState<{ topic: string; trait: string; confidence: number }[]>([]);
  const [storageStats, setStorageStats] = useState<{ used: string; quota: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listWorkspaceFiles();
    setFiles(list);

    // Load genes from OPFS
    try {
      const genesRaw = await readOpfsRaw('genes.json');
      if (genesRaw) setGenes(JSON.parse(genesRaw));
    } catch { /* no genes yet */ }

    // Storage estimate
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const est = await navigator.storage.estimate();
      const toMB = (b?: number) => ((b ?? 0) / 1024 / 1024).toFixed(2) + ' MB';
      setStorageStats({ used: toMB(est.usage), quota: toMB(est.quota) });
    }

    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const openFile = async (name: string) => {
    setSelected(name);
    setEditing(false);
    setDirty(false);
    const raw = await readWorkspaceFile(name);
    setContent(raw ?? '(empty)');
  };

  const saveFile = async () => {
    if (!selected) return;
    setSaving(true);
    await writeWorkspaceFile(selected, content);
    setSaving(false);
    setDirty(false);
    setEditing(false);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      await writeWorkspaceFile(file.name, text);
      await refresh();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete "${name}" from workspace? This cannot be undone.`)) return;
    await deleteOpfsFile(name);
    if (selected === name) { setSelected(null); setContent(''); }
    await refresh();
  };

  const fileIcon = (name: string) => {
    if (name.endsWith('.md')) return '📄';
    if (name.endsWith('.json')) return '⚙️';
    if (name.endsWith('.txt')) return '📝';
    return '📁';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '8px' }}>

      {/* ── Storage Stats ────────────────────────── */}
      {storageStats && (
        <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '13px' }}>🗄️ Origin Private File System</div>
            <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
              Private browser storage — never uploaded anywhere
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#a5b4fc', fontSize: '13px', fontWeight: 600 }}>{storageStats.used}</div>
            <div style={{ color: '#64748b', fontSize: '11px' }}>of {storageStats.quota}</div>
          </div>
        </div>
      )}

      {/* ── File List ────────────────────────────── */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#e2e8f0' }}>📂 Workspace Files</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={refresh} style={btn()}>↻ Refresh</button>
            <label style={{ ...btn(true), cursor: 'pointer' }}>
              ↑ Upload
              <input type="file" style={{ display: 'none' }} onChange={handleUpload} />
            </label>
          </div>
        </div>

        {/* Location callout */}
        <div style={{
          padding: '10px 14px',
          background: 'rgba(6,182,212,0.08)',
          border: '1px solid rgba(6,182,212,0.2)',
          borderRadius: '10px',
          marginBottom: '12px',
          fontSize: '11px',
          color: '#67e8f9',
          lineHeight: '1.6',
        }}>
          <strong>Where are files stored?</strong><br/>
          Files live in your browser's <strong>Origin Private File System (OPFS)</strong> — a sandboxed storage area
          tied to this website only. They cannot be accessed from the OS file system directly.<br/>
          <strong>To access them:</strong> DevTools → Application → Storage → OPFS, or use Download ↓ below.
        </div>

        {loading ? (
          <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center' }}>Loading...</p>
        ) : files.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
            No files yet. Chat with the agent to create files, or upload one above.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {files.map(f => (
              <div key={f} style={{
                ...card,
                padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: '12px',
                border: selected === f ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.07)',
                cursor: 'pointer',
              }}
                onClick={() => openFile(f)}
              >
                <span style={{ fontSize: '16px' }}>{fileIcon(f)}</span>
                <span style={{ flex: 1, color: '#e2e8f0', fontSize: '13px', fontWeight: selected === f ? 600 : 400 }}>{f}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); if (content && selected === f) downloadBlob(f, content); else readWorkspaceFile(f).then(c => downloadBlob(f, c ?? '')); }}
                  style={btn()}
                  title="Download"
                >↓</button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(f); }}
                  style={{ ...btn(), color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}
                  title="Delete"
                >🗑</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── File Viewer / Editor ─────────────────── */}
      {selected && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>✏️ {selected}</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              {editing ? (
                <>
                  <button onClick={() => { setEditing(false); setDirty(false); openFile(selected); }} style={btn()}>Cancel</button>
                  <button onClick={saveFile} disabled={saving || !dirty} style={btn(true)}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)} style={btn(true)}>Edit</button>
              )}
              <button onClick={() => downloadBlob(selected, content)} style={btn()}>↓ Download</button>
            </div>
          </div>
          {editing ? (
            <textarea
              value={content}
              onChange={(e) => { setContent(e.target.value); setDirty(true); }}
              style={{
                width: '100%', minHeight: '240px', padding: '14px',
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(99,102,241,0.4)',
                borderRadius: '10px', color: '#e2e8f0', fontSize: '12px',
                fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          ) : (
            <pre style={{
              padding: '14px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px',
              color: '#94a3b8', fontSize: '12px', whiteSpace: 'pre-wrap',
              wordBreak: 'break-word', maxHeight: '320px', overflowY: 'auto', margin: 0,
            }}>{content}</pre>
          )}
        </section>
      )}

      {/* ── Gene Viewer ──────────────────────────── */}
      <section>
        <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 600, color: '#e2e8f0' }}>🧬 Crystallized Genes</h3>
        {genes.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>
            No genes yet. Use <code style={{ color: '#a5b4fc' }}>cgep_crystallize</code> in chat to teach the agent persistent behaviors.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {genes.map((g, i) => (
              <div key={i} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#a5b4fc', fontWeight: 600, fontSize: '13px' }}>{g.topic}</span>
                  <span style={{
                    padding: '2px 8px', background: 'rgba(34,197,94,0.15)',
                    border: '1px solid rgba(34,197,94,0.3)', borderRadius: '20px',
                    color: '#86efac', fontSize: '11px',
                  }}>{g.confidence}% confidence</span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '6px' }}>{g.trait}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
