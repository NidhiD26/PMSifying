import type { HealthAnalytics } from '@/lib/analytics';
import type { PersonalInsight } from '../types';
import { insight } from '../internal';

/**
 * Sleep observations — recordings only, no medical conclusions or behaviour
 * prescriptions.
 */

const MIN_DAYS_FOR_AVERAGE = 2;

/** Average recorded sleep in hours. Evidence: sleepAvg. */
export function averageSleepInsight(a: HealthAnalytics): PersonalInsight[] {
  const s = a.sleep;
  if (s.average.sufficiency !== 'available' || s.average.value === null) {
    return [];
  }
  return [
    insight('sleep', 'average', {
      priority: 'high',
      titleKey: 'insights.sleep.average.title',
      messageKey: 'insights.sleep.average.message',
      params: { value: s.average.value },
      evidence: [
        { metric: 'sleepAvg', value: s.average.value },
        { metric: 'sleepRecordedDays', value: s.recordedDays },
      ],
    }),
  ];
}

/**
 * Range of recorded sleep, only when it conveys real variation.
 * Evidence: sleepMin / sleepMax.
 */
export function sleepRangeInsight(a: HealthAnalytics): PersonalInsight[] {
  const s = a.sleep;
  if (s.minimum.value === null || s.maximum.value === null) return [];
  if (!(s.maximum.value > s.minimum.value)) return [];
  if (s.recordedDays < MIN_DAYS_FOR_AVERAGE) return [];
  return [
    insight('sleep', 'range', {
      priority: 'high',
      titleKey: 'insights.sleep.range.title',
      messageKey: 'insights.sleep.range.message',
      params: { min: s.minimum.value, max: s.maximum.value },
      evidence: [
        { metric: 'sleepMin', value: s.minimum.value },
        { metric: 'sleepMax', value: s.maximum.value },
      ],
    }),
  ];
}

export function sleepRules(a: HealthAnalytics): PersonalInsight[] {
  return [...averageSleepInsight(a), ...sleepRangeInsight(a)];
}
