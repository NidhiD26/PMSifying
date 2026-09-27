import { createFollowUp } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';
import { caseIdSchema } from '@/lib/healthcare/validation';
import { invalidRequest } from '@/lib/healthcare/errors';

/**
 * POST /api/healthcare/cases/[caseId]/follow-ups
 *
 * Scheduling the next contact, addressed to a *role* and not to an account.
 *
 * There is no `assignedToUserId` in the body, and that is the design rather than an
 * omission: the server resolves the recipient from the case itself — the worker
 * assigned to the household, or the doctor the case belongs to. A follow-up addressed to
 * an account can be aimed at somebody who has nothing to do with the case, which is a
 * request nobody should be able to make and one that produces work in a queue nobody
 * reads.
 */
export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  const parsed = caseIdSchema.safeParse(caseId);

  return handleRequest(request, async ({ store, actor, readBody }) => {
    if (!parsed.success) throw invalidRequest(['caseId']);
    return createFollowUp(store, { actor, caseId: parsed.data, input: await readBody() });
  });
}
