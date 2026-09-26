import { createPost } from '@/lib/secretchat/service';
import { handleRequest } from '@/lib/secretchat/route';

/**
 * POST /api/secretchat/posts
 *
 * Write anonymously: the body carries only text. The author is the session, so
 * there is no field a client could set to post as somebody else - and `.strict()`
 * on the schema means an attempt to add one is rejected rather than ignored.
 */
export async function POST(request: Request) {
  return handleRequest(request, async ({ store, userId, readBody }) =>
    createPost(store, { viewerId: userId, input: await readBody() })
  );
}
