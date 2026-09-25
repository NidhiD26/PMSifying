import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { db } from '../lib/db/dexie-db';
import { CycleRepository } from '../lib/db/repositories/cycle-repository';
import { DailyLogRepository } from '../lib/db/repositories/daily-log-repository';
import { InsightsView } from '../features/analytics/insights-view';

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
  },
  period: {
    ongoing: 'Ongoing Period',
    flowSpotting: 'Spotting',
    flowLight: 'Light',
    flowMedium: 'Medium',
    flowHeavy: 'Heavy',
  },
  analytics: {
    title: 'Your Recorded Health',
    subtitle: 'Deterministic summaries of your private records.',
    rangeLabel: 'Time range',
    rangeAll: 'All time',
    rangeRecentDays: 'Recent {count} days',
    noData: 'No health records yet.',
    noCycleData: 'Log your period dates to see cycle statistics.',
    noDailyData: 'Log daily health entries to see statistics here.',
    insufficientCycle: 'Record another cycle to compare cycle lengths.',
    insufficientPeriod: 'Record another period to compare durations.',
    insufficientPain: 'Record pain on a few more days.',
    insufficientSleep: 'Record sleep on a few more days.',
    insufficientHydration: 'Record water intake on a few more days.',
    sectionCycle: 'Cycle',
    cycleRecordedCycles: 'Recorded cycles',
    cycleAverage: 'Average cycle',
    cycleShortest: 'Shortest',
    cycleLongest: 'Longest',
    cycleMostRecent: 'Most recent cycle',
    cyclePredictionAvailable: 'Next period prediction available',
    cyclePredictionUnavailable: 'Prediction needs more cycles',
    daysUnit: '{value} days',
    cycleTrendHeading: 'Cycle length over time',
    cycleTrendHint: 'Each entry is a recorded cycle length in days.',
    cycleTrendSeries: 'Cycle lengths, newest first',
    sectionPeriod: 'Period',
    periodRecorded: 'Recorded periods',
    periodAverage: 'Average duration',
    periodShortest: 'Shortest',
    periodLongest: 'Longest',
    periodMostRecent: 'Most recent duration',
    periodOngoing: 'Ongoing period',
    flowDistribution: 'Flow intensity',
    sectionDailyHealth: 'Daily health',
    sectionPain: 'Pain',
    painAverage: 'Average',
    painHighest: 'Highest',
    painLowest: 'Lowest',
    sectionSleep: 'Sleep',
    sleepAverage: 'Average',
    sleepMinimum: 'Minimum',
    sleepMaximum: 'Maximum',
    sectionHydration: 'Hydration',
    hydrationAverage: 'Average',
    hydrationMinimum: 'Minimum',
    hydrationMaximum: 'Maximum',
    sectionSymptoms: 'Symptoms',
    sectionMood: 'Mood',
    recordedOnDays: 'Recorded on {count} days',
    loading: 'Calculating your statistics…',
  },
  insights: {
    sectionTitle: 'Your insights',
    basedOn: 'Based on what you have recorded',
    empty: 'Log a few days to see personal insights here.',
    'cycle.range.title': 'Cycle range',
    'cycle.range.message': 'Your recorded cycles ranged from {min} to {max} days.',
    'cycle.recentVsAverage.title': 'Recent cycle',
    'cycle.recentVsAverage.message': 'Your most recent cycle was {recent} days, compared with an average of {average} days.',
    'cycle.recent.title': 'Recent cycle',
    'cycle.recent.message': 'Your most recent recorded cycle was {days} days.',
    'cycle.variability.title': 'Cycle variation',
    'cycle.variability.stable': 'Your recorded cycle lengths have varied within a narrow range.',
    'cycle.variability.moderate': 'Your recorded cycle lengths have shown moderate variation.',
    'cycle.variability.variable': 'Your recorded cycle lengths have shown wider variation.',
    'cycle.variability.insufficient': 'Record more cycles to describe how your cycle lengths vary.',
    'period.average.title': 'Period duration',
    'period.average.message': 'Your recorded periods have lasted an average of {avg} days.',
    'period.durationRange.title': 'Period duration',
    'period.durationRange.message': 'Your recorded period durations ranged from {min} to {max} days.',
    'period.flow.title': 'Flow',
    'period.flow.message': '{flow} was your most frequently recorded flow level.',
    'symptoms.mostFrequent.title': 'Symptoms',
    'symptoms.mostFrequent.message': '{symptom} was your most recorded symptom, on {count} days.',
    'symptoms.count.title': 'Symptoms',
    'symptoms.count.message': 'You recorded {symptom} on {count} days.',
    'mood.mostFrequent.title': 'Mood',
    'mood.mostFrequent.message': '{mood} was your most frequent mood, on {count} days.',
    'mood.count.title': 'Mood',
    'mood.count.message': 'You recorded {mood} on {count} days.',
    'pain.average.title': 'Pain',
    'pain.average.message': 'Your average recorded pain was {value} out of 10.',
    'pain.range.title': 'Pain',
    'pain.range.message': 'Your recorded pain ranged from {min} to {max} out of 10.',
    'sleep.average.title': 'Sleep',
    'sleep.average.message': 'Your average recorded sleep was {value} hours.',
    'sleep.range.title': 'Sleep',
    'sleep.range.message': 'Your recorded sleep ranged from {min} to {max} hours.',
    'hydration.average.title': 'Hydration',
    'hydration.average.message': 'Your average recorded hydration was {value} ml.',
    'hydration.recordedDays.title': 'Hydration',
    'hydration.recordedDays.message': 'You recorded hydration data on {days} days.',
    'completeness.title': 'Recorded data',
    'completeness.message': 'You have recorded health information on {count} days in this period.',
  },
};

const translatorCache = new Map<string, (key: string, params?: Record<string, unknown>) => string>();

vi.mock('next-intl', () => {
  function getMessageFor(namespace: string) {
    const cached = translatorCache.get(namespace);
    if (cached) return cached;
    const table = (messages as Record<string, unknown>)[namespace] as Record<
      string,
      unknown
    >;
    const getMessage = (
      key: string,
      params?: Record<string, unknown>
    ): string => {
      let raw: string;
      if (typeof key === 'string' && key.includes('.')) {
        const [head, ...rest] = key.split('.');
        const headVal = table[head];
        raw =
          headVal && typeof headVal === 'object'
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
  return {
    useTranslations: (namespace: string) => getMessageFor(namespace),
  };
});

beforeEach(async () => {
  await db.cycles.clear();
  await db.daily_logs.clear();
  vi.restoreAllMocks();
});

describe('InsightsView UI', () => {
  it('shows empty state when there are no records', async () => {
    render(<InsightsView />);
    expect(await screen.findByText('No health records yet.')).toBeInTheDocument();
  });

  it('renders cycle stats with sufficient data', async () => {
    await CycleRepository.createCycle({ startDate: '2026-06-01', endDate: '2026-06-05', flow: 'medium' });
    await CycleRepository.createCycle({ startDate: '2026-06-30', endDate: '2026-07-04', flow: 'light' });
    await CycleRepository.createCycle({ startDate: '2026-07-30', endDate: '2026-08-04', flow: 'medium' });

    render(<InsightsView />);
    expect(await screen.findByText('Recorded cycles')).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
    // cycle intervals: 29, 30 -> average 29.5
    expect(screen.getByText('29.5 days')).toBeInTheDocument();
    expect(screen.getAllByText('29 days').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('30 days').length).toBeGreaterThanOrEqual(1);
  });

  it('shows insufficient cycle guidance when only one cycle exists', async () => {
    await CycleRepository.createCycle({ startDate: '2026-06-01', endDate: '2026-06-05' });
    render(<InsightsView />);
    const elts = await screen.findAllByText(
      'Record another cycle to compare cycle lengths.'
    );
    expect(elts.length).toBeGreaterThanOrEqual(1);
  });

  it('renders symptoms and mood frequencies from daily logs', async () => {
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

    render(<InsightsView />);
    expect(await screen.findByText('Cramps')).toBeInTheDocument();
    expect(screen.getByText('Recorded on 2 days')).toBeInTheDocument();
    expect(screen.getByText('Headache')).toBeInTheDocument();
  });
});
