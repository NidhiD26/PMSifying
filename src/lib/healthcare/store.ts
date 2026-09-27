import type {
  AshaProfileRow,
  CampAttendanceRow,
  CampRegistrationRow,
  CaseObservationRow,
  ClinicalNoteRow,
  DoctorProfileRow,
  FollowUpRow,
  HealthCampRow,
  HealthCaseRow,
  HealthcareProfileRow,
  HealthcareRoleRow,
  HouseholdMemberRow,
  HouseholdRow,
  PrescriptionRow,
  ReferralRow,
} from '@/types/healthcare-db';
import type {
  AuditAction,
  AuditEntity,
  CampAttendanceStatus,
  CasePriority,
  CaseStatus,
  FollowUpStatus,
  HealthCampStatus,
  MemberSex,
  ObservationSeverity,
  ReferralStatus,
} from '@/types/healthcare';
import type { Json } from '@/types/supabase-database';
import { conflict, notFound, upstreamUnavailable } from '@/lib/healthcare/errors';
import { canMarkAttendance, canTransitionHealthCamp } from '@/lib/healthcare/state';

/**
 * The port every healthcare data operation goes through.
 *
 * WHY A PORT, AND WHY IT IS BIGGER THAN SECRETCHAT'S
 * SecretChat's rules are interesting but few: a like, a block, a visibility check.
 * Healthcare's interesting rules are mostly *ownership* — whose household, whose
 * case, whose patient — and each of them has to be askable, so the port is a long
 * list of narrowly-typed reads and writes rather than a handful of clever ones.
 * That is the honest shape of the domain. Hiding it behind four generic methods
 * would move the ownership questions into string-keyed arguments, where nothing
 * checks them.
 *
 * WHAT THE PORT DELIBERATELY DOES NOT CONTAIN
 *   - No method takes a role from a caller. The role is resolved from the session
 *     in `@/lib/healthcare/session` and passed as the resolved account id, so a
 *     port method can never be asked to "act as" somebody.
 *   - No method takes a third party's *account* id where a record could be named
 *     instead. `markAttendance` takes a registration id and `getCase` takes a case
 *     id, so the client never holds an account id for a patient. The one exception
 *     is `createReferral`'s `doctorId`, which is a choice of destination from a
 *     roster the server published, and which the insert policy pins to the
 *     session's ASHA on the *referring* side.
 *   - No method is allowed to violate a data-integrity rule. Where the schema has a
 *     constraint — one seat per person, marked attendance is attributable, a
 *     referral is never re-pointed — the port refuses in the same way Postgres
 *     would, so an in-memory test and a live request agree.
 *
 * THE SPLIT OF RESPONSIBILITY
 *   - the port stores, counts and refuses to break an invariant;
 *   - `@/lib/healthcare/service` decides who may ask and shapes the DTOs;
 *   - RLS decides who may ask at all, and is the layer a bug in the other two
 *     cannot get past.
 */

/** Text that is already trimmed, stripped and length-checked by the schemas. */
export interface HouseholdInput {
  name: string;
  addressLine: string | null;
}

export interface MemberInput {
  fullName: string;
  ageYears: number | null;
  sex: MemberSex | null;
  relationToHead: string | null;
  note: string | null;
}

export interface CreateCaseInput {
  householdId: string;
  householdMemberId: string;
  createdByAshaId: string;
  summary: string;
  priority: CasePriority;
  source: 'ASHA' | 'CAMP';
  campId: string | null;
}

export interface CreateObservationInput {
  caseId: string;
  householdMemberId: string;
  recordedByAshaId: string;
  observedOn: string;
  reportedSymptoms: string[];
  severity: ObservationSeverity;
  durationDays: number | null;
  notes: string | null;
  referralReason: string | null;
}

export interface CreateReferralInput {
  caseId: string;
  referredByAshaId: string;
  referredToDoctorId: string;
  reason: string;
  priority: CasePriority;
  campId: string | null;
}

export interface CreateClinicalNoteInput {
  caseId: string;
  doctorId: string;
  assessment: string;
  observations: string | null;
  advice: string;
  followUpOn: string | null;
}

export interface PrescriptionInput {
  caseId: string;
  clinicalNoteId: string | null;
  doctorId: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
}

export interface CreateFollowUpInput {
  caseId: string;
  assignedToUserId: string;
  assignedRole: 'ASHA' | 'DOCTOR' | 'ADMIN';
  dueDate: string;
  notes: string | null;
}

export interface CreateCampInput {
  title: string;
  description: string | null;
  campDate: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number;
  organizerUserId: string;
}

export interface CampInput {
  title: string;
  description: string | null;
  campDate: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number;
}

export interface CaseFilter {
  status?: CaseStatus | 'ALL';
  priority?: CasePriority | 'ALL';
  limit: number;
}

export interface ReferralFilter {
  status?: ReferralStatus | 'ALL';
  limit: number;
}

export interface FollowUpFilter {
  status?: FollowUpStatus | 'ALL';
  limit: number;
}

export interface CampFilter {
  status?: HealthCampStatus | 'ALL';
  limit: number;
}

export interface RecordAuditEventInput {
  /**
   * The actor, for the in-memory adapter.
   *
   * The Supabase adapter deliberately does **not** send this to the database: the
   * `healthcare_record_audit_event` function reads the actor from `auth.uid()` and
   * takes no actor argument, so a caller cannot write an audit row naming somebody
   * else even by reaching past the service. The parameter exists because the
   * in-memory adapter has no session to read.
   */
  actorId: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string | null;
  /** Already through `assertAuditableMetadata`, so it is a bounded, closed shape. */
  metadata: Json;
}

export interface HealthcareStore {
  /* ---- account and staff identity ---- */

  /** The caller's profile row, which is where the role lives. */
  getProfile(userId: string): Promise<HealthcareProfileRow | null>;

  createAshaProfile(input: {
    userId: string;
    fullName: string;
    registrationNumber: string | null;
    area: string | null;
  }): Promise<AshaProfileRow>;

  createDoctorProfile(input: {
    userId: string;
    fullName: string;
    registrationNumber: string | null;
    speciality: string | null;
  }): Promise<DoctorProfileRow>;

  getAshaProfile(userId: string): Promise<AshaProfileRow | null>;

  getDoctorProfile(userId: string): Promise<DoctorProfileRow | null>;

  /**
   * The doctor roster, for the referral form's destination picker.
   *
   * A listing, which is otherwise the shape of thing this port avoids. It is
   * deliberate: a referral has to name a doctor, and the alternative — a
   * free-text field — would store a misspelling and produce a case nobody can
   * reach. It returns staff *profiles*, never accounts, so it hands out names and
   * registration numbers rather than the private mapping.
   */
  listDoctors(): Promise<DoctorProfileRow[]>;

  /* ---- households and members ---- */

  createHousehold(assignedAshaId: string, input: HouseholdInput): Promise<HouseholdRow>;

  listHouseholds(assignedAshaId: string): Promise<HouseholdRow[]>;

  getHousehold(householdId: string): Promise<HouseholdRow | null>;

  /**
   * Edits a household's register details.
   *
   * `assigned_asha_id` is not in the patch. Reassigning a household to a different
   * worker is an administrative action taken with the service role, and a port
   * method that offered it would be a method a route could reach by accident.
   */
  updateHousehold(
    householdId: string,
    patch: Partial<Pick<HouseholdRow, 'name' | 'address_line'>>
  ): Promise<HouseholdRow | null>;

  createMember(householdId: string, input: MemberInput): Promise<HouseholdMemberRow>;

  listMembers(householdId: string): Promise<HouseholdMemberRow[]>;

  getMember(memberId: string): Promise<HouseholdMemberRow | null>;

  updateMember(
    memberId: string,
    patch: Partial<Omit<HouseholdMemberRow, 'id' | 'household_id' | 'created_at'>>
  ): Promise<HouseholdMemberRow | null>;
  countMembersForAsha(ashaId: string): Promise<number>;

  countOpenCasesForHousehold(householdId: string): Promise<number>;

  /* ---- cases ---- */

  createCase(input: CreateCaseInput): Promise<HealthCaseRow>;

  getCase(caseId: string): Promise<HealthCaseRow | null>;

  updateCase(
    caseId: string,
    patch: Partial<
      Omit<HealthCaseRow, 'id' | 'case_number' | 'household_id' | 'created_by_asha_id' | 'created_at'>
    >
  ): Promise<HealthCaseRow | null>;

  listCasesByAsha(ashaId: string, filter: CaseFilter): Promise<HealthCaseRow[]>;

  listCasesByDoctor(doctorId: string, filter: CaseFilter): Promise<HealthCaseRow[]>;

  listCasesByCamp(campId: string, limit: number): Promise<HealthCaseRow[]>;

  countOpenCasesForAsha(ashaId: string): Promise<number>;

  countCasesUnderReview(doctorId: string): Promise<number>;

  /* ---- observations ---- */

  createObservation(input: CreateObservationInput): Promise<CaseObservationRow>;

  listObservationsByCase(caseId: string): Promise<CaseObservationRow[]>;

  /* ---- referrals ---- */

  createReferral(input: CreateReferralInput): Promise<ReferralRow>;

  getReferral(referralId: string): Promise<ReferralRow | null>;

  /**
   * Moves a referral's status.
   *
   * `referred_by_asha_id` and `referred_to_doctor_id` are not in the patch type, and
   * that is the point: a referral is never re-pointed at a different doctor once
   * filed, so there is no operation that could try.
   */
  updateReferral(
    referralId: string,
    patch: Partial<
      Pick<ReferralRow, 'status' | 'priority' | 'reason' | 'accepted_at' | 'completed_at'>
    >
  ): Promise<ReferralRow | null>;

  listReferralsByAsha(ashaId: string, filter: ReferralFilter): Promise<ReferralRow[]>;

  listReferralsByDoctor(doctorId: string, filter: ReferralFilter): Promise<ReferralRow[]>;

  listReferralsByCase(caseId: string): Promise<ReferralRow[]>;

  listReferralsByCamp(campId: string, limit: number): Promise<ReferralRow[]>;

  countPendingReferralsForAsha(ashaId: string): Promise<number>;

  countPendingReferralsForDoctor(doctorId: string): Promise<number>;

  /* ---- the doctor side ---- */

  createClinicalNote(input: CreateClinicalNoteInput): Promise<ClinicalNoteRow>;

  listClinicalNotesByCase(caseId: string): Promise<ClinicalNoteRow[]>;

  createPrescription(input: PrescriptionInput): Promise<PrescriptionRow>;

  getPrescription(prescriptionId: string): Promise<PrescriptionRow | null>;

  updatePrescription(
    prescriptionId: string,
    patch: Partial<
      Omit<PrescriptionRow, 'id' | 'case_id' | 'doctor_id' | 'created_at'>
    >
  ): Promise<PrescriptionRow | null>;

  listPrescriptionsByCase(caseId: string): Promise<PrescriptionRow[]>;

  /* ---- follow-ups ---- */

  createFollowUp(input: CreateFollowUpInput): Promise<FollowUpRow>;

  getFollowUp(followUpId: string): Promise<FollowUpRow | null>;

  updateFollowUp(
    followUpId: string,
    patch: Partial<
      Pick<FollowUpRow, 'status' | 'notes' | 'due_date' | 'completed_at' | 'completed_by_user_id'>
    >
  ): Promise<FollowUpRow | null>;

  listFollowUpsByCase(caseId: string): Promise<FollowUpRow[]>;

  listFollowUpsByAssignee(userId: string, filter: FollowUpFilter): Promise<FollowUpRow[]>;

  countPendingFollowUpsForUser(userId: string): Promise<number>;

  /* ---- camps ---- */

  createCamp(input: CreateCampInput): Promise<HealthCampRow>;

  getCamp(campId: string): Promise<HealthCampRow | null>;

  /**
   * Edits a camp's details and status.
   *
   * The patch is in the row's own snake_case so it can go straight to Postgres
   * without a translation step that could quietly drop a field. `organizer_user_id`
   * is not in it: the account that created a camp does not change, and a method
   * that could change it would be a method that could transfer a camp's roster.
   */
  updateCamp(
    campId: string,
    patch: Partial<Omit<HealthCampRow, 'id' | 'organizer_user_id' | 'created_at'>>
  ): Promise<HealthCampRow | null>;

  listCamps(filter: CampFilter): Promise<HealthCampRow[]>;

  countRegistrations(campId: string): Promise<number>;

  countAttendance(campId: string, status: CampAttendanceStatus): Promise<number>;

  /**
   * Takes a seat, and opens the attendance row for it.
   *
   * Both rows are written together because a registration without an attendance
   * row is the state the camp roster is built from, and creating them separately
   * would leave a window in which a person has a seat and no row on the register.
   * Refuses a duplicate for the same person, and refuses a full camp.
   */
  registerForCamp(campId: string, userId: string): Promise<CampRegistrationRow>;

  getRegistration(registrationId: string): Promise<CampRegistrationRow | null>;

  findRegistration(
    campId: string,
    userId: string
  ): Promise<CampRegistrationRow | null>;

  listRegistrationsByUser(userId: string): Promise<CampRegistrationRow[]>;

  listRegistrationsByCamp(campId: string): Promise<CampRegistrationRow[]>;

  /**
   * Takes one registration off a camp's list, returning the row that was removed.
   *
   * It takes the registration rather than the pair, so the caller cannot delete a
   * seat that is not theirs: the delete policy is `user_id = auth.uid()`, and a
   * service call that passed a camp id and an account id would have to re-implement
   * that check to be safe. `camp_attendance` cascades from the registration, so a
   * person who has not attended anything leaves no row behind.
   */
  deleteRegistration(registrationId: string): Promise<CampRegistrationRow | null>;

  listAttendanceByCamp(campId: string): Promise<CampAttendanceRow[]>;

  markAttendance(
    registrationId: string,
    status: CampAttendanceStatus,
    markedByUserId: string
  ): Promise<CampAttendanceRow | null>;

  /* ---- audit ---- */

  recordAuditEvent(input: RecordAuditEventInput): Promise<void>;
}

/* ------------------------------------------------------------------ *
 * In-memory reference implementation                                  *
 * ------------------------------------------------------------------ *
 * This is the fixture the service tests run against, and the reference for the
 * *storage* rules. It is a genuine adapter rather than a mock: it enforces the same
 * invariants as the SQL — one seat per person, marked attendance is attributable, a
 * referral is never re-pointed, a case number is never reused — so a test that
 * passes here is testing the semantics rather than a stub's behaviour.
 *
 * It is not used by the app. Production reads and writes go through
 * `supabase-store.ts`, which adds the row level security only a database can
 * enforce.
 */
export function createInMemoryHealthcareStore(): HealthcareStore {
  return createInMemoryHealthcareFixture().store;
}

/**
 * The same adapter, with its audit trail handed back as well.
 *
 * A test that asserts "this operation wrote an audit row, and the row says nothing
 * about the observation" needs to read the trail, and the trail is not part of the
 * port: production writes it through a security-definer SQL function and reads it
 * only from the database, so adding a read method to the port would invite the app
 * to depend on an audit table it deliberately has no grant on.
 */
export interface InMemoryHealthcareFixture {
  store: HealthcareStore;
  auditLog: RecordAuditEventInput[];
  /**
   * Creates the `profiles` row an account has from the moment it signs up, with the
   * role it should have.
   *
   * On the fixture rather than on the port on purpose. In the real database the row
   * is created by the `on_auth_user_created` trigger and the role is set later by an
   * operator, so no application code path creates a profile — and a port method that
   * did would be a method that could hand someone a role. Here it is explicitly a
   * test capability, sitting next to `auditLog`, which is also not a port method.
   */
  seedProfile(userId: string, role?: HealthcareRoleRow): HealthcareProfileRow;
}

export function createInMemoryHealthcareFixture(): InMemoryHealthcareFixture {
  const now = () => new Date().toISOString();
  const today = () => now().slice(0, 10);

  const profiles = new Map<string, HealthcareProfileRow>();
  const ashaProfiles = new Map<string, AshaProfileRow>();
  const doctorProfiles = new Map<string, DoctorProfileRow>();
  const households = new Map<string, HouseholdRow>();
  const members = new Map<string, HouseholdMemberRow>();
  const cases = new Map<string, HealthCaseRow>();
  const observations = new Map<string, CaseObservationRow>();
  const referrals = new Map<string, ReferralRow>();
  const clinicalNotes = new Map<string, ClinicalNoteRow>();
  const prescriptions = new Map<string, PrescriptionRow>();
  const followUps = new Map<string, FollowUpRow>();
  const camps = new Map<string, HealthCampRow>();
  const registrations = new Map<string, CampRegistrationRow>();
  const attendance = new Map<string, CampAttendanceRow>();
  const auditLog: RecordAuditEventInput[] = [];

  // Register numbers come from a counter rather than from a row count, mirroring the
  // sequences in 0003. A count would hand two workers the same number under
  // concurrency, which the unique constraint would then refuse.
  let sequence = 0;
  const nextId = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  let householdCounter = 0;
  let caseCounter = 0;

  /**
   * An account's private profile row.
   *
   * Mirrors the `not null default 'USER'` the migration puts on `profiles.role`: an
   * account exists with no role at all until somebody makes it a health worker, which
   * is what `createAshaProfile` and `createDoctorProfile` do.
   */
  const profileRow = (userId: string, role: HealthcareRoleRow): HealthcareProfileRow => ({
    id: userId,
    role,
    created_at: now(),
    updated_at: now(),
    suspended_at: null,
  });

  const seedProfileRow = (userId: string, role: HealthcareRoleRow = 'USER'): HealthcareProfileRow => {
    const row = profileRow(userId, role);
    profiles.set(userId, row);
    return row;
  };

  /** A status is "open" while the case is still being worked on. */
  const isOpenStatus = (status: CaseStatus) => status !== 'CLOSED';

  const casesOfHousehold = (householdId: string) =>
    [...cases.values()].filter((row) => row.household_id === householdId);

  const membersOfHousehold = (householdId: string) =>
    [...members.values()].filter((row) => row.household_id === householdId);

  const filterCases = (rows: HealthCaseRow[], filter: CaseFilter): HealthCaseRow[] =>
    rows
      .filter((row) => (filter.status && filter.status !== 'ALL' ? row.status === filter.status : true))
      .filter((row) =>
        filter.priority && filter.priority !== 'ALL' ? row.priority === filter.priority : true
      )
      // Newest activity first: this is a working list, and the row a worker touched
      // an hour ago is the one they are looking for.
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, filter.limit);

  const filterReferrals = (rows: ReferralRow[], filter: ReferralFilter): ReferralRow[] =>
    rows
      .filter((row) => (filter.status && filter.status !== 'ALL' ? row.status === filter.status : true))
      // Urgent first, then oldest: a referral queue is worked in the order it will
      // hurt somebody soonest.
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority === 'URGENT' ? -1 : 1;
        return a.created_at.localeCompare(b.created_at);
      })
      .slice(0, filter.limit);

  const filterFollowUps = (rows: FollowUpRow[], filter: FollowUpFilter): FollowUpRow[] =>
    rows
      .filter((row) => (filter.status && filter.status !== 'ALL' ? row.status === filter.status : true))
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, filter.limit);

  const touch = <T extends { updated_at: string }>(row: T): T => ({ ...row, updated_at: now() });

  const store: HealthcareStore = {
    async getProfile(userId) {
      return profiles.get(userId) ?? null;
    },

    async createAshaProfile(input) {
      const row: AshaProfileRow = {
        user_id: input.userId,
        full_name: input.fullName,
        registration_number: input.registrationNumber,
        area: input.area,
        created_at: now(),
        updated_at: now(),
      };
      ashaProfiles.set(input.userId, row);
      // The role lives on `profiles`, not on `asha_profiles`, and this is the only
      // way the fixture can make an account a health worker. Setting it here keeps
      // the two rows agreeing, which is what the real system does when an operator
      // promotes an account: a staff record and a role, together.
      profiles.set(input.userId, profileRow(input.userId, 'ASHA'));
      return row;
    },

    async createDoctorProfile(input) {
      const row: DoctorProfileRow = {
        user_id: input.userId,
        full_name: input.fullName,
        registration_number: input.registrationNumber,
        speciality: input.speciality,
        created_at: now(),
        updated_at: now(),
      };
      doctorProfiles.set(input.userId, row);
      profiles.set(input.userId, profileRow(input.userId, 'DOCTOR'));
      return row;
    },

    async getAshaProfile(userId) {
      return ashaProfiles.get(userId) ?? null;
    },

    async getDoctorProfile(userId) {
      return doctorProfiles.get(userId) ?? null;
    },

    async listDoctors() {
      return [...doctorProfiles.values()].sort((a, b) =>
        a.full_name.localeCompare(b.full_name)
      );
    },

    async createHousehold(assignedAshaId, input) {
      const row: HouseholdRow = {
        id: nextId(),
        code: `HH-${String(++householdCounter).padStart(4, '0')}`,
        name: input.name,
        address_line: input.addressLine,
        assigned_asha_id: assignedAshaId,
        created_at: now(),
        updated_at: now(),
      };
      households.set(row.id, row);
      return row;
    },

    async listHouseholds(assignedAshaId) {
      return [...households.values()]
        .filter((row) => row.assigned_asha_id === assignedAshaId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },

    async getHousehold(householdId) {
      return households.get(householdId) ?? null;
    },

    async updateHousehold(householdId, patch) {
      const existing = households.get(householdId);
      if (!existing) return null;
      const next = touch({ ...existing, ...patch });
      households.set(householdId, next);
      return next;
    },

    async createMember(householdId, input) {
      const row: HouseholdMemberRow = {
        id: nextId(),
        household_id: householdId,
        full_name: input.fullName,
        age_years: input.ageYears,
        sex: input.sex,
        relation_to_head: input.relationToHead,
        note: input.note,
        created_at: now(),
        updated_at: now(),
      };
      members.set(row.id, row);
      return row;
    },

    async listMembers(householdId) {
      return membersOfHousehold(householdId).sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      );
    },

    async getMember(memberId) {
      return members.get(memberId) ?? null;
    },

    async updateMember(memberId, patch) {
      const existing = members.get(memberId);
      if (!existing) return null;
      const next = touch({ ...existing, ...patch });
      members.set(memberId, next);
      return next;
    },

    async countMembersForAsha(ashaId) {
      const householdIds = new Set(
        [...households.values()]
          .filter((row) => row.assigned_asha_id === ashaId)
          .map((row) => row.id)
      );
      return [...members.values()].filter((row) => householdIds.has(row.household_id)).length;
    },

    async countOpenCasesForHousehold(householdId) {
      return casesOfHousehold(householdId).filter((row) => isOpenStatus(row.status)).length;
    },

    async createCase(input) {
      const timestamp = now();
      const row: HealthCaseRow = {
        id: nextId(),
        case_number: `C-${String(++caseCounter).padStart(4, '0')}`,
        household_id: input.householdId,
        household_member_id: input.householdMemberId,
        created_by_asha_id: input.createdByAshaId,
        assigned_doctor_id: null,
        status: 'OPEN',
        priority: input.priority,
        summary: input.summary,
        source: input.source,
        camp_id: input.campId,
        opened_at: timestamp,
        closed_at: null,
        created_at: timestamp,
        updated_at: timestamp,
      };
      cases.set(row.id, row);
      return row;
    },

    async getCase(caseId) {
      return cases.get(caseId) ?? null;
    },

    async updateCase(caseId, patch) {
      const existing = cases.get(caseId);
      if (!existing) return null;
      const next = touch({ ...existing, ...patch });
      cases.set(caseId, next);
      return next;
    },

    async listCasesByAsha(ashaId, filter) {
      return filterCases(
        [...cases.values()].filter((row) => {
          const household = households.get(row.household_id);
          return household?.assigned_asha_id === ashaId;
        }),
        filter
      );
    },

    async listCasesByDoctor(doctorId, filter) {
      // The doctor's list is the cases assigned to them, plus any case they hold a
      // referral on. A referral accepted moments ago has not written
      // `assigned_doctor_id` yet in a reader's expectation, and a doctor who cannot
      // see the case they just accepted will file a second referral.
      const referredCaseIds = new Set(
        [...referrals.values()]
          .filter((row) => row.referred_to_doctor_id === doctorId)
          .map((row) => row.case_id)
      );
      return filterCases(
        [...cases.values()].filter(
          (row) => row.assigned_doctor_id === doctorId || referredCaseIds.has(row.id)
        ),
        filter
      );
    },

    async listCasesByCamp(campId, limit) {
      return [...cases.values()]
        .filter((row) => row.camp_id === campId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, limit);
    },

    async countOpenCasesForAsha(ashaId) {
      const householdIds = new Set(
        [...households.values()]
          .filter((row) => row.assigned_asha_id === ashaId)
          .map((row) => row.id)
      );
      return [...cases.values()].filter(
        (row) => householdIds.has(row.household_id) && isOpenStatus(row.status)
      ).length;
    },

    async countCasesUnderReview(doctorId) {
      return [...cases.values()].filter(
        (row) =>
          row.assigned_doctor_id === doctorId &&
          (row.status === 'UNDER_REVIEW' || row.status === 'FOLLOW_UP')
      ).length;
    },

    async createObservation(input) {
      const row: CaseObservationRow = {
        id: nextId(),
        case_id: input.caseId,
        household_member_id: input.householdMemberId,
        recorded_by_asha_id: input.recordedByAshaId,
        observed_on: input.observedOn,
        reported_symptoms: input.reportedSymptoms,
        severity: input.severity,
        duration_days: input.durationDays,
        notes: input.notes,
        referral_reason: input.referralReason,
        created_at: now(),
        updated_at: now(),
      };
      observations.set(row.id, row);
      return row;
    },

    async listObservationsByCase(caseId) {
      return [...observations.values()]
        .filter((row) => row.case_id === caseId)
        // Oldest first: a clinician reads the history in the order it happened.
        .sort((a, b) => a.observed_on.localeCompare(b.observed_on));
    },

    async createReferral(input) {
      const row: ReferralRow = {
        id: nextId(),
        case_id: input.caseId,
        referred_by_asha_id: input.referredByAshaId,
        referred_to_doctor_id: input.referredToDoctorId,
        reason: input.reason,
        priority: input.priority,
        status: 'PENDING',
        camp_id: input.campId,
        accepted_at: null,
        completed_at: null,
        created_at: now(),
        updated_at: now(),
      };
      referrals.set(row.id, row);
      return row;
    },

    async getReferral(referralId) {
      return referrals.get(referralId) ?? null;
    },

    async updateReferral(referralId, patch) {
      const existing = referrals.get(referralId);
      if (!existing) return null;
      const next = touch({ ...existing, ...patch });
      referrals.set(referralId, next);
      return next;
    },

    async listReferralsByAsha(ashaId, filter) {
      return filterReferrals(
        [...referrals.values()].filter((row) => row.referred_by_asha_id === ashaId),
        filter
      );
    },

    async listReferralsByDoctor(doctorId, filter) {
      return filterReferrals(
        [...referrals.values()].filter((row) => row.referred_to_doctor_id === doctorId),
        filter
      );
    },

    async listReferralsByCase(caseId) {
      return [...referrals.values()]
        .filter((row) => row.case_id === caseId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    },

    async listReferralsByCamp(campId, limit) {
      return [...referrals.values()]
        .filter((row) => row.camp_id === campId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit);
    },

    async countPendingReferralsForAsha(ashaId) {
      return [...referrals.values()].filter(
        (row) => row.referred_by_asha_id === ashaId && row.status === 'PENDING'
      ).length;
    },

    async countPendingReferralsForDoctor(doctorId) {
      return [...referrals.values()].filter(
        (row) => row.referred_to_doctor_id === doctorId && row.status === 'PENDING'
      ).length;
    },

    async createClinicalNote(input) {
      const row: ClinicalNoteRow = {
        id: nextId(),
        case_id: input.caseId,
        doctor_id: input.doctorId,
        assessment: input.assessment,
        observations: input.observations,
        advice: input.advice,
        follow_up_on: input.followUpOn,
        created_at: now(),
        updated_at: now(),
      };
      clinicalNotes.set(row.id, row);
      return row;
    },

    async listClinicalNotesByCase(caseId) {
      return [...clinicalNotes.values()]
        .filter((row) => row.case_id === caseId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    },

    async createPrescription(input) {
      const row: PrescriptionRow = {
        id: nextId(),
        case_id: input.caseId,
        clinical_note_id: input.clinicalNoteId,
        doctor_id: input.doctorId,
        medicine_name: input.medicineName,
        dosage: input.dosage,
        frequency: input.frequency,
        duration: input.duration,
        instructions: input.instructions,
        created_at: now(),
        updated_at: now(),
      };
      prescriptions.set(row.id, row);
      return row;
    },

    async getPrescription(prescriptionId) {
      return prescriptions.get(prescriptionId) ?? null;
    },

    async updatePrescription(prescriptionId, patch) {
      const existing = prescriptions.get(prescriptionId);
      if (!existing) return null;
      const next = touch({ ...existing, ...patch });
      prescriptions.set(prescriptionId, next);
      return next;
    },

    async listPrescriptionsByCase(caseId) {
      return [...prescriptions.values()]
        .filter((row) => row.case_id === caseId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    },

    async createFollowUp(input) {
      const row: FollowUpRow = {
        id: nextId(),
        case_id: input.caseId,
        assigned_to_user_id: input.assignedToUserId,
        assigned_role: input.assignedRole,
        due_date: input.dueDate,
        notes: input.notes,
        status: 'PENDING',
        completed_at: null,
        completed_by_user_id: null,
        created_at: now(),
        updated_at: now(),
      };
      followUps.set(row.id, row);
      return row;
    },

    async getFollowUp(followUpId) {
      return followUps.get(followUpId) ?? null;
    },

    async updateFollowUp(followUpId, patch) {
      const existing = followUps.get(followUpId);
      if (!existing) return null;
      const next = touch({ ...existing, ...patch });
      followUps.set(followUpId, next);
      return next;
    },

    async listFollowUpsByCase(caseId) {
      return [...followUps.values()]
        .filter((row) => row.case_id === caseId)
        .sort((a, b) => a.due_date.localeCompare(b.due_date));
    },

    async listFollowUpsByAssignee(userId, filter) {
      return filterFollowUps(
        [...followUps.values()].filter((row) => row.assigned_to_user_id === userId),
        filter
      );
    },

    async countPendingFollowUpsForUser(userId) {
      return [...followUps.values()].filter(
        (row) => row.assigned_to_user_id === userId && row.status === 'PENDING'
      ).length;
    },

    async createCamp(input) {
      const row: HealthCampRow = {
        id: nextId(),
        title: input.title,
        description: input.description,
        camp_date: input.campDate,
        start_time: input.startTime,
        end_time: input.endTime,
        location: input.location,
        organizer_user_id: input.organizerUserId,
        capacity: input.capacity,
        status: 'DRAFT',
        created_at: now(),
        updated_at: now(),
      };
      camps.set(row.id, row);
      return row;
    },

    async getCamp(campId) {
      return camps.get(campId) ?? null;
    },

    async updateCamp(campId, patch) {
      const existing = camps.get(campId);
      if (!existing) return null;
      if (patch.status && !canTransitionHealthCamp(existing.status, patch.status)) {
        throw conflict(['status']);
      }
      const { status, ...rest } = patch;
      const next = touch({ ...existing, ...rest, ...(status ? { status } : {}) });
      camps.set(campId, next);
      return next;
    },

    async listCamps(filter) {
      return [...camps.values()]
        .filter((row) =>
          filter.status && filter.status !== 'ALL' ? row.status === filter.status : true
        )
        // Soonest first, and past camps drop off the end rather than leading the list.
        .sort((a, b) => a.camp_date.localeCompare(b.camp_date))
        .slice(0, filter.limit);
    },

    async countRegistrations(campId) {
      return [...registrations.values()].filter((row) => row.camp_id === campId).length;
    },

    async countAttendance(campId, status) {
      return [...attendance.values()].filter(
        (row) => row.camp_id === campId && row.status === status
      ).length;
    },

    async registerForCamp(campId, userId) {
      const camp = camps.get(campId);
      if (!camp) throw notFound();
      if (camp.status !== 'PUBLISHED') throw conflict(['campId']);
      if (camp.camp_date < today()) throw conflict(['campId']);

      // The duplicate rule, expressed as the unique (camp_id, user_id) index is in
      // SQL. Here it is a lookup, and a repeat registration answers with the
      // registration the person already holds rather than an error: a double tap on
      // "register" is a UI accident, not an attempt to take two seats.
      const existing = [...registrations.values()].find(
        (row) => row.camp_id === campId && row.user_id === userId
      );
      if (existing) return existing;

      // The capacity rule, enforced atomically in SQL by
      // `camp_registrations_within_capacity`. This check exists to produce a better
      // message before a form is filled in; it is not the guarantee.
      const taken = [...registrations.values()].filter((row) => row.camp_id === campId).length;
      if (taken >= camp.capacity) throw conflict(['campId']);

      const timestamp = now();
      const registration: CampRegistrationRow = {
        id: nextId(),
        camp_id: campId,
        user_id: userId,
        registered_at: timestamp,
        created_at: timestamp,
        updated_at: timestamp,
      };
      registrations.set(registration.id, registration);

      // Written together with the seat, because the roster is built from this row
      // and a person with a seat and no register line is a person who does not
      // exist as far as the camp is concerned.
      const row: CampAttendanceRow = {
        id: nextId(),
        camp_id: campId,
        registration_id: registration.id,
        status: 'REGISTERED',
        marked_by_user_id: null,
        marked_at: null,
        created_at: timestamp,
        updated_at: timestamp,
      };
      attendance.set(row.id, row);

      return registration;
    },

    async getRegistration(registrationId) {
      return registrations.get(registrationId) ?? null;
    },

    async findRegistration(campId, userId) {
      return (
        [...registrations.values()].find(
          (row) => row.camp_id === campId && row.user_id === userId
        ) ?? null
      );
    },

    async listRegistrationsByUser(userId) {
      return [...registrations.values()]
        .filter((row) => row.user_id === userId)
        .sort((a, b) => b.registered_at.localeCompare(a.registered_at));
    },

    async listRegistrationsByCamp(campId) {
      return [...registrations.values()]
        .filter((row) => row.camp_id === campId)
        .sort((a, b) => a.registered_at.localeCompare(b.registered_at));
    },

    async listAttendanceByCamp(campId) {
      return [...attendance.values()].filter((row) => row.camp_id === campId);
    },

    async deleteRegistration(registrationId) {
      const row = registrations.get(registrationId);
      if (!row) return null;
      registrations.delete(registrationId);
      // The attendance row is the seat, and the schema cascades it. Doing the same
      // here keeps the two adapters honest: a person who cancels is not counted as
      // absent, which is a different statement and would show up in a camp's tally.
      for (const [key, value] of [...attendance.entries()]) {
        if (value.registration_id === registrationId) attendance.delete(key);
      }
      return row;
    },

    async markAttendance(registrationId, status, markedByUserId) {
      const row = [...attendance.values()].find(
        (candidate) => candidate.registration_id === registrationId
      );
      if (!row) return null;
      if (!canMarkAttendance(row.status, status)) throw conflict(['status']);

      const next: CampAttendanceRow = {
        ...row,
        status,
        // Attribution is not optional: `camp_attendance_marked_is_attributable` in
        // the schema refuses a marked row that does not say who marked it and when,
        // and an unattributable attendance record is not evidence of anything.
        marked_by_user_id: status === 'REGISTERED' ? null : markedByUserId,
        marked_at: status === 'REGISTERED' ? null : now(),
        updated_at: now(),
      };
      attendance.set(next.id, next);
      return next;
    },

    async recordAuditEvent(input) {
      auditLog.push(input);
    },
  };

  return { store, auditLog, seedProfile: seedProfileRow };
}

/** Shared by both adapters: a PostgREST failure that is not ours becomes a 502. */
export function unwrapPostgrest<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw upstreamUnavailable();
  if (result.data === null) throw upstreamUnavailable();
  return result.data;
}
