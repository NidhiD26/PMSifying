import type { HealthAnalytics } from '@/lib/analytics';
import type { PersonalInsight } from '../types';
import { insight } from '../internal';

/**
 * Pain observations — factual averages/ranges of recorded pain (0-10).
 * Pain is never classified as chronic, abnormal, dangerous, or pathological.
 */

/** Tracked days required for an average (matches the analytics sufficiency). */
const MIN_DAYS_FOR_AVERAGE = 2;

/**
 * Average recorded pain. Evidence: painAvg.
 */
export function averagePainInsight(a: HealthAnalytics): PersonalInsight[] {
  const p = a.pain;
  if (p.average.sufficiency !== 'available' || p.average.value === null) {
    return [];
  }
  return [
    insight('pain', 'average', {
      priority: 'high',
      titleKey: 'insights.pain.average.title',
      messageKey: 'insights.pain.average.message',
      params: { value: p.average.value },
      evidence: [
        { metric: 'painAvg', value: p.average.value },
        { metric: 'painRecordedDays', value: p.recordedDays },
      ],
    }),
  ];
}

/**
 * Range of recorded pain, shown only when it conveys real variation (max >
 * min). Evidence: painMin / painMax.
 */
export function painRangeInsight(a: HealthAnalytics): PersonalInsight[] {
  const p = a.pain;
  if (p.highest.value === null || p.lowest.value === null) return [];
  if (!(p.highest.value > p.lowest.value)) return [];
  if (p.recordedDays < MIN_DAYS_FOR_AVERAGE) return [];
  return [
    insight('pain', 'range', {
      priority: 'high',
      titleKey: 'insights.pain.range.title',
      messageKey: 'insights.pain.range.message',
      params: { min: p.lowest.value, max: p.highest.value },
      evidence: [
        { metric: 'painMin', value: p.lowest.value },
        { metric: 'painMax', value: p.highest.value },
      ],
    }),
  ];
}

export function painRules(a: HealthAnalytics): PersonalInsight[] {
  return [...averagePainInsight(a), ...painRangeInsight(a)];
}
