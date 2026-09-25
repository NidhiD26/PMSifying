import { describe, it, expect } from 'vitest';
import { dailyLogSchema } from '@/lib/validation/health-schemas';

const validLog = {
  date: '2026-09-01',
  symptoms: [{ id: 'cramps' }, { id: 'headache' }],
  mood: [{ id: 'calm' }],
  painLevel: 3,
  sleepHours: 7.5,
  hydrationMl: 2500,
  notes: 'A private note',
};

describe('dailyLogSchema — valid data', () => {
  it('accepts a fully valid daily log', () => {
    const result = dailyLogSchema.safeParse(validLog);
    expect(result.success).toBe(true);
  });

  it('accepts a minimal log with defaults for optional fields', () => {
    const result = dailyLogSchema.safeParse({
      date: '2026-09-01',
      symptoms: [],
      mood: [],
      painLevel: 0,
      sleepHours: 0,
      hydrationMl: 0,
    });
    expect(result.success).toBe(true);
  });

  it('accepts decimal sleep hours', () => {
    const result = dailyLogSchema.safeParse({ ...validLog, sleepHours: 7.5 });
    expect(result.success).toBe(true);
  });

  it('accepts notes with line breaks', () => {
    const result = dailyLogSchema.safeParse({ ...validLog, notes: 'line one\nline two' });
    expect(result.success).toBe(true);
  });
});

describe('dailyLogSchema — invalid pain', () => {
  it('rejects pain < 0', () => {
    const result = dailyLogSchema.safeParse({ ...validLog, painLevel: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects pain > 10', () => {
    const result = dailyLogSchema.safeParse({ ...validLog, painLevel: 11 });
    expect(result.success).toBe(false);
  });

  it('accepts boundaries 0 and 10', () => {
    expect(dailyLogSchema.safeParse({ ...validLog, painLevel: 0 }).success).toBe(true);
    expect(dailyLogSchema.safeParse({ ...validLog, painLevel: 10 }).success).toBe(true);
  });
});

describe('dailyLogSchema — invalid sleep', () => {
  it('rejects negative sleep', () => {
    expect(dailyLogSchema.safeParse({ ...validLog, sleepHours: -1 }).success).toBe(false);
  });

  it('rejects sleep > 24', () => {
    expect(dailyLogSchema.safeParse({ ...validLog, sleepHours: 25 }).success).toBe(false);
  });

  it('rejects non-numeric sleep', () => {
    const result = dailyLogSchema.safeParse({ ...validLog, sleepHours: 'seven' as unknown as number });
    expect(result.success).toBe(false);
  });
});

describe('dailyLogSchema — invalid hydration', () => {
  it('rejects negative hydration', () => {
    expect(dailyLogSchema.safeParse({ ...validLog, hydrationMl: -10 }).success).toBe(false);
  });

  it('rejects hydration > 10000', () => {
    expect(dailyLogSchema.safeParse({ ...validLog, hydrationMl: 10001 }).success).toBe(false);
  });

  it('rejects non-numeric hydration', () => {
    const result = dailyLogSchema.safeParse({ ...validLog, hydrationMl: 'abc' as unknown as number });
    expect(result.success).toBe(false);
  });
});

describe('dailyLogSchema — invalid mood', () => {
  it('rejects empty mood id', () => {
    const result = dailyLogSchema.safeParse({
      ...validLog,
      mood: [{ id: '' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects mood id over 50 chars', () => {
    const result = dailyLogSchema.safeParse({
      ...validLog,
      mood: [{ id: 'x'.repeat(51) }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate mood entries', () => {
    const result = dailyLogSchema.safeParse({
      ...validLog,
      mood: [{ id: 'calm' }, { id: 'calm' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('dailyLogSchema — invalid symptoms', () => {
  it('rejects empty symptom id', () => {
    const result = dailyLogSchema.safeParse({
      ...validLog,
      symptoms: [{ id: '' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate symptom entries', () => {
    const result = dailyLogSchema.safeParse({
      ...validLog,
      symptoms: [{ id: 'cramps' }, { id: 'cramps' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('dailyLogSchema — excessive notes', () => {
  it('rejects notes over 2000 chars', () => {
    const result = dailyLogSchema.safeParse({
      ...validLog,
      notes: 'y'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe('dailyLogSchema — invalid date', () => {
  it('rejects bad format date', () => {
    expect(dailyLogSchema.safeParse({ ...validLog, date: '2026/09/01' }).success).toBe(false);
  });

  it('rejects invalid calendar date (Feb 30)', () => {
    expect(dailyLogSchema.safeParse({ ...validLog, date: '2026-02-30' }).success).toBe(false);
  });

  it('rejects Feb 29 in non-leap year', () => {
    expect(dailyLogSchema.safeParse({ ...validLog, date: '2025-02-29' }).success).toBe(false);
  });

  it('accepts Feb 29 in leap year', () => {
    expect(dailyLogSchema.safeParse({ ...validLog, date: '2024-02-29' }).success).toBe(true);
  });
});
