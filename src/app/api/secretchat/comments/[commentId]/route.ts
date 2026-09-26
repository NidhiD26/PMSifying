import { deleteComment } from '@/lib/secretchat/service';
import { handleRequest } from '@/lib/secretchat/route';
import { commentIdSchema } from '@/lib/secretchat/validation';
import { invalidRequest } from '@/lib/secretchat/errors';

/**
 * DELETE /api/secretchat/comments/[commentId]
 *
 * Own comments only, decided on the server from the stored row. The delete is
 * soft, so a reply thread keeps its shape and a removed comment is never
 * mistaken for something that was never written.
 */
export async function DELETE(request: Request, context: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await context.params;
  const parsed = commentIdSchema.safeParse(commentId);

  return handleRequest(request, async (ctx) => {
    if (!parsed.success) throw invalidRequest(['commentId']);

    return deleteComment(ctx.store, { viewerId: ctx.userId, commentId: parsed.data });
  });
}
