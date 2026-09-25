import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { db } from '../lib/db/dexie-db';
import { CycleRepository } from '../lib/db/repositories/cycle-repository';
import { DailyLogRepository } from '../lib/db/repositories/daily-log-repository';
import { ReportsView } from '../features/reports/reports-view';

const messages = {
  common: {
    offlineMode: 'Offline Mode Active',
    loading: 'Loading...',
  },
  dailyHealth: {
    symptomCramps: 'Cramps',
    symptomHeadache: 'Headache',
    moodCalm: 'Calm',
    moodAnxious: 'Anxious',
    flowSpotting: 'Spotting',
    flowLight: 'Light',
    flowMedium: 'Medium',
    flowHeavy: 'Heavy',
  },
  period: {
    ongoing: 'Ongoing Period',
  },
  reports: {
    title: 'Health Report',
    subtitle: 'A summary of your recorded health information.',
    dateRange: 'Date range',
    rangeAll: 'All time',
    range90d: 'Last 90 days',
    range6m: 'Last 6 months',
    rangeCustom: 'Custom',
    from: 'From',
    to: 'To',
    invalidRange: 'Start date must be before or equal to end date.',
    noData: 'No health data recorded yet.',
    noCycleData: 'No cycle data recorded for this period.',
    noPeriodData: 'No period data recorded for this period.',
    noSymptomData: 'No symptom data recorded for this period.',
    noMoodData: 'No mood data recorded for this period.',
    noPainData: 'No pain data recorded for this period.',
    noSleepData: 'No sleep data recorded for this period.',
    noHydrationData: 'No hydration data recorded for this period.',
    noInsights: 'No personalized insights available.',
    reportPeriod: 'Report period',
    sectionCycle: 'Cycle',
    cycleRecordedCycles: 'Recorded cycles',
    cycleAverage: 'Average cycle length',
    cycleShortest: 'Shortest cycle',
    cycleLongest: 'Longest cycle',
    cycleMostRecent: 'Most recent cycle',
    variability: 'Variability',
    predictionAvailable: 'Prediction available',
    sectionPeriod: 'Period',
    periodRecorded: 'Recorded periods',
    periodAverage: 'Average duration',
    periodShortest: 'Shortest duration',
    periodLongest: 'Longest duration',
    periodOngoing: 'Ongoing period',
    flowDistribution: 'Flow distribution',
    sectionSymptoms: 'Symptoms',
    sectionMood: 'Mood',
    sectionPain: 'Pain',
    sectionSleep: 'Sleep',
    sectionHydration: 'Hydration',
    sectionInsights: 'Personalized Insights',
    recordedDays: 'Recorded on {count} day(s).',
    recordedDaysLabel: 'Recorded days',
    daysCount: '{count} day(s)',
    daysValue: '{value} days',
    hoursValue: '{value} hours',
    mlValue: '{value} ml',
    painAverage: 'Average pain',
    painHighest: 'Highest pain',
    painLowest: 'Lowest pain',
    sleepAverage: 'Average sleep',
    sleepMinimum: 'Minimum sleep',
    sleepMaximum: 'Maximum sleep',
    hydrationAverage: 'Average hydration',
    hydrationMinimum: 'Minimum hydration',
    hydrationMaximum: 'Maximum hydration',
    insufficientData: 'Insufficient data',
    yes: 'Yes',
    no: 'No',
    exportActions: 'Export actions',
    exportPdf: 'Export PDF',
    exportCsv: 'Export CSV',
    exportJson: 'Export JSON',
    privacyNote: 'Generated locally. No data transmitted.',
  },
  insights: {
    sectionTitle: 'Your insights',
    basedOn: 'Based on recorded data',
    empty: 'No insights.',
    'cycle.range.title': 'Cycle range',
    'cycle.range.message': 'Cycles from {min} to {max} days.',
    'cycle.recentVsAverage.title': 'Recent cycle',
    'cycle.recentVsAverage.message': 'Recent: {recent} vs avg {average}.',
    'cycle.recent.title': 'Recent cycle',
    'cycle.recent.message': 'Recent: {days} days.',
    'cycle.variability.title': 'Cycle variation',
    'cycle.variability.stable': 'Stable.',
    'cycle.variability.moderate': 'Moderate.',
    'cycle.variability.variable': 'Variable.',
    'cycle.variability.insufficient': 'Need more data.',
    'period.average.title': 'Period',
    'period.average.message': 'Average {avg} days.',
    'period.durationRange.title': 'Period',
    'period.durationRange.message': 'Duration {min}-{max} days.',
    'period.flow.title': 'Flow',
    'period.flow.message': '{flow} was most frequent.',
    'symptoms.mostFrequent.title': 'Symptoms',
    'symptoms.mostFrequent.message': '{symptom} on {count} days.',
    'symptoms.count.title': 'Symptoms',
    'symptoms.count.message': 'Recorded {symptom} on {count} days.',
    'mood.mostFrequent.title': 'Mood',
    'mood.mostFrequent.message': '{mood} on {count} days.',
    'mood.count.title': 'Mood',
    'mood.count.message': 'Recorded {mood} on {count} days.',
    'pain.average.title': 'Pain',
    'pain.average.message': 'Average pain {value}.',
    'pain.range.title': 'Pain',
    'pain.range.message': 'Pain range {min}-{max}.',
    'sleep.average.title': 'Sleep',
    'sleep.average.message': 'Average sleep {value} hours.',
    'sleep.range.title': 'Sleep',
    'sleep.range.message': 'Sleep range {min}-{max} hours.',
    'hydration.average.title': 'Hydration',
    'hydration.average.message': 'Average {value} ml.',
    'hydration.recordedDays.title': 'Hydration',
    'hydration.recordedDays.message': 'Recorded on {days} days.',
    'completeness.title': 'Data completeness',
    'completeness.message': 'Recorded on {count} days.',
  },
};

const translatorCache = new Map<string, (key: string, params?: Record<string, unknown>) => string>();

vi.mock('next-intl', () => {
  function getMessageFor(namespace: string) {
    const cached = translatorCache.get(namespace);
    if (cached) return cached;
    const table = (messages as Record<string, unknown>)[namespace] as Record<string, unknown>;
    const getMessage = (key: string, params?: Record<string, unknown>): string => {
      let raw: string;
      if (typeof key === 'string' && key.includes('.')) {
        const [head, ...rest] = key.split('.');
        const headVal = table[head];
        raw = headVal && typeof headVal === 'object'
          ? ((headVal as Record<string, string>)[rest.join('.')] ?? key)
          : key;
      } else {
        const value = table[key];
        raw = typeof value === 'string' ? value : key;
      }
      if (params) {
        for (const [name, val] of Object.entries(params)) {
          raw = raw.split(`{${name}}`).join(String(val));
        }
      }
      return raw;
    };
    translatorCache.set(namespace, getMessage);
    return getMessage;
  }
  return { useTranslations: (namespace: string) => getMessageFor(namespace) };
});

beforeEach(async () => {
  await db.cycles.clear();
  await db.daily_logs.clear();
  translatorCache.clear();
  vi.restoreAllMocks();
});

describe('ReportsView UI', () => {
  it('shows empty state when there are no records', async () => {
    render(<ReportsView />);
    expect(await screen.findByText('No health data recorded yet.')).toBeInTheDocument();
  });

  it('renders report title', async () => {
    render(<ReportsView />);
    expect(await screen.findByText('Health Report')).toBeInTheDocument();
  });

  it('renders date range controls', async () => {
    render(<ReportsView />);
    expect(await screen.findByText('All time')).toBeInTheDocument();
    expect(screen.getByText('Last 90 days')).toBeInTheDocument();
    expect(screen.getByText('Last 6 months')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('renders export buttons when data exists', async () => {
    await CycleRepository.createCycle({ startDate: '2026-06-01', endDate: '2026-06-05', flow: 'medium' });
    await CycleRepository.createCycle({ startDate: '2026-07-01', endDate: '2026-07-05', flow: 'light' });
    await CycleRepository.createCycle({ startDate: '2026-08-01', endDate: '2026-08-05', flow: 'medium' });

    render(<ReportsView />);
    expect(await screen.findByText('Export PDF')).toBeInTheDocument();
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
    expect(screen.getByText('Export JSON')).toBeInTheDocument();
  });

  it('renders cycle section with data', async () => {
    await CycleRepository.createCycle({ startDate: '2026-06-01', endDate: '2026-06-05', flow: 'medium' });
    await CycleRepository.createCycle({ startDate: '2026-07-01', endDate: '2026-07-05', flow: 'light' });
    await CycleRepository.createCycle({ startDate: '2026-08-01', endDate: '2026-08-05', flow: 'medium' });

    render(<ReportsView />);
    expect(await screen.findByText('Cycle')).toBeInTheDocument();
    expect(screen.getByText('Recorded cycles')).toBeInTheDocument();
  });

  it('renders symptoms section with data', async () => {
    await DailyLogRepository.upsertDailyLog({
      date: '2026-09-01',
      symptoms: [{ id: 'cramps' }],
      mood: [{ id: 'calm' }],
      painLevel: 4,
      sleepHours: 7,
      hydrationMl: 2000,
    });
    await DailyLogRepository.upsertDailyLog({
      date: '2026-09-02',
      symptoms: [{ id: 'cramps' }, { id: 'headache' }],
      mood: [{ id: 'anxious' }],
      painLevel: 5,
      sleepHours: 6,
      hydrationMl: 1500,
    });

    render(<ReportsView />);
    expect(await screen.findByText('Symptoms')).toBeInTheDocument();
    expect(screen.getByText('Cramps')).toBeInTheDocument();
  });

  it('renders pain section with data', async () => {
    await DailyLogRepository.upsertDailyLog({
      date: '2026-09-01',
      symptoms: [],
      mood: [],
      painLevel: 4,
      sleepHours: 7,
      hydrationMl: 2000,
    });
    await DailyLogRepository.upsertDailyLog({
      date: '2026-09-02',
      symptoms: [],
      mood: [],
      painLevel: 6,
      sleepHours: 7,
      hydrationMl: 2000,
    });

    render(<ReportsView />);
    expect(await screen.findByText('Pain')).toBeInTheDocument();
    expect(screen.getByText('Average pain')).toBeInTheDocument();
  });

  it('has accessible export controls', async () => {
    await CycleRepository.createCycle({ startDate: '2026-06-01', endDate: '2026-06-05' });
    await CycleRepository.createCycle({ startDate: '2026-07-01', endDate: '2026-07-05' });
    await CycleRepository.createCycle({ startDate: '2026-08-01', endDate: '2026-08-05' });

    render(<ReportsView />);
    const group = await screen.findByRole('group', { name: 'Export actions' });
    expect(group).toBeInTheDocument();
  });

  it('has accessible date range controls', async () => {
    render(<ReportsView />);
    const group = await screen.findByRole('group', { name: 'Date range' });
    expect(group).toBeInTheDocument();
  });
});
