import { createObservation } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';
import { caseIdSchema } from '@/lib/healthcare/validation';
import { invalidRequest } from '@/lib/healthcare/errors';

/**
 * POST /api/healthcare/cases/[caseId]/observations
 *
 * What the person reported, in the worker's words. The member is not in the body: the
 * case already names them, and a body that could name a different one would be a way to
 * file a symptom against the wrong person.
 *
 * The recorded worker is the session, so an observation cannot be attributed to
 * somebody else, and the case must be one this worker opened — a worker who has been
 * assigned somebody else's household is refused here as surely as anywhere else.
 */
export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  const parsed = caseIdSchema.safeParse(caseId);

  return handleRequest(request, async ({ store, actor, readBody }) => {
    if (!parsed.success) throw invalidRequest(['caseId']);
    return createObservation(store, { actor, caseId: parsed.data, input: await readBody() });
  });
}
