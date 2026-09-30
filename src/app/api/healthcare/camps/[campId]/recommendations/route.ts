import { listCampRegistrations } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';
import { campIdSchema } from '@/lib/healthcare/validation';
import { invalidRequest } from '@/lib/healthcare/errors';

/** The authorised case-linked camp roster, including recommendation and attendance state. */
export async function GET(request: Request, context: { params: Promise<{ campId: string }> }) {
  const { campId } = await context.params;
  const parsed = campIdSchema.safeParse(campId);
  return handleRequest(request, async ({ store, actor }) => {
    if (!parsed.success) throw invalidRequest(['campId']);
    return listCampRegistrations(store, { actor, campId: parsed.data });
  });
}
