/**
 * Deterministic reminder scheduling.
 *
 * Pure functions only — no timers, no browser APIs, no current-time reads
 * inside the calculations. Callers pass `now` in. This keeps the schedule
 * testable and guarantees the "next reminder" shown in the UI is the same
 * value the delivery timer will act on.
 *
 * IMPORTANT: a period reminder is always derived from the cycle engine's
 * prediction. It is never stored and never estimated independently, so a
 * reminder can never disagree with the calendar or dashboard.
 */

import { formatLocalDateIso } from '@/lib/utils/date-utils';
import type { NextPeriodPrediction } from '@/lib/cycle-engine';
import type { ReminderKind, ReminderRecord } from '@/types/reminders';

export type ReminderScheduleStatus =
  /** A future occurrence could be computed. */
  | 'scheduled'
  /** No deterministic prediction exists yet, so nothing to schedule against. */
  | 'no_prediction'
  /** The computed time has already passed; nothing further will fire. */
  | 'already_passed'
  /** The reminder is switched off. */
  | 'disabled';

export interface ReminderSchedule {
  kind: ReminderKind;
  status: ReminderScheduleStatus;
  /** 'YYYY-MM-DD' of the next occurrence. Absent unless `scheduled`. */
  date?: string;
  /** 'HH:MM' local time of the next occurrence. Absent unless `scheduled`. */
  time?: string;
  /** 'YYYY-MM-DDTHH:MM', lexicographically comparable local datetime. */
  at?: string;
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return formatLocalDateIso(dt);
}

function localDateTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatLocalDateIso(date)}T${hours}:${minutes}`;
}

function build(date: string, time: string): { date: string; time: string; at: string } {
  return { date, time, at: `${date}T${time}` };
}

/**
 * The next strictly-future occurrence of a daily clock time.
 * Seconds are ignored: a time equal to the current minute counts as passed.
 */
export function nextDailyOccurrence(timeOfDay: string, now: Date): {
  date: string;
  time: string;
  at: string;
} {
  const today = formatLocalDateIso(now);
  const nowAt = localDateTime(now);
  const todayCandidate = `${today}T${timeOfDay}`;
  return todayCandidate > nowAt
    ? build(today, timeOfDay)
    : build(addDays(today, 1), timeOfDay);
}

/**
 * Resolves when a reminder would next fire.
 *
 * `prediction` is only consulted for `periodExpectation`; passing `undefined`
 * yields `no_prediction` rather than a guess.
 */
export function resolveReminderSchedule(
  reminder: Pick<ReminderRecord, 'id' | 'isEnabled' | 'timeOfDay' | 'leadDays'>,
  now: Date,
  prediction?: Pick<NextPeriodPrediction, 'status' | 'estimatedStartDate'>
): ReminderSchedule {
  if (!reminder.isEnabled) {
    return { kind: reminder.id, status: 'disabled' };
  }

  if (reminder.id === 'dailyCheckIn') {
    return { kind: reminder.id, status: 'scheduled', ...nextDailyOccurrence(reminder.timeOfDay, now) };
  }

  if (!prediction || prediction.status !== 'predicted' || !prediction.estimatedStartDate) {
    return { kind: reminder.id, status: 'no_prediction' };
  }

  const leadDate = addDays(prediction.estimatedStartDate, -reminder.leadDays);
  const occurrence = build(leadDate, reminder.timeOfDay);

  if (occurrence.at <= localDateTime(now)) {
    return { kind: reminder.id, status: 'already_passed' };
  }

  return { kind: reminder.id, status: 'scheduled', ...occurrence };
}
