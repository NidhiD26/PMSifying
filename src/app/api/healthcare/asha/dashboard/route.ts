import { getAshaDashboard } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';

/**
 * GET /api/healthcare/asha/dashboard
 *
 * One request for a worker's whole morning: the households they cover, the open cases,
 * the referrals waiting on a doctor, the follow-ups due, and the camps this month.
 *
 * It is one request rather than five because the alternative is a dashboard that fills
 * in over several seconds, and a queue that renders half-populated looks like a
 * different, smaller queue. It is also cheaper in one specific way that matters more
 * than the round-trips: five separate calls would each be authorised separately, and
 * `openCases` could disagree with the list of recent cases beside it.
 */
export async function GET(request: Request) {
  return handleRequest(request, async ({ store, actor }) => getAshaDashboard(store, { actor }));
}
