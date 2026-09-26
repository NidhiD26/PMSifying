import Dexie, { type EntityTable } from 'dexie';
import type { UserPreferencesRecord, CycleRecord, DailyLogRecord } from '@/types/db';
import type { ReminderRecord } from '@/types/reminders';

class PMSifyLocalDatabase extends Dexie {
  user_preferences!: EntityTable<UserPreferencesRecord, 'id'>;
  cycles!: EntityTable<CycleRecord, 'id'>;
  daily_logs!: EntityTable<DailyLogRecord, 'id'>;
  reminders!: EntityTable<ReminderRecord, 'id'>;

  constructor() {
    super('PMSify_Local_DB');
    
    // Schema Version 1 (Initial Setup)
    this.version(1).stores({
      user_preferences: 'id',
      cycles: '++id, startDate, endDate',
      daily_logs: '++id, date, painLevel',
    });

    // Schema Version 2 (Additive Indexes for Range & Unique Date Queries)
    this.version(2).stores({
      user_preferences: 'id',
      cycles: '++id, startDate, endDate, createdAt',
      daily_logs: '++id, &date, painLevel, sleepHours, hydrationMl, updatedAt',
    });

    // Schema Version 3 (Local reminder schedule)
    this.version(3).stores({
      user_preferences: 'id',
      cycles: '++id, startDate, endDate, createdAt',
      daily_logs: '++id, &date, painLevel, sleepHours, hydrationMl, updatedAt',
      reminders: 'id',
    });
  }
}

export const db = new PMSifyLocalDatabase();
