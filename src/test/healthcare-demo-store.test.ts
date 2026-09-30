import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The demo store has to be one store per process, not one per module.
 *
 * Next.js gives a server component and a route handler independent module
 * registries. Before this was pinned to `globalThis`, each registry seeded its own
 * in-memory fixture, and the two then disagreed in a way that looked like missing
 * data rather than like a missing singleton: the case page rendered a case the API
 * had never heard of, every clinical write against it answered `not_found`, and a
 * referral the doctor had accepted was still `PENDING` when the API was asked.
 *
 * `vi.resetModules()` discards the module cache the way a second Next.js layer does,
 * so re-importing here reproduces the split without a running dev server. The
 * assertion is the one the bug failed: the store is the same object both times, and
 * a write through the first reference is visible through the second.
 */

describe('demo healthcare store', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('resolves to one store across independent module registries', async () => {
    const first = await import('@/lib/demo/healthcare-demo');
    const storeA = await first.getDemoHealthcareStore();

    vi.resetModules();
    const second = await import('@/lib/demo/healthcare-demo');
    const storeB = await second.getDemoHealthcareStore();

    expect(storeB).toBe(storeA);
  });

  it('shows a write made through one import to the next', async () => {
    const first = await import('@/lib/demo/healthcare-demo');
    const storeA = await first.getDemoHealthcareStore();
    const actor = first.getDemoActor('ASHA');

    const household = await storeA.createHousehold(actor.userId, {
      name: 'Singleton Household',
      addressLine: null,
    });

    vi.resetModules();
    const second = await import('@/lib/demo/healthcare-demo');
    const storeB = await second.getDemoHealthcareStore();

    const households = await storeB.listHouseholds(actor.userId);
    // Matched by id rather than by name: the name is something the store echoes
    // back, whereas the id proves this specific record survived the module reset.
    expect(households.map((row) => row.id)).toContain(household.id);
    expect(households.map((row) => row.name)).toContain('Singleton Household');
  });

  it('hydrates the seeded demo records exactly once', async () => {
    const first = await import('@/lib/demo/healthcare-demo');
    const storeA = await first.getDemoHealthcareStore();

    vi.resetModules();
    const second = await import('@/lib/demo/healthcare-demo');
    const storeB = await second.getDemoHealthcareStore();

    const actor = first.getDemoActor('ASHA');
    const before = (await storeA.listHouseholds(actor.userId)).length;

    expect((await storeB.listHouseholds(actor.userId)).length).toBe(before);
  });

  it('keeps the same actor identity across registries', async () => {
    const first = await import('@/lib/demo/healthcare-demo');
    vi.resetModules();
    const second = await import('@/lib/demo/healthcare-demo');

    expect(second.DEMO_DOCTOR_USER_ID).toBe(first.DEMO_DOCTOR_USER_ID);
    expect(second.getDemoActor('DOCTOR')).toEqual(first.getDemoActor('DOCTOR'));

    // Spelled out because the comparison above was once only true most of the
    // time: the helper used to stamp `created_at` with the current time, so two
    // reads compared unequal whenever they fell either side of a millisecond
    // boundary. The suite passed for weeks and then failed once in a full run.
    // A seeded identity is fixed data and has to be byte-identical every time.
    expect(second.getDemoActor('DOCTOR')).toEqual({
      userId: first.DEMO_DOCTOR_USER_ID,
      role: 'DOCTOR',
      ashaId: null,
      doctorId: first.DEMO_DOCTOR_USER_ID,
      ashaProfile: null,
      doctorProfile: expect.objectContaining({
        user_id: first.DEMO_DOCTOR_USER_ID,
        full_name: 'Dr. Ananya Rao, MD',
        registration_number: 'KMC-2018-49201',
      }),
    });

    // Directly on the clock, so the assertion does not depend on the two reads
    // above happening to share a millisecond.
    expect(first.getDemoActor('DOCTOR')).toEqual(second.getDemoActor('DOCTOR'));
    expect(second.getDemoActor('ASHA')).toEqual(first.getDemoActor('ASHA'));
  });
});
