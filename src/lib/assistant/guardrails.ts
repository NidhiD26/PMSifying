import { classifyIntent, detectCrisis, detectMedicationRequest, detectOutOfScope, detectPersonalDiagnosisClaim } from './intent';
import type { AssistantIntent, GuardrailOutcome } from './types';

/**
 * Safety policy for the assistant.
 *
 * The guardrail is a separate, independent pass over the raw text — it does not
 * merely trust the intent classifier. That redundancy is the point: if
 * `classifyIntent` ever mis-ranks a message, the crisis and medication rules
 * below still fire, because they re-scan the text themselves. A safety rule
 * that depends on a single upstream decision is a single point of failure.
 *
 * Vocabulary lives in `intent.ts` and is shared, so a safety term has exactly
 * one definition in the codebase.
 */

export const GUARDRAIL_SEVERITY: Record<GuardrailOutcome, number> = {
  allow: 0,
  refuse: 1,
  escalate: 2,
};

export interface GuardrailDecision {
  outcome: GuardrailOutcome;
  /**
   * Key under `assistant.guardrails`. The response composer turns this into the
   * user-facing message key, so guardrails never contain prose either.
   */
  reasonKey: string;
  /** The intent the decision was based on, after any re-classification. */
  intent: AssistantIntent;
}

/** Stable keys, so the composer and the locale files cannot drift apart. */
export const GUARDRAIL_REASON_KEYS = {
  crisis: 'guardrails.crisis',
  diagnosis: 'guardrails.diagnosis',
  medication: 'guardrails.medication',
  outOfScope: 'guardrails.outOfScope',
} as const;

/**
 * Escalation resources shown alongside a crisis reply.
 *
 * India has a single national helpline for mental-health crisis support, so
 * there is no per-region table to maintain. `labelKey` points into the
 * `assistant.resources` namespace — the numbers are identical everywhere, the
 * surrounding words are not, so only the words are translated.
 */
export const CRISIS_RESOURCES = [
  { id: 'emergency', labelKey: 'resources.emergency', value: '112' },
  { id: 'kiran', labelKey: 'resources.kiran', value: '1800-599-0019' },
  { id: 'childline', labelKey: 'resources.childline', value: '1098' },
] as const;

function decision(outcome: GuardrailOutcome, reasonKey: string, intent: AssistantIntent): GuardrailDecision {
  return { outcome, reasonKey, intent };
}

/**
 * Applies every safety rule to a message.
 *
 * Rules are evaluated independently and the most severe outcome wins, so adding
 * a rule can never weaken an existing one.
 */
export function evaluateGuardrails(text: string, intent?: AssistantIntent): GuardrailDecision {
  const resolved: AssistantIntent = intent ?? classifyIntent(text);

  // Checked from most to least severe. Crisis is tested against the raw text so
  // that a mis-classified intent cannot hide it.
  if (resolved === 'crisis' || detectCrisis(text)) {
    return decision('escalate', GUARDRAIL_REASON_KEYS.crisis, 'crisis');
  }

  if (resolved === 'medication' || detectMedicationRequest(text)) {
    return decision('refuse', GUARDRAIL_REASON_KEYS.medication, 'medication');
  }

  if (resolved === 'diagnosis' || detectPersonalDiagnosisClaim(text)) {
    return decision('refuse', GUARDRAIL_REASON_KEYS.diagnosis, 'diagnosis');
  }

  if (resolved === 'outOfScope' || detectOutOfScope(text)) {
    return decision('refuse', GUARDRAIL_REASON_KEYS.outOfScope, 'outOfScope');
  }

  return decision('allow', 'guardrails.allow', resolved);
}

/**
 * A refusal is the safe path: the assistant declines the specific request and
 * redirects to a clinician or the Education library, rather than guessing.
 */
export function isRefusal(guardrail: GuardrailDecision): boolean {
  return guardrail.outcome === 'refuse' || guardrail.outcome === 'escalate';
}
