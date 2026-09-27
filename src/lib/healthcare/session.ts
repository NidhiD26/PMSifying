import type { AshaProfileRow, DoctorProfileRow, HealthcareProfileRow } from '@/types/healthcare-db';
import type { HealthcareRole } from '@/types/healthcare';
import { forbidden } from '@/lib/healthcare/errors';
import type { HealthcareStore } from '@/lib/healthcare/store';

/**
 * Who is calling, as far as the server can establish it.
 *
 * The whole authorisation model is four lines long: a caller's role is whatever the
 * `profiles` row says, and nothing else. It is not a header, not a body field, not a
 * path segment, and not something a JWT is trusted to carry without being re-read —
 * so there is no code path anywhere in this feature by which a client can influence
 * it. Everything downstream takes an `actor` that this module produced.
 *
 * WHY THE STAFF PROFILE IS RESOLVED HERE, AND NOT AT EACH CALL SITE
 * A role on its own is not enough. `profiles.role = 'ASHA'` says the account is a
 * health worker; `asha_profiles` is what says which worker, with a registration
 * number and the area they cover. Resolving both in one place means the two can
 * never be read separately and allowed to disagree — the failure where a request is
 * authorised as an ASHA and then the ASHA id is taken from somewhere else.
 *
 * The `ashaId` and `doctorId` on `actor` are both the `userId`. They are separate
 * fields so that a caller reading them cannot be misled about which namespace it is
 * in, and the `Register` table keys on `user_id` for exactly that reason: the same
 * account is one row in `asha_profiles` or `doctor_profiles`, never both, and a
 * mismatch is a provisioning bug rather than something to resolve at runtime.
 */
export interface HealthcareActor {
  userId: string;
  role: HealthcareRole;
  /** Present exactly when `role === 'ASHA'`. */
  ashaId: string | null;
  /** Present exactly when `role === 'DOCTOR'`. */
  doctorId: string | null;
  ashaProfile: AshaProfileRow | null;
  doctorProfile: DoctorProfileRow | null;
}

/** The roles that may reach a staff-only surface at all. */
const STAFF_ROLES: readonly HealthcareRole[] = ['ASHA', 'DOCTOR', 'ADMIN'];

/** Narrows an actor to an ASHA worker, or refuses. */
export function requireAsha(actor: HealthcareActor): AshaProfileRow {
  if (actor.role !== 'ASHA' || !actor.ashaProfile) throw forbidden();
  return actor.ashaProfile;
}

/** Narrows an actor to a doctor, or refuses. */
export function requireDoctor(actor: HealthcareActor): DoctorProfileRow {
  if (actor.role !== 'DOCTOR' || !actor.doctorProfile) throw forbidden();
  return actor.doctorProfile;
}

/**
 * Narrows an actor to "a health worker or an administrator".
 *
 * Used for the surfaces an ASHA and a doctor both legitimately need — the doctor
 * roster a referral is addressed to, the camp list — where the question is whether
 * the caller is staff at all rather than which kind.
 */
export function requireStaff(actor: HealthcareActor): HealthcareActor {
  if (!STAFF_ROLES.includes(actor.role)) throw forbidden();
  return actor;
}

/**
 * Builds the actor from an already-authenticated user id and store.
 *
 * Split from `getHealthcareActor` so a test can exercise the role rules against the
 * in-memory store without a Supabase client, and so nothing in this file needs a
 * network to be reasoned about.
 */
export async function resolveHealthcareActor(
  userId: string,
  store: HealthcareStore
): Promise<HealthcareActor> {
  const profile: HealthcareProfileRow | null = await store.getProfile(userId);

  // No profile row at all. `profiles` is created alongside every account by the
  // SecretChat migration, so this is a deployment that has not been fully applied
  // rather than a person who has not signed up — the caller is signed in (the caller
  // was checked) and still has no role, which is the server's problem, not theirs.
  if (!profile) throw forbidden();

  const actor: HealthcareActor = {
    userId,
    role: profile.role,
    ashaId: null,
    doctorId: null,
    ashaProfile: null,
    doctorProfile: null,
  };

  if (profile.role === 'ASHA') {
    const ashaProfile = await store.getAshaProfile(userId);
    // A role with no staff row. The account is a health worker by role and nobody by
    // record: it has no registration number and covers no area, so there is nothing
    // for it to act on. Refused as `forbidden` rather than as a server error, because
    // from the caller's side the answer is the same either way and the message would
    // only tell them something an operator has to fix.
    if (!ashaProfile) throw forbidden();
    return { ...actor, ashaId: userId, ashaProfile };
  }

  if (profile.role === 'DOCTOR') {
    const doctorProfile = await store.getDoctorProfile(userId);
    if (!doctorProfile) throw forbidden();
    return { ...actor, doctorId: userId, doctorProfile };
  }

  return actor;
}

/**
 * The signed-in caller, resolved from an already-authenticated id and store.
 *
 * The two arguments are supplied by the route layer, which owns the Supabase client
 * and has already established that there *is* a session — that check lives in
 * `getRequestContext` alongside the configuration check, for the same reason it does
 * in SecretChat: a thing every request must satisfy is not a thing each route author
 * should remember. This function answers the separate question of what that session
 * is *allowed to be*.
 */
export async function getHealthcareActor(
  userId: string,
  store: HealthcareStore
): Promise<HealthcareActor> {
  return resolveHealthcareActor(userId, store);
}
