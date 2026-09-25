import type { CycleDomainModel, DailyLogDomainModel } from '@/types/health';
import type {
  AnalyticsDateRange,
  AnalyticsOptions,
  HealthAnalytics,
} from './types';
import { analyzeCycleStatistics, buildCycleTrend } from './cycle-analytics';
import { analyzePeriodStatistics, buildPeriodTrend } from './period-analytics';
import {
  analyzeSymptomStatistics,
  analyzeMoodStatistics,
  analyzePainStatistics,
  analyzeSleepStatistics,
  analyzeHydrationStatistics,
} from './daily-health-analytics';
import { isValidIsoDate } from './internal';

export interface AnalyticsEngineInput {
  cycles: CycleDomainModel[];
  dailyLogs: DailyLogDomainModel[];
  /** Optional range filter applied to daily health records. */
  range?: AnalyticsDateRange;
  /**
   * Explicit "today" as an ISO date. Required so analytics are deterministic
   * and testable; never resolved implicitly via new Date().
   */
  today: string;
  options?: Partial<AnalyticsOptions>;
}

const DEFAULT_OPTIONS: AnalyticsOptions = {
  recentWindowSize: 7,
  topCount: 5,
};

const OVERALL_NO_DATA = 'analytics.noData';

function withinRange(dateIso: string, range: AnalyticsDateRange): boolean {
  return dateIso >= range.startDate && dateIso <= range.endDate;
}

function effectiveRange(input: AnalyticsEngineInput): AnalyticsDateRange {
  if (
    input.range &&
    isValidIsoDate(input.range.startDate) &&
    isValidIsoDate(input.range.endDate)
  ) {
    return input.range;
  }
  const dates: string[] = [];
  for (const c of input.cycles) {
    if (isValidIsoDate(c.startDate)) dates.push(c.startDate);
  }
  for (const l of input.dailyLogs) {
    if (isValidIsoDate(l.date)) dates.push(l.date);
  }
  if (dates.length === 0) {
    return { startDate: input.today, endDate: input.today };
  }
  dates.sort();
  return { startDate: dates[0], endDate: dates[dates.length - 1] };
}

export function computeHealthAnalytics(
  input: AnalyticsEngineInput
): HealthAnalytics {
  const range = effectiveRange(input);
  const options: AnalyticsOptions = {
    ...DEFAULT_OPTIONS,
    ...input.options,
  };

  const rangeLogs = input.dailyLogs.filter((l) => withinRange(l.date, range));

  return {
    range,
    totalDailyLogs: rangeLogs.length,
    cycle: analyzeCycleStatistics(input.cycles, {
      noDataMessageKey: OVERALL_NO_DATA,
    }),
    period: analyzePeriodStatistics(input.cycles, {
      noDataMessageKey: OVERALL_NO_DATA,
    }),
    symptoms: analyzeSymptomStatistics(rangeLogs, {
      limit: options.topCount,
    }),
    mood: analyzeMoodStatistics(rangeLogs, { limit: options.topCount }),
    pain: analyzePainStatistics(rangeLogs, {
      recentWindowSize: options.recentWindowSize,
    }),
    sleep: analyzeSleepStatistics(rangeLogs, {
      recentWindowSize: options.recentWindowSize,
    }),
    hydration: analyzeHydrationStatistics(rangeLogs, {
      recentWindowSize: options.recentWindowSize,
    }),
    trends: {
      cycleLengths: buildCycleTrend(input.cycles),
      periodDurations: buildPeriodTrend(input.cycles),
    },
  };
}
