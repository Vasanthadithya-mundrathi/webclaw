import React, { useState, useEffect, useCallback } from 'react';
import { clawMesh, type ClawPeer } from '../mesh/mesh';
import { useSubagents } from '../workers/useSubagents';
import type { LLMProviderConfig } from '../types';

interface ClawMeshPanelProps {
  providerConfig?: LLMProviderConfig;
}

export function ClawMeshPanel({ providerConfig }: ClawMeshPanelProps) {
  const [agentName, setAgentName] = useState(() => {
    return localStorage.getItem('webclaw-mesh-name') || 'Main Agent';
  });
  const [peers, setPeers] = useState<ClawPeer[]>([]);
  const [meshActive, setMeshActive] = useState(false);
  const [delegateTarget, setDelegateTarget] = useState('');
  const [delegateTask, setDelegateTask] = useState('');
  const [delegateResult, setDelegateResult] = useState('');
  const [isDelegating, setIsDelegating] = useState(false);

  const { subagents, spawnSubagent, runTask, terminateSubagent } = useSubagents(providerConfig);
  const [newSubagentName, setNewSubagentName] = useState('');
  const [newSubagentPrompt, setNewSubagentPrompt] = useState('');
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});

  const startMesh = useCallback(() => {
    clawMesh.start(agentName);
    clawMesh.onPeerListChanged(setPeers);
    // Handle incoming delegations from peer tabs
    clawMesh.onDelegation(async (fromName, task, requestId) => {
      // For now, return a stub response — in a full impl this would run the agent loop
      const result = `Received delegation from "${fromName}". Task: "${task.slice(0, 100)}..."\n\n[Note: Full delegation routing coming in Phase 6b]`;
      clawMesh.sendResult(clawMesh.id, requestId, result);
      return result;
    });
    setMeshActive(true);
    localStorage.setItem('webclaw-mesh-name', agentName);
  }, [agentName]);

  const stopMesh = useCallback(() => {
    clawMesh.stop();
    setPeers([]);
    setMeshActive(false);
  }, []);

  const handleDelegate = async () => {
    if (!delegateTarget || !delegateTask) return;
    setIsDelegating(true);
    setDelegateResult('⏳ Delegating task...');
    try {
      const result = await clawMesh.delegate(delegateTarget, delegateTask);
      setDelegateResult(result);
    } catch (err) {
      setDelegateResult(`Error: ${err}`);
    } finally {
      setIsDelegating(false);
    }
  };

  const handleSpawnSubagent = () => {
    if (!newSubagentName.trim()) return;
    spawnSubagent(newSubagentName, newSubagentPrompt || undefined);
    setNewSubagentName('');
    setNewSubagentPrompt('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '8px' }}>
      {/* ── Claw Mesh Section ─────────────────────────────── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: meshActive ? '#22c55e' : '#64748b',
            boxShadow: meshActive ? '0 0 8px #22c55e' : 'none',
            transition: 'all 0.3s',
          }} />
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#e2e8f0' }}>Claw Mesh</h3>
          <span style={{ fontSize: '11px', color: '#64748b', marginLeft: 'auto' }}>
            {meshActive ? `${peers.length} peer${peers.length !== 1 ? 's' : ''} online` : 'Offline'}
          </span>
        </div>

        {!meshActive ? (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="This agent's name..."
              style={{
                flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                color: '#e2e8f0', fontSize: '13px',
              }}
            />
            <button onClick={startMesh} style={{
              padding: '10px 18px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none', borderRadius: '10px', color: 'white', fontWeight: 600,
              cursor: 'pointer', fontSize: '13px',
            }}>
              Join Mesh
            </button>
          </div>
        ) : (
          <>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px', marginBottom: '12px',
            }}>
              <span style={{ color: '#a5b4fc', fontSize: '13px' }}>
                🤖 <strong>{agentName}</strong> <span style={{ color: '#64748b', fontSize: '11px' }}>({clawMesh.id})</span>
              </span>
              <button onClick={stopMesh} style={{
                padding: '5px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px',
              }}>
                Leave
              </button>
            </div>

            {peers.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>
                No other WebClaw tabs detected.<br />Open WebClaw in another tab to form a mesh.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {peers.map(peer => (
                  <div key={peer.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px',
                  }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500 }}>{peer.name}</div>
                      <div style={{ color: '#64748b', fontSize: '11px' }}>{peer.id}</div>
                    </div>
                    <button
                      onClick={() => setDelegateTarget(peer.id)}
                      style={{
                        padding: '5px 12px', background: delegateTarget === peer.id ? 'rgba(99,102,241,0.3)' : 'transparent',
                        border: '1px solid rgba(99,102,241,0.4)', borderRadius: '8px',
                        color: '#a5b4fc', cursor: 'pointer', fontSize: '12px',
                      }}
                    >
                      {delegateTarget === peer.id ? '✓ Selected' : 'Delegate →'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {delegateTarget && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <textarea
                  value={delegateTask}
                  onChange={(e) => setDelegateTask(e.target.value)}
                  placeholder="Describe the task to delegate to this peer agent..."
                  rows={3}
                  style={{
                    padding: '10px 14px', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px',
                    color: '#e2e8f0', fontSize: '13px', resize: 'vertical',
                  }}
                />
                <button onClick={handleDelegate} disabled={isDelegating} style={{
                  padding: '10px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none', borderRadius: '10px', color: 'white', fontWeight: 600,
                  cursor: isDelegating ? 'not-allowed' : 'pointer', opacity: isDelegating ? 0.6 : 1,
                }}>
                  {isDelegating ? '⏳ Delegating...' : '→ Delegate Task'}
                </button>
                {delegateResult && (
                  <pre style={{
                    padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px',
                    color: '#94a3b8', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    maxHeight: '200px', overflowY: 'auto',
                  }}>{delegateResult}</pre>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)' }} />

      {/* ── Web Worker Subagents Section ────────────────── */}
      <section>
        <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600, color: '#e2e8f0' }}>
          ⚙️ Web Worker Subagents
        </h3>
        <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 12px' }}>
          Spawn isolated background agent threads with custom system prompts.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <input
            value={newSubagentName}
            onChange={(e) => setNewSubagentName(e.target.value)}
            placeholder="Subagent name (e.g. 'Coder', 'Researcher')..."
            style={{
              padding: '10px 14px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
              color: '#e2e8f0', fontSize: '13px',
            }}
          />
          <textarea
            value={newSubagentPrompt}
            onChange={(e) => setNewSubagentPrompt(e.target.value)}
            placeholder="Custom system prompt (optional)..."
            rows={2}
            style={{
              padding: '10px 14px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
              color: '#e2e8f0', fontSize: '13px', resize: 'vertical',
            }}
          />
          <button onClick={handleSpawnSubagent} disabled={!newSubagentName.trim()} style={{
            padding: '10px', background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            border: 'none', borderRadius: '10px', color: 'white', fontWeight: 600,
            cursor: newSubagentName.trim() ? 'pointer' : 'not-allowed', opacity: newSubagentName.trim() ? 1 : 0.5,
          }}>
            + Spawn Subagent
          </button>
        </div>

        {subagents.map(agent => (
          <div key={agent.id} style={{
            marginBottom: '12px', padding: '14px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: agent.status === 'running' ? '#f59e0b' : agent.status === 'done' ? '#22c55e' : agent.status === 'error' ? '#ef4444' : '#64748b',
                }} />
                <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '13px' }}>{agent.name}</span>
                <span style={{ color: '#64748b', fontSize: '11px' }}>{agent.status}</span>
              </div>
              <button onClick={() => terminateSubagent(agent.id)} style={{
                padding: '4px 10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px', color: '#64748b', cursor: 'pointer', fontSize: '11px',
              }}>✕</button>
            </div>

            {agent.output && (
              <pre style={{
                padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                color: '#94a3b8', fontSize: '11px', maxHeight: '150px', overflowY: 'auto',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: '10px',
              }}>{agent.output}</pre>
            )}

            {(agent.status === 'idle' || agent.status === 'done') && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={taskInputs[agent.id] ?? ''}
                  onChange={(e) => setTaskInputs(prev => ({ ...prev, [agent.id]: e.target.value }))}
                  placeholder="Give this subagent a task..."
                  style={{
                    flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                    color: '#e2e8f0', fontSize: '12px',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && taskInputs[agent.id]?.trim()) {
                      runTask(agent.id, taskInputs[agent.id]);
                      setTaskInputs(prev => ({ ...prev, [agent.id]: '' }));
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const t = taskInputs[agent.id];
                    if (t?.trim()) { runTask(agent.id, t); setTaskInputs(prev => ({ ...prev, [agent.id]: '' })); }
                  }}
                  style={{
                    padding: '8px 14px', background: 'rgba(99,102,241,0.3)',
                    border: '1px solid rgba(99,102,241,0.4)', borderRadius: '8px',
                    color: '#a5b4fc', cursor: 'pointer', fontSize: '12px',
                  }}
                >→</button>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
