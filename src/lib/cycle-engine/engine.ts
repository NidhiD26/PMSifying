import type {
  CycleInput,
  CycleLengthResult,
  PeriodDurationResult,
  CycleStats,
  DataSufficiencyStatus,
  NextPeriodPrediction,
  OvulationEstimate,
  FertileWindow,
  CycleVariability,
  VariabilityCategory,
  OutlierStrategy,
  EngineConfig,
  CycleAnalysisResult,
} from './types';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(s: string): boolean {
  if (!ISO_DATE_REGEX.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12) return false;
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00Z');
  const b = new Date(dateB + 'T00:00:00Z');
  const msPerDay = 86_400_000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function cycleLength(cycle: CycleInput): CycleLengthResult | null {
  if (!isValidIsoDate(cycle.startDate)) return null;
  if (!cycle.endDate) return null;
  if (!isValidIsoDate(cycle.endDate)) return null;
  const diff = daysBetween(cycle.startDate, cycle.endDate);
  return diff > 0 ? { days: diff } : null;
}

export function periodDuration(cycle: CycleInput): PeriodDurationResult | null {
  if (!isValidIsoDate(cycle.startDate)) return null;
  if (!cycle.endDate) return null;
  if (!isValidIsoDate(cycle.endDate)) return null;
  const diff = daysBetween(cycle.startDate, cycle.endDate);
  return diff >= 0 ? { days: diff } : null;
}

export function extractCycleLengths(sortedCycles: CycleInput[]): number[] {
  const valid = sortedCycles.filter((c) => isValidIsoDate(c.startDate));
  if (valid.length < 2) return [];
  const lengths: number[] = [];
  for (let i = 1; i < valid.length; i++) {
    const diff = daysBetween(valid[i - 1].startDate, valid[i].startDate);
    if (diff > 0) {
      lengths.push(diff);
    }
  }
  return lengths;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((v) => (v - avg) ** 2);
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function iqrBounds(values: number[]): { lower: number; upper: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const q1Idx = Math.floor(n * 0.25);
  const q3Idx = Math.floor(n * 0.75);
  const q1 = sorted[q1Idx];
  const q3 = sorted[q3Idx];
  const iqr = q3 - q1;
  return {
    lower: q1 - 1.5 * iqr,
    upper: q3 + 1.5 * iqr,
  };
}

function winsorize(values: number[]): number[] {
  const { lower, upper } = iqrBounds(values);
  return values.map((v) => {
    if (v < lower) return lower;
    if (v > upper) return upper;
    return v;
  });
}

function applyOutlierStrategy(
  lengths: number[],
  strategy: OutlierStrategy
): number[] {
  if (lengths.length < 4) return lengths;
  if (strategy === 'none') return lengths;
  if (strategy === 'exclude_extreme') {
    const { lower, upper } = iqrBounds(lengths);
    return lengths.filter((v) => v >= lower && v <= upper);
  }
  if (strategy === 'winsorize') {
    return winsorize(lengths);
  }
  return lengths;
}

function classifyVariability(cv: number): VariabilityCategory {
  if (cv < 0.1) return 'stable';
  if (cv < 0.2) return 'moderate';
  return 'variable';
}

const MIN_CYCLES_FOR_PREDICTION = 2;

export function analyzeCycles(
  cycles: CycleInput[],
  config: EngineConfig = {}
): CycleAnalysisResult {
  const {
    outlierStrategy = 'none',
    minCyclesForPrediction = MIN_CYCLES_FOR_PREDICTION,
  } = config;

  const validCycles = cycles
    .filter((c) => isValidIsoDate(c.startDate))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (validCycles.length < 2) {
    return {
      stats: null,
      nextPeriod: { status: 'insufficient_data' },
      ovulation: { status: 'insufficient_data' },
      fertileWindow: { status: 'insufficient_data' },
      variability: {
        category: 'insufficient_data',
        standardDeviation: 0,
        coefficientOfVariation: 0,
        sampleSize: validCycles.length,
      },
      dataSufficiency: 'insufficient_data',
    };
  }

  const rawLengths = extractCycleLengths(validCycles);
  if (rawLengths.length === 0) {
    return {
      stats: null,
      nextPeriod: { status: 'insufficient_data' },
      ovulation: { status: 'insufficient_data' },
      fertileWindow: { status: 'insufficient_data' },
      variability: {
        category: 'insufficient_data',
        standardDeviation: 0,
        coefficientOfVariation: 0,
        sampleSize: 0,
      },
      dataSufficiency: 'insufficient_data',
    };
  }

  const lengths = applyOutlierStrategy(rawLengths, outlierStrategy);

  if (lengths.length < 2) {
    return {
      stats: null,
      nextPeriod: { status: 'insufficient_data' },
      ovulation: { status: 'insufficient_data' },
      fertileWindow: { status: 'insufficient_data' },
      variability: {
        category: 'insufficient_data',
        standardDeviation: 0,
        coefficientOfVariation: 0,
        sampleSize: lengths.length,
      },
      dataSufficiency: 'insufficient_data',
    };
  }

  const avg = mean(lengths);
  const sd = standardDeviation(lengths);
  const cv = avg > 0 ? sd / avg : 0;
  const minLen = Math.min(...lengths);
  const maxLen = Math.max(...lengths);

  const stats: CycleStats = {
    averageCycleLength: Math.round(avg * 100) / 100,
    shortestCycle: minLen,
    longestCycle: maxLen,
    cycleLengths: lengths,
    sampleSize: lengths.length,
  };

  const variability: CycleVariability = {
    category: classifyVariability(cv),
    standardDeviation: Math.round(sd * 100) / 100,
    coefficientOfVariation: Math.round(cv * 10000) / 10000,
    sampleSize: lengths.length,
  };

  const lastCycle = validCycles[validCycles.length - 1];
  const nextPeriodDate = addDaysToDate(
    lastCycle.startDate,
    Math.round(avg)
  );

  const dataSufficiency: DataSufficiencyStatus =
    lengths.length >= minCyclesForPrediction ? 'sufficient_data' : 'insufficient_data';

  const nextPeriod: NextPeriodPrediction =
    dataSufficiency === 'sufficient_data'
      ? { status: 'predicted', estimatedStartDate: nextPeriodDate, basedOnCycles: lengths.length }
      : { status: 'insufficient_data' };

  const ovulationDay = addDaysToDate(nextPeriodDate, -14);
  const ovulation: OvulationEstimate =
    dataSufficiency === 'sufficient_data'
      ? { status: 'estimated', estimatedDate: ovulationDay, basedOnCycles: lengths.length }
      : { status: 'insufficient_data' };

  const fertileStart = addDaysToDate(ovulationDay, -5);
  const fertileEnd = addDaysToDate(ovulationDay, 1);
  const fertileWindow: FertileWindow =
    dataSufficiency === 'sufficient_data'
      ? {
          status: 'estimated',
          startDate: fertileStart,
          endDate: fertileEnd,
          estimatedOvulationDate: ovulationDay,
          basedOnCycles: lengths.length,
        }
      : { status: 'insufficient_data' };

  return {
    stats,
    nextPeriod,
    ovulation,
    fertileWindow,
    variability,
    dataSufficiency,
  };
}
