import { listReferrals } from '@/lib/healthcare/service';
import { handleRequest, readReferralQuery } from '@/lib/healthcare/route';

/**
 * GET /api/healthcare/referrals
 *
 * Two different queues behind one endpoint, because the service knows who is asking: a
 * worker sees the referrals they sent and a doctor the ones addressed to them. An
 * administrator sees neither, and gets an empty list — overseeing a referral programme
 * is done by reading cases, not by being handed every outgoing referral.
 */
export async function GET(request: Request) {
  return handleRequest(request, async ({ store, actor }) =>
    listReferrals(store, { actor, query: readReferralQuery(request.url) })
  );
}
