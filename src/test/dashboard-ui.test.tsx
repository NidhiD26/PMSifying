import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { db } from '../lib/db/dexie-db';
import { CycleRepository } from '../lib/db/repositories/cycle-repository';
import { DailyLogRepository } from '../lib/db/repositories/daily-log-repository';
import { DashboardView } from '../features/dashboard/dashboard-view';

const messages = {
  common: {
    offlineMode: 'Offline Mode Active',
    loading: 'Loading...',
  },
  nav: {
    calendar: 'Calendar',
    health: 'Health Log',
    insights: 'Insights',
    reports: 'Reports',
  },
  privacy: {
    localDexieVault: 'Local Dexie Vault',
  },
  period: {
    logPeriod: 'Log Period',
    editPeriod: 'Edit Period Record',
    deletePeriod: 'Delete Record',
    startDate: 'Start Date',
    endDate: 'End Date (Optional)',
    flow: 'Flow Intensity (Optional)',
    flowSpotting: 'Spotting',
    flowLight: 'Light',
    flowMedium: 'Medium',
    flowHeavy: 'Heavy',
    notes: 'Private Notes (Optional)',
    saving: 'Saving Record...',
    validation: {
      startDateRequired: 'Period start date is required.',
      endDateBeforeStart: 'End date cannot be earlier than start date.',
      futureDateDisallowed: 'Future period dates cannot be logged ahead of time.',
    },
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
    'completeness.title': 'Recorded data',
    'completeness.message': 'You have recorded health information on {count} days in this period.',
  },
  dashboard: {
    title: 'Health Overview',
    subtitle: 'Your private cycle & daily health summary',
    currentStatus: 'Current Cycle Status',
    dayCount: 'Day {day}',
    phaseFollicular: 'Follicular Phase',
    phaseOvulatory: 'Ovulatory Window',
    phaseLuteal: 'Luteal Phase',
    phaseMenstrual: 'Menstrual Phase',
    nextPeriod: 'Next Period Prediction',
    fertileWindow: 'Estimated Fertile Window',
    ovulationDate: 'Estimated Ovulation',
    todayLog: "Today's Health Log",
    loggedToday: 'Recorded Today',
    notLoggedToday: 'Not recorded yet today',
    logTodayAction: "Log Today's Health",
    logPeriodAction: 'Log Period Date',
    recentInsights: 'Personal Observations',
    cycleSummary: 'Cycle Statistics',
    cycleSummaryValue: 'Average {days} days across {count} cycles',
    noCycleData: 'Log your period dates to view predicted cycles, fertile windows, and health statistics.',
    welcomeTitle: 'Welcome to PMSify',
    privacyFooter: '100% Offline & Private — Stored strictly on this device in local IndexedDB.',
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
    > | undefined;
    const getMessage = (
      key: string,
      params?: Record<string, unknown>
    ): string => {
      if (!table) return key;
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

import { formatLocalDateIso } from '../lib/utils/date-utils';

beforeEach(async () => {
  await db.cycles.clear();
  await db.daily_logs.clear();
  vi.restoreAllMocks();
});

describe('DashboardView UI', () => {
  it('renders welcome empty state when no cycles exist', async () => {
    render(<DashboardView />);
    expect(await screen.findByText('Health Overview')).toBeInTheDocument();
    expect(screen.getByText('Welcome to PMSify')).toBeInTheDocument();
    expect(screen.getAllByText("Log Period Date").length).toBeGreaterThanOrEqual(1);
  });

  it('renders current cycle day and predictions when cycle records exist', async () => {
    const today = formatLocalDateIso(new Date());
    await CycleRepository.createCycle({
      startDate: today,
      flow: 'medium',
    });

    render(<DashboardView />);
    expect(await screen.findByText('Health Overview')).toBeInTheDocument();
    expect(screen.getByText('Day 1')).toBeInTheDocument();
    expect(screen.getByText('Menstrual Phase')).toBeInTheDocument();
  });

  it('shows today log status as recorded when daily log exists', async () => {
    const today = formatLocalDateIso(new Date());
    await DailyLogRepository.upsertDailyLog({
      date: today,
      symptoms: [{ id: 'cramps' }],
      mood: [{ id: 'calm' }],
      painLevel: 2,
      sleepHours: 8,
      hydrationMl: 2000,
    });

    render(<DashboardView />);
    expect(await screen.findByText('Recorded Today')).toBeInTheDocument();
  });
});
