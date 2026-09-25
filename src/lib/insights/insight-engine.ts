import type { HealthAnalytics } from '@/lib/analytics';
import type { PersonalInsight } from './types';
import { cycleRules } from './rules/cycle-rules';
import { periodRules } from './rules/period-rules';
import { symptomRules } from './rules/symptom-rules';
import { moodRules } from './rules/mood-rules';
import { painRules } from './rules/pain-rules';
import { sleepRules } from './rules/sleep-rules';
import { hydrationRules } from './rules/hydration-rules';
import { completenessInsight } from './rules/completeness-rules';
import { compareInsights } from './insight-priority';

export interface InsightEngineInput {
  /** Aggregated, deterministic analytics for the selected period. */
  analytics: HealthAnalytics;
  /** Distinct recorded daily-log dates (full history) for completeness. */
  recordedDates: string[];
  /** Maximum number of insights to return. Default 3. */
  limit?: number;
}

/**
 * Deterministic rule engine. For identical input it always returns the same
 * (ordered) set of insights. No randomness, no current-time dependence — the
 * completeness window comes from analytics.range which is already fixed.
 */
export function getInsights(input: InsightEngineInput): PersonalInsight[] {
  const a = input.analytics;
  const rules: PersonalInsight[][] = [
    cycleRules(a),
    periodRules(a),
    symptomRules(a),
    moodRules(a),
    painRules(a),
    sleepRules(a),
    hydrationRules(a),
    completenessInsight({
      recordedDates: input.recordedDates,
      range: a.range,
    }),
  ];

  // Deduplicate by stable id (a safety net; ids are already unique per rule).
  const seen = new Set<string>();
  const all: PersonalInsight[] = [];
  for (const batch of rules) {
    for (const insight of batch) {
      if (!seen.has(insight.id)) {
        seen.add(insight.id);
        all.push(insight);
      }
    }
  }

  all.sort(compareInsights);

  const limit = input.limit ?? 3;
  return all.slice(0, Math.max(0, limit));
}
