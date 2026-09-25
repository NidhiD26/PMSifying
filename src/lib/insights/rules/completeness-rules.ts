import type { AnalyticsDateRange } from '@/lib/analytics';
import type { PersonalInsight } from '../types';
import { insight, evidenceRange } from '../internal';

/**
 * Data-completeness observation.
 *
 * The system can describe gaps in recorded data in a neutral, non-judgemental
 * way. It never says the user is doing poorly or failed to track.
 */

export interface CompletenessInput {
  /** Distinct dates on which any health record (daily log) exists. */
  recordedDates: string[];
  /** Optional window to report against, expressed as a bounded date range. */
  range: AnalyticsDateRange;
}

function countDistinctInRange(
  recordedDates: string[],
  range: AnalyticsDateRange
): number {
  const seen = new Set<string>();
  let count = 0;
  for (const d of recordedDates) {
    if (d >= range.startDate && d <= range.endDate && !seen.has(d)) {
      seen.add(d);
      count++;
    }
  }
  return count;
}

/**
 * Emit a single, low-priority completeness observation when at least one
 * record falls inside the supplied window. The message reports the count in
 * neutral language; no judgment, no gamification.
 */
export function completenessInsight(
  input: CompletenessInput
): PersonalInsight[] {
  const count = countDistinctInRange(input.recordedDates, input.range);
  if (count === 0) return [];
  return [
    insight('general', 'completeness', {
      priority: 'low',
      titleKey: 'insights.completeness.title',
      messageKey: 'insights.completeness.message',
      params: { count },
      evidence: [
        { metric: 'recordedDays', value: count },
        evidenceRange(input.range.startDate, input.range.endDate),
      ],
    }),
  ];
}
