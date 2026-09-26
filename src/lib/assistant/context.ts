import type { CycleDomainModel, DailyLogDomainModel } from '@/types/health';
import type { Locale } from '@/types/i18n';
import { computeHealthAnalytics } from '@/lib/analytics';
import { analyzeCycles } from '@/lib/cycle-engine';
import type { PersonalInsight } from '@/lib/insights';
import { REDACTED_CONTEXT_SCHEMA_VERSION, type RedactedAssistantContext, type RedactedFrequency } from './types';

/**
 * The privacy boundary.
 *
 * Everything that leaves the device passes through `buildRedactedContext()`.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS AN ALLOWLIST AND NOT A FILTER
 * ---------------------------------------------------------------------------
 * A denylist ("strip notes, strip pinHash, strip …") has to be kept in sync
 * with every field the database grows, and fails open: a new sensitive column
 * is transmitted until somebody remembers to add it to the list.
 *
 * This builder fails closed instead. It reads a *structurally narrowed* input
 * type that has no `notes` property to begin with, and it writes a *structurally
 * narrowed* output type that has no field able to hold free text. There is no
 * spread of a source record anywhere below, and no index signature on the way
 * out, so a field that is not named here cannot appear in the result.
 *
 * Two further consequences worth stating explicitly:
 *
 *   - `UserPreferencesRecord` is never imported. `pinHash` and `pinSalt` are
 *     therefore not reachable from this module at all.
 *   - Per-day series (pain/sleep/hydration trends, symptom occurrence dates)
 *     are reduced to averages and totals. The assistant gets "averages across 12
 *     recorded days", not the dated history of a specific person.
 */

/**
 * The only cycle fields this module may read.
 *
 * `notes` is absent by construction. `flow`, `cycleLength` and `periodLength`
 * are absent too: the cycle engine derives durations from the dates themselves,
 * and taking the user's own recorded length as an input would let a bad manual
 * entry quietly become the assistant's answer.
 *
 * `createdAt`/`updatedAt` are present only because `CycleDomainModel` declares
 * them required, which keeps this type assignable to the engine input without a
 * cast. This module never reads them.
 */
export type ContextCycleInput = Pick<
  CycleDomainModel,
  'startDate' | 'endDate' | 'createdAt' | 'updatedAt'
>;

/** The only daily-log fields this module may read. `notes` is absent. */
export type ContextDailyLogInput = Pick<
  DailyLogDomainModel,
  | 'date'
  | 'symptoms'
  | 'mood'
  | 'painLevel'
  | 'sleepHours'
  | 'hydrationMl'
  | 'createdAt'
  | 'updatedAt'
>;

export interface BuildRedactedContextInput {
  locale: Locale;
  /** Explicit "today" as an ISO date, so the result is deterministic. */
  today: string;
  cycles: ContextCycleInput[];
  dailyLogs: ContextDailyLogInput[];
  /** Pre-computed insights. Their `params` bag is deliberately discarded. */
  insights?: PersonalInsight[];
}

/** Upper bounds, so a long history cannot turn into an unbounded payload. */
const MAX_CYCLE_LENGTHS = 12;
const MAX_FREQUENCIES = 5;
const MAX_INSIGHTS = 3;

/** One decimal place is plenty for a spoken average and keeps the payload small. */
function round1(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

function toFrequencies(
  entries: { id: string; count: number }[] | undefined
): RedactedFrequency[] {
  if (!entries) return [];
  return entries
    .slice(0, MAX_FREQUENCIES)
    .map((entry) => ({ id: entry.id, count: entry.count }));
}

/**
 * Projects local records down to the network-safe context.
 *
 * Every number here is produced by the analytics engine or the cycle engine.
 * This function performs no health calculation of its own — it only selects
 * which already-computed values to disclose. That is what keeps the assistant
 * from ever answering a math question: there is no arithmetic in this file to
 * get wrong, and the engines remain the single source of truth.
 */
export function buildRedactedContext(
  input: BuildRedactedContextInput
): RedactedAssistantContext {
  const { locale, today, cycles, dailyLogs } = input;

  const analytics = computeHealthAnalytics({ cycles, dailyLogs, today });
  const analysis = analyzeCycles(cycles);

  const stats = analysis.stats;
  const nextPeriod = analysis.nextPeriod;
  const fertile = analysis.fertileWindow;

  // The engine reports 'insufficient_data' rather than guessing. Preserve that
  // status verbatim and drop the dates: an estimate the engine would not stand
  // behind must not reach the assistant, let alone a reader.
  const prediction =
    nextPeriod.status === 'predicted'
      ? {
          status: nextPeriod.status,
          estimatedStartDate: nextPeriod.estimatedStartDate ?? null,
          estimatedOvulationDate:
            fertile.status === 'estimated' ? fertile.estimatedOvulationDate ?? null : null,
          fertileWindowStartDate:
            fertile.status === 'estimated' ? fertile.startDate ?? null : null,
          fertileWindowEndDate:
            fertile.status === 'estimated' ? fertile.endDate ?? null : null,
        }
      : {
          status: nextPeriod.status,
          estimatedStartDate: null,
          estimatedOvulationDate: null,
          fertileWindowStartDate: null,
          fertileWindowEndDate: null,
        };

  return {
    schemaVersion: REDACTED_CONTEXT_SCHEMA_VERSION,
    locale,
    dataSufficiency: analysis.dataSufficiency,
    recordedCycles: analytics.cycle.recordedCycles,
    recordedDailyLogs: analytics.totalDailyLogs,
    cycle: {
      recordedCycles: analytics.cycle.recordedCycles,
      averageCycleLengthDays: round1(analytics.cycle.averageCycleLength.value),
      shortestCycleLengthDays: round1(analytics.cycle.shortestCycle.value),
      longestCycleLengthDays: round1(analytics.cycle.longestCycle.value),
      averagePeriodLengthDays: round1(analytics.period.averageDuration.value),
      cycleLengthsDays: (stats?.cycleLengths ?? []).slice(-MAX_CYCLE_LENGTHS),
      variabilityCategory: analysis.variability.category,
    },
    prediction,
    daily: {
      recordedDays: analytics.pain.recordedDays,
      averagePainLevel: round1(analytics.pain.average.value),
      averageSleepHours: round1(analytics.sleep.average.value),
      averageHydrationMl: round1(analytics.hydration.average.value),
      topSymptoms: toFrequencies(analytics.symptoms.mostFrequent),
      topMoods: toFrequencies(analytics.mood.mostFrequent),
    },
    insights: (input.insights ?? []).slice(0, MAX_INSIGHTS).map((insight) => ({
      id: insight.id,
      category: insight.category,
      priority: insight.priority,
      titleKey: insight.titleKey,
      messageKey: insight.messageKey,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Trust-boundary assertion                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Property names that must never appear anywhere in a serialized context.
 * Checked case-insensitively.
 */
const FORBIDDEN_KEY_FRAGMENTS = [
  'pinhash',
  'pinsalt',
  'note',
  'password',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'credential',
  'email',
  'phone',
  'address',
];

/**
 * Longest legitimate string in a redacted context: a translation key such as
 * `analytics.hydration.average.message`, or a 10-character ISO date. 200 is a
 * wide margin that a paragraph of user prose cannot fit inside.
 */
const MAX_STRING_LENGTH = 200;

export class RedactedContextViolation extends Error {
  constructor(public readonly detail: string) {
    super(`Redacted assistant context rejected: ${detail}`);
    this.name = 'RedactedContextViolation';
  }
}

/**
 * Last line of defence, run at the network boundary before anything is sent.
 *
 * The type system already makes the forbidden fields unrepresentable; this
 * catches the failure mode the type system cannot, which is a future edit that
 * widens a field to `string` and starts copying prose into it. It is a cheap
 * deep walk of a small object.
 *
 * Note this deliberately does NOT police the retrieved education sources. Those
 * carry article prose on purpose — that is the grounding — and they come from
 * the bundled corpus, never from the user.
 */
export function assertRedactedContextIsSafe(context: unknown): void {
  const seen = new Set<unknown>();

  const walk = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      if (node.length > MAX_STRING_LENGTH) {
        throw new RedactedContextViolation(
          `string at ${path} is ${node.length} chars, over the ${MAX_STRING_LENGTH} char limit`
        );
      }
      return;
    }

    if (node === null || typeof node !== 'object') return;

    if (seen.has(node)) {
      throw new RedactedContextViolation(`circular reference at ${path}`);
    }
    seen.add(node);

    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      const lowered = key.toLowerCase();
      const offending = FORBIDDEN_KEY_FRAGMENTS.find((fragment) => lowered.includes(fragment));
      if (offending) {
        throw new RedactedContextViolation(`forbidden key "${key}" at ${path}`);
      }
      walk(value, path ? `${path}.${key}` : key);
    }
  };

  walk(context, '');
}

/** Convenience for the empty case: a valid context for a user with no records. */
export function emptyRedactedContext(locale: Locale): RedactedAssistantContext {
  return buildRedactedContext({ locale, today: '1970-01-01', cycles: [], dailyLogs: [] });
}
