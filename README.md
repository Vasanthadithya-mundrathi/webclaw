<p align="center">
  <img src="docs/assets/logo.svg" alt="WebClaw Logo" width="80" />
</p>

<h1 align="center">WebClaw</h1>

<p align="center">
  <strong>Browser-native AI agent. WebGPU compute. Claw Mesh. Zero install.</strong><br/>
  Part of the <a href="https://github.com/Clawland-AI">Clawland ecosystem</a> alongside OpenClaw and PicoClaw.
</p>

<p align="center">
  <a href="https://github.com/Vasanthadithya-mundrathi/webclaw/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/Vasanthadithya-mundrathi/webclaw?style=flat-square&color=6382ff"></a>
  <img alt="License" src="https://img.shields.io/badge/license-MIT-34d399?style=flat-square">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-6382ff?style=flat-square">
  <img alt="React" src="https://img.shields.io/badge/React-19-38bdf8?style=flat-square">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-7-a78bfa?style=flat-square">
</p>

---

## What is WebClaw?

WebClaw is a **browser-native AI agent** — the first in the Clawland family to run entirely inside the browser with no local install required. Open a tab, paste an API key, and your agent is live.

> **WebClaw is a peer mesh of browser agents. The browser is the runtime. The OS is an optional, on-demand extension via Native Messaging. There is no daemon, no config file, no server.**

This is architecturally different from OpenClaw (Node.js daemon) and PicoClaw (Go binary). WebClaw uses browser APIs that have never been applied to AI agents before.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Browser Tab (WebClaw)               │
│                                                      │
│  ┌──────────────┐   ┌──────────────┐                │
│  │  Agent Loop  │◄──│  Tool Registry│               │
│  │  (React)     │   │  (18+ tools) │                │
│  └──────┬───────┘   └──────────────┘                │
│         │                                            │
│  ┌──────▼──────────────────────────────────────┐    │
│  │           Core Modules                       │    │
│  │  • OPFS Workspace (private IDENTITY.md etc.)│    │
│  │  • WebGPU Vector Store (GPU-accelerated)    │    │
│  │  • CGEP Gene Engine (self-evolving)         │    │
│  │  • Trust Shield (per-tool security)         │    │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────┐   ┌──────────────┐               │
│  │  Claw Mesh   │   │  Web Worker  │               │
│  │ BroadcastCh. │   │  Subagents   │               │
│  └──────────────┘   └──────────────┘               │
└─────────────────────────────┬───────────────────────┘
                              │ Native Messaging (optional)
                    ┌─────────▼──────────┐
                    │    ClawOS Agent    │
                    │  (os-agent/       │
                    │   Node.js script)  │
                    └────────────────────┘
```

### Key Differentiators

| Feature | WebClaw | OpenClaw | PicoClaw |
|---|---|---|---|
| **Setup time** | 30 seconds | 20-40 min | 5 min (binary) |
| **Install required** | ❌ Zero | ✅ Node + npm | ✅ Go binary |
| **Runtime** | Browser Tab | Node.js daemon | Go binary |
| **WebGPU compute** | ✅ World first | ❌ | ❌ |
| **Gene Evolution (CGEP)** | ✅ JS port | ❌ | ✅ |
| **Peer mesh agents** | ✅ BroadcastChannel | ❌ | ❌ |
| **OS bridge** | ✅ Native Messaging | ✅ CDP | ❌ |
| **Multi-agent** | ✅ Web Workers | ❌ | ❌ |

---

## Features

### 🦀 Claw Mesh (Zero-Server P2P)
Every open WebClaw tab is a named agent that discovers peers via `BroadcastChannel` — no WebSocket, no server. Open two tabs and they auto-discover each other. Use the `mesh_delegate` tool to send tasks between agents.

### ⚡ WebGPU Vector Store
Vector embeddings and semantic search run directly on the GPU via WebGPU compute shaders. 30x faster than JavaScript alone. Your personal knowledge base lives in OPFS, never uploaded anywhere.

### 🧬 CGEP Gene Engine
The agent learns from every task. Successful behaviors are crystallized into reusable "genes" (topic, trait, confidence score) stored in `GENES.json`. Ported from PicoClaw's Cognitive Gene Evolution Protocol.

### 🤖 Web Worker Subagents
Spawn isolated background agent threads from the Mesh panel. Each Worker has its own system prompt, LLM config, and conversation context. The main tab is the Orchestrator; workers are Specialists.

### 🖥️ ClawOS (On-Demand OS Bridge)
A one-time local install (`node os-agent/install.js`) registers a Native Messaging Host with Chrome. It wakes up on-demand, executes a command, and shuts down — no persistent daemon, no open port.

### 🔒 Trust Shield
Toggle security levels per tool: Sandboxed (read-only external content), Confirm (approval modal), or Trusted (full autonomous). Web content is tagged `[UNTRUSTED]` and cannot modify your workspace without approval.

### 📂 Workspace Explorer
All files are stored in the browser's **Origin Private File System (OPFS)** — a sandboxed area separate from your OS filesystem. View, edit, download, upload, and delete files from the Workspace panel.

Core workspace files:
- `IDENTITY.md` — Agent's self-description and goals
- `USER.md` — Your name and preferences
- `MEMORY.md` — Persistent memory, auto-updated by the agent
- `AGENTS.md` — Agent configs
- `GENES.json` — Crystallized behavioral genes
- `VECTORS.json` — Semantic vector store index

---

## Quick Start

### Option 1: Just open the app
```
# Clone and run
git clone https://github.com/Vasanthadithya-mundrathi/webclaw.git
cd webclaw/frontend
npm install
npm run dev
```
Open `http://localhost:5173` — follow onboarding.

### Option 2: Hosted
Visit the docs landing page at `docs/index.html` (self-hosted — deploy to Vercel/Netlify/GitHub Pages).

---

## Supported LLM Providers

| Provider | Models | Notes |
|---|---|---|
| **Cerebras** | `llama3.1-8b`, `llama3.3-70b` | Ultra-fast, free tier |
| **Gemini** | `gemini-2.5-flash`, `gemini-2.0-flash`, etc. | Google, free tier limited |
| **Groq** | `llama-3.3-70b-versatile`, `mixtral-8x7b` | Fast free tier |
| **OpenAI** | `gpt-4o`, `gpt-4o-mini` | Paid |
| **Anthropic** | `claude-3-5-sonnet`, `claude-3-5-haiku` | Paid |
| **OpenRouter** | All models | Multi-model gateway |

API keys are stored only in your browser's `localStorage`. They never leave your device.

---

## Project Structure

```
webclaw/
├── frontend/              # React + TypeScript + Vite app
│   └── src/
│       ├── agent/         # Agent loop, channel bridge
│       ├── mesh/          # Claw Mesh (BroadcastChannel)
│       ├── os/            # ClawOS bridge (Native Messaging)
│       ├── providers/     # LLM adapter (Gemini, Cerebras, OpenAI...)
│       ├── tools/         # Tool registry (18+ tools)
│       ├── ui/            # React components
│       ├── workers/       # Web Worker subagents + useSubagents hook
│       ├── workspace/     # OPFS manager, settings, CGEP genes, vectors
│       └── types.ts       # Shared TypeScript types
├── backend/               # Thin Node.js bridge (optional, for Telegram)
├── extension/             # Chrome/Firefox browser extension (tab control)
├── os-agent/              # ClawOS Native Messaging Host (Node.js)
│   ├── index.js           # Native messaging host
│   └── install.js         # Installer for Chrome/Firefox
└── docs/                  # Landing page (HTML)
```

---

## Tools Available to the Agent

| Tool | Description |
|---|---|
| `web_search` | DuckDuckGo search |
| `web_fetch` | Fetch and parse any URL |
| `workspace_read` | Read a file from OPFS |
| `workspace_write` | Write a file to OPFS |
| `workspace_list` | List all OPFS files |
| `memory_append` | Append to MEMORY.md |
| `webgpu_vector_add` | Embed text into the GPU vector store |
| `webgpu_vector_search` | Semantic search over stored vectors |
| `cgep_crystallize` | Save a gene (behavior pattern) |
| `cgep_devolve` | Remove a gene |
| `tab_read` | Read DOM of a browser tab (extension) |
| `tab_screenshot` | Screenshot a tab (extension) |
| `tab_click` | Click an element in a tab (extension) |
| `tab_navigate` | Navigate a tab to a URL (extension) |
| `mesh_delegate` | Send a task to a Claw Mesh peer |
| `os_run` | Run a shell command via ClawOS |
| `os_read` | Read an OS file via ClawOS |
| `os_write` | Write an OS file via ClawOS |

---

## ClawOS (Optional OS Bridge)

Gives WebClaw the ability to run commands on your local machine:

```bash
cd os-agent
npm install
node install.js   # Registers the Native Messaging Host with Chrome
```

Then in WebClaw chat:
```
Run: ls -la ~/Downloads
```

The os-agent wakes up, runs the command, returns the output, and goes back to sleep. No daemon, no port, no config file.

---

## Claw Mesh (Multi-Tab Agents)

1. Open `http://localhost:5173` in **Tab 1** → Mesh panel → Join as "Research Agent"
2. Open `http://localhost:5173` in **Tab 2** → Mesh panel → Join as "Coder Agent"
3. Tab 1 sees Tab 2 as a peer. Click **Delegate →** to send a task.
4. Tab 2 processes the task with its own LLM and returns the result — **zero server involved**.

---

## Telegram Integration (Optional)

```bash
cd backend
npm install
TELEGRAM_BOT_TOKEN=<your_token> npm start
```

Then in WebClaw Settings → Channels → enable Backend Bridge. Messages arrive via Telegram, the agent responds — when you're away from the browser.

---

## Development

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend (optional)
cd backend && npm install && npm run dev

# ClawOS (optional)
cd os-agent && npm install && node install.js
```

**TypeScript:** `cd frontend && npx tsc --noEmit`  
**Build:** `cd frontend && npm run build`

---

## Ecosystem

WebClaw is the browser-native `L3` layer in the Clawland AI stack:

| Layer | Project | Runtime | Hardware |
|---|---|---|---|
| L0 · MCU | MicroClaw | C/Rust | $2 microcontrollers |
| L1 · Edge | PicoClaw | Go | $10 SBCs |
| L2 · Regional | NanoClaw | Python | $50 SBCs |
| L3 · Cloud | MoltClaw | TypeScript | Cloud |
| **L3 · Browser** | **WebClaw ✦** | **Browser** | **Any device** |
| L4 · Orchestration | OpenClaw | Node.js | Mac Mini+ |

---

## License

MIT — Part of the [Clawland-AI](https://github.com/Clawland-AI) open-source ecosystem.
