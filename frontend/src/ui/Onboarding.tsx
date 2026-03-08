import { useState } from 'react';
import { updateSettings, loadSettings } from '../workspace/settings';
import { PROVIDER_MODELS } from '../providers/adapter';
import type { Provider } from '../types';

interface Props {
  onComplete: () => void;
}

const PROVIDERS: { id: Provider; name: string; desc: string }[] = [
  { id: 'gemini',    name: 'Gemini',    desc: 'Google · Free tier' },
  { id: 'cerebras',  name: 'Cerebras',  desc: 'Ultra-fast · Free' },
  { id: 'openai',    name: 'OpenAI',    desc: 'GPT-4o · Paid' },
  { id: 'groq',      name: 'Groq',      desc: 'Llama · Free tier' },
  { id: 'anthropic', name: 'Anthropic', desc: 'Claude · Paid' },
  { id: 'openrouter',name: 'OpenRouter',desc: 'Multi-model' },
];

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState<Provider>('cerebras');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(PROVIDER_MODELS['cerebras'][0]);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleProviderSelect = (p: Provider) => {
    setProvider(p);
    setModel(PROVIDER_MODELS[p][0]);
    setApiKey('');
  };

  const handleFinish = async () => {
    setLoading(true);
    updateSettings({
      ...loadSettings(),
      provider: { provider, apiKey, model },
      onboardingComplete: true,
    });
    // small delay for UX
    await new Promise(r => setTimeout(r, 300));
    onComplete();
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-bg-orb" />
      <div className="onboarding-bg-orb" />
      <div className="onboarding-card">
        <div className="onboarding-logo">
          <img src="/logo.svg" alt="WebClaw" />
          WebClaw
        </div>

        {/* Step 0: Welcome */}
        <div className={`onboarding-step ${step === 0 ? 'active' : ''}`}>
          <h2 className="onboarding-title">Your AI agent.<br/>In the browser.</h2>
          <p className="onboarding-sub">
            WebClaw is a browser-native AI agent with WebGPU compute, self-evolving strategies,
            and full browser tab control. Setup takes 30 seconds.
          </p>
          <div className="info-box">
            <strong>Zero install required.</strong> Your workspace is stored locally in your
            browser's private storage. Your API keys never leave your device.
          </div>
          <button className="btn-primary" onClick={() => setStep(1)}>
            Get Started →
          </button>
        </div>

        {/* Step 1: Choose provider */}
        <div className={`onboarding-step ${step === 1 ? 'active' : ''}`}>
          <h2 className="onboarding-title">Choose your AI</h2>
          <p className="onboarding-sub">Pick an LLM provider. You can change this anytime in Settings.</p>
          <div className="onboarding-provider-grid">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                className={`provider-btn ${provider === p.id ? 'selected' : ''}`}
                onClick={() => handleProviderSelect(p.id)}
              >
                <span className="p-name">{p.name}</span>
                <span className="p-desc">{p.desc}</span>
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => setStep(2)}>
            Continue →
          </button>
        </div>

        {/* Step 2: API Key */}
        <div className={`onboarding-step ${step === 2 ? 'active' : ''}`}>
          <h2 className="onboarding-title">Add your API key</h2>
          <p className="onboarding-sub">Your key is stored locally and never sent anywhere except directly to {provider}.</p>
          <div className="form-group">
            <label className="form-label">Model</label>
            <select
              className="form-select"
              value={model}
              onChange={e => setModel(e.target.value)}
            >
              {PROVIDER_MODELS[provider].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{provider} API Key</label>
            <input
              className="form-input"
              type="password"
              placeholder={provider === 'gemini' ? 'AIzaSy...' : provider === 'cerebras' ? 'csk-...' : 'sk-...'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              autoFocus
            />
          </div>
          <button
            className="btn-primary"
            onClick={() => setStep(3)}
            disabled={!apiKey.trim()}
          >
            Continue →
          </button>
        </div>

        {/* Step 3: Name */}
        <div className={`onboarding-step ${step === 3 ? 'active' : ''}`}>
          <h2 className="onboarding-title">One last thing</h2>
          <p className="onboarding-sub">What should WebClaw call you? This goes into your USER.md workspace file.</p>
          <div className="form-group">
            <label className="form-label">Your name (optional)</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Alex"
              value={userName}
              onChange={e => setUserName(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleFinish()}
            />
          </div>
          <button
            className="btn-primary"
            onClick={handleFinish}
            disabled={loading}
          >
            {loading ? 'Setting up...' : 'Launch WebClaw 🚀'}
          </button>
        </div>
      </div>
    </div>
  );
}
