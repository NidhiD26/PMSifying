import { describe, it, expect, beforeEach } from 'vitest';
import { ApiError, isApiError } from '@/lib/api/errors';
import {
  createInMemoryHealthcareFixture,
  type InMemoryHealthcareFixture,
} from '@/lib/healthcare/store';
import { resolveHealthcareActor, type HealthcareActor } from '@/lib/healthcare/session';
import * as service from '@/lib/healthcare/service';
import type { CampRosterEntryDto, HealthCampDto, ReferralDto } from '@/types/healthcare';

/**
 * The three gaps that stopped Sprint 3 being end-to-end.
 *
 * Each of the three was a UI that could not finish a workflow, and each was closed by
 * making the server able to answer a question the browser had to ask. The shape of the
 * file follows the three workflows rather than the three DTOs, because a test named
 * "HealthCampDto has canManage" proves a field is spelled right and nothing about
 * whether a camp can actually be run.
 *
 * The through-line in all three: a new field on a DTO is a promise the *service* keeps,
 * and these tests are written to fail if the promise is kept only in the type.
 */

const MEMBER = '11111111-1111-4111-8111-111111111111';
const OTHER_MEMBER = 'a1111111-1111-4111-8111-111111111111';
const ASHA = '22222222-2222-4222-8222-222222222222';
const OTHER_ASHA = '33333333-3333-4333-8333-333333333333';
const DOCTOR = '44444444-4444-4444-8444-444444444444';
const OTHER_DOCTOR = '77777777-7777-4777-8777-777777777777';
const ADMIN = '55555555-5555-4555-8555-555555555555';

let setup: InMemoryHealthcareFixture;
let asha: HealthcareActor;
let otherAsha: HealthcareActor;
let doctor: HealthcareActor;
let otherDoctor: HealthcareActor;
let member: HealthcareActor;
let admin: HealthcareActor;
let householdId: string;
let memberId: string;
let caseId: string;

const store = () => setup.store;

const codeOf = async (work: () => Promise<unknown>): Promise<string> => {
  try {
    await work();
  } catch (error) {
    if (isApiError(error)) return (error as ApiError).code;
    throw error;
  }
  throw new Error('expected the call to fail, and it did not');
};

const keysOf = (value: object): string[] => Object.keys(value).sort();

/** The fields of an API error, or a failure if the call did not raise one. */
const fieldsOf = async (work: () => Promise<unknown>): Promise<string[]> => {
  try {
    await work();
  } catch (error) {
    if (isApiError(error)) return (error as ApiError).fields ?? [];
    throw error;
  }
  throw new Error('expected the call to fail, and it did not');
};

beforeEach(async () => {
  setup = createInMemoryHealthcareFixture();
  setup.seedProfile(MEMBER);
  setup.seedProfile(OTHER_MEMBER);
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
    fullName: 'Doctor One',
    registrationNumber: 'MBBS-1',
    speciality: 'General',
  });
  void setup.store.createDoctorProfile({
    userId: OTHER_DOCTOR,
    fullName: 'Doctor Two',
    registrationNumber: 'MBBS-2',
    speciality: 'Paediatrics',
  });
  setup.seedProfile(ADMIN, 'ADMIN');

  [asha, otherAsha, doctor, otherDoctor, member, admin] = await Promise.all([
    resolveHealthcareActor(ASHA, store()),
    resolveHealthcareActor(OTHER_ASHA, store()),
    resolveHealthcareActor(DOCTOR, store()),
    resolveHealthcareActor(OTHER_DOCTOR, store()),
    resolveHealthcareActor(MEMBER, store()),
    resolveHealthcareActor(ADMIN, store()),
  ]);

  const household = await service.createHousehold(store(), {
    actor: asha,
    input: { name: 'Sharma household', addressLine: '12 Field Road' },
  });
  householdId = household.id;
  const created = await service.createMember(store(), {
    actor: asha,
    householdId,
    input: { fullName: 'Kamla Sharma', ageYears: 34, sex: 'FEMALE', relationToHead: 'Head' },
  });
  memberId = created.id;
  const healthCase = await service.createCase(store(), {
    actor: asha,
    input: { householdId, memberId, summary: 'Persistent fever for five days', priority: 'ROUTINE' },
  });
  caseId = healthCase.id;
});

/* ------------------------------------------------------------------ *
 * Gap 1 — a worker can file a referral                              *
 * ------------------------------------------------------------------ */

describe('workflow 1: a worker refers a case to a doctor', () => {
  it('offers a doctor roster carrying the id a referral is filed against', async () => {
    const roster = await service.listDoctors(store(), { actor: asha });

    expect(roster).toHaveLength(2);
    // The whole gap: without this value the referral form has nothing legal to send.
    expect(roster.map((row) => row.id).sort()).toEqual([DOCTOR, OTHER_DOCTOR].sort());
  });

  it('gives the roster the id the service already keys referrals by, and nothing private', async () => {
    const [first] = await service.listDoctors(store(), { actor: asha });

    expect(keysOf(first)).toEqual(['fullName', 'id', 'registrationNumber', 'speciality']);
    // The professional fields a worker picks from, and nothing that identifies the
    // person behind the professional record: no email, no suspension, no timestamps.
    expect(first.fullName).toBe('Doctor One');
    expect(first.registrationNumber).toBe('MBBS-1');
    expect(JSON.stringify(first)).not.toContain('suspended');
    expect(JSON.stringify(first)).not.toContain('created_at');
  });

  it('completes the whole flow: refer, then the doctor has it', async () => {
    // 1. the worker reads the roster
    const roster = await service.listDoctors(store(), { actor: asha });
    const target = roster.find((row) => row.fullName === 'Doctor One');
    if (!target) throw new Error('the doctor roster has no Doctor One');

    // 2. picks a doctor and a reason, and files
    const referral = await service.createReferral(store(), {
      actor: asha,
      caseId,
      input: { doctorId: target.id, reason: 'Fever for five days, not settling' },
    });
    expect(referral.status).toBe('PENDING');
    // The DTO resolves the destination from the roster, so the worker's own queue reads
    // "Doctor One" rather than an id they would have to recognise.
    expect(referral.doctorName).toBe('Doctor One');

    // 3. it is in the worker's own queue
    const raised = await service.listReferrals(store(), { actor: asha, query: {} });
    expect(raised.map((row) => row.id)).toContain(referral.id);

    // 4. and in the doctor's queue, which is the point of the roster
    const offered = await service.listReferrals(store(), { actor: doctor, query: {} });
    expect(offered.map((row) => row.id)).toContain(referral.id);

    // 5. the doctor accepts, and the case becomes theirs
    await service.acceptReferral(store(), { actor: doctor, referralId: referral.id });
    const dashboard = await service.getDoctorDashboard(store(), { actor: doctor });
    expect(dashboard.pendingReferrals).toBe(0);
  });

  it('counts a case as under review once the doctor starts working on it', async () => {
    // The dashboard's queue is counted from the *case* status, not the referral
    // status, and the two are separate records. Starting a review used to move
    // only the referral, which left the case at REFERRED for the whole of the
    // review and the counter stuck at zero — so a doctor sitting on three cases
    // saw an empty "under review" queue while holding all three. Accepting is
    // deliberately not enough either: assigning a case is not the same as having
    // started on it, and the counter should say which one has happened.
    const referral = await service.createReferral(store(), {
      actor: asha,
      caseId,
      input: { doctorId: DOCTOR, reason: 'Fever for five days' },
    });
    await service.acceptReferral(store(), { actor: doctor, referralId: referral.id });

    const accepted = await service.getDoctorDashboard(store(), { actor: doctor });
    expect(accepted.casesUnderReview).toBe(0);

    await service.progressReferral(store(), { actor: doctor, referralId: referral.id, action: 'startReview' });

    const reviewing = await service.getDoctorDashboard(store(), { actor: doctor });
    expect(reviewing.casesUnderReview).toBe(1);

    // And completing the review closes the case, so the count returns to zero
    // rather than sticking at one.
    await service.progressReferral(store(), { actor: doctor, referralId: referral.id, action: 'complete' });
    const closed = await service.getDoctorDashboard(store(), { actor: doctor });
    expect(closed.casesUnderReview).toBe(0);
  });

  it('still refuses a doctor who is not on the roster, so the id is not a guessable grant', async () => {
    // The roster is the intended source of the id, not a requirement that it came from
    // one. What matters is that an id with no doctor profile behind it is refused — and
    // refused as a *field* error, because an unknown destination is a bad field rather
    // than a missing object: the service does not want to confirm which doctor ids
    // exist, and a worker who typed the wrong one needs to be told which box to fix.
    const stranger = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    expect(
      await codeOf(() =>
        service.createReferral(store(), {
          actor: asha,
          caseId,
          input: { doctorId: stranger, reason: 'Fever' },
        })
      )
    ).toBe('invalid_request');
    expect(
      await fieldsOf(() =>
        service.createReferral(store(), {
          actor: asha,
          caseId,
          input: { doctorId: stranger, reason: 'Fever' },
        })
      )
    ).toEqual(['doctorId']);

    // And nothing was created: a rejected referral does not leave the case referred.
    const [state] = await service.listCases(store(), { actor: asha, query: {} });
    expect(state.status).not.toBe('REFERRED');
  });

  it('still refuses a worker filing somebody else’s case, so the roster is not a wider door', async () => {
    const stranger = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const outsider = await service.createHousehold(store(), {
      actor: otherAsha,
      input: { name: 'Patel household' },
    });
    const notMine = await service.createMember(store(), {
      actor: otherAsha,
      householdId: outsider.id,
      input: { fullName: 'Sita Patel', ageYears: 61, sex: 'FEMALE', relationToHead: 'Head' },
    });
    const notMineCase = await service.createCase(store(), {
      actor: otherAsha,
      input: { householdId: outsider.id, memberId: notMine.id, summary: 'Cough' },
    });

    expect(
      await codeOf(() =>
        service.createReferral(store(), {
          actor: asha,
          caseId: notMineCase.id,
          input: { doctorId: DOCTOR, reason: 'Fever' },
        })
      )
    ).toBe('not_found');

    // And the id being public is not what makes it safe.
    expect(stranger).not.toBe(DOCTOR);
  });

  it('does not offer the roster to a member, who has no referral to file', async () => {
    expect(await codeOf(() => service.listDoctors(store(), { actor: member }))).toBe('forbidden');
  });

  it('sends only structural facts into the audit trail, never the reason or the name', async () => {
    const before = setup.auditLog.length;
    await service.createReferral(store(), {
      actor: asha,
      caseId,
      input: { doctorId: DOCTOR, reason: 'Fever for five days, not settling' },
    });
    const events = setup.auditLog.slice(before);

    const created = events.find((event) => event.action === 'REFERRAL_CREATED');
    expect(created).toBeDefined();
    // `role` is added by the audit helper itself, on every event: who acted is part of
    // the trail's whole point. The call's own metadata is the other four, and all of
    // them are structural.
    expect(Object.keys(created?.metadata ?? {}).sort()).toEqual([
      'campId',
      'caseId',
      'fromStatus',
      'priority',
      'role',
      'toStatus',
    ]);
    // The clinical reason stays in the record and out of the audit metadata, which is
    // the rule the privacy suite enforces for every write. The doctor's name is not in
    // the trail either: the trail says a referral was filed, and the referral says to
    // whom.
    const wire = JSON.stringify(created?.metadata ?? {});
    expect(wire).not.toContain('Fever');
    expect(wire).not.toContain('Doctor One');
  });

  it('carries a referral id that is the doctor’s to act on and nobody else’s', async () => {
    const referral = await service.createReferral(store(), {
      actor: asha,
      caseId,
      input: { doctorId: DOCTOR, reason: 'Fever for five days' },
    });

    expect(
      await codeOf(() =>
        service.acceptReferral(store(), { actor: otherDoctor, referralId: referral.id })
      )
    ).toBe('not_found');
  });
});

/* ------------------------------------------------------------------ *
 * Gap 2 — only the people who may run a camp are offered it          *
 * ------------------------------------------------------------------ */

describe('workflow 2: a camp is created, published, registered for and run', () => {
  /** Creates a camp owned by the given actor. */
  const makeCamp = async (
    owner: HealthcareActor,
    overrides: Record<string, unknown> = {}
  ): Promise<string> => {
    const camp = await service.createCamp(store(), {
      actor: owner,
      input: {
        title: 'Village health camp',
        description: 'Screening and basic care',
        campDate: '2030-03-01',
        startTime: '09:00',
        endTime: '13:00',
        location: 'Community hall',
        capacity: 5,
        ...overrides,
      },
    });
    return camp.id;
  };

  it('tells the organiser they may manage it', async () => {
    const campId = await makeCamp(asha);
    const [camp] = await service.listCamps(store(), { actor: asha, query: { status: 'ALL' } });

    expect(camp.id).toBe(campId);
    expect(camp.canManage).toBe(true);
  });

  it('tells an administrator they may manage somebody else’s camp', async () => {
    await makeCamp(asha);
    const [camp] = await service.listCamps(store(), { actor: admin, query: { status: 'ALL' } });

    expect(camp.canManage).toBe(true);
  });

  it('tells a worker who is not the organiser that they may not', async () => {
    await makeCamp(asha);
    const [camp] = await service.listCamps(store(), { actor: otherAsha, query: { status: 'ALL' } });

    expect(camp.canManage).toBe(false);
  });

  it('tells a member they may not, and a doctor they may not', async () => {
    const campId = await makeCamp(asha);
    await service.changeCampStatus(store(), { actor: asha, campId, status: 'PUBLISHED' });

    const [forMember] = await service.listCamps(store(), {
      actor: member,
      query: { status: 'PUBLISHED' },
    });
    expect(forMember.canManage).toBe(false);

    // A doctor is staff, so they see the draft list too — and still may not manage it.
    const [forDoctor] = await service.listCamps(store(), { actor: doctor, query: { status: 'ALL' } });
    expect(forDoctor.canManage).toBe(false);
  });

  it('always carries the field, so the UI never has to guess whether it is allowed', async () => {
    await makeCamp(asha);
    for (const actor of [asha, otherAsha, doctor, member, admin]) {
      const camps = await service.listCamps(store(), { actor, query: { status: 'ALL' } });
      for (const camp of camps) {
        expect(keysOf(camp)).toContain('canManage');
        expect(typeof camp.canManage).toBe('boolean');
      }
    }
  });

  it('still refuses a direct status change from a non-organiser, hidden button or not', async () => {
    const campId = await makeCamp(asha);

    // The capability said no...
    const [camp] = await service.listCamps(store(), { actor: otherAsha, query: { status: 'ALL' } });
    expect(camp.canManage).toBe(false);

    // ...and the service says no regardless, which is the half that actually matters.
    expect(
      await codeOf(() => service.changeCampStatus(store(), { actor: otherAsha, campId, status: 'PUBLISHED' }))
    ).toBe('not_found');
    expect(
      await codeOf(() => service.changeCampStatus(store(), { actor: doctor, campId, status: 'PUBLISHED' }))
    ).toBe('not_found');
    expect(
      await codeOf(() => service.changeCampStatus(store(), { actor: member, campId, status: 'PUBLISHED' }))
    ).toBe('forbidden');
  });

  it('refuses a request that tries to claim the capability for itself', async () => {
    // `canManage` is derived, so a body carrying one is a strict-schema 400 rather than
    // a value that gets quietly ignored.
    const campId = await makeCamp(asha);
    expect(
      await codeOf(() =>
        service.createCamp(store(), {
          actor: asha,
          input: {
            title: 'Sneaky camp',
            description: null,
            campDate: '2030-04-01',
            startTime: '09:00',
            endTime: '13:00',
            location: 'Hall',
            capacity: 5,
            canManage: true,
          },
        })
      )
    ).toBe('invalid_request');
    expect(campId).toBeTruthy();
  });

  it('does not let a camp be transferred, so the capability cannot change hands', async () => {
    const campId = await makeCamp(asha);

    // The store's `updateCamp` refuses `organizer_user_id` outright, and there is no
    // service function that passes it, so ownership is fixed at creation.
    expect(
      await codeOf(() =>
        service.createCamp(store(), {
          actor: asha,
          input: {
            title: 'Copy',
            description: null,
            campDate: '2030-04-01',
            startTime: '09:00',
            endTime: '13:00',
            location: 'Hall',
            capacity: 5,
            organizerUserId: ADMIN,
          },
        })
      )
    ).toBe('invalid_request');
    expect(campId).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ *
 * Gap 3 — the roster attendance is written against                   *
 * ------------------------------------------------------------------ */

describe('workflow 3: a camp roster, and attendance on it', () => {
  const makePublishedCamp = async (owner: HealthcareActor): Promise<string> => {
    const camp = await service.createCamp(store(), {
      actor: owner,
      input: {
        title: 'Village health camp',
        description: 'Screening and basic care',
        campDate: '2030-03-01',
        startTime: '09:00',
        endTime: '13:00',
        location: 'Community hall',
        capacity: 5,
      },
    });
    await service.changeCampStatus(store(), { actor: owner, campId: camp.id, status: 'PUBLISHED' });
    return camp.id;
  };

  it('starts empty rather than refusing', async () => {
    const campId = await makePublishedCamp(asha);

    expect(await service.listCampRegistrations(store(), { actor: asha, campId })).toEqual([]);
  });

  it('lists every registration, and only that camp’s', async () => {
    const first = await makePublishedCamp(asha);
    const second = await makePublishedCamp(asha);
    await service.registerForCamp(store(), { actor: member, campId: first });
    await service.registerForCamp(store(), { actor: otherDoctor, campId: first });
    await service.registerForCamp(store(), { actor: admin, campId: second });

    const roster = await service.listCampRegistrations(store(), { actor: asha, campId: first });

    expect(roster).toHaveLength(2);
    expect(roster.map((row) => row.userId).sort()).toEqual([MEMBER, OTHER_DOCTOR].sort());
    for (const row of roster) {
      expect(keysOf(row)).toEqual([
        'attendanceStatus',
        'markedAt',
        'registeredAt',
        'registrationId',
        'userId',
      ]);
    }
    // The other camp's registration is not in this camp's roster, and its account id is
    // not on the wire at all.
    expect(JSON.stringify(roster)).not.toContain(ADMIN);
  });

  it('reads the attendance that was already recorded against each registration', async () => {
    const campId = await makePublishedCamp(asha);
    await service.registerForCamp(store(), { actor: member, campId });
    await service.registerForCamp(store(), { actor: otherDoctor, campId });

    const before = await service.listCampRegistrations(store(), { actor: asha, campId });
    expect(before.every((row) => row.attendanceStatus === 'REGISTERED')).toBe(true);
    expect(before.every((row) => row.markedAt === null)).toBe(true);

    const target = before.find((row) => row.userId === MEMBER);
    if (!target) throw new Error('the roster has no registration for the member');
    await service.markCampAttendance(store(), {
      actor: asha,
      campId,
      registrationId: target.registrationId,
      input: { status: 'ATTENDED' },
    });

    const after = await service.listCampRegistrations(store(), { actor: asha, campId });
    const marked = after.find((row) => row.userId === MEMBER);
    expect(marked?.attendanceStatus).toBe('ATTENDED');
    expect(marked?.markedAt).not.toBeNull();
    // The other person is untouched.
    expect(after.find((row) => row.userId === OTHER_DOCTOR)?.attendanceStatus).toBe('REGISTERED');
  });

  it('persists an attendance change made through the roster id', async () => {
    const campId = await makePublishedCamp(asha);
    await service.registerForCamp(store(), { actor: member, campId });
    const [entry] = await service.listCampRegistrations(store(), { actor: asha, campId });

    await service.markCampAttendance(store(), {
      actor: asha,
      campId,
      registrationId: entry.registrationId,
      input: { status: 'ATTENDED' },
    });
    await service.markCampAttendance(store(), {
      actor: asha,
      campId,
      registrationId: entry.registrationId,
      input: { status: 'ABSENT' },
    });

    const [after] = await service.listCampRegistrations(store(), { actor: asha, campId });
    expect(after.attendanceStatus).toBe('ABSENT');
  });

  it('lists in registration order, so the roster reads the same way twice', async () => {
    const campId = await makePublishedCamp(asha);
    await service.registerForCamp(store(), { actor: admin, campId });
    await service.registerForCamp(store(), { actor: member, campId });
    await service.registerForCamp(store(), { actor: otherDoctor, campId });

    const roster = await service.listCampRegistrations(store(), { actor: asha, campId });
    const times = roster.map((row) => row.registeredAt);

    expect(times).toEqual([...times].sort());
  });

  it('drops a cancelled registration off the roster', async () => {
    const campId = await makePublishedCamp(asha);
    await service.registerForCamp(store(), { actor: member, campId });
    await service.registerForCamp(store(), { actor: otherDoctor, campId });
    await service.cancelCampRegistration(store(), { actor: member, campId });

    const roster = await service.listCampRegistrations(store(), { actor: asha, campId });
    expect(roster).toHaveLength(1);
    expect(roster[0].userId).toBe(OTHER_DOCTOR);
  });

  it('shows an administrator the roster of a camp they did not organise', async () => {
    const campId = await makePublishedCamp(asha);
    await service.registerForCamp(store(), { actor: member, campId });

    const roster = await service.listCampRegistrations(store(), { actor: admin, campId });
    expect(roster.map((row) => row.userId)).toEqual([MEMBER]);
  });

  it('refuses a worker who did not organise the camp', async () => {
    const campId = await makePublishedCamp(asha);
    await service.registerForCamp(store(), { actor: member, campId });

    expect(
      await codeOf(() => service.listCampRegistrations(store(), { actor: otherAsha, campId }))
    ).toBe('not_found');
    expect(
      await codeOf(() => service.listCampRegistrations(store(), { actor: doctor, campId }))
    ).toBe('not_found');
  });

  it('refuses a member, who has a seat but not a roster', async () => {
    const campId = await makePublishedCamp(asha);
    await service.registerForCamp(store(), { actor: member, campId });

    // A registered member is still not somebody who may see who else is coming. Their
    // own seat comes back from `listCamps` as `isRegisteredByViewer`.
    expect(
      await codeOf(() => service.listCampRegistrations(store(), { actor: member, campId }))
    ).toBe('forbidden');
  });

  it('answers not_found for a camp that does not exist', async () => {
    expect(
      await codeOf(() =>
        service.listCampRegistrations(store(), {
          actor: asha,
          campId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        })
      )
    ).toBe('not_found');
  });

  it('refuses a registration from one camp marked through another', async () => {
    // The cross-camp check that must survive everything else: a registration id is in
    // an organiser's hand, and it must not be usable at a camp it did not come from.
    const first = await makePublishedCamp(asha);
    const second = await makePublishedCamp(asha);
    await service.registerForCamp(store(), { actor: member, campId: first });
    const [entry] = await service.listCampRegistrations(store(), { actor: asha, campId: first });

    expect(
      await codeOf(() =>
        service.markCampAttendance(store(), {
          actor: asha,
          campId: second,
          registrationId: entry.registrationId,
          input: { status: 'ATTENDED' },
        })
      )
    ).toBe('not_found');

    // And the first camp's own record is unchanged.
    const [unchanged] = await service.listCampRegistrations(store(), { actor: asha, campId: first });
    expect(unchanged.attendanceStatus).toBe('REGISTERED');
  });

  it('refuses a member marking their own registration present', async () => {
    const campId = await makePublishedCamp(asha);
    await service.registerForCamp(store(), { actor: member, campId });
    const [entry] = await service.listCampRegistrations(store(), { actor: asha, campId });

    expect(
      await codeOf(() =>
        service.markCampAttendance(store(), {
          actor: member,
          campId,
          registrationId: entry.registrationId,
          input: { status: 'ATTENDED' },
        })
      )
    ).toBe('forbidden');
  });
});

/* ------------------------------------------------------------------ *
 * What the roster must never carry                                   *
 * ------------------------------------------------------------------ */

describe('the roster carries attendance and nothing else', () => {
  it('has no household, member, case or clinical field on it', async () => {
    const camp = await service.createCamp(store(), {
      actor: asha,
      input: {
        title: 'Camp',
        description: null,
        campDate: '2030-03-01',
        startTime: '09:00',
        endTime: '13:00',
        location: 'Hall',
        capacity: 5,
      },
    });
    await service.changeCampStatus(store(), { actor: asha, campId: camp.id, status: 'PUBLISHED' });
    await service.registerForCamp(store(), { actor: member, campId: camp.id });

    // Give the case everything the roster must stay away from.
    await service.createObservation(store(), {
      actor: asha,
      caseId,
      input: { reportedSymptoms: ['Fever'], severity: 'MODERATE', observedOn: '2030-01-02' },
    });
    await service.createReferral(store(), {
      actor: asha,
      caseId,
      input: { doctorId: DOCTOR, reason: 'Fever for five days' },
    });

    const roster = await service.listCampRegistrations(store(), { actor: asha, campId: camp.id });
    const wire = JSON.stringify(roster);

    for (const forbidden of [
      // personal health, from World A, which has no query path into this database at all
      'cycle',
      'period',
      'flow',
      'mood',
      'sleep',
      'hydration',
      'pain',
      'pin',
      // the household register and the clinical record
      'household',
      'member',
      'fullName',
      'ageYears',
      'sex',
      'caseId',
      'caseNumber',
      'summary',
      'observation',
      'symptom',
      'referral',
      'prescription',
      'clinicalNote',
      'followUp',
      // who was standing at the table: that is the audit trail's job
      'markedBy',
    ]) {
      expect(wire, `roster must not mention "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it('does not carry the name of the person who marked attendance', async () => {
    const camp = await service.createCamp(store(), {
      actor: asha,
      input: {
        title: 'Camp',
        description: null,
        campDate: '2030-03-01',
        startTime: '09:00',
        endTime: '13:00',
        location: 'Hall',
        capacity: 5,
      },
    });
    await service.changeCampStatus(store(), { actor: asha, campId: camp.id, status: 'PUBLISHED' });
    await service.registerForCamp(store(), { actor: member, campId: camp.id });
    const [entry] = await service.listCampRegistrations(store(), { actor: asha, campId: camp.id });
    await service.markCampAttendance(store(), {
      actor: asha,
      campId: camp.id,
      registrationId: entry.registrationId,
      input: { status: 'ATTENDED' },
    });

    const roster = await service.listCampRegistrations(store(), { actor: asha, campId: camp.id });
    expect(keysOf(roster[0] as CampRosterEntryDto)).not.toContain('markedByUserId');
    // The attribution exists, in the audit log, which is append-only.
    const marked = setup.auditLog.filter((event) => event.action === 'CAMP_ATTENDANCE_UPDATED');
    expect(marked).toHaveLength(1);
    expect(marked[0].actorId).toBe(ASHA);
  });
});

/* ------------------------------------------------------------------ *
 * The authorization matrix, in one place                            *
 * ------------------------------------------------------------------ */

describe('the authorization matrix', () => {
  it('lets only a doctor prescribe, and refuses a worker and a member', async () => {
    // The doctor has to own the case before the question is about *roles* at all,
    // otherwise the write is refused for the more basic reason that the case is not
    // theirs and the test proves nothing about the role split.
    const referral = await service.createReferral(store(), {
      actor: asha,
      caseId,
      input: { doctorId: DOCTOR, reason: 'Fever for five days' },
    });
    await service.acceptReferral(store(), { actor: doctor, referralId: referral.id });
    const note = await service.createClinicalNote(store(), {
      actor: doctor,
      caseId,
      input: { assessment: 'Viral fever', advice: 'Rest and fluids' },
    });
    const input = {
      medicineName: 'Paracetamol',
      dosage: '500mg',
      frequency: 'Twice daily',
      duration: '3 days',
    };

    // The clinician who owns the case may prescribe on it.
    const written = await service.createPrescription(store(), {
      actor: doctor,
      caseId: note.caseId,
      input,
    });
    expect(written.medicineName).toBe('Paracetamol');

    // A member is told the door is not theirs at all.
    expect(
      await codeOf(() => service.createPrescription(store(), { actor: member, caseId: note.caseId, input }))
    ).toBe('forbidden');

    // A worker is refused as well. The code is the one that matters: the service checks
    // the role first, so a worker is told "prescribing is a doctor write" rather than
    // being sent looking for a permission they do not have.
    expect(
      await codeOf(() => service.createPrescription(store(), { actor: asha, caseId: note.caseId, input }))
    ).toBe('forbidden');
  });

  it('keeps a doctor off a case they were not referred, before the role even comes up', async () => {
    const input = {
      medicineName: 'Paracetamol',
      dosage: '500mg',
      frequency: 'Twice daily',
      duration: '3 days',
    };
    // `otherDoctor` is on the roster and is a doctor, and still cannot write here: the
    // roster is who *may* be referred, not who may write on any case.
    expect(
      await codeOf(() => service.createPrescription(store(), { actor: otherDoctor, caseId, input }))
    ).toBe('not_found');
  });

  it('keeps one worker out of another worker’s household', async () => {
    expect(
      await codeOf(() => service.getHouseholdDetail(store(), { actor: otherAsha, householdId }))
    ).toBe('not_found');
  });

  it('keeps a doctor out of a case they were not referred', async () => {
    expect(
      await codeOf(() => service.getCaseReview(store(), { actor: doctor, caseId }))
    ).toBe('not_found');
  });

  it('keeps a doctor out of a member of the same household who is not on the case', async () => {
    const sibling = await service.createMember(store(), {
      actor: asha,
      householdId,
      input: { fullName: 'Ravi Sharma', ageYears: 8, sex: 'MALE', relationToHead: 'Son' },
    });
    expect(sibling.id).not.toBe(memberId);

    // Accept a referral so the doctor genuinely owns this case, then confirm the
    // review carries one member and not the household.
    const referral: ReferralDto = await service.createReferral(store(), {
      actor: asha,
      caseId,
      input: { doctorId: DOCTOR, reason: 'Fever for five days' },
    });
    await service.acceptReferral(store(), { actor: doctor, referralId: referral.id });

    const review = await service.getCaseReview(store(), { actor: doctor, caseId });
    // Asserted on the key set rather than on an absent field, because the DTO has no
    // `members` field to be undefined in the first place — that is the stronger claim.
    expect(keysOf(review)).toEqual([
      'ashaName',
      'case',
      'clinicalNotes',
      'followUps',
      'householdAddress',
      'householdCode',
      'member',
      'observations',
      'prescriptions',
      'referrals',
    ]);
    expect(review.member.fullName).toBe('Kamla Sharma');
    expect(JSON.stringify(review)).not.toContain('Ravi Sharma');
  });

  it('does not put a household register on a camp', async () => {
    // A camp is a public event; it is not a place households are enrolled.
    const camp: HealthCampDto = await service.createCamp(store(), {
      actor: asha,
      input: {
        title: 'Camp',
        description: null,
        campDate: '2030-03-01',
        startTime: '09:00',
        endTime: '13:00',
        location: 'Hall',
        capacity: 5,
      },
    });
    expect(keysOf(camp)).not.toContain('householdId');
    expect(keysOf(camp)).toContain('canManage');
  });

  it('keeps the ASHA referral, doctor review, camp recommendation, registration, and attendance on one member and case', async () => {
    const household = await service.createHousehold(store(), {
      actor: asha,
      input: { name: 'Kamla Devi Household', addressLine: 'Bengaluru' },
    });
    const woman = await service.createMember(store(), {
      actor: asha,
      householdId: household.id,
      input: { fullName: 'Kamla Devi', ageYears: 32, sex: 'FEMALE', relationToHead: 'Head' },
    });
    const registeredCase = await service.createCase(store(), {
      actor: asha,
      input: { householdId: household.id, memberId: woman.id, summary: 'Irregular periods', priority: 'ROUTINE' },
    });
    const registeredCaseId = registeredCase.id;
    const registeredMemberId = woman.id;
    await service.createObservation(store(), {
      actor: asha,
      caseId: registeredCaseId,
      input: { reportedSymptoms: ['Abdominal pain', 'Fatigue'], severity: 'MODERATE', observedOn: '2030-01-10', durationDays: 5, notes: 'Symptoms reported during home visit' },
    });
    const referral = await service.createReferral(store(), {
      actor: asha,
      caseId: registeredCaseId,
      input: { doctorId: DOCTOR, reason: 'Symptoms require clinical review' },
    });
    const incoming = await service.listReferrals(store(), { actor: doctor, query: {} });
    expect(incoming.some((item) => item.id === referral.id && item.caseId === registeredCaseId)).toBe(true);
    await service.acceptReferral(store(), { actor: doctor, referralId: referral.id });
    const review = await service.getCaseReview(store(), { actor: doctor, caseId: registeredCaseId });
    expect(review.case.id).toBe(registeredCaseId);
    expect(review.case.memberId).toBe(registeredMemberId);
    expect(review.member).toMatchObject({ id: registeredMemberId, fullName: 'Kamla Devi', ageYears: 32 });
    expect(review.observations[0]).toMatchObject({ reportedSymptoms: ['Abdominal pain', 'Fatigue'], notes: 'Symptoms reported during home visit' });

    await service.createClinicalNote(store(), { actor: doctor, caseId: registeredCaseId, input: {
      assessment: 'Clinical assessment', observations: 'Symptoms reviewed', advice: 'Return if symptoms worsen',
    } });
    await service.createPrescription(store(), { actor: doctor, caseId: registeredCaseId, input: {
      medicineName: 'Iron supplement', dosage: '1 tablet', frequency: 'Daily', duration: '30 days', instructions: 'Take with food',
    } });
    await service.createFollowUp(store(), { actor: doctor, caseId: registeredCaseId, input: {
      assignedRole: 'DOCTOR', dueDate: '2030-02-15', notes: 'Review symptoms',
    } });

    const camp = await service.createCamp(store(), { actor: asha, input: {
      title: 'Women’s health camp', description: null, campDate: '2030-03-01',
      startTime: '09:00', endTime: '13:00', location: 'Community hall', capacity: 5,
    } });
    await service.changeCampStatus(store(), { actor: asha, campId: camp.id, status: 'PUBLISHED' });
    const recommendation = await service.recommendCaseForCamp(store(), { actor: doctor, caseId: registeredCaseId, campId: camp.id });
    expect(recommendation.caseId).toBe(registeredCaseId);
    expect(recommendation.memberId).toBe(registeredMemberId);
    expect(recommendation.registrationStatus).toBe('RECOMMENDED');

    let [rosterEntry] = await service.listCampRegistrations(store(), { actor: asha, campId: camp.id });
    expect(rosterEntry).toMatchObject({ caseId: registeredCaseId, memberId: registeredMemberId, memberName: 'Kamla Devi', caseNumber: review.case.caseNumber });
    rosterEntry = await service.registerRecommendedPatient(store(), { actor: asha, campId: camp.id, registrationId: recommendation.registrationId });
    expect(rosterEntry.registrationStatus).toBe('REGISTERED');
    await service.markCampAttendance(store(), { actor: asha, campId: camp.id, registrationId: recommendation.registrationId, input: { status: 'ATTENDED' } });

    const [finalEntry] = await service.listCampRegistrations(store(), { actor: asha, campId: camp.id });
    expect(finalEntry).toMatchObject({ registrationId: recommendation.registrationId, caseId: registeredCaseId, memberId: registeredMemberId, caseNumber: review.case.caseNumber, memberName: 'Kamla Devi', registrationStatus: 'REGISTERED', attendanceStatus: 'ATTENDED' });
  });

  it('enforces role ownership and refuses a registration that substitutes another member', async () => {
    const referral = await service.createReferral(store(), { actor: asha, caseId, input: { doctorId: DOCTOR, reason: 'Review' } });
    await service.acceptReferral(store(), { actor: doctor, referralId: referral.id });
    const camp = await service.createCamp(store(), { actor: asha, input: {
      title: 'Women’s health camp', campDate: '2030-03-01', startTime: '09:00', endTime: '13:00', location: 'Hall', capacity: 5,
    } });
    await service.changeCampStatus(store(), { actor: asha, campId: camp.id, status: 'PUBLISHED' });
    const recommendation = await service.recommendCaseForCamp(store(), { actor: doctor, caseId, campId: camp.id });
    expect(await codeOf(() => service.recommendCaseForCamp(store(), { actor: asha, caseId, campId: camp.id }))).toBe('forbidden');
    expect(await codeOf(() => service.createObservation(store(), { actor: doctor, caseId, input: { reportedSymptoms: ['Cramps'], severity: 'MILD', observedOn: '2030-01-02' } }))).toBe('forbidden');
    expect(await codeOf(() => service.registerRecommendedPatient(store(), { actor: doctor, campId: camp.id, registrationId: recommendation.registrationId }))).toBe('not_found');
    expect(await codeOf(() => store().recommendPatientForCamp({ campId: camp.id, caseId, householdMemberId: OTHER_MEMBER, recommendedByDoctorId: DOCTOR, recommendationReason: 'Wrong member' }))).toBe('not_found');
  });
});

/* ------------------------------------------------------------------ *
 * The referred-case count on a camp card                              *
 * ------------------------------------------------------------------ */

/**
 * `referredCaseCount` used to be read from `health_cases.camp_id`, which is only
 * populated for a case *created at* a camp. Nothing creates one, so the number was
 * zero on every camp card including camps a doctor had referred cases into, and an
 * organiser planning a camp had no way to see the demand heading their way.
 *
 * The relationship a recommendation actually writes is
 * `camp_registrations.case_id`, so that is what is counted. These tests pin the
 * three numbers apart from each other, because the failure mode being guarded
 * against is a "fix" that simply reports the registration count under a new name.
 */
describe('a camp counts the cases referred to it', () => {
  const publishCamp = async (title: string) => {
    const camp = await service.createCamp(store(), {
      actor: asha,
      input: {
        title,
        description: null,
        campDate: '2030-03-01',
        startTime: '09:00',
        endTime: '13:00',
        location: 'Community hall',
        capacity: 5,
      },
    });
    await service.changeCampStatus(store(), { actor: asha, campId: camp.id, status: 'PUBLISHED' });
    return camp;
  };

  /** A second case the doctor owns, which is what a recommendation requires. */
  const openCaseForDoctor = async (summary: string) => {
    const healthCase = await service.createCase(store(), {
      actor: asha,
      input: { householdId, memberId, summary, priority: 'ROUTINE' },
    });
    const referral = await service.createReferral(store(), {
      actor: asha,
      caseId: healthCase.id,
      input: { doctorId: DOCTOR, reason: 'Specialist review' },
    });
    await service.acceptReferral(store(), { actor: doctor, referralId: referral.id });
    return healthCase;
  };

  /** The camp card as an organiser sees it, which is the only viewer given the count. */
  const cardFor = async (campId: string) => {
    const camps = await service.listCamps(store(), { actor: asha, query: { status: 'ALL' } });
    const card = camps.find((row) => row.id === campId);
    if (!card) throw new Error('camp missing from the list');
    return card;
  };

  it('counts a case once the doctor recommends it, against the same case', async () => {
    const camp = await publishCamp('Anemia screening');
    expect((await cardFor(camp.id)).referredCaseCount).toBe(0);

    const healthCase = await openCaseForDoctor('Heavy menstrual bleeding');
    const recommendation = await service.recommendCaseForCamp(store(), {
      actor: doctor,
      caseId: healthCase.id,
      campId: camp.id,
    });

    // The recommendation is the same healthcare case, not a copy of it: the case
    // the doctor acted on and the case on the camp's roster are one record, so a
    // later change to the case is visible from the camp without a second link.
    expect(recommendation.caseId).toBe(healthCase.id);
    expect((await cardFor(camp.id)).referredCaseCount).toBe(1);

    const [entry] = await service.listCampRegistrations(store(), { actor: asha, campId: camp.id });
    expect(entry).toMatchObject({ caseId: healthCase.id, memberId, registrationStatus: 'RECOMMENDED' });

    // And the case itself is untouched by the recommendation: no camp column, no
    // status change, so the case's own workflow is not coupled to the camp's.
    const stored = await store().getCase(healthCase.id);
    expect(stored?.camp_id).toBeNull();
  });

  it('is a different number from the registrations and from the attendance', async () => {
    const camp = await publishCamp('Anemia screening');
    const healthCase = await openCaseForDoctor('Heavy menstrual bleeding');
    const recommendation = await service.recommendCaseForCamp(store(), {
      actor: doctor,
      caseId: healthCase.id,
      campId: camp.id,
    });

    // Referred, but not registered: this is the gap the count exists to show.
    const referred = await cardFor(camp.id);
    expect(referred.referredCaseCount).toBe(1);
    expect(referred.registeredCount).toBe(0);
    expect(referred.attendedCount).toBe(0);

    await service.registerRecommendedPatient(store(), {
      actor: asha,
      campId: camp.id,
      registrationId: recommendation.registrationId,
    });

    // Registering the woman converts the existing recommendation. It is not a
    // second referral, so the referred count must not move.
    const registered = await cardFor(camp.id);
    expect(registered.registeredCount).toBe(1);
    expect(registered.referredCaseCount).toBe(1);

    await service.markCampAttendance(store(), {
      actor: asha,
      campId: camp.id,
      registrationId: recommendation.registrationId,
      input: { status: 'ATTENDED' },
    });

    // Attendance records that a person turned up. It says nothing about how many
    // cases were referred, and must leave the referral count alone.
    const attended = await cardFor(camp.id);
    expect(attended.attendedCount).toBe(1);
    expect(attended.referredCaseCount).toBe(1);
    expect(attended.registeredCount).toBe(1);
  });

  it('stays at one when the same case is recommended twice', async () => {
    const camp = await publishCamp('Anemia screening');
    const healthCase = await openCaseForDoctor('Heavy menstrual bleeding');

    const first = await service.recommendCaseForCamp(store(), {
      actor: doctor,
      caseId: healthCase.id,
      campId: camp.id,
    });
    const second = await service.recommendCaseForCamp(store(), {
      actor: doctor,
      caseId: healthCase.id,
      campId: camp.id,
    });

    // Idempotent at both levels: the same registration comes back, and the count
    // does not double. A retried request on a bad connection must not inflate a
    // number an organiser is making a staffing decision from.
    expect(second.registrationId).toBe(first.registrationId);
    expect((await cardFor(camp.id)).referredCaseCount).toBe(1);
    expect(await store().listRegistrationsByCamp(camp.id)).toHaveLength(1);
  });

  it('counts each case once and keeps each camp to its own referrals', async () => {
    const campA = await publishCamp('Anemia screening');
    const campB = await publishCamp('PCOS awareness');
    const first = await openCaseForDoctor('Heavy menstrual bleeding');
    const second = await openCaseForDoctor('Irregular cycles');

    await service.recommendCaseForCamp(store(), { actor: doctor, caseId: first.id, campId: campA.id });
    await service.recommendCaseForCamp(store(), { actor: doctor, caseId: second.id, campId: campA.id });
    // The same case can be referred to a second camp; that is a second camp's
    // referral, not a second referral of the same case at the first.
    await service.recommendCaseForCamp(store(), { actor: doctor, caseId: first.id, campId: campB.id });

    expect((await cardFor(campA.id)).referredCaseCount).toBe(2);
    expect((await cardFor(campB.id)).referredCaseCount).toBe(1);
  });

  it('is hidden from a member, who is not entitled to the number', async () => {
    const camp = await publishCamp('Anemia screening');
    const healthCase = await openCaseForDoctor('Heavy menstrual bleeding');
    await service.recommendCaseForCamp(store(), { actor: doctor, caseId: healthCase.id, campId: camp.id });

    const camps = await service.listCamps(store(), { actor: member, query: { status: 'ALL' } });
    const card = camps.find((row) => row.id === camp.id);
    expect(card).toBeDefined();
    // Absent rather than zero: a member should not be able to read a camp's
    // clinical pipeline by counting to it.
    expect('referredCaseCount' in (card as object)).toBe(false);
  });
});
