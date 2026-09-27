import { describe, it, expect, beforeEach } from 'vitest';
import { ApiError, isApiError } from '@/lib/api/errors';
import { createInMemoryHealthcareFixture, type InMemoryHealthcareFixture } from '@/lib/healthcare/store';
import { resolveHealthcareActor, type HealthcareActor } from '@/lib/healthcare/session';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '@/types/healthcare';
import * as service from '@/lib/healthcare/service';

/**
 * The service, tested as attempts rather than as usage.
 *
 * `healthcare-session.test.ts` covers where a role comes from. This file covers what
 * the service does with one, and it is weighted towards the answers that would hurt
 * somebody if they were wrong:
 *
 *   - a wrong *shape* (a household code in a field called caseNumber) misleads a
 *     clinician reading a queue;
 *   - a wrong *code* (403 where the answer must be 404) tells a worker that a case
 *     they cannot see exists, which is a disclosure about a third party;
 *   - a wrong *column* (a settled follow-up with no attribution) is refused by the
 *     database, so the workflow would pass here and fail in production.
 *
 * Every test runs against the in-memory fixture, which does NOT implement RLS. That is
 * the point: a service that leaned on the database to enforce scope would pass all of
 * this and fail in production, which is the only place it would have been exercised.
 */

const MEMBER = '11111111-1111-4111-8111-111111111111';
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
let otherHouseholdId: string;
let memberId: string;
let otherMemberId: string;
let caseId: string;

const store = () => setup.store;

/** The code of the API error a call raises, or a failure if it does not raise one. */
const codeOf = async (work: () => Promise<unknown>): Promise<string> => {
  try {
    await work();
  } catch (error) {
    if (isApiError(error)) return (error as ApiError).code;
    throw error;
  }
  throw new Error('expected the call to fail, and it did not');
};

const fieldsOf = async (work: () => Promise<unknown>): Promise<string[]> => {
  try {
    await work();
  } catch (error) {
    if (isApiError(error)) return (error as ApiError).fields ?? [];
    throw error;
  }
  throw new Error('expected the call to fail, and it did not');
};

/** Refers the fixture case to the doctor and has them accept, so the case is theirs. */
const referToDoctor = async (target = DOCTOR): Promise<string> => {
  const referral = await service.createReferral(store(), {
    actor: asha,
    caseId,
    input: { doctorId: target, reason: 'Fever for five days, not settling' },
  });
  await service.acceptReferral(store(), { actor: doctor, referralId: referral.id });
  return referral.id;
};

beforeEach(async () => {
  setup = createInMemoryHealthcareFixture();
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
  const first = await service.createMember(store(), {
    actor: asha,
    householdId,
    input: { fullName: 'Kamla Sharma', ageYears: 34, sex: 'FEMALE', relationToHead: 'Head' },
  });
  memberId = first.id;
  // Somebody else in the same household. The doctor-visibility test depends on there
  // being a person here who is NOT on the doctor's case.
  const second = await service.createMember(store(), {
    actor: asha,
    householdId,
    input: { fullName: 'Ravi Sharma', ageYears: 8, sex: 'MALE', relationToHead: 'Son' },
  });
  otherMemberId = second.id;

  const other = await service.createHousehold(store(), {
    actor: otherAsha,
    input: { name: 'Patel household', addressLine: '9 Canal Lane' },
  });
  otherHouseholdId = other.id;
  const outsider = await service.createMember(store(), {
    actor: otherAsha,
    householdId: otherHouseholdId,
    input: { fullName: 'Sita Patel', ageYears: 61, sex: 'FEMALE', relationToHead: 'Head' },
  });
  otherMemberId = outsider.id;

  const created = await service.createCase(store(), {
    actor: asha,
    input: { householdId, memberId, summary: 'Persistent fever for five days', priority: 'ROUTINE' },
  });
  caseId = created.id;
});

describe('scope', () => {
  it('answers not_found, not forbidden, for another worker household', async () => {
    // The distinction is why this is a 404 and not a 403: "forbidden" on a household id
    // confirms the household exists, which tells the caller that a household they do
    // not cover has been registered somewhere.
    expect(
      await codeOf(() => service.getHouseholdDetail(store(), { actor: otherAsha, householdId }))
    ).toBe('not_found');
  });

  it('refuses a member every staff surface', async () => {
    expect(await codeOf(() => service.listHouseholds(store(), { actor: member }))).toBe('forbidden');
    expect(await codeOf(() => service.listCases(store(), { actor: member, query: {} }))).toBe('forbidden');
    expect(
      await codeOf(() =>
        service.createCase(store(), {
          actor: member,
          input: { householdId, memberId, summary: 'Not mine to write', priority: 'ROUTINE' },
        })
      )
    ).toBe('forbidden');
  });

  it('keeps a doctor out of a case they were not given', async () => {
    expect(await codeOf(() => service.getCaseReview(store(), { actor: otherDoctor, caseId }))).toBe(
      'not_found'
    );
  });

  it('gives a doctor only the member on their case, not the whole register', async () => {
    // One case, one member, in a household of two. The other member has a name, an
    // age, a sex and a place in the family: none of it asked for, all of it health
    // data about a person with no case.
    await referToDoctor();
    const members = await service.listMembers(store(), { actor: doctor, householdId });
    expect(members.map((row) => row.id)).toEqual([memberId]);
    expect(members.map((row) => row.id)).not.toContain(otherMemberId);
  });

  it('shows a doctor their own unaccepted referral, but not one addressed elsewhere', async () => {
    const referral = await service.createReferral(store(), {
      actor: asha,
      caseId,
      input: { doctorId: DOCTOR, reason: 'Fever for five days' },
    });
    // The doctor it names can see it — it is their queue — but cannot act on it yet.
    expect(
      await codeOf(() =>
        service.progressReferral(store(), { actor: doctor, referralId: referral.id, action: 'startReview' })
      )
    ).toBe('conflict');
    // A doctor it does not name cannot tell whether it exists.
    expect(
      await codeOf(() => service.acceptReferral(store(), { actor: otherDoctor, referralId: referral.id }))
    ).toBe('not_found');
  });

  it('does not let one worker read another worker household through a member id', async () => {
    expect(
      await codeOf(() =>
        service.updateMember(store(), { actor: otherAsha, memberId, input: { fullName: 'Mine now' } })
      )
    ).toBe('not_found');
  });
});

describe('prescriptions are the doctor\'s alone', () => {
  it.each([
    ['a member', () => member],
    ['a worker', () => asha],
    ['an administrator', () => admin],
  ])('refuses %s before it looks at anything else', async (_label, actorFor) => {
    // `requireDoctor` runs before the case is even fetched, so the answer is `forbidden`
    // and not `not_found`: this is a statement about the caller's role, and a 404
    // would tell a member that the case they named exists.
    expect(
      await codeOf(() =>
        service.createPrescription(store(), {
          actor: actorFor(),
          caseId,
          input: {
            clinicalNoteId: null,
            medicineName: 'Paracetamol',
            dosage: '500mg',
            frequency: 'Twice daily',
            duration: '3 days',
          },
        })
      )
    ).toBe('forbidden');
  });

  it('accepts the assigned doctor and writes what they prescribed', async () => {
    const referralId = await referToDoctor();
    const note = await service.createClinicalNote(store(), {
      actor: doctor,
      caseId,
      input: {
        assessment: 'Viral fever, no signs of sepsis',
        observations: 'Alert and oriented',
        advice: 'Rest and fluids, return if the fever lasts a week',
      },
    });
    expect(note.id).toBeTruthy();
    expect(referralId).toBeTruthy();

    const prescription = await service.createPrescription(store(), {
      actor: doctor,
      caseId,
      input: {
        clinicalNoteId: note.id,
        medicineName: 'Paracetamol',
        dosage: '500mg',
        frequency: 'Twice daily',
        duration: '3 days',
      },
    });
    expect(prescription.medicineName).toBe('Paracetamol');
    expect(prescription.dosage).toBe('500mg');
  });

  it('refuses a doctor who has not been given the case', async () => {
    // A referral to somebody else does not make the case theirs.
    await service.createReferral(store(), {
      actor: asha,
      caseId,
      input: { doctorId: OTHER_DOCTOR, reason: 'Fever for five days' },
    });
    expect(
      await codeOf(() =>
        service.createClinicalNote(store(), {
          actor: otherDoctor,
          caseId,
          input: { assessment: 'Not mine', advice: 'None' },
        })
      )
    ).toBe('not_found');
  });
});

describe('identifiers on the wire', () => {
  it('reports the case number on a referral, not the household code', async () => {
    const [summary] = await service.listCases(store(), { actor: asha, query: {} });
    const referral = await service.createReferral(store(), {
      actor: asha,
      caseId,
      input: { doctorId: DOCTOR, reason: 'Fever not settling' },
    });
    // A household code in a field called caseNumber sends a clinician to the wrong
    // record, and the two strings are different in the fixture on purpose.
    expect(referral.caseNumber).toBe(summary.caseNumber);
    expect(referral.caseNumber).not.toBe(summary.householdCode);
  });

  it('reports the case number on a follow-up, not the household code', async () => {
    const [summary] = await service.listCases(store(), { actor: asha, query: {} });
    const followUp = await service.createFollowUp(store(), {
      actor: asha,
      caseId,
      input: { assignedRole: 'ASHA', dueDate: '2030-01-09', notes: 'Return in three days' },
    });
    expect(followUp.caseNumber).toBe(summary.caseNumber);
    expect(followUp.caseNumber).not.toBe(summary.householdCode);
  });
});

describe('follow-ups are addressed to a role, resolved from the case', () => {
  it('sends an ASHA follow-up to the household worker', async () => {
    const followUp = await service.createFollowUp(store(), {
      actor: asha,
      caseId,
      input: { assignedRole: 'ASHA', dueDate: '2030-01-09' },
    });
    expect(followUp.assignedRole).toBe('ASHA');
    expect(followUp.caseId).toBe(caseId);
  });

  it('sends a doctor follow-up once the doctor holds the case', async () => {
    await referToDoctor();
    const followUp = await service.createFollowUp(store(), {
      actor: doctor,
      caseId,
      input: { assignedRole: 'DOCTOR', dueDate: '2030-01-09' },
    });
    expect(followUp.assignedRole).toBe('DOCTOR');
  });

  it('refuses a doctor follow-up on a case nobody has been given', async () => {
    // Refusing names the field. Guessing a recipient would put the follow-up in a queue
    // nobody reads, which looks handled and is not.
    expect(
      await fieldsOf(() =>
        service.createFollowUp(store(), {
          actor: asha,
          caseId,
          input: { assignedRole: 'DOCTOR', dueDate: '2030-01-09' },
        })
      )
    ).toEqual(['assignedRole']);
  });

  it('refuses an admin follow-up, because there is no honest recipient', async () => {
    expect(
      await codeOf(() =>
        service.createFollowUp(store(), {
          actor: admin,
          caseId,
          input: { assignedRole: 'ADMIN', dueDate: '2030-01-09' },
        })
      )
    ).toBe('invalid_request');
  });

  it('stamps every settled follow-up, not only a completed one', async () => {
    // `follow_ups_completion_is_attributable` requires both columns for any status
    // other than PENDING. A follow-up marked missed is still a claim that somebody
    // looked, so it carries the same attribution as one marked done.
    for (const action of ['complete', 'markMissed', 'cancel'] as const) {
      const created = await service.createFollowUp(store(), {
        actor: asha,
        caseId,
        input: { assignedRole: 'ASHA', dueDate: '2030-01-09' },
      });
      await service.settleFollowUp(store(), { actor: asha, followUpId: created.id, action });
      const row = await store().getFollowUp(created.id);
      expect(row?.completed_at, `${action} needs completed_at`).toBeTruthy();
      expect(row?.completed_by_user_id, `${action} needs an attributed user`).toBe(ASHA);
    }
  });

  it('keeps the first stamp when the same settlement is retried', async () => {
    // A retried request on a bad connection is a real thing, and `state.ts` treats
    // settling twice as idempotent. What must not happen is the retry overwriting who
    // actually closed the follow-up and when.
    const created = await service.createFollowUp(store(), {
      actor: asha,
      caseId,
      input: { assignedRole: 'ASHA', dueDate: '2030-01-09' },
    });
    await service.settleFollowUp(store(), { actor: asha, followUpId: created.id, action: 'complete' });
    const first = await store().getFollowUp(created.id);

    await service.settleFollowUp(store(), { actor: asha, followUpId: created.id, action: 'complete' });
    const second = await store().getFollowUp(created.id);
    expect(second?.completed_at).toBe(first?.completed_at);
    expect(second?.completed_by_user_id).toBe(first?.completed_by_user_id);
  });

  it('answers conflict for a settlement that is not allowed at all', async () => {
    const created = await service.createFollowUp(store(), {
      actor: asha,
      caseId,
      input: { assignedRole: 'ASHA', dueDate: '2030-01-09' },
    });
    await service.settleFollowUp(store(), { actor: asha, followUpId: created.id, action: 'complete' });
    // Missing and done are not the same answer, so this one is a real refusal: a 404
    // would say the follow-up is gone, and it is not.
    expect(
      await codeOf(() =>
        service.settleFollowUp(store(), { actor: asha, followUpId: created.id, action: 'markMissed' })
      )
    ).toBe('conflict');
  });

  it('does not let somebody settle a follow-up addressed to someone else', async () => {
    const created = await service.createFollowUp(store(), {
      actor: asha,
      caseId,
      input: { assignedRole: 'ASHA', dueDate: '2030-01-09' },
    });
    expect(
      await codeOf(() =>
        service.settleFollowUp(store(), { actor: otherAsha, followUpId: created.id, action: 'complete' })
      )
    ).toBe('not_found');
  });
});

describe('transitions report the right kind of wrong', () => {
  it('answers conflict when referring a case a clinician has already closed', async () => {
    const referralId = await referToDoctor();
    await service.progressReferral(store(), { actor: doctor, referralId, action: 'complete' });
    // A 404 would be a lie about a case the caller can plainly see.
    expect(
      await codeOf(() =>
        service.createReferral(store(), {
          actor: asha,
          caseId,
          input: { doctorId: DOCTOR, reason: 'The fever has come back' },
        })
      )
    ).toBe('conflict');
  });

  it('refuses to correct a case once a clinician has taken it', async () => {
    await referToDoctor();
    // The record of the decision is the clinical note, and notes are append-only. A
    // summary that can still be rewritten afterwards is one that will be.
    expect(
      await codeOf(() =>
        service.updateCase(store(), {
          actor: asha,
          caseId,
          input: { summary: 'Something else entirely', priority: 'ROUTINE' },
        })
      )
    ).toBe('conflict');
  });

  it('lets the opening worker correct their own case while it is open', async () => {
    const updated = await service.updateCase(store(), {
      actor: asha,
      caseId,
      input: { summary: 'Fever for five days, not settling on paracetamol', priority: 'URGENT' },
    });
    expect(updated.priority).toBe('URGENT');
  });

  it('does not let one worker rewrite another worker case', async () => {
    expect(
      await codeOf(() =>
        service.updateCase(store(), {
          actor: otherAsha,
          caseId,
          input: { summary: 'Not my household', priority: 'ROUTINE' },
        })
      )
    ).toBe('not_found');
  });

  it('rejects an unknown field rather than ignoring it', async () => {
    // A body carrying `assignedDoctorId` is refused, not quietly stripped: silently
    // dropping a field is how a caller ends up believing a thing was set that was not.
    expect(
      await codeOf(() =>
        service.createCase(store(), {
          actor: asha,
          input: {
            householdId,
            memberId,
            summary: 'Fever',
            priority: 'ROUTINE',
            assignedDoctorId: DOCTOR,
          },
        })
      )
    ).toBe('invalid_request');
  });
});

describe('camps', () => {
  /** A published camp, because a camp is a draft until somebody publishes it. */
  const makeCamp = async (capacity = 2): Promise<string> => {
    const camp = await service.createCamp(store(), {
      actor: asha,
      input: {
        title: 'Screening camp',
        description: 'Fever and blood pressure checks',
        campDate: '2030-02-01',
        startTime: '09:00',
        endTime: '13:00',
        location: 'Community hall',
        capacity,
      },
    });
    await service.changeCampStatus(store(), { actor: asha, campId: camp.id, status: 'PUBLISHED' });
    return camp.id;
  };

  it('will not take a registration for a camp nobody has published', async () => {
    const camp = await service.createCamp(store(), {
      actor: asha,
      input: {
        title: 'Still being planned',
        campDate: '2030-02-01',
        startTime: '09:00',
        endTime: '13:00',
        location: 'Community hall',
        capacity: 5,
      },
    });
    expect(await codeOf(() => service.registerForCamp(store(), { actor: member, campId: camp.id }))).toBe(
      'not_found'
    );
  });

  it('puts the viewer back on the list when they cancel', async () => {
    const id = await makeCamp();
    await service.registerForCamp(store(), { actor: member, campId: id });
    const afterCancel = await service.cancelCampRegistration(store(), { actor: member, campId: id });
    expect(afterCancel.isRegisteredByViewer).toBe(false);
    expect(await store().findRegistration(id, MEMBER)).toBeNull();
  });

  it('frees the seat for somebody else', async () => {
    const id = await makeCamp(1);
    await service.registerForCamp(store(), { actor: member, campId: id });
    expect(
      await codeOf(() => service.registerForCamp(store(), { actor: otherDoctor, campId: id }))
    ).toBe('conflict');
    await service.cancelCampRegistration(store(), { actor: member, campId: id });
    const taken = await service.registerForCamp(store(), { actor: otherDoctor, campId: id });
    expect(taken.isRegisteredByViewer).toBe(true);
  });

  it('answers conflict on a second registration, not a second seat', async () => {
    const id = await makeCamp(5);
    await service.registerForCamp(store(), { actor: member, campId: id });
    expect(
      await codeOf(() => service.registerForCamp(store(), { actor: member, campId: id }))
    ).toBe('conflict');
  });

  it('does not let one person cancel a registration they do not hold', async () => {
    const id = await makeCamp(5);
    await service.registerForCamp(store(), { actor: member, campId: id });
    expect(
      await codeOf(() => service.cancelCampRegistration(store(), { actor: otherDoctor, campId: id }))
    ).toBe('not_found');
    expect(await store().findRegistration(id, MEMBER)).not.toBeNull();
  });

  it('keeps a finished camp from being reopened', async () => {
    const id = await makeCamp();
    await service.changeCampStatus(store(), { actor: asha, campId: id, status: 'COMPLETED' });
    expect(
      await codeOf(() =>
        service.changeCampStatus(store(), { actor: asha, campId: id, status: 'PUBLISHED' })
      )
    ).toBe('conflict');
  });

  it('stops one worker cancelling another worker camp', async () => {
    const id = await makeCamp();
    expect(
      await codeOf(() =>
        service.changeCampStatus(store(), { actor: otherAsha, campId: id, status: 'CANCELLED' })
      )
    ).toBe('not_found');
  });

  it('records attendance for a person who registered', async () => {
    const id = await makeCamp();
    await service.registerForCamp(store(), { actor: member, campId: id });
    const registration = await store().findRegistration(id, MEMBER);
    expect(registration).not.toBeNull();
    const marked = await service.markCampAttendance(store(), {
      actor: asha,
      campId: id,
      registrationId: registration!.id,
      input: { status: 'ATTENDED' },
    });
    expect(marked.attendanceStatus).toBe('ATTENDED');
  });

  it('will not mark somebody who never registered as present', async () => {
    const id = await makeCamp();
    // The attendance is a claim about a person, and a claim about somebody who was
    // never on the list is a claim about a visit that did not happen.
    expect(
      await codeOf(() =>
        service.markCampAttendance(store(), {
          actor: asha,
          campId: id,
          registrationId: otherMemberId,
          input: { status: 'ATTENDED' },
        })
      )
    ).toBe('not_found');
  });

  it('will not use one camp roster to mark somebody at another', async () => {
    const first = await makeCamp();
    const second = await makeCamp();
    await service.registerForCamp(store(), { actor: member, campId: first });
    const registration = await store().findRegistration(first, MEMBER);

    // A registration id is printed on a roster. It is not a secret, so it must not be
    // usable against a camp the person never signed up for.
    expect(
      await codeOf(() =>
        service.markCampAttendance(store(), {
          actor: asha,
          campId: second,
          registrationId: registration!.id,
          input: { status: 'ATTENDED' },
        })
      )
    ).toBe('not_found');
  });

  it('will not let another worker mark attendance on a camp they do not run', async () => {
    const id = await makeCamp();
    await service.registerForCamp(store(), { actor: member, campId: id });
    const registration = await store().findRegistration(id, MEMBER);
    expect(
      await codeOf(() =>
        service.markCampAttendance(store(), {
          actor: otherAsha,
          campId: id,
          registrationId: registration!.id,
          input: { status: 'ATTENDED' },
        })
      )
    ).toBe('not_found');
  });
});

describe('audit', () => {
  it('records only vocabulary the database will accept', async () => {
    // A lowercase `entity.verb` action would be refused by `assertAuditVocabulary`, so
    // every workflow above would have failed at its audit call, after the write.
    const known = new Set<string>([...AUDIT_ACTIONS, ...AUDIT_ENTITIES]);
    for (const entry of setup.auditLog) {
      expect(known.has(entry.action), `action ${entry.action}`).toBe(true);
      expect(known.has(entry.entity), `entity ${entry.entity}`).toBe(true);
    }
    expect(setup.auditLog.length).toBeGreaterThan(0);
  });

  it('keeps clinical prose out of the trail', async () => {
    await service.createCase(store(), {
      actor: asha,
      input: {
        householdId,
        memberId,
        summary: 'Fever with a bad headache for a week',
        priority: 'ROUTINE',
      },
    });
    // The trail is read by more people than the record and is exported for review. A
    // summary copied into it is a second, weaker copy of the record.
    expect(JSON.stringify(setup.auditLog)).not.toContain('bad headache');
  });

  it('records a read as well as a write', async () => {
    // "Who changed this" is answered by write actions alone. "Who looked at this" is
    // not, and for a case record that is the question an investigation starts with.
    await referToDoctor();
    await service.getCaseReview(store(), { actor: doctor, caseId });
    const actions = setup.auditLog.map((entry) => entry.action);
    expect(actions).toContain('CASE_READ');
  });
});

describe('the whole path, once', () => {
  it('carries a person from a household to a prescription and a settled follow-up', async () => {
    const observation = await service.createObservation(store(), {
      actor: asha,
      caseId,
      input: {
        observedOn: '2030-01-02',
        reportedSymptoms: ['fever', 'headache'],
        severity: 'MODERATE',
        durationDays: 5,
      },
    });
    expect(observation.caseId).toBe(caseId);

    const referralId = await referToDoctor();
    const note = await service.createClinicalNote(store(), {
      actor: doctor,
      caseId,
      input: {
        assessment: 'Viral fever, no signs of sepsis',
        observations: 'Alert and oriented',
        advice: 'Rest and fluids',
      },
    });
    const prescription = await service.createPrescription(store(), {
      actor: doctor,
      caseId,
      input: {
        clinicalNoteId: note.id,
        medicineName: 'Paracetamol',
        dosage: '500mg',
        frequency: 'Twice daily',
        duration: '3 days',
      },
    });
    const followUp = await service.createFollowUp(store(), {
      actor: doctor,
      caseId,
      input: { assignedRole: 'ASHA', dueDate: '2030-01-09', notes: 'Check the fever has broken' },
    });
    const settled = await service.settleFollowUp(store(), {
      actor: asha,
      followUpId: followUp.id,
      action: 'complete',
    });

    const review = await service.getCaseReview(store(), { actor: doctor, caseId });
    expect(review.member.id).toBe(memberId);
    expect(review.observations).toHaveLength(1);
    expect(review.prescriptions.map((row) => row.id)).toContain(prescription.id);
    expect(review.referrals.map((row) => row.id)).toContain(referralId);
    expect(settled.completedAt).toBeTruthy();
  });

  it('counts a worker open work on their dashboard', async () => {
    // A referred case is still open work, and this is the count that used to say
    // otherwise: it spelled "open" out inline and left REFERRED out of it.
    const before = await service.getAshaDashboard(store(), { actor: asha });
    expect(before.openCases).toBe(1);
    expect(before.assignedHouseholds).toBe(1);
    expect(before.householdMembers).toBe(2);

    await service.createReferral(store(), {
      actor: asha,
      caseId,
      input: { doctorId: DOCTOR, reason: 'Fever for five days' },
    });
    const waiting = await service.getAshaDashboard(store(), { actor: asha });
    expect(waiting.pendingReferrals).toBe(1);
    expect(waiting.openCases).toBe(1);
  });
});
