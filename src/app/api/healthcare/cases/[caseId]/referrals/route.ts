import { createReferral } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';
import { caseIdSchema } from '@/lib/healthcare/validation';
import { invalidRequest } from '@/lib/healthcare/errors';

/**
 * POST /api/healthcare/cases/[caseId]/referrals
 *
 * Sending the case to a doctor. Filing the referral is also what moves the case to
 * `REFERRED`; there is no separate status call, so a case cannot reach that state by
 * any other route and there is no way to leave a case claiming to be referred with
 * nothing behind it.
 *
 * `doctorId` must be somebody on the roster, and the referral is sent *as* the session
 * worker. A referral addressed to a misspelt id is the quietest possible failure — the
 * row is written, the case says referred, and no queue ever shows it — so the
 * destination is checked against the roster before anything is written.
 */
export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  const parsed = caseIdSchema.safeParse(caseId);

  return handleRequest(request, async ({ store, actor, readBody }) => {
    if (!parsed.success) throw invalidRequest(['caseId']);
    return createReferral(store, { actor, caseId: parsed.data, input: await readBody() });
  });
}
