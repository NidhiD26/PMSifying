import { db } from '../dexie-db';
import { RepositoryError } from '@/types/health';
import {
  REMINDER_KINDS,
  isValidLeadDays,
  normalizeTimeOfDay,
  type ReminderKind,
  type ReminderRecord,
} from '@/types/reminders';

export const DEFAULT_REMINDER_TIME = '20:00';

const DEFAULT_BY_KIND: Record<ReminderKind, Omit<ReminderRecord, 'updatedAt'>> = {
  periodExpectation: { id: 'periodExpectation', isEnabled: false, timeOfDay: DEFAULT_REMINDER_TIME, leadDays: 2 },
  dailyCheckIn: { id: 'dailyCheckIn', isEnabled: false, timeOfDay: DEFAULT_REMINDER_TIME, leadDays: 0 },
};

function buildDefault(kind: ReminderKind): ReminderRecord {
  return { ...DEFAULT_BY_KIND[kind], updatedAt: new Date(0).toISOString() };
}

/**
 * Local reminder schedule storage.
 *
 * Reminders never contain health content, so validation here is about
 * schedule integrity only (a valid clock time and a bounded lead time).
 */
export const ReminderRepository = {
  async getAllReminders(): Promise<ReminderRecord[]> {
    try {
      const stored = await db.reminders.toArray();
      const byId = new Map(stored.map((r) => [r.id, r]));
      // Always return one row per known kind, in a stable order.
      return REMINDER_KINDS.map((kind) => byId.get(kind) ?? buildDefault(kind));
    } catch (err) {
      throw new RepositoryError(
        `Failed to retrieve reminders: ${(err as Error).message}`,
        'STORAGE_ERROR'
      );
    }
  },

  async getReminder(kind: ReminderKind): Promise<ReminderRecord> {
    try {
      const stored = await db.reminders.get(kind);
      return stored ?? buildDefault(kind);
    } catch (err) {
      throw new RepositoryError(
        `Failed to retrieve reminder ${kind}: ${(err as Error).message}`,
        'STORAGE_ERROR'
      );
    }
  },

  async upsertReminder(reminder: ReminderRecord): Promise<void> {
    const time = normalizeTimeOfDay(reminder.timeOfDay);
    if (!time) {
      throw new RepositoryError('Reminder time must be a valid HH:MM time of day.', 'VALIDATION_ERROR');
    }
    if (!isValidLeadDays(reminder.leadDays)) {
      throw new RepositoryError('Reminder lead days is out of range.', 'VALIDATION_ERROR');
    }

    const payload: ReminderRecord = {
      ...reminder,
      timeOfDay: time,
      updatedAt: new Date().toISOString(),
    };

    try {
      await db.reminders.put(payload);
    } catch (err) {
      throw new RepositoryError(
        `Failed to save reminder ${reminder.id}: ${(err as Error).message}`,
        'STORAGE_ERROR'
      );
    }
  },

  async setReminderEnabled(kind: ReminderKind, isEnabled: boolean): Promise<ReminderRecord> {
    const current = await this.getReminder(kind);
    const next: ReminderRecord = { ...current, isEnabled };
    await this.upsertReminder(next);
    return this.getReminder(kind);
  },

  async clearAllReminders(): Promise<void> {
    try {
      await db.reminders.clear();
    } catch (err) {
      throw new RepositoryError(
        `Failed to clear reminders: ${(err as Error).message}`,
        'STORAGE_ERROR'
      );
    }
  },
};
