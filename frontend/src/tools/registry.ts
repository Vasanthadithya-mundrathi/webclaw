// Built-in browser-safe tools for WebClaw
// Each tool defines: name, description, parameters, risk level, and execute()

import type { ToolDefinition } from '../types';
import { readWorkspaceFile, writeWorkspaceFile, appendMemory, listWorkspaceFiles } from '../workspace/opfs-manager';
import { injectToVectorStore, searchVectorStore } from '../webgpu/store';
import { cgepCrystallize } from '../gene/engine';
import { clawMesh } from '../mesh/mesh';
import { osRunCommand, osReadFile, osWriteFile, isClawOsAvailable } from '../os/clawos-bridge';

export interface ToolExecuteArgs {
  [key: string]: unknown;
}

export type ToolExecuteFn = (args: ToolExecuteArgs) => Promise<string>;

export interface RegisteredTool extends ToolDefinition {
  execute: ToolExecuteFn;
}

// ── EXTENSION BRIDGE ────────────────────────────────────────────────────────
async function callExtension(type: string, payload: Record<string, unknown> = {}): Promise<any> {
  const chrome = (window as any).chrome;
  if (!chrome?.runtime?.sendMessage) {
    throw new Error('WebClaw Extension is not installed or active. Please install the extension to use browser control tools.');
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response: any) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response && !response.success) {
        reject(new Error(response.error || 'Unknown extension error'));
      } else {
        resolve(response?.data ?? response);
      }
    });
  });
}

// ── WEB SEARCH ────────────────────────────────────────────────────────────────
const webSearch: RegisteredTool = {
  name: 'web_search',
  description: 'Search the web for current information. Returns a snippet of results.',
  riskLevel: 'low',
  trustRequired: 'sandbox',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
    },
    required: ['query'],
  },
  execute: async ({ query }) => {
    // Uses DuckDuckGo Instant Answer API (CORS-friendly)
    const q = encodeURIComponent(String(query));
    try {
      const resp = await fetch(`https://api.duckduckgo.com/?q=${q}&format=json&no_redirect=1&no_html=1`);
      const data = await resp.json();
      const abstract = data.AbstractText || '';
      const relatedTopics = (data.RelatedTopics || [])
        .slice(0, 5)
        .map((t: { Text?: string }) => t.Text ?? '')
        .filter(Boolean)
        .join('\n');
      return `[EXTERNAL] Search results for "${query}":\n\n${abstract || '(no abstract)'}\n\nRelated:\n${relatedTopics || '(none)'}`;
    } catch (err) {
      return `[EXTERNAL] Search error: ${String(err)}`;
    }
  },
};

// ── WEB FETCH ─────────────────────────────────────────────────────────────────
const webFetch: RegisteredTool = {
  name: 'web_fetch',
  description: 'Fetch the text content of a URL. Returns page text (first 3000 chars).',
  riskLevel: 'low',
  trustRequired: 'sandbox',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
    },
    required: ['url'],
  },
  execute: async ({ url }) => {
    try {
      // Use a CORS proxy for cross-origin fetches
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(String(url))}`;
      const resp = await fetch(proxyUrl);
      const text = await resp.text();
      // Strip HTML tags simply
      const stripped = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return `[EXTERNAL] Content from ${url}:\n\n${stripped.slice(0, 3000)}${stripped.length > 3000 ? '...(truncated)' : ''}`;
    } catch (err) {
      return `[EXTERNAL] Fetch error: ${String(err)}`;
    }
  },
};

// ── WORKSPACE READ ────────────────────────────────────────────────────────────
const workspaceRead: RegisteredTool = {
  name: 'workspace_read',
  description: 'Read a file from your workspace (IDENTITY.md, USER.md, MEMORY.md, AGENTS.md, or custom files).',
  riskLevel: 'low',
  trustRequired: 'trusted',
  parameters: {
    type: 'object',
    properties: {
      filename: { type: 'string', description: 'Filename to read (e.g. MEMORY.md)' },
    },
    required: ['filename'],
  },
  execute: async ({ filename }) => {
    const content = await readWorkspaceFile(String(filename));
    if (content === null) return `[WORKSPACE] File "${filename}" not found.`;
    return `[WORKSPACE] ${filename}:\n\n${content}`;
  },
};

// ── WORKSPACE WRITE ───────────────────────────────────────────────────────────
const workspaceWrite: RegisteredTool = {
  name: 'workspace_write',
  description: 'Write content to a file in your workspace. Creates the file if it doesn\'t exist.',
  riskLevel: 'medium',
  trustRequired: 'confirm',
  parameters: {
    type: 'object',
    properties: {
      filename: { type: 'string', description: 'Filename to write' },
      content:  { type: 'string', description: 'Content to write' },
    },
    required: ['filename', 'content'],
  },
  execute: async ({ filename, content }) => {
    await writeWorkspaceFile(String(filename), String(content));
    return `[WORKSPACE] Written to ${filename} (${String(content).length} chars)`;
  },
};

// ── MEMORY APPEND ─────────────────────────────────────────────────────────────
const memoryAppend: RegisteredTool = {
  name: 'memory_append',
  description: 'Append a new entry to MEMORY.md. Use this to remember important things discussed.',
  riskLevel: 'low',
  trustRequired: 'trusted',
  parameters: {
    type: 'object',
    properties: {
      entry: { type: 'string', description: 'The information to remember' },
    },
    required: ['entry'],
  },
  execute: async ({ entry }) => {
    await appendMemory(String(entry));
    return `[WORKSPACE] Added to MEMORY.md: "${String(entry).slice(0, 80)}..."`;
  },
};

// ── LIST WORKSPACE ────────────────────────────────────────────────────────────
const workspaceList: RegisteredTool = {
  name: 'workspace_list',
  description: 'List all files in your workspace.',
  riskLevel: 'low',
  trustRequired: 'trusted',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const files = await listWorkspaceFiles();
    return `[WORKSPACE] Files: ${files.join(', ') || '(empty)'}`;
  },
};

// ── TAB CONTROL TOOLS ─────────────────────────────────────────────────────────

const tabList: RegisteredTool = {
  name: 'tab_list',
  description: 'List all open browser tabs and their URLs.',
  riskLevel: 'low',
  trustRequired: 'trusted',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const tabs = await callExtension('EXT_TAB_LIST');
    return `[TRUSTED] Open tabs:\n${tabs.map((t: any) => `- [${t.id}] ${t.title} (${t.url})`).join('\n')}`;
  },
};

const tabFocus: RegisteredTool = {
  name: 'tab_focus',
  description: 'Switch focus to a specific tab by its ID.',
  riskLevel: 'low',
  trustRequired: 'trusted',
  parameters: {
    type: 'object',
    properties: {
      tabId: { type: 'number', description: 'The ID of the tab to focus' },
    },
    required: ['tabId'],
  },
  execute: async ({ tabId }) => {
    await callExtension('EXT_TAB_FOCUS', { tabId: Number(tabId) });
    return `[TRUSTED] Switched focus to tab ${tabId}`;
  },
};

const tabOpen: RegisteredTool = {
  name: 'tab_open',
  description: 'Open a new browser tab with the specified URL.',
  riskLevel: 'high',
  trustRequired: 'confirm',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to open' },
    },
    required: ['url'],
  },
  execute: async ({ url }) => {
    const data = await callExtension('EXT_TAB_OPEN', { url: String(url) });
    return `[TRUSTED] Opened new tab with ID ${data.tabId} for ${url}`;
  },
};

const tabClose: RegisteredTool = {
  name: 'tab_close',
  description: 'Close a specific browser tab by its ID.',
  riskLevel: 'high',
  trustRequired: 'confirm',
  parameters: {
    type: 'object',
    properties: {
      tabId: { type: 'number', description: 'The ID of the tab to close' },
    },
    required: ['tabId'],
  },
  execute: async ({ tabId }) => {
    await callExtension('EXT_TAB_CLOSE', { tabId: Number(tabId) });
    return `[TRUSTED] Closed tab ${tabId}`;
  },
};

// ── DATE & TIME ───────────────────────────────────────────────────────────────
const getDateTime: RegisteredTool = {
  name: 'get_datetime',
  description: 'Get the current date and time.',
  riskLevel: 'low',
  trustRequired: 'trusted',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    return `[TRUSTED] Current date/time: ${new Date().toLocaleString('en-US', { timeZoneName: 'short' })}`;
  },
};

// ── WEBGPU VECTOR STORE ───────────────────────────────────────────────────────

const vectorAdd: RegisteredTool = {
  name: 'webgpu_vector_add',
  description: 'Embed and save a large block of text into the semantic vector store using WebGPU. Good for ingesting knowledge.',
  riskLevel: 'low',
  trustRequired: 'trusted',
  parameters: {
    type: 'object',
    properties: {
      source: { type: 'string', description: 'Name or URL of the source' },
      text: { type: 'string', description: 'The full text to ingest and chunk' },
    },
    required: ['source', 'text'],
  },
  execute: async ({ source, text }) => {
    const count = await injectToVectorStore(String(source), String(text));
    return `[WORKSPACE] Embedded and stored ${count} text chunks from "${source}" into the vector store.`;
  },
};

const vectorSearch: RegisteredTool = {
  name: 'webgpu_vector_search',
  description: 'Perform a semantic cosine-similarity search against your local vector store.',
  riskLevel: 'low',
  trustRequired: 'trusted',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The semantic query' },
    },
    required: ['query'],
  },
  execute: async ({ query }) => {
    const results = await searchVectorStore(String(query), 3);
    if (results.length === 0) return `[WORKSPACE] Vector store is empty. No results for "${query}".`;
    
    const formatted = results.map(r => `> [Score: ${r.score.toFixed(3)}] (Source: ${r.doc.source})\n${r.doc.content}`).join('\n\n');
    return `[WORKSPACE] Top semantic matches for "${query}":\n\n${formatted}`;
  },
};

// ── CLAW MESH — PEER DELEGATION ──────────────────────────────────────────────
const meshDelegate: RegisteredTool = {
  name: 'mesh_delegate',
  description: 'Delegate a sub-task to another open WebClaw tab (a peer agent in the Claw Mesh). The peer will process the task with its own LLM and tools and return results.',
  riskLevel: 'medium',
  trustRequired: 'confirm',
  parameters: {
    type: 'object',
    properties: {
      peerId:  { type: 'string', description: 'The ID of the peer agent to delegate to (from the Mesh panel)' },
      task:    { type: 'string', description: 'The full task description to send to the peer agent' },
    },
    required: ['peerId', 'task'],
  },
  execute: async ({ peerId, task }) => {
    const peers = clawMesh.getPeers();
    const peer = peers.find(p => p.id === String(peerId));
    if (!peer) return `[MESH] Peer "${peerId}" not found. Available: ${peers.map(p => `${p.name} (${p.id})`).join(', ') || 'none'}`;
    const result = await clawMesh.delegate(String(peerId), String(task));
    return `[MESH] Response from "${peer.name}":\n${result}`;
  },
};

// ── CLAW OS — NATIVE HOST BRIDGE ─────────────────────────────────────────────
const osRun: RegisteredTool = {
  name: 'os_run',
  description: 'Run a shell command on the host OS via ClawOS (native messaging). Requires ClawOS to be installed and running. User will be prompted for approval unless YOLO mode is active.',
  riskLevel: 'high',
  trustRequired: 'confirm',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      cwd:     { type: 'string', description: 'Working directory (optional, defaults to home dir)' },
    },
    required: ['command'],
  },
  execute: async ({ command, cwd }) => {
    const available = await isClawOsAvailable();
    if (!available) return '[CLAOS] ClawOS is not installed. Run: cd webclaw/os-agent && node install.js';
    const output = await osRunCommand(String(command), cwd ? String(cwd) : undefined);
    return `[OS] $ ${command}\n${output}`;
  },
};

const osRead: RegisteredTool = {
  name: 'os_read',
  description: 'Read a file from the host OS filesystem via ClawOS.',
  riskLevel: 'medium',
  trustRequired: 'confirm',
  parameters: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'Absolute or home-relative file path (e.g. ~/Documents/notes.txt)' },
    },
    required: ['filePath'],
  },
  execute: async ({ filePath }) => {
    const available = await isClawOsAvailable();
    if (!available) return '[CLAOS] ClawOS is not installed.';
    const content = await osReadFile(String(filePath));
    return `[OS] Contents of ${filePath}:\n${content}`;
  },
};

const osWrite: RegisteredTool = {
  name: 'os_write',
  description: 'Write content to a file on the host OS filesystem via ClawOS.',
  riskLevel: 'high',
  trustRequired: 'confirm',
  parameters: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'Absolute or home-relative file path' },
      content:  { type: 'string', description: 'Content to write to the file' },
    },
    required: ['filePath', 'content'],
  },
  execute: async ({ filePath, content }) => {
    const available = await isClawOsAvailable();
    if (!available) return '[CLAOS] ClawOS is not installed.';
    const result = await osWriteFile(String(filePath), String(content));
    return `[OS] ${result}`;
  },
};

// ── TOOL REGISTRY ─────────────────────────────────────────────────────────────
export const TOOLS: RegisteredTool[] = [
  webSearch,
  webFetch,
  workspaceRead,
  workspaceWrite,
  memoryAppend,
  workspaceList,
  getDateTime,
  tabList,
  tabFocus,
  tabOpen,
  tabClose,
  vectorAdd,
  vectorSearch,
  cgepCrystallize,
  // Phase 6: Claw Mesh
  meshDelegate,
  // Phase 6: ClawOS
  osRun,
  osRead,
  osWrite,
];

export const TOOLS_BY_NAME: Record<string, RegisteredTool> = Object.fromEntries(
  TOOLS.map(t => [t.name, t])
);

export function getToolDefinitions(): ToolDefinition[] {
  return TOOLS.map(({ execute: _e, ...def }) => def);
}

export function buildToolsSystemPrompt(): string {
  return TOOLS.map(t =>
    `### ${t.name}\n${t.description}\nParameters: ${JSON.stringify(t.parameters, null, 2)}`
  ).join('\n\n');
}
