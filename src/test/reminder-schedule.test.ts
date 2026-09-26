import { describe, it, expect } from 'vitest';
import {
  nextDailyOccurrence,
  resolveReminderSchedule,
} from '../lib/reminders/schedule';
import type { ReminderKind } from '../types/reminders';

function at(isoLocal: string): Date {
  const [datePart, timePart] = isoLocal.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

const dailyCheckIn = {
  id: 'dailyCheckIn' as ReminderKind,
  isEnabled: true,
  timeOfDay: '20:00',
  leadDays: 0,
};

const periodExpectation = {
  id: 'periodExpectation' as ReminderKind,
  isEnabled: true,
  timeOfDay: '18:00',
  leadDays: 2,
};

const predicted = { status: 'predicted' as const, estimatedStartDate: '2026-03-10' };

describe('nextDailyOccurrence', () => {
  it('returns today when the time is still ahead', () => {
    const next = nextDailyOccurrence('20:00', at('2026-03-10T09:15'));
    expect(next).toEqual({ date: '2026-03-10', time: '20:00', at: '2026-03-10T20:00' });
  });

  it('rolls to tomorrow when the time has already passed', () => {
    const next = nextDailyOccurrence('20:00', at('2026-03-10T21:30'));
    expect(next).toEqual({ date: '2026-03-11', time: '20:00', at: '2026-03-11T20:00' });
  });

  it('treats the current minute as already passed, so it never re-fires', () => {
    const next = nextDailyOccurrence('20:00', at('2026-03-10T20:00'));
    expect(next.date).toBe('2026-03-11');
  });

  it('rolls across a month boundary', () => {
    const next = nextDailyOccurrence('08:00', at('2026-01-31T23:00'));
    expect(next.date).toBe('2026-02-01');
  });

  it('rolls across a year boundary', () => {
    const next = nextDailyOccurrence('08:00', at('2026-12-31T23:00'));
    expect(next.date).toBe('2027-01-01');
  });

  it('handles a leap day without skipping it', () => {
    const next = nextDailyOccurrence('08:00', at('2028-02-28T23:00'));
    expect(next.date).toBe('2028-02-29');
  });
});

describe('resolveReminderSchedule - daily check-in', () => {
  it('schedules from the clock alone, with no cycle prediction needed', () => {
    const schedule = resolveReminderSchedule(dailyCheckIn, at('2026-03-10T09:00'));
    expect(schedule).toEqual({
      kind: 'dailyCheckIn',
      status: 'scheduled',
      date: '2026-03-10',
      time: '20:00',
      at: '2026-03-10T20:00',
    });
  });

  it('ignores leadDays and any prediction', () => {
    const withLead = { ...dailyCheckIn, leadDays: 5 };
    const a = resolveReminderSchedule(withLead, at('2026-03-10T09:00'));
    const b = resolveReminderSchedule(withLead, at('2026-03-10T09:00'), predicted);
    expect(a).toEqual(b);
  });
});

describe('resolveReminderSchedule - period expectation', () => {
  it('fires leadDays before the estimated start date', () => {
    const schedule = resolveReminderSchedule(periodExpectation, at('2026-03-01T09:00'), predicted);
    expect(schedule).toEqual({
      kind: 'periodExpectation',
      status: 'scheduled',
      date: '2026-03-08',
      time: '18:00',
      at: '2026-03-08T18:00',
    });
  });

  it('honours a zero lead day as the period start date itself', () => {
    const schedule = resolveReminderSchedule(
      { ...periodExpectation, leadDays: 0 },
      at('2026-03-01T09:00'),
      predicted
    );
    expect(schedule.date).toBe('2026-03-10');
  });

  it('reports already_passed instead of scheduling in the past', () => {
    const schedule = resolveReminderSchedule(periodExpectation, at('2026-03-09T09:00'), predicted);
    expect(schedule.status).toBe('already_passed');
    expect(schedule.date).toBeUndefined();
  });

  it('treats the exact reminder minute as passed', () => {
    const schedule = resolveReminderSchedule(periodExpectation, at('2026-03-08T18:00'), predicted);
    expect(schedule.status).toBe('already_passed');
  });

  it('reports no_prediction when there is no prediction at all', () => {
    const schedule = resolveReminderSchedule(periodExpectation, at('2026-03-01T09:00'));
    expect(schedule).toEqual({ kind: 'periodExpectation', status: 'no_prediction' });
  });

  it('reports no_prediction rather than guessing when the engine is not confident', () => {
    for (const status of ['insufficient_data', 'invalid_input'] as const) {
      const schedule = resolveReminderSchedule(
        periodExpectation,
        at('2026-03-01T09:00'),
        { status, estimatedStartDate: undefined }
      );
      expect(schedule.status).toBe('no_prediction');
    }
  });

  it('does not schedule when a prediction lacks an estimated date', () => {
    const schedule = resolveReminderSchedule(
      periodExpectation,
      at('2026-03-01T09:00'),
      { status: 'predicted', estimatedStartDate: undefined }
    );
    expect(schedule.status).toBe('no_prediction');
  });
});

describe('resolveReminderSchedule - disabled reminders', () => {
  it('reports disabled and schedules nothing', () => {
    for (const reminder of [dailyCheckIn, periodExpectation]) {
      const schedule = resolveReminderSchedule(
        { ...reminder, isEnabled: false },
        at('2026-03-01T09:00'),
        predicted
      );
      expect(schedule).toEqual({ kind: reminder.id, status: 'disabled' });
    }
  });
});

describe('resolveReminderSchedule - invariants', () => {
  const now = at('2026-03-05T12:00');

  it('never returns a past or present datetime for a scheduled reminder', () => {
    for (const reminder of [dailyCheckIn, periodExpectation]) {
      const schedule = resolveReminderSchedule(reminder, now, predicted);
      if (schedule.status === 'scheduled') {
        expect(schedule.at! > '2026-03-05T12:00').toBe(true);
      }
    }
  });

  it('is pure: the same inputs always give the same output', () => {
    for (const reminder of [dailyCheckIn, periodExpectation]) {
      const a = resolveReminderSchedule(reminder, now, predicted);
      const b = resolveReminderSchedule(reminder, now, predicted);
      expect(a).toEqual(b);
    }
  });

  it('omits date and time for every non-scheduled status', () => {
    const cases = [
      resolveReminderSchedule({ ...dailyCheckIn, isEnabled: false }, now, predicted),
      resolveReminderSchedule(periodExpectation, now),
      resolveReminderSchedule(periodExpectation, at('2026-03-20T12:00'), predicted),
    ];
    for (const schedule of cases) {
      expect(schedule.status).not.toBe('scheduled');
      expect(schedule.date).toBeUndefined();
      expect(schedule.time).toBeUndefined();
      expect(schedule.at).toBeUndefined();
    }
  });

  it('is safe across a DST-shifting boundary without throwing', () => {
    const schedule = resolveReminderSchedule(dailyCheckIn, at('2026-03-29T00:30'), predicted);
    expect(schedule.status).toBe('scheduled');
    expect(schedule.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
