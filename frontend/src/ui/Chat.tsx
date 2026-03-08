import { useState, useRef, useEffect, useCallback } from 'react';
import { runAgentLoop, stripToolCalls } from '../agent/loop';
import { loadSettings } from '../workspace/settings';
import type { ChatMessage, ToolCall, ToolResult } from '../types';

// Simple markdown → HTML (no external deps)
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[huplo])/gm, '')
    .replace(/(.+)/s, '<p>$1</p>');
}

const SUGGESTIONS = [
  'Search the web for the latest AI news',
  'What files are in my workspace?',
  'Remember that I prefer concise responses',
  'Summarize: what can you do?',
];

const TOOL_ICONS: Record<string, string> = {
  web_search: '🔍',
  web_fetch: '🌐',
  workspace_read: '📄',
  workspace_write: '✏️',
  memory_append: '🧠',
  workspace_list: '📁',
  get_datetime: '🕐',
};

interface ConfirmModalState {
  toolName: string;
  args: Record<string, unknown>;
  resolve: (v: boolean) => void;
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCall[]>([]);
  const [activeToolResults, setActiveToolResults] = useState<ToolResult[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const settings = loadSettings();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, activeToolResults]);

  const askTrustConfirmation = useCallback(
    (toolName: string, args: Record<string, unknown>): Promise<boolean> =>
      new Promise(resolve => setConfirmModal({ toolName, args, resolve })),
    []
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      trustTag: 'USER',
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);
    setStreamingText('');
    setActiveToolCalls([]);
    setActiveToolResults([]);

    // Resize textarea
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let finalText = '';

    await runAgentLoop(
      text,
      messages,
      {
        onToken: token => {
          finalText += token;
          const displayText = stripToolCalls(finalText);
          setStreamingText(displayText);
        },
        onToolCall: call => {
          setActiveToolCalls(prev => [...prev, call]);
        },
        onToolResult: result => {
          setActiveToolResults(prev => [...prev, result]);
        },
        onDone: _final => {
          const displayText = stripToolCalls(_final);
          const assistantMsg: ChatMessage = {
            id: `a_${Date.now()}`,
            role: 'assistant',
            content: displayText,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, assistantMsg]);
          setStreamingText('');
          setActiveToolCalls([]);
          setActiveToolResults([]);
          setIsStreaming(false);
        },
        onError: err => {
          const errMsg: ChatMessage = {
            id: `e_${Date.now()}`,
            role: 'assistant',
            content: `⚠️ ${err}`,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, errMsg]);
          setStreamingText('');
          setIsStreaming(false);
        },
        getTrustConfirmation: askTrustConfirmation,
      },
      ctrl.signal
    );
  }, [input, isStreaming, messages, askTrustConfirmation]);

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="chat-area">
      {/* Header */}
      <div className="chat-header">
        <div className="status-dot" />
        <span className="chat-header-title">WebClaw Agent</span>
        <span className="chat-header-model">
          {settings.provider.provider} · {settings.provider.model}
        </span>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && !isStreaming ? (
          <div className="chat-empty">
            <img src="/logo.svg" alt="logo" className="chat-empty-logo" />
            <div className="chat-empty-title">What can I help with?</div>
            <div className="chat-empty-sub">
              I can search the web, read and write your workspace, remember things — and more.
            </div>
            <div className="chat-suggestions">
              {SUGGESTIONS.map(s => (
                <button key={s} className="suggestion-chip" onClick={() => { setInput(s); textareaRef.current?.focus(); }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? 'U' : <img src="/logo.svg" alt="" />}
                </div>
                <div className="message-body">
                  <div
                    className="message-bubble"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                  <span className="message-time">{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            ))}

            {/* Streaming assistant message */}
            {isStreaming && (
              <>
                {/* Tool calls in progress */}
                {activeToolCalls.map((call, i) => {
                  const result = activeToolResults.find(r => r.id === call.id);
                  return (
                    <div key={call.id} className="tool-card fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                      <div className="tool-card-header">
                        <span>{TOOL_ICONS[call.name] ?? '🔧'}</span>
                        <span className="tool-card-name">{call.name}</span>
                        {result && (
                          <span className={`tool-tag ${result.trustTag}`}>{result.trustTag}</span>
                        )}
                        {!result && (
                          <span style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--muted)', animation: 'pulse 1s infinite' }} />
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--muted)', animation: 'pulse 1s .2s infinite' }} />
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--muted)', animation: 'pulse 1s .4s infinite' }} />
                          </span>
                        )}
                      </div>
                      <div className="tool-card-body">
                        {result ? result.result.replace(/^\[(?:EXTERNAL|WORKSPACE|TRUSTED|USER)\]\s*/, '').slice(0, 200) + (result.result.length > 200 ? '…' : '') : `${JSON.stringify(call.args).slice(0, 80)}…`}
                      </div>
                    </div>
                  );
                })}

                {/* Streaming text */}
                {streamingText ? (
                  <div className="message assistant">
                    <div className="message-avatar"><img src="/logo.svg" alt="" /></div>
                    <div className="message-body">
                      <div
                        className="message-bubble"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingText) }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="message assistant">
                    <div className="message-avatar"><img src="/logo.svg" alt="" /></div>
                    <div className="message-body">
                      <div className="message-bubble">
                        <div className="typing-indicator"><span /><span /><span /></div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <div className="chat-input-row">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder="Message WebClaw… (Shift+Enter for new line)"
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button className="chat-send-btn stop" onClick={handleStop} title="Stop">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="2" y="2" width="10" height="10" rx="2"/>
              </svg>
            </button>
          ) : (
            <button className="chat-send-btn" onClick={handleSend} disabled={!input.trim()} title="Send">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          )}
        </div>
        <div className="chat-input-tools">
          <div className={`trust-badge ${settings.trustShieldEnabled ? '' : 'off'}`}>
            <div className="trust-badge-dot" />
            Trust Shield {settings.trustShieldEnabled ? 'ON' : 'OFF'}
          </div>
          <span style={{ marginLeft: 'auto' }}>Enter ↵ to send</span>
        </div>
      </div>

      {/* Trust confirmation modal */}
      {confirmModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 99,
          display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn .2s ease',
        }}>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16,
            padding: '2rem', maxWidth: 400, width: '100%', boxShadow: '0 40px 100px rgba(0,0,0,.6)',
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '.5rem' }}>🛡️</div>
            <div style={{ fontWeight: 700, marginBottom: '.5rem' }}>Trust Shield — Confirm Action</div>
            <div style={{ color: 'var(--muted)', fontSize: '.875rem', marginBottom: '1.25rem' }}>
              The agent wants to run <code style={{ color: 'var(--accent2)', fontFamily: 'var(--mono)' }}>{confirmModal.toolName}</code> which is a high-risk operation.
              <pre style={{ marginTop: '.75rem', background: 'rgba(0,0,0,.3)', borderRadius: 8, padding: '.6rem', fontSize: '.75rem', color: 'var(--text)', overflow: 'auto' }}>
                {JSON.stringify(confirmModal.args, null, 2)}
              </pre>
            </div>
            <div style={{ display: 'flex', gap: '.75rem' }}>
              <button className="btn-primary" style={{ flex: 1, padding: '.6rem' }} onClick={() => { confirmModal.resolve(true); setConfirmModal(null); }}>
                Allow
              </button>
              <button className="btn-secondary" onClick={() => { confirmModal.resolve(false); setConfirmModal(null); }}>
                Block
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
