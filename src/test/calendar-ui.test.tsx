import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { db } from '../lib/db/dexie-db';
import { CycleRepository } from '../lib/db/repositories/cycle-repository';
import { DailyLogRepository } from '../lib/db/repositories/daily-log-repository';
import { CalendarView } from '../features/calendar/calendar-view';
import { formatLocalDateIso } from '../lib/utils/date-utils';

const messages = {
  common: {
    offlineMode: 'Offline Mode Active',
    loading: 'Loading...',
    edit: 'Edit',
    cancel: 'Cancel',
  },
  privacy: {
    localDexieVault: 'Stored only on this device',
  },
  period: {
    startDate: 'Start date',
    endDate: 'End date',
    flow: 'Flow',
    flowLight: 'Light',
    flowMedium: 'Medium',
    flowHeavy: 'Heavy',
    flowSpotting: 'Spotting',
    notes: 'Notes',
  },
  periodLogging: {
    title: 'Log Period',
  },
  calendar: {
    title: 'Calendar',
    subtitle: 'Your cycles and daily records on one grid.',
    offlineGuarantee: 'All records stay on this device.',
    today: 'Today',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    weekdays: {
      sun: 'Sun',
      mon: 'Mon',
      tue: 'Tue',
      wed: 'Wed',
      thu: 'Thu',
      fri: 'Fri',
      sat: 'Sat',
    },
    legendPeriod: 'Recorded period',
    legendToday: 'Today',
    legendSelected: 'Selected day',
    recordedPeriod: 'Recorded period',
    periodStarted: 'Period started',
    periodEnded: 'Period ended',
    ongoingPeriod: 'Ongoing period',
    dailyLogRecorded: 'Daily health logged',
    cycleDay: 'Cycle day {day}',
    beforeFirstRecord: 'Before your first recorded period',
    futureDateHint: 'This date has not happened yet.',
    noRecordHint: 'Nothing is recorded for this date.',
    logPeriodForDate: 'Log Period for This Day',
    logHealthForDate: 'Log health for this day',
  },
};

vi.mock('next-intl', () => {
  const getMessage =
    (namespace: string) =>
    (key: string, params?: Record<string, unknown>) => {
      let node: unknown = (messages as Record<string, unknown>)[namespace];
      for (const part of key.split('.')) {
        node =
          node && typeof node === 'object'
            ? (node as Record<string, unknown>)[part]
            : undefined;
      }
      let raw = typeof node === 'string' ? node : key;
      if (params) {
        for (const [name, val] of Object.entries(params)) {
          raw = raw.split(`{${name}}`).join(String(val));
        }
      }
      return raw;
    };
  return {
    useTranslations: (namespace: string) => getMessage(namespace),
    useLocale: () => 'en',
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

/** Local dates, so the assertions never depend on the runner's timezone. */
const daysAgo = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatLocalDateIso(d);
};

/**
 * Finds the cell for one date. A cell that is today, or part of a recorded
 * period, carries extra words in its label, so the date only has to be the
 * start of the name — never a prefix of a different day.
 */
const cellFor = (dateIso: string) =>
  screen.findByRole('gridcell', { name: new RegExp(`^${dateIso}(,|$)`) });

beforeEach(async () => {
  await db.cycles.clear();
  await db.daily_logs.clear();
  vi.restoreAllMocks();
});

describe('CalendarView UI', () => {
  it('renders the month grid with its weekday header and legend', async () => {
    render(<CalendarView />);

    expect(await screen.findByRole('grid')).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
    expect(screen.getByText('Recorded period')).toBeInTheDocument();
    expect(screen.getByText('Selected day')).toBeInTheDocument();
    // Every visible cell is a real date, and today is one of them.
    expect(await cellFor(daysAgo(0))).toBeInTheDocument();
  });

  it('marks the days of an open period and reports the cycle day for today', async () => {
    await CycleRepository.createCycle({ startDate: daysAgo(2) });

    render(<CalendarView />);

    const today = await cellFor(daysAgo(0));
    expect(today).toHaveAttribute('aria-selected', 'true');
    expect(today.getAttribute('aria-label')).toContain('Recorded period');
    expect(today).toHaveAttribute('aria-current', 'date');

    // Day three of the cycle, counted from the day it started.
    expect(screen.getByText('Cycle day 3')).toBeInTheDocument();
    expect(screen.getByText('Ongoing period')).toBeInTheDocument();
    // An open period has no end date to show.
    expect(screen.queryByText('End date')).not.toBeInTheDocument();
  });

  it('follows the selection to a day with no records', async () => {
    await CycleRepository.createCycle({ startDate: daysAgo(2) });

    render(<CalendarView />);

    const earlier = daysAgo(9);
    fireEvent.click(await cellFor(earlier));

    expect(await screen.findByText(earlier)).toBeInTheDocument();
    expect(screen.getByText('Before your first recorded period')).toBeInTheDocument();
    expect(screen.getByText('Nothing is recorded for this date.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Log health for this day/ })).toHaveAttribute(
      'href',
      `/health?date=${earlier}`
    );
  });

  it('shows a recorded daily log for the selected day', async () => {
    const date = daysAgo(1);
    await DailyLogRepository.upsertDailyLog({
      date,
      symptoms: [],
      mood: [],
      painLevel: 0,
      sleepHours: 7,
      hydrationMl: 2000,
    });

    render(<CalendarView />);
    fireEvent.click(await cellFor(date));

    expect(await screen.findByText('Daily health logged')).toBeInTheDocument();
  });

  it('offers the period modal for a day, labelled by what is already recorded', async () => {
    const start = daysAgo(3);
    await CycleRepository.createCycle({
      startDate: start,
      endDate: daysAgo(1),
      flow: 'medium',
    });

    render(<CalendarView />);

    fireEvent.click(await cellFor(start));
    expect(await screen.findByText('Period started')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('End date')).toBeInTheDocument();

    // The recorded start day is edited, not created again.
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Start date')).toBeInTheDocument();
  });
});
