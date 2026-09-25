import type { HealthAnalytics } from '@/lib/analytics';
import type { PersonalInsight } from '../types';
import { insight } from '../internal';

/**
 * Hydration observations — recordings only. Never labels the user dehydrated
 * and never compares against a universal medical target.
 */

const MIN_DAYS_FOR_AVERAGE = 2;

/** Average recorded hydration in ml. Evidence: hydrationAvg. */
export function averageHydrationInsight(
  a: HealthAnalytics
): PersonalInsight[] {
  const h = a.hydration;
  if (h.average.sufficiency !== 'available' || h.average.value === null) {
    return [];
  }
  return [
    insight('hydration', 'average', {
      priority: 'high',
      titleKey: 'insights.hydration.average.title',
      messageKey: 'insights.hydration.average.message',
      params: { value: h.average.value },
      evidence: [
        { metric: 'hydrationAvg', value: h.average.value },
        { metric: 'hydrationRecordedDays', value: h.recordedDays },
      ],
    }),
  ];
}

/**
 * How many days hydration was recorded. A gentle, factual completeness note.
 * Evidence: hydrationRecordedDays.
 */
export function hydrationRecordedDaysInsight(
  a: HealthAnalytics
): PersonalInsight[] {
  const h = a.hydration;
  if (h.recordedDays < MIN_DAYS_FOR_AVERAGE) return [];
  return [
    insight('hydration', 'recordedDays', {
      priority: 'high',
      titleKey: 'insights.hydration.recordedDays.title',
      messageKey: 'insights.hydration.recordedDays.message',
      params: { days: h.recordedDays },
      evidence: [
        { metric: 'hydrationRecordedDays', value: h.recordedDays },
      ],
    }),
  ];
}

export function hydrationRules(a: HealthAnalytics): PersonalInsight[] {
  return [...averageHydrationInsight(a), ...hydrationRecordedDaysInsight(a)];
}
