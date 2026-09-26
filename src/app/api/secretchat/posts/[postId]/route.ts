import { deletePost, getPostDetail } from '@/lib/secretchat/service';
import { handleRequest } from '@/lib/secretchat/route';
import { postIdSchema } from '@/lib/secretchat/validation';
import { invalidRequest } from '@/lib/secretchat/errors';

/**
 * /api/secretchat/posts/[postId]
 *
 * GET    one post with its comments
 * DELETE the signed-in member's own post
 *
 * The id is validated before it reaches the database, so a malformed id is a
 * 400 rather than a query error. Ownership is never taken from the request:
 * DELETE asks the store which row it changed, and the service compares that
 * against the session.
 */
export async function GET(request: Request, context: { params: Promise<{ postId: string }> }) {
  const { postId } = await context.params;

  return handleRequest(request, ({ store, userId }) =>
    getPostDetail(store, { viewerId: userId, postId: validate(postId, 'postId') })
  );
}

export async function DELETE(request: Request, context: { params: Promise<{ postId: string }> }) {
  const { postId } = await context.params;

  return handleRequest(request, ({ store, userId }) =>
    deletePost(store, { viewerId: userId, postId: validate(postId, 'postId') })
  );
}

/**
 * A malformed id is a 400, decided before any query is attempted.
 *
 * Called from inside the request boundary, so the throw it makes is turned into
 * the JSON envelope rather than a framework error page.
 */
function validate(value: string, field: string): string {
  const parsed = postIdSchema.safeParse(value);
  if (!parsed.success) throw invalidRequest([field]);
  return parsed.data;
}
