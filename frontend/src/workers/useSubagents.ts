// useSubagent — React hook to spawn and manage Web Worker subagents.
// Each subagent is an isolated background thread with its own agent loop.

import { useState, useRef, useCallback } from 'react';
import type { LLMProviderConfig } from '../types';

export interface SubagentDef {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'done' | 'error';
  output: string;
}

export function useSubagents(providerConfig?: LLMProviderConfig) {
  const [subagents, setSubagents] = useState<SubagentDef[]>([]);
  const workers = useRef<Map<string, Worker>>(new Map());

  const spawnSubagent = useCallback((name: string, systemPrompt?: string): string => {
    const id = `subagent-${crypto.randomUUID().slice(0, 6)}`;
    const worker = new Worker(new URL('../workers/agent-worker.ts', import.meta.url), { type: 'module' });
    workers.current.set(id, worker);

    // Init the worker with provider config
    worker.postMessage({
      type: 'INIT',
      systemPrompt: systemPrompt ?? `You are "${name}", a focused subagent created by WebClaw to complete specific tasks. Be concise.`,
      providerConfig: providerConfig ?? null,
    });

    worker.onmessage = (evt) => {
      const msg = evt.data;
      if (msg.type === 'READY') {
        setSubagents((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: 'idle' } : a))
        );
      } else if (msg.type === 'PROGRESS') {
        setSubagents((prev) =>
          prev.map((a) => (a.id === id ? { ...a, output: a.output + msg.delta } : a))
        );
      } else if (msg.type === 'DONE') {
        setSubagents((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: 'done', output: a.output + '\n\n✅ Done:\n' + msg.result } : a))
        );
      } else if (msg.type === 'ERROR') {
        setSubagents((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: 'error', output: a.output + '\n❌ Error: ' + msg.message } : a))
        );
      }
    };

    worker.onerror = (err) => {
      setSubagents((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'error', output: `Worker error: ${err.message}` } : a))
      );
    };

    const def: SubagentDef = { id, name, status: 'idle', output: '' };
    setSubagents((prev) => [...prev, def]);
    return id;
  }, [providerConfig]);

  const runTask = useCallback((subagentId: string, task: string) => {
    const worker = workers.current.get(subagentId);
    if (!worker) return;

    setSubagents((prev) =>
      prev.map((a) => (a.id === subagentId ? { ...a, status: 'running', output: `▶ Running task: "${task}"\n` } : a))
    );
    worker.postMessage({ type: 'RUN', taskId: subagentId, task });
  }, []);

  const terminateSubagent = useCallback((subagentId: string) => {
    workers.current.get(subagentId)?.terminate();
    workers.current.delete(subagentId);
    setSubagents((prev) => prev.filter((a) => a.id !== subagentId));
  }, []);

  return { subagents, spawnSubagent, runTask, terminateSubagent };
}
