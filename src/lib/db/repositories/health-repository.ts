import { db } from '../dexie-db';
import type { CycleRecord, DailyLogRecord } from '@/types/db';

export const HealthRepository = {
  async getRecentCycles(limit = 12): Promise<CycleRecord[]> {
    try {
      return await db.cycles.orderBy('startDate').reverse().limit(limit).toArray();
    } catch {
      return [];
    }
  },

  async getDailyLogByDate(date: string): Promise<DailyLogRecord | undefined> {
    try {
      return await db.daily_logs.where('date').equals(date).first();
    } catch {
      return undefined;
    }
  },

  async clearAllLocalData(): Promise<void> {
    await db.user_preferences.clear();
    await db.cycles.clear();
    await db.daily_logs.clear();
    await db.reminders.clear();
  },

  /**
   * Factual record counts for the local database, used by the Settings screen
   * to tell the user what a wipe would actually remove.
   */
  async getLocalRecordCounts(): Promise<{ cycles: number; dailyLogs: number; reminders: number }> {
    try {
      const [cycles, dailyLogs, reminders] = await Promise.all([
        db.cycles.count(),
        db.daily_logs.count(),
        db.reminders.count(),
      ]);
      return { cycles, dailyLogs, reminders };
    } catch {
      return { cycles: 0, dailyLogs: 0, reminders: 0 };
    }
  },
};
