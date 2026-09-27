import { progressReferral } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';
import { progressReferralSchema, referralIdSchema } from '@/lib/healthcare/validation';
import { invalidRequest } from '@/lib/healthcare/errors';

/**
 * POST /api/healthcare/referrals/[referralId]/progress
 *
 * Moving a referral the doctor already holds: picking it up, completing it, or
 * cancelling it. Accepting is a separate endpoint because it is a different act — it
 * assigns the case — and a client that could pass `accept` here would be able to take a
 * case without the assignment that makes the later writes legal.
 *
 * The body is validated rather than cast, so a client sending nothing gets a 400 that
 * names `action` instead of a transition failure about an undefined move.
 */
export async function POST(request: Request, context: { params: Promise<{ referralId: string }> }) {
  const { referralId } = await context.params;
  const parsedId = referralIdSchema.safeParse(referralId);

  return handleRequest(request, async ({ store, actor, readBody }) => {
    if (!parsedId.success) throw invalidRequest(['referralId']);

    const parsedBody = progressReferralSchema.safeParse(await readBody());
    if (!parsedBody.success) throw invalidRequest(['action']);

    return progressReferral(store, { actor, referralId: parsedId.data, action: parsedBody.data.action });
  });
}
