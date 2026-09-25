import { describe, it, expect } from 'vitest';
import {
  computeHealthAnalytics,
  analyzeCycleStatistics,
  analyzePeriodStatistics,
  analyzeSymptomStatistics,
  analyzeMoodStatistics,
  analyzePainStatistics,
  analyzeSleepStatistics,
  analyzeHydrationStatistics,
} from '@/lib/analytics';
import type { CycleDomainModel, DailyLogDomainModel } from '@/types/health';

const TODAY = '2026-09-30';

function cycle(
  startDate: string,
  endDate?: string,
  flow?: CycleDomainModel['flow']
): CycleDomainModel {
  return {
    startDate,
    ...(endDate ? { endDate } : {}),
    ...(flow ? { flow } : {}),
    createdAt: '',
    updatedAt: '',
  };
}

function log(
  date: string,
  data: {
    symptoms?: string[];
    mood?: string[];
    painLevel?: number;
    sleepHours?: number;
    hydrationMl?: number;
  } = {}
): DailyLogDomainModel {
  return {
    date,
    symptoms: (data.symptoms ?? []).map((id) => ({ id })),
    mood: (data.mood ?? []).map((id) => ({ id })),
    painLevel: data.painLevel ?? 0,
    sleepHours: data.sleepHours ?? 0,
    hydrationMl: data.hydrationMl ?? 0,
    createdAt: '',
    updatedAt: '',
  };
}

describe('analytics determinism', () => {
  it('produces identical output for identical input', () => {
    const input = {
      cycles: [
        cycle('2026-06-01', '2026-06-05', 'medium'),
        cycle('2026-07-02', '2026-07-06', 'light'),
        cycle('2026-08-03', '2026-08-08', 'heavy'),
      ],
      dailyLogs: [
        log('2026-08-05', { symptoms: ['cramps'], painLevel: 4, sleepHours: 7, hydrationMl: 2000 }),
        log('2026-08-06', { symptoms: ['headache'], painLevel: 3, sleepHours: 6, hydrationMl: 1500 }),
      ],
      today: TODAY,
    };
    const a = computeHealthAnalytics(input);
    const b = computeHealthAnalytics(input);
    expect(a).toEqual(b);
  });
});

describe('cycle statistics', () => {
  it('no cycles -> no_data, null average', () => {
    const r = analyzeCycleStatistics([]);
    expect(r.recordedCycles).toBe(0);
    expect(r.sufficiency).toBe('no_data');
    expect(r.averageCycleLength.value).toBeNull();
    expect(r.averageCycleLength.sufficiency).toBe('no_data');
    expect(r.predictionAvailable).toBe(false);
  });

  it('one cycle -> insufficient (needs 2 intervals)', () => {
    const r = analyzeCycleStatistics([cycle('2026-06-01', '2026-06-05')]);
    expect(r.recordedCycles).toBe(1);
    expect(r.sufficiency).toBe('insufficient');
    expect(r.averageCycleLength.value).toBeNull();
    expect(r.validIntervals).toBeNull();
  });

  it('multiple regular cycles -> correct average/shortest/longest/recent', () => {
    // intervals: 28, 30, 32 -> avg 30, shortest 28, longest 32, recent 32
    const cycles = [
      cycle('2026-06-01', '2026-06-05'),
      cycle('2026-06-29', '2026-07-03'),
      cycle('2026-07-29', '2026-08-02'),
      cycle('2026-08-30', '2026-09-03'),
    ];
    const r = analyzeCycleStatistics(cycles);
    expect(r.recordedCycles).toBe(4);
    expect(r.validIntervals).toBe(3);
    expect(r.sufficiency).toBe('available');
    expect(r.averageCycleLength.value).toBe(30);
    expect(r.shortestCycle.value).toBe(28);
    expect(r.longestCycle.value).toBe(32);
    expect(r.mostRecentCycleLength.value).toBe(32);
    expect(r.predictionAvailable).toBe(true);
  });

  it('irregular intervals still compute correct min/max', () => {
    const cycles = [
      cycle('2026-01-01'),
      cycle('2026-02-10'), // 40
      cycle('2026-03-05'), // 23
      cycle('2026-03-20'), // 15
    ];
    const r = analyzeCycleStatistics(cycles);
    expect(r.shortestCycle.value).toBe(15);
    expect(r.longestCycle.value).toBe(40);
  });
});

describe('period statistics', () => {
  it('no periods -> no_data', () => {
    const r = analyzePeriodStatistics([]);
    expect(r.recordedPeriods).toBe(0);
    expect(r.sufficiency).toBe('no_data');
    expect(r.averageDuration.value).toBeNull();
    expect(r.ongoingPeriod).toBe(false);
  });

  it('one completed period -> insufficient for average', () => {
    const r = analyzePeriodStatistics([cycle('2026-06-01', '2026-06-05')]);
    expect(r.recordedPeriods).toBe(1);
    expect(r.completedPeriods).toBe(1);
    expect(r.sufficiency).toBe('insufficient');
    expect(r.averageDuration.value).toBeNull();
  });

  it('multiple completed periods -> average of inclusive durations', () => {
    // durations: 5, 6, 7 days (inclusive) -> avg 6
    const cycles = [
      cycle('2026-06-01', '2026-06-05'),
      cycle('2026-07-02', '2026-07-07'),
      cycle('2026-08-03', '2026-08-09'),
    ];
    const r = analyzePeriodStatistics(cycles);
    expect(r.completedPeriods).toBe(3);
    expect(r.averageDuration.value).toBe(6);
    expect(r.shortestDuration.value).toBe(5);
    expect(r.longestDuration.value).toBe(7);
    expect(r.mostRecentDuration.value).toBe(7);
  });

  it('ongoing period (no endDate) is not treated as completed duration', () => {
    const cycles = [
      cycle('2026-06-01', '2026-06-05'),
      cycle('2026-09-10'), // ongoing
    ];
    const r = analyzePeriodStatistics(cycles);
    expect(r.ongoingPeriod).toBe(true);
    expect(r.recordedPeriods).toBe(2);
    expect(r.completedPeriods).toBe(1);
  });

  it('reversed dates are excluded from completed durations', () => {
    const cycles = [cycle('2026-06-01', '2026-05-25')];
    const r = analyzePeriodStatistics(cycles);
    expect(r.completedPeriods).toBe(0);
    expect(r.sufficiency).toBe('no_data');
  });

  it('flow distribution counts only recorded flow levels', () => {
    const cycles = [
      cycle('2026-06-01', '2026-06-05', 'medium'),
      cycle('2026-07-01', '2026-07-05', 'light'),
      cycle('2026-08-01', '2026-08-05', 'medium'),
      cycle('2026-09-01', '2026-09-03'),
    ];
    const r = analyzePeriodStatistics(cycles);
    const byLevel: Record<string, number> = {};
    for (const d of r.flowDistribution) byLevel[d.level] = d.count;
    expect(byLevel['medium']).toBe(2);
    expect(byLevel['light']).toBe(1);
    expect(byLevel['spotting']).toBeUndefined();
  });
});

describe('symptom statistics', () => {
  it('no symptoms -> no_data', () => {
    const r = analyzeSymptomStatistics([log('2026-09-01')]);
    expect(r.recordedDays).toBe(0);
    expect(r.sufficiency).toBe('no_data');
  });

  it('repeated symptoms -> correct frequency and mostFrequent', () => {
    const logs = [
      log('2026-09-01', { symptoms: ['cramps', 'headache'] }),
      log('2026-09-02', { symptoms: ['cramps'] }),
      log('2026-09-03', { symptoms: ['headache', 'fatigue'] }),
      log('2026-09-04', { symptoms: ['cramps', 'fatigue'] }),
    ];
    const r = analyzeSymptomStatistics(logs);
    expect(r.recordedDays).toBe(4);
    expect(r.totalCount).toBe(7);
    const freq: Record<string, number> = {};
    for (const f of r.frequency) freq[f.id] = f.count;
    expect(freq['cramps']).toBe(3);
    expect(freq['headache']).toBe(2);
    expect(freq['fatigue']).toBe(2);
    expect(r.mostFrequent[0].id).toBe('cramps');
    expect(r.mostFrequent[0].count).toBe(3);
  });
});

describe('mood statistics', () => {
  it('no mood -> no_data', () => {
    const r = analyzeMoodStatistics([log('2026-09-01')]);
    expect(r.recordedDays).toBe(0);
  });

  it('distribution and most frequent', () => {
    const logs = [
      log('2026-09-01', { mood: ['calm'] }),
      log('2026-09-02', { mood: ['calm'] }),
      log('2026-09-03', { mood: ['anxious'] }),
      log('2026-09-04', { mood: ['happy'] }),
    ];
    const r = analyzeMoodStatistics(logs);
    const dist: Record<string, number> = {};
    for (const d of r.distribution) dist[d.id] = d.count;
    expect(dist['calm']).toBe(2);
    expect(dist['anxious']).toBe(1);
    expect(r.mostFrequent[0].id).toBe('calm');
  });
});

describe('pain statistics', () => {
  it('no daily logs -> no_data, null values', () => {
    const r = analyzePainStatistics([]);
    expect(r.recordedDays).toBe(0);
    expect(r.average.value).toBeNull();
    expect(r.highest.value).toBeNull();
  });

  it('zero pain is a valid lowest value', () => {
    const r = analyzePainStatistics([
      log('2026-09-01', { painLevel: 0 }),
      log('2026-09-02', { painLevel: 5 }),
    ]);
    expect(r.lowest.value).toBe(0);
    expect(r.highest.value).toBe(5);
  });

  it('average/highest/lowest over multiple values', () => {
    const r = analyzePainStatistics([
      log('2026-09-01', { painLevel: 2 }),
      log('2026-09-02', { painLevel: 6 }),
      log('2026-09-03', { painLevel: 4 }),
      log('2026-09-04', { painLevel: 8 }),
    ]);
    expect(r.recordedDays).toBe(4);
    expect(r.average.value).toBe(5);
    expect(r.highest.value).toBe(8);
    expect(r.lowest.value).toBe(2);
  });

  it('single value -> average insufficient but min/max available', () => {
    const r = analyzePainStatistics([log('2026-09-01', { painLevel: 4 })]);
    expect(r.average.sufficiency).toBe('insufficient');
    expect(r.average.value).toBeNull();
    expect(r.highest.value).toBe(4);
    expect(r.lowest.value).toBe(4);
  });

  it('recent average uses the last recentWindowSize days', () => {
    const r = analyzePainStatistics(
      [
        log('2026-09-01', { painLevel: 1 }),
        log('2026-09-02', { painLevel: 1 }),
        log('2026-09-03', { painLevel: 7 }),
        log('2026-09-04', { painLevel: 9 }),
      ],
      { recentWindowSize: 3 }
    );
    // last 3: 1,7,9 -> avg 17/3 = 5.666...
    expect(r.recentAverage.value).toBeCloseTo(5.666, 2);
  });
});

describe('sleep statistics', () => {
  it('no sleep data (all zeros) -> no_data', () => {
    const r = analyzeSleepStatistics([
      log('2026-09-01', { sleepHours: 0 }),
      log('2026-09-02', { sleepHours: 0 }),
    ]);
    expect(r.recordedDays).toBe(0);
    expect(r.average.value).toBeNull();
  });

  it('average/min/max over valid (non-zero) values', () => {
    const r = analyzeSleepStatistics([
      log('2026-09-01', { sleepHours: 7 }),
      log('2026-09-02', { sleepHours: 0 }), // untracked
      log('2026-09-03', { sleepHours: 6 }),
      log('2026-09-04', { sleepHours: 8 }),
    ]);
    expect(r.recordedDays).toBe(3);
    expect(r.average.value).toBe(7);
    expect(r.minimum.value).toBe(6);
    expect(r.maximum.value).toBe(8);
  });

  it('single valid value -> average insufficient min/max available', () => {
    const r = analyzeSleepStatistics([log('2026-09-01', { sleepHours: 7 })]);
    expect(r.average.sufficiency).toBe('insufficient');
    expect(r.minimum.value).toBe(7);
    expect(r.maximum.value).toBe(7);
  });
});

describe('hydration statistics', () => {
  it('no hydration -> no_data', () => {
    const r = analyzeHydrationStatistics([log('2026-09-01')]);
    expect(r.recordedDays).toBe(0);
  });

  it('average/min/max over valid values (ml)', () => {
    const r = analyzeHydrationStatistics([
      log('2026-09-01', { hydrationMl: 2000 }),
      log('2026-09-02', { hydrationMl: 1500 }),
      log('2026-09-03', { hydrationMl: 2500 }),
    ]);
    expect(r.recordedDays).toBe(3);
    expect(r.average.value).toBe(2000);
    expect(r.minimum.value).toBe(1500);
    expect(r.maximum.value).toBe(2500);
  });
});

describe('date range handling', () => {
  const dailyLogs = [
    log('2026-09-01', { symptoms: ['cramps'], painLevel: 3, sleepHours: 7, hydrationMl: 2000 }),
    log('2026-09-10', { symptoms: ['headache'], painLevel: 5 }),
    log('2026-09-20', { symptoms: ['fatigue'], painLevel: 2, sleepHours: 8 }),
    log('2026-09-29', { symptoms: ['nausea'], painLevel: 6 }),
  ];

  it('full dataset respects the full derived range', () => {
    const r = computeHealthAnalytics({
      cycles: [],
      dailyLogs,
      today: TODAY,
      range: { startDate: '2026-09-01', endDate: '2026-09-29' },
    });
    expect(r.totalDailyLogs).toBe(4);
    expect(r.range.startDate).toBe('2026-09-01');
    expect(r.range.endDate).toBe('2026-09-29');
  });

  it('restricted range filters daily logs and stats', () => {
    const r = computeHealthAnalytics({
      cycles: [],
      dailyLogs,
      today: TODAY,
      range: { startDate: '2026-09-10', endDate: '2026-09-20' },
    });
    expect(r.totalDailyLogs).toBe(2);
    // pain values 5 and 2
    expect(r.pain.average.value).toBe(3.5);
  });

  it('boundary dates are inclusive', () => {
    const r = computeHealthAnalytics({
      cycles: [],
      dailyLogs,
      today: TODAY,
      range: { startDate: '2026-09-01', endDate: '2026-09-01' },
    });
    expect(r.totalDailyLogs).toBe(1);
    expect(r.pain.average.sufficiency).toBe('insufficient');
  });

  it('empty range (no matching logs) -> no_data daily stats', () => {
    const r = computeHealthAnalytics({
      cycles: [],
      dailyLogs,
      today: TODAY,
      range: { startDate: '2025-01-01', endDate: '2025-01-31' },
    });
    expect(r.totalDailyLogs).toBe(0);
    expect(r.pain.sufficiency).toBe('no_data');
  });

  it('reversed range does not crash and yields no logs', () => {
    const r = computeHealthAnalytics({
      cycles: [],
      dailyLogs,
      today: TODAY,
      range: { startDate: '2026-09-29', endDate: '2026-09-01' },
    });
    expect(r.totalDailyLogs).toBe(0);
  });
});

describe('trends', () => {
  it('builds chronological cycle-length trend', () => {
    const cycles = [
      cycle('2026-06-01'),
      cycle('2026-06-30'),
      cycle('2026-07-29'),
    ];
    const r = computeHealthAnalytics({ cycles, dailyLogs: [], today: TODAY });
    expect(r.trends.cycleLengths).toEqual([
      { startDate: '2026-06-30', cycleLengthDays: 29 },
      { startDate: '2026-07-29', cycleLengthDays: 29 },
    ]);
  });

  it('builds period-duration trend from completed periods only', () => {
    const cycles = [
      cycle('2026-06-01', '2026-06-05'),
      cycle('2026-07-05', '2026-07-09'),
      cycle('2026-08-05'), // ongoing
    ];
    const r = computeHealthAnalytics({ cycles, dailyLogs: [], today: TODAY });
    expect(r.trends.periodDurations).toEqual([
      { startDate: '2026-06-01', durationDays: 5 },
      { startDate: '2026-07-05', durationDays: 5 },
    ]);
  });
});
