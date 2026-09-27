import { getCaseReview, updateCase } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';
import { caseIdSchema } from '@/lib/healthcare/validation';
import { invalidRequest } from '@/lib/healthcare/errors';

/**
 * GET /api/healthcare/cases/[caseId]
 *
 * The whole case: the member, their observations, the referrals, the clinical notes,
 * the prescriptions and the follow-ups. One request rather than six, because a review
 * screen that assembles itself from six round-trips shows a clinician a case with holes
 * in it while they are waiting, and a missing prescription looks like a missing
 * prescription.
 *
 * PATCH /api/healthcare/cases/[caseId]
 *
 * Correcting the worker's own summary, and only while the case is still `OPEN`. Once a
 * clinician has taken it, the record of the decision is the clinical note, and a
 * summary that can still be rewritten would drift away from what that note describes.
 */
export async function GET(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  const parsed = caseIdSchema.safeParse(caseId);

  return handleRequest(request, async ({ store, actor }) => {
    if (!parsed.success) throw invalidRequest(['caseId']);
    return getCaseReview(store, { actor, caseId: parsed.data });
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  const parsed = caseIdSchema.safeParse(caseId);

  return handleRequest(request, async ({ store, actor, readBody }) => {
    if (!parsed.success) throw invalidRequest(['caseId']);
    return updateCase(store, { actor, caseId: parsed.data, input: await readBody() });
  });
}
