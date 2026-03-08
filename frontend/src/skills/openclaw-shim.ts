import type { RegisteredTool } from '../tools/registry';

export interface OpenClawSkillManifest {
  name: string;
  description: string;
  endpointUrl: string;       // Where to call this skill
  method?: 'GET' | 'POST';
  schema: Record<string, any>; // JSON schema of inputs
}

/**
 * Creates a WebClaw RegisteredTool wrapper from an OpenClaw API skill manifest.
 */
export function createOpenClawShim(manifest: OpenClawSkillManifest): RegisteredTool {
  return {
    name: manifest.name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
    description: `(OpenClaw Skill) ${manifest.description}`,
    riskLevel: 'medium',
    trustRequired: 'confirm',
    parameters: {
      type: 'object',
      properties: manifest.schema
    },
    execute: async (args) => {
      const method = manifest.method || 'POST';
      let url = manifest.endpointUrl;
      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' }
      };

      if (method === 'POST') {
        options.body = JSON.stringify(args);
      } else {
        const params = new URLSearchParams(args as any);
        url += `?${params.toString()}`;
      }

      try {
        const resp = await fetch(url, options);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        return `[SKILL] Response from ${manifest.name}:\n${text.slice(0, 2000)}`;
      } catch (err) {
        return `[SKILL] Error executing OpenClaw skill ${manifest.name}: ${String(err)}`;
      }
    }
  };
}
