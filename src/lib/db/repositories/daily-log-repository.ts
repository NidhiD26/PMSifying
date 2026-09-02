import { db } from '../dexie-db';
import { dailyLogSchema } from '@/lib/validation/health-schemas';
import { DailyLogDomainModel, RepositoryError } from '@/types/health';

export const DailyLogRepository = {
  async upsertDailyLog(log: Omit<DailyLogDomainModel, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date().toISOString();
    const existing = await this.getDailyLogByDate(log.date);

    const payload = {
      ...log,
      id: existing?.id,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    const validation = dailyLogSchema.safeParse(payload);
    if (!validation.success) {
      throw new RepositoryError(
        `Invalid daily log data: ${validation.error.errors.map((e) => e.message).join(', ')}`,
        'VALIDATION_ERROR'
      );
    }

    try {
      const id = await db.daily_logs.put(validation.data as DailyLogDomainModel);
      return id as number;
    } catch (err) {
      throw new RepositoryError(`Failed to save daily log: ${(err as Error).message}`, 'STORAGE_ERROR');
    }
  },

  async getDailyLogByDate(date: string): Promise<DailyLogDomainModel | undefined> {
    try {
      return await db.daily_logs.where('date').equals(date).first();
    } catch (err) {
      throw new RepositoryError(`Failed to retrieve daily log for ${date}: ${(err as Error).message}`, 'STORAGE_ERROR');
    }
  },

  async getDailyLogsInRange(startDate: string, endDate: string): Promise<DailyLogDomainModel[]> {
    if (endDate < startDate) {
      throw new RepositoryError('endDate cannot be before startDate in range query', 'VALIDATION_ERROR');
    }

    try {
      return await db.daily_logs
        .where('date')
        .between(startDate, endDate, true, true)
        .sortBy('date');
    } catch (err) {
      throw new RepositoryError(
        `Failed to retrieve daily logs between ${startDate} and ${endDate}: ${(err as Error).message}`,
        'STORAGE_ERROR'
      );
    }
  },

  async deleteDailyLogByDate(date: string): Promise<void> {
    try {
      await db.daily_logs.where('date').equals(date).delete();
    } catch (err) {
      throw new RepositoryError(`Failed to delete daily log for ${date}: ${(err as Error).message}`, 'STORAGE_ERROR');
    }
  },

  async getAllDailyLogs(): Promise<DailyLogDomainModel[]> {
    try {
      return await db.daily_logs.orderBy('date').toArray();
    } catch (err) {
      throw new RepositoryError(`Failed to retrieve all daily logs: ${(err as Error).message}`, 'STORAGE_ERROR');
    }
  },
};
