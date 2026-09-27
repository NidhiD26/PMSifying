import { listFollowUps } from '@/lib/healthcare/service';
import { handleRequest, readFollowUpQuery } from '@/lib/healthcare/route';

/**
 * GET /api/healthcare/follow-ups
 *
 * The caller's own queue, by assignment. A follow-up addressed to a role is addressed to
 * one account, so this is a list of work somebody is personally on the hook for rather
 * than a shared list — which is the point of resolving the recipient on the server when
 * the follow-up was created.
 */
export async function GET(request: Request) {
  return handleRequest(request, async ({ store, actor }) =>
    listFollowUps(store, { actor, query: readFollowUpQuery(request.url) })
  );
}
