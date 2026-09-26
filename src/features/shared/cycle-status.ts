/**
 * Presentation-only helpers that read the cycle engine's output.
 *
 * The deterministic engine is untouched: these functions consume its results
 * and the dates the reader has actually recorded, and turn them into the
 * handful of facts the dashboard and calendar show. Keeping them here — rather
 * than inline in a view — is what stops the two screens from disagreeing about
 * what "cycle day" or "current phase" means.
 *
 * Pure functions, so they are unit tested directly.
 */

import type { CycleAnalysisResult } from '@/lib/cycle-engine/types';
import type { CycleDomainModel } from '@/types/health';

/** Translation keys for the four cycle phases, in the `dashboard` namespace. */
export type CyclePhaseKey = 'phaseFollicular' | 'phaseOvulatory' | 'phaseLuteal' | 'phaseMenstrual';

/** `Badge` variants, so phase and calendar colour never drift apart. */
export type CycleStatusTone = 'period' | 'ovulation' | 'fertile' | 'neutral';

export interface CycleStatus {
  lastCycle: CycleDomainModel;
  /** Day within the most recent cycle, counting the start date as day 1. */
  cycleDay: number;
  phaseKey: CyclePhaseKey;
  tone: CycleStatusTone;
}

const MS_PER_DAY = 86_400_000;

function toUtc(dateIso: string): number {
  return new Date(`${dateIso}T00:00:00Z`).getTime();
}

/**
 * Whole days from `fromIso` to `toIso`, counting the first day as 1.
 *
 * Returns 1 when the target is before the start, which is what a cycle day
 * should read as rather than a negative or zero value.
 */
export function inclusiveDayCount(fromIso: string, toIso: string): number {
  const diff = Math.round((toUtc(toIso) - toUtc(fromIso)) / MS_PER_DAY);
  return Math.max(1, diff + 1);
}

/** The most recent recorded cycle that has already started on or before `dateIso`. */
export function latestCycleOnOrBefore(
  cycles: CycleDomainModel[],
  dateIso: string
): CycleDomainModel | null {
  let match: CycleDomainModel | null = null;
  for (const cycle of cycles) {
    if (cycle.startDate <= dateIso) {
      if (!match || cycle.startDate > match.startDate) match = cycle;
    }
  }
  return match;
}

/**
 * Which day of its cycle `dateIso` falls on, or null when no recorded cycle has
 * started yet by then.
 */
export function cycleDayForDate(cycles: CycleDomainModel[], dateIso: string): number | null {
  const cycle = latestCycleOnOrBefore(cycles, dateIso);
  return cycle ? inclusiveDayCount(cycle.startDate, dateIso) : null;
}

/**
 * Where the reader is in their cycle right now, or null when nothing has been
 * recorded yet.
 *
 * The phase is read from the engine's fertile-window estimate. While the most
 * recent period is still open the reader is in the menstrual phase, whatever
 * the estimate says, because a recorded fact outranks an estimate.
 */
export function deriveCycleStatus(
  cycles: CycleDomainModel[],
  todayIso: string,
  analysis: CycleAnalysisResult
): CycleStatus | null {
  const lastCycle = latestCycleOnOrBefore(cycles, todayIso);
  if (!lastCycle) return null;

  const cycleDay = inclusiveDayCount(lastCycle.startDate, todayIso);
  const fertile = analysis.fertileWindow;
  const hasFertileEstimate =
    fertile.status === 'estimated' &&
    !!fertile.startDate &&
    !!fertile.endDate &&
    todayIso >= fertile.startDate &&
    todayIso <= fertile.endDate;
  const isAfterFertileWindow =
    fertile.status === 'estimated' && !!fertile.endDate && todayIso > fertile.endDate;

  const periodStillOpen = !lastCycle.endDate || todayIso <= lastCycle.endDate;

  if (periodStillOpen) {
    return { lastCycle, cycleDay, phaseKey: 'phaseMenstrual', tone: 'period' };
  }
  if (hasFertileEstimate) {
    return { lastCycle, cycleDay, phaseKey: 'phaseOvulatory', tone: 'ovulation' };
  }
  if (isAfterFertileWindow) {
    return { lastCycle, cycleDay, phaseKey: 'phaseLuteal', tone: 'fertile' };
  }
  return { lastCycle, cycleDay, phaseKey: 'phaseFollicular', tone: 'neutral' };
}
