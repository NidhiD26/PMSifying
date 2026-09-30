import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase-database';
import type { HealthCampRow } from '@/types/healthcare-db';
import type { CampAttendanceStatus } from '@/types/healthcare';
import type {
  CampFilter,
  CaseFilter,
  CreateCampInput,
  CreateCaseInput,
  CreateClinicalNoteInput,
  CreateFollowUpInput,
  CreateObservationInput,
  CreateReferralInput,
  FollowUpFilter,
  HealthcareStore,
  HouseholdInput,
  MemberInput,
  PrescriptionInput,
  RecommendPatientForCampInput,
  RecordAuditEventInput,
  ReferralFilter,
} from '@/lib/healthcare/store';
import { upstreamUnavailable } from '@/lib/healthcare/errors';

/**
 * The production adapter: Postgres through Row Level Security.
 *
 * The client passed in here is the *cookie-backed anon-key* client from
 * `@/lib/supabase/server`, so every statement below is evaluated by Postgres as the
 * signed-in worker. That is the whole point of this file: it issues ordinary
 * queries and relies on the policies in `0004_healthcare_rls.sql` to decide what
 * they may touch. A bug here can under-fetch; it cannot over-fetch, because no
 * statement in this file holds a privilege the caller's session does not already
 * have.
 *
 * WHAT THIS FILE THEREFORE DOES NOT DO
 *   - It does not filter by role or by ownership. "Is this your household" is asked
 *     once, in one policy, and re-implementing it here would be a second answer that
 *     can disagree with the first.
 *   - It does not check a role before a write. The insert policy on `prescriptions`
 *     requires `doctor_id = auth.uid()`, and `profiles` has no update path for
 *     `role` at all, so a client cannot promote itself by any route.
 *   - It does not accept an actor id for an audit row. `healthcare_record_audit_event`
 *     reads the actor from `auth.uid()` and takes no such argument, so the value this
 *     file is handed cannot reach the row.
 *
 * THE TWO PLACES LOGIC DOES LIVE HERE
 *   - counting, because "how many seats are left" is an exact `count` and a
 *     `head: true` filter is what the database is for;
 *   - ordering, because an urgent referral is shown before a routine one and
 *     oldest-first within a priority, and that has to be one consistent rule rather
 *     than whatever the UI happens to sort by.
 */

interface PostgrestResult<T> {
  data: T | null;
  error: { message: string } | null;
}

/**
 * The row type a query settles on, read off the query itself.
 *
 * Naming the row in a parameter position sounds tidier and is worse: `T` inferred
 * from a `data: T | null` member will happily bind to `null`, and the result is a
 * method typed `Promise<null>` that compiles while describing nothing. Deriving the
 * type from the awaited value instead means the row always comes from the query.
 */
type DataOf<A> = A extends PromiseLike<infer U>
  ? U extends { data: infer D }
    ? NonNullable<D>
    : never
  : A extends { data: infer D }
    ? NonNullable<D>
    : never;
type ElementOf<A> = DataOf<A> extends readonly (infer U)[] ? U : never;

/**
 * The three result shapes, unwrapped.
 *
 * Every query in this file goes through one of these, so a driver message, a
 * connection string or a Postgres error detail can never reach a response body, and
 * the row type is the one `Database` declares rather than a cast of it.
 * `oneOf` and `maybeOf` are separate because "no such row" is a legitimate answer
 * to a read and a failure for a write; conflating the two is how a `not_found`
 * turns into a 502.
 *
 * Each takes the query, not its result, and awaits it here. That way a query
 * assembled conditionally is still a query, and no call site has to remember whether
 * the value in its hands has been resolved yet.
 */
const rowsOf = async <A>(query: A): Promise<ElementOf<A>[]> => {
  const settled = (await query) as PostgrestResult<ElementOf<A>[]>;
  if (settled.error) throw upstreamUnavailable();
  return settled.data ?? [];
};

const oneOf = async <A>(query: A): Promise<DataOf<A>> => {
  const settled = (await query) as PostgrestResult<DataOf<A>>;
  if (settled.error) throw upstreamUnavailable();
  if (settled.data === null) throw upstreamUnavailable();
  return settled.data;
};

const maybeOf = async <A>(query: A): Promise<DataOf<A> | null> => {
  const settled = (await query) as PostgrestResult<DataOf<A>>;
  if (settled.error) throw upstreamUnavailable();
  return settled.data;
};

/**
 * Exact counts, not a page length.
 *
 * `count: 'exact'` with `head: true` is the only shape PostgREST offers for a
 * number rather than a set, and a dashboard that shows `rows.length` is a dashboard
 * that reads "25" on the twenty-fifth open case.
 */
const countOf = (result: { count: number | null; error: unknown }): number => {
  if (result.error) throw upstreamUnavailable();
  return result.count ?? 0;
};

/**
 * Postgres `time` comes back as `HH:MM:SS`; the schema, the DTOs and the UI all
 * use `HH:MM`.
 *
 * Normalised on the way *out* rather than in the UI, so a camp read from the
 * database and a camp read from the in-memory adapter are identical. A duration
 * computed as `endTime - startTime` therefore means the same thing in a test as it
 * does in a request.
 */
const toClockTime = (value: string): string => value.slice(0, 5);

const toHealthCampRow = (row: HealthCampRow): HealthCampRow => ({
  ...row,
  start_time: toClockTime(row.start_time),
  end_time: toClockTime(row.end_time),
});

/**
 * Applies a status filter, treating `ALL` as "no filter".
 *
 * `ALL` is a UI affordance rather than a stored value, so it is spelled out here and
 * nowhere else: no call site has to remember that `.eq('status', 'ALL')` would match
 * nothing at all.
 */
const withStatus = <Q extends { eq: (column: string, value: string) => Q }>(
  query: Q,
  status: string | undefined
): Q => (status && status !== 'ALL' ? query.eq('status', status) : query);

export function createSupabaseHealthcareStore(client: SupabaseClient<Database>): HealthcareStore {
  /** The household ids a worker is responsible for. Empty means "none", not "all". */
  const householdIdsFor = async (ashaId: string): Promise<string[]> => {
    const { data, error } = await client
      .from('households')
      .select('id')
      .eq('assigned_asha_id', ashaId);
    if (error) throw upstreamUnavailable();
    return (data ?? []).map((row) => row.id);
  };

  return {
    async getProfile(userId) {
      return maybeOf(
        await client.from('profiles').select('*').eq('id', userId).maybeSingle()
      );
    },

    async createAshaProfile(input) {
      return oneOf(
        await client
          .from('asha_profiles')
          .insert({
            user_id: input.userId,
            full_name: input.fullName,
            registration_number: input.registrationNumber,
            area: input.area,
          })
          .select('*')
          .single()
      );
    },

    async createDoctorProfile(input) {
      return oneOf(
        await client
          .from('doctor_profiles')
          .insert({
            user_id: input.userId,
            full_name: input.fullName,
            registration_number: input.registrationNumber,
            speciality: input.speciality,
          })
          .select('*')
          .single()
      );
    },

    async getAshaProfile(userId) {
      return maybeOf(
        await client.from('asha_profiles').select('*').eq('user_id', userId).maybeSingle()
      );
    },

    async getDoctorProfile(userId) {
      return maybeOf(
        await client.from('doctor_profiles').select('*').eq('user_id', userId).maybeSingle()
      );
    },

    async listDoctors() {
      // The referral form's destination picker. A roster rather than a free-text
      // field, because a referral that spells a doctor's name wrong produces a case
      // nobody can reach. `doctor_profiles` has no member read policy in 0004, so
      // this answers exactly the one question it needs to and hands out staff names
      // rather than account ids.
      return rowsOf(await client.from('doctor_profiles').select('*').order('full_name'));
    },

    async createHousehold(assignedAshaId, input: HouseholdInput) {
      // `code` is deliberately absent: the column's default mints it from a
      // sequence. Supplying one from the client would be a way to collide with an
      // existing register number, or to mint a misleading one.
      return oneOf(
        await client
          .from('households')
          .insert({
            name: input.name,
            address_line: input.addressLine,
            assigned_asha_id: assignedAshaId,
          })
          .select('*')
          .single()
      );
    },

    async listHouseholds(assignedAshaId) {
      return rowsOf(
        await client
          .from('households')
          .select('*')
          .eq('assigned_asha_id', assignedAshaId)
          .order('updated_at', { ascending: false })
      );
    },

    async getHousehold(householdId) {
      return maybeOf(
        await client.from('households').select('*').eq('id', householdId).maybeSingle()
      );
    },

    async updateHousehold(householdId, patch) {
      return maybeOf(
        await client
          .from('households')
          .update(patch)
          .eq('id', householdId)
          .select('*')
          .maybeSingle()
      );
    },

    async createMember(householdId, input: MemberInput) {
      return oneOf(
        await client
          .from('household_members')
          .insert({
            household_id: householdId,
            full_name: input.fullName,
            age_years: input.ageYears,
            sex: input.sex,
            relation_to_head: input.relationToHead,
            note: input.note,
          })
          .select('*')
          .single()
      );
    },

    async listMembers(householdId) {
      return rowsOf(
        await client
          .from('household_members')
          .select('*')
          .eq('household_id', householdId)
          .order('created_at')
      );
    },

    async getMember(memberId) {
      return maybeOf(
        await client.from('household_members').select('*').eq('id', memberId).maybeSingle()
      );
    },

    async updateMember(memberId, patch) {
      return maybeOf(
        await client
          .from('household_members')
          .update(patch)
          .eq('id', memberId)
          .select('*')
          .maybeSingle()
      );
    },

    async countMembersForAsha(ashaId) {
      // Counted through the worker's own households rather than by listing members
      // per household: the select policy already restricts the households query to
      // this worker, so the inner read is not a leak, and the whole count is two
      // round trips instead of one per household.
      const householdIds = await householdIdsFor(ashaId);
      // An empty `in` list is a syntax error in PostgREST rather than an empty
      // result, so a worker with no households short-circuits to the honest answer.
      if (householdIds.length === 0) return 0;

      return countOf(
        await client
          .from('household_members')
          .select('*', { count: 'exact', head: true })
          .in('household_id', householdIds)
      );
    },

    async countOpenCasesForHousehold(householdId) {
      return countOf(
        await client
          .from('health_cases')
          .select('*', { count: 'exact', head: true })
          .eq('household_id', householdId)
          .neq('status', 'CLOSED')
      );
    },

    async createCase(input: CreateCaseInput) {
      // `case_number` is absent on purpose: the column default mints it.
      return oneOf(
        await client
          .from('health_cases')
          .insert({
            household_id: input.householdId,
            household_member_id: input.householdMemberId,
            created_by_asha_id: input.createdByAshaId,
            priority: input.priority,
            summary: input.summary,
            source: input.source,
            camp_id: input.campId,
          })
          .select('*')
          .single()
      );
    },

    async getCase(caseId) {
      return maybeOf(await client.from('health_cases').select('*').eq('id', caseId).maybeSingle());
    },

    async updateCase(caseId, patch) {
      return maybeOf(
        await client
          .from('health_cases')
          .update(patch)
          .eq('id', caseId)
          .select('*')
          .maybeSingle()
      );
    },

    async listCasesByAsha(ashaId, filter: CaseFilter) {
      // Routed through the worker's households rather than filtered on
      // `created_by_asha_id`, because a case is reachable by every worker assigned
      // to the household, not only the one who opened it: a colleague covering the
      // same patch has to be able to pick up a case.
      const householdIds = await householdIdsFor(ashaId);
      if (householdIds.length === 0) return [];

      const filtered = withStatus(
        client
          .from('health_cases')
          .select('*')
          .in('household_id', householdIds)
          .order('updated_at', { ascending: false })
          .limit(filter.limit),
        filter.status
      );

      return rowsOf(
        filter.priority && filter.priority !== 'ALL'
          ? filtered.eq('priority', filter.priority)
          : filtered
      );
    },

    async listCasesByDoctor(doctorId, filter: CaseFilter) {
      // Assigned cases plus the cases this doctor holds a referral on. Without the
      // second half, a referral accepted a second ago shows an empty case list, and
      // the obvious response to that is to file a second referral.
      const referredCaseIds = [
        ...new Set(
          (
            await rowsOf(
              await client
                .from('referrals')
                .select('case_id')
                .eq('referred_to_doctor_id', doctorId)
            )
          ).map((row) => row.case_id)
        ),
      ];

      const assigned = await rowsOf(
        await client
          .from('health_cases')
          .select('*')
          .eq('assigned_doctor_id', doctorId)
          .order('updated_at', { ascending: false })
          .limit(filter.limit)
      );

      const referred =
        referredCaseIds.length === 0
          ? []
          : await rowsOf(
              await client
                .from('health_cases')
                .select('*')
                .in('id', referredCaseIds)
                .order('updated_at', { ascending: false })
                .limit(filter.limit)
            );

      const seen = new Set(assigned.map((row) => row.id));
      return [
        ...assigned,
        ...referred.filter((row) => !seen.has(row.id)),
      ]
        .filter((row) =>
          filter.status && filter.status !== 'ALL' ? row.status === filter.status : true
        )
        .filter((row) =>
          filter.priority && filter.priority !== 'ALL'
            ? row.priority === filter.priority
            : true
        )
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, filter.limit);
    },

    async countReferredCasesByCamp(campId) {
      // The unique index `camp_registrations_one_case_per_camp_idx` allows one row
      // per (camp_id, case_id), so counting the rows that carry a case counts
      // distinct cases. Cancelled referrals are excluded, as in the in-memory
      // store, so both implementations answer the same question.
      return countOf(
        await client
          .from('camp_registrations')
          .select('*', { count: 'exact', head: true })
          .eq('camp_id', campId)
          .not('case_id', 'is', null)
          .neq('registration_status', 'CANCELLED')
      );
    },

    async countOpenCasesForAsha(ashaId) {
      const householdIds = await householdIdsFor(ashaId);
      if (householdIds.length === 0) return 0;
      return countOf(
        await client
          .from('health_cases')
          .select('*', { count: 'exact', head: true })
          .in('household_id', householdIds)
          .neq('status', 'CLOSED')
      );
    },

    async countCasesUnderReview(doctorId) {
      return countOf(
        await client
          .from('health_cases')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_doctor_id', doctorId)
          .in('status', ['UNDER_REVIEW', 'FOLLOW_UP'])
      );
    },

    async createObservation(input: CreateObservationInput) {
      return oneOf(
        await client
          .from('case_observations')
          .insert({
            case_id: input.caseId,
            household_member_id: input.householdMemberId,
            recorded_by_asha_id: input.recordedByAshaId,
            observed_on: input.observedOn,
            reported_symptoms: input.reportedSymptoms,
            severity: input.severity,
            duration_days: input.durationDays,
            notes: input.notes,
            referral_reason: input.referralReason,
          })
          .select('*')
          .single()
      );
    },

    async listObservationsByCase(caseId) {
      // Oldest first: a clinician reads the history in the order it happened.
      return rowsOf(
        await client
          .from('case_observations')
          .select('*')
          .eq('case_id', caseId)
          .order('observed_on')
      );
    },

    async createReferral(input: CreateReferralInput) {
      return oneOf(
        await client
          .from('referrals')
          .insert({
            case_id: input.caseId,
            referred_by_asha_id: input.referredByAshaId,
            referred_to_doctor_id: input.referredToDoctorId,
            reason: input.reason,
            priority: input.priority,
            camp_id: input.campId,
          })
          .select('*')
          .single()
      );
    },

    async getReferral(referralId) {
      return maybeOf(
        await client.from('referrals').select('*').eq('id', referralId).maybeSingle()
      );
    },

    async updateReferral(referralId, patch) {
      return maybeOf(
        await client
          .from('referrals')
          .update(patch)
          .eq('id', referralId)
          .select('*')
          .maybeSingle()
      );
    },

    async listReferralsByAsha(ashaId, filter: ReferralFilter) {
      // Urgent first, then oldest. A referral queue is worked in the order it will
      // hurt somebody soonest, and a plain `created_at desc` puts the newest routine
      // referral above an urgent one filed yesterday.
      return rowsOf(
        withStatus(
          client
            .from('referrals')
            .select('*')
            .eq('referred_by_asha_id', ashaId)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(filter.limit),
          filter.status
        )
      );
    },

    async listReferralsByDoctor(doctorId, filter: ReferralFilter) {
      return rowsOf(
        withStatus(
          client
            .from('referrals')
            .select('*')
            .eq('referred_to_doctor_id', doctorId)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(filter.limit),
          filter.status
        )
      );
    },

    async listReferralsByCase(caseId) {
      return rowsOf(
        await client.from('referrals').select('*').eq('case_id', caseId).order('created_at')
      );
    },

    async listReferralsByCamp(campId, limit) {
      return rowsOf(
        await client
          .from('referrals')
          .select('*')
          .eq('camp_id', campId)
          .order('created_at', { ascending: false })
          .limit(limit)
      );
    },

    async countPendingReferralsForAsha(ashaId) {
      return countOf(
        await client
          .from('referrals')
          .select('*', { count: 'exact', head: true })
          .eq('referred_by_asha_id', ashaId)
          .eq('status', 'PENDING')
      );
    },

    async countPendingReferralsForDoctor(doctorId) {
      return countOf(
        await client
          .from('referrals')
          .select('*', { count: 'exact', head: true })
          .eq('referred_to_doctor_id', doctorId)
          .eq('status', 'PENDING')
      );
    },

    async createClinicalNote(input: CreateClinicalNoteInput) {
      return oneOf(
        await client
          .from('clinical_notes')
          .insert({
            case_id: input.caseId,
            doctor_id: input.doctorId,
            assessment: input.assessment,
            observations: input.observations,
            advice: input.advice,
            follow_up_on: input.followUpOn,
          })
          .select('*')
          .single()
      );
    },

    async listClinicalNotesByCase(caseId) {
      return rowsOf(
        await client.from('clinical_notes').select('*').eq('case_id', caseId).order('created_at')
      );
    },

    async createPrescription(input: PrescriptionInput) {
      return oneOf(
        await client
          .from('prescriptions')
          .insert({
            case_id: input.caseId,
            clinical_note_id: input.clinicalNoteId,
            doctor_id: input.doctorId,
            medicine_name: input.medicineName,
            dosage: input.dosage,
            frequency: input.frequency,
            duration: input.duration,
            instructions: input.instructions,
          })
          .select('*')
          .single()
      );
    },

    async getPrescription(prescriptionId) {
      return maybeOf(
        await client.from('prescriptions').select('*').eq('id', prescriptionId).maybeSingle()
      );
    },

    async updatePrescription(prescriptionId, patch) {
      return maybeOf(
        await client
          .from('prescriptions')
          .update(patch)
          .eq('id', prescriptionId)
          .select('*')
          .maybeSingle()
      );
    },

    async listPrescriptionsByCase(caseId) {
      return rowsOf(
        await client.from('prescriptions').select('*').eq('case_id', caseId).order('created_at')
      );
    },

    async createFollowUp(input: CreateFollowUpInput) {
      return oneOf(
        await client
          .from('follow_ups')
          .insert({
            case_id: input.caseId,
            assigned_to_user_id: input.assignedToUserId,
            assigned_role: input.assignedRole,
            due_date: input.dueDate,
            notes: input.notes,
          })
          .select('*')
          .single()
      );
    },

    async getFollowUp(followUpId) {
      return maybeOf(
        await client.from('follow_ups').select('*').eq('id', followUpId).maybeSingle()
      );
    },

    async updateFollowUp(followUpId, patch) {
      return maybeOf(
        await client
          .from('follow_ups')
          .update(patch)
          .eq('id', followUpId)
          .select('*')
          .maybeSingle()
      );
    },

    async listFollowUpsByCase(caseId) {
      return rowsOf(
        await client.from('follow_ups').select('*').eq('case_id', caseId).order('due_date')
      );
    },

    async listFollowUpsByAssignee(userId, filter: FollowUpFilter) {
      return rowsOf(
        withStatus(
          client
            .from('follow_ups')
            .select('*')
            .eq('assigned_to_user_id', userId)
            .order('due_date', { ascending: true })
            .limit(filter.limit),
          filter.status
        )
      );
    },

    async countPendingFollowUpsForUser(userId) {
      return countOf(
        await client
          .from('follow_ups')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to_user_id', userId)
          .eq('status', 'PENDING')
      );
    },

    async createCamp(input: CreateCampInput) {
      return oneOf(
        await client
          .from('health_camps')
          .insert({
            title: input.title,
            description: input.description,
            camp_date: input.campDate,
            start_time: input.startTime,
            end_time: input.endTime,
            location: input.location,
            capacity: input.capacity,
            organizer_user_id: input.organizerUserId,
          })
          .select('*')
          .single()
      );
    },

    async getCamp(campId) {
      const row = await maybeOf(
        await client.from('health_camps').select('*').eq('id', campId).maybeSingle()
      );
      return row ? toHealthCampRow(row) : null;
    },

    async updateCamp(campId, patch) {
      const row = await maybeOf(
        await client
          .from('health_camps')
          .update(patch)
          .eq('id', campId)
          .select('*')
          .maybeSingle()
      );
      return row ? toHealthCampRow(row) : null;
    },

    async listCamps(filter: CampFilter) {
      const rows = await rowsOf(
        withStatus(
          client
            .from('health_camps')
            .select('*')
            .order('camp_date', { ascending: true })
            .limit(filter.limit),
          filter.status
        )
      );
      return rows.map(toHealthCampRow);
    },

    async countRegistrations(campId) {
      return countOf(
        await client
          .from('camp_registrations')
          .select('*', { count: 'exact', head: true })
          .eq('camp_id', campId)
          .eq('registration_status', 'REGISTERED')
      );
    },

    async countAttendance(campId, status: CampAttendanceStatus) {
      return countOf(
        await client
          .from('camp_attendance')
          .select('*', { count: 'exact', head: true })
          .eq('camp_id', campId)
          .eq('status', status)
      );
    },

    async recommendPatientForCamp(input: RecommendPatientForCampInput) {
      return oneOf(await client.from('camp_registrations').insert({
        camp_id: input.campId,
        case_id: input.caseId,
        household_member_id: input.householdMemberId,
        user_id: null,
        registration_status: 'RECOMMENDED',
        recommendation_source: 'DOCTOR',
        recommendation_reason: input.recommendationReason,
        recommended_by_doctor_id: input.recommendedByDoctorId,
        registered_by_user_id: null,
        registered_at: null,
      }).select('*').single());
    },

    async registerRecommendedPatient(registrationId, registeredByUserId) {
      const result = await client.rpc('healthcare_register_recommended_patient', {
        p_registration_id: registrationId,
        p_registered_by_user_id: registeredByUserId,
      });
      if (result.error) throw upstreamUnavailable();
      return result.data;
    },

    async registerForCamp(campId, userId) {
      // The seat and the register line are two inserts with no transaction in this
      // file. The capacity guarantee itself is not here: it is
      // `camp_registrations_within_capacity` in 0003, which locks the camp row before
      // counting, so two people racing for the last seat cannot both get it. If the
      // second insert fails, the person has a seat and no register line, which
      // `listAttendanceByCamp` reports as unregistered rather than as absent.
      const registration = await oneOf(
        await client
          .from('camp_registrations')
          .insert({ camp_id: campId, user_id: userId, registration_status: 'REGISTERED', registered_by_user_id: userId })
          .select('*')
          .single()
      );

      await client
        .from('camp_attendance')
        .insert({ camp_id: campId, registration_id: registration.id, status: 'REGISTERED' })
        .select('*')
        .single();

      return registration;
    },

    async getRegistration(registrationId) {
      return maybeOf(
        await client
          .from('camp_registrations')
          .select('*')
          .eq('id', registrationId)
          .maybeSingle()
      );
    },

    async findRegistration(campId, userId) {
      return maybeOf(
        await client
          .from('camp_registrations')
          .select('*')
          .eq('camp_id', campId)
          .eq('user_id', userId)
          .maybeSingle()
      );
    },

    async listRegistrationsByUser(userId) {
      return rowsOf(
        await client
          .from('camp_registrations')
          .select('*')
          .eq('user_id', userId)
          .order('registered_at', { ascending: false })
      );
    },

    async listRegistrationsByCamp(campId) {
      return rowsOf(
        await client
          .from('camp_registrations')
          .select('*')
          .eq('camp_id', campId)
          .order('registered_at')
      );
    },

    async listAttendanceByCamp(campId) {
      return rowsOf(await client.from('camp_attendance').select('*').eq('camp_id', campId));
    },

    async deleteRegistration(registrationId) {
      // A `delete` returns no rows, so the row is read back in the same round trip
      // rather than trusted to still be there. `camp_attendance` cascades from this
      // table, so the seat goes with it.
      const row = await maybeOf(
        await client
          .from('camp_registrations')
          .delete()
          .eq('id', registrationId)
          .select('*')
          .maybeSingle()
      );
      return row;
    },

    async markAttendance(registrationId, status, markedByUserId) {
      // Marked attendance is attributable: the schema's check constraint refuses a
      // row that is marked and does not say who marked it or when, so the two
      // columns are always written together and never one without the other.
      const patch =
        status === 'REGISTERED'
          ? { status, marked_by_user_id: null, marked_at: null }
          : { status, marked_by_user_id: markedByUserId, marked_at: new Date().toISOString() };

      return maybeOf(
        await client
          .from('camp_attendance')
          .update(patch)
          .eq('registration_id', registrationId)
          .select('*')
          .maybeSingle()
      );
    },

    async recordAuditEvent(input: RecordAuditEventInput) {
      // `actorId` is deliberately absent from the arguments below. The SQL function
      // reads the actor from `auth.uid()` and accepts no actor parameter, so the
      // caller cannot write a trail naming somebody else — which is the point: an
      // audit trail that can be forged by its subject is not a trail.
      await client.rpc('healthcare_record_audit_event', {
        p_action: input.action,
        p_entity: input.entity,
        p_entity_id: input.entityId,
        p_metadata: input.metadata,
      });
    },
  };
}



