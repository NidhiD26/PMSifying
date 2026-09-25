import type { HealthAnalytics } from '@/lib/analytics';
import type { FlowLevel } from '@/types/health';
import type { PersonalInsight } from '../types';
import { insight } from '../internal';

/** Completed periods required before a period summary appears. */
const MIN_COMPLETED_FOR_SUMMARY = 2;

const FLOW_LABEL_KEY: Record<FlowLevel, string> = {
  spotting: 'spotting',
  light: 'light',
  medium: 'medium',
  heavy: 'heavy',
};

/**
 * Average period duration. Requires the analytics average to be available.
 * Evidence: periodAvgDuration (inclusive days).
 */
export function averagePeriodDurationInsight(
  a: HealthAnalytics
): PersonalInsight[] {
  const p = a.period;
  if (
    p.sufficiency !== 'available' ||
    p.completedPeriods < MIN_COMPLETED_FOR_SUMMARY ||
    p.averageDuration.value === null
  ) {
    return [];
  }
  return [
    insight('period', 'average', {
      titleKey: 'insights.period.average.title',
      messageKey: 'insights.period.average.message',
      params: { avg: p.averageDuration.value },
      evidence: [
        { metric: 'periodAvgDuration', value: p.averageDuration.value },
        { metric: 'completedPeriods', value: p.completedPeriods },
      ],
    }),
  ];
}

/**
 * Period duration range. Distinct from the average observation.
 * Evidence: periodDurationMin / periodDurationMax.
 */
export function periodDurationRangeInsight(
  a: HealthAnalytics
): PersonalInsight[] {
  const p = a.period;
  if (
    p.sufficiency !== 'available' ||
    p.shortestDuration.value === null ||
    p.longestDuration.value === null
  ) {
    return [];
  }
  return [
    insight('period', 'durationRange', {
      titleKey: 'insights.period.durationRange.title',
      messageKey: 'insights.period.durationRange.message',
      params: {
        min: p.shortestDuration.value,
        max: p.longestDuration.value,
      },
      evidence: [
        { metric: 'periodDurationMin', value: p.shortestDuration.value },
        { metric: 'periodDurationMax', value: p.longestDuration.value },
      ],
    }),
  ];
}

/**
 * Most frequently recorded flow level, when at least one flow is recorded.
 * The flow param carries the raw flow id; the UI maps it to a localized label.
 */
export function mostFrequentFlowInsight(
  a: HealthAnalytics
): PersonalInsight[] {
  const dist = a.period.flowDistribution;
  if (dist.length === 0) return [];
  let most: { level: FlowLevel; count: number } = dist[0];
  for (const d of dist) {
    if (
      d.count > most.count ||
      (d.count === most.count &&
        FLOW_LABEL_KEY[d.level].localeCompare(FLOW_LABEL_KEY[most.level]) < 0)
    ) {
      most = d;
    }
  }
  return [
    insight('period', `flow.${most.level}`, {
      titleKey: 'insights.period.flow.title',
      messageKey: 'insights.period.flow.message',
      params: { flow: most.level, count: most.count },
      evidence: [
        { metric: 'mostFrequentFlow', value: most.level },
        { metric: 'flowCount', value: most.count },
      ],
    }),
  ];
}

export function periodRules(a: HealthAnalytics): PersonalInsight[] {
  return [
    ...averagePeriodDurationInsight(a),
    ...periodDurationRangeInsight(a),
    ...mostFrequentFlowInsight(a),
  ];
}
