import { cancelReferral } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';
import { referralIdSchema } from '@/lib/healthcare/validation';
import { invalidRequest } from '@/lib/healthcare/errors';

/**
 * POST /api/healthcare/referrals/[referralId]/cancel
 *
 * Withdrawing a referral, and it is its own endpoint rather than a value the progress
 * endpoint accepts, because the two have different owners. A worker may withdraw a
 * referral they sent at any time — including one a doctor has already started looking
 * at, which is the case where it matters most, because a doctor reading a case that is
 * about to be withdrawn wastes a consultation on it.
 *
 * The referral is not deleted. It is cancelled, with the case returned to the worker,
 * so the record of what was sent and why it stopped is still there to read.
 */
export async function POST(request: Request, context: { params: Promise<{ referralId: string }> }) {
  const { referralId } = await context.params;
  const parsed = referralIdSchema.safeParse(referralId);

  return handleRequest(request, async ({ store, actor }) => {
    if (!parsed.success) throw invalidRequest(['referralId']);
    return cancelReferral(store, { actor, referralId: parsed.data });
  });
}
