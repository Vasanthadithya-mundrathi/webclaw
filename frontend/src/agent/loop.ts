// Agent loop — the core brain of WebClaw
// Handles: build context → call LLM → parse tool calls → execute tools → re-loop

import { streamLLM } from '../providers/adapter';
import { TOOLS_BY_NAME, buildToolsSystemPrompt } from '../tools/registry';
import { loadWorkspace } from '../workspace/opfs-manager';
import { loadSettings } from '../workspace/settings';
import { formatGenesForPrompt } from '../gene/engine';
import type { ChatMessage, LLMMessage, ToolCall, ToolResult } from '../types';

const MAX_TOOL_ITERATIONS = 8;

// Strip all tool call syntax from display text
export function stripToolCalls(text: string): string {
  return text
    // Our standard format: <tool_call>{...}</tool_call>
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
    // Llama-style: <tool_name>{...}</tool_name> or <tool_name arg=".."/>
    .replace(/<(web_search|web_fetch|workspace_read|workspace_write|memory_append|workspace_list|get_datetime|tab_list|tab_focus|tab_open|tab_close|webgpu_vector_add|webgpu_vector_search|cgep_crystallize)[^>]*>[\s\S]*?<\/\1>/g, '')
    .replace(/<(web_search|web_fetch|workspace_read|workspace_write|memory_append|workspace_list|get_datetime|tab_list|tab_focus|tab_open|tab_close|webgpu_vector_add|webgpu_vector_search|cgep_crystallize)[^>]*\/>/g, '')
    // Tool result blocks injected by us
    .replace(/<tool_result[^>]*>[\s\S]*?<\/tool_result>/g, '')
    .replace(/\[WORKSPACE\]\s*/g, '')
    .trim();
}

// Parse tool calls from LLM response text — supports two formats:
// 1. Standard: <tool_call>{"name":"web_search","args":{"query":"..."}}</tool_call>
// 2. Llama-style: <web_search>{"query":"..."}</web_search>
function parseToolCalls(text: string, knownToolNames: string[]): ToolCall[] {
  const calls: ToolCall[] = [];
  let id = 0;

  // Format 1: <tool_call>{...}</tool_call>
  const regex1 = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  let match;
  while ((match = regex1.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      calls.push({ id: `tc_${Date.now()}_${id++}`, name: parsed.name, args: parsed.args ?? {} });
    } catch { /* skip malformed */ }
  }

  // Format 2: <tool_name>{...}</tool_name>  (Llama 3.1 style)
  for (const toolName of knownToolNames) {
    const re = new RegExp(`<${toolName}>([\\s\\S]*?)<\/${toolName}>`, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      try {
        const rawArgs = m[1].trim();
        const args = rawArgs ? JSON.parse(rawArgs) : {};
        calls.push({ id: `tc_${Date.now()}_${id++}`, name: toolName, args });
      } catch { calls.push({ id: `tc_${Date.now()}_${id++}`, name: toolName, args: {} }); }
    }
  }

  return calls;
}

function buildSystemPrompt(identity: string, user: string, memory: string, genes: string): string {
  return `${identity.trim()}

## User Profile
${user.trim()}

## Memory
${memory.trim()}

${genes}

## Available Tools
You have access to these tools. Call a tool by outputting EXACTLY this JSON format in your response:
<tool_call>{"name":"TOOL_NAME","args":{"param":"value"}}</tool_call>

Rules for tool calls:
- Output ONLY the <tool_call> block — no other text around it on the same logical block
- You will receive <tool_result> blocks after each tool call
- You can call multiple tools in sequence in one turn
- After receiving all results, provide your final response to the user
- NEVER show raw <tool_call> or <tool_result> tags in your final response to the user

${buildToolsSystemPrompt()}

## Response Rules
- Be helpful, precise, and security-conscious
- Always tag data from external sources with [EXTERNAL] in your response
- Use memory_append to remember important things for future conversations
- Current date/time: ${new Date().toLocaleString()}
`;
}

export interface AgentLoopCallbacks {
  onToken: (token: string) => void;
  onToolCall: (call: ToolCall) => void;
  onToolResult: (result: ToolResult) => void;
  onDone: (finalText: string) => void;
  onError: (error: string) => void;
  getTrustConfirmation?: (toolName: string, args: Record<string, unknown>) => Promise<boolean>;
}

export async function runAgentLoop(
  userMessage: string,
  conversationHistory: ChatMessage[],
  callbacks: AgentLoopCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const settings = loadSettings();
  const workspace = await loadWorkspace();
  const genes = await formatGenesForPrompt();

  const systemPrompt = buildSystemPrompt(workspace.identity, workspace.user, workspace.memory, genes);

  // Build LLM message history
  const buildLLMHistory = (history: ChatMessage[]): LLMMessage[] => {
    return history.flatMap((msg): LLMMessage[] => {
      if (msg.role === 'user') return [{ role: 'user', content: msg.content }];
      if (msg.role === 'assistant') {
        const parts: string[] = [msg.content];
        if (msg.toolResults?.length) {
          parts.push(msg.toolResults.map(r => `<tool_result id="${r.id}">${r.result}</tool_result>`).join('\n'));
        }
        return [{ role: 'assistant', content: parts.join('\n') }];
      }
      return [];
    });
  };

  let messages: LLMMessage[] = [
    ...buildLLMHistory(conversationHistory),
    { role: 'user', content: userMessage },
  ];

  let iteration = 0;
  let finalText = '';

  while (iteration < MAX_TOOL_ITERATIONS) {
    if (signal?.aborted) { callbacks.onError('Cancelled'); return; }
    iteration++;

    // Stream response from LLM
    let responseText = '';
    try {
      for await (const chunk of streamLLM(messages, settings.provider, systemPrompt)) {
        if (signal?.aborted) { callbacks.onError('Cancelled'); return; }
        if (chunk.done) break;
        responseText += chunk.delta;
        callbacks.onToken(chunk.delta);
      }
    } catch (err) {
      callbacks.onError(`LLM error: ${String(err)}`);
      return;
    }

    finalText = responseText;

    // Check for tool calls in the response
    const knownToolNames = Object.keys(TOOLS_BY_NAME);
    const toolCalls = parseToolCalls(responseText, knownToolNames);

    if (toolCalls.length === 0) {
      // No tool calls — we're done
      break;
    }

    // Execute tools
    const toolResults: ToolResult[] = [];
    for (const call of toolCalls) {
      if (signal?.aborted) break;
      callbacks.onToolCall(call);

      const tool = TOOLS_BY_NAME[call.name];
      if (!tool) {
        const result: ToolResult = { id: call.id, name: call.name, result: `Unknown tool: ${call.name}`, trustTag: 'EXTERNAL' };
        toolResults.push(result);
        callbacks.onToolResult(result);
        continue;
      }

      // Trust shield check
      if (settings.trustShieldEnabled && tool.riskLevel === 'high') {
        const confirmed = await callbacks.getTrustConfirmation?.(call.name, call.args);
        if (!confirmed) {
          const result: ToolResult = { id: call.id, name: call.name, result: '[BLOCKED by Trust Shield]', trustTag: 'EXTERNAL' };
          toolResults.push(result);
          callbacks.onToolResult(result);
          continue;
        }
      }

      try {
        const raw = await tool.execute(call.args);
        const result: ToolResult = { id: call.id, name: call.name, result: raw, trustTag: raw.startsWith('[EXTERNAL]') ? 'EXTERNAL' : 'WORKSPACE' };
        toolResults.push(result);
        callbacks.onToolResult(result);
      } catch (err) {
        const result: ToolResult = { id: call.id, name: call.name, result: `Error: ${String(err)}`, trustTag: 'EXTERNAL', error: String(err) };
        toolResults.push(result);
        callbacks.onToolResult(result);
      }
    }

    // Add assistant response + tool results to history for next iteration
    const toolResultsText = toolResults.map(r => `<tool_result id="${r.id}" name="${r.name}">\n${r.result}\n</tool_result>`).join('\n');
    messages = [
      ...messages,
      { role: 'assistant', content: responseText },
      { role: 'user', content: toolResultsText },
    ];
  }

  callbacks.onDone(finalText);
}
