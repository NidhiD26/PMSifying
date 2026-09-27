import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createInMemoryHealthcareFixture, type InMemoryHealthcareFixture } from '@/lib/healthcare/store';
import { resolveHealthcareActor, type HealthcareActor } from '@/lib/healthcare/session';
import { AUDITABLE_METADATA_KEYS } from '@/lib/healthcare/audit';
import * as service from '@/lib/healthcare/service';
import { locales, defaultLocale } from '@/i18n/config';

/**
 * The boundary between two worlds that must never touch.
 *
 * PMSify holds three separate systems:
 *
 *   World A  personal cycle and daily-health tracking, in Dexie, on the device,
 *            owned by one person and never transmitted;
 *   World B  SecretChat, anonymous community posts in Postgres;
 *   World C  healthcare, role-scoped clinical records in Postgres.
 *
 * World A and World C are both health data and both use the word "symptom", which is
 * exactly why the separation cannot be a naming convention. A cycle tracker that
 * started reading `health_cases` would be a privacy incident that no test would
 * catch, because the data involved is *about* health. So this file asserts the
 * separation three ways: the vocabulary the healthcare types are allowed to declare,
 * the modules the healthcare feature is allowed to import, and the exact field sets
 * the objects on the wire are allowed to have.
 *
 * THE BUG THIS FILE EXISTS BECAUSE OF
 * `listMembers` once answered a doctor with the entire household register as soon as
 * the doctor had one case in the house. A household is six people; the doctor was
 * referred one of them, for one condition, and received the other five people's ages,
 * sexes and relation to the head of the house. `healthcare-service.test.ts` pins the
 * behaviour. This file pins the *reason* it cannot come back: the unit of access is
 * the member, and no DTO is shaped to carry a household to a clinician.
 */

const MEMBER = '11111111-1111-4111-8111-111111111111';
const ASHA = '22222222-2222-4222-8222-222222222222';
const DOCTOR = '44444444-4444-4444-8444-444444444444';

/**
 * Vocabulary that belongs to World A and has no business in World C.
 *
 * `symptom` is deliberately absent: an observation records the symptoms a health
 * worker was told, which is legitimate, and World A's own `symptom` vocabulary is
 * checked from the other side in `secretchat-privacy.test.ts`. The words here are the
 * ones where a leak would be unambiguous.
 */
const WORLD_A_TERMS = [
  'pinHash',
  'pinSalt',
  'cycle',
  'menstrual',
  'menstruation',
  'ovulation',
  'fertile',
  'basal',
  'bbt',
  'cervical',
  'mood',
  'sleep',
  'hydration',
  'waterIntake',
  'pain',
  'flow',
  'spotting',
  'temperature',
  'insight',
  'journal',
  'dexie',
];

/* ------------------------------------------------------------------ *
 * The vocabulary of the types                                        *
 * ------------------------------------------------------------------ */

describe('World A vocabulary is absent from the healthcare types', () => {
  /**
   * Only the healthcare type files. `src/types/health.ts` is World A's own
   * vocabulary and is supposed to be full of these words.
   */
  const HEALTHCARE_TYPE_FILES = ['src/types/healthcare.ts', 'src/types/healthcare-db.ts'];

  /**
   * The property names actually declared in a file, via the compiler.
   *
   * Scanning the raw text for a word does not work here, and fails in a way that
   * looks like a security check passing: the healthcare types document in a comment
   * that no cycle field is carried, and that sentence is itself a match. The compiler
   * sees declarations and not prose, so a comment can neither trigger this nor hide a
   * real column.
   */
  function declaredPropertyNames(file: string): string[] {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true
    );

    const names: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)) {
        const name = node.name;
        if (name && ts.isIdentifier(name)) names.push(name.text);
        else if (name && ts.isStringLiteral(name)) names.push(name.text);
      }
      if (ts.isTypeLiteralNode(node) || ts.isInterfaceDeclaration(node)) {
        for (const member of node.members) visit(member);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);

    return names;
  }

  it('declares no personal-tracking field in either healthcare type file', () => {
    const offenders: string[] = [];

    for (const file of HEALTHCARE_TYPE_FILES) {
      for (const name of declaredPropertyNames(file)) {
        const lowered = name.toLowerCase();
        for (const term of WORLD_A_TERMS) {
          if (lowered.includes(term.toLowerCase())) offenders.push(`${file}: ${name}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('names the reason, so the absence reads as deliberate', () => {
    // Not a substitute for the check above, but worth pinning: `supabase-database.ts`
    // already points a reader here, and this is the sentence that explains why the
    // healthcare tables are not declared alongside the SecretChat ones.
    const source = readFileSync('src/types/supabase-database.ts', 'utf8');
    expect(source).toMatch(/healthcare-privacy\.test\.ts/);
  });
});

describe('the healthcare feature never reaches the on-device store', () => {
  /**
   * Comments are removed before anything is scanned for.
   *
   * Both files below *document* the guarantee, and the sentence doing it names the
   * thing it promises not to use: `healthcare.ts` says personal tracking lives in
   * IndexedDB on the reader's own device. Scanning the raw text would fail on the
   * documentation of the rule, which is how a check like this quietly stops being
   * run.
   */
  function stripComments(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      // `//` not preceded by `:` so a URL in a string is not read as a comment.
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  }

  function healthcareSourceFiles(): string[] {
    const roots = [
      'src/lib/healthcare',
      'src/types/healthcare.ts',
      'src/types/healthcare-db.ts',
      'src/app/api/healthcare',
    ];
    const files: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
      }
    };

    for (const root of roots) {
      // A root may be a single file (`healthcare.ts`) or a directory (`lib/healthcare`).
      if (!existsSync(root)) continue;
      if (statSync(root).isDirectory()) walk(root);
      else if (/\.(ts|tsx)$/.test(root)) files.push(root);
    }

    return files.map((file) => file.split(path.sep).join('/'));
  }

  it('imports no Dexie database or repository, not even read-only', () => {
    // The separation has to be structural rather than a matter of discipline: a
    // read-only import is one careless refactor away from a write.
    const offenders: string[] = [];
    for (const file of healthcareSourceFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      if (/@\/(lib|features)\/(db|dexie-db|repositories|storage|cycle-engine|analytics|insights)/.test(source)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('names no browser storage anywhere in the feature', () => {
    // A copy of a clinical record on the reader's disk would survive a sign-out and
    // would not be described by the privacy page, which describes this device as the
    // place personal tracking lives and nowhere else.
    const offenders: string[] = [];
    for (const file of healthcareSourceFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      if (/\b(localStorage|sessionStorage|indexedDB|Dexie)\b/.test(source)) offenders.push(file);
    }

    expect(offenders).toEqual([]);
  });

  it('actually looked at the files', () => {
    // A scan whose file list came back empty would pass every assertion above, so the
    // list is asserted to be non-trivial. This is the failure mode a privacy check
    // cannot otherwise detect.
    const files = healthcareSourceFiles();
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((f) => f.startsWith('src/lib/healthcare/'))).toBe(true);
    expect(files.some((f) => f.startsWith('src/app/api/healthcare/'))).toBe(true);
    expect(files).toContain('src/types/healthcare.ts');
  });
});

/* ------------------------------------------------------------------ *
 * The shape of what leaves the server                                *
 * ------------------------------------------------------------------ */

describe('a DTO carries only what the workflow needs', () => {
  let setup: InMemoryHealthcareFixture;
  let asha: HealthcareActor;
  let doctor: HealthcareActor;
  let member: HealthcareActor;
  let householdId: string;
  let memberId: string;
  let otherMemberId: string;
  let caseId: string;

  const store = () => setup.store;

  beforeEach(async () => {
    setup = createInMemoryHealthcareFixture();
    setup.seedProfile(MEMBER);
    void setup.store.createAshaProfile({
      userId: ASHA,
      fullName: 'Asha Worker',
      registrationNumber: 'ASHA-1',
      area: 'Block 1',
    });
    void setup.store.createDoctorProfile({
      userId: DOCTOR,
      fullName: 'Doctor One',
      registrationNumber: 'MBBS-1',
      speciality: 'General',
    });

    [asha, doctor, member] = await Promise.all([
      resolveHealthcareActor(ASHA, store()),
      resolveHealthcareActor(DOCTOR, store()),
      resolveHealthcareActor(MEMBER, store()),
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
    const second = await service.createMember(store(), {
      actor: asha,
      householdId,
      input: { fullName: 'Ravi Sharma', ageYears: 8, sex: 'MALE', relationToHead: 'Son' },
    });
    otherMemberId = second.id;

    const created = await service.createCase(store(), {
      actor: asha,
      input: { householdId, memberId, summary: 'Persistent fever for five days', priority: 'URGENT' },
    });
    caseId = created.id;
  });

  /** The exact field set, so a field added to a DTO is a failing test rather than a surprise. */
  const keysOf = (value: object): string[] => Object.keys(value).sort();

  it('gives a member register entry the register fields and nothing else', async () => {
    const dto = (await service.listMembers(store(), { actor: asha, householdId })).find(
      (row) => row.id === memberId
    );

    expect(dto).toBeDefined();
    expect(keysOf(dto as object)).toEqual([
      'ageYears',
      'fullName',
      'householdId',
      'id',
      'note',
      'relationToHead',
      'sex',
    ]);
  });

  it('carries no account id on a household or a case', async () => {
    // Nothing here identifies a PMSify *account* to a third party: a household is a
    // register entry and a case is a clinical record, and both are keyed by their own
    // id rather than by the member's user id.
    const household = await service.getHouseholdDetail(store(), { actor: asha, householdId });
    const cases = await service.listCases(store(), { actor: asha, query: {} });

    expect(JSON.stringify(household)).not.toContain(MEMBER);
    expect(keysOf(household.household)).toEqual([
      'addressLine',
      'code',
      'id',
      'memberCount',
      'name',
      'openCaseCount',
    ]);
    for (const row of cases) {
      expect(keysOf(row)).toEqual([
        'caseNumber',
        'householdCode',
        'householdId',
        'id',
        'memberId',
        'memberName',
        'openedAt',
        'priority',
        'source',
        'status',
        'summary',
        'updatedAt',
      ]);
    }
  });

  it('gives a doctor one member, never a household register', async () => {
    const referral = await service.createReferral(store(), {
      actor: asha,
      caseId,
      input: { doctorId: DOCTOR, reason: 'Fever for five days, not settling' },
    });
    await service.acceptReferral(store(), { actor: doctor, referralId: referral.id });

    const review = await service.getCaseReview(store(), { actor: doctor, caseId });

    // The single most important assertion in this file. The DTO has no household
    // field at all: a case review is a person, so there is nothing for the UI to
    // reach the rest of the family through, even by accident.
    expect(keysOf(review)).toEqual([
      'ashaName',
      'case',
      'clinicalNotes',
      'followUps',
      'householdCode',
      'member',
      'observations',
      'prescriptions',
      'referrals',
    ]);
    expect(review.member.id).toBe(memberId);
    expect(JSON.stringify(review)).not.toContain(otherMemberId);
    expect(JSON.stringify(review)).not.toContain('Ravi Sharma');
  });

  it('still shows the whole household to the worker who covers it', async () => {
    // The doctor rule is about the unit of access, not a blanket narrowing. An ASHA
    // who owns the patch is entitled to the register; without this the fix would look
    // like a restriction on legitimate work rather than a privacy boundary.
    const detail = await service.getHouseholdDetail(store(), { actor: asha, householdId });

    expect(detail.members.map((m) => m.id).sort()).toEqual([memberId, otherMemberId].sort());
  });

  it('refuses a doctor the household, so the register cannot be walked', async () => {
    let code = '';
    try {
      await service.getHouseholdDetail(store(), { actor: doctor, householdId });
    } catch (error) {
      code = (error as { code: string }).code;
    }

    // `not_found` and not `forbidden`: 403 would confirm the household exists, which is
    // a disclosure to somebody with no patch and no case here.
    expect(code).toBe('not_found');
  });

  it('gives the doctor roster an id and no account metadata', async () => {
    // The roster grew one field in Sprint 3, because a referral is addressed to a
    // doctor and the id had nowhere to come from. The exact field set is pinned here for
    // the same reason the case-review set is: an added field is a failing test, so
    // "we needed one more id" cannot quietly become "we needed one more thing too".
    const roster = await service.listDoctors(store(), { actor: asha });

    for (const row of roster) {
      expect(keysOf(row)).toEqual(['fullName', 'id', 'registrationNumber', 'speciality']);
      // A professional record, not an account: nothing here is the person behind it.
      expect(JSON.stringify(row)).not.toContain('suspended');
      expect(JSON.stringify(row)).not.toContain('updated_at');
    }
  });

  it('keeps the doctor roster away from a member, who has no referral to file', async () => {
    let code = '';
    try {
      await service.listDoctors(store(), { actor: member });
    } catch (error) {
      code = (error as { code: string }).code;
    }
    expect(code).toBe('forbidden');
  });

  it('keeps a camp roster to attendance facts, with no health record anywhere in it', async () => {
    // The roster read was added for Sprint 3 and is the newest place a camp could leak
    // somebody's health. It is asserted field by field rather than by keyword, so a new
    // field has to be added here deliberately.
    const camp = await service.createCamp(store(), {
      actor: asha,
      input: {
        title: 'Village health camp',
        description: null,
        campDate: '2030-03-01',
        startTime: '09:00',
        endTime: '13:00',
        location: 'Community hall',
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
    expect(roster).toHaveLength(1);
    for (const row of roster) {
      expect(keysOf(row)).toEqual([
        'attendanceStatus',
        'markedAt',
        'registeredAt',
        'registrationId',
        'userId',
      ]);
    }

    const wire = JSON.stringify(roster);
    // The household, the case, and the clinical record of anybody at all.
    for (const forbidden of [
      'householdId',
      'householdCode',
      'memberId',
      'caseId',
      'caseNumber',
      'fullName',
      'ageYears',
      'relationToHead',
      'reportedSymptoms',
      'reason',
      'assessment',
      'medicineName',
      // World A, which has no query path into this database at all
      'cycle',
      'mood',
      'sleep',
      'hydration',
      'pain',
      'pin',
      // who stood at the table: the append-only trail is where that belongs
      'markedByUserId',
    ]) {
      expect(wire, `camp roster must not mention "${forbidden}"`).not.toContain(forbidden);
    }
    // And it does not carry the identifiers of the people who are *not* on the roster.
    expect(wire).not.toContain(otherMemberId);
  });

  it('gives the roster to the organiser, and to nobody else this file has', async () => {
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

    // The organiser gets it.
    const own = await service.listCampRegistrations(store(), { actor: asha, campId: camp.id });
    expect(own).toHaveLength(1);

    // A registered member still does not: knowing who else is coming is not a
    // consequence of having a seat. A doctor does not either, even though a doctor is
    // staff and is on the referral roster — the camp roster is a different capability.
    // (The other-worker and administrator cases are in `healthcare-gaps.test.ts`, which
    // has a second worker to check against.)
    for (const actor of [member, doctor]) {
      let code = '';
      try {
        await service.listCampRegistrations(store(), { actor, campId: camp.id });
      } catch (error) {
        code = (error as { code: string }).code;
      }
      expect(['forbidden', 'not_found']).toContain(code);
    }
  });

  it('refuses a plain member every staff list', async () => {
    // `listFollowUps` is deliberately absent: it is not a staff surface, it is the
    // caller's own reminders, and it is asserted separately below.
    const failures = await Promise.all([
      service.listHouseholds(store(), { actor: member }).catch((e: { code: string }) => e.code),
      service.listCases(store(), { actor: member, query: {} }).catch((e: { code: string }) => e.code),
      service.listReferrals(store(), { actor: member, query: {} }).catch((e: { code: string }) => e.code),
      service.getAshaDashboard(store(), { actor: member }).catch((e: { code: string }) => e.code),
      service.getDoctorDashboard(store(), { actor: member }).catch((e: { code: string }) => e.code),
      service.listDoctors(store(), { actor: member }).catch((e: { code: string }) => e.code),
    ]);

    expect(failures).toEqual(Array<string>(6).fill('forbidden'));
  });

  it('shows a member only their own follow-ups, which is none here', async () => {
    // The one list a member may read is scoped to their own account id, so it cannot
    // be a route onto somebody else's care.
    const referral = await service.createReferral(store(), {
      actor: asha,
      caseId,
      input: { doctorId: DOCTOR, reason: 'Fever for five days, not settling' },
    });
    await service.acceptReferral(store(), { actor: doctor, referralId: referral.id });
    await service.createFollowUp(store(), {
      actor: doctor,
      caseId,
      input: { assignedRole: 'ASHA', dueDate: '2030-02-01', notes: 'Check on recovery' },
    });

    expect(await service.listFollowUps(store(), { actor: member, query: {} })).toEqual([]);
    expect(await service.listFollowUps(store(), { actor: asha, query: {} })).toHaveLength(1);
  });

  it('leaves the camp referral count off the wire for a member', async () => {
    const staff = await service.listCamps(store(), { actor: asha, query: {} });
    const plain = await service.listCamps(store(), { actor: member, query: {} });

    for (const camp of staff) {
      // How many cases came out of a camp is an operational fact about a camp, and it
      // is only operational to somebody who runs camps.
      expect(camp.referredCaseCount).toBeTypeOf('number');
    }
    for (const camp of plain) {
      expect('referredCaseCount' in camp).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ *
 * The audit trail                                                    *
 * ------------------------------------------------------------------ */

describe('an audit row says that, not what', () => {
  let setup: InMemoryHealthcareFixture;
  let asha: HealthcareActor;
  let doctor: HealthcareActor;
  let caseId: string;

  const store = () => setup.store;

  beforeEach(async () => {
    setup = createInMemoryHealthcareFixture();
    void setup.store.createAshaProfile({
      userId: ASHA,
      fullName: 'Asha Worker',
      registrationNumber: 'ASHA-1',
      area: 'Block 1',
    });
    void setup.store.createDoctorProfile({
      userId: DOCTOR,
      fullName: 'Doctor One',
      registrationNumber: 'MBBS-1',
      speciality: 'General',
    });
    [asha, doctor] = await Promise.all([
      resolveHealthcareActor(ASHA, store()),
      resolveHealthcareActor(DOCTOR, store()),
    ]);

    const household = await service.createHousehold(store(), {
      actor: asha,
      input: { name: 'Sharma household', addressLine: '12 Field Road' },
    });
    const member = await service.createMember(store(), {
      actor: asha,
      householdId: household.id,
      input: { fullName: 'Kamla Sharma', ageYears: 34, sex: 'FEMALE', relationToHead: 'Head' },
    });
    const created = await service.createCase(store(), {
      actor: asha,
      input: { householdId: household.id, memberId: member.id, summary: 'Persistent fever', priority: 'URGENT' },
    });
    caseId = created.id;
  });

  it('records no clinical prose through an entire clinical workflow', async () => {
    // A trail is read by more roles than the record it describes, so repeating the
    // record in the trail publishes it to everyone who can read an audit.
    const observation = await service.createObservation(store(), {
      actor: asha,
      caseId,
      input: {
        reportedSymptoms: ['fever', 'chills'],
        severity: 'MODERATE',
        observedOn: '2030-01-05',
        notes: 'Reported by family',
      },
    });
    const referral = await service.createReferral(store(), {
      actor: asha,
      caseId,
      input: { doctorId: DOCTOR, reason: 'Fever for five days, not settling' },
    });
    await service.acceptReferral(store(), { actor: doctor, referralId: referral.id });
    await service.createClinicalNote(store(), {
      actor: doctor,
      caseId,
      input: { assessment: 'Viral fever', advice: 'Rest and fluids', followUpOn: '2030-01-10' },
    });
    await service.createPrescription(store(), {
      actor: doctor,
      caseId,
      input: { medicineName: 'Paracetamol', dosage: '500mg', frequency: 'Twice daily', duration: '3 days' },
    });
    const followUp = await service.createFollowUp(store(), {
      actor: doctor,
      caseId,
      input: { assignedRole: 'ASHA', dueDate: '2030-01-10', notes: 'Check temperature' },
    });
    await service.settleFollowUp(store(), {
      actor: asha,
      followUpId: followUp.id,
      action: 'complete',
    });
    void observation;

    const trail = JSON.stringify(setup.auditLog);
    for (const secret of [
      'Persistent fever',
      'fever',
      'chills',
      'Reported by family',
      'Fever for five days',
      'Viral fever',
      'Rest and fluids',
      'Paracetamol',
      '500mg',
      'Check temperature',
      'Recovering well',
      'Kamla Sharma',
      'Sharma household',
      '12 Field Road',
    ]) {
      expect(trail, `audit trail must not contain "${secret}"`).not.toContain(secret);
    }
  });

  it('uses only allow-listed metadata keys', async () => {
    const referral = await service.createReferral(store(), {
      actor: asha,
      caseId,
      input: { doctorId: DOCTOR, reason: 'Fever for five days, not settling' },
    });
    await service.acceptReferral(store(), { actor: doctor, referralId: referral.id });

    const allowed = new Set<string>(AUDITABLE_METADATA_KEYS);
    for (const event of setup.auditLog) {
      for (const key of Object.keys(event.metadata ?? {})) {
        expect([...allowed], `metadata key "${key}"`).toContain(key);
      }
    }
  });
});

/* ------------------------------------------------------------------ *
 * The translations                                                   *
 * ------------------------------------------------------------------ */

describe('the healthcare translations', () => {
  function messages(locale: string): Record<string, unknown> {
    return JSON.parse(readFileSync(`public/locales/${locale}.json`, 'utf8'));
  }

  function leaves(node: unknown, prefix = ''): [string, string][] {
    if (typeof node === 'string') return [[prefix, node]];
    if (node && typeof node === 'object') {
      return Object.entries(node).flatMap(([key, value]) =>
        leaves(value, prefix ? `${prefix}.${key}` : key)
      );
    }
    return [];
  }

  /**
   * Keyed from the file root, so the paths are the ones next-intl is asked for and a
   * caller can be handed the same key this test used.
   */
  const healthcare = (locale: string) =>
    new Map(leaves(messages(locale)).filter(([key]) => key.startsWith('healthcare.')));

  it('exists in every supported language', () => {
    for (const locale of locales) {
      expect(healthcare(locale).size).toBeGreaterThan(0);
    }
  });

  it('has the same keys in every language', () => {
    const reference = [...healthcare(defaultLocale).keys()].sort();
    for (const locale of locales.filter((l) => l !== defaultLocale)) {
      expect([...healthcare(locale).keys()].sort()).toEqual(reference);
    }
  });

  it('has no blank translation', () => {
    for (const locale of locales) {
      const blanks = [...healthcare(locale)]
        .filter(([, value]) => value.trim() === '')
        .map(([key]) => key);
      expect({ locale, blanks }).toEqual({ locale, blanks: [] });
    }
  });

  /**
   * A truncated multi-byte sequence is written as U+FFFD and renders as a
   * plausible-looking box. A structural diff will not catch it and neither will a
   * reviewer skimming Kannada, so it is asserted directly.
   */
  it('has no replacement characters from a broken write', () => {
    for (const locale of locales) {
      const broken = [...healthcare(locale)]
        .filter(([, value]) => value.includes('\uFFFD'))
        .map(([key]) => key);
      expect({ locale, broken }).toEqual({ locale, broken: [] });
    }
  });

  it('translates every string rather than leaving English in place', () => {
    const allowedIdentical = new Set(['healthcare.badge']);

    for (const locale of locales.filter((l) => l !== defaultLocale)) {
      const english = healthcare(defaultLocale);
      const current = healthcare(locale);
      const untranslated = [...current]
        .filter(([key, value]) => value === english.get(key) && !allowedIdentical.has(key))
        .map(([key]) => key);

      expect({ locale, untranslated }).toEqual({ locale, untranslated: [] });
    }
  });

  it('has a label for every status a record can be in', () => {
    // A status the UI cannot name is a status shown raw, in capitals, in the reader's
    // language. The list is the vocabulary the types declare.
    const statuses = [
      'OPEN', 'REFERRED', 'UNDER_REVIEW', 'FOLLOW_UP', 'CLOSED',
      'PENDING', 'ACCEPTED', 'IN_REVIEW', 'COMPLETED', 'CANCELLED',
      'MISSED', 'DRAFT', 'PUBLISHED', 'REGISTERED', 'ATTENDED', 'ABSENT',
      'ROUTINE', 'URGENT', 'MILD', 'MODERATE', 'SEVERE',
    ];
    for (const locale of locales) {
      const missing = statuses.filter(
        (status) => !healthcare(locale).has(`healthcare.status.${status}`)
      );
      expect({ locale, missing }).toEqual({ locale, missing: [] });
    }
  });

  it('has an error string for every error code the API can return', () => {
    const codes = [
      'invalid_request',
      'unauthenticated',
      'forbidden',
      'not_found',
      'conflict',
      'not_configured',
      'upstream_unavailable',
      'rate_limited',
      'unknown',
    ];
    for (const locale of locales) {
      for (const code of codes) {
        const key = `healthcare.errors.${code}`;
        const value = healthcare(locale).get(key);
        expect({ locale, key, present: typeof value === 'string' && value.length > 0 }).toEqual({
          locale,
          key,
          present: true,
        });
      }
    }
  });
});
