// Trust Shield — controls what tool calls are allowed
// based on input trust level, tool risk, and shield state

import type { TrustLevel, TrustTag } from '../types';

export type TrustDecision = 'allow' | 'confirm' | 'block';

export interface TrustContext {
  inputTrustTag: TrustTag;
  toolRisk: 'low' | 'medium' | 'high';
  shieldEnabled: boolean;
  toolTrustRequired: TrustLevel;
}

export function decideTrust(ctx: TrustContext): TrustDecision {
  if (!ctx.shieldEnabled) return 'allow';

  // External input + high risk → block (user must explicitly confirm)
  if (ctx.inputTrustTag === 'EXTERNAL' && ctx.toolRisk === 'high') return 'block';

  // User input + high risk → confirm modal
  if (ctx.inputTrustTag === 'USER' && ctx.toolRisk === 'high') return 'confirm';

  // External input + medium risk → confirm
  if (ctx.inputTrustTag === 'EXTERNAL' && ctx.toolRisk === 'medium') return 'confirm';

  // Otherwise allow
  return 'allow';
}

export function classifyInputTrust(_input: string): TrustTag {
  // Simple heuristic — real impl would track data provenance
  return 'USER';
}

export function getToolTrustTag(decision: TrustDecision): TrustTag {
  switch (decision) {
    case 'allow': return 'WORKSPACE';
    case 'confirm': return 'USER';
    case 'block': return 'EXTERNAL';
  }
}
