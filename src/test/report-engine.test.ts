import { describe, it, expect } from 'vitest';
import { composeReport } from '@/lib/reports/report-engine';
import { computeHealthAnalytics } from '@/lib/analytics';
import { getInsights } from '@/lib/insights';
import type { ReportData, ReportDateRange } from '@/lib/reports/types';
import type { CycleDomainModel, DailyLogDomainModel } from '@/types/health';

const TODAY = '2026-09-30';

function cycle(startDate: string, endDate?: string, flow?: CycleDomainModel['flow']): CycleDomainModel {
  return {
    startDate,
    ...(endDate ? { endDate } : {}),
    ...(flow ? { flow } : {}),
    createdAt: '',
    updatedAt: '',
  };
}

function log(date: string, data: {
  symptoms?: string[];
  mood?: string[];
  painLevel?: number;
  sleepHours?: number;
  hydrationMl?: number;
} = {}): DailyLogDomainModel {
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

function makeReport(
  cycles: CycleDomainModel[],
  dailyLogs: DailyLogDomainModel[],
  range?: ReportDateRange
): ReportData {
  const dateRange: ReportDateRange = range ?? { startDate: '0000-01-01', endDate: TODAY, key: 'all' };
  const analytics = computeHealthAnalytics({
    cycles,
    dailyLogs,
    today: TODAY,
    ...(dateRange.key !== 'all' ? { range: { startDate: dateRange.startDate, endDate: dateRange.endDate } } : {}),
  });
  const insights = getInsights({ analytics, recordedDates: dailyLogs.map((l) => l.date), limit: 10 });
  return composeReport({ analytics, insights, cycles, dateRange, today: TODAY });
}

describe('report engine — composeReport', () => {
  it('empty data produces valid report structure', () => {
    const report = makeReport([], []);
    expect(report.generatedAt).toBe(TODAY);
    expect(report.dateRange.key).toBe('all');
    expect(report.totalDailyLogs).toBe(0);
    expect(report.cycle.recordedCycles).toBe(0);
    expect(report.period.recordedPeriods).toBe(0);
    expect(report.symptoms.recordedDays).toBe(0);
    expect(report.mood.recordedDays).toBe(0);
    expect(report.pain.recordedDays).toBe(0);
    expect(report.sleep.recordedDays).toBe(0);
    expect(report.hydration.recordedDays).toBe(0);
    expect(report.insights).toHaveLength(0);
  });

  it('all-time range includes all cycles', () => {
    const c = [cycle('2026-01-01', '2026-01-05'), cycle('2026-02-01', '2026-02-05')];
    const report = makeReport(c, []);
    expect(report.cycle.cycles).toHaveLength(2);
    expect(report.cycle.recordedCycles).toBe(2);
  });

  it('90-day range filters daily logs correctly', () => {
    const logs = [
      log('2026-06-01', { painLevel: 3, sleepHours: 7, hydrationMl: 2000 }),
      log('2026-09-15', { painLevel: 5, sleepHours: 6, hydrationMl: 1500 }),
    ];
    const range: ReportDateRange = {
      startDate: '2026-07-01',
      endDate: TODAY,
      key: '90d',
    };
    const report = makeReport([], logs, range);
    expect(report.totalDailyLogs).toBe(1);
  });

  it('custom range with start > end is handled by swapping', () => {
    const logs = [log('2026-09-01', { painLevel: 2 })];
    const swappedRange: ReportDateRange = {
      startDate: '2026-09-01',
      endDate: TODAY,
      key: 'custom',
    };
    const report = makeReport([], logs, swappedRange);
    expect(report.totalDailyLogs).toBe(1);
  });

  it('cycle section reuses analytics — no 28-day assumption', () => {
    const c = [
      cycle('2026-01-01', '2026-01-05'),
      cycle('2026-02-10', '2026-02-15'),
      cycle('2026-03-20', '2026-03-25'),
    ];
    const report = makeReport(c, []);
    expect(report.cycle.recordedCycles).toBe(3);
    expect(report.cycle.averageCycleLength.sufficiency).toBe('available');
    expect(report.cycle.averageCycleLength.value).not.toBe(28);
  });

  it('insufficient cycle data is communicated', () => {
    const c = [cycle('2026-06-01', '2026-06-05')];
    const report = makeReport(c, []);
    expect(report.cycle.recordedCycles).toBe(1);
    expect(report.cycle.averageCycleLength.sufficiency).toBe('insufficient');
  });

  it('period section shows ongoing period correctly', () => {
    const c = [cycle('2026-09-20')];
    const report = makeReport(c, []);
    expect(report.period.ongoingPeriod).toBe(true);
  });

  it('period flow distribution is populated', () => {
    const c = [
      cycle('2026-01-01', '2026-01-05', 'heavy'),
      cycle('2026-02-01', '2026-02-05', 'light'),
      cycle('2026-03-01', '2026-03-05', 'heavy'),
    ];
    const report = makeReport(c, []);
    expect(report.period.flowDistribution.length).toBeGreaterThan(0);
  });

  it('symptom frequencies are included', () => {
    const logs = [
      log('2026-09-01', { symptoms: ['cramps', 'headache'] }),
      log('2026-09-02', { symptoms: ['cramps'] }),
    ];
    const report = makeReport([], logs);
    expect(report.symptoms.recordedDays).toBe(2);
    expect(report.symptoms.mostFrequent.length).toBeGreaterThan(0);
    expect(report.symptoms.mostFrequent[0].id).toBe('cramps');
    expect(report.symptoms.mostFrequent[0].count).toBe(2);
  });

  it('mood distribution is included', () => {
    const logs = [
      log('2026-09-01', { mood: ['calm'] }),
      log('2026-09-02', { mood: ['anxious'] }),
    ];
    const report = makeReport([], logs);
    expect(report.mood.recordedDays).toBe(2);
    expect(report.mood.mostFrequent.length).toBe(2);
  });

  it('pain statistics are included', () => {
    const logs = [
      log('2026-09-01', { painLevel: 3 }),
      log('2026-09-02', { painLevel: 7 }),
    ];
    const report = makeReport([], logs);
    expect(report.pain.recordedDays).toBe(2);
    expect(report.pain.average.value).toBe(5);
    expect(report.pain.highest.value).toBe(7);
    expect(report.pain.lowest.value).toBe(3);
  });

  it('sleep statistics are included', () => {
    const logs = [
      log('2026-09-01', { sleepHours: 6 }),
      log('2026-09-02', { sleepHours: 8 }),
    ];
    const report = makeReport([], logs);
    expect(report.sleep.recordedDays).toBe(2);
    expect(report.sleep.average.value).toBe(7);
  });

  it('hydration statistics are included', () => {
    const logs = [
      log('2026-09-01', { hydrationMl: 1500 }),
      log('2026-09-02', { hydrationMl: 2500 }),
    ];
    const report = makeReport([], logs);
    expect(report.hydration.recordedDays).toBe(2);
    expect(report.hydration.average.value).toBe(2000);
  });

  it('insights are passed through from insight engine', () => {
    const c = [
      cycle('2026-01-01', '2026-01-05'),
      cycle('2026-02-01', '2026-02-05'),
      cycle('2026-03-01', '2026-03-05'),
    ];
    const report = makeReport(c, []);
    expect(report.insights.length).toBeGreaterThan(0);
    expect(report.insights[0]).toHaveProperty('id');
    expect(report.insights[0]).toHaveProperty('category');
    expect(report.insights[0]).toHaveProperty('messageKey');
  });

  it('partial data — only symptoms, no cycles', () => {
    const logs = [log('2026-09-01', { symptoms: ['cramps'] })];
    const report = makeReport([], logs);
    expect(report.cycle.recordedCycles).toBe(0);
    expect(report.symptoms.recordedDays).toBe(1);
    expect(report.period.recordedPeriods).toBe(0);
  });

  it('insufficient daily data — one day only', () => {
    const logs = [log('2026-09-01', { painLevel: 5, sleepHours: 7 })];
    const report = makeReport([], logs);
    expect(report.pain.recordedDays).toBe(1);
    expect(report.sleep.recordedDays).toBe(1);
  });
});

describe('report engine — date range behavior', () => {
  it('all-time range captures full history', () => {
    const c = [
      cycle('2026-01-01', '2026-01-05'),
      cycle('2026-06-01', '2026-06-05'),
    ];
    const report = makeReport(c, []);
    expect(report.cycle.cycles).toHaveLength(2);
  });

  it('90-day range filters out old cycles', () => {
    const c = [
      cycle('2026-01-01', '2026-01-05'),
      cycle('2026-09-01', '2026-09-05'),
    ];
    const range: ReportDateRange = { startDate: '2026-07-01', endDate: TODAY, key: '90d' };
    const report = makeReport(c, [], range);
    expect(report.cycle.cycles).toHaveLength(1);
    expect(report.cycle.cycles[0].startDate).toBe('2026-09-01');
  });

  it('6-month range filters correctly', () => {
    const logs = [
      log('2026-01-01', { painLevel: 3 }),
      log('2026-08-01', { painLevel: 5 }),
    ];
    const range: ReportDateRange = { startDate: '2026-04-01', endDate: TODAY, key: '6m' };
    const report = makeReport([], logs, range);
    expect(report.pain.recordedDays).toBe(1);
  });
});
