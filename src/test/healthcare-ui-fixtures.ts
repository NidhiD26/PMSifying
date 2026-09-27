import type {
  CaseReviewDto,
  FollowUpDto,
  HealthCampDto,
  HouseholdDetailDto,
  HouseholdSummaryDto,
  MemberDto,
  ReferralDto,
} from '@/types/healthcare';

/**
 * The records the healthcare UI tests render.
 *
 * Fixed values rather than generated ones, because several of the assertions are about
 * what is *absent*: the second member of the household and the household itself have to
 * be real, named things for "the doctor cannot see them" to mean anything. A generator
 * that produced a different name each run would let an accidental pass through.
 *
 * These are shaped to the DTOs and carry no clinical meaning. Nothing here is a real
 * person, a real household or a real prescription.
 */

const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const CASE_ID = '33333333-3333-4333-8333-333333333333';
const REFERRAL_ID = '44444444-4444-4444-8444-444444444444';
const FOLLOW_UP_ID = '55555555-5555-4555-8555-555555555555';
const CAMP_ID = '66666666-6666-4666-8666-666666666666';

const member: MemberDto = {
  id: MEMBER_ID,
  householdId: HOUSEHOLD_ID,
  fullName: 'Lakshmi Gowda',
  ageYears: 34,
  sex: 'FEMALE',
  relationToHead: 'Head of household',
  note: null,
};

/** In the same household, and the reason a case review must not carry them. */
const otherMember: MemberDto = {
  id: '77777777-7777-4777-8777-777777777777',
  householdId: HOUSEHOLD_ID,
  fullName: 'Ravi Gowda',
  ageYears: 9,
  sex: 'MALE',
  relationToHead: 'Son',
  note: null,
};

const household: HouseholdSummaryDto = {
  id: HOUSEHOLD_ID,
  code: 'HH-0001',
  name: 'Gowda household',
  addressLine: '12 Temple Road',
  memberCount: 2,
  openCaseCount: 1,
};

const detail: HouseholdDetailDto = {
  household,
  members: [member],
  asha: { fullName: 'Asha Worker', registrationNumber: 'ASHA-7', area: 'Ward 3' },
};

const caseSummary: CaseReviewDto['case'] = {
  id: CASE_ID,
  caseNumber: 'CASE-0001',
  memberId: MEMBER_ID,
  memberName: member.fullName,
  householdId: HOUSEHOLD_ID,
  householdCode: household.code,
  status: 'UNDER_REVIEW',
  priority: 'URGENT',
  summary: 'Fever for five days, not settling',
  source: 'ASHA',
  openedAt: '2030-01-02T09:00:00.000Z',
  updatedAt: '2030-01-05T09:00:00.000Z',
};

const referral: ReferralDto = {
  id: REFERRAL_ID,
  caseId: CASE_ID,
  caseNumber: caseSummary.caseNumber,
  memberName: member.fullName,
  householdCode: household.code,
  reason: 'Fever for five days, not settling',
  priority: 'URGENT',
  status: 'PENDING',
  campId: null,
  doctorName: null,
  ashaName: 'Asha Worker',
  createdAt: '2030-01-02T10:00:00.000Z',
  acceptedAt: null,
  completedAt: null,
};

const followUp: FollowUpDto = {
  id: FOLLOW_UP_ID,
  caseId: CASE_ID,
  caseNumber: caseSummary.caseNumber,
  memberName: member.fullName,
  assignedRole: 'ASHA',
  dueDate: '2030-02-01',
  notes: 'Check temperature',
  status: 'PENDING',
  completedAt: null,
  createdAt: '2030-01-05T09:00:00.000Z',
};

/**
 * A review with one member, one referral, and one of each clinical record.
 *
 * `householdCode` is present and `household` is not: the code identifies the family to
 * a clinician without listing it, which is the whole shape of the doctor boundary and
 * the reason this fixture is built by hand rather than spread from a helper.
 */
const review: CaseReviewDto = {
  case: caseSummary,
  member,
  householdCode: household.code,
  ashaName: 'Asha Worker',
  observations: [
    {
      id: '88888888-8888-4888-8888-888888888888',
      caseId: CASE_ID,
      observedOn: '2030-01-02',
      reportedSymptoms: ['Fever', 'Headache'],
      severity: 'MODERATE',
      durationDays: 5,
      notes: null,
      referralReason: 'Not settling after five days',
      recordedByName: 'Asha Worker',
      createdAt: '2030-01-02T10:00:00.000Z',
    },
  ],
  referrals: [referral],
  clinicalNotes: [
    {
      id: '99999999-9999-4999-8999-999999999999',
      caseId: CASE_ID,
      doctorName: 'Doctor One',
      assessment: 'Viral fever',
      observations: null,
      advice: 'Rest and fluids',
      followUpOn: '2030-01-12',
      createdAt: '2030-01-05T10:00:00.000Z',
    },
  ],
  prescriptions: [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      caseId: CASE_ID,
      medicineName: 'Paracetamol',
      dosage: '500mg',
      frequency: 'Twice daily',
      duration: '3 days',
      instructions: null,
      doctorName: 'Doctor One',
      createdAt: '2030-01-05T10:05:00.000Z',
    },
  ],
  followUps: [followUp],
};

const camp: HealthCampDto = {
  id: CAMP_ID,
  title: 'Village health camp',
  description: 'Screening and basic care',
  campDate: '2030-03-01',
  startTime: '09:00',
  endTime: '13:00',
  location: 'Community hall',
  capacity: 20,
  status: 'PUBLISHED',
  registeredCount: 13,
  attendedCount: 0,
  isRegisteredByViewer: false,
  isFull: false,
  canManage: true,
  referredCaseCount: 4,
};

export const HealthcareListViewFixtures = {
  household,
  member,
  otherMember,
  detail,
  review,
  referral,
  followUp,
  camp,
};
