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
  AssistantBlock,
  AssistantBlockKind,
  AssistantIntent,
  AssistantReply,
  AssistantReplySource,
  AssistantRoute,
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
  detectAppHelpRequest,
  detectCrisis,
  detectMedicationRequest,
  detectOutOfScope,
  detectPersonalDiagnosisClaim,
  detectSummaryRequest,
} from './intent';

export {
  buildExcerpt,
  curatedArticleMatches,
  inferTopicHints,
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

export {
  appHelpTopicFor,
  composeOfflineReply,
  type AppHelpTopic,
  type ComposeReplyInput,
} from './respond';

export {
  classifyAppTopic,
  routeQuestion,
  type RouteDecision,
} from './route';

export {
  APP_HELP_ENTRIES,
  APP_HELP_PATHS,
  KNOWLEDGE_ENTRIES,
  KNOWLEDGE_KEY_PREFIX,
  UNRESOLVED_ARTICLE_REFS,
  knowledgeEntriesForDomain,
  knowledgeEntryById,
  knowledgeKey,
  matchKnowledge,
  matchKnowledgeWithRelated,
  qualifyKnowledgeKey,
  rankKnowledge,
  type KnowledgeDomain,
  type KnowledgeEntry,
  type KnowledgeMatch,
  type KnowledgeProvenance,
  type KnowledgeSlot,
} from './knowledge';
