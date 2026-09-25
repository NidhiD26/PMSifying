import {
  analyzeCycles,
  extractCycleLengths,
} from '@/lib/cycle-engine';
import type { CycleDomainModel } from '@/types/health';
import type {
  AnalyticsValue,
  AnalyticsSufficiency,
  CycleStatistics,
  CycleTrendPoint,
} from './types';
import { analyticsValue, isValidIsoDate, daysBetween } from './internal';

function sortCycles(cycles: CycleDomainModel[]): CycleDomainModel[] {
  return cycles
    .filter((c) => isValidIsoDate(c.startDate))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function sufficiencyForCycleStats(cycles: CycleDomainModel[]): AnalyticsSufficiency {
  if (cycles.length === 0) return 'no_data';
  const intervals = extractCycleLengths(sortCycles(cycles));
  if (intervals.length < 2) return 'insufficient';
  return 'available';
}

/**
 * Cycle statistics built entirely on the deterministic Cycle Engine.
 * The engine already computes average/shortest/longest and prediction
 * availability; we reuse those rather than re-implementing the maths.
 */
export function analyzeCycleStatistics(
  cycles: CycleDomainModel[],
  opts?: { noDataMessageKey?: string }
): CycleStatistics {
  const sorted = sortCycles(cycles);
  const sufficiency = sufficiencyForCycleStats(sorted);
  const engine = analyzeCycles(sorted);
  const noDataKey = opts?.noDataMessageKey ?? 'analytics.noData';

  let averageLength: AnalyticsValue;
  let shortest: AnalyticsValue;
  let longest: AnalyticsValue;
  let mostRecent: AnalyticsValue;
  let validIntervals: number | null = null;

  if (sufficiency === 'available' && engine.stats) {
    validIntervals = engine.stats.sampleSize;
    averageLength = analyticsValue('available', engine.stats.averageCycleLength, null);
    shortest = analyticsValue('available', engine.stats.shortestCycle, null);
    longest = analyticsValue('available', engine.stats.longestCycle, null);
    const recent =
      engine.stats.cycleLengths[engine.stats.cycleLengths.length - 1];
    mostRecent = analyticsValue('available', recent, null);
  } else if (sufficiency === 'insufficient') {
    const messageKey = 'analytics.insufficientCycle';
    averageLength = analyticsValue('insufficient', null, messageKey);
    shortest = analyticsValue('insufficient', null, messageKey);
    longest = analyticsValue('insufficient', null, messageKey);
    mostRecent = analyticsValue('insufficient', null, messageKey);
  } else {
    averageLength = analyticsValue('no_data', null, noDataKey);
    shortest = analyticsValue('no_data', null, noDataKey);
    longest = analyticsValue('no_data', null, noDataKey);
    mostRecent = analyticsValue('no_data', null, noDataKey);
  }

  return {
    recordedCycles: sorted.length,
    validIntervals,
    averageCycleLength: averageLength,
    shortestCycle: shortest,
    longestCycle: longest,
    mostRecentCycleLength: mostRecent,
    predictionAvailable:
      engine.nextPeriod !== undefined &&
      engine.nextPeriod.status === 'predicted',
    variability: engine.variability,
    sufficiency,
  };
}

/**
 * Simple, explainable per-cycle trend: raw recorded cycle lengths over time.
 * Values are recorded intervals only; no smoothing or modelling.
 */
export function buildCycleTrend(cycles: CycleDomainModel[]): CycleTrendPoint[] {
  const sorted = sortCycles(cycles);
  const points: CycleTrendPoint[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const diff = daysBetween(sorted[i - 1].startDate, sorted[i].startDate);
    if (diff > 0) {
      points.push({ startDate: sorted[i].startDate, cycleLengthDays: diff });
    }
  }
  return points;
}
