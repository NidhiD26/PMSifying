import { ZodError, z, type ZodType } from 'zod';
import {
  type AshaProfileDto,
  type CampAttendanceStatus,
  type CampRosterEntryDto,
  type CaseReviewDto,
  type CaseSummaryDto,
  type ClinicalNoteDto,
  type DoctorDashboardDto,
  type DoctorProfileDto,
  type FollowUpDto,
  type HealthCampDto,
  type HouseholdDetailDto,
  type HouseholdSummaryDto,
  type MemberDto,
  type ObservationDto,
  type PrescriptionDto,
  type ReferralDto,
  type AshaDashboardDto,
} from '@/types/healthcare';
import type {
  AshaProfileRow,
  CaseObservationRow,
  ClinicalNoteRow,
  DoctorProfileRow,
  FollowUpRow,
  HealthCampRow,
  HealthCaseRow,
  HouseholdMemberRow,
  HouseholdRow,
  PrescriptionRow,
  ReferralRow,
} from '@/types/healthcare-db';
import { assertAuditableMetadata, assertAuditVocabulary } from '@/lib/healthcare/audit';
import { forbidden, invalidRequest, notVisible, ruleViolation, toApiError } from '@/lib/healthcare/errors';
import { requireAsha, requireDoctor, requireStaff, type HealthcareActor } from '@/lib/healthcare/session';
import {
  ACTIVE_REVIEW_STATUSES,
  OPEN_CASE_STATUSES,
  nextCaseStatus,
  nextFollowUpStatus,
  nextReferralStatus,
  canTransitionHealthCamp,
} from '@/lib/healthcare/state';
import type {
  CaseFilter,
  CampFilter,
  CreateCampInput,
  FollowUpFilter,
  HealthcareStore,
  ReferralFilter,
} from '@/lib/healthcare/store';
import {
  caseListQuerySchema,
  campListQuerySchema,
  createCampSchema,
  createCaseSchema,
  createClinicalNoteSchema,
  createFollowUpSchema,
  createHouseholdSchema,
  createMemberSchema,
  createObservationSchema,
  createPrescriptionSchema,
  createReferralSchema,
  fieldPaths,
  followUpListQuerySchema,
  markAttendanceSchema,
  referralListQuerySchema,
  updateCaseSchema,
  updateHouseholdSchema,
  updateMemberSchema,
  type CaseListQuery,
  type CampListQuery,
  type FollowUpListQuery,
  type ReferralListQuery,
} from '@/lib/healthcare/validation';

/**
 * Who may do what, and what the browser is told about it.
 *
 * THREE LAYERS, AND THIS IS THE MIDDLE ONE
 *   - the schemas in `validation.ts` say what a well-formed request looks like;
 *   - this module says whether *this* caller may make it, and shapes the answer;
 *   - RLS says whether the row may be touched at all, and is the layer the other two
 *     cannot get past.
 *
 * The middle layer is not redundant. It is the only one that can produce the right
 * *answer*: RLS can only say yes or no, and answering "no" as a database permission
 * failure would tell a worker that the endpoint exists and describe its rule. It also
 * has to exist because the in-memory store does not implement RLS, so a service that
 * leaned on the database alone would be a service whose cross-household access had
 * never been tested — and would pass every test that used it.
 *
 * WHY OWNERSHIP IS CHECKED HERE AND NOT LEFT TO RLS
 * The scope rules below are written to agree with the policies in
 * `0004_healthcare_rls.sql`, clause for clause: a household belongs to the ASHA
 * assigned to it, a case belongs to the household's worker and to the doctor it is
 * assigned to, and an administrator sees everything. If a check here is looser than
 * the policy, nothing is exposed — the database still refuses — but the caller gets
 * a 502 instead of a 404. If it is tighter, a legitimate worker is locked out of
 * their own work. Both are bugs, and both are what the two files existing side by
 * side is meant to catch.
 */

/* ------------------------------------------------------------------ *
 * Parsing                                                              *
 * ------------------------------------------------------------------ */

function fromZod(error: unknown): never {
  if (error instanceof ZodError) {
    // Field paths, not issue messages: a path may be echoed to a form, and an issue
    // message here would carry the submitted value.
    throw invalidRequest(fieldPaths(error));
  }
  throw toApiError(error);
}

function parse<S extends ZodType>(schema: S, value: unknown): z.infer<S> {
  try {
    return schema.parse(value) as z.infer<S>;
  } catch (error) {
    fromZod(error);
  }
}

/* ------------------------------------------------------------------ *
 * Scope. The mirror of the RLS policies.                               *
 * ------------------------------------------------------------------ */

/** True for the ASHA worker a household is assigned to, and for an administrator. */
function maySeeHousehold(actor: HealthcareActor, household: HouseholdRow): boolean {
  if (actor.role === 'ADMIN') return true;
  return household.assigned_asha_id === actor.userId;
}

/**
 * True for the ASHA whose patch this is, the doctor the case is assigned to, or an
 * administrator. A referral alone is not enough: a doctor sees a case they have been
 * *given*, which is what acceptance means, so a referral they have not yet accepted
 * stays with the worker who sent it.
 */
function maySeeCase(
  actor: HealthcareActor,
  row: { household_id: string; assigned_doctor_id: string | null },
  household: HouseholdRow | null
): boolean {
  if (actor.role === 'ADMIN') return true;
  if (household && household.assigned_asha_id === actor.userId) return true;
  return row.assigned_doctor_id === actor.userId;
}

/**
 * Loads a case the caller is allowed to see, or answers "not found".
 *
 * `notVisible` rather than `forbidden`, and the reason is the whole point of doing
 * this in the service: a 403 on a case id confirms the case exists, which turns any
 * id a caller can reach into a way of discovering that a household they cover has a
 * case open, or that a doctor they have heard of is working one. The row is not
 * hidden by the answer — the answer is the hiding.
 */
/** A case the caller may see. `NonNullable` because the throw below is the filter. */
type VisibleCase = {
  row: NonNullable<Awaited<ReturnType<HealthcareStore['getCase']>>>;
  household: HouseholdRow | null;
};

async function loadVisibleCase(
  store: HealthcareStore,
  actor: HealthcareActor,
  caseId: string
): Promise<VisibleCase> {
  const row = await store.getCase(caseId);
  // RLS has already hidden a case the caller may not see, so `null` here covers
  // both "there is no such case" and "there is, and it is not yours" — the same
  // answer, deliberately.
  if (!row) throw notVisible();

  const household = await store.getHousehold(row.household_id);
  if (!maySeeCase(actor, row, household)) throw notVisible();

  return { row, household };
}

/**
 * The account a follow-up on this case addressed to `role` belongs to, or `null` if
 * the case has nobody in that role.
 *
 * Resolved from the case rather than from the request, which is the whole design
 * here. `follow_ups` has both an `assigned_role` and an `assigned_to_user_id`, and
 * the first is a label on the second — so the pair has to agree, and the only
 * trustworthy source for the second is the case:
 *
 *   - `ASHA`    → whoever is assigned to the household, read from the household
 *                 rather than from the observation, because those two can drift and
 *                 a follow-up should go to the worker who can actually visit today.
 *   - `DOCTOR`  → the case's assigned doctor, so only a case a doctor has been given
 *                 can produce a doctor follow-up.
 *   - `ADMIN`   → nobody in particular. An administrator oversees, and an oversight
 *                 queue that is addressed to one named administrator is an oversight
 *                 queue for one person who is off on leave. `null` here means the
 *                 request is refused: there is no honest way to fill this column, and
 *                 inventing a recipient would put a follow-up in a queue that nobody
 *                 reads, which is worse than no follow-up because it looks handled.
 */
async function resolveFollowUpAssignee(
  store: HealthcareStore,
  row: { household_id: string; assigned_doctor_id: string | null },
  role: 'ASHA' | 'DOCTOR' | 'ADMIN'
): Promise<string | null> {
  if (role === 'DOCTOR') return row.assigned_doctor_id;
  if (role === 'ASHA') {
    const household = await store.getHousehold(row.household_id);
    return household?.assigned_asha_id ?? null;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Row to wire shape.                                                   *
 * ------------------------------------------------------------------ */

const toAshaDto = (row: AshaProfileRow): AshaProfileDto => ({
  fullName: row.full_name,
  registrationNumber: row.registration_number,
  area: row.area,
});

const toDoctorDto = (row: DoctorProfileRow): DoctorProfileDto => ({
  // `user_id` is the canonical doctor identifier the service already keys referrals by
  // (`referrals.referred_to_doctor_id`, and the comparison in `acceptReferral`). Handing
  // out that same value is what lets a worker file a referral at all, and it is the same
  // account id rather than a new surrogate key, so the two can never be mixed up.
  id: row.user_id,
  fullName: row.full_name,
  registrationNumber: row.registration_number,
  speciality: row.speciality,
});

const toMemberDto = (row: HouseholdMemberRow): MemberDto => ({
  id: row.id,
  householdId: row.household_id,
  fullName: row.full_name,
  ageYears: row.age_years,
  sex: row.sex,
  relationToHead: row.relation_to_head,
  note: row.note,
});

/**
 * A household for a list, with its two counts.
 *
 * The counts are asked for per household because there is no aggregate in the port
 * and adding one for a list of five would be an optimisation nobody asked for; at the
 * size a worker's patch actually holds, five round trips beat a scan of every case
 * in the table.
 */
async function toHouseholdSummary(
  store: HealthcareStore,
  row: HouseholdRow
): Promise<HouseholdSummaryDto> {
  const [memberCount, openCaseCount] = await Promise.all([
    store.listMembers(row.id).then((members) => members.length),
    store.countOpenCasesForHousehold(row.id),
  ]);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    addressLine: row.address_line,
    memberCount,
    openCaseCount,
  };
}

/**
 * A case as a list row, which means it needs the two names beside it.
 *
 * A case with no name against it is the failure mode here: a doctor scanning a queue
 * of five cannot tell one village from another, and a case summary is not a place a
 * member is identified by, only the register number and the worker's name are.
 */
/**
 * The names a case row needs beside it: who it is about, and where they are.
 *
 * Three different lists in this module want the same pair, and each of them used to
 * work it out separately, which is how a referral came to carry a household code in
 * its `caseNumber` field. One helper, and the case number comes from the case.
 */
interface CaseNames {
  caseNumber: string;
  memberName: string;
  householdCode: string;
}

const EMPTY_NAMES: CaseNames = { caseNumber: '', memberName: '', householdCode: '' };

async function namesForCase(
  store: HealthcareStore,
  caseId: string,
  cache: Map<string, CaseNames>
): Promise<CaseNames> {
  const cached = cache.get(caseId);
  if (cached) return cached;

  const row = await store.getCase(caseId);
  if (!row) {
    cache.set(caseId, EMPTY_NAMES);
    return EMPTY_NAMES;
  }

  const [member, household] = await Promise.all([
    store.getMember(row.household_member_id),
    store.getHousehold(row.household_id),
  ]);
  const names: CaseNames = {
    caseNumber: row.case_number,
    memberName: member?.full_name ?? '',
    householdCode: household?.code ?? '',
  };
  cache.set(caseId, names);
  return names;
}

async function toCaseSummary(
  store: HealthcareStore,
  row: HealthCaseRow,
  cache: Map<string, CaseNames>
): Promise<CaseSummaryDto> {
  const names = await namesForCase(store, row.id, cache);
  return {
    id: row.id,
    caseNumber: row.case_number,
    memberId: row.household_member_id,
    memberName: names.memberName,
    householdId: row.household_id,
    householdCode: names.householdCode,
    status: row.status,
    priority: row.priority,
    summary: row.summary,
    source: row.source,
    openedAt: row.opened_at,
    updatedAt: row.updated_at,
  };
}

async function toReferralDto(
  store: HealthcareStore,
  row: ReferralRow,
  caseNames: Map<string, CaseNames>,
  ashaNames: Map<string, string>,
  doctorNames: Map<string, string>
): Promise<ReferralDto> {
  const names = await namesForCase(store, row.case_id, caseNames);
  return {
    id: row.id,
    caseId: row.case_id,
    caseNumber: names.caseNumber,
    memberName: names.memberName,
    householdCode: names.householdCode,
    reason: row.reason,
    priority: row.priority,
    status: row.status,
    campId: row.camp_id,
    doctorName: await doctorName(store, row.referred_to_doctor_id, doctorNames),
    ashaName: await ashaName(store, row.referred_by_asha_id, ashaNames),
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    completedAt: row.completed_at,
  };
}

async function ashaName(
  store: HealthcareStore,
  userId: string,
  cache: Map<string, string>
): Promise<string | null> {
  const cached = cache.get(userId);
  if (cached !== undefined) return cached;
  const profile = await store.getAshaProfile(userId);
  const name = profile?.full_name ?? null;
  cache.set(userId, name ?? '');
  return name;
}

async function doctorName(
  store: HealthcareStore,
  userId: string,
  cache: Map<string, string>
): Promise<string | null> {
  const cached = cache.get(userId);
  if (cached !== undefined) return cached || null;
  const profile = await store.getDoctorProfile(userId);
  const name = profile?.full_name ?? null;
  cache.set(userId, name ?? '');
  return name;
}

async function toClinicalNoteDto(
  store: HealthcareStore,
  row: ClinicalNoteRow,
  cache: Map<string, string>
): Promise<ClinicalNoteDto> {
  return {
    id: row.id,
    caseId: row.case_id,
    doctorName: (await doctorName(store, row.doctor_id, cache)) ?? '',
    assessment: row.assessment,
    observations: row.observations,
    advice: row.advice,
    followUpOn: row.follow_up_on,
    createdAt: row.created_at,
  };
}

async function toPrescriptionDto(
  store: HealthcareStore,
  row: PrescriptionRow,
  cache: Map<string, string>
): Promise<PrescriptionDto> {
  return {
    id: row.id,
    caseId: row.case_id,
    medicineName: row.medicine_name,
    dosage: row.dosage,
    frequency: row.frequency,
    duration: row.duration,
    instructions: row.instructions,
    doctorName: (await doctorName(store, row.doctor_id, cache)) ?? '',
    createdAt: row.created_at,
  };
}

async function toFollowUpDto(
  store: HealthcareStore,
  row: FollowUpRow,
  caseNames: Map<string, CaseNames>
): Promise<FollowUpDto> {
  const names = await namesForCase(store, row.case_id, caseNames);
  return {
    id: row.id,
    caseId: row.case_id,
    caseNumber: names.caseNumber,
    memberName: names.memberName,
    assignedRole: row.assigned_role,
    dueDate: row.due_date,
    notes: row.notes,
    status: row.status,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

async function toObservationDto(
  store: HealthcareStore,
  row: CaseObservationRow,
  cache: Map<string, string>
): Promise<ObservationDto> {
  return {
    id: row.id,
    caseId: row.case_id,
    observedOn: row.observed_on,
    reportedSymptoms: row.reported_symptoms,
    severity: row.severity,
    durationDays: row.duration_days,
    notes: row.notes,
    referralReason: row.referral_reason,
    recordedByName: (await ashaName(store, row.recorded_by_asha_id, cache)) ?? '',
    createdAt: row.created_at,
  };
}

/* ------------------------------------------------------------------ *
 * Audit                                                                *
 * ------------------------------------------------------------------ */

/**
 * Writes one audit row, or lets the operation it describes go ahead without one.
 *
 * A failure to record is a failure of the operation. An audit trail that can be
 * silently skipped is not a trail, and the alternative — a best-effort write that
 * fails quietly — produces exactly the record an investigator would trust. So the
 * audit call is awaited before the function returns, and a rejection propagates.
 *
 * The metadata is passed through `assertAuditableMetadata`, so a fact that is not on
 * the allow-list is refused here rather than written and later regretted.
 */
async function audit(
  store: HealthcareStore,
  input: {
    action: string;
    entity: string;
    entityId?: string | null;
    actorId: string;
    actorRole: string;
    metadata?: Record<string, string | number | boolean | null | undefined>;
  }
): Promise<void> {
  const { action, entity } = assertAuditVocabulary(input.action, input.entity);
  const metadata = assertAuditableMetadata({
    role: input.actorRole,
    ...(input.metadata ?? {}),
  });
  await store.recordAuditEvent({
    action,
    entity,
    entityId: input.entityId ?? null,
    actorId: input.actorId,
    metadata,
  });
}

/* ------------------------------------------------------------------ *
 * Households and members                                               *
 * ------------------------------------------------------------------ */

export async function createHousehold(
  store: HealthcareStore,
  args: { actor: HealthcareActor; input: unknown }
): Promise<HouseholdSummaryDto> {
  const asha = requireAsha(args.actor);
  const input = parse(createHouseholdSchema, args.input);

  const row = await store.createHousehold(asha.user_id, {
    name: input.name,
    addressLine: input.addressLine,
  });
  await audit(store, {
    action: 'HOUSEHOLD_CREATED',
    entity: 'household',
    entityId: row.id,
    actorId: args.actor.userId,
    actorRole: args.actor.role,
  });
  return toHouseholdSummary(store, row);
}

export async function listHouseholds(
  store: HealthcareStore,
  args: { actor: HealthcareActor }
): Promise<HouseholdSummaryDto[]> {
  const actor = requireStaff(args.actor);
  // An administrator has no patch of their own, so the list is not "my households" for
  // them — but the port has no list-everything read, and one is not added for a role
  // that oversees rather than works. An administrator sees households through a case.
  if (actor.role !== 'ASHA' || !actor.ashaId) return [];
  const rows = await store.listHouseholds(actor.ashaId);
  return Promise.all(rows.map((row) => toHouseholdSummary(store, row)));
}

export async function getHouseholdDetail(
  store: HealthcareStore,
  args: { actor: HealthcareActor; householdId: string }
): Promise<HouseholdDetailDto> {
  const row = await store.getHousehold(args.householdId);
  if (!row || !maySeeHousehold(args.actor, row)) throw notVisible();

  const [members, ashaProfile] = await Promise.all([
    store.listMembers(row.id),
    store.getAshaProfile(row.assigned_asha_id),
  ]);

  await audit(store, {
    action: 'HOUSEHOLD_READ',
    entity: 'household',
    entityId: row.id,
    actorId: args.actor.userId,
    actorRole: args.actor.role,
  });

  return {
    household: await toHouseholdSummary(store, row),
    members: members.map(toMemberDto),
    asha: ashaProfile ? toAshaDto(ashaProfile) : null,
  };
}

export async function updateHousehold(
  store: HealthcareStore,
  args: { actor: HealthcareActor; householdId: string; input: unknown }
): Promise<HouseholdSummaryDto> {
  const input = parse(updateHouseholdSchema, args.input);
  const current = await store.getHousehold(args.householdId);
  if (!current || !maySeeHousehold(args.actor, current)) throw notVisible();

  const row = await store.updateHousehold(current.id, {
    name: input.name,
    address_line: input.addressLine,
  });
  if (!row) throw notVisible();

  await audit(store, {
    action: 'HOUSEHOLD_UPDATED',
    entity: 'household',
    entityId: row.id,
    actorId: args.actor.userId,
    actorRole: args.actor.role,
  });
  return toHouseholdSummary(store, row);
}

export async function createMember(
  store: HealthcareStore,
  args: { actor: HealthcareActor; householdId: string; input: unknown }
): Promise<MemberDto> {
  const asha = requireAsha(args.actor);
  const input = parse(createMemberSchema, args.input);
  const household = await store.getHousehold(args.householdId);
  if (!household || household.assigned_asha_id !== asha.user_id) throw notVisible();

  const row = await store.createMember(household.id, {
    fullName: input.fullName,
    ageYears: input.ageYears ?? null,
    sex: input.sex ?? null,
    relationToHead: input.relationToHead,
    note: input.note,
  });

  await audit(store, {
    action: 'MEMBER_CREATED',
    entity: 'household_member',
    entityId: row.id,
    actorId: args.actor.userId,
    actorRole: args.actor.role,
    metadata: { memberCount: 1 },
  });
  return toMemberDto(row);
}

export async function listMembers(
  store: HealthcareStore,
  args: { actor: HealthcareActor; householdId: string }
): Promise<MemberDto[]> {
  const rows = await store.listMembers(args.householdId);
  const household = await store.getHousehold(args.householdId);

  if (household && maySeeHousehold(args.actor, household)) {
    return rows.map(toMemberDto);
  }

  // A doctor has no patch, so "their household" is not a thing. What they are allowed
  // is the register entry for the person on a case of theirs, and the unit of access
  // is the MEMBER, not the household — which is why this does not fall back to "you
  // have one case here, so here is the register". A household is six people and a
  // doctor referred one of them for one condition; handing over the other five means
  // handing over their ages, their sex, and their relation to the head of the house
  // for no clinical reason at all. RLS says the same thing, row by row.
  const cases = await store.listCasesByDoctor(args.actor.userId, { limit: 100 });
  const visibleMemberIds = new Set(
    cases.filter((row) => row.household_id === args.householdId).map((row) => row.household_member_id)
  );
  if (visibleMemberIds.size === 0) throw notVisible();

  return rows.filter((row) => visibleMemberIds.has(row.id)).map(toMemberDto);
}

export async function updateMember(
  store: HealthcareStore,
  args: { actor: HealthcareActor; memberId: string; input: unknown }
): Promise<MemberDto> {
  const asha = requireAsha(args.actor);
  const input = parse(updateMemberSchema, args.input);
  const member = await store.getMember(args.memberId);
  if (!member) throw notVisible();
  const household = await store.getHousehold(member.household_id);
  if (!household || household.assigned_asha_id !== asha.user_id) throw notVisible();

  const row = await store.updateMember(member.id, {
    full_name: input.fullName,
    age_years: input.ageYears ?? null,
    sex: input.sex ?? null,
    relation_to_head: input.relationToHead,
    note: input.note,
  });
  if (!row) throw notVisible();

  await audit(store, {
    action: 'MEMBER_UPDATED',
    entity: 'household_member',
    entityId: row.id,
    actorId: args.actor.userId,
    actorRole: args.actor.role,
  });
  return toMemberDto(row);
}

/* ------------------------------------------------------------------ *
 * Cases and observations                                               *
 * ------------------------------------------------------------------ */

export async function createCase(
  store: HealthcareStore,
  args: { actor: HealthcareActor; input: unknown }
): Promise<CaseSummaryDto> {
  const asha = requireAsha(args.actor);
  const input = parse(createCaseSchema, args.input);

  // The member has to be on the household named, and the household has to be this
  // worker's. Both are checked here and again by the insert policy, because the two
  // disagreeing is how a case ends up attributed to a worker who never saw it.
  const household = await store.getHousehold(input.householdId);
  if (!household || household.assigned_asha_id !== asha.user_id) throw notVisible();

  const member = await store.getMember(input.memberId);
  if (!member || member.household_id !== household.id) throw notVisible();

  const row = await store.createCase({
    householdId: household.id,
    householdMemberId: member.id,
    createdByAshaId: asha.user_id,
    summary: input.summary,
    priority: input.priority,
    source: input.source,
    campId: input.campId ?? null,
  });

  await audit(store, {
    action: 'CASE_CREATED',
    entity: 'health_case',
    entityId: row.id,
    actorId: args.actor.userId,
    actorRole: args.actor.role,
    metadata: { priority: row.priority, source: row.source, campId: row.camp_id },
  });
  return toCaseSummary(store, row, new Map());
}

/**
 * Corrects a case's own description of itself.
 *
 * Only the worker who opened it may do this, and only while it is still open. Both
 * halves of that are deliberate:
 *
 *   - the opener only, because the summary is their account of why they opened the
 *     case. A doctor rewriting an ASHA's reason for raising something is a different
 *     conversation, and the place for it is the clinical note.
 *   - open cases only, because once a doctor has accepted, assessed, or closed this
 *     case, the record of the decision is the clinical note and the referral, and
 *     those are append-only. A summary that can still be rewritten afterwards is a
 *     summary that will be: better reason to write it carefully the first time.
 *
 * The alternative to having this is worse than having it locked. Without an edit, a
 * worker who mistypes a summary has two honest options and both are bad — leave the
 * error in the record that a doctor will read, or open a second case about the same
 * person, which splits one problem into two and makes the register lie.
 */
export async function updateCase(
  store: HealthcareStore,
  args: { actor: HealthcareActor; caseId: string; input: unknown }
): Promise<CaseSummaryDto> {
  const asha = requireAsha(args.actor);
  const input = parse(updateCaseSchema, args.input);
  const { row } = await loadVisibleCase(store, args.actor, args.caseId);
  if (row.created_by_asha_id !== asha.user_id) throw notVisible();

  // Only while nobody has picked it up. `OPEN_CASE_STATUSES` is too permissive here:
  // it includes a case that is under review, and by then a clinician's note and a
  // referral reason are attached to the same case, so a summary that changed
  // afterwards would leave their account of it describing something that no longer
  // matches. The worker's own summary is theirs to correct right up to the handover.
  if (row.status !== 'OPEN') throw ruleViolation(['status']);

  const updated = await store.updateCase(row.id, {
    summary: input.summary,
    priority: input.priority,
  });
  if (!updated) throw notVisible();

  await audit(store, {
    action: 'CASE_UPDATED',
    entity: 'health_case',
    entityId: updated.id,
    actorId: args.actor.userId,
    actorRole: args.actor.role,
    metadata: { fromPriority: row.priority, toPriority: updated.priority },
  });
  return toCaseSummary(store, updated, new Map());
}

export async function listCases(
  store: HealthcareStore,
  args: { actor: HealthcareActor; query?: unknown }
): Promise<CaseSummaryDto[]> {
  const query = parse(caseListQuerySchema, args.query ?? {}) as CaseListQuery;
  const filter: CaseFilter = { limit: query.limit, status: query.status, priority: query.priority };
  const cache = new Map<string, CaseNames>();

  if (args.actor.role === 'ASHA' && args.actor.ashaId) {
    const rows = await store.listCasesByAsha(args.actor.ashaId, filter);
    return Promise.all(rows.map((row) => toCaseSummary(store, row, cache)));
  }
  if (args.actor.role === 'DOCTOR' && args.actor.doctorId) {
    const rows = await store.listCasesByDoctor(args.actor.doctorId, filter);
    return Promise.all(rows.map((row) => toCaseSummary(store, row, cache)));
  }
  if (args.actor.role === 'ADMIN') {
    // Every case an administrator may see is reachable through a doctor or a worker,
    // and the port deliberately has no list-all: a method that returned the whole
    // table would be one more thing to get right in every future migration.
    return [];
  }
  throw forbidden();
}

export async function getCaseReview(
  store: HealthcareStore,
  args: { actor: HealthcareActor; caseId: string }
): Promise<CaseReviewDto> {
  const { row } = await loadVisibleCase(store, args.actor, args.caseId);
  const member = await store.getMember(row.household_member_id);
  if (!member) throw notVisible();

  const [observations, referrals, clinicalNotes, prescriptions, followUps, ashaProfile] =
    await Promise.all([
      store.listObservationsByCase(row.id),
      store.listReferralsByCase(row.id),
      store.listClinicalNotesByCase(row.id),
      store.listPrescriptionsByCase(row.id),
      store.listFollowUpsByCase(row.id),
      store.getAshaProfile(row.created_by_asha_id),
    ]);

  const doctorCache = new Map<string, string>();
  const ashaCache = new Map<string, string>();
  const caseNames = new Map<string, CaseNames>();
  const summary = await toCaseSummary(store, row, new Map());

  await audit(store, {
    action: 'CASE_READ',
    entity: 'health_case',
    entityId: row.id,
    actorId: args.actor.userId,
    actorRole: args.actor.role,
    metadata: {
      observationCount: observations.length,
      noteCount: clinicalNotes.length,
      prescriptionCount: prescriptions.length,
      followUpCount: followUps.length,
      referralCount: referrals.length,
    },
  });

  return {
    case: summary,
    observations: await Promise.all(
      observations.map((item) => toObservationDto(store, item, ashaCache))
    ),
    referrals: await Promise.all(
      referrals.map((item) => toReferralDto(store, item, caseNames, ashaCache, doctorCache))
    ),
    clinicalNotes: await Promise.all(
      clinicalNotes.map((item) => toClinicalNoteDto(store, item, doctorCache))
    ),
    prescriptions: await Promise.all(
      prescriptions.map((item) => toPrescriptionDto(store, item, doctorCache))
    ),
    followUps: await Promise.all(followUps.map((item) => toFollowUpDto(store, item, caseNames))),
    member: toMemberDto(member),
    householdCode: summary.householdCode,
    ashaName: ashaProfile?.full_name ?? null,
  };
}

export async function createObservation(
  store: HealthcareStore,
  args: { actor: HealthcareActor; caseId: string; input: unknown }
): Promise<ObservationDto> {
  const asha = requireAsha(args.actor);
  const input = parse(createObservationSchema, args.input);
  const { row } = await loadVisibleCase(store, args.actor, args.caseId);
  if (row.created_by_asha_id !== asha.user_id) throw notVisible();

  // `case_observations.household_member_id` duplicates the case's member, and that is
  // a redundancy worth naming: the column is not an independent fact, so it is never
  // taken from the request. It comes from the case, which means a caller cannot attach
  // an observation about one person to a case belonging to another, and a reporting
  // query that reads observations without joining cases still gets the right person.
  const member = await store.getMember(row.household_member_id);
  if (!member || member.household_id !== row.household_id) throw notVisible();

  const created = await store.createObservation({
    caseId: row.id,
    householdMemberId: member.id,
    recordedByAshaId: asha.user_id,
    observedOn: input.observedOn,
    reportedSymptoms: input.reportedSymptoms,
    severity: input.severity,
    durationDays: input.durationDays ?? null,
    notes: input.notes,
    referralReason: input.referralReason,
  });

  await audit(store, {
    action: 'OBSERVATION_CREATED',
    entity: 'case_observation',
    entityId: created.id,
    actorId: args.actor.userId,
    actorRole: args.actor.role,
    metadata: { severity: created.severity, caseId: row.id, observationCount: 1 },
  });
  return toObservationDto(store, created, new Map());
}

/* ------------------------------------------------------------------ *
 * Referrals                                                            *
 * ------------------------------------------------------------------ */

export async function createReferral(
  store: HealthcareStore,
  args: { actor: HealthcareActor; caseId: string; input: unknown }
): Promise<ReferralDto> {
  const asha = requireAsha(args.actor);
  const input = parse(createReferralSchema, args.input);
  const { row } = await loadVisibleCase(store, args.actor, args.caseId);
  if (row.created_by_asha_id !== asha.user_id) throw notVisible();

  // The destination has to be a doctor on the roster. A referral addressed to a
  // misspelt id is a case nobody will ever be handed, and the failure is silent:
  // the row is created, the case says REFERRED, and no queue ever shows it.
  const doctors = await store.listDoctors();
  const target = doctors.find((doctor) => doctor.user_id === input.doctorId);
  if (!target) throw invalidRequest(['doctorId']);

  const referral = await store.createReferral({
    caseId: row.id,
    referredByAshaId: asha.user_id,
    referredToDoctorId: target.user_id,
    reason: input.reason,
    priority: input.priority,
    campId: input.campId ?? null,
  });

  // Filing the referral is what moves the case, not a separate status call: there is
  // no way to ask for a case status, so a case cannot reach REFERRED any other way.
  // A case that is closed cannot be referred, and that is a fact about the world
  // rather than about the caller's permissions, so it is a 409 and not a 404: a
  // worker who referred a closed case by mistake needs to be told so.
  const move = nextCaseStatus(row.status, 'refer');
  if (!move.ok) throw ruleViolation(['status']);
  await store.updateCase(row.id, { status: move.to });

  await audit(store, {
    action: 'REFERRAL_CREATED',
    entity: 'referral',
    entityId: referral.id,
    actorId: args.actor.userId,
    actorRole: args.actor.role,
    metadata: {
      fromStatus: row.status,
      toStatus: move.to,
      priority: referral.priority,
      campId: referral.camp_id,
      caseId: row.id,
    },
  });

  return toReferralDto(
    store,
    referral,
    new Map(),
    new Map(),
    new Map([[target.user_id, target.full_name]])
  );
}

export async function listReferrals(
  store: HealthcareStore,
  args: { actor: HealthcareActor; query?: unknown }
): Promise<ReferralDto[]> {
  const query = parse(referralListQuerySchema, args.query ?? {}) as ReferralListQuery;
  const filter: ReferralFilter = { limit: query.limit, status: query.status };
  const cache = {
    cases: new Map<string, CaseNames>(),
    ashas: new Map<string, string>(),
    doctors: new Map<string, string>(),
  };

  if (args.actor.role === 'ASHA' && args.actor.ashaId) {
    return Promise.all(
      (await store.listReferralsByAsha(args.actor.ashaId, filter)).map((row) =>
        toReferralDto(store, row, cache.cases, cache.ashas, cache.doctors)
      )
    );
  }
  if (args.actor.role === 'DOCTOR' && args.actor.doctorId) {
    return Promise.all(
      (await store.listReferralsByDoctor(args.actor.doctorId, filter)).map((row) =>
        toReferralDto(store, row, cache.cases, cache.ashas, cache.doctors)
      )
    );
  }
  if (args.actor.role === 'ADMIN') {
    // As with cases, the port has no list-all for referrals. An administrator
    // oversees through the worker's and the doctor's own queues.
    return [];
  }
  throw forbidden();
}

export async function listDoctors(
  store: HealthcareStore,
  args: { actor: HealthcareActor }
): Promise<DoctorProfileDto[]> {
  // Staff only. A plain member has no referral to file and no reason to learn which
  // doctors are on the roster.
  requireStaff(args.actor);
  return (await store.listDoctors()).map(toDoctorDto);
}

/**
 * Accepts a referral, which is also the moment the doctor is given the case.
 *
 * Both halves are in one function on purpose. `health_cases.assigned_doctor_id` is
 * what makes a case visible to a doctor under RLS, so accepting without assigning
 * would leave the doctor with a queue entry pointing at a case they still cannot
 * open; assigning without accepting would show a doctor a case they never agreed to
 * take. One operation, one outcome, and the row the doctor can read exists exactly
 * when the queue says they have it.
 */
export async function acceptReferral(
  store: HealthcareStore,
  args: { actor: HealthcareActor; referralId: string }
): Promise<ReferralDto> {
  const doctor = requireDoctor(args.actor);
  const referral = await store.getReferral(args.referralId);
  // Not visible, rather than "not yours": the same reason as everywhere else.
  if (!referral || referral.referred_to_doctor_id !== doctor.user_id) throw notVisible();

  const move = nextReferralStatus(referral.status, 'accept');
  if (!move.ok) throw ruleViolation(['status']);

  const updated = await store.updateReferral(referral.id, {
    status: move.to,
    accepted_at: new Date().toISOString(),
  });
  if (!updated) throw notVisible();

  const caseRow = await store.getCase(referral.case_id);
  if (caseRow) {
    const caseMove = nextCaseStatus(caseRow.status, 'accept');
    if (caseMove.ok) {
      await store.updateCase(caseRow.id, {
        status: caseMove.to,
        assigned_doctor_id: doctor.user_id,
      });
    }
  }

  await audit(store, {
    action: 'REFERRAL_ACCEPTED',
    entity: 'referral',
    entityId: referral.id,
    actorId: args.actor.userId,
    actorRole: args.actor.role,
    metadata: { fromStatus: referral.status, toStatus: move.to, caseId: referral.case_id },
  });

  return toReferralDto(store, updated, new Map(), new Map(), new Map());
}

/** The doctor's own moves on a referral they hold. */
export async function progressReferral(
  store: HealthcareStore,
  args: { actor: HealthcareActor; referralId: string; action: 'startReview' | 'complete' }
): Promise<ReferralDto> {
  const doctor = requireDoctor(args.actor);
  const referral = await store.getReferral(args.referralId);
  if (!referral || referral.referred_to_doctor_id !== doctor.user_id) throw notVisible();

  const move = nextReferralStatus(referral.status, args.action);
  if (!move.ok) throw ruleViolation(['status']);

  const patch: Parameters<HealthcareStore['updateReferral']>[1] = { status: move.to };
  if (args.action === 'complete') patch.completed_at = new Date().toISOString();
  const updated = await store.updateReferral(referral.id, patch);
  if (!updated) throw notVisible();

  if (args.action === 'complete') {
    // Completing the referral is what closes the case, and a case with an open
    // referral is a case that will not be worked. This is the one place a case
    // reaches CLOSED from the referral chain.
    const caseRow = await store.getCase(referral.case_id);
    if (caseRow) {
      const caseMove = nextCaseStatus(caseRow.status, 'close');
      if (caseMove.ok) {
        await store.updateCase(caseRow.id, { status: caseMove.to, closed_at: new Date().toISOString() });
      }
    }
  }

  await audit(store, {
    action: args.action === 'complete' ? 'REFERRAL_COMPLETED' : 'REFERRAL_REVIEWED',
    entity: 'referral',
    entityId: referral.id,
    actorId: args.actor.userId,
    actorRole: args.actor.role,
    metadata: { fromStatus: referral.status, toStatus: move.to, caseId: referral.case_id },
  });

  return toReferralDto(store, updated, new Map(), new Map(), new Map());
}

/**
 * Withdraws a referral the worker filed.
 *
 * Allowed from any state, and from a terminal one too, which is why it is not routed
 * through the state machine: a referral that was already cancelled, or that a doctor
 * completed while the worker was offline, must not leave the case pointed at work
 * nobody is going to do. The case goes back to being open work for its worker.
 */
export async function cancelReferral(
  store: HealthcareStore,
  args: { actor: HealthcareActor; referralId: string }
): Promise<ReferralDto> {
  const asha = requireAsha(args.actor);
  const referral = await store.getReferral(args.referralId);
  if (!referral || referral.referred_by_asha_id !== asha.user_id) throw notVisible();

  const updated = await store.updateReferral(referral.id, { status: 'CANCELLED' });
  if (!updated) throw notVisible();

  const caseRow = await store.getCase(referral.case_id);
  if (caseRow && caseRow.status === 'REFERRED') {
    await store.updateCase(caseRow.id, { status: 'OPEN', assigned_doctor_id: null });
  }

  await audit(store, {
    action: 'REFERRAL_CANCELLED',
    entity: 'referral',
    entityId: referral.id,
    actorId: args.actor.userId,
    actorRole: args.actor.role,
    metadata: { fromStatus: referral.status, toStatus: 'CANCELLED', caseId: referral.case_id },
  });

  return toReferralDto(store, updated, new Map(), new Map(), new Map());
}

/* ------------------------------------------------------------------ *
 * Clinical notes and prescriptions                                     *
 * ------------------------------------------------------------------ */

/**
 * Writes the doctor's assessment of a case.
 *
 * The note is what moves the case into review. A case that a doctor can see but has
 * not picked up is a case in a queue; picking it up is writing the note, because
 * there is no "start reviewing" button that leaves a record of who looked.
 */
export async function createClinicalNote(
  store: HealthcareStore,
  args: { actor: HealthcareActor; caseId: string; input: unknown }
): Promise<ClinicalNoteDto> {
  const doctor = requireDoctor(args.actor);
  const input = parse(createClinicalNoteSchema, args.input);
  const { row } = await loadVisibleCase(store, args.actor, args.caseId);
  if (row.assigned_doctor_id !== doctor.user_id) throw notVisible();

  const note = await store.createClinicalNote({
    caseId: row.id,
    doctorId: doctor.user_id,
    assessment: input.assessment,
    observations: input.observations,
    advice: input.advice,
    followUpOn: input.followUpOn ?? null,
  });

  const move = nextCaseStatus(row.status, 'startReview');
  if (move.ok) await store.updateCase(row.id, { status: move.to });

  await audit(store, {
    action: 'CLINICAL_NOTE_CREATED',
    entity: 'clinical_note',
    entityId: note.id,
    actorId: args.actor.userId,
    actorRole: args.actor.role,
    metadata: {
      fromStatus: row.status,
      toStatus: move.ok ? move.to : row.status,
      followUpOn: input.followUpOn ?? null,
      caseId: row.id,
      noteCount: 1,
    },
  });
  return toClinicalNoteDto(store, note, new Map());
}

/**
 * Issues or amends a prescription.
 *
 * Doctor only, and the only write in this feature that prescribes medicine. The
 * role check is here and the insert policy says the same thing; the reason both
 * exist is that this is the one write where a mistake is not recoverable by editing
 * a field, and a defence in depth is cheap at exactly one endpoint.
 *
 * The medicine name is stored and returned, and deliberately never enters an audit
 * row: the audit says a prescription was issued and by whom, and `assertAuditableMetadata`
 * refuses anything else.
 */
export async function createPrescription(
  store: HealthcareStore,
  args: { actor: HealthcareActor; caseId: string; input: unknown }
): Promise<PrescriptionDto> {
  const doctor = requireDoctor(args.actor);
  const input = parse(createPrescriptionSchema, args.input);
  const { row } = await loadVisibleCase(store, args.actor, args.caseId);
  if (row.assigned_doctor_id !== doctor.user_id) throw notVisible();

  const prescription = await store.createPrescription({
    caseId: row.id,
    clinicalNoteId: input.clinicalNoteId ?? null,
    doctorId: doctor.user_id,
    medicineName: input.medicineName,
    dosage: input.dosage,
    frequency: input.frequency,
    duration: input.duration,
    instructions: input.instructions,
  });

  await audit(store, {
    action: 'PRESCRIPTION_CREATED',
    entity: 'prescription',
    entityId: prescription.id,
    actorId: args.actor.userId,
    actorRole: args.actor.role,
    metadata: { caseId: row.id, prescriptionCount: 1 },
  });
  return toPrescriptionDto(store, prescription, new Map());
}

/* ------------------------------------------------------------------ *
 * Follow-ups                                                           *
 * ------------------------------------------------------------------ */

/**
 * Schedules a follow-up on a case, addressed to a *role* rather than to an account.
 *
 * The request names a role and the server works out who that is, from the case
 * itself: the ASHA who opened it, or the doctor it is assigned to. That is the whole
 * point of the contract, and it is why the schema has no account id in it — a
 * follow-up addressed to an account is a follow-up that can be aimed at somebody who
 * has nothing to do with the case, or at a member, and neither is a thing a form
 * should be able to ask for.
 *
 * A role that names nobody on this case is refused rather than guessed at. A doctor
 * who asks for a doctor follow-up on a case they have not been assigned has made a
 * mistake, and the useful answer names the field, not a follow-up assigned to
 * somebody chosen by accident.
 */
export async function createFollowUp(
  store: HealthcareStore,
  args: { actor: HealthcareActor; caseId: string; input: unknown }
): Promise<FollowUpDto> {
  requireStaff(args.actor);
  const input = parse(createFollowUpSchema, args.input);
  const { row } = await loadVisibleCase(store, args.actor, args.caseId);

  const assignee = await resolveFollowUpAssignee(store, row, input.assignedRole);
  if (!assignee) throw invalidRequest(['assignedRole']);

  const followUp = await store.createFollowUp({
    caseId: row.id,
    assignedToUserId: assignee,
    assignedRole: input.assignedRole,
    dueDate: input.dueDate,
    notes: input.notes,
  });

  const move = nextCaseStatus(row.status, 'requestFollowUp');
  if (move.ok) await store.updateCase(row.id, { status: move.to });

  await audit(store, {
    action: 'FOLLOW_UP_CREATED',
    entity: 'follow_up',
    entityId: followUp.id,
    actorId: args.actor.userId,
    actorRole: args.actor.role,
    metadata: {
      dueDate: followUp.due_date,
      assignedRole: followUp.assigned_role,
      caseId: row.id,
      followUpCount: 1,
    },
  });
  return toFollowUpDto(store, followUp, new Map());
}

/**
 * Settles a follow-up: done, missed, or cancelled.
 *
 * Only the assignee may settle it, and only from a pending state. A completed
 * follow-up is evidence that somebody went back, so it is not something the person
 * who scheduled it can change afterwards.
 */
export async function settleFollowUp(
  store: HealthcareStore,
  args: {
    actor: HealthcareActor;
    followUpId: string;
    action: 'complete' | 'markMissed' | 'cancel';
  }
): Promise<FollowUpDto> {
  const actor = args.actor;
  const followUp = await store.getFollowUp(args.followUpId);
  if (!followUp) throw notVisible();

  const isAssignee = followUp.assigned_to_user_id === actor.userId;
  const isAdmin = actor.role === 'ADMIN';
  if (!isAssignee && !isAdmin) throw notVisible();

  const move = nextFollowUpStatus(followUp.status, args.action);
  if (!move.ok) throw ruleViolation(['status']);

  // Re-settling to the status it already has is allowed — `state.ts` treats it as
  // idempotent, and a retried request is a real thing on a phone on a bad connection.
  // But it must not write. The second call would otherwise stamp a fresh
  // `completed_at` and a fresh `completed_by_user_id` over the first, and a record of
  // who actually closed a follow-up is the one column nobody can reconstruct later.
  // So this returns what is already there, and the original stamp stands.
  if (move.to === followUp.status) return toFollowUpDto(store, followUp, new Map());

  // Every settled follow-up is stamped, not just a completed one.
  // `follow_ups_completion_is_attributable` in 0003 requires `completed_at` and
  // `completed_by_user_id` together for any status other than PENDING, and that is
  // the right rule: a follow-up recorded as missed is a claim that somebody looked
  // and did not find the person, which is exactly as much an attribution as a
  // follow-up recorded as done. Writing the status alone would be refused by the
  // database as a check violation, which is the worst possible way to learn this.
  const patch: Parameters<HealthcareStore['updateFollowUp']>[1] = {
    status: move.to,
    completed_at: new Date().toISOString(),
    completed_by_user_id: actor.userId,
  };
  const updated = await store.updateFollowUp(followUp.id, patch);
  if (!updated) throw notVisible();

  await audit(store, {
    action:
      args.action === 'complete'
        ? 'FOLLOW_UP_COMPLETED'
        : args.action === 'markMissed'
          ? 'FOLLOW_UP_MISSED'
          : 'FOLLOW_UP_CANCELLED',
    entity: 'follow_up',
    entityId: followUp.id,
    actorId: actor.userId,
    actorRole: actor.role,
    metadata: { fromStatus: followUp.status, toStatus: move.to, caseId: followUp.case_id },
  });
  return toFollowUpDto(store, updated, new Map());
}

export async function listFollowUps(
  store: HealthcareStore,
  args: { actor: HealthcareActor; query?: unknown }
): Promise<FollowUpDto[]> {
  const query = parse(followUpListQuerySchema, args.query ?? {}) as FollowUpListQuery;
  const filter: FollowUpFilter = { limit: query.limit, status: query.status };
  const cache = new Map<string, CaseNames>();
  const rows = await store.listFollowUpsByAssignee(args.actor.userId, filter);
  return Promise.all(rows.map((row) => toFollowUpDto(store, row, cache)));
}

/* ------------------------------------------------------------------ *
 * Camps                                                                *
 * ------------------------------------------------------------------ */

/** A camp as the browser sees it, with the viewer's own registration folded in. */
async function toCampDto(
  store: HealthcareStore,
  actor: HealthcareActor,
  row: HealthCampRow,
  registeredCount: number,
  attendedCount: number,
  isRegistered: boolean
): Promise<HealthCampDto> {
  const isStaff = actor.role !== 'USER';
  const dto: HealthCampDto = {
    id: row.id,
    title: row.title,
    description: row.description,
    campDate: row.camp_date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    capacity: row.capacity,
    status: row.status,
    registeredCount,
    attendedCount,
    isRegisteredByViewer: isRegistered,
    isFull: registeredCount >= row.capacity,
    // The capability is the same predicate `changeCampStatus` and `markCampAttendance`
    // check, written once here so the buttons the UI draws are the operations the
    // service will actually allow. `isStaff` is redundant for the organiser half — only
    // staff create camps — and is kept so that the rule reads the way it is meant:
    // a member has no business running a camp even if a future migration let one own
    // a registration.
    canManage: isStaff && (row.organizer_user_id === actor.userId || actor.role === 'ADMIN'),
  };

  // How many cases came out of this camp is an operational fact about a camp, and it
  // is only an operational fact to somebody who runs camps. It is left off the wire
  // for a plain member rather than nulled, so its absence is a statement about the
  // viewer rather than a field that is sometimes missing.
  if (isStaff) {
    dto.referredCaseCount = (await store.listCasesByCamp(row.id, 100)).length;
  }
  return dto;
}

export async function listCamps(
  store: HealthcareStore,
  args: { actor: HealthcareActor; query?: unknown }
): Promise<HealthCampDto[]> {
  const query = parse(campListQuerySchema, args.query ?? {}) as CampListQuery;
  const filter: CampFilter = { limit: query.limit, status: query.status };
  const rows = await store.listCamps(filter);
  const registrations = await store.listRegistrationsByUser(args.actor.userId);
  const mine = new Set(registrations.map((row) => row.camp_id));

  return Promise.all(
    rows.map(async (row) =>
      toCampDto(
        store,
        args.actor,
        row,
        await store.countRegistrations(row.id),
        await store.countAttendance(row.id, 'ATTENDED'),
        mine.has(row.id)
      )
    )
  );
}

/**
 * The registration roster for a camp, for the people allowed to run it.
 *
 * WHY THIS NEEDED A SERVICE AT ALL
 * Attendance was a write with nothing to write *about*. `markCampAttendance` takes a
 * registration id, and a registration id is only meaningful to somebody looking at a
 * list, so the flow was "register, then mark attendance against a registration id that
 * no read operation would ever have handed out". The store port already had the
 * query; what was missing was the decision about who may ask.
 *
 * WHO MAY ASK
 * Exactly the people `markCampAttendance` already trusts: the organiser or an `ADMIN`.
 * The predicate is written out again here rather than shared, because a roster is a
 * read and attendance is a write, and a refactor that made the read depend on the
 * write's helper would let a future change to one silently widen the other. Anyone else
 * gets `notVisible` — the same answer as a camp that does not exist, so the endpoint
 * cannot be used to find out which camps exist.
 *
 * WHY THE ROSTER IS AS NARROW AS IT IS
 * A roster needs exactly three things: which person (the account, since a registration
 * is by account and nothing else identifies them at the door), what their attendance
 * is currently, and the registration id the mutation needs. So that is what comes back.
 * There is deliberately no name, no household, no member row, no case, no observation
 * and no clinical note, and there is no `markedByUserId`: attendance is a fact about a
 * camp, not a record of which staff member was standing at the table, and an audit
 * trail is where accountability for that belongs. The account id is exposed only to
 * somebody already entitled to the camp's roster and its attendance — it is the
 * organiser's own roster, not a cross-reference to somebody's health.
 */
export async function listCampRegistrations(
  store: HealthcareStore,
  args: { actor: HealthcareActor; campId: string }
): Promise<CampRosterEntryDto[]> {
  const actor = requireStaff(args.actor);
  const camp = await store.getCamp(args.campId);
  if (!camp) throw notVisible();
  if (camp.organizer_user_id !== actor.userId && actor.role !== 'ADMIN') throw notVisible();

  const [registrations, attendance] = await Promise.all([
    store.listRegistrationsByCamp(args.campId),
    store.listAttendanceByCamp(args.campId),
  ]);
  // `markAttendance` writes the attendance row with the registration, so the two reads
  // are joined here rather than in the store. A registration with no attendance row is
  // `REGISTERED`, which is the state the roster is built from and is also the enum's
  // own name for "has not been marked".
  const byRegistration = new Map(attendance.map((row) => [row.registration_id, row]));

  return registrations
    .map((row) => {
      const marked = byRegistration.get(row.id);
      const entry: CampRosterEntryDto = {
        registrationId: row.id,
        userId: row.user_id,
        registeredAt: row.registered_at,
        attendanceStatus: marked?.status ?? 'REGISTERED',
        markedAt: marked?.marked_at ?? null,
      };
      return entry;
    })
    // Registration order, so the roster is read the same way every time and the person
    // who signed up first is first on the list.
    .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt));
}

export async function createCamp(
  store: HealthcareStore,
  args: { actor: HealthcareActor; input: unknown }
): Promise<HealthCampDto> {
  const actor = requireStaff(args.actor);
  const input = parse(createCampSchema, args.input);

  const row = await store.createCamp({
    title: input.title,
    description: input.description,
    campDate: input.campDate,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location,
    capacity: input.capacity,
    // The organiser is the session, never the request. A body carrying an organiser is
    // refused by `.strict()` above rather than quietly ignored, so the two cannot
    // disagree about who is running the camp.
    organizerUserId: actor.userId,
  } satisfies CreateCampInput);

  await audit(store, {
    action: 'CAMP_CREATED',
    entity: 'health_camp',
    entityId: row.id,
    actorId: actor.userId,
    actorRole: actor.role,
    metadata: { capacity: row.capacity, status: row.status },
  });
  return toCampDto(store, actor, row, 0, 0, false);
}

/**
 * Publishes, completes or cancels a camp.
 *
 * Which of those is legal from where the camp currently is comes from the state
 * table, so a camp cannot skip being published before it is completed, and the audit
 * row records which move was made rather than a status the client asked for.
 */
export async function changeCampStatus(
  store: HealthcareStore,
  args: { actor: HealthcareActor; campId: string; status: HealthCampDto['status'] }
): Promise<HealthCampDto> {
  const actor = requireStaff(args.actor);
  const row = await store.getCamp(args.campId);
  if (!row) throw notVisible();
  if (row.organizer_user_id !== actor.userId && actor.role !== 'ADMIN') throw notVisible();
  if (!canTransitionHealthCamp(row.status, args.status)) throw ruleViolation(['status']);

  const updated = await store.updateCamp(row.id, { status: args.status });
  if (!updated) throw notVisible();

  await audit(store, {
    action: 'CAMP_STATUS_CHANGED',
    entity: 'health_camp',
    entityId: row.id,
    actorId: actor.userId,
    actorRole: actor.role,
    metadata: { fromStatus: row.status, toStatus: updated.status },
  });
  return toCampDto(
    store,
    actor,
    updated,
    await store.countRegistrations(updated.id),
    await store.countAttendance(updated.id, 'ATTENDED'),
    false
  );
}

/**
 * Signs the viewer up for a camp.
 *
 * The account is the session, so there is nothing to authorise here beyond the camp
 * being open. Two checks do matter and both are races the caller cannot win: the
 * unique constraint on `(camp_id, user_id)` in the schema, and the capacity trigger
 * in 0003, which locks the camp row before counting. The count read below is for the
 * message only — "this camp is full" rather than a 502 from a check violation.
 */
export async function registerForCamp(
  store: HealthcareStore,
  args: { actor: HealthcareActor; campId: string }
): Promise<HealthCampDto> {
  const camp = await store.getCamp(args.campId);
  if (!camp || camp.status !== 'PUBLISHED') throw notVisible();

  const existing = await store.findRegistration(camp.id, args.actor.userId);
  if (existing) throw ruleViolation(['campId']);

  // Read for the message, not for the decision. The decision is made by the capacity
  // trigger in 0003, which locks the camp row before it counts, so two people racing
  // for the last seat cannot both get it — and this count can be one stale, which is
  // exactly why the answer on offer here is a 409 and not a guarantee.
  const taken = await store.countRegistrations(camp.id);
  if (taken >= camp.capacity) throw ruleViolation(['capacity']);

  await store.registerForCamp(camp.id, args.actor.userId);

  await audit(store, {
    action: 'CAMP_REGISTRATION_CREATED',
    entity: 'camp_registration',
    entityId: camp.id,
    actorId: args.actor.userId,
    actorRole: args.actor.role,
    metadata: { campId: camp.id, registeredCount: taken + 1, capacity: camp.capacity },
  });

  return toCampDto(store, args.actor, camp, taken + 1, 0, true);
}

/**
 * Takes the viewer back off a camp's list.
 *
 * Allowed on a published camp and on a finished one, because the commonest case is a
 * member who signed up in the morning and cannot come. Refusing once a camp has been
 * marked complete would mean the list still said they were coming.
 */
export async function cancelCampRegistration(
  store: HealthcareStore,
  args: { actor: HealthcareActor; campId: string }
): Promise<HealthCampDto> {
  const camp = await store.getCamp(args.campId);
  if (!camp) throw notVisible();

  const existing = await store.findRegistration(camp.id, args.actor.userId);
  if (!existing) throw notVisible();

  const taken = await store.countRegistrations(camp.id);
  // The registration, not the pair: the delete policy is `user_id = auth.uid()`, so
  // this cannot remove anybody else's seat even if the id were somebody else's.
  const removed = await store.deleteRegistration(existing.id);
  if (!removed) throw notVisible();

  await audit(store, {
    action: 'CAMP_REGISTRATION_CANCELLED',
    entity: 'camp_registration',
    entityId: camp.id,
    actorId: args.actor.userId,
    actorRole: args.actor.role,
    metadata: {
      campId: camp.id,
      registeredCount: Math.max(0, taken - 1),
      capacity: camp.capacity,
    },
  });

  return toCampDto(store, args.actor, camp, Math.max(0, taken - 1), 0, false);
}

export async function markCampAttendance(
  store: HealthcareStore,
  args: { actor: HealthcareActor; campId: string; registrationId: string; input: unknown }
): Promise<{ attendanceStatus: CampAttendanceStatus }> {
  const actor = requireStaff(args.actor);
  const input = parse(markAttendanceSchema, args.input);

  // The registration has to belong to the camp in the path. Without this, a
  // registration id is enough to mark somebody present at any camp: the id is a roster
  // identifier that a person running a camp has in front of them, so it is not a secret
  // and it must not be usable outside the camp it came from.
  const registration = await store.getRegistration(args.registrationId);
  if (!registration || registration.camp_id !== args.campId) throw notVisible();

  // Attendance is a claim about a person, so it is a claim that only somebody entitled
  // to the camp's roster may make.
  const camp = await store.getCamp(args.campId);
  if (!camp) throw notVisible();
  if (camp.organizer_user_id !== actor.userId && actor.role !== 'ADMIN') throw notVisible();
  if (camp.status !== 'PUBLISHED' && camp.status !== 'COMPLETED') throw ruleViolation(['status']);

  const row = await store.markAttendance(args.registrationId, input.status, actor.userId);
  if (!row) throw notVisible();

  await audit(store, {
    action: 'CAMP_ATTENDANCE_UPDATED',
    entity: 'camp_attendance',
    entityId: row.id,
    actorId: actor.userId,
    actorRole: actor.role,
    metadata: { status: row.status, campId: row.camp_id },
  });
  return { attendanceStatus: row.status };
}

/* ------------------------------------------------------------------ *
 * Dashboards                                                           *
 * ------------------------------------------------------------------ */

export async function getAshaDashboard(
  store: HealthcareStore,
  args: { actor: HealthcareActor }
): Promise<AshaDashboardDto> {
  const asha = requireAsha(args.actor);
  const ashaId = asha.user_id;

  const [households, openCases, pendingReferrals, followUps, camps] = await Promise.all([
    store.listHouseholds(ashaId),
    store.listCasesByAsha(ashaId, { limit: 100, status: 'ALL' }),
    store.listReferralsByAsha(ashaId, { limit: 25, status: 'PENDING' }),
    store.listFollowUpsByAssignee(ashaId, { limit: 25, status: 'PENDING' }),
    store.listCamps({ limit: 100, status: 'ALL' }),
  ]);

  const memberTotal = (
    await Promise.all(households.map((row) => store.listMembers(row.id)))
  ).reduce((sum, members) => sum + members.length, 0);

  const caseCache = new Map<string, CaseNames>();
  const ashaCache = new Map<string, string>();
  const doctorCache = new Map<string, string>();
  const followUpCache = new Map<string, CaseNames>();
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  return {
    assignedHouseholds: households.length,
    householdMembers: memberTotal,
    // "Open" is the state module's word, not one re-derived here. It used to be
    // spelled out inline as "under review, or waiting, or open", which quietly
    // dropped every REFERRED case: a case that had been referred but not yet accepted
    // is the single most active thing a worker has, and the count said zero.
    openCases: openCases.filter((row) => OPEN_CASE_STATUSES.includes(row.status)).length,
    pendingReferrals: await store.countPendingReferralsForAsha(ashaId),
    upcomingFollowUps: followUps.length,
    campsThisMonth: camps.filter((row) => row.camp_date.startsWith(month)).length,
    recentCases: await Promise.all(
      openCases.slice(0, 5).map((row) => toCaseSummary(store, row, caseCache))
    ),
    upcomingFollowUpsList: await Promise.all(
      followUps.slice(0, 5).map((row) => toFollowUpDto(store, row, followUpCache))
    ),
    pendingReferralList: await Promise.all(
      pendingReferrals.slice(0, 5).map((row) =>
        toReferralDto(store, row, caseCache, ashaCache, doctorCache)
      )
    ),
    campActivity: camps
      .filter((row) => row.camp_date >= today)
      .slice(0, 5)
      .map((row) => ({
        campId: row.id,
        title: row.title,
        campDate: row.camp_date,
        status: row.status,
      })),
  };
}

export async function getDoctorDashboard(
  store: HealthcareStore,
  args: { actor: HealthcareActor }
): Promise<DoctorDashboardDto> {
  const doctor = requireDoctor(args.actor);
  const doctorId = doctor.user_id;

  const [pending, cases, followUps] = await Promise.all([
    store.listReferralsByDoctor(doctorId, { limit: 25, status: 'PENDING' }),
    store.listCasesByDoctor(doctorId, { limit: 100, status: 'ALL' }),
    store.listFollowUpsByAssignee(doctorId, { limit: 25, status: 'PENDING' }),
  ]);

  const caseCache = new Map<string, CaseNames>();
  const ashaCache = new Map<string, string>();
  const doctorCache = new Map<string, string>([[doctorId, doctor.full_name]]);
  const followUpCache = new Map<string, CaseNames>();

  return {
    pendingReferrals: pending.length,
    casesUnderReview: cases.filter((row) => ACTIVE_REVIEW_STATUSES.includes(row.status)).length,
    followUpsDue: followUps.length,
    recentCases: await Promise.all(
      cases.slice(0, 5).map((row) => toCaseSummary(store, row, caseCache))
    ),
    pendingReferralList: await Promise.all(
      pending.slice(0, 5).map((row) => toReferralDto(store, row, caseCache, ashaCache, doctorCache))
    ),
    followUpList: await Promise.all(
      followUps.slice(0, 5).map((row) => toFollowUpDto(store, row, followUpCache))
    ),
    campReferrals: await Promise.all(
      pending
        .filter((row) => row.camp_id !== null)
        .slice(0, 5)
        .map((row) => toReferralDto(store, row, caseCache, ashaCache, doctorCache))
    ),
  };
}
