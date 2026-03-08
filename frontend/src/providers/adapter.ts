// Unified LLM provider adapter
// Supports: Gemini, Cerebras, OpenAI-compatible APIs

import type { LLMMessage, LLMProviderConfig, LLMStreamChunk } from '../types';

// ── MODEL DEFAULTS ────────────────────────────────────────────────────────────
export const PROVIDER_MODELS: Record<string, string[]> = {
  gemini:    ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'],
  cerebras:  ['llama3.1-8b', 'llama3.3-70b'],
  openai:    ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  groq:      ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
  openrouter:['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-flash-1.5'],
};

export const PROVIDER_BASE_URLS: Record<string, string> = {
  gemini:     'https://generativelanguage.googleapis.com',
  cerebras:   'https://api.cerebras.ai/v1',
  openai:     'https://api.openai.com/v1',
  groq:       'https://api.groq.com/openai/v1',
  anthropic:  'https://api.anthropic.com',
  openrouter: 'https://openrouter.ai/api/v1',
};

// ── GEMINI STREAMING ──────────────────────────────────────────────────────────
async function* streamGemini(
  messages: LLMMessage[],
  config: LLMProviderConfig,
  systemPrompt: string
): AsyncGenerator<LLMStreamChunk> {
  const url = `${PROVIDER_BASE_URLS.gemini}/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`;

  const geminiMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: geminiMessages,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini error ${resp.status}: ${err}`);
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') { yield { delta: '', done: true }; return; }
      try {
        const json = JSON.parse(data);
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (text) yield { delta: text, done: false };
      } catch { /* ignore parse errors */ }
    }
  }
  yield { delta: '', done: true };
}

// ── OPENAI-COMPATIBLE STREAMING (Cerebras, OpenAI, Groq, OpenRouter) ─────────
async function* streamOpenAICompat(
  messages: LLMMessage[],
  config: LLMProviderConfig,
  systemPrompt: string
): AsyncGenerator<LLMStreamChunk> {
  const baseUrl = config.baseUrl ?? PROVIDER_BASE_URLS[config.provider];
  const url = `${baseUrl}/chat/completions`;

  const allMessages = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: allMessages,
      stream: true,
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`${config.provider} error ${resp.status}: ${err}`);
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') { yield { delta: '', done: true }; return; }
      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content ?? '';
        if (delta) yield { delta, done: false };
      } catch { /* ignore parse errors */ }
    }
  }
  yield { delta: '', done: true };
}

// ── MAIN ENTRYPOINT ───────────────────────────────────────────────────────────
export async function* streamLLM(
  messages: LLMMessage[],
  config: LLMProviderConfig,
  systemPrompt: string
): AsyncGenerator<LLMStreamChunk> {
  switch (config.provider) {
    case 'gemini':
      yield* streamGemini(messages, config, systemPrompt);
      break;
    case 'cerebras':
    case 'openai':
    case 'groq':
    case 'openrouter':
      yield* streamOpenAICompat(messages, config, systemPrompt);
      break;
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

// Non-streaming wrapper for tool use
export async function completeLLM(
  messages: LLMMessage[],
  config: LLMProviderConfig,
  systemPrompt: string
): Promise<string> {
  let result = '';
  for await (const chunk of streamLLM(messages, config, systemPrompt)) {
    result += chunk.delta;
  }
  return result;
}
