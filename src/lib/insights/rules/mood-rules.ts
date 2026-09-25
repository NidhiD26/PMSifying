import type { HealthAnalytics } from '@/lib/analytics';
import type { PersonalInsight } from '../types';
import { insight } from '../internal';

/**
 * Mood observations — neutral descriptions of what was recorded. Moods are
 * never interpreted as mental-health conditions and no score is produced.
 */

const MIN_DAYS_TO_HIGHLIGHT = 1;
const RUNNER_UP_MIN_DAYS = 2;

/**
 * Most frequently recorded mood. Ties broken deterministically (lexicographic
 * id). Evidence: recordMood / moodCount.
 */
export function mostFrequentMoodInsight(
  a: HealthAnalytics
): PersonalInsight[] {
  const m = a.mood;
  if (m.sufficiency === 'no_data' || m.distribution.length === 0) return [];
  let top = m.distribution[0];
  for (const d of m.distribution) {
    if (
      d.count > top.count ||
      (d.count === top.count && d.id.localeCompare(top.id) < 0)
    ) {
      top = d;
    }
  }
  if (top.count < MIN_DAYS_TO_HIGHLIGHT) return [];
  return [
    insight('mood', `mostFrequent.${top.id}`, {
      priority: 'high',
      titleKey: 'insights.mood.mostFrequent.title',
      messageKey: 'insights.mood.mostFrequent.message',
      params: { mood: top.id, count: top.count },
      evidence: [
        { metric: 'recordMood', value: top.id },
        { metric: 'moodCount', value: top.count },
      ],
    }),
  ];
}

/**
 * Secondary "recorded on X days" observation for a distinct mood clearly
 * present in the records.
 */
export function additionalMoodCountInsight(
  a: HealthAnalytics
): PersonalInsight[] {
  const m = a.mood;
  if (m.sufficiency === 'no_data' || m.distribution.length < 2) return [];
  const top = m.distribution[0];
  const runner = m.distribution[1];
  if (runner.count < RUNNER_UP_MIN_DAYS) return [];
  if (runner.id === top.id) return [];
  return [
    insight('mood', `count.${runner.id}`, {
      priority: 'high',
      titleKey: 'insights.mood.count.title',
      messageKey: 'insights.mood.count.message',
      params: { mood: runner.id, count: runner.count },
      evidence: [
        { metric: 'recordMood', value: runner.id },
        { metric: 'moodCount', value: runner.count },
      ],
    }),
  ];
}

export function moodRules(a: HealthAnalytics): PersonalInsight[] {
  return [...mostFrequentMoodInsight(a), ...additionalMoodCountInsight(a)];
}
