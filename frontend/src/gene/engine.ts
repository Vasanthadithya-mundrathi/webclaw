import { readWorkspaceFile, writeWorkspaceFile } from '../workspace/opfs-manager';
import type { RegisteredTool } from '../tools/registry';

export interface GeneCapsule {
  id: string;
  topic: string;
  trait: string;
  confidence: number;   // 1-100
  timestamp: number;
}

const GENES_FILENAME = 'GENES.json';

// In-memory cache
let geneCache: GeneCapsule[] | null = null;

export async function loadGenes(): Promise<GeneCapsule[]> {
  if (geneCache) return geneCache;
  const raw = await readWorkspaceFile(GENES_FILENAME);
  if (!raw) {
    geneCache = [];
    return geneCache;
  }
  try {
    geneCache = JSON.parse(raw) as GeneCapsule[];
  } catch {
    geneCache = [];
  }
  return geneCache;
}

export async function saveGenes(genes: GeneCapsule[]): Promise<void> {
  geneCache = genes;
  await writeWorkspaceFile(GENES_FILENAME, JSON.stringify(genes, null, 2));
}

/**
 * Crystallize a new learned trait into a Gene Capsule.
 * If the topic already exists, it updates the trait and increases confidence.
 */
export async function crystallizeGene(topic: string, trait: string, confidence: number = 50): Promise<GeneCapsule> {
  const genes = await loadGenes();
  
  const existingIndex = genes.findIndex(g => g.topic.toLowerCase() === topic.toLowerCase());
  let capsule: GeneCapsule;
  
  if (existingIndex >= 0) {
    const existing = genes[existingIndex];
    // Merge trait logic implies we just overwrite with the newer, refined trait
    existing.trait = trait;
    existing.confidence = Math.min(100, existing.confidence + (confidence * 0.5));
    existing.timestamp = Date.now();
    capsule = existing;
  } else {
    capsule = {
      id: `gene_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      topic,
      trait,
      confidence: Math.min(100, Math.max(1, confidence)),
      timestamp: Date.now()
    };
    genes.push(capsule);
  }
  
  await saveGenes(genes);
  return capsule;
}

/**
 * Formats all crystallized genes into a text block to inject into the system prompt.
 */
export async function formatGenesForPrompt(): Promise<string> {
  const genes = await loadGenes();
  if (genes.length === 0) return '';
  
  const highConfidence = genes.filter(g => g.confidence > 60).sort((a, b) => b.confidence - a.confidence);
  if (highConfidence.length === 0) return '';
  
  return `## Learned Traits (CGEP)
These are crystallized behaviors and preferences you have learned. Always abide by them:
${highConfidence.map(g => `- [${g.topic}] ${g.trait} (Confidence: ${Math.floor(g.confidence)}%)`).join('\n')}
`;
}

// ── CGEP CRYSTALLIZE TOOL ───────────────────────────────────────────────────
export const cgepCrystallize: RegisteredTool = {
  name: 'cgep_crystallize',
  description: 'Log a crystallized behavior, user preference, or system observation. Use it when you learn something durable that should influence all future interactions.',
  riskLevel: 'low',
  trustRequired: 'trusted',
  parameters: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'The topic or category of the learned trait (e.g., "User formatting", "Code style")' },
      trait: { type: 'string', description: 'The actual rule or preference (e.g., "User prefers 2 spaces for indentation")' },
      confidence: { type: 'number', description: 'Confidence in this trait (1-100)' }
    },
    required: ['topic', 'trait', 'confidence'],
  },
  execute: async ({ topic, trait, confidence }) => {
    const capsule = await crystallizeGene(String(topic), String(trait), Number(confidence));
    return `[WORKSPACE] Gene crystallized: ${capsule.topic} -> ${capsule.trait} (${capsule.confidence}%)`;
  },
};
