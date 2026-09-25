import type {
  ReportData,
  ReportEngineInput,
} from './types';

/**
 * Composes a ReportData from pre-computed analytics and insights.
 * This is a pure function — no Dexie, no Supabase, no external dependencies.
 * It reuses the existing analytics/insights engines; it never recalculates.
 */
export function composeReport(input: ReportEngineInput): ReportData {
  const { analytics, insights, cycles, dateRange, today } = input;

  const filteredCycles = cycles.filter((c) => {
    if (!c.endDate) return c.startDate <= dateRange.endDate;
    return c.endDate >= dateRange.startDate && c.startDate <= dateRange.endDate;
  });

  return {
    generatedAt: today,
    dateRange,
    totalDailyLogs: analytics.totalDailyLogs,
    cycle: {
      recordedCycles: analytics.cycle.recordedCycles,
      averageCycleLength: analytics.cycle.averageCycleLength,
      shortestCycle: analytics.cycle.shortestCycle,
      longestCycle: analytics.cycle.longestCycle,
      mostRecentCycleLength: analytics.cycle.mostRecentCycleLength,
      variability: {
        category: analytics.cycle.variability.category,
        standardDeviation: analytics.cycle.variability.standardDeviation,
        sampleSize: analytics.cycle.variability.sampleSize,
      },
      predictionAvailable: analytics.cycle.predictionAvailable,
      cycles: filteredCycles,
    },
    period: {
      recordedPeriods: analytics.period.recordedPeriods,
      completedPeriods: analytics.period.completedPeriods,
      ongoingPeriod: analytics.period.ongoingPeriod,
      averageDuration: analytics.period.averageDuration,
      shortestDuration: analytics.period.shortestDuration,
      longestDuration: analytics.period.longestDuration,
      mostRecentDuration: analytics.period.mostRecentDuration,
      flowDistribution: analytics.period.flowDistribution,
    },
    symptoms: {
      recordedDays: analytics.symptoms.recordedDays,
      mostFrequent: analytics.symptoms.mostFrequent,
      frequency: analytics.symptoms.frequency,
    },
    mood: {
      recordedDays: analytics.mood.recordedDays,
      mostFrequent: analytics.mood.mostFrequent,
      distribution: analytics.mood.distribution,
    },
    pain: {
      recordedDays: analytics.pain.recordedDays,
      average: analytics.pain.average,
      highest: analytics.pain.highest,
      lowest: analytics.pain.lowest,
    },
    sleep: {
      recordedDays: analytics.sleep.recordedDays,
      average: analytics.sleep.average,
      minimum: analytics.sleep.minimum,
      maximum: analytics.sleep.maximum,
    },
    hydration: {
      recordedDays: analytics.hydration.recordedDays,
      average: analytics.hydration.average,
      minimum: analytics.hydration.minimum,
      maximum: analytics.hydration.maximum,
    },
    insights,
  };
}
