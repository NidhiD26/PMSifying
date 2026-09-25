import type { HealthAnalytics } from '@/lib/analytics';
import type { PersonalInsight } from '../types';
import { insight } from '../internal';

/**
 * Symptom observations — factual reports of what was recorded. Never infers
 * causes, diagnoses, or hormonal explanations.
 */

/** A symptom must be recorded on at least this many days to be highlighted. */
const MIN_DAYS_TO_HIGHLIGHT = 1;
/** A runner-up symptom is highlighted only when it meets this threshold. */
const RUNNER_UP_MIN_DAYS = 2;

/**
 * Most frequently recorded symptom. Ties are broken deterministically
 * (lexicographic id) so identical input always yields the same insight.
 * Evidence: recordSymptom / symptomCount.
 */
export function mostFrequentSymptomInsight(
  a: HealthAnalytics
): PersonalInsight[] {
  const s = a.symptoms;
  if (s.sufficiency === 'no_data' || s.frequency.length === 0) return [];
  let top = s.frequency[0];
  for (const f of s.frequency) {
    if (
      f.count > top.count ||
      (f.count === top.count && f.id.localeCompare(top.id) < 0)
    ) {
      top = f;
    }
  }
  if (top.count < MIN_DAYS_TO_HIGHLIGHT) return [];
  return [
    insight('symptoms', `mostFrequent.${top.id}`, {
      priority: 'high',
      titleKey: 'insights.symptoms.mostFrequent.title',
      messageKey: 'insights.symptoms.mostFrequent.message',
      params: { symptom: top.id, count: top.count },
      evidence: [
        { metric: 'recordSymptom', value: top.id },
        { metric: 'symptomCount', value: top.count },
      ],
    }),
  ];
}

/**
 * A secondary "recorded on X days" observation for the next-distinct symptom,
 * only when it is clearly recorded (>= 2 days) and differs from the top one.
 * This satisfies "You recorded headaches on X days" without duplicating the
 * most-frequent observation.
 */
export function additionalSymptomCountInsight(
  a: HealthAnalytics
): PersonalInsight[] {
  const s = a.symptoms;
  if (s.sufficiency === 'no_data' || s.frequency.length < 2) return [];
  const top = s.frequency[0];
  const runner = s.frequency[1];
  if (runner.count < RUNNER_UP_MIN_DAYS) return [];
  if (runner.id === top.id) return [];
  return [
    insight('symptoms', `count.${runner.id}`, {
      priority: 'high',
      titleKey: 'insights.symptoms.count.title',
      messageKey: 'insights.symptoms.count.message',
      params: { symptom: runner.id, count: runner.count },
      evidence: [
        { metric: 'recordSymptom', value: runner.id },
        { metric: 'symptomCount', value: runner.count },
      ],
    }),
  ];
}

export function symptomRules(a: HealthAnalytics): PersonalInsight[] {
  return [
    ...mostFrequentSymptomInsight(a),
    ...additionalSymptomCountInsight(a),
  ];
}
