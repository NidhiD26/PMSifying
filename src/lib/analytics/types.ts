import type { FlowLevel } from '@/types/health';
import type { CycleVariability } from '@/lib/cycle-engine';

/**
 * A bounded, inclusive ISO date range [startDate, endDate].
 * Dates are YYYY-MM-DD strings. endDate >= startDate.
 */
export interface AnalyticsDateRange {
  startDate: string;
  endDate: string;
}

/**
 * Distinguishes how much confidence we can place in a statistic.
 * - no_data        : nothing recorded at all
 * - insufficient   : some data, but not enough for a meaningful value
 * - available      : a real computed value is present
 */
export type AnalyticsSufficiency =
  | 'no_data'
  | 'insufficient'
  | 'available';

/**
 * A typed scalar result that never hides "unavailable" behind 0.
 */
export interface AnalyticsValue {
  sufficiency: AnalyticsSufficiency;
  value: number | null;
  /** Human-meaningful reason shown when not available (i18n key). */
  messageKey: string | null;
}

export interface CycleStatistics {
  recordedCycles: number;
  validIntervals: number | null;
  /** null + sufficiency when fewer than 2 intervals exist. */
  averageCycleLength: AnalyticsValue;
  shortestCycle: AnalyticsValue;
  longestCycle: AnalyticsValue;
  mostRecentCycleLength: AnalyticsValue;
  /** true when the Cycle Engine can produce a next-period prediction. */
  predictionAvailable: boolean;
  /** Variability from the Cycle Engine (always present, even when insufficient). */
  variability: CycleVariability;
  sufficiency: AnalyticsSufficiency;
}

export interface PeriodStatistics {
  recordedPeriods: number;
  completedPeriods: number;
  ongoingPeriod: boolean;
  /** null when there are no completed (finalized) durations. */
  averageDuration: AnalyticsValue;
  shortestDuration: AnalyticsValue;
  longestDuration: AnalyticsValue;
  mostRecentDuration: AnalyticsValue;
  /** Flow level -> count of periods with that flow. Only populated with data. */
  flowDistribution: { level: FlowLevel; count: number }[];
  sufficiency: AnalyticsSufficiency;
}

export interface FrequencyStat {
  id: string;
  count: number;
}

export interface SymptomStatistics {
  recordedDays: number;
  totalCount: number;
  frequency: FrequencyStat[];
  /** most-frequent symptoms ordered desc, limited to `limit`. */
  mostFrequent: FrequencyStat[];
  /** Recent symptom occurrences (id -> dates), newest first. */
  recentOccurrences: Record<string, string[]>;
  sufficiency: AnalyticsSufficiency;
}

export interface MoodStatistics {
  recordedDays: number;
  totalCount: number;
  distribution: FrequencyStat[];
  mostFrequent: FrequencyStat[];
  sufficiency: AnalyticsSufficiency;
}

export interface PainStatistics {
  recordedDays: number;
  average: AnalyticsValue;
  highest: AnalyticsValue;
  lowest: AnalyticsValue;
  recentAverage: AnalyticsValue;
  /** day -> pain, ascending by date; empty when no data. */
  trend: { date: string; value: number }[];
  sufficiency: AnalyticsSufficiency;
}

export interface SleepStatistics {
  recordedDays: number;
  average: AnalyticsValue;
  minimum: AnalyticsValue;
  maximum: AnalyticsValue;
  recentAverage: AnalyticsValue;
  trend: { date: string; value: number }[];
  sufficiency: AnalyticsSufficiency;
}

export interface HydrationStatistics {
  recordedDays: number;
  average: AnalyticsValue;
  minimum: AnalyticsValue;
  maximum: AnalyticsValue;
  recentAverage: AnalyticsValue;
  trend: { date: string; value: number }[];
  sufficiency: AnalyticsSufficiency;
}

export interface CycleTrendPoint {
  /** Start date of the later cycle. */
  startDate: string;
  cycleLengthDays: number;
}

export interface PeriodTrendPoint {
  startDate: string;
  durationDays: number;
}

export interface Trends {
  cycleLengths: CycleTrendPoint[];
  periodDurations: PeriodTrendPoint[];
}

/**
 * Aggregate result produced by the analytics engine for a single repository
 * dataset and date range.
 */
export interface HealthAnalytics {
  range: AnalyticsDateRange;
  totalDailyLogs: number;
  cycle: CycleStatistics;
  period: PeriodStatistics;
  symptoms: SymptomStatistics;
  mood: MoodStatistics;
  pain: PainStatistics;
  sleep: SleepStatistics;
  hydration: HydrationStatistics;
  trends: Trends;
}

/**
 * How a "recent" window is defined for recent-average stats. Deterministic —
 * expressed entirely in the number of most-recent recorded days.
 */
export interface AnalyticsOptions {
  /** Number of most-recent recorded daily logs used for "recent" averages. */
  recentWindowSize: number;
  /** Maximum number of entries in a "most frequent" list. */
  topCount: number;
}
