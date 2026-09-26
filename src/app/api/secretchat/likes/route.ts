import { setLike } from '@/lib/secretchat/service';
import { handleRequest } from '@/lib/secretchat/route';

/**
 * /api/secretchat/likes
 *
 * POST    like a post or a comment
 * DELETE  unlike it
 *
 * Both verbs take the same body, where `liked` states the intent, so the two
 * directions cannot drift apart in what they accept. Liking twice is not an
 * error: the unique constraint and the service both make it a no-op, which is
 * what lets the UI retry a request it is not sure landed.
 */
export async function POST(request: Request) {
  return handleRequest(request, async ({ store, userId, readBody }) =>
    setLike(store, { viewerId: userId, input: await readBody() })
  );
}

export async function DELETE(request: Request) {
  return handleRequest(request, async ({ store, userId, readBody }) =>
    setLike(store, { viewerId: userId, input: await readBody() })
  );
}
