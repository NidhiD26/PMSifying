import { describe, it, expect } from 'vitest';
import {
  cycleLength,
  periodDuration,
  extractCycleLengths,
  analyzeCycles,
} from '@/lib/cycle-engine';
import type { CycleInput } from '@/lib/cycle-engine';

describe('cycleLength()', () => {
  it('computes a 28-day cycle', () => {
    const result = cycleLength({ startDate: '2026-01-01', endDate: '2026-01-29' });
    expect(result).toEqual({ days: 28 });
  });

  it('computes a 30-day cycle', () => {
    const result = cycleLength({ startDate: '2026-03-01', endDate: '2026-03-31' });
    expect(result).toEqual({ days: 30 });
  });

  it('computes a 32-day cycle', () => {
    const result = cycleLength({ startDate: '2026-02-01', endDate: '2026-03-05' });
    expect(result).toEqual({ days: 32 });
  });

  it('crosses a month boundary (Jan 20 to Feb 17)', () => {
    const result = cycleLength({ startDate: '2026-01-20', endDate: '2026-02-17' });
    expect(result).toEqual({ days: 28 });
  });

  it('crosses a year boundary (Dec 15 to Jan 12)', () => {
    const result = cycleLength({ startDate: '2025-12-15', endDate: '2026-01-12' });
    expect(result).toEqual({ days: 28 });
  });

  it('handles leap year (Feb 28 2024 to Mar 27 2024 = 28 days)', () => {
    const result = cycleLength({ startDate: '2024-02-28', endDate: '2024-03-27' });
    expect(result).toEqual({ days: 28 });
  });

  it('handles Feb 29 in leap year (Feb 29 to Mar 29 = 29 days)', () => {
    const result = cycleLength({ startDate: '2024-02-29', endDate: '2024-03-29' });
    expect(result).toEqual({ days: 29 });
  });

  it('returns null for missing endDate', () => {
    expect(cycleLength({ startDate: '2026-01-01' })).toBeNull();
  });

  it('returns null for invalid startDate', () => {
    expect(cycleLength({ startDate: 'not-a-date', endDate: '2026-01-29' })).toBeNull();
  });

  it('returns null for invalid endDate', () => {
    expect(cycleLength({ startDate: '2026-01-01', endDate: '2026-13-01' })).toBeNull();
  });

  it('returns null for reversed dates (endDate before startDate)', () => {
    expect(cycleLength({ startDate: '2026-01-10', endDate: '2026-01-01' })).toBeNull();
  });

  it('returns null for same start and end date', () => {
    expect(cycleLength({ startDate: '2026-01-01', endDate: '2026-01-01' })).toBeNull();
  });

  it('rejects Feb 30 (non-existent date)', () => {
    expect(cycleLength({ startDate: '2026-02-30', endDate: '2026-03-29' })).toBeNull();
  });

  it('rejects Feb 29 in non-leap year', () => {
    expect(cycleLength({ startDate: '2025-02-29', endDate: '2025-03-29' })).toBeNull();
  });
});

describe('periodDuration()', () => {
  it('returns 0 days for a single-day period (same start and end)', () => {
    expect(periodDuration({ startDate: '2026-08-01', endDate: '2026-08-01' })).toEqual({ days: 0 });
  });

  it('returns 5 days for a multi-day period', () => {
    expect(periodDuration({ startDate: '2026-08-01', endDate: '2026-08-06' })).toEqual({ days: 5 });
  });

  it('returns null for ongoing period (no endDate)', () => {
    expect(periodDuration({ startDate: '2026-08-01' })).toBeNull();
  });

  it('returns null for reversed dates', () => {
    expect(periodDuration({ startDate: '2026-08-10', endDate: '2026-08-01' })).toBeNull();
  });

  it('crosses month boundary', () => {
    expect(periodDuration({ startDate: '2026-08-30', endDate: '2026-09-02' })).toEqual({ days: 3 });
  });

  it('returns null for invalid date format', () => {
    expect(periodDuration({ startDate: 'bad', endDate: '2026-08-06' })).toBeNull();
  });
});

describe('extractCycleLengths()', () => {
  it('returns empty array for fewer than 2 cycles', () => {
    expect(extractCycleLengths([])).toEqual([]);
    expect(extractCycleLengths([{ startDate: '2026-01-01' }])).toEqual([]);
  });

  it('extracts lengths from 3 consecutive cycles', () => {
    const cycles: CycleInput[] = [
      { startDate: '2026-01-01' },
      { startDate: '2026-01-31' },
      { startDate: '2026-03-02' },
    ];
    expect(extractCycleLengths(cycles)).toEqual([30, 30]);
  });

  it('skips invalid dates and computes valid pairs', () => {
    const cycles: CycleInput[] = [
      { startDate: '2026-01-01' },
      { startDate: 'not-a-date' },
      { startDate: '2026-01-31' },
    ];
    // invalid cycle is filtered out before length extraction, so only pair is 01-01→01-31
    expect(extractCycleLengths(cycles)).toEqual([30]);
  });

  it('handles year boundary crossing', () => {
    const cycles: CycleInput[] = [
      { startDate: '2025-12-10' },
      { startDate: '2026-01-09' },
    ];
    expect(extractCycleLengths(cycles)).toEqual([30]);
  });

  it('handles leap year crossing (Feb 15 to Mar 15 = 29 days in 2024)', () => {
    const cycles: CycleInput[] = [
      { startDate: '2024-02-15' },
      { startDate: '2024-03-15' },
    ];
    expect(extractCycleLengths(cycles)).toEqual([29]);
  });
});

describe('analyzeCycles() — empty / insufficient data', () => {
  it('returns insufficient_data for empty array', () => {
    const result = analyzeCycles([]);
    expect(result.dataSufficiency).toBe('insufficient_data');
    expect(result.nextPeriod.status).toBe('insufficient_data');
    expect(result.ovulation.status).toBe('insufficient_data');
    expect(result.fertileWindow.status).toBe('insufficient_data');
    expect(result.variability.category).toBe('insufficient_data');
    expect(result.stats).toBeNull();
  });

  it('returns insufficient_data for single cycle', () => {
    const result = analyzeCycles([{ startDate: '2026-01-01', endDate: '2026-01-05' }]);
    expect(result.dataSufficiency).toBe('insufficient_data');
    expect(result.nextPeriod.status).toBe('insufficient_data');
    expect(result.stats).toBeNull();
  });

  it('returns insufficient_data if only invalid cycles provided', () => {
    const result = analyzeCycles([
      { startDate: 'bad-date' },
      { startDate: 'also-bad' },
    ]);
    expect(result.dataSufficiency).toBe('insufficient_data');
  });
});

describe('analyzeCycles() — statistics', () => {
  it('computes average from multiple cycles of 28 days', () => {
    const result = analyzeCycles([
      { startDate: '2026-01-01' },
      { startDate: '2026-01-29' },
      { startDate: '2026-02-26' },
    ]);
    expect(result.stats).not.toBeNull();
    expect(result.stats!.averageCycleLength).toBe(28);
    expect(result.stats!.shortestCycle).toBe(28);
    expect(result.stats!.longestCycle).toBe(28);
    expect(result.stats!.cycleLengths).toEqual([28, 28]);
    expect(result.stats!.sampleSize).toBe(2);
  });

  it('computes average for varying cycle lengths', () => {
    const result = analyzeCycles([
      { startDate: '2026-01-01' },
      { startDate: '2026-01-31' },
      { startDate: '2026-02-28' },
    ]);
    // lengths: 30, 28 → avg = 29
    expect(result.stats!.averageCycleLength).toBe(29);
    expect(result.stats!.shortestCycle).toBe(28);
    expect(result.stats!.longestCycle).toBe(30);
    expect(result.stats!.sampleSize).toBe(2);
  });

  it('computes fractional average for 3 cycles (28, 28, 28)', () => {
    const result = analyzeCycles([
      { startDate: '2026-01-01' },
      { startDate: '2026-01-29' },
      { startDate: '2026-02-26' },
      { startDate: '2026-03-26' },
    ]);
    // lengths: 28, 28, 28 → avg = 28
    expect(result.stats!.averageCycleLength).toBe(28);
  });

  it('sorts cycles chronologically regardless of input order', () => {
    const result = analyzeCycles([
      { startDate: '2026-03-01' },
      { startDate: '2026-01-01' },
      { startDate: '2026-02-01' },
    ]);
    // sorted: Jan 1, Feb 1, Mar 1 → lengths: 31, 28
    expect(result.stats!.cycleLengths).toEqual([31, 28]);
  });
});

describe('analyzeCycles() — next period prediction', () => {
  it('predicts next period for stable 28-day cycles', () => {
    const result = analyzeCycles([
      { startDate: '2026-01-01' },
      { startDate: '2026-01-29' },
      { startDate: '2026-02-26' },
    ]);
    expect(result.nextPeriod.status).toBe('predicted');
    expect(result.nextPeriod.estimatedStartDate).toBe('2026-03-26');
    expect(result.nextPeriod.basedOnCycles).toBe(2);
  });

  it('predicts next period for stable 30-day cycles', () => {
    const result = analyzeCycles([
      { startDate: '2026-01-01' },
      { startDate: '2026-01-31' },
      { startDate: '2026-03-02' },
    ]);
    expect(result.nextPeriod.status).toBe('predicted');
    expect(result.nextPeriod.estimatedStartDate).toBe('2026-04-01');
  });

  it('predicts next period crossing month boundary', () => {
    const result = analyzeCycles([
      { startDate: '2026-01-20' },
      { startDate: '2026-02-18' },
      { startDate: '2026-03-18' },
    ]);
    // lengths: 29, 28 → avg = 28.5 → rounded = 29, next = Mar 18 + 29 = Apr 16
    // Actually with 29 and 28: avg = 28.5, rounded = 29, next = Mar 18 + 29 = Apr 16
    expect(result.nextPeriod.status).toBe('predicted');
    expect(result.nextPeriod.estimatedStartDate).toBe('2026-04-16');
  });

  it('predicts next period crossing year boundary', () => {
    const result = analyzeCycles([
      { startDate: '2025-12-01' },
      { startDate: '2025-12-31' },
      { startDate: '2026-01-30' },
    ]);
    // lengths: 30, 30 → avg = 30, next = Jan 30 + 30 = Mar 1
    expect(result.nextPeriod.estimatedStartDate).toBe('2026-03-01');
  });

  it('deterministic: same input always yields same prediction', () => {
    const input: CycleInput[] = [
      { startDate: '2026-01-01' },
      { startDate: '2026-01-29' },
    ];
    const r1 = analyzeCycles(input);
    const r2 = analyzeCycles(input);
    expect(r1.nextPeriod.estimatedStartDate).toBe(r2.nextPeriod.estimatedStartDate);
    expect(r1.ovulation.estimatedDate).toBe(r2.ovulation.estimatedDate);
    expect(r1.fertileWindow.startDate).toBe(r2.fertileWindow.startDate);
  });
});

describe('analyzeCycles() — ovulation estimate', () => {
  it('estimates ovulation 14 days before predicted next period (shorter cycle)', () => {
    const result = analyzeCycles([
      { startDate: '2026-01-01' },
      { startDate: '2026-01-26' },
      { startDate: '2026-02-20' },
    ]);
    // avg of 25 and 25 = 25, next = Feb 20 + 25 = Mar 17, ovulation = Mar 3
    expect(result.ovulation.status).toBe('estimated');
    expect(result.ovulation.estimatedDate).toBe('2026-03-03');
  });

  it('estimates ovulation for normal 28-day cycle', () => {
    const result = analyzeCycles([
      { startDate: '2026-01-01' },
      { startDate: '2026-01-29' },
      { startDate: '2026-02-26' },
    ]);
    // avg = 28, next = Feb 26 + 28 = Mar 26, ovulation = Mar 12
    expect(result.ovulation.estimatedDate).toBe('2026-03-12');
  });

  it('estimates ovulation for longer 32-day cycle', () => {
    const result = analyzeCycles([
      { startDate: '2026-01-01' },
      { startDate: '2026-02-01' },
      { startDate: '2026-03-05' },
    ]);
    // lengths: 31, 32 → avg = 31.5 → rounded = 32, next = Mar 5 + 32 = Apr 6, ovulation = Mar 23
    expect(result.ovulation.estimatedDate).toBe('2026-03-23');
  });

  it('returns insufficient_data for ovulation with single cycle', () => {
    const result = analyzeCycles([{ startDate: '2026-01-01' }]);
    expect(result.ovulation.status).toBe('insufficient_data');
  });
});

describe('analyzeCycles() — fertile window', () => {
  it('computes fertile window around estimated ovulation', () => {
    const result = analyzeCycles([
      { startDate: '2026-01-01' },
      { startDate: '2026-01-29' },
      { startDate: '2026-02-26' },
    ]);
    // ovulation = 2026-03-12
    expect(result.fertileWindow.status).toBe('estimated');
    expect(result.fertileWindow.startDate).toBe('2026-03-07');
    expect(result.fertileWindow.endDate).toBe('2026-03-13');
    expect(result.fertileWindow.estimatedOvulationDate).toBe('2026-03-12');
    expect(result.fertileWindow.basedOnCycles).toBe(2);
  });

  it('fertile window boundary dates are correct', () => {
    const result = analyzeCycles([
      { startDate: '2026-01-01' },
      { startDate: '2026-01-29' },
      { startDate: '2026-02-26' },
    ]);
    // lengths: 28, 28 → avg = 28, next = Feb 26 + 28 = Mar 26, ovulation = Mar 12
    expect(result.fertileWindow.startDate).toBe('2026-03-07');
    expect(result.fertileWindow.endDate).toBe('2026-03-13');
  });

  it('returns insufficient_data with single cycle', () => {
    const result = analyzeCycles([{ startDate: '2026-01-01' }]);
    expect(result.fertileWindow.status).toBe('insufficient_data');
  });

  it('handles month boundary in fertile window', () => {
    const result = analyzeCycles([
      { startDate: '2026-02-01' },
      { startDate: '2026-03-01' },
      { startDate: '2026-03-29' },
    ]);
    // lengths: 28, 28 → avg = 28, next = Mar 29 + 28 = Apr 26, ovulation = Apr 12
    expect(result.fertileWindow.startDate).toBe('2026-04-07');
    expect(result.fertileWindow.endDate).toBe('2026-04-13');
  });
});

describe('analyzeCycles() — cycle variability', () => {
  it('classifies stable pattern (CV < 0.1)', () => {
    const result = analyzeCycles([
      { startDate: '2026-01-01' },
      { startDate: '2026-01-29' },
      { startDate: '2026-02-26' },
      { startDate: '2026-03-26' },
    ]);
    // all 28-day cycles
    expect(result.variability.category).toBe('stable');
    expect(result.variability.standardDeviation).toBe(0);
    expect(result.variability.coefficientOfVariation).toBe(0);
  });

  it('classifies moderately variable pattern (0.1 <= CV < 0.2)', () => {
    const result = analyzeCycles([
      { startDate: '2026-01-01' },
      { startDate: '2026-01-28' },
      { startDate: '2026-02-28' },
      { startDate: '2026-03-25' },
      { startDate: '2026-04-25' },
    ]);
    // lengths: 27, 31, 25, 31 → mean=28.5, SD≈2.65, CV≈0.093
    // Actually: 27, 31, 25, 31
    // mean = 28.5, diffs: -1.5, 2.5, -3.5, 2.5 → sq: 2.25, 6.25, 12.25, 6.25 = 27
    // variance = 27/3 = 9, SD = 3, CV = 3/28.5 ≈ 0.1053
    expect(result.variability.category).toBe('moderate');
  });

  it('classifies highly variable pattern (CV >= 0.2)', () => {
    const result = analyzeCycles([
      { startDate: '2026-01-01' },
      { startDate: '2026-01-21' },
      { startDate: '2026-02-20' },
      { startDate: '2026-03-26' },
      { startDate: '2026-04-20' },
    ]);
    // lengths: 20, 30, 34, 25 → avg=27.25
    // diffs: -7.25, 2.75, 6.75, -2.25 → sq: 52.5625, 7.5625, 45.5625, 5.0625 = 110.75
    // variance = 110.75/3 ≈ 36.92, SD ≈ 6.08, CV ≈ 6.08/27.25 ≈ 0.223
    expect(result.variability.category).toBe('variable');
  });

  it('returns insufficient_data for variability with single cycle', () => {
    const result = analyzeCycles([{ startDate: '2026-01-01' }]);
    expect(result.variability.category).toBe('insufficient_data');
  });
});

describe('analyzeCycles() — outlier strategy', () => {
  it('excludes outliers with exclude_extreme strategy', () => {
    const result = analyzeCycles(
      [
        { startDate: '2026-01-01' },
        { startDate: '2026-01-29' },
        { startDate: '2026-02-26' },
        { startDate: '2026-03-26' },
        { startDate: '2026-04-26' },
        { startDate: '2026-05-26' },
        { startDate: '2026-09-01' }, // outlier: very long gap
      ],
      { outlierStrategy: 'exclude_extreme' }
    );
    // The outlier should be excluded from stats
    expect(result.stats).not.toBeNull();
    expect(result.stats!.cycleLengths.length).toBeLessThan(6);
  });

  it('winsorizes outliers with winsorize strategy', () => {
    const result = analyzeCycles(
      [
        { startDate: '2026-01-01' },
        { startDate: '2026-01-29' },
        { startDate: '2026-02-26' },
        { startDate: '2026-03-26' },
        { startDate: '2026-04-26' },
        { startDate: '2026-05-26' },
        { startDate: '2026-09-01' },
      ],
      { outlierStrategy: 'winsorize' }
    );
    expect(result.stats).not.toBeNull();
    // Winsorized values should be clamped
    expect(result.stats!.cycleLengths.length).toBe(6);
  });

  it('no outlier strategy passes all values through', () => {
    const result = analyzeCycles(
      [
        { startDate: '2026-01-01' },
        { startDate: '2026-01-29' },
        { startDate: '2026-02-26' },
        { startDate: '2026-03-26' },
        { startDate: '2026-04-26' },
        { startDate: '2026-05-26' },
        { startDate: '2026-09-01' },
      ],
      { outlierStrategy: 'none' }
    );
    expect(result.stats!.cycleLengths.length).toBe(6);
  });
});

describe('analyzeCycles() — date edge cases', () => {
  it('handles Feb 28 in non-leap year cycle start', () => {
    const result = analyzeCycles([
      { startDate: '2025-02-28' },
      { startDate: '2025-03-28' },
      { startDate: '2025-04-25' },
    ]);
    // lengths: 28, 28 → avg = 28, next = Apr 25 + 28 = May 23
    expect(result.stats!.averageCycleLength).toBe(28);
    expect(result.nextPeriod.estimatedStartDate).toBe('2025-05-23');
  });

  it('handles Feb 29 in leap year cycle start', () => {
    const result = analyzeCycles([
      { startDate: '2024-02-29' },
      { startDate: '2024-03-29' },
      { startDate: '2024-04-28' },
    ]);
    // lengths: 29, 30 → avg = 29.5 → rounded = 30, next = Apr 28 + 30 = May 28
    expect(result.stats!.averageCycleLength).toBe(29.5);
    expect(result.nextPeriod.estimatedStartDate).toBe('2024-05-28');
  });

  it('handles December → January transition', () => {
    const result = analyzeCycles([
      { startDate: '2025-12-15' },
      { startDate: '2026-01-14' },
      { startDate: '2026-02-13' },
    ]);
    expect(result.stats!.averageCycleLength).toBe(30);
    expect(result.nextPeriod.estimatedStartDate).toBe('2026-03-15');
  });

  it('handles month boundaries (Jan 31 → Feb 28)', () => {
    const result = analyzeCycles([
      { startDate: '2026-01-31' },
      { startDate: '2026-02-28' },
      { startDate: '2026-03-28' },
    ]);
    // lengths: 28, 28 → avg = 28
    expect(result.stats!.averageCycleLength).toBe(28);
  });

  it('handles leap year February correctly', () => {
    const result = analyzeCycles([
      { startDate: '2024-02-01' },
      { startDate: '2024-03-01' },
      { startDate: '2024-03-30' },
    ]);
    // lengths: 29, 29 → avg = 29
    expect(result.stats!.averageCycleLength).toBe(29);
  });
});

describe('analyzeCycles() — minCyclesForPrediction config', () => {
  it('returns insufficient_data when below custom threshold', () => {
    const result = analyzeCycles(
      [
        { startDate: '2026-01-01' },
        { startDate: '2026-01-29' },
        { startDate: '2026-02-26' },
      ],
      { minCyclesForPrediction: 3 }
    );
    // 2 cycle lengths, but config requires 3
    expect(result.dataSufficiency).toBe('insufficient_data');
    expect(result.nextPeriod.status).toBe('insufficient_data');
  });

  it('sufficient data when meeting custom threshold', () => {
    const result = analyzeCycles(
      [
        { startDate: '2026-01-01' },
        { startDate: '2026-01-29' },
        { startDate: '2026-02-26' },
        { startDate: '2026-03-26' },
      ],
      { minCyclesForPrediction: 3 }
    );
    // 3 cycle lengths, threshold is 3
    expect(result.dataSufficiency).toBe('sufficient_data');
    expect(result.nextPeriod.status).toBe('predicted');
  });
});

describe('analyzeCycles() — no fixed 28-day assumption', () => {
  it('uses actual data, not hardcoded 28', () => {
    const result = analyzeCycles([
      { startDate: '2026-01-01' },
      { startDate: '2026-02-04' },
      { startDate: '2026-03-10' },
    ]);
    // lengths: 34, 34 → avg = 34
    expect(result.stats!.averageCycleLength).toBe(34);
    expect(result.nextPeriod.estimatedStartDate).toBe('2026-04-13');
  });
});
