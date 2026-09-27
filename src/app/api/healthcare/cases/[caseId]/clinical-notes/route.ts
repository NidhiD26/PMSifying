import { createClinicalNote } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';
import { caseIdSchema } from '@/lib/healthcare/validation';
import { invalidRequest } from '@/lib/healthcare/errors';

/**
 * POST /api/healthcare/cases/[caseId]/clinical-notes
 *
 * The clinician's own account of the consultation, and the only place a diagnosis is
 * written. A worker's `summary` says why they opened the case; this says what was found.
 *
 * Doctor-only, and doctor-only *for this case*: a doctor who has been referred a
 * different case has not been given this one, and returns `not_found`. A referral queue
 * is not a pass to every case in the programme.
 *
 * Nothing here is ever rewritten. There is no PATCH and no DELETE, and a prescription
 * is amended rather than removed, so the history of what was advised survives.
 */
export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  const parsed = caseIdSchema.safeParse(caseId);

  return handleRequest(request, async ({ store, actor, readBody }) => {
    if (!parsed.success) throw invalidRequest(['caseId']);
    return createClinicalNote(store, { actor, caseId: parsed.data, input: await readBody() });
  });
}
