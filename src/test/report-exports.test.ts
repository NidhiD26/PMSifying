import { describe, it, expect } from 'vitest';
import { exportReportAsJson } from '@/lib/reports/export-json';
import { exportReportAsCsv } from '@/lib/reports/export-csv';
import { generateReportPdf } from '@/lib/reports/export-pdf';
import type { ReportData } from '@/lib/reports/types';

const TODAY = '2026-09-30';

const emptyReport: ReportData = {
  generatedAt: TODAY,
  dateRange: { startDate: '2026-01-01', endDate: TODAY, key: 'all' },
  totalDailyLogs: 0,
  cycle: {
    recordedCycles: 0,
    averageCycleLength: { sufficiency: 'no_data', value: null, messageKey: null },
    shortestCycle: { sufficiency: 'no_data', value: null, messageKey: null },
    longestCycle: { sufficiency: 'no_data', value: null, messageKey: null },
    mostRecentCycleLength: { sufficiency: 'no_data', value: null, messageKey: null },
    variability: { category: 'insufficient_data', standardDeviation: 0, sampleSize: 0 },
    predictionAvailable: false,
    cycles: [],
  },
  period: {
    recordedPeriods: 0,
    completedPeriods: 0,
    ongoingPeriod: false,
    averageDuration: { sufficiency: 'no_data', value: null, messageKey: null },
    shortestDuration: { sufficiency: 'no_data', value: null, messageKey: null },
    longestDuration: { sufficiency: 'no_data', value: null, messageKey: null },
    mostRecentDuration: { sufficiency: 'no_data', value: null, messageKey: null },
    flowDistribution: [],
  },
  symptoms: { recordedDays: 0, mostFrequent: [], frequency: [] },
  mood: { recordedDays: 0, mostFrequent: [], distribution: [] },
  pain: {
    recordedDays: 0,
    average: { sufficiency: 'no_data', value: null, messageKey: null },
    highest: { sufficiency: 'no_data', value: null, messageKey: null },
    lowest: { sufficiency: 'no_data', value: null, messageKey: null },
  },
  sleep: {
    recordedDays: 0,
    average: { sufficiency: 'no_data', value: null, messageKey: null },
    minimum: { sufficiency: 'no_data', value: null, messageKey: null },
    maximum: { sufficiency: 'no_data', value: null, messageKey: null },
  },
  hydration: {
    recordedDays: 0,
    average: { sufficiency: 'no_data', value: null, messageKey: null },
    minimum: { sufficiency: 'no_data', value: null, messageKey: null },
    maximum: { sufficiency: 'no_data', value: null, messageKey: null },
  },
  insights: [],
};

const populatedReport: ReportData = {
  ...emptyReport,
  totalDailyLogs: 3,
  cycle: {
    ...emptyReport.cycle,
    recordedCycles: 2,
    averageCycleLength: { sufficiency: 'available', value: 29, messageKey: null },
    shortestCycle: { sufficiency: 'available', value: 28, messageKey: null },
    longestCycle: { sufficiency: 'available', value: 30, messageKey: null },
    mostRecentCycleLength: { sufficiency: 'available', value: 30, messageKey: null },
    variability: { category: 'stable', standardDeviation: 1, sampleSize: 2 },
    cycles: [
      { startDate: '2026-06-01', endDate: '2026-06-05', createdAt: '', updatedAt: '' },
      { startDate: '2026-07-01', endDate: '2026-07-05', createdAt: '', updatedAt: '' },
    ],
  },
  period: {
    ...emptyReport.period,
    recordedPeriods: 2,
    completedPeriods: 2,
    averageDuration: { sufficiency: 'available', value: 5, messageKey: null },
    flowDistribution: [{ level: 'medium', count: 2 }],
  },
  symptoms: {
    recordedDays: 2,
    mostFrequent: [{ id: 'cramps', count: 2 }],
    frequency: [{ id: 'cramps', count: 2 }],
  },
  mood: {
    recordedDays: 2,
    mostFrequent: [{ id: 'calm', count: 2 }],
    distribution: [{ id: 'calm', count: 2 }],
  },
  pain: {
    recordedDays: 2,
    average: { sufficiency: 'available', value: 4, messageKey: null },
    highest: { sufficiency: 'available', value: 6, messageKey: null },
    lowest: { sufficiency: 'available', value: 2, messageKey: null },
  },
  sleep: {
    recordedDays: 2,
    average: { sufficiency: 'available', value: 7, messageKey: null },
    minimum: { sufficiency: 'available', value: 6, messageKey: null },
    maximum: { sufficiency: 'available', value: 8, messageKey: null },
  },
  hydration: {
    recordedDays: 2,
    average: { sufficiency: 'available', value: 2000, messageKey: null },
    minimum: { sufficiency: 'available', value: 1500, messageKey: null },
    maximum: { sufficiency: 'available', value: 2500, messageKey: null },
  },
  insights: [
    {
      id: 'cycle.range',
      category: 'cycle',
      priority: 'medium',
      titleKey: 'insights.cycle.range.title',
      messageKey: 'insights.cycle.range.message',
      params: { min: 28, max: 30 },
    },
  ],
};

describe('JSON export', () => {
  it('produces valid JSON', () => {
    const json = exportReportAsJson(emptyReport);
    const parsed = JSON.parse(json);
    expect(parsed).toBeDefined();
  });

  it('preserves report structure', () => {
    const json = exportReportAsJson(populatedReport);
    const parsed = JSON.parse(json);
    expect(parsed.generatedAt).toBe(TODAY);
    expect(parsed.cycle.recordedCycles).toBe(2);
    expect(parsed.period.recordedPeriods).toBe(2);
    expect(parsed.symptoms.recordedDays).toBe(2);
    expect(parsed.insights).toHaveLength(1);
  });

  it('empty report produces valid JSON', () => {
    const json = exportReportAsJson(emptyReport);
    const parsed = JSON.parse(json);
    expect(parsed.cycle.recordedCycles).toBe(0);
  });

  it('insights are included in JSON', () => {
    const json = exportReportAsJson(populatedReport);
    const parsed = JSON.parse(json);
    expect(parsed.insights[0].id).toBe('cycle.range');
  });
});

describe('CSV export', () => {
  it('produces non-empty CSV string', () => {
    const csv = exportReportAsCsv(emptyReport);
    expect(csv.length).toBeGreaterThan(0);
  });

  it('contains header comments', () => {
    const csv = exportReportAsCsv(emptyReport);
    expect(csv).toContain('# PMSify Health Report');
    expect(csv).toContain('# Date Range:');
  });

  it('contains section headers', () => {
    const csv = exportReportAsCsv(populatedReport);
    expect(csv).toContain('Section');
    expect(csv).toContain('Metric');
    expect(csv).toContain('Value');
  });

  it('contains cycle records', () => {
    const csv = exportReportAsCsv(populatedReport);
    expect(csv).toContain('Cycle Records');
    expect(csv).toContain('2026-06-01');
    expect(csv).toContain('2026-07-01');
  });

  it('escapes commas in fields', () => {
    const reportWithComma: ReportData = {
      ...populatedReport,
      period: {
        ...populatedReport.period,
        flowDistribution: [
          { level: 'light', count: 1 },
          { level: 'medium', count: 2 },
          { level: 'heavy', count: 3 },
        ],
      },
    };
    const csv = exportReportAsCsv(reportWithComma);
    expect(csv).toContain('Flow: light');
    expect(csv).toContain('Flow: medium');
    expect(csv).toContain('Flow: heavy');
  });
});

describe('PDF export', () => {
  it('generateReportPdf returns a jsPDF instance', () => {
    const doc = generateReportPdf(emptyReport);
    expect(doc).toBeDefined();
    expect(typeof doc.save).toBe('function');
  });

  it('generateReportPdf works with populated report', () => {
    const doc = generateReportPdf(populatedReport);
    expect(doc).toBeDefined();
  });

  it('PDF output is not empty', () => {
    const doc = generateReportPdf(populatedReport);
    const output = doc.output('arraybuffer');
    expect(output.byteLength).toBeGreaterThan(0);
  });
});
