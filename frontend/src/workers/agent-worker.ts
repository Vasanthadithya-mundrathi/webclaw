// WebClaw Web Worker Subagent
// This worker runs as a background browser thread — a fully isolated sub-agent
// with its own system prompt and tool access (workspace subset only, no extension APIs).
// The main thread spawns it, sends tasks, and receives streamed results.

/// <reference lib="webworker" />

export type SubagentMessageIn =
  | { type: 'INIT'; systemPrompt: string; providerConfig: ProviderConfigMsg }
  | { type: 'RUN'; taskId: string; task: string };

export type SubagentMessageOut =
  | { type: 'READY' }
  | { type: 'PROGRESS'; taskId: string; delta: string }
  | { type: 'DONE'; taskId: string; result: string }
  | { type: 'ERROR'; taskId: string; message: string };

interface ProviderConfigMsg {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

// --- Minimal in-worker LLM call (supports Gemini & OpenAI-compatible providers) ---
async function callLLM(
  config: ProviderConfigMsg,
  messages: { role: string; content: string }[]
): Promise<string> {
  if (config.provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
    const body = {
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    };
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await resp.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[Subagent: empty response]';
  }

  // OpenAI-compatible fallback (Cerebras, Groq, OpenRouter, etc.)
  const baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, messages }),
  });
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content ?? '[Subagent: empty response]';
}

// --- Worker State ---
let systemPrompt = 'You are a focused subagent. Complete the given task precisely and concisely.';
let providerConfig: ProviderConfigMsg | null = null;

self.onmessage = async (evt: MessageEvent<SubagentMessageIn>) => {
  const msg = evt.data;

  if (msg.type === 'INIT') {
    systemPrompt = msg.systemPrompt;
    providerConfig = msg.providerConfig;
    self.postMessage({ type: 'READY' } satisfies SubagentMessageOut);
    return;
  }

  if (msg.type === 'RUN') {
    const { taskId, task } = msg;
    if (!providerConfig) {
      self.postMessage({ type: 'ERROR', taskId, message: 'Subagent not initialized.' } satisfies SubagentMessageOut);
      return;
    }

    try {
      self.postMessage({ type: 'PROGRESS', taskId, delta: '🤖 Subagent thinking...\n' } satisfies SubagentMessageOut);

      const result = await callLLM(providerConfig, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: task },
      ]);

      self.postMessage({ type: 'DONE', taskId, result } satisfies SubagentMessageOut);
    } catch (err) {
      self.postMessage({ type: 'ERROR', taskId, message: String(err) } satisfies SubagentMessageOut);
    }
  }
};
