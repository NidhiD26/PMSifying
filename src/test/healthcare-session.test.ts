import { describe, it, expect } from 'vitest';
import { isApiError } from '@/lib/api/errors';
import { createInMemoryHealthcareFixture } from '@/lib/healthcare/store';
import { requireAsha, requireDoctor, requireStaff, resolveHealthcareActor } from '@/lib/healthcare/session';
import type { HealthcareActor } from '@/lib/healthcare/session';

/**
 * The role rules, tested as attempts rather than as usage.
 *
 * Everything this feature's authorisation rests on is the claim that a caller's role
 * comes from the server and nowhere else. These tests hold that claim to the two
 * cases that would actually hurt: a member reaching for a staff surface, and an
 * account that claims a role it has no record for.
 */

const MEMBER = '11111111-1111-4111-8111-111111111111';
const ASHA = '22222222-2222-4222-8222-222222222222';
const OTHER_ASHA = '33333333-3333-4333-8333-333333333333';
const DOCTOR = '44444444-4444-4444-8444-444444444444';
const ADMIN = '55555555-5555-4555-8555-555555555555';
/** An account with a role on `profiles` and no staff record to match it. */
const HALF_PROVISIONED = '66666666-6666-4666-8666-666666666666';

/** A fixture with one of each account, seeded. */
function fixture() {
  const setup = createInMemoryHealthcareFixture();
  setup.seedProfile(MEMBER);
  void setup.store.createAshaProfile({
    userId: ASHA,
    fullName: 'Asha Worker',
    registrationNumber: 'ASHA-1',
    area: 'Block 1',
  });
  void setup.store.createAshaProfile({
    userId: OTHER_ASHA,
    fullName: 'Other Worker',
    registrationNumber: 'ASHA-2',
    area: 'Block 2',
  });
  void setup.store.createDoctorProfile({
    userId: DOCTOR,
    fullName: 'Doctor',
    registrationNumber: 'MBBS-1',
    speciality: 'General',
  });
  setup.seedProfile(ADMIN, 'ADMIN');
  // The half-provisioned case has to be written directly, because every public path
  // to a staff record also sets the role.
  setup.seedProfile(HALF_PROVISIONED, 'ASHA');
  return setup;
}

const actorFor = async (userId: string): Promise<HealthcareActor> => {
  const { store } = fixture();
  return resolveHealthcareActor(userId, store);
};

describe('role resolution', () => {
  it('reads the role from the profile, not from anything the caller sent', async () => {
    const actor = await actorFor(ASHA);
    expect(actor.role).toBe('ASHA');
    expect(actor.ashaId).toBe(ASHA);
    expect(actor.doctorId).toBeNull();
    expect(actor.ashaProfile?.registration_number).toBe('ASHA-1');
  });

  it('gives a doctor a doctor id and no asha id', async () => {
    const actor = await actorFor(DOCTOR);
    expect(actor.doctorId).toBe(DOCTOR);
    expect(actor.ashaId).toBeNull();
    expect(actor.doctorProfile?.speciality).toBe('General');
  });

  it('refuses an account with no profile row', async () => {
    const { store } = fixture();
    await expect(
      resolveHealthcareActor('77777777-7777-4777-8777-777777777777', store)
    ).rejects.toSatisfy((error: unknown) => isApiError(error) && error.code === 'forbidden');
  });

  it('refuses a role with no staff record behind it', async () => {
    // An account promoted to ASHA whose `asha_profiles` row was never created has no
    // registration number and covers no area, so there is nothing for it to act on.
    await expect(actorFor(HALF_PROVISIONED)).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.code === 'forbidden'
    );
  });
});

describe('staff-only surfaces', () => {
  it('refuses a member', async () => {
    const actor = await actorFor(MEMBER);
    expect(() => requireAsha(actor)).toThrowError();
    expect(() => requireDoctor(actor)).toThrowError();
    expect(() => requireStaff(actor)).toThrowError();
  });

  it('refuses a doctor on an ASHA surface and an ASHA on a doctor surface', async () => {
    const asha = await actorFor(ASHA);
    const doctor = await actorFor(DOCTOR);
    expect(() => requireDoctor(asha)).toThrowError();
    expect(() => requireAsha(doctor)).toThrowError();
  });

  it('admits a doctor to write a prescription, and only a doctor', async () => {
    // The prescription rule is the one with clinical consequence, so it is asserted
    // here at the narrowest layer that can enforce it at all. An ASHA worker and an
    // administrator are both refused, which is the part that has to hold: the
    // administrator can see everything and still cannot issue medicine.
    const doctor = await actorFor(DOCTOR);
    const otherAsha = await actorFor(OTHER_ASHA);
    const admin = await actorFor(ADMIN);

    expect(requireDoctor(doctor).user_id).toBe(DOCTOR);
    expect(() => requireDoctor(otherAsha)).toThrowError();
    expect(() => requireDoctor(admin)).toThrowError();
    expect(() => requireStaff(admin).role).not.toThrow();
  });

  it('lets an administrator reach staff surfaces without a staff record', async () => {
    // An administrator is staff by role and has no `asha_profiles` row; requiring one
    // would lock administration out of the very screens it exists to oversee.
    const admin = await actorFor(ADMIN);
    expect(requireStaff(admin).role).toBe('ADMIN');
    expect(() => requireAsha(admin)).toThrowError();
    expect(() => requireDoctor(admin)).toThrowError();
  });
});
