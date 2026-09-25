import type { HealthAnalytics } from '@/lib/analytics';
import type { VariabilityCategory } from '@/lib/cycle-engine';
import type { PersonalInsight } from '../types';
import { insight } from '../internal';

/**
 * Cycle observations. Purely descriptive of recorded data — never clinical.
 */

/** Minimum completed cycle intervals required for a cycle summary to appear. */
const MIN_INTERVALS_FOR_SUMMARY = 1;

/**
 * Cycle range summary, shown once there is at least one valid interval.
 * Evidence: cycleLengthMin / cycleLengthMax.
 */
export function cycleRangeInsight(a: HealthAnalytics): PersonalInsight[] {
  const c = a.cycle;
  if (
    c.sufficiency !== 'available' ||
    (c.validIntervals ?? 0) < MIN_INTERVALS_FOR_SUMMARY ||
    c.shortestCycle.value === null ||
    c.longestCycle.value === null
  ) {
    return [];
  }
  return [
    insight('cycle', 'range', {
      titleKey: 'insights.cycle.range.title',
      messageKey: 'insights.cycle.range.message',
      params: { min: c.shortestCycle.value, max: c.longestCycle.value },
      evidence: [
        { metric: 'cycleLengthMin', value: c.shortestCycle.value },
        { metric: 'cycleLengthMax', value: c.longestCycle.value },
      ],
    }),
  ];
}

/**
 * Most-recent cycle observation. When an average is available, the more
 * informative recent-vs-average observation is emitted instead of the bare
 * "recent was X days" one, so we never show two insights about the same fact.
 */
export function recentCycleInsight(a: HealthAnalytics): PersonalInsight[] {
  const c = a.cycle;
  if (
    c.sufficiency !== 'available' ||
    c.validIntervals === null ||
    c.mostRecentCycleLength.value === null
  ) {
    return [];
  }
  if (c.averageCycleLength.value !== null) {
    return [
      insight('cycle', 'recentVsAverage', {
        titleKey: 'insights.cycle.recentVsAverage.title',
        messageKey: 'insights.cycle.recentVsAverage.message',
        params: {
          recent: c.mostRecentCycleLength.value,
          average: c.averageCycleLength.value,
        },
        evidence: [
          { metric: 'recentCycleLength', value: c.mostRecentCycleLength.value },
          { metric: 'averageCycleLength', value: c.averageCycleLength.value },
        ],
      }),
    ];
  }
  return [
    insight('cycle', 'recent', {
      titleKey: 'insights.cycle.recent.title',
      messageKey: 'insights.cycle.recent.message',
      params: { days: c.mostRecentCycleLength.value },
      evidence: [
        { metric: 'recentCycleLength', value: c.mostRecentCycleLength.value },
      ],
    }),
  ];
}

const VARIABILITY_MESSAGE_KEY: Record<VariabilityCategory, string> = {
  stable: 'insights.cycle.variability.stable',
  moderate: 'insights.cycle.variability.moderate',
  variable: 'insights.cycle.variability.variable',
  insufficient_data: 'insights.cycle.variability.insufficient',
};

/**
 * Cycle variability observation, presented as a neutral description of the
 * recorded spread — never translated into a medical label.
 */
export function cycleVariabilityInsight(
  a: HealthAnalytics
): PersonalInsight[] {
  const v = a.cycle.variability;
  if (v.category === 'insufficient_data' || v.sampleSize < 2) return [];
  return [
    insight('cycle', `variability.${v.category}`, {
      titleKey: 'insights.cycle.variability.title',
      messageKey: VARIABILITY_MESSAGE_KEY[v.category],
      params: { std: v.standardDeviation },
      evidence: [
        { metric: 'cycleVariabilityCategory', value: v.category },
        { metric: 'cycleStdDeviation', value: v.standardDeviation },
        { metric: 'cycleSampleSize', value: v.sampleSize },
      ],
    }),
  ];
}

export function cycleRules(a: HealthAnalytics): PersonalInsight[] {
  return [
    ...cycleRangeInsight(a),
    ...recentCycleInsight(a),
    ...cycleVariabilityInsight(a),
  ];
}
