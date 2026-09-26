import { getFeed } from '@/lib/secretchat/service';
import { handleRequest, readFeedQuery } from '@/lib/secretchat/route';

/**
 * GET /api/secretchat/feed
 *
 * The feed is a read, but it is still a signed-in read: every request resolves a
 * session, because the response includes "did I like this" and excludes the
 * members the reader has blocked. Neither is meaningful without knowing who is
 * asking.
 *
 * There is no POST here, so a mistake gets a 405 from the framework.
 */
export async function GET(request: Request) {
  const query = readFeedQuery(request.url);

  return handleRequest(request, (context) =>
    getFeed(context.store, {
      viewerId: context.userId,
      limit: query.limit,
      cursor: query.cursor,
    })
  );
}
