import { describe, it, expect } from 'vitest';
import { analyzeCycles } from '@/lib/cycle-engine/engine';
import {
  cycleDayForDate,
  deriveCycleStatus,
  inclusiveDayCount,
  latestCycleOnOrBefore,
} from '@/features/shared/cycle-status';
import type { CycleDomainModel } from '@/types/health';

const cycle = (
  startDate: string,
  endDate?: string,
  overrides: Partial<CycleDomainModel> = {}
): CycleDomainModel => ({
  startDate,
  endDate,
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

describe('inclusiveDayCount', () => {
  it('counts the start date as day one', () => {
    expect(inclusiveDayCount('2026-09-01', '2026-09-01')).toBe(1);
    expect(inclusiveDayCount('2026-09-01', '2026-09-02')).toBe(2);
    expect(inclusiveDayCount('2026-09-01', '2026-10-01')).toBe(31);
  });

  it('crosses month and year boundaries without a timezone shift', () => {
    expect(inclusiveDayCount('2026-08-28', '2026-09-02')).toBe(6);
    expect(inclusiveDayCount('2025-12-31', '2026-01-01')).toBe(2);
  });

  it('never reports zero or a negative day for a date before the start', () => {
    expect(inclusiveDayCount('2026-09-01', '2026-08-30')).toBe(1);
  });
});

describe('cycleDayForDate', () => {
  const cycles = [cycle('2026-08-01', '2026-08-05'), cycle('2026-09-01', '2026-09-04')];

  it('counts within the cycle that had already started', () => {
    expect(cycleDayForDate(cycles, '2026-09-01')).toBe(1);
    expect(cycleDayForDate(cycles, '2026-09-03')).toBe(3);
    expect(cycleDayForDate(cycles, '2026-08-10')).toBe(10);
  });

  it('has no answer before anything was recorded', () => {
    expect(cycleDayForDate(cycles, '2026-07-31')).toBeNull();
    expect(cycleDayForDate([], '2026-09-01')).toBeNull();
  });

  it('keeps counting through an open period', () => {
    const ongoing = [cycle('2026-09-01')];
    expect(cycleDayForDate(ongoing, '2026-09-06')).toBe(6);
  });
});

describe('latestCycleOnOrBefore', () => {
  it('ignores cycles that start after the date asked about', () => {
    const cycles = [cycle('2026-08-01', '2026-08-05'), cycle('2026-10-01')];
    expect(latestCycleOnOrBefore(cycles, '2026-09-10')?.startDate).toBe('2026-08-01');
  });
});

describe('deriveCycleStatus', () => {
  it('has no status before anything is recorded', () => {
    expect(deriveCycleStatus([], '2026-09-10', analyzeCycles([]))).toBeNull();
  });

  it('reads the menstrual phase while the last period is still open', () => {
    const cycles = [cycle('2026-09-05')];
    const status = deriveCycleStatus(cycles, '2026-09-08', analyzeCycles(cycles));

    expect(status).not.toBeNull();
    expect(status?.phaseKey).toBe('phaseMenstrual');
    expect(status?.tone).toBe('period');
    expect(status?.cycleDay).toBe(4);
  });

  it('stays in the menstrual phase until the recorded end date has passed', () => {
    const cycles = [cycle('2026-09-01', '2026-09-03')];
    expect(deriveCycleStatus(cycles, '2026-09-03', analyzeCycles(cycles))?.phaseKey).toBe(
      'phaseMenstrual'
    );
    expect(deriveCycleStatus(cycles, '2026-09-04', analyzeCycles(cycles))?.phaseKey).not.toBe(
      'phaseMenstrual'
    );
  });

  it('reads the remaining phases from the engine estimate alone', () => {
    // Three 28-day cycles, so the engine can produce a fertile-window estimate.
    const cycles = [cycle('2026-06-01', '2026-06-05'), cycle('2026-06-29', '2026-07-03'), cycle('2026-07-27', '2026-07-31')];
    const analysis = analyzeCycles(cycles);

    expect(analysis.fertileWindow.status).toBe('estimated');

    const status = deriveCycleStatus(cycles, '2026-08-10', analysis);
    expect(status?.cycleDay).toBe(15);
    expect(status?.lastCycle.startDate).toBe('2026-07-27');
    expect(['phaseFollicular', 'phaseOvulatory', 'phaseLuteal']).toContain(status?.phaseKey);
  });

  it('falls back to the follicular phase when there is no estimate yet', () => {
    const cycles = [cycle('2026-09-01', '2026-09-05')];
    const status = deriveCycleStatus(cycles, '2026-09-20', analyzeCycles(cycles));

    expect(status?.phaseKey).toBe('phaseFollicular');
    expect(status?.tone).toBe('neutral');
  });
});
