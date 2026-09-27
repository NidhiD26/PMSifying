import { settleFollowUp } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';
import { followUpIdSchema, settleFollowUpSchema } from '@/lib/healthcare/validation';
import { invalidRequest } from '@/lib/healthcare/errors';

/**
 * POST /api/healthcare/follow-ups/[followUpId]/settle
 *
 * Closing the loop: completed, missed, or cancelled. "Missed" is not a lesser version
 * of "completed" — it is a claim that somebody went looking and did not find the
 * person, which is why it is recorded with the same attribution and audited with the
 * same care. A trail of only completed visits is a trail that says nothing about the
 * people who were not reached.
 *
 * Settling to the status it already has is allowed and does not rewrite the stamp, so a
 * retried request on a bad connection cannot overwrite who actually closed it.
 */
export async function POST(request: Request, context: { params: Promise<{ followUpId: string }> }) {
  const { followUpId } = await context.params;
  const parsedId = followUpIdSchema.safeParse(followUpId);

  return handleRequest(request, async ({ store, actor, readBody }) => {
    if (!parsedId.success) throw invalidRequest(['followUpId']);

    const parsedBody = settleFollowUpSchema.safeParse(await readBody());
    if (!parsedBody.success) throw invalidRequest(['action']);

    return settleFollowUp(store, { actor, followUpId: parsedId.data, action: parsedBody.data.action });
  });
}
