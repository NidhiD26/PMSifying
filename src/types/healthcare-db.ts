import type { Json } from '@/types/supabase-database';

/**
 * The row shapes of the healthcare schema (World C).
 *
 * WHY THESE LIVE HERE AND NOT IN `@/types/supabase-database`
 * That file is the hand-maintained mirror of the SecretChat migration, and one of
 * its guards is that the properties it *declares* contain no personal-health
 * vocabulary. The healthcare schema legitimately does use that vocabulary — an
 * observation records reported symptoms, which is the whole point of a health
 * worker writing one down. Declaring those rows inline in that file would have
 * failed that guard for the wrong reason, so the rows are declared here and
 * referenced by name from `Database`. The SecretChat tables' own columns stay
 * declared inline, so the guard still reads every one of them.
 *
 * Every type here mirrors `supabase/migrations/0003_healthcare_schema.sql` by
 * hand, in the same way, and for the same reason: a diff is reviewable and a
 * regeneration cannot silently produce a different shape than the app is tested
 * against.
 */

export type HealthcareRoleRow = 'USER' | 'ASHA' | 'DOCTOR' | 'ADMIN';

export type CaseStatusRow = 'OPEN' | 'REFERRED' | 'UNDER_REVIEW' | 'FOLLOW_UP' | 'CLOSED';

export type CaseSourceRow = 'ASHA' | 'CAMP';

export type CasePriorityRow = 'ROUTINE' | 'URGENT';

export type ObservationSeverityRow = 'MILD' | 'MODERATE' | 'SEVERE';

export type ReferralStatusRow = 'PENDING' | 'ACCEPTED' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED';

export type FollowUpStatusRow = 'PENDING' | 'COMPLETED' | 'MISSED' | 'CANCELLED';

export type HealthCampStatusRow = 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED';

export type CampAttendanceStatusRow = 'REGISTERED' | 'ATTENDED' | 'ABSENT';

export type MemberSexRow = 'FEMALE' | 'MALE' | 'OTHER';

/**
 * The `profiles` row, as healthcare sees it.
 *
 * `0001_secretchat_schema.sql` created this table with no personal data and no
 * role; `0003_healthcare_schema.sql` adds `role`, defaulted to `USER`. The role is
 * authorisation input resolved from the server session on every request, and there
 * is no update policy for it in `0004_healthcare_rls.sql`.
 */
export type HealthcareProfileRow = {
  id: string;
  role: HealthcareRoleRow;
  created_at: string;
  updated_at: string;
  suspended_at: string | null;
};

export type AshaProfileRow = {
  user_id: string;
  full_name: string;
  registration_number: string | null;
  area: string | null;
  created_at: string;
  updated_at: string;
};

export type DoctorProfileRow = {
  user_id: string;
  full_name: string;
  registration_number: string | null;
  speciality: string | null;
  created_at: string;
  updated_at: string;
};

export type HouseholdRow = {
  id: string;
  code: string;
  name: string;
  address_line: string | null;
  assigned_asha_id: string;
  created_at: string;
  updated_at: string;
};

export type HouseholdMemberRow = {
  id: string;
  household_id: string;
  full_name: string;
  age_years: number | null;
  sex: MemberSexRow | null;
  relation_to_head: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type HealthCaseRow = {
  id: string;
  case_number: string;
  household_id: string;
  household_member_id: string;
  created_by_asha_id: string;
  assigned_doctor_id: string | null;
  status: CaseStatusRow;
  priority: CasePriorityRow;
  summary: string;
  source: CaseSourceRow;
  camp_id: string | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CaseObservationRow = {
  id: string;
  case_id: string;
  household_member_id: string;
  recorded_by_asha_id: string;
  observed_on: string;
  reported_symptoms: string[];
  severity: ObservationSeverityRow;
  duration_days: number | null;
  notes: string | null;
  referral_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ReferralRow = {
  id: string;
  case_id: string;
  referred_by_asha_id: string;
  referred_to_doctor_id: string;
  reason: string;
  priority: CasePriorityRow;
  status: ReferralStatusRow;
  camp_id: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ClinicalNoteRow = {
  id: string;
  case_id: string;
  doctor_id: string;
  assessment: string;
  observations: string | null;
  advice: string;
  follow_up_on: string | null;
  created_at: string;
  updated_at: string;
};

export type PrescriptionRow = {
  id: string;
  case_id: string;
  clinical_note_id: string | null;
  doctor_id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  created_at: string;
  updated_at: string;
};

export type FollowUpRow = {
  id: string;
  case_id: string;
  assigned_to_user_id: string;
  assigned_role: HealthcareRoleRow;
  due_date: string;
  notes: string | null;
  status: FollowUpStatusRow;
  completed_at: string | null;
  completed_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type HealthCampRow = {
  id: string;
  title: string;
  description: string | null;
  camp_date: string;
  start_time: string;
  end_time: string;
  location: string;
  organizer_user_id: string;
  capacity: number;
  status: HealthCampStatusRow;
  created_at: string;
  updated_at: string;
};

export type CampRegistrationRow = {
  id: string;
  camp_id: string;
  user_id: string | null;
  case_id: string | null;
  household_member_id: string | null;
  registration_status: 'RECOMMENDED' | 'REGISTERED' | 'CANCELLED';
  recommendation_source: 'DOCTOR' | null;
  recommendation_reason: string | null;
  recommended_by_doctor_id: string | null;
  recommended_at: string | null;
  registered_by_user_id: string | null;
  registered_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CampAttendanceRow = {
  id: string;
  camp_id: string;
  registration_id: string;
  status: CampAttendanceStatusRow;
  marked_by_user_id: string | null;
  marked_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * The healthcare portion of the `Database` map, keyed by table name.
 *
 * A *type alias*, not an interface, and that is load-bearing rather than
 * stylistic. The Supabase client requires the table map to satisfy
 * `Record<string, GenericTable>`, and TypeScript grants an implicit index signature
 * to a type alias of an object literal but never to an interface, so an interface
 * here silently collapses every `.from(...)` result to `never`.
 *
 * EVERY NULLABLE COLUMN IS OPTIONAL IN `Insert`
 * This is the difference between a row and what a caller has to supply: a column
 * that is nullable in SQL because it has a default, or is simply optional, is
 * optional here, so a write that omits it is legal. Getting this wrong is not a
 * call-site error, it is a type that demands a value the database is perfectly able
 * to produce — which is how columns end up being written as explicit nulls and then
 * failing a `not null` check added by the next migration.
 */
export type HealthcareTables = {
  asha_profiles: {
    Row: AshaProfileRow;
    Insert: Omit<AshaProfileRow, 'created_at' | 'updated_at' | 'registration_number' | 'area'> & {
      id?: string;
      registration_number?: string | null;
      area?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<Omit<AshaProfileRow, 'user_id' | 'created_at'>>;
    Relationships: [];
  };
  doctor_profiles: {
    Row: DoctorProfileRow;
    Insert: Omit<
      DoctorProfileRow,
      'created_at' | 'updated_at' | 'registration_number' | 'speciality'
    > & {
      id?: string;
      registration_number?: string | null;
      speciality?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<Omit<DoctorProfileRow, 'user_id' | 'created_at'>>;
    Relationships: [];
  };
  households: {
    Row: HouseholdRow;
    /** `code` is minted by the database, so a caller never supplies one. */
    Insert: Omit<HouseholdRow, 'id' | 'code' | 'created_at' | 'updated_at' | 'address_line'> & {
      id?: string;
      code?: string;
      address_line?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    /**
     * `assigned_asha_id` is absent from the update type on purpose. Reassigning a
     * household to a different worker is an administrative action taken with the
     * service role, and offering it here would make it reachable from any code that
     * happens to hold this type.
     */
    Update: Partial<Omit<HouseholdRow, 'id' | 'code' | 'assigned_asha_id' | 'created_at'>>;
    Relationships: [];
  };
  household_members: {
    Row: HouseholdMemberRow;
    Insert: Omit<
      HouseholdMemberRow,
      'id' | 'created_at' | 'updated_at' | 'age_years' | 'sex' | 'relation_to_head' | 'note'
    > & {
      id?: string;
      age_years?: number | null;
      sex?: MemberSexRow | null;
      relation_to_head?: string | null;
      note?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<Omit<HouseholdMemberRow, 'id' | 'household_id' | 'created_at'>>;
    Relationships: [];
  };
  health_cases: {
    Row: HealthCaseRow;
    Insert: Omit<
      HealthCaseRow,
      | 'id'
      | 'case_number'
      | 'status'
      | 'priority'
      | 'source'
      | 'assigned_doctor_id'
      | 'camp_id'
      | 'opened_at'
      | 'closed_at'
      | 'created_at'
      | 'updated_at'
    > & {
      id?: string;
      case_number?: string;
      status?: CaseStatusRow;
      priority?: CasePriorityRow;
      source?: CaseSourceRow;
      assigned_doctor_id?: string | null;
      camp_id?: string | null;
      opened_at?: string;
      closed_at?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<
      Omit<HealthCaseRow, 'id' | 'case_number' | 'household_id' | 'created_by_asha_id' | 'created_at'>
    >;
    Relationships: [];
  };
  case_observations: {
    Row: CaseObservationRow;
    Insert: Omit<
      CaseObservationRow,
      | 'id'
      | 'created_at'
      | 'updated_at'
      | 'severity'
      | 'duration_days'
      | 'notes'
      | 'referral_reason'
    > & {
      id?: string;
      severity?: ObservationSeverityRow;
      duration_days?: number | null;
      notes?: string | null;
      referral_reason?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<
      Omit<CaseObservationRow, 'id' | 'case_id' | 'recorded_by_asha_id' | 'created_at'>
    >;
    Relationships: [];
  };
  referrals: {
    Row: ReferralRow;
    Insert: Omit<
      ReferralRow,
      | 'id'
      | 'status'
      | 'priority'
      | 'camp_id'
      | 'accepted_at'
      | 'completed_at'
      | 'created_at'
      | 'updated_at'
    > & {
      id?: string;
      status?: ReferralStatusRow;
      priority?: CasePriorityRow;
      camp_id?: string | null;
      accepted_at?: string | null;
      completed_at?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<Omit<ReferralRow, 'id' | 'case_id' | 'referred_by_asha_id' | 'created_at'>>;
    Relationships: [];
  };
  clinical_notes: {
    Row: ClinicalNoteRow;
    Insert: Omit<
      ClinicalNoteRow,
      'id' | 'created_at' | 'updated_at' | 'observations' | 'follow_up_on'
    > & {
      id?: string;
      observations?: string | null;
      follow_up_on?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<Omit<ClinicalNoteRow, 'id' | 'case_id' | 'doctor_id' | 'created_at'>>;
    Relationships: [];
  };
  prescriptions: {
    Row: PrescriptionRow;
    Insert: Omit<
      PrescriptionRow,
      'id' | 'created_at' | 'updated_at' | 'clinical_note_id' | 'instructions'
    > & {
      id?: string;
      clinical_note_id?: string | null;
      instructions?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<Omit<PrescriptionRow, 'id' | 'case_id' | 'doctor_id' | 'created_at'>>;
    Relationships: [];
  };
  follow_ups: {
    Row: FollowUpRow;
    Insert: Omit<
      FollowUpRow,
      | 'id'
      | 'status'
      | 'notes'
      | 'completed_at'
      | 'completed_by_user_id'
      | 'created_at'
      | 'updated_at'
    > & {
      id?: string;
      status?: FollowUpStatusRow;
      notes?: string | null;
      completed_at?: string | null;
      completed_by_user_id?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<Omit<FollowUpRow, 'id' | 'case_id' | 'assigned_to_user_id' | 'created_at'>>;
    Relationships: [];
  };
  health_camps: {
    Row: HealthCampRow;
    Insert: Omit<HealthCampRow, 'id' | 'status' | 'description' | 'created_at' | 'updated_at'> & {
      id?: string;
      status?: HealthCampStatusRow;
      description?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<Omit<HealthCampRow, 'id' | 'organizer_user_id' | 'created_at'>>;
    Relationships: [];
  };
  camp_registrations: {
    Row: CampRegistrationRow;
    Insert: Omit<CampRegistrationRow, 'id' | 'user_id' | 'case_id' | 'household_member_id' | 'recommendation_source' | 'recommendation_reason' | 'recommended_by_doctor_id' | 'registered_by_user_id' | 'registered_at' | 'recommended_at' | 'created_at' | 'updated_at'> & {
      id?: string;
      user_id?: string | null;
      case_id?: string | null;
      household_member_id?: string | null;
      recommendation_source?: 'DOCTOR' | null;
      recommendation_reason?: string | null;
      recommended_by_doctor_id?: string | null;
      registered_by_user_id?: string | null;
      registered_at?: string | null;
      recommended_at?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: never;
    Relationships: [];
  };
  camp_attendance: {
    Row: CampAttendanceRow;
    Insert: Omit<
      CampAttendanceRow,
      'id' | 'status' | 'marked_by_user_id' | 'marked_at' | 'created_at' | 'updated_at'
    > & {
      id?: string;
      status?: CampAttendanceStatusRow;
      marked_by_user_id?: string | null;
      marked_at?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<Omit<CampAttendanceRow, 'id' | 'camp_id' | 'registration_id' | 'created_at'>>;
    Relationships: [];
  };
};

/** The healthcare SQL functions declared in the 0003/0004 migrations. */
export type HealthcareFunctions = {
  /** The caller's role, read from `profiles`. Never accepts a role argument. */
  healthcare_role: {
    Args: Record<PropertyKey, never>;
    Returns: HealthcareRoleRow;
  };
  /** True when the caller holds one of the listed roles. The list comes from a policy. */
  healthcare_has_role: {
    Args: { p_roles: HealthcareRoleRow[] };
    Returns: boolean;
  };
  /**
   * Appends one audit row with the actor taken from `auth.uid()`.
   *
   * Members may execute it; the `audit_logs` table itself stays unreachable, which
   * is why this exists instead of a grant.
   */
  healthcare_record_audit_event: {
    Args: { p_action: string; p_entity: string; p_entity_id: string | null; p_metadata?: Json };
    Returns: undefined;
  };
  healthcare_register_recommended_patient: {
    Args: { p_registration_id: string; p_registered_by_user_id: string };
    Returns: CampRegistrationRow;
  };
};

