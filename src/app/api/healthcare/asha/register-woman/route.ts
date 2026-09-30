import { handleRequest } from '@/lib/healthcare/route';
import { DEMO_DOCTOR_USER_ID, persistDemoRegistration } from '@/lib/demo/healthcare-demo';
import { requireAsha } from '@/lib/healthcare/session';

export async function POST(request: Request) {
  return handleRequest(request, async ({ store, actor, readBody }) => {
    requireAsha(actor);
    const body = (await readBody()) as {
      name: string;
      age?: number;
      contact?: string;
      householdName?: string;
      addressLine?: string;
      primaryConcern: string;
      symptoms?: string[] | string;
      durationDays?: number;
      priority?: 'ROUTINE' | 'URGENT';
      notes?: string;
      referToDoctorId?: string;
    };

    if (!body.name?.trim()) {
      throw new Error('Woman\'s name is required.');
    }
    if (!body.primaryConcern?.trim()) {
      throw new Error('Primary health concern is required.');
    }

    const ashaUserId = actor.userId;
    const householdName = body.householdName?.trim() || `${body.name.trim()} Household`;
    const addressLine = body.addressLine?.trim() || null;

    let household = (await store.listHouseholds(ashaUserId)).find(
      (h) => h.name.toLowerCase() === householdName.toLowerCase()
    );
    if (!household) {
      household = await store.createHousehold(ashaUserId, {
        name: householdName,
        addressLine,
      });
    }

    const ageValue = typeof body.age === 'number' ? body.age : Number(body.age) || null;

    const member = await store.createMember(household.id, {
      fullName: body.name.trim(),
      ageYears: ageValue,
      sex: 'FEMALE',
      relationToHead: 'Member',
      note: body.contact ? `Contact: ${body.contact.trim()}` : null,
    });

    const priority = body.priority === 'URGENT' ? 'URGENT' : 'ROUTINE';
    const caseRecord = await store.createCase({
      householdId: household.id,
      householdMemberId: member.id,
      createdByAshaId: ashaUserId,
      summary: body.primaryConcern.trim(),
      priority,
      source: 'ASHA',
      campId: null,
    });

    let symptomsList: string[] = [];
    if (Array.isArray(body.symptoms)) {
      symptomsList = body.symptoms.map((s) => String(s).trim()).filter(Boolean);
    } else if (typeof body.symptoms === 'string' && body.symptoms.trim()) {
      symptomsList = body.symptoms
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (symptomsList.length === 0) {
      symptomsList = [body.primaryConcern.trim()];
    }

    const durationValue =
      typeof body.durationDays === 'number' ? body.durationDays : Number(body.durationDays) || null;

    const observedOn = new Date().toISOString().slice(0, 10);
    const referralReason = `Specialist evaluation for ${body.primaryConcern.trim()}`;
    await store.createObservation({
      caseId: caseRecord.id,
      householdMemberId: member.id,
      recordedByAshaId: ashaUserId,
      observedOn,
      reportedSymptoms: symptomsList,
      severity: priority === 'URGENT' ? 'SEVERE' : 'MODERATE',
      durationDays: durationValue,
      notes: body.notes?.trim() || null,
      referralReason,
    });

    const doctorId = body.referToDoctorId?.trim() || DEMO_DOCTOR_USER_ID;
    const referral = await store.createReferral({
      caseId: caseRecord.id,
      referredByAshaId: ashaUserId,
      referredToDoctorId: doctorId,
      reason: `Specialist evaluation for ${body.primaryConcern.trim()}. Symptoms: ${symptomsList.join(', ')}. ${body.notes ? `Notes: ${body.notes.trim()}` : ''}`,
      priority,
      campId: null,
    });
    await store.updateCase(caseRecord.id, { status: 'REFERRED' });

    if (actor.userId === 'asha-demo-user-id') {
      await persistDemoRegistration({
        householdName,
        addressLine,
        fullName: member.full_name,
        ageYears: member.age_years,
        note: member.note,
        summary: caseRecord.summary,
        priority,
        observedOn,
        reportedSymptoms: symptomsList,
        durationDays: durationValue,
        observationNotes: body.notes?.trim() || null,
        referralReason,
      });
    }

    return {
      caseId: caseRecord.id,
      caseNumber: caseRecord.case_number,
      memberId: member.id,
      memberName: member.full_name,
      householdId: household.id,
      referralId: referral.id,
    };
  });
}
