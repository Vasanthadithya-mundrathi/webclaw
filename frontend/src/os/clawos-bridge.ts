// ClawOS Bridge — Browser-side Native Messaging relay via Chrome Extension.
// The extension background script holds the native port; this module sends requests through it.
// Falls back gracefully when ClawOS is not installed.

export type OsCommandType = 'PING' | 'OS_RUN' | 'OS_READ' | 'OS_WRITE';

export interface OsResponse {
  success: boolean;
  result?: string;
  error?: string;
  yolo?: boolean;
}

let _available: boolean | null = null;

/** Check if ClawOS native host is installed and reachable */
export async function isClawOsAvailable(): Promise<boolean> {
  if (_available !== null) return _available;
  try {
    const res = await sendOsMessage({ type: 'PING' });
    _available = res.success;
  } catch {
    _available = false;
  }
  return _available;
}

/** Send a message to the ClawOS native host via the Chrome Extension relay */
export async function sendOsMessage(msg: { type: OsCommandType; [k: string]: unknown }): Promise<OsResponse> {
  const chrome = (window as any).chrome;
  if (!chrome?.runtime?.sendMessage) {
    throw new Error('WebClaw Extension is not installed. ClawOS requires the Chrome Extension.');
  }

  return new Promise<OsResponse>((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'EXT_NATIVE_MSG', payload: { ...msg, id: crypto.randomUUID() } }, (response: any) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response ?? { success: false, error: 'No response from extension' });
      }
    });
  });
}

export async function osRunCommand(command: string, cwd?: string): Promise<string> {
  const res = await sendOsMessage({ type: 'OS_RUN', command, cwd });
  if (!res.success) throw new Error(res.error ?? 'OS_RUN failed');
  return res.result ?? '';
}

export async function osReadFile(filePath: string): Promise<string> {
  const res = await sendOsMessage({ type: 'OS_READ', filePath });
  if (!res.success) throw new Error(res.error ?? 'OS_READ failed');
  return res.result ?? '';
}

export async function osWriteFile(filePath: string, content: string): Promise<string> {
  const res = await sendOsMessage({ type: 'OS_WRITE', filePath, content });
  if (!res.success) throw new Error(res.error ?? 'OS_WRITE failed');
  return res.result ?? '';
}
