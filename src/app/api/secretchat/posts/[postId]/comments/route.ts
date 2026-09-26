import { createComment } from '@/lib/secretchat/service';
import { handleRequest } from '@/lib/secretchat/route';
import { postIdSchema } from '@/lib/secretchat/validation';
import { invalidRequest } from '@/lib/secretchat/errors';

/**
 * POST /api/secretchat/posts/[postId]/comments
 *
 * A reply is addressed by the post it belongs to, and the author is the
 * session. The post must still be visible: commenting on a hidden post returns
 * `not_found`, so a stale client cannot use the comment endpoint to confirm that
 * a deleted post exists.
 *
 * The id is validated inside the request boundary, so a malformed id is a JSON
 * 400 like every other client error rather than a framework error page.
 */
export async function POST(request: Request, context: { params: Promise<{ postId: string }> }) {
  const { postId } = await context.params;
  const parsedId = postIdSchema.safeParse(postId);

  return handleRequest(request, async (ctx) => {
    if (!parsedId.success) throw invalidRequest(['postId']);

    return createComment(ctx.store, {
      viewerId: ctx.userId,
      postId: parsedId.data,
      input: await ctx.readBody(),
    });
  });
}
