/**
 * Client-safe public surface of the assistant.
 *
 * `gateway.ts` is intentionally absent. The provider credential is server-only,
 * and this barrel is what `assistant-view.tsx` imports — so anything exported
 * here must be safe to ship to a browser. A test asserts the gateway stays out.
 *
 * Server code that needs the gateway imports `./gateway` directly.
 */

export type {
  AssistantIntent,
  AssistantReply,
  AssistantReplySource,
  AssistantTurn,
  EducationSource,
  GuardrailOutcome,
  RedactedAssistantContext,
  RedactedContextVersion,
  RedactedCycleFacts,
  RedactedDailyFacts,
  RedactedFrequency,
  RedactedInsight,
  RedactedPrediction,
} from './types';

export { REDACTED_CONTEXT_SCHEMA_VERSION } from './types';

export {
  classifyIntent,
  detectCrisis,
  detectMedicationRequest,
  detectOutOfScope,
  detectPersonalDiagnosisClaim,
} from './intent';

export {
  buildExcerpt,
  knownArticleIds,
  retrieveEducationSources,
  type EducationDoc,
  type RetrieveOptions,
} from './retrieval';

export {
  CRISIS_RESOURCES,
  GUARDRAIL_REASON_KEYS,
  GUARDRAIL_SEVERITY,
  evaluateGuardrails,
  isRefusal,
  type GuardrailDecision,
} from './guardrails';

export {
  RedactedContextViolation,
  assertRedactedContextIsSafe,
  buildRedactedContext,
  emptyRedactedContext,
  type BuildRedactedContextInput,
  type ContextCycleInput,
  type ContextDailyLogInput,
} from './context';

export { composeOfflineReply, type ComposeReplyInput } from './respond';
