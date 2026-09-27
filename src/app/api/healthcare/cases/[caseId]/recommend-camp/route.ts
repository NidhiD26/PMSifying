import { handleRequest, readParams } from '@/lib/healthcare/route';

export async function POST(
  request: Request,
  props: { params: Promise<{ caseId: string }> }
) {
  const params = await readParams(props.params);
  const caseId = params['caseId'];

  return handleRequest(request, async ({ store, actor, readBody }) => {
    const body = (await readBody()) as { campId?: string };
    if (!body.campId) {
      throw new Error('campId is required.');
    }

    const caseRecord = await store.getCase(caseId);
    if (!caseRecord) {
      throw new Error('Case not found.');
    }

    const camp = await store.getCamp(body.campId);
    if (!camp) {
      throw new Error('Health Camp not found.');
    }

    // Register member for the camp using member ID or actor ID
    try {
      await store.registerForCamp(camp.id, caseRecord.household_member_id);
    } catch {
      // If already registered, ignore duplicate error
    }

    // Record clinical recommendation note on case
    await store.createClinicalNote({
      caseId,
      doctorId: actor.userId,
      assessment: `Health Camp Recommendation: ${camp.title}`,
      observations: `Patient recommended for screening and consultation at ${camp.title} on ${camp.camp_date} at ${camp.location}.`,
      advice: `Attend ${camp.title} for follow-up evaluation and screening.`,
      followUpOn: camp.camp_date,
    });

    return {
      success: true,
      caseId,
      campId: camp.id,
      campTitle: camp.title,
    };
  });
}
