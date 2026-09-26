/**
 * Local reminder records.
 *
 * Reminders are a purely local convenience feature. They hold no health
 * content — only "when should PMSify nudge me". The clinical meaning of a
 * reminder (e.g. which date a period is expected) is always recomputed at
 * delivery time from the deterministic cycle engine, never stored here.
 */

export type ReminderKind = 'periodExpectation' | 'dailyCheckIn';

export const REMINDER_KINDS: ReminderKind[] = ['periodExpectation', 'dailyCheckIn'];

export interface ReminderRecord {
  /** Primary key, also the reminder kind. One row per kind. */
  id: ReminderKind;
  isEnabled: boolean;
  /** Local 24-hour time of day, 'HH:MM'. */
  timeOfDay: string;
  /**
   * Days before the predicted event to notify. Only meaningful for
   * `periodExpectation`; 0 for `dailyCheckIn`.
   */
  leadDays: number;
  updatedAt: string;
}

export const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const MIN_LEAD_DAYS = 0;
export const MAX_LEAD_DAYS = 7;

/** Normalises 'H:mm' or 'HH:mm' to 'HH:mm'. Returns null when unparseable. */
export function normalizeTimeOfDay(value: string): string | null {
  const trimmed = value.trim();
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(trimmed);
  if (!match) return null;
  const hours = Number(match[1]);
  if (hours < 0 || hours > 23) return null;
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}

export function isValidLeadDays(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_LEAD_DAYS && value <= MAX_LEAD_DAYS;
}
