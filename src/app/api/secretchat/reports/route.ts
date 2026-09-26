import { reportContent } from '@/lib/secretchat/service';
import { handleRequest } from '@/lib/secretchat/route';

/**
 * POST /api/secretchat/reports
 *
 * Filing a report is a member action and goes through the same RLS as posting:
 * a member may insert a report, and may read back only the one they just filed.
 * Nobody, including moderators reading the reports table, gets the reporter's
 * identity through this endpoint - a moderator queue is served by the separate
 * moderation path, which is server-authorised.
 */
export async function POST(request: Request) {
  return handleRequest(request, async ({ store, userId, readBody }) =>
    reportContent(store, { viewerId: userId, input: await readBody() })
  );
}
