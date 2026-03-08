// OPFS (Origin Private File System) workspace manager
// Handles IDENTITY.md, USER.md, MEMORY.md, AGENTS.md

import type { Workspace } from '../types';

const DEFAULT_IDENTITY = `# Identity

You are WebClaw, a browser-native AI agent that helps users research, write, and automate tasks.
You are part of the Clawland ecosystem alongside OpenClaw and PicoClaw.
You are helpful, precise, and security-conscious.
`;

const DEFAULT_USER = `# User

Name: (set during onboarding)
Timezone: (auto-detected)
Preferences: (none set)
`;

const DEFAULT_MEMORY = `# Memory

(Nothing remembered yet. I will note important things here as we work together.)
`;

const DEFAULT_AGENTS = `# Agents

## WebClaw (default)
Model: (configured at startup)
Skills: web-research, summarize, workspace
`;

async function getRoot(): Promise<FileSystemDirectoryHandle> {
  return await navigator.storage.getDirectory();
}

async function readFile(root: FileSystemDirectoryHandle, name: string, defaultContent: string): Promise<string> {
  try {
    const handle = await root.getFileHandle(name, { create: false });
    const file = await handle.getFile();
    return await file.text();
  } catch {
    // File doesn't exist yet — create it with default content
    await writeFile(root, name, defaultContent);
    return defaultContent;
  }
}

async function writeFile(root: FileSystemDirectoryHandle, name: string, content: string): Promise<void> {
  const handle = await root.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

export async function loadWorkspace(): Promise<Workspace> {
  const root = await getRoot();
  const [identity, user, memory, agents] = await Promise.all([
    readFile(root, 'IDENTITY.md', DEFAULT_IDENTITY),
    readFile(root, 'USER.md', DEFAULT_USER),
    readFile(root, 'MEMORY.md', DEFAULT_MEMORY),
    readFile(root, 'AGENTS.md', DEFAULT_AGENTS),
  ]);
  return { identity, user, memory, agents };
}

export async function saveWorkspaceFile(name: 'IDENTITY.md' | 'USER.md' | 'MEMORY.md' | 'AGENTS.md', content: string): Promise<void> {
  const root = await getRoot();
  await writeFile(root, name, content);
}

export async function appendMemory(newEntry: string): Promise<void> {
  const root = await getRoot();
  const current = await readFile(root, 'MEMORY.md', DEFAULT_MEMORY);
  const timestamp = new Date().toISOString().split('T')[0];
  const updated = current.trimEnd() + `\n\n## ${timestamp}\n${newEntry}\n`;
  await writeFile(root, 'MEMORY.md', updated);
}

export async function readWorkspaceFile(name: string): Promise<string | null> {
  try {
    const root = await getRoot();
    const handle = await root.getFileHandle(name, { create: false });
    const file = await handle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

export async function writeWorkspaceFile(name: string, content: string): Promise<void> {
  const root = await getRoot();
  await writeFile(root, name, content);
}

export async function listWorkspaceFiles(): Promise<string[]> {
  const root = await getRoot();
  const names: string[] = [];
  for await (const [name] of (root as any).entries()) {
    names.push(name);
  }
  return names.sort();
}

export function isOPFSSupported(): boolean {
  return 'storage' in navigator && 'getDirectory' in navigator.storage;
}
