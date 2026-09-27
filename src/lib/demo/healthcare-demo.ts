import {
  createInMemoryHealthcareFixture,
  type HealthcareStore,
  type InMemoryHealthcareFixture,
} from '@/lib/healthcare/store';
import type { HealthcareActor } from '@/lib/healthcare/session';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Centralized Demo Fallback Infrastructure for Healthcare Portals.
 *
 * When Supabase environment variables are missing in local dev/demo mode,
 * this module seeds realistic, domain-accurate healthcare records into the
 * standard in-memory HealthcareStore adapter and provides demo actors for
 * ASHA workers, Clinicians/Doctors, and Members.
 */

export const DEMO_ASHA_USER_ID = 'asha-demo-user-id';
export const DEMO_DOCTOR_USER_ID = 'doctor-demo-user-id';
export const DEMO_MEMBER_USER_ID = 'member-demo-user-id';

let cachedFixture: InMemoryHealthcareFixture | null = null;
let seedPromise: Promise<void> | null = null;
let hydrationPromise: Promise<void> | null = null;

export interface DemoRegistrationRecord {
  householdName: string;
  addressLine: string | null;
  fullName: string;
  ageYears: number | null;
  note: string | null;
  summary: string;
  priority: 'ROUTINE' | 'URGENT';
  observedOn: string;
  reportedSymptoms: string[];
  durationDays: number | null;
  observationNotes: string | null;
  referralReason: string;
}

const demoRegistrationFile = join(tmpdir(), 'pmsify-healthcare-demo', 'registrations.json');
const demoAcceptanceFile = join(tmpdir(), 'pmsify-healthcare-demo', 'referral-acceptances.json');

async function readDemoRegistrations(): Promise<DemoRegistrationRecord[]> {
  try {
    return JSON.parse(await readFile(demoRegistrationFile, 'utf8')) as DemoRegistrationRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export async function persistDemoRegistration(record: DemoRegistrationRecord): Promise<void> {
  // Production demo fallback is not durable storage. In local development the
  // shared temp directory lets separate Next.js processes rebuild the same demo data.
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') return;
  await mkdir(join(tmpdir(), 'pmsify-healthcare-demo'), { recursive: true });
  const records = await readDemoRegistrations();
  records.push(record);
  const temporaryFile = `${demoRegistrationFile}.${process.pid}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(records), 'utf8');
  await rename(temporaryFile, demoRegistrationFile);
}

export async function persistDemoReferralAcceptance(
  referralId: string,
  acceptedAt: string
): Promise<void> {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') return;
  await mkdir(join(tmpdir(), 'pmsify-healthcare-demo'), { recursive: true });
  let acceptances: Record<string, string> = {};
  try {
    acceptances = JSON.parse(await readFile(demoAcceptanceFile, 'utf8')) as Record<string, string>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  acceptances[referralId] = acceptedAt;
  const temporaryFile = `${demoAcceptanceFile}.${process.pid}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(acceptances), 'utf8');
  await rename(temporaryFile, demoAcceptanceFile);
}

export function getDemoHealthcareFixture(): InMemoryHealthcareFixture {
  if (cachedFixture) return cachedFixture;

  const fixture = createInMemoryHealthcareFixture();
  const { store, seedProfile } = fixture;

  // 1. Seed Accounts & Profiles
  seedProfile(DEMO_ASHA_USER_ID, 'ASHA');
  seedProfile(DEMO_DOCTOR_USER_ID, 'DOCTOR');
  seedProfile(DEMO_MEMBER_USER_ID, 'USER');

  // Synchronous initialization helper
  seedPromise = (async () => {
    await store.createAshaProfile({
      userId: DEMO_ASHA_USER_ID,
      fullName: 'Sunita Devi (ASHA Worker)',
      registrationNumber: 'ASHA-KA-2024-8841',
      area: 'Sector 4, Bengaluru South',
    });

    await store.createDoctorProfile({
      userId: DEMO_DOCTOR_USER_ID,
      fullName: 'Dr. Ananya Rao, MD',
      registrationNumber: 'KMC-2018-49201',
      speciality: 'Obstetrics & Gynecology',
    });

    // 2. Seed Households & Members
    const hh1 = await store.createHousehold(DEMO_ASHA_USER_ID, {
      name: 'Sharma Household',
      addressLine: 'House #42, Main Road, Sector 4',
    });
    const m1 = await store.createMember(hh1.id, {
      fullName: 'Pooja Sharma',
      ageYears: 26,
      sex: 'FEMALE',
      relationToHead: 'Head',
      note: 'Monitors menstrual cycle regularly.',
    });
    await store.createMember(hh1.id, {
      fullName: 'Ritu Sharma',
      ageYears: 19,
      sex: 'FEMALE',
      relationToHead: 'Sister',
      note: 'Needs iron supplement guidance.',
    });

    const hh2 = await store.createHousehold(DEMO_ASHA_USER_ID, {
      name: 'Devi Household',
      addressLine: 'House #89, Cross Street, Sector 4',
    });
    const m3 = await store.createMember(hh2.id, {
      fullName: 'Kamla Devi',
      ageYears: 34,
      sex: 'FEMALE',
      relationToHead: 'Head',
      note: 'History of irregular cycles.',
    });

    const hh3 = await store.createHousehold(DEMO_ASHA_USER_ID, {
      name: 'Patel Household',
      addressLine: 'House #104, Garden Colony, Sector 4',
    });
    await store.createMember(hh3.id, {
      fullName: 'Aarti Patel',
      ageYears: 22,
      sex: 'FEMALE',
      relationToHead: 'Daughter',
      note: 'Student, tracking sleep and hydration.',
    });

    // 3. Seed Cases & Observations
    const case1 = await store.createCase({
      householdId: hh1.id,
      householdMemberId: m1.id,
      createdByAshaId: DEMO_ASHA_USER_ID,
      summary: 'Severe dysmenorrhea with heavy menstrual flow',
      priority: 'URGENT',
      source: 'ASHA',
      campId: null,
    });

    await store.createObservation({
      caseId: case1.id,
      householdMemberId: m1.id,
      recordedByAshaId: DEMO_ASHA_USER_ID,
      observedOn: new Date().toISOString().slice(0, 10),
      reportedSymptoms: ['cramps', 'fatigue', 'heavy_flow'],
      severity: 'MODERATE',
      durationDays: 4,
      notes: 'Patient reports cramping requiring bed rest on day 1-2.',
      referralReason: null,
    });

    const case2 = await store.createCase({
      householdId: hh2.id,
      householdMemberId: m3.id,
      createdByAshaId: DEMO_ASHA_USER_ID,
      summary: 'Chronic pelvic discomfort and irregular menstrual cycles (PCOS suspected)',
      priority: 'URGENT',
      source: 'ASHA',
      campId: null,
    });

    await store.createObservation({
      caseId: case2.id,
      householdMemberId: m3.id,
      recordedByAshaId: DEMO_ASHA_USER_ID,
      observedOn: new Date().toISOString().slice(0, 10),
      reportedSymptoms: ['pelvic_pain', 'irregular_cycles', 'bloating'],
      severity: 'SEVERE',
      durationDays: 14,
      notes: 'ASHA screening notes high symptom impact. Specialist ultrasound recommended.',
      referralReason: 'Specialist gynecological evaluation for suspected PCOS.',
    });

    // 4. Seed Referrals
    await store.createReferral({
      caseId: case2.id,
      referredByAshaId: DEMO_ASHA_USER_ID,
      referredToDoctorId: DEMO_DOCTOR_USER_ID,
      reason: 'Specialist evaluation for chronic pelvic discomfort and cycle irregularities.',
      priority: 'URGENT',
      campId: null,
    });

    // 5. Seed Follow-ups
    const tomorrowIso = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const in3DaysIso = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);

    await store.createFollowUp({
      caseId: case1.id,
      assignedToUserId: DEMO_ASHA_USER_ID,
      assignedRole: 'ASHA',
      dueDate: tomorrowIso,
      notes: 'Check symptom improvement after rest and iron supplementation.',
    });

    await store.createFollowUp({
      caseId: case2.id,
      assignedToUserId: DEMO_DOCTOR_USER_ID,
      assignedRole: 'DOCTOR',
      dueDate: in3DaysIso,
      notes: 'Review clinical notes and ultrasound report.',
    });

    // 6. Seed Health Camps
    const camp1Date = new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10);
    const camp2Date = new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10);

    const camp1 = await store.createCamp({
      title: 'Anemia & Women’s Health Screening Camp',
      description: 'Comprehensive blood test, Hb screening, nutrition counselling, and free iron supplements.',
      campDate: camp1Date,
      startTime: '09:00',
      endTime: '14:00',
      location: 'Community Health Centre, Sector 4, Bengaluru',
      capacity: 50,
      organizerUserId: DEMO_ASHA_USER_ID,
    });
    await store.updateCamp(camp1.id, { status: 'PUBLISHED' });

    const camp2 = await store.createCamp({
      title: 'PCOS Awareness & Gynecological Screening Drive',
      description: 'Specialist consultation with Dr. Ananya Rao, pelvic health education, and symptom screening.',
      campDate: camp2Date,
      startTime: '10:00',
      endTime: '16:00',
      location: 'Government High School Auditorium, Sector 4',
      capacity: 40,
      organizerUserId: DEMO_DOCTOR_USER_ID,
    });
    await store.updateCamp(camp2.id, { status: 'PUBLISHED' });

    // Seed sample camp registration
    await store.registerForCamp(camp1.id, DEMO_MEMBER_USER_ID);
  })();

  cachedFixture = fixture;
  return fixture;
}

import type { HealthcareRole } from '@/types/healthcare';

export async function getDemoHealthcareStore(): Promise<HealthcareStore> {
  const fixture = getDemoHealthcareFixture();
  await seedPromise;
  if (!hydrationPromise) {
    hydrationPromise = (async () => {
      const records = await readDemoRegistrations();
      let acceptances: Record<string, string> = {};
      try {
        acceptances = JSON.parse(await readFile(demoAcceptanceFile, 'utf8')) as Record<string, string>;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      for (const record of records) {
        let household = (await fixture.store.listHouseholds(DEMO_ASHA_USER_ID)).find(
          (row) => row.name.toLowerCase() === record.householdName.toLowerCase()
        );
        if (!household) {
          household = await fixture.store.createHousehold(DEMO_ASHA_USER_ID, {
            name: record.householdName,
            addressLine: record.addressLine,
          });
        }
        const member = await fixture.store.createMember(household.id, {
          fullName: record.fullName,
          ageYears: record.ageYears,
          sex: 'FEMALE',
          relationToHead: 'Member',
          note: record.note,
        });
        const caseRecord = await fixture.store.createCase({
          householdId: household.id,
          householdMemberId: member.id,
          createdByAshaId: DEMO_ASHA_USER_ID,
          summary: record.summary,
          priority: record.priority,
          source: 'ASHA',
          campId: null,
        });
        await fixture.store.createObservation({
          caseId: caseRecord.id,
          householdMemberId: member.id,
          recordedByAshaId: DEMO_ASHA_USER_ID,
          observedOn: record.observedOn,
          reportedSymptoms: record.reportedSymptoms,
          severity: record.priority === 'URGENT' ? 'SEVERE' : 'MODERATE',
          durationDays: record.durationDays,
          notes: record.observationNotes,
          referralReason: record.referralReason,
        });
        const referral = await fixture.store.createReferral({
          caseId: caseRecord.id,
          referredByAshaId: DEMO_ASHA_USER_ID,
          referredToDoctorId: DEMO_DOCTOR_USER_ID,
          reason: record.referralReason,
          priority: record.priority,
          campId: null,
        });
        const acceptedAt = acceptances[referral.id];
        if (acceptedAt) {
          await fixture.store.updateReferral(referral.id, { status: 'ACCEPTED', accepted_at: acceptedAt });
          await fixture.store.updateCase(caseRecord.id, {
            status: 'REFERRED',
            assigned_doctor_id: DEMO_DOCTOR_USER_ID,
          });
        } else {
          await fixture.store.updateCase(caseRecord.id, { status: 'REFERRED' });
        }
      }
    })();
  }
  await hydrationPromise;
  return fixture.store;
}

export function getDemoActor(role: HealthcareRole | 'MEMBER'): HealthcareActor {
  if (role === 'ASHA') {
    return {
      userId: DEMO_ASHA_USER_ID,
      role: 'ASHA',
      ashaId: DEMO_ASHA_USER_ID,
      doctorId: null,
      ashaProfile: {
        user_id: DEMO_ASHA_USER_ID,
        full_name: 'Sunita Devi (ASHA Worker)',
        registration_number: 'ASHA-KA-2024-8841',
        area: 'Sector 4, Bengaluru South',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      doctorProfile: null,
    };
  }
  if (role === 'DOCTOR') {
    return {
      userId: DEMO_DOCTOR_USER_ID,
      role: 'DOCTOR',
      ashaId: null,
      doctorId: DEMO_DOCTOR_USER_ID,
      ashaProfile: null,
      doctorProfile: {
        user_id: DEMO_DOCTOR_USER_ID,
        full_name: 'Dr. Ananya Rao, MD',
        registration_number: 'KMC-2018-49201',
        speciality: 'Obstetrics & Gynecology',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };
  }
  if (role === 'ADMIN') {
    return {
      userId: DEMO_DOCTOR_USER_ID,
      role: 'ADMIN',
      ashaId: null,
      doctorId: null,
      ashaProfile: null,
      doctorProfile: null,
    };
  }
  return {
    userId: DEMO_MEMBER_USER_ID,
    role: 'USER',
    ashaId: null,
    doctorId: null,
    ashaProfile: null,
    doctorProfile: null,
  };
}
