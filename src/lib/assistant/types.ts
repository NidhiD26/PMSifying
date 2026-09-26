import type { Locale } from '@/types/i18n';
import type { ArticleTopic } from '@/lib/learn/articles';
// Imported from the types module rather than the barrel: `PredictionStatus` is
// not re-exported by src/lib/cycle-engine/index.ts, and the engine is not
// modified for this feature.
import type {
  DataSufficiencyStatus,
  PredictionStatus,
  VariabilityCategory,
} from '@/lib/cycle-engine/types';
import type { InsightCategory, InsightPriority } from '@/lib/insights';

/**
 * Assistant domain types.
 *
 * The assistant has exactly three layers, and this file is the contract between
 * them:
 *
 *   1. Deterministic local (default)  — intent + retrieval + guardrails +
 *      response composition. Zero network, zero AI configuration, always works.
 *   2. Privacy boundary                — `buildRedactedContext()` projects the
 *      local database down to `RedactedAssistantContext`.
 *   3. Optional remote Gemma gateway  — OFF unless explicitly enabled by env.
 *      Receives `RedactedAssistantContext` and nothing else.
 *
 * ---------------------------------------------------------------------------
 * PRIVACY INVARIANT
 * ---------------------------------------------------------------------------
 * `RedactedAssistantContext` is the ONLY structure that may cross the network
 * boundary, and it is built by allowlist projection: every field is named and
 * assigned explicitly. Therefore it structurally cannot carry:
 *
 *   - `pinHash` / `pinSalt`      — this module does not even import
 *                                   `UserPreferencesRecord`, so those fields
 *                                   are not reachable from here.
 *   - free-text `notes`          — no field of this type is a free-text
 *                                   string written by the user. The only
 *                                   strings are enums, i18n keys, and
 *                                   ISO dates produced by the cycle engine.
 *   - raw IndexedDB records      — no field holds a `CycleDomainModel`,
 *                                   `DailyLogDomainModel`, or any spread of
 *                                   one. There is no index signature and no
 *                                   `Record<string, unknown>` anywhere below.
 *
 * There is no denylist to keep in sync, because nothing is filtered out: only
 * what is explicitly listed is ever included.
 */

/** Bumped whenever the wire shape changes, so a stale payload is rejected. */
export const REDACTED_CONTEXT_SCHEMA_VERSION = 1 as const;

export type RedactedContextVersion = typeof REDACTED_CONTEXT_SCHEMA_VERSION;

/**
 * What the user is asking for.
 *
 * `crisis` outranks everything: it is checked first so that a message which
 * also looks like, say, a medication question still escalates.
 */
export type AssistantIntent =
  | 'crisis'
  | 'diagnosis'
  | 'medication'
  | 'outOfScope'
  | 'prediction'
  | 'personalSummary'
  | 'education'
  | 'greeting'
  | 'unknown';

/** How a reply was produced. */
export type AssistantReplySource = 'offline' | 'gateway';

/** Guardrail verdicts, ordered by increasing severity. */
export type GuardrailOutcome = 'allow' | 'refuse' | 'escalate';

/* -------------------------------------------------------------------------- */
/* Redacted context — the network-safe projection                              */
/* -------------------------------------------------------------------------- */

/** A count of how often a symptom or mood id was recorded. Never free text. */
export interface RedactedFrequency {
  /** Predefined id, e.g. 'cramps'. Matches the app's own vocabulary. */
  id: string;
  count: number;
}

/** Cycle facts, already computed by the cycle engine. Never recomputed here. */
export interface RedactedCycleFacts {
  recordedCycles: number;
  averageCycleLengthDays: number | null;
  shortestCycleLengthDays: number | null;
  longestCycleLengthDays: number | null;
  averagePeriodLengthDays: number | null;
  /**
   * Recorded cycle lengths in days, oldest first. Numbers only — this is a
   * derived series, not the underlying dated log rows.
   */
  cycleLengthsDays: number[];
  variabilityCategory: VariabilityCategory;
}

/**
 * A prediction, verbatim from the cycle engine.
 *
 * These are derived dates, not raw log dates: including them is what lets the
 * assistant be useful, and they carry no information the engine did not
 * already surface on the Insights and Calendar screens.
 */
export interface RedactedPrediction {
  status: PredictionStatus;
  estimatedStartDate: string | null;
  estimatedOvulationDate: string | null;
  fertileWindowStartDate: string | null;
  fertileWindowEndDate: string | null;
}

/** Daily-health aggregates. No per-day series, so no dated tracking history. */
export interface RedactedDailyFacts {
  recordedDays: number;
  averagePainLevel: number | null;
  averageSleepHours: number | null;
  averageHydrationMl: number | null;
  topSymptoms: RedactedFrequency[];
  topMoods: RedactedFrequency[];
}

/**
 * An insight reduced to its keys.
 *
 * `PersonalInsight` already stores prose as translation keys rather than
 * sentences (see `src/lib/insights/types.ts`), so carrying the keys across the
 * boundary leaks nothing — and the receiving side can render them in its own
 * locale. The `params` bag is dropped on purpose: it is the only field that
 * could carry a free-text value.
 */
export interface RedactedInsight {
  id: string;
  category: InsightCategory;
  priority: InsightPriority;
  titleKey: string;
  messageKey: string;
}

/**
 * The complete, network-safe context. This is the allowlist.
 *
 * Every field is either a count, a bounded number, an enum, a translation key,
 * or an ISO date emitted by the deterministic engines.
 */
export interface RedactedAssistantContext {
  schemaVersion: RedactedContextVersion;
  /** Used by the receiver to answer in the reader's own language. */
  locale: Locale;
  dataSufficiency: DataSufficiencyStatus;
  recordedCycles: number;
  recordedDailyLogs: number;
  cycle: RedactedCycleFacts;
  prediction: RedactedPrediction;
  daily: RedactedDailyFacts;
  insights: RedactedInsight[];
}

/* -------------------------------------------------------------------------- */
/* Retrieval                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A retrieved education article.
 *
 * `titleKey`/`summaryKey` are for rendering with next-intl. `title`/`summary`/
 * `excerpt` are the resolved prose in the reader's language and exist purely so
 * the optional gateway has something to ground on — this is public educational
 * content from the bundled corpus, never user data.
 */
export interface EducationSource {
  articleId: string;
  topic: ArticleTopic;
  score: number;
  titleKey: string;
  summaryKey: string;
  title: string;
  summary: string;
  excerpt: string;
}

/* -------------------------------------------------------------------------- */
/* Replies                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A rendered reply is described, not written: an i18n key plus interpolation
 * parameters. No layer of the assistant emits prose directly, which is what
 * keeps the assistant translatable and keeps the offline and gateway paths
 * structurally identical.
 */
export interface AssistantReply {
  /** Deterministic per conversation turn, e.g. `reply-3`. */
  id: string;
  intent: AssistantIntent;
  /** Key under `assistant.responses`. */
  messageKey: string;
  params: Record<string, string | number>;
  citations: EducationSource[];
  /** True when a safety rule replaced retrieval and comprehension. */
  isRefusal: boolean;
  source: AssistantReplySource;
  /**
   * Model-authored phrasing, present only when `source` is `'gateway'`.
   *
   * Kept separate from `messageKey` on purpose. The offline answer is always
   * computed first and stays authoritative; this is an optional rewording of
   * it. So a gateway failure, a timeout, or a disabled flag simply leaves this
   * undefined and the deterministic reply renders as-is — and a refusal can
   * never carry provider text, because the server refuses to forward one.
   */
  providerText?: string;
}

/** One turn in the on-screen conversation. */
export interface AssistantTurn {
  id: string;
  role: 'user' | 'assistant';
  /** Literal user text, or a key under `assistant.responses` for a reply. */
  text: string;
  reply?: AssistantReply;
}
