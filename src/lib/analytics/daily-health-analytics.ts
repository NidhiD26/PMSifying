import type { DailyLogDomainModel } from '@/types/health';
import type {
  AnalyticsValue,
  HydrationStatistics,
  MoodStatistics,
  PainStatistics,
  FrequencyStat,
  SleepStatistics,
  SymptomStatistics,
} from './types';
import { analyticsValue, isValidIsoDate, mean } from './internal';

const NO_DATA_KEY = 'analytics.noData';

function sortLogs(logs: DailyLogDomainModel[]): DailyLogDomainModel[] {
  return logs
    .filter((l) => isValidIsoDate(l.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Numeric statistics with principled sufficiency:
 *  - average / recent average require >= 2 tracked days
 *  - min/max (and single factual min/max) require >= 1 tracked day
 * Never fabricates a 0 for missing data.
 */
function numericStat(
  values: number[],
  kind: 'average' | 'minmax',
  insufficientKey: string
): AnalyticsValue {
  if (values.length === 0) {
    return analyticsValue('no_data', null, NO_DATA_KEY);
  }
  if (kind === 'average' && values.length < 2) {
    return analyticsValue('insufficient', null, insufficientKey);
  }
  return analyticsValue('available', mean(values), null);
}

function buildFrequency(items: string[]): FrequencyStat[] {
  const counts = new Map<string, number>();
  for (const id of items) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);
}

function topCount(freq: FrequencyStat[], limit: number): FrequencyStat[] {
  return freq.slice(0, limit);
}

/**
 * A daily log is considered to have sleep data when sleepHours > 0.
 * The logging form stores 0 when the field is left blank, so 0 means
 * "not tracked" rather than a genuine all-nighter in practice.
 */
function hasSleep(log: DailyLogDomainModel): boolean {
  return typeof log.sleepHours === 'number' && log.sleepHours > 0;
}

/** Similar to sleep: 0ml from the form means "not tracked". */
function hasHydration(log: DailyLogDomainModel): boolean {
  return typeof log.hydrationMl === 'number' && log.hydrationMl > 0;
}

export function analyzeSymptomStatistics(
  logs: DailyLogDomainModel[],
  opts?: { limit?: number }
): SymptomStatistics {
  const sorted = sortLogs(logs);
  const dailyWithSymptoms = sorted.filter((l) => l.symptoms.length > 0);
  const allIds = dailyWithSymptoms.flatMap((l) => l.symptoms.map((s) => s.id));
  const frequency = buildFrequency(allIds);
  const limit = opts?.limit ?? 5;
  const recent: Record<string, string[]> = {};
  for (const log of sorted) {
    for (const s of log.symptoms) {
      (recent[s.id] ??= []).push(log.date);
    }
  }
  return {
    recordedDays: dailyWithSymptoms.length,
    totalCount: allIds.length,
    frequency,
    mostFrequent: topCount(frequency, limit),
    recentOccurrences: recent,
    sufficiency:
      dailyWithSymptoms.length === 0
        ? 'no_data'
        : 'available',
  };
}

export function analyzeMoodStatistics(
  logs: DailyLogDomainModel[],
  opts?: { limit?: number }
): MoodStatistics {
  const sorted = sortLogs(logs);
  const dailyWithMood = sorted.filter((l) => l.mood.length > 0);
  const allIds = dailyWithMood.flatMap((l) => l.mood.map((m) => m.id));
  const distribution = buildFrequency(allIds);
  const limit = opts?.limit ?? 5;
  return {
    recordedDays: dailyWithMood.length,
    totalCount: allIds.length,
    distribution,
    mostFrequent: topCount(distribution, limit),
    sufficiency: dailyWithMood.length === 0 ? 'no_data' : 'available',
  };
}

export function analyzePainStatistics(
  logs: DailyLogDomainModel[],
  opts?: { recentWindowSize?: number; insufficientKey?: string }
): PainStatistics {
  const sorted = sortLogs(logs);
  const insufficientKey =
    opts?.insufficientKey ?? 'analytics.insufficientPain';
  const recentSize = opts?.recentWindowSize ?? 7;

  // Every log carries a pain reading (0 = none), so all logs are pain-recorded.
  const values = sorted.map((l) => l.painLevel);
  const trend = sorted
    .filter((l) => typeof l.painLevel === 'number')
    .map((l) => ({ date: l.date, value: l.painLevel }));

  const mostRecent = trend.slice(-recentSize).map((p) => p.value);
  const recentValues = mostRecent.filter((v) => typeof v === 'number');

  return {
    recordedDays: values.length,
    average: numericStat(values, 'average', insufficientKey),
    highest: values.length === 0
      ? analyticsValue('no_data', null, NO_DATA_KEY)
      : analyticsValue('available', Math.max(...values), null),
    lowest: values.length === 0
      ? analyticsValue('no_data', null, NO_DATA_KEY)
      : analyticsValue('available', Math.min(...values), null),
    recentAverage: numericStat(recentValues, 'average', insufficientKey),
    trend,
    sufficiency: values.length === 0 ? 'no_data' : 'available',
  };
}

export function analyzeSleepStatistics(
  logs: DailyLogDomainModel[],
  opts?: { recentWindowSize?: number; insufficientKey?: string }
): SleepStatistics {
  const sorted = sortLogs(logs);
  const insufficientKey =
    opts?.insufficientKey ?? 'analytics.insufficientSleep';
  const recentSize = opts?.recentWindowSize ?? 7;

  const tracked = sorted.filter(hasSleep);
  const values = tracked.map((l) => l.sleepHours);
  const trend = tracked.map((l) => ({ date: l.date, value: l.sleepHours }));
  const recentValues = trend.slice(-recentSize).map((p) => p.value);

  return {
    recordedDays: tracked.length,
    average: numericStat(values, 'average', insufficientKey),
    minimum:
      values.length === 0
        ? analyticsValue('no_data', null, NO_DATA_KEY)
        : analyticsValue('available', Math.min(...values), null),
    maximum:
      values.length === 0
        ? analyticsValue('no_data', null, NO_DATA_KEY)
        : analyticsValue('available', Math.max(...values), null),
    recentAverage: numericStat(recentValues, 'average', insufficientKey),
    trend,
    sufficiency: tracked.length === 0 ? 'no_data' : 'available',
  };
}

export function analyzeHydrationStatistics(
  logs: DailyLogDomainModel[],
  opts?: { recentWindowSize?: number; insufficientKey?: string }
): HydrationStatistics {
  const sorted = sortLogs(logs);
  const insufficientKey =
    opts?.insufficientKey ?? 'analytics.insufficientHydration';
  const recentSize = opts?.recentWindowSize ?? 7;

  const tracked = sorted.filter(hasHydration);
  const values = tracked.map((l) => l.hydrationMl);
  const trend = tracked.map((l) => ({ date: l.date, value: l.hydrationMl }));
  const recentValues = trend.slice(-recentSize).map((p) => p.value);

  return {
    recordedDays: tracked.length,
    average: numericStat(values, 'average', insufficientKey),
    minimum:
      values.length === 0
        ? analyticsValue('no_data', null, NO_DATA_KEY)
        : analyticsValue('available', Math.min(...values), null),
    maximum:
      values.length === 0
        ? analyticsValue('no_data', null, NO_DATA_KEY)
        : analyticsValue('available', Math.max(...values), null),
    recentAverage: numericStat(recentValues, 'average', insufficientKey),
    trend,
    sufficiency: tracked.length === 0 ? 'no_data' : 'available',
  };
}
