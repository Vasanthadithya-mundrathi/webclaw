// Settings persistence in localStorage

import type { AppSettings, LLMProviderConfig } from '../types';

const SETTINGS_KEY = 'webclaw_settings';

export const DEFAULT_PROVIDER: LLMProviderConfig = {
  provider: 'cerebras',
  apiKey: '',
  model: 'llama3.1-8b',
};

const DEFAULT_SETTINGS: AppSettings = {
  provider: DEFAULT_PROVIDER,
  trustShieldEnabled: true,
  backendBridgeEnabled: false,
  onboardingComplete: false,
  theme: 'dark',
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed: AppSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    return parsed;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const updated = { ...current, ...patch };
  saveSettings(updated);
  return updated;
}
