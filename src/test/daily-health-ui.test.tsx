import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { db } from '../lib/db/dexie-db';
import { DailyLogRepository } from '../lib/db/repositories/daily-log-repository';
import { DailyHealthPanel } from '../features/daily-health/daily-health-panel';

const messages = {
  common: {
    loading: 'Loading...',
    retry: 'Try Again',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    offlineMode: 'Offline Mode Active',
  },
  dailyHealth: {
    title: 'Daily Health Log',
    subtitle: 'Recording daily health',
    dateLabel: 'Date',
    symptomsLabel: 'Symptoms',
    symptomsHelper: 'Select any',
    moodLabel: 'Mood',
    moodHelper: 'How you felt',
    painLabel: 'Pain Level',
    painHelper: '0-10',
    sleepLabel: 'Sleep (hours)',
    sleepHelper: 'e.g. 7.5',
    hydrationLabel: 'Water intake (ml)',
    hydrationHelper: 'e.g. 2000',
    notesLabel: 'Notes',
    notesHelper: 'Optional',
    noLogTitle: 'No health information recorded for this day',
    noLogDescription: 'Add a daily log',
    startLogging: 'Start Daily Log',
    logSavable: 'Save Daily Log',
    editingLabel: 'Editing existing log',
    editExisting: 'You are editing this existing log',
    deleteTitle: 'Delete Daily Health Log?',
    deleteMessage: 'This will permanently remove this health log.',
    deleteConfirm: 'Delete Health Log',
    saveSuccess: 'Daily log saved.',
    deleteSuccess: 'Daily log removed.',
    saveFailed: 'Could not save.',
    loadFailed: 'Could not load.',
    validation: {
      invalidSleep: 'Sleep must be between 0 and 24 hours.',
      invalidHydration: 'Hydration must be between 0 and 10000 ml.',
      invalidDate: 'Please choose a valid date.',
      futureDateDisallowed: 'Future health logs cannot be recorded ahead of time.',
    },
  },
};

const translatorCache = new Map<string, (key: string) => string>();

vi.mock('next-intl', () => {
  function getMessageFor(namespace: string) {
    const cached = translatorCache.get(namespace);
    if (cached) return cached;
    const table = (messages as Record<string, unknown>)[namespace] as Record<
      string,
      unknown
    >;
    const getMessage = (key: string): string => {
      if (typeof key === 'string' && key.includes('.')) {
        const [head, ...rest] = key.split('.');
        const headVal = table[head];
        if (headVal && typeof headVal === 'object') {
          return (headVal as Record<string, string>)[rest.join('.')] ?? key;
        }
      }
      const value = table[key];
      if (typeof value === 'string') return value;
      return key;
    };
    translatorCache.set(namespace, getMessage);
    return getMessage;
  }
  return {
    useTranslations: (namespace: string) => getMessageFor(namespace),
  };
});

describe('DailyHealthPanel UI', () => {
  beforeEach(async () => {
    await db.daily_logs.clear();
    vi.restoreAllMocks();
  });

  it('shows empty state when no log exists for the date', async () => {
    render(<DailyHealthPanel initialDate="2026-09-01" />);
    await waitFor(() => {
      expect(
        screen.getByText('No health information recorded for this day')
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Start Daily Log')).toBeInTheDocument();
  });

  it('starts logging and reveals the form', async () => {
    render(<DailyHealthPanel initialDate="2026-09-01" />);
    const startButton = await screen.findByText('Start Daily Log');
    fireEvent.click(startButton);
    expect(screen.getByText('Symptoms')).toBeInTheDocument();
    expect(screen.getByText('Mood')).toBeInTheDocument();
    expect(screen.getByText('Save Daily Log')).toBeInTheDocument();
  });

  it('saves a new daily log and shows the editing state', async () => {
    render(<DailyHealthPanel initialDate="2026-09-01" />);
    const startButton = await screen.findByText('Start Daily Log');
    fireEvent.click(startButton);

    fireEvent.click(screen.getByText('Save Daily Log'));

    await waitFor(async () => {
      const records = await DailyLogRepository.getAllDailyLogs();
      expect(records.length).toBe(1);
    });

    expect(await screen.findByText('Editing existing log')).toBeInTheDocument();
  });

  it('loads an existing log for editing', async () => {
    await DailyLogRepository.upsertDailyLog({
      date: '2026-09-02',
      symptoms: [{ id: 'cramps' }],
      mood: [{ id: 'anxious' }],
      painLevel: 4,
      sleepHours: 6.5,
      hydrationMl: 1800,
      notes: 'Felt tired',
    });

    render(<DailyHealthPanel initialDate="2026-09-02" />);
    expect(await screen.findByText('Editing existing log')).toBeInTheDocument();
    expect(screen.getByText('Felt tired')).toBeInTheDocument();
  });

  it('shows a validation error for invalid sleep value', async () => {
    render(<DailyHealthPanel initialDate="2026-09-01" />);
    const startButton = await screen.findByText('Start Daily Log');
    fireEvent.click(startButton);

    const sleepInput = screen.getByLabelText('Sleep (hours)') as HTMLInputElement;
    fireEvent.change(sleepInput, { target: { value: '-2' } });

    fireEvent.click(screen.getByText('Save Daily Log'));

    expect(
      await screen.findByText('Sleep must be between 0 and 24 hours.')
    ).toBeInTheDocument();
  });

  it('shows a validation error for invalid hydration value', async () => {
    render(<DailyHealthPanel initialDate="2026-09-01" />);
    const startButton = await screen.findByText('Start Daily Log');
    fireEvent.click(startButton);

    const hydrationInput = screen.getByLabelText(
      'Water intake (ml)'
    ) as HTMLInputElement;
    fireEvent.change(hydrationInput, { target: { value: '50000' } });

    fireEvent.click(screen.getByText('Save Daily Log'));

    expect(
      await screen.findByText('Hydration must be between 0 and 10000 ml.')
    ).toBeInTheDocument();
  });

  it('shows a delete confirmation and deletes the log', async () => {
    await DailyLogRepository.upsertDailyLog({
      date: '2026-09-03',
      symptoms: [{ id: 'cramps' }],
      mood: [{ id: 'calm' }],
      painLevel: 2,
      sleepHours: 8,
      hydrationMl: 2200,
      notes: '',
    });

    render(<DailyHealthPanel initialDate="2026-09-03" />);
    expect(await screen.findByText('Editing existing log')).toBeInTheDocument();

    const deleteButton = screen.getByText('Delete');
    fireEvent.click(deleteButton);

    expect(screen.getByText('Delete Daily Health Log?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Delete Health Log'));

    await waitFor(async () => {
      const records = await DailyLogRepository.getAllDailyLogs();
      expect(records.length).toBe(0);
    });

    expect(
      await screen.findByText('No health information recorded for this day')
    ).toBeInTheDocument();
  });
});
