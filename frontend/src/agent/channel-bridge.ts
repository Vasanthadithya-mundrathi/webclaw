import { runAgentLoop } from './loop';
import { stripToolCalls } from './loop';
import type { ChatMessage } from '../types';

let eventSource: EventSource | null = null;
const BACKEND_URL = 'http://localhost:3000';

export function startChannelBridge(
  onLog: (msg: string) => void,
  getTrustConfirmation: (toolName: string, args: Record<string, unknown>) => Promise<boolean>
) {
  if (eventSource) return;

  onLog('Connecting to WebClaw backend...');
  eventSource = new EventSource(`${BACKEND_URL}/api/stream`);

  eventSource.onopen = () => onLog('Connected to backend (Listening for Telegram/Discord)');
  
  eventSource.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      onLog(`[${msg.channel}] Received: "${msg.text}"`);
      
      let finalText = '';
      const history: ChatMessage[] = []; // Future: load channel-specific memory here

      await runAgentLoop(
        msg.text,
        history,
        {
          onToken: () => {}, // Silent processing
          onToolCall: (call) => onLog(`[Bot] Using tool: ${call.name}`),
          onToolResult: () => {},
          onDone: (text) => { finalText = stripToolCalls(text); },
          onError: (err) => { finalText = `[Error] ${err}`; },
          getTrustConfirmation
        }
      );

      onLog(`[${msg.channel}] Sending reply...`);
      await fetch(`${BACKEND_URL}/api/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: msg.channel,
          chatId: msg.chatId,
          text: finalText || 'No response generated.'
        })
      });
      onLog(`[${msg.channel}] Reply sent successfully.`);
      
    } catch (err) {
      onLog(`Error processing bridge message: ${String(err)}`);
    }
  };

  eventSource.onerror = (err) => {
    onLog('Backend disconnected. Make sure the server is running on port 3000.');
    eventSource?.close();
    eventSource = null;
    // We don't auto-reconnect aggresively to prevent log spam in dev
  };
}

export function stopChannelBridge() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}
