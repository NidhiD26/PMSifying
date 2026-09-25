import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/db/dexie-db';
import { DailyLogRepository } from '../lib/db/repositories/daily-log-repository';
import { RepositoryError } from '../types/health';

describe('DailyLogRepository (Local Health Log Isolation & Validation)', () => {
  beforeEach(async () => {
    await db.daily_logs.clear();
  });

  it('upserts, queries by date, and deletes daily health log entries', async () => {
    const logDate = '2026-09-01';

    // Create via Upsert
    const id = await DailyLogRepository.upsertDailyLog({
      date: logDate,
      symptoms: [{ id: 'cramps', intensity: 3 }, { id: 'headache', intensity: 2 }],
      mood: [{ id: 'calm', intensity: 4 }],
      painLevel: 4,
      sleepHours: 7.5,
      hydrationMl: 2500,
      notes: 'Hydrated well today',
    });
    expect(id).toBeDefined();

    // Query by Date
    const fetched = await DailyLogRepository.getDailyLogByDate(logDate);
    expect(fetched).toBeDefined();
    expect(fetched?.painLevel).toBe(4);
    expect(fetched?.symptoms.length).toBe(2);
    expect(fetched?.symptoms[0].id).toBe('cramps');

    // Update via Upsert (Same Date)
    await DailyLogRepository.upsertDailyLog({
      date: logDate,
      symptoms: [{ id: 'cramps', intensity: 1 }],
      mood: [{ id: 'energetic', intensity: 5 }],
      painLevel: 1,
      sleepHours: 8,
      hydrationMl: 3000,
    });

    const updated = await DailyLogRepository.getDailyLogByDate(logDate);
    expect(updated?.painLevel).toBe(1);
    expect(updated?.hydrationMl).toBe(3000);

    // Delete
    await DailyLogRepository.deleteDailyLogByDate(logDate);
    const deleted = await DailyLogRepository.getDailyLogByDate(logDate);
    expect(deleted).toBeUndefined();
  });

  it('queries daily logs within a specified date range', async () => {
    await DailyLogRepository.upsertDailyLog({
      date: '2026-09-01',
      symptoms: [],
      mood: [],
      painLevel: 2,
      sleepHours: 8,
      hydrationMl: 2000,
    });
    await DailyLogRepository.upsertDailyLog({
      date: '2026-09-03',
      symptoms: [],
      mood: [],
      painLevel: 5,
      sleepHours: 6,
      hydrationMl: 1500,
    });
    await DailyLogRepository.upsertDailyLog({
      date: '2026-09-05',
      symptoms: [],
      mood: [],
      painLevel: 1,
      sleepHours: 8,
      hydrationMl: 2200,
    });

    const range = await DailyLogRepository.getDailyLogsInRange('2026-09-01', '2026-09-04');
    expect(range.length).toBe(2);
    expect(range[0].date).toBe('2026-09-01');
    expect(range[1].date).toBe('2026-09-03');
  });

  it('enforces one log per date (upsert does not create duplicates)', async () => {
    await DailyLogRepository.upsertDailyLog({
      date: '2026-09-10',
      symptoms: [{ id: 'cramps' }],
      mood: [{ id: 'calm' }],
      painLevel: 2,
      sleepHours: 7,
      hydrationMl: 2000,
    });
    await DailyLogRepository.upsertDailyLog({
      date: '2026-09-10',
      symptoms: [{ id: 'headache' }],
      mood: [{ id: 'anxious' }],
      painLevel: 5,
      sleepHours: 6,
      hydrationMl: 1500,
    });

    const all = await DailyLogRepository.getAllDailyLogs();
    expect(all.length).toBe(1);
    expect(all[0].symptoms[0].id).toBe('headache'); // latest write wins
  });

  it('rejects invalid painLevel, sleepHours, and hydration values via Zod', async () => {
    // Pain level > 10
    await expect(
      DailyLogRepository.upsertDailyLog({
        date: '2026-09-01',
        symptoms: [],
        mood: [],
        painLevel: 12,
        sleepHours: 8,
        hydrationMl: 2000,
      })
    ).rejects.toThrow(RepositoryError);

    // Negative sleep hours
    await expect(
      DailyLogRepository.upsertDailyLog({
        date: '2026-09-01',
        symptoms: [],
        mood: [],
        painLevel: 5,
        sleepHours: -2,
        hydrationMl: 2000,
      })
    ).rejects.toThrow(RepositoryError);

    // Excessive hydration value
    await expect(
      DailyLogRepository.upsertDailyLog({
        date: '2026-09-01',
        symptoms: [],
        mood: [],
        painLevel: 5,
        sleepHours: 8,
        hydrationMl: 50000,
      })
    ).rejects.toThrow(RepositoryError);
  });
});
