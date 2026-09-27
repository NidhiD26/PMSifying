import {
  CAMP_ATTENDANCE_STATUSES,
  CASE_STATUSES,
  CASE_TRANSITIONS,
  FOLLOW_UP_STATUSES,
  FOLLOW_UP_TRANSITIONS,
  HEALTH_CAMP_STATUSES,
  HEALTH_CAMP_TRANSITIONS,
  OBSERVATION_SEVERITIES,
  REFERRAL_STATUSES,
  REFERRAL_TRANSITIONS,
  type CampAttendanceStatus,
  type CasePriority,
  type CaseStatus,
  type FollowUpStatus,
  type HealthCampStatus,
  type ReferralStatus,
} from '@/types/healthcare';

/**
 * The legal moves, as data.
 *
 * WHY THIS IS A TABLE AND NOT A SWITCH IN EACH OPERATION
 * "Which status may follow which" is a property of the domain, not of the endpoint
 * that happens to change it, and a workflow this long has four such tables. Written
 * as data, the same question is answerable by a test that walks every cell, and a
 * new status added to `0003_healthcare_schema.sql` without a row here is a type
 * error rather than a hole where a case could be teleported.
 *
 * WHY A CLIENT CANNOT ASK FOR A STATUS
 * Every function here takes the *action* that was performed and derives the
 * resulting status. There is no "set status" operation anywhere in the healthcare
 * service, so a caller cannot skip a step by writing the column it wanted: filing a
 * referral is what moves a case to REFERRED, and the only way to reach CLOSED is
 * through a review or a cancellation that the state machine allows.
 */

/** A case status may only become one of the statuses listed for its current value. */
export function canTransitionCase(from: CaseStatus, to: CaseStatus): boolean {
  return (CASE_TRANSITIONS[from] ?? []).includes(to);
}

export function canTransitionReferral(from: ReferralStatus, to: ReferralStatus): boolean {
  return (REFERRAL_TRANSITIONS[from] ?? []).includes(to);
}

export function canTransitionFollowUp(from: FollowUpStatus, to: FollowUpStatus): boolean {
  return (FOLLOW_UP_TRANSITIONS[from] ?? []).includes(to);
}

export function canTransitionHealthCamp(from: HealthCampStatus, to: HealthCampStatus): boolean {
  return (HEALTH_CAMP_TRANSITIONS[from] ?? []).includes(to);
}

/** Every status still open for work. Used by the counts the dashboards show. */
export const OPEN_CASE_STATUSES: readonly CaseStatus[] = ['OPEN', 'REFERRED', 'UNDER_REVIEW', 'FOLLOW_UP'];

/** A case is "under review" for a doctor once they have accepted and picked it up. */
export const ACTIVE_REVIEW_STATUSES: readonly CaseStatus[] = ['UNDER_REVIEW', 'FOLLOW_UP'];

/** What an action does to a case's status, and whether the action is legal now. */
export type CaseAction = 'refer' | 'accept' | 'startReview' | 'requestFollowUp' | 'close' | 'reopen';

interface CaseActionRule {
  readonly to: CaseStatus;
  /**
   * Whether the action may be repeated when the case is already in the target
   * status. A doctor who loads a case review page twice and saves a second note
   * must not be refused because the first save already moved the case along.
   */
  readonly idempotent: boolean;
}

const CASE_ACTIONS: Readonly<Record<CaseAction, CaseActionRule>> = {
  refer: { to: 'REFERRED', idempotent: false },
  accept: { to: 'REFERRED', idempotent: true },
  startReview: { to: 'UNDER_REVIEW', idempotent: false },
  requestFollowUp: { to: 'FOLLOW_UP', idempotent: false },
  close: { to: 'CLOSED', idempotent: true },
  reopen: { to: 'UNDER_REVIEW', idempotent: false },
};

/**
 * The status a case ends up in after an action, or `null` when the action is not
 * legal from where the case currently is.
 *
 * Returning `null` rather than throwing keeps the rule table pure, so the service
 * can decide *which* error to raise — a closed case is a conflict, while an action
 * a plain member attempted is forbidden before it ever reaches this table.
 */
export function nextCaseStatus(
  from: CaseStatus,
  action: CaseAction
): { ok: true; to: CaseStatus } | { ok: false; from: CaseStatus; action: CaseAction } {
  const rule = CASE_ACTIONS[action];
  if (from === rule.to) {
    return rule.idempotent
      ? { ok: true, to: rule.to }
      : { ok: false, from, action };
  }
  return canTransitionCase(from, rule.to)
    ? { ok: true, to: rule.to }
    : { ok: false, from, action };
}

/**
 * The same table for referrals, where the ASHA side and the doctor side have
 * different names for the same two moves.
 */
export function nextReferralStatus(
  from: ReferralStatus,
  action: 'accept' | 'startReview' | 'complete' | 'cancel'
): { ok: true; to: ReferralStatus } | { ok: false; from: ReferralStatus; action: string } {
  const table: Readonly<Record<string, ReferralStatus>> = {
    accept: 'ACCEPTED',
    startReview: 'IN_REVIEW',
    complete: 'COMPLETED',
    cancel: 'CANCELLED',
  };
  const to = table[action];
  if (!to) return { ok: false, from, action };
  // Cancelling is always allowed, including from a terminal state: withdrawing a
  // referral that was never accepted is the one thing a worker may always do, and
  // forbidding it would leave a case pointed at a doctor who is not going to look.
  if (action === 'cancel' && !canTransitionReferral(from, to) && from !== 'PENDING') {
    if (from === 'CANCELLED' || from === 'COMPLETED') return { ok: true, to: from };
  }
  if (from === to) return { ok: true, to };
  return canTransitionReferral(from, to) ? { ok: true, to } : { ok: false, from, action };
}

export function nextFollowUpStatus(
  from: FollowUpStatus,
  action: 'complete' | 'markMissed' | 'cancel'
): { ok: true; to: FollowUpStatus } | { ok: false; from: FollowUpStatus; action: string } {
  const table: Readonly<Record<string, FollowUpStatus>> = {
    complete: 'COMPLETED',
    markMissed: 'MISSED',
    cancel: 'CANCELLED',
  };
  const to = table[action];
  if (!to) return { ok: false, from, action };
  if (from === to) return { ok: true, to };
  return canTransitionFollowUp(from, to) ? { ok: true, to } : { ok: false, from, action };
}

/** Attendance may be marked, or corrected, but only between these two states. */
export function canMarkAttendance(
  from: CampAttendanceStatus,
  to: CampAttendanceStatus
): boolean {
  if (from === to) return true;
  // A registration is the starting point and is never a settled attendance
  // record, so it may become either answer.
  if (from === 'REGISTERED') return to === 'ATTENDED' || to === 'ABSENT';
  // Once marked, a correction is allowed: a mis-tapped register is the single most
  // likely field error in a camp, and freezing it would mean the record is wrong
  // for good.
  return to === 'ATTENDED' || to === 'ABSENT';
}

/**
 * The statuses a schema enum and the domain type can both be talking about.
 *
 * These are the tables `locale-parity` style tests and the generated SQL types are
 * checked against, and they are declared as derived unions so adding a status to
 * the domain type without listing it here is a compile error.
 */
export const KNOWN_CASE_STATUSES = CASE_STATUSES;
export const KNOWN_REFERRAL_STATUSES = REFERRAL_STATUSES;
export const KNOWN_FOLLOW_UP_STATUSES = FOLLOW_UP_STATUSES;
export const KNOWN_HEALTH_CAMP_STATUSES = HEALTH_CAMP_STATUSES;
export const KNOWN_OBSERVATION_SEVERITIES = OBSERVATION_SEVERITIES;
export const KNOWN_CAMP_ATTENDANCE_STATUSES = CAMP_ATTENDANCE_STATUSES;

/** An urgent referral is one the doctor should see first; nothing else is. */
export function isUrgent(priority: CasePriority): boolean {
  return priority === 'URGENT';
}
