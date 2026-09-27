import { changeCampStatus } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';
import { campIdSchema, setCampStatusSchema } from '@/lib/healthcare/validation';
import { invalidRequest } from '@/lib/healthcare/errors';

/**
 * POST /api/healthcare/camps/[campId]/status
 *
 * Publishing, completing or cancelling a camp. Only the organiser or an administrator
 * may, and a finished camp cannot be reopened: a completed camp has attendance recorded
 * against it, and putting it back on the list would invite people to an event that has
 * already happened.
 */
export async function POST(request: Request, context: { params: Promise<{ campId: string }> }) {
  const { campId } = await context.params;
  const parsedId = campIdSchema.safeParse(campId);

  return handleRequest(request, async ({ store, actor, readBody }) => {
    if (!parsedId.success) throw invalidRequest(['campId']);

    const parsedBody = setCampStatusSchema.safeParse(await readBody());
    if (!parsedBody.success) throw invalidRequest(['status']);

    return changeCampStatus(store, { actor, campId: parsedId.data, status: parsedBody.data.status });
  });
}
