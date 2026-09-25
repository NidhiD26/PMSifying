import type { CycleDomainModel, FlowLevel } from '@/types/health';
import type {
  AnalyticsValue,
  AnalyticsSufficiency,
  PeriodStatistics,
  PeriodTrendPoint,
} from './types';
import { analyticsValue, daysBetween, isValidIsoDate, mean } from './internal';

const FLOW_LEVELS: FlowLevel[] = ['spotting', 'light', 'medium', 'heavy'];

function sortCycles(cycles: CycleDomainModel[]): CycleDomainModel[] {
  return cycles
    .filter((c) => isValidIsoDate(c.startDate))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/**
 * Inclusive period duration (start..end), consistent with the period history
 * list shown to users (a same-day period counts as 1 day).
 */
function periodDurationDays(startDate: string, endDate: string): number {
  return daysBetween(startDate, endDate) + 1;
}

function sufficiencyForPeriods(completedCount: number): AnalyticsSufficiency {
  if (completedCount === 0) return 'no_data';
  if (completedCount < 2) return 'insufficient';
  return 'available';
}

export function analyzePeriodStatistics(
  cycles: CycleDomainModel[],
  opts?: { noDataMessageKey?: string; insufficientMessageKey?: string }
): PeriodStatistics {
  const sorted = sortCycles(cycles);
  const noDataKey = opts?.noDataMessageKey ?? 'analytics.noData';
  const insufficientKey = opts?.insufficientMessageKey ?? 'analytics.insufficientPeriod';

  const completed = sorted.filter(
    (c) =>
      c.endDate &&
      isValidIsoDate(c.endDate) &&
      c.endDate >= c.startDate
  );
  const durations = completed.map((c) =>
    periodDurationDays(c.startDate, c.endDate as string)
  );
  const sufficiency = sufficiencyForPeriods(completed.length);

  const last = sorted[sorted.length - 1];
  const ongoing =
    sorted.length > 0 &&
    !(last.endDate && isValidIsoDate(last.endDate) && last.endDate >= last.startDate);

  let average: AnalyticsValue;
  let shortest: AnalyticsValue;
  let longest: AnalyticsValue;
  let mostRecent: AnalyticsValue;

  if (sufficiency === 'available') {
    average = analyticsValue('available', mean(durations), null);
    shortest = analyticsValue('available', Math.min(...durations), null);
    longest = analyticsValue('available', Math.max(...durations), null);
    mostRecent = analyticsValue(
      'available',
      durations[durations.length - 1],
      null
    );
  } else if (sufficiency === 'insufficient') {
    average = analyticsValue('insufficient', null, insufficientKey);
    shortest = analyticsValue('insufficient', null, insufficientKey);
    longest = analyticsValue('insufficient', null, insufficientKey);
    mostRecent = analyticsValue('insufficient', null, insufficientKey);
  } else {
    average = analyticsValue('no_data', null, noDataKey);
    shortest = analyticsValue('no_data', null, noDataKey);
    longest = analyticsValue('no_data', null, noDataKey);
    mostRecent = analyticsValue('no_data', null, noDataKey);
  }

  const flowDistribution = FLOW_LEVELS.map((level) => ({
    level,
    count: sorted.filter((c) => c.flow === level).length,
  })).filter((d) => d.count > 0);

  return {
    recordedPeriods: sorted.length,
    completedPeriods: completed.length,
    ongoingPeriod: ongoing,
    averageDuration: average,
    shortestDuration: shortest,
    longestDuration: longest,
    mostRecentDuration: mostRecent,
    flowDistribution,
    sufficiency,
  };
}

/**
 * Simple per-period duration trend (completed periods only), in chronological
 * order. An ongoing period has no final duration and is excluded.
 */
export function buildPeriodTrend(cycles: CycleDomainModel[]): PeriodTrendPoint[] {
  const sorted = sortCycles(cycles);
  const points: PeriodTrendPoint[] = [];
  for (const c of sorted) {
    if (c.endDate && isValidIsoDate(c.endDate) && c.endDate >= c.startDate) {
      points.push({
        startDate: c.startDate,
        durationDays: periodDurationDays(c.startDate, c.endDate),
      });
    }
  }
  return points;
}
