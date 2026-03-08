// Shared types used across WebClaw

export interface WorkspaceFile {
  name: string;
  content: string;
}

export interface Workspace {
  identity: string;    // IDENTITY.md
  user: string;        // USER.md
  memory: string;      // MEMORY.md
  agents: string;      // AGENTS.md
}

export type MessageRole = 'user' | 'assistant' | 'tool';
export type TrustLevel = 'sandbox' | 'confirm' | 'trusted';
export type TrustTag = 'USER' | 'EXTERNAL' | 'WORKSPACE' | 'SKILL';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: number;
  trustTag?: TrustTag;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  name: string;
  result: string;
  trustTag: TrustTag;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high';
  trustRequired: TrustLevel;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMStreamChunk {
  delta: string;
  done: boolean;
}

export interface LLMProviderConfig {
  provider: 'gemini' | 'cerebras' | 'openai' | 'groq' | 'anthropic' | 'openrouter';
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface AppSettings {
  provider: LLMProviderConfig;
  trustShieldEnabled: boolean;
  backendBridgeEnabled: boolean;
  onboardingComplete: boolean;
  theme: 'dark';
}

export type Provider = AppSettings['provider']['provider'];
