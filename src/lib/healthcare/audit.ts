import type { Json } from '@/types/supabase-database';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditAction, type AuditEntity } from '@/types/healthcare';
import { invalidRequest } from '@/lib/healthcare/errors';

/**
 * What may be written into an audit row, and what may not.
 *
 * THE PROBLEM AN AUDIT TRAIL CREATES
 * Healthcare is the first part of PMSify where a record can be read by several
 * people, and "somebody looked at this" is only useful if it is written down. The
 * same habit — append a note describing what happened — is exactly how a clinical
 * note ends up duplicated into a table that a wider set of roles can read. An audit
 * row says *that* an observation was recorded and *by whom*; it never repeats what
 * was observed, and it never carries a medicine name, a symptom, a household
 * address or an account id for a third party.
 *
 * SO THE METADATA IS AN ALLOW-LIST, NOT A SANITISER
 * A sanitiser has to guess which of a caller's keys are safe, and the next field
 * somebody adds is the one nobody thought about. An allow-list cannot leak by
 * omission: a key that is not named here is dropped, so the cost of adding a
 * clinical detail by accident is that the audit row quietly says less, and the
 * cost of wanting a new fact is an explicit edit to this list.
 *
 * WHY AN UNSAFE KEY IS AN ERROR RATHER THAN A SILENT DROP
 * Dropping it would make the audit trail quietly wrong, which is worse than a
 * failed request: an investigator reading the trail would not know something was
 * withheld. So `assertAuditableMetadata` refuses, and the caller has to either use
 * one of the allowed facts or record none.
 */

/**
 * The only facts an audit row may carry.
 *
 * Every value is a status, a count or a reference the reader could already obtain
 * from the record itself. There is no free text here, and adding a `text` entry is
 * the change to think twice about.
 */
const ALLOWED_METADATA_KEYS = [
  'fromStatus',
  'toStatus',
  /**
   * A priority change, both ends of it. `priority` alone would record what a case
   * became, which is the less interesting half: the question asked of a trail is
   * whether a case was quietly downgraded from urgent, and that needs the before.
   */
  'fromPriority',
  'toPriority',
  'status',
  'priority',
  'severity',
  'source',
  'role',
  'assignedRole',
  'memberCount',
  'openCaseCount',
  'observationCount',
  'noteCount',
  'prescriptionCount',
  'followUpCount',
  'referralCount',
  'registeredCount',
  'attendedCount',
  'capacity',
  'isFull',
  'campId',
  'caseId',
  'referralId',
  'followUpId',
  'followUpOn',
  'dueDate',
  'dueWithinDays',
] as const;

type AllowedMetadataKey = (typeof ALLOWED_METADATA_KEYS)[number];

const ALLOWED_KEY_SET: ReadonlySet<string> = new Set<string>(ALLOWED_METADATA_KEYS);

/** The longest metadata value written, so a long status list cannot bloat a row. */
const MAX_METADATA_KEYS = 12;
const MAX_STRING_LENGTH = 80;

export interface AuditMetadataInput {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Rejects any fact that is not on the list, then returns only what is.
 *
 * `undefined` is dropped rather than rejected, because building a metadata object
 * with an optional field (`priority: args.priority`) is natural and should not need
 * a guard at every call site. A `null` is kept: "there is no assigned doctor" is a
 * real fact about a referral and is worth recording.
 */
export function assertAuditableMetadata(metadata: AuditMetadataInput): Json {
  const keys = Object.keys(metadata);
  if (keys.length > MAX_METADATA_KEYS) throw invalidRequest(['metadata']);

  const safe: Record<string, Json> = {};
  for (const key of keys) {
    if (!ALLOWED_KEY_SET.has(key)) throw invalidRequest([`metadata.${key}`]);

    const value = metadata[key];
    if (value === undefined) continue;

    if (typeof value === 'string') {
      if (value.length > MAX_STRING_LENGTH) throw invalidRequest([`metadata.${key}`]);
      safe[key] = value;
      continue;
    }
    if (typeof value === 'number') {
      // NaN and Infinity are not JSON; a row carrying them would be unparseable
      // and the failure would surface much later, in whatever reads the trail.
      if (!Number.isFinite(value)) throw invalidRequest([`metadata.${key}`]);
      safe[key] = value;
      continue;
    }
    if (typeof value === 'boolean') {
      safe[key] = value;
      continue;
    }
    safe[key] = null;
  }

  return safe;
}

/**
 * Checks an action and an entity against the closed vocabulary.
 *
 * Both are free text in the database — `audit_logs.action` is a `text` column, not
 * an enum — because SecretChat needed moderation actions and healthcare needed its
 * own, and a single enum would have coupled the two features. That makes the
 * checking the server's job, and it happens before the row is written rather than
 * on the way out of it.
 */
export function assertAuditVocabulary(action: string, entity: string): {
  action: AuditAction;
  entity: AuditEntity;
} {
  if (!(AUDIT_ACTIONS as readonly string[]).includes(action)) throw invalidRequest(['action']);
  if (!(AUDIT_ENTITIES as readonly string[]).includes(entity)) throw invalidRequest(['entity']);
  return { action: action as AuditAction, entity: entity as AuditEntity };
}

export const AUDITABLE_METADATA_KEYS = ALLOWED_METADATA_KEYS;
export type { AllowedMetadataKey };
