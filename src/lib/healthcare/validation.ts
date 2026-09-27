import { z } from 'zod';
import {
  CAMP_ATTENDANCE_STATUSES,
  CASE_PRIORITIES,
  FOLLOW_UP_STATUSES,
  HEALTH_CAMP_STATUSES,
  OBSERVATION_SEVERITIES,
  type CasePriority,
  type CampAttendanceStatus,
  type FollowUpStatus,
  type HealthCampStatus,
  type MemberSex,
  type ObservationSeverity,
} from '@/types/healthcare';

/**
 * Every value a healthcare request can carry, validated before it reaches Postgres.
 *
 * WHY THIS IS STRICTER THAN THE SECRETCHAT SCHEMAS
 * SecretChat accepts prose from a member about themselves. Healthcare accepts
 * *administrative records about other people*: a household name, a member's age, a
 * medicine name, a dose. Two consequences follow from that and shape this file:
 *
 *   1. Nothing a client sends identifies the actor. Every schema here is `.strict()`
 *      and none of them has a `role`, `userId`, `ashaId` or `doctorId` field, so a
 *      caller cannot write a row *as* somebody else even if it found a way to
 *      bypass the service layer. The actor comes from the session.
 *   2. The free-text fields are bounded and stripped of control characters, the
 *      same treatment a post gets. A medicine name is still text, and text is the
 *      one input that can be a megabyte.
 *
 * WHY THE ENUMS ARE TYPED AGAINST THE DOMAIN
 * `z.enum(ARRAY as [T, ...T[]])` rather than a bare list of literals, so a status
 * added to `@/types/healthcare` without being listed here fails to compile instead
 * of producing a runtime insert that Postgres rejects.
 */

/**
 * The limits below are the schema's check constraints, restated.
 *
 * They are copied rather than derived because `0003_healthcare_schema.sql` cannot
 * be imported into a browser bundle, and a limit that exists only in SQL is a limit
 * a request discovers by being rejected by Postgres. Every number here matches the
 * corresponding `check` in the migration, and the comment names which one — if a
 * check is loosened there, the number next to it has to move with it.
 */

/** Household names, member names, and `asha_profiles.area`/`doctor_profiles.speciality`. */
const MAX_NAME_CHARS = 120;
/** `households.address_line` and `health_camps.location`. */
const MAX_ADDRESS_CHARS = 200;
/**
 * A clinical note's assessment and advice, and `clinical_notes.observations`.
 * The longest legitimate prose in this feature, and still far shorter than a
 * medical record.
 */
const MAX_CLINICAL_TEXT_CHARS = 2000;
/**
 * `health_cases.summary`.
 *
 * Half the length of a free note on purpose. This is the line an ASHA types into a
 * phone in a village, describing why she opened the case, and the assessment that
 * actually matters is written later by a doctor. A summary that runs to a thousand
 * characters is a summary that has stopped being a summary, so the number here is
 * the smaller of the two and `MAX_NOTES_CHARS` is deliberately not reused.
 */
const MAX_CASE_SUMMARY_CHARS = 500;
/** `case_observations.notes` and `follow_ups.notes`. */
const MAX_NOTES_CHARS = 1000;
/** `referrals.reason`, `case_observations.referral_reason`, `prescriptions.instructions`. */
const MAX_REFERRAL_REASON_CHARS = 500;
/** `household_members.note`. Administrative, and short by design. */
const MAX_MEMBER_NOTE_CHARS = 500;
/** `health_camps.description`. */
const MAX_CAMP_DESCRIPTION_CHARS = 1000;
/** `prescriptions.dosage`, `.frequency` and `.duration`. */
const MAX_SHORT_TEXT_CHARS = 120;
/** `household_members.relation_to_head`, which is a word from a fixed small set. */
const MAX_RELATION_CHARS = 60;
/** `health_camps.title`, which names a place and so runs longer than a person's name. */
const MAX_CAMP_TITLE_CHARS = 160;
/** One symptom as a health worker would say it out loud: a few words. */
const MAX_SYMPTOM_CHARS = 80;
/** `case_observations.reported_symptoms` holds between 1 and 30 entries. */
const MAX_SYMPTOMS_PER_OBSERVATION = 30;
/** `prescriptions.medicine_name`. */
const MAX_MEDICINE_CHARS = 160;

const uuidSchema = z.string().uuid('must be a valid uuid');
const nullableUuid = uuidSchema.nullable();
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date in YYYY-MM-DD form')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'must be a real date');
const isoTimestamp = z.string().datetime({ offset: true });
/** `HH:MM` in 24-hour form, which is what the camp schema stores. */
const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a time in HH:MM form');

function stripControlCharacters(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

/**
 * Trimmed, control-character-free, non-empty and length-bounded text.
 *
 * A body of only spaces is rejected rather than stored as invisible content, and a
 * value with no letters or digits in it is rejected as well — that catches a field
 * filled with a run of punctuation, which is never a real observation.
 */
const text = (max: number, label: string) =>
  z
    .string()
    .transform((value) => stripControlCharacters(value).trim())
    .refine((value) => value.length > 0, `${label} must not be empty`)
    .refine((value) => value.length <= max, `${label} must be at most ${max} characters`)
    .refine((value) => /[\p{L}\p{N}]/u.test(value), `${label} must contain readable text`);

/** Optional free text: `null` when absent, but never an empty string. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .transform((value) => stripControlCharacters(value).trim())
    .refine((value) => value.length === 0 || /[\p{L}\p{N}]/u.test(value), `${label} must contain readable text`)
    .refine((value) => value.length <= max, `${label} must be at most ${max} characters`)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null);

/**
 * An age on a household register. `household_members.age_years` accepts 0 to 130;
 * the upper bound is generous because the person registering may not know, and a
 * refusal over a 131-year-old elder would be worse than a number nobody reads.
 */
const ageYears = z
  .number()
  .int('age must be a whole number of years')
  .min(0, 'age cannot be negative')
  .max(130, 'age must be at most 130');

const memberSex = z.enum(['FEMALE', 'MALE', 'OTHER'] as [MemberSex, ...MemberSex[]]);
const casePriority = z.enum(CASE_PRIORITIES as [CasePriority, ...CasePriority[]]);
const observationSeverity = z.enum(
  OBSERVATION_SEVERITIES as [ObservationSeverity, ...ObservationSeverity[]]
);
const followUpStatus = z.enum(FOLLOW_UP_STATUSES as [FollowUpStatus, ...FollowUpStatus[]]);
const healthCampStatus = z.enum(
  HEALTH_CAMP_STATUSES as [HealthCampStatus, ...HealthCampStatus[]]
);
const campAttendanceStatus = z.enum(
  CAMP_ATTENDANCE_STATUSES as [CampAttendanceStatus, ...CampAttendanceStatus[]]
);

/* ------------------------------------------------------------------ *
 * Households and members                                              *
 * ------------------------------------------------------------------ */

/**
 * Registering a household.
 *
 * There is no `assignedAshaId` and no `code`: the code is minted by the server, and
 * the ASHA is the session. `.strict()` means a client that tries to send them anyway
 * is refused rather than quietly having the field dropped, which is what makes it
 * safe to add a field here without checking every caller.
 */
export const createHouseholdSchema = z
  .object({
    name: text(MAX_NAME_CHARS, 'name'),
    addressLine: optionalText(MAX_ADDRESS_CHARS, 'address'),
  })
  .strict();

/**
 * Editing a household.
 *
 * The ASHA cannot be reassigned through this, and cannot be reassigned at all by a
 * client: reassignment is an administrative action, so it is not part of the
 * request contract.
 */
export const updateHouseholdSchema = z
  .object({
    name: text(MAX_NAME_CHARS, 'name'),
    addressLine: optionalText(MAX_ADDRESS_CHARS, 'address'),
  })
  .strict();

export const createMemberSchema = z
  .object({
    fullName: text(MAX_NAME_CHARS, 'name'),
    ageYears: ageYears.nullable().optional(),
    sex: memberSex.nullable().optional(),
    relationToHead: optionalText(MAX_RELATION_CHARS, 'relation'),
    note: optionalText(MAX_MEMBER_NOTE_CHARS, 'note'),
  })
  .strict();

export const updateMemberSchema = createMemberSchema;
/* ------------------------------------------------------------------ *
 * Cases and observations                                              *
 * ------------------------------------------------------------------ */

/**
 * WHY NO `caseId` APPEARS IN THE BODIES BELOW
 * Every schema from here to the camps describes a request about a *known* case, and
 * the case is named once: in the path. The bodies carry what to do, and the path
 * carries what to do it to.
 *
 * An earlier draft had `caseId` in these bodies as well, which is worse than it
 * looks. A request could name one case in the path and a different one in the body,
 * the service read the path, and the body's copy was ignored — so a caller who got
 * that wrong got no error and no effect, and would have concluded the case had been
 * updated. `.strict()` turns a leftover `caseId` in a body into a 400 that names the
 * field, which is the only outcome that tells anybody anything.
 *
 * `createCaseSchema` below is the exception that proves the rule: there is no path
 * case yet, so its body names the household and the member, and nothing in the
 * service can read them from anywhere else.
 */

/**
 * Opening a case.
 *
 * The member and the household are named by id, and the ASHA, the source and the
 * initial status are all server-side. `summary` is an administrative description of
 * why the case was opened, and the schema cannot tell the difference between that
 * and a diagnosis — which is why the field is named `summary` and why the doctor
 * side is where an assessment is written.
 */
export const createCaseSchema = z
  .object({
    householdId: uuidSchema,
    memberId: uuidSchema,
    summary: text(MAX_CASE_SUMMARY_CHARS, 'summary'),
    priority: casePriority.default('ROUTINE'),
    source: z.enum(['ASHA', 'CAMP']).default('ASHA'),
    campId: nullableUuid.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    // A camp case has to name its camp, and a household case must not: the
    // alternative is a case that claims a camp origin it cannot be counted against.
    if (data.source === 'CAMP' && !data.campId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'campId is required for a camp case',
        path: ['campId'],
      });
    }
    if (data.source === 'ASHA' && data.campId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'campId is only accepted for a camp case',
        path: ['campId'],
      });
    }
  });

/**
 * Correcting an open case.
 *
 * Two fields, both administrative, and both things a worker needs to be able to fix
 * without opening a second case about the same person: a summary that was typed
 * wrongly, and a priority that was set before somebody understood how unwell this
 * was. Everything else is server-side — in particular there is no `status` here,
 * because status is a transition and transitions belong to `state.ts`, where the legal
 * moves live and are tested. A free-form status field here would be a second,
 * untested set of rules.
 *
 * `summary` is required rather than optional because a case edit is a deliberate act:
 * somebody has opened the case to change it, and an edit that silently changed only
 * the priority while leaving a wrong summary in place would be a surprise.
 */
export const updateCaseSchema = z
  .object({
    summary: text(MAX_CASE_SUMMARY_CHARS, 'summary'),
    priority: casePriority.default('ROUTINE'),
  })
  .strict();

/**
 * Recording what a health worker saw or was told.
 *
 * `reportedSymptoms` is a bounded list of the words used, deduplicated, and the
 * count is capped so an observation cannot be turned into a document. Nothing in
 * this schema concludes anything: `severity` is how bad it looked, `referralReason`
 * is what the worker wants a clinician to look at.
 */
export const createObservationSchema = z
  .object({
    reportedSymptoms: z
      .array(text(MAX_SYMPTOM_CHARS, 'symptom'))
      .min(1, 'at least one reported symptom is required')
      .max(MAX_SYMPTOMS_PER_OBSERVATION, 'too many reported symptoms'),
    severity: observationSeverity,
    observedOn: isoDate,
    durationDays: z
      .number()
      .int('duration must be a whole number of days')
      .min(0, 'duration cannot be negative')
      .max(3650, 'duration must be at most 3650 days')
      .nullable()
      .optional(),
    notes: optionalText(MAX_NOTES_CHARS, 'notes'),
    referralReason: optionalText(MAX_REFERRAL_REASON_CHARS, 'referral reason'),
  })
  .strict()
  .transform((data) => ({
    ...data,
    // Deduplicated, order preserved: the same word twice tells a clinician nothing
    // and a list of duplicates looks like a mistake in the field.
    reportedSymptoms: [...new Set(data.reportedSymptoms)],
  }));

/* ------------------------------------------------------------------ *
 * Referrals                                                          *
 * ------------------------------------------------------------------ */

/**
 * Filing a referral.
 *
 * A referral names a doctor. This is the one place a healthcare write takes an id
 * for a *third party* from the client, and it is safe for a specific reason: the
 * client is an ASHA worker choosing from a list of doctors, so the id comes from a
 * roster the server handed them, and the insert policy pins `referred_by_asha_id`
 * to the session so the field cannot be used to file a referral *as* somebody else.
 * The alternative — having the server pick the doctor — would mean a referral queue
 * with one destination.
 */
export const createReferralSchema = z
  .object({
    doctorId: uuidSchema,    reason: text(MAX_REFERRAL_REASON_CHARS, 'reason'),
    priority: casePriority.default('ROUTINE'),
    // Present when the referral came out of a camp screening. Optional rather than
    // required, because most referrals are not camp referrals, and `referrals.camp_id`
    // is the link that lets somebody count how much of a camp's work turned into
    // clinical follow-up.
    campId: nullableUuid.optional(),
  })
  .strict();

/* ------------------------------------------------------------------ *
 * The doctor side                                                     *
 * ------------------------------------------------------------------ */

/**
 * Moving a referral the doctor already holds.
 *
 * `accept` and `cancel` are both deliberately absent, and for different reasons.
 * Accepting assigns the case, so a client able to pass it here could take a case
 * without the assignment that makes every later write on it legal. Cancelling is a
 * different act with a different owner — a worker may withdraw a referral they sent at
 * any time, including one a doctor has already looked at — so it is its own endpoint
 * rather than a value a doctor can pass about somebody else's referral.
 *
 * The action is in the body rather than the path because these are two states of one
 * object, and two URLs for one thing is two chances to disagree about what a missing
 * one means.
 */
export const progressReferralSchema = z
  .object({
    action: z.enum(['startReview', 'complete']),
  })
  .strict();

/**
 * Settling a follow-up.
 *
 * `markMissed` is here for the same reason it is in the state table: a follow-up that
 * was not kept is a fact about the programme, and recording only the ones that happened
 * would leave a worker unable to tell "nobody came" from "nobody was scheduled".
 */
export const settleFollowUpSchema = z
  .object({
    action: z.enum(['complete', 'markMissed', 'cancel']),
  })
  .strict();

export const createClinicalNoteSchema = z
  .object({
    assessment: text(MAX_CLINICAL_TEXT_CHARS, 'assessment'),
    observations: optionalText(MAX_CLINICAL_TEXT_CHARS, 'observations'),
    advice: text(MAX_CLINICAL_TEXT_CHARS, 'advice'),
    followUpOn: isoDate.nullable().optional(),
  })
  .strict();

/**
 * A prescription.
 *
 * Only a doctor reaches this schema's service function, and the insert policy
 * requires `doctor_id = auth.uid()` as well, so the two layers agree on who may
 * write one. The free-text fields are bounded for the same reason every other text
 * field here is: `medicine_name` is still a string a client controls.
 */
export const createPrescriptionSchema = z
  .object({
    clinicalNoteId: nullableUuid.optional(),
    medicineName: text(MAX_MEDICINE_CHARS, 'medicine name'),
    dosage: text(MAX_SHORT_TEXT_CHARS, 'dosage'),
    frequency: text(MAX_SHORT_TEXT_CHARS, 'frequency'),
    duration: text(MAX_SHORT_TEXT_CHARS, 'duration'),
    instructions: optionalText(MAX_REFERRAL_REASON_CHARS, 'instructions'),
  })
  .strict();

/**
 * Editing a prescription.
 *
 * The same fields, and still doctor-only. A prescription is amended rather than
 * deleted: the row carries `updated_at`, and an audit row is written for the edit,
 * so a review can see that the dose changed and who changed it.
 */
export const updatePrescriptionSchema = createPrescriptionSchema;

export const createFollowUpSchema = z
  .object({
    /**
     * The role the follow-up is assigned *to*, not the account. A case that needs
     * a community check-up is assigned to the ASHA role; a case that needs the
     * clinician to see the person again is assigned to the doctor who is already on
     * it. The account is resolved by the server, so assigning to a role is the
     * whole contract and there is no account id in the request to get wrong.
     */
    assignedRole: z.enum(['ASHA', 'DOCTOR', 'ADMIN']),
    dueDate: isoDate,
    notes: optionalText(MAX_NOTES_CHARS, 'notes'),
  })
  .strict();

export const updateFollowUpSchema = z
  .object({
    status: followUpStatus,
    notes: optionalText(MAX_NOTES_CHARS, 'notes'),
  })
  .strict();

/* ------------------------------------------------------------------ *
 * Health camps                                                       *
 * ------------------------------------------------------------------ */

export const createCampSchema = z
  .object({
    title: text(MAX_CAMP_TITLE_CHARS, 'title'),
    description: optionalText(MAX_CAMP_DESCRIPTION_CHARS, 'description'),
    campDate: isoDate,
    startTime: clockTime,
    endTime: clockTime,
    location: text(MAX_ADDRESS_CHARS, 'location'),
    /**
     * A camp has a capacity because a camp has a room. It is bounded on both sides:
     * zero would make every registration fail, and an unbounded capacity would let
     * one row claim to seat a million people and make the "is it full" answer on
     * the listing meaningless.
     */
    capacity: z
      .number()
      .int('capacity must be a whole number')
      .min(1, 'capacity must be at least 1')
      .max(10000, 'capacity must be at most 10000'),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.endTime <= data.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endTime must be after startTime',
        path: ['endTime'],
      });
    }
  });

export const updateCampSchema = z
  .object({
    title: text(MAX_CAMP_TITLE_CHARS, 'title'),
    description: optionalText(MAX_CAMP_DESCRIPTION_CHARS, 'description'),
    campDate: isoDate,
    startTime: clockTime,
    endTime: clockTime,
    location: text(MAX_ADDRESS_CHARS, 'location'),
    capacity: z.number().int().min(1).max(10000),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.endTime <= data.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endTime must be after startTime',
        path: ['endTime'],
      });
    }
  });

export const setCampStatusSchema = z
  .object({
    status: healthCampStatus,
  })
  .strict();

/**
 * Marking attendance.
 *
 * Addressed by the registration, which arrives in the path like every other id in
 * this feature, and for the same reason SecretChat's block endpoint is addressed by
 * post: the person running a camp is shown a roster of registration ids and has no
 * account ids at all. A `userId` here would be an id the client was never given.
 *
 * There is deliberately no `registrationId` in the body — see the note on `caseId`
 * above. The body says what happened; the path says to whom.
 */
export const markAttendanceSchema = z
  .object({
    status: campAttendanceStatus,
  })
  .strict();

/**
 * Path parameters.
 *
 * Named separately from the body schemas for one reason: these are the ids a route
 * received, and they are validated *inside* the request boundary so that a malformed
 * id is a JSON 400 like every other client error rather than a framework error page.
 *
 * They are all the same schema. That is not laziness, it is the point — a route cannot
 * invent its own idea of what an id looks like, and there is no per-entity format to
 * accommodate because every id here is a `uuid` from the database.
 */
export const householdIdSchema = uuidSchema;
export const memberIdSchema = uuidSchema;
export const caseIdSchema = uuidSchema;
export const referralIdSchema = uuidSchema;
export const followUpIdSchema = uuidSchema;
export const campIdSchema = uuidSchema;
export const registrationIdSchema = uuidSchema;

/* ------------------------------------------------------------------ *
 * Read queries                                                        *
 * ------------------------------------------------------------------ */

/**
 * Listing parameters.
 *
 * Bounded like the feed page: a client cannot ask for a whole table, and the
 * default is small enough that a dashboard is one query rather than a scan.
 */
export const DEFAULT_LIST_LIMIT = 25;
export const MAX_LIST_LIMIT = 100;

export const listQuerySchema = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_LIST_LIMIT)
      .default(DEFAULT_LIST_LIMIT),
  })
  .strict();

/** `priority` is the only case filter the UI offers, so it is the only one parsed. */
export const caseListQuerySchema = listQuerySchema.extend({
  status: z
    .enum(['OPEN', 'REFERRED', 'UNDER_REVIEW', 'FOLLOW_UP', 'CLOSED', 'ALL'])
    .default('ALL'),
  priority: z.enum(['ROUTINE', 'URGENT', 'ALL']).default('ALL'),
});

export const referralListQuerySchema = listQuerySchema.extend({
  status: z
    .enum(['PENDING', 'ACCEPTED', 'IN_REVIEW', 'COMPLETED', 'CANCELLED', 'ALL'])
    .default('ALL'),
});

export const followUpListQuerySchema = listQuerySchema.extend({
  status: z.enum(['PENDING', 'COMPLETED', 'MISSED', 'CANCELLED', 'ALL']).default('ALL'),
});

export const campListQuerySchema = listQuerySchema.extend({
  status: z.enum(['DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED', 'ALL']).default('PUBLISHED'),
});

/* ------------------------------------------------------------------ *
 * Inferred bodies                                                    *
 * ------------------------------------------------------------------ */

export type CreateHouseholdBody = z.infer<typeof createHouseholdSchema>;
export type UpdateHouseholdBody = z.infer<typeof updateHouseholdSchema>;
export type CreateMemberBody = z.infer<typeof createMemberSchema>;
export type UpdateMemberBody = z.infer<typeof updateMemberSchema>;
export type CreateCaseBody = z.infer<typeof createCaseSchema>;
export type CreateObservationBody = z.infer<typeof createObservationSchema>;
export type CreateReferralBody = z.infer<typeof createReferralSchema>;
export type CreateClinicalNoteBody = z.infer<typeof createClinicalNoteSchema>;
export type CreatePrescriptionBody = z.infer<typeof createPrescriptionSchema>;
export type UpdatePrescriptionBody = z.infer<typeof updatePrescriptionSchema>;
export type CreateFollowUpBody = z.infer<typeof createFollowUpSchema>;
export type UpdateFollowUpBody = z.infer<typeof updateFollowUpSchema>;
export type CreateCampBody = z.infer<typeof createCampSchema>;
export type UpdateCampBody = z.infer<typeof updateCampSchema>;
export type SetCampStatusBody = z.infer<typeof setCampStatusSchema>;
export type MarkAttendanceBody = z.infer<typeof markAttendanceSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type CaseListQuery = z.infer<typeof caseListQuerySchema>;
export type ReferralListQuery = z.infer<typeof referralListQuerySchema>;
export type FollowUpListQuery = z.infer<typeof followUpListQuerySchema>;
export type CampListQuery = z.infer<typeof campListQuerySchema>;

/**
 * Field paths only: an issue message can echo the submitted value, a path may not.
 *
 * Deduplicated for the same reason as SecretChat's version — one field can fail two
 * refinements, and a form should not be told the same field is wrong twice.
 */
export function fieldPaths(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.path.join('.')))].filter(
    (path) => path.length > 0
  );
}

/**
 * The request limits, keyed by the SQL column they are copied from.
 *
 * The flat list of numbers this replaces could only be checked by eye. Keyed by
 * column, it is a table: `healthcare-schema-parity.test.ts` walks every
 * `char_length` check in `0003_healthcare_schema.sql` and fails if a bound here is
 * looser than the one there, so a migration that widens a column cannot leave the
 * request contract quietly behind. A value may be *stricter* than the column, never
 * looser — a request that reaches Postgres and is rejected there is a bug with a
 * much worse error message than the same request refused up front.
 *
 * The array and numeric bounds are here too, for the same reason: the symptom count
 * and the camp capacity are `check` constraints, not lengths, and a mismatch shows
 * up as a 502 from a health worker standing in a village.
 */
export const HEALTHCARE_LIMITS = {
  asha_profiles: { full_name: 120, area: 120, registration_number: 60 },
  doctor_profiles: { full_name: 120, speciality: 120, registration_number: 60 },
  households: { name: 120, address_line: 200 },
  household_members: { full_name: 120, relation_to_head: 60, note: 500 },
  health_cases: { summary: 500 },
  case_observations: { notes: 1000, referral_reason: 500 },
  referrals: { reason: 500 },
  clinical_notes: { assessment: 2000, observations: 2000, advice: 2000 },
  prescriptions: { medicine_name: 160, dosage: 120, frequency: 120, duration: 120, instructions: 500 },
  follow_ups: { notes: 1000 },
  health_camps: { title: 160, description: 1000, location: 200 },
  counts: {
    case_observations_reported_symptoms: 30,
    health_camps_capacity: 10000,
    household_members_age_years: 130,
    case_observations_duration_days: 3650,
  },
} as const;

/** Exported for the store, which needs to build a `YYYY-MM-DD` for a timestamp. */
export function toDateOnly(timestamp: string): string {
  return timestamp.slice(0, 10);
}

/** Exported for the service, which validates an id arriving from a path segment. */
export { isoDate, isoTimestamp, nullableUuid, uuidSchema };

