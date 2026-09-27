import type { Json } from '@/types/supabase-database';

/**
 * The healthcare ecosystem's domain vocabulary.
 *
 * This is World C: the coordination layer where an ASHA worker, a doctor and a
 * health camp move a person through observation, case, referral, review and
 * follow-up. It is relational, it is multi-user, and it is the first part of
 * PMSify where more than one person can see the same person's information — so
 * the shapes here are the ones the authorization rules are written against.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT CONTAIN
 * No cycle, symptom, mood, sleep, hydration, pain or flow value. A member of a
 * household is a person in a community whose health observations were recorded by
 * a health worker; their PMSify personal tracking lives in IndexedDB on their own
 * device and there is no column, join or RPC that can reach it from here. The
 * separation is structural, exactly as it is for SecretChat, and
 * `src/test/healthcare-privacy.test.ts` is the guard that keeps it that way.
 *
 * WHAT "OBSERVATION" MEANS HERE
 * An observation is what a health worker saw or was told, in their words. It is
 * not a diagnosis, it is not an assessment, and nothing in this vocabulary turns
 * reported symptoms into a conclusion. A diagnosis is a clinician's clinical note
 * and a prescription is a clinician's prescription, and only a doctor writes
 * either.
 */

/** Who a signed-in account is allowed to be. Stored server-side, never chosen by a client. */
export type HealthcareRole = 'USER' | 'ASHA' | 'DOCTOR' | 'ADMIN';

export const HEALTHCARE_ROLES: HealthcareRole[] = ['USER', 'ASHA', 'DOCTOR', 'ADMIN'];

/** Where a case came from, which decides who may act on it first. */
export type CaseSource = 'ASHA' | 'CAMP';

export type CaseStatus = 'OPEN' | 'REFERRED' | 'UNDER_REVIEW' | 'FOLLOW_UP' | 'CLOSED';

export const CASE_STATUSES: CaseStatus[] = [
  'OPEN',
  'REFERRED',
  'UNDER_REVIEW',
  'FOLLOW_UP',
  'CLOSED',
];

/**
 * The case lifecycle, as data rather than as prose in a route.
 *
 * Every status change goes through `canTransitionCase` in `@/lib/healthcare/state`,
 * so "which moves are legal" has exactly one answer. A client cannot ask for a
 * status directly: it asks for the *action* it performed (refer, accept, note,
 * close) and the server derives the resulting status from this table.
 */
export const CASE_TRANSITIONS: Readonly<Record<CaseStatus, readonly CaseStatus[]>> = {
  // A new case starts OPEN; it becomes REFERRED when a referral is filed.
  OPEN: ['REFERRED'],
  REFERRED: ['UNDER_REVIEW', 'CLOSED'],
  UNDER_REVIEW: ['FOLLOW_UP', 'REFERRED', 'CLOSED'],
  FOLLOW_UP: ['UNDER_REVIEW', 'CLOSED'],
  CLOSED: [],
};

export type CasePriority = 'ROUTINE' | 'URGENT';

export const CASE_PRIORITIES: CasePriority[] = ['ROUTINE', 'URGENT'];

export type ObservationSeverity = 'MILD' | 'MODERATE' | 'SEVERE';

export const OBSERVATION_SEVERITIES: ObservationSeverity[] = ['MILD', 'MODERATE', 'SEVERE'];

export type ReferralStatus = 'PENDING' | 'ACCEPTED' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED';

export const REFERRAL_STATUSES: ReferralStatus[] = [
  'PENDING',
  'ACCEPTED',
  'IN_REVIEW',
  'COMPLETED',
  'CANCELLED',
];

export const REFERRAL_TRANSITIONS: Readonly<Record<ReferralStatus, readonly ReferralStatus[]>> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['IN_REVIEW', 'COMPLETED', 'CANCELLED'],
  IN_REVIEW: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export type FollowUpStatus = 'PENDING' | 'COMPLETED' | 'MISSED' | 'CANCELLED';

export const FOLLOW_UP_STATUSES: FollowUpStatus[] = [
  'PENDING',
  'COMPLETED',
  'MISSED',
  'CANCELLED',
];

export const FOLLOW_UP_TRANSITIONS: Readonly<Record<FollowUpStatus, readonly FollowUpStatus[]>> = {
  PENDING: ['COMPLETED', 'MISSED', 'CANCELLED'],
  COMPLETED: [],
  MISSED: [],
  CANCELLED: [],
};

export type HealthCampStatus = 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED';

export const HEALTH_CAMP_STATUSES: HealthCampStatus[] = [
  'DRAFT',
  'PUBLISHED',
  'COMPLETED',
  'CANCELLED',
];

export const HEALTH_CAMP_TRANSITIONS: Readonly<
  Record<HealthCampStatus, readonly HealthCampStatus[]>
> = {
  DRAFT: ['PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export type CampAttendanceStatus = 'REGISTERED' | 'ATTENDED' | 'ABSENT';

export const CAMP_ATTENDANCE_STATUSES: CampAttendanceStatus[] = [
  'REGISTERED',
  'ATTENDED',
  'ABSENT',
];

/** Administrative sex recorded on a household register, not a clinical attribute. */
export type MemberSex = 'FEMALE' | 'MALE' | 'OTHER';

/** The signed-in account plus the role the server resolved for it. */
export interface HealthcareSession {
  userId: string;
  role: HealthcareRole;
}

/** Server-side role view of a profile. Never sent to a client to be trusted back. */
export interface HealthcareProfile {
  id: string;
  role: HealthcareRole;
  createdAt: string;
  updatedAt: string;
}

export interface AshaProfile {
  userId: string;
  fullName: string;
  registrationNumber: string | null;
  area: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorProfile {
  userId: string;
  fullName: string;
  registrationNumber: string | null;
  speciality: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Household {
  id: string;
  /** Human-facing register number, e.g. `HH-0007`. Assigned by the server. */
  code: string;
  name: string;
  /** Administrative address. Not a geocode and not a location history. */
  addressLine: string | null;
  assignedAshaId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A person on a household register.
 *
 * Demographics and administration only: name, age, sex, relation to the head of
 * the household. There is no column for a symptom, a cycle, a mood or a pain score,
 * and the observation that describes what a health worker actually saw lives in
 * `case_observations`, attached to a case, written by a health worker.
 */
export interface HouseholdMember {
  id: string;
  householdId: string;
  fullName: string;
  ageYears: number | null;
  sex: MemberSex | null;
  relationToHead: string | null;
  /** Administrative note (e.g. "student", "moved in 2026"). Never clinical. */
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthCase {
  id: string;
  caseNumber: string;
  householdId: string;
  householdMemberId: string;
  createdByAshaId: string;
  assignedDoctorId: string | null;
  status: CaseStatus;
  priority: CasePriority;
  /**
   * A short administrative description of why the case was opened — "referred for
   * review", not a diagnosis. Written by a health worker, in their words.
   */
  summary: string;
  source: CaseSource;
  /** Set when the case came out of a health camp, so the doctor can see the origin. */
  campId: string | null;
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * What a health worker saw or was told.
 *
 * `reportedSymptoms` is a list of the words used, never a conclusion drawn from
 * them. `referralReason` is what the worker wants a clinician to look at; it is not
 * a diagnosis and the field name says so in every language the UI renders.
 */
export interface CaseObservation {
  id: string;
  caseId: string;
  householdMemberId: string;
  recordedByAshaId: string;
  observedOn: string;
  reportedSymptoms: string[];
  severity: ObservationSeverity;
  durationDays: number | null;
  notes: string | null;
  referralReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Referral {
  id: string;
  caseId: string;
  referredByAshaId: string;
  referredToDoctorId: string;
  reason: string;
  priority: CasePriority;
  status: ReferralStatus;
  campId: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalNote {
  id: string;
  caseId: string;
  doctorId: string;
  assessment: string;
  observations: string | null;
  advice: string;
  followUpOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Prescription {
  id: string;
  caseId: string;
  clinicalNoteId: string | null;
  doctorId: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUp {
  id: string;
  caseId: string;
  assignedToUserId: string;
  assignedRole: HealthcareRole;
  dueDate: string;
  notes: string | null;
  status: FollowUpStatus;
  completedAt: string | null;
  completedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthCamp {
  id: string;
  title: string;
  description: string | null;
  campDate: string;
  startTime: string;
  endTime: string;
  location: string;
  organizerUserId: string;
  capacity: number;
  status: HealthCampStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CampRegistration {
  id: string;
  campId: string;
  userId: string;
  registeredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampAttendance {
  id: string;
  campId: string;
  registrationId: string;
  status: CampAttendanceStatus;
  markedByUserId: string | null;
  markedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One sensitive operation, as recorded in `audit_logs`.
 *
 * The list is closed and the convention is `ENTITY_VERB_PAST`, because an audit row
 * is read by somebody looking for a moment rather than a noun: "a prescription was
 * issued" is a sentence, `prescription.create` is a table name. Entries are added
 * when an operation is added, which is the only time the list should change.
 *
 * READS ARE IN HERE, AND THAT IS THE POINT
 * Healthcare is the first part of PMSify where one record is read by several people.
 * A trail of writes alone answers "who changed this"; it cannot answer "who looked
 * at this", and for a case record that is the question an investigation usually
 * starts with. So `CASE_READ` and `HOUSEHOLD_READ` exist, and their metadata carries
 * counts rather than content — see `assertAuditableMetadata`, which is what stops a
 * read from becoming a second copy of the record.
 */
export const AUDIT_ACTIONS = [
  'CASE_CREATED',
  'CASE_UPDATED',
  'CASE_READ',
  'OBSERVATION_CREATED',
  'REFERRAL_CREATED',
  'REFERRAL_UPDATED',
  'REFERRAL_ACCEPTED',
  'REFERRAL_REVIEWED',
  'REFERRAL_COMPLETED',
  'REFERRAL_CANCELLED',
  'CLINICAL_NOTE_CREATED',
  'PRESCRIPTION_CREATED',
  'PRESCRIPTION_UPDATED',
  'FOLLOW_UP_CREATED',
  'FOLLOW_UP_COMPLETED',
  'FOLLOW_UP_MISSED',
  'FOLLOW_UP_CANCELLED',
  'CAMP_CREATED',
  'CAMP_UPDATED',
  'CAMP_STATUS_CHANGED',
  'CAMP_REGISTRATION_CREATED',
  'CAMP_REGISTRATION_CANCELLED',
  'CAMP_ATTENDANCE_UPDATED',
  'ROLE_ASSIGNED',
  'ASHA_PROFILE_CREATED',
  'DOCTOR_PROFILE_CREATED',
  'HOUSEHOLD_CREATED',
  'HOUSEHOLD_UPDATED',
  'HOUSEHOLD_READ',
  'MEMBER_CREATED',
  'MEMBER_UPDATED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * The entity kinds an audit row can name. Deliberately a closed list: a free-text
 * entity type is how "notes" ends up as an entity and a private clinical note ends
 * up in an audit trail.
 *
 * `household` and `household_member` are here for the same reason the read actions
 * are: a register of who lives at an address is health data, and a trail that
 * recorded case work without recording who opened the register would be a record of
 * the treatment with none of the context.
 */
export const AUDIT_ENTITIES = [
  'health_case',
  'case_observation',
  'referral',
  'clinical_note',
  'prescription',
  'follow_up',
  'health_camp',
  'camp_registration',
  'camp_attendance',
  'profile',
  'asha_profile',
  'doctor_profile',
  'household',
  'household_member',
] as const;

export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

/**
 * One audit row.
 *
 * `metadata` is a small set of non-identifying facts about *what changed* — a
 * status, a count, an entity reference. It is sanitized before it is written (see
 * `sanitizeAuditMetadata` in `@/lib/healthcare/audit`): no note text, no medicine
 * name, no symptom, no credential. An audit trail that is useful is not an audit
 * trail that copies the record.
 */
export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string | null;
  metadata: Json;
  createdAt: string;
}

/* ------------------------------------------------------------------ *
 * Wire shapes.                                                        *
 * ------------------------------------------------------------------ *
 * These are what cross the network to the browser. They are assembled from the
 * rows above by `@/lib/healthcare/service`, and they never carry a user id for a
 * third party: a person is identified in the healthcare world by the register
 * number, the role-scoped name of the ASHA worker or doctor who acted, and never by
 * a Supabase account id.
 */

export interface AshaProfileDto {
  fullName: string;
  registrationNumber: string | null;
  area: string | null;
}

export interface DoctorProfileDto {
  /**
   * The doctor's own account id, which is the `doctorId` a referral is filed against.
   *
   * This is the one field that makes the referral flow reachable at all, and it is
   * here for a specific reason rather than by default: `createReferral` is the only
   * healthcare write that takes an id for a *third party* from the client, and it is
   * safe only because the id is chosen from a roster the server handed out. Shipping a
   * roster without ids meant the documented safety model could not be used, which is
   * worse than the field being absent — the referral form had no legal way to exist.
   *
   * It is the same `user_id` the rest of the service already keys referrals by, so
   * nothing new is exposed: no email, no account metadata, nothing personal. A member
   * cannot reach `listDoctors` at all (`requireStaff`), so this never reaches a plain
   * user, and it is not a secret — the doctor is being offered for referral work.
   */
  id: string;
  fullName: string;
  registrationNumber: string | null;
  speciality: string | null;
}

export interface HouseholdSummaryDto {
  id: string;
  code: string;
  name: string;
  addressLine: string | null;
  memberCount: number;
  openCaseCount: number;
}

export interface MemberDto {
  id: string;
  householdId: string;
  fullName: string;
  ageYears: number | null;
  sex: MemberSex | null;
  relationToHead: string | null;
  note: string | null;
}

export interface HouseholdDetailDto {
  household: HouseholdSummaryDto;
  members: MemberDto[];
  asha: AshaProfileDto | null;
}

export interface ObservationDto {
  id: string;
  caseId: string;
  observedOn: string;
  reportedSymptoms: string[];
  severity: ObservationSeverity;
  durationDays: number | null;
  notes: string | null;
  referralReason: string | null;
  recordedByName: string;
  createdAt: string;
}

export interface CaseSummaryDto {
  id: string;
  caseNumber: string;
  memberId: string;
  memberName: string;
  householdId: string;
  householdCode: string;
  status: CaseStatus;
  priority: CasePriority;
  summary: string;
  source: CaseSource;
  openedAt: string;
  updatedAt: string;
}

export interface ReferralDto {
  id: string;
  caseId: string;
  caseNumber: string;
  memberName: string;
  householdCode: string;
  reason: string;
  priority: CasePriority;
  status: ReferralStatus;
  campId: string | null;
  doctorName: string | null;
  ashaName: string | null;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
}

export interface ClinicalNoteDto {
  id: string;
  caseId: string;
  doctorName: string;
  assessment: string;
  observations: string | null;
  advice: string;
  followUpOn: string | null;
  createdAt: string;
}

export interface PrescriptionDto {
  id: string;
  caseId: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  doctorName: string;
  createdAt: string;
}

export interface FollowUpDto {
  id: string;
  caseId: string;
  caseNumber: string;
  memberName: string;
  assignedRole: HealthcareRole;
  dueDate: string;
  notes: string | null;
  status: FollowUpStatus;
  completedAt: string | null;
  createdAt: string;
}

export interface HealthCampDto {
  id: string;
  title: string;
  description: string | null;
  campDate: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number;
  status: HealthCampStatus;
  registeredCount: number;
  attendedCount: number;
  isRegisteredByViewer: boolean;
  isFull: boolean;
  /**
   * Whether *this viewer* may run the camp: publish it, complete it, cancel it, and
   * mark attendance against its roster.
   *
   * Derived on the server from the same rule `changeCampStatus` and
   * `markCampAttendance` enforce — the organiser or an `ADMIN` — so the buttons the UI
   * draws and the operations the service permits come from one place and cannot
   * disagree. It is a capability, not a permission: a client that sends the mutation
   * anyway is still refused, and hiding the button is a courtesy rather than the
   * control.
   *
   * Always present, and always `false` for a plain `USER`. It is not omitted for a
   * member the way `referredCaseCount` is, because "may I manage this camp" is a
   * question every viewer can be answered `no` to, whereas the referred-case count is
   * a fact about the camp that some viewers are not entitled to.
   */
  canManage: boolean;
  /** Only present for staff roles; a plain USER never receives it. */
  referredCaseCount?: number;
}

export interface CampRegistrationDto {
  registrationId: string;
  campId: string;
  campTitle: string;
  campDate: string;
  startTime: string;
  endTime: string;
  location: string;
  registeredAt: string;
}

export interface CampRosterEntryDto {
  registrationId: string;
  userId: string;
  registeredAt: string;
  attendanceStatus: CampAttendanceStatus;
  markedAt: string | null;
}

export interface CaseReviewDto {
  case: CaseSummaryDto;
  observations: ObservationDto[];
  referrals: ReferralDto[];
  clinicalNotes: ClinicalNoteDto[];
  prescriptions: PrescriptionDto[];
  followUps: FollowUpDto[];
  member: MemberDto;
  householdCode: string;
  ashaName: string | null;
}

export interface AshaDashboardDto {
  assignedHouseholds: number;
  householdMembers: number;
  openCases: number;
  pendingReferrals: number;
  upcomingFollowUps: number;
  campsThisMonth: number;
  recentCases: CaseSummaryDto[];
  upcomingFollowUpsList: FollowUpDto[];
  pendingReferralList: ReferralDto[];
  campActivity: { campId: string; title: string; campDate: string; status: HealthCampStatus }[];
}

export interface DoctorDashboardDto {
  pendingReferrals: number;
  casesUnderReview: number;
  followUpsDue: number;
  recentCases: CaseSummaryDto[];
  pendingReferralList: ReferralDto[];
  followUpList: FollowUpDto[];
  campReferrals: ReferralDto[];
}
