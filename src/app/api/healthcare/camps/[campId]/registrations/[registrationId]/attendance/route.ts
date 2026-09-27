import { markCampAttendance } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';
import { campIdSchema, markAttendanceSchema, registrationIdSchema } from '@/lib/healthcare/validation';
import { invalidRequest } from '@/lib/healthcare/errors';

/**
 * POST /api/healthcare/camps/[campId]/registrations/[registrationId]/attendance
 *
 * Marking somebody present, absent, or simply registered.
 *
 * Addressed by *registration*, not by account, and the reason is practical rather than
 * theoretical: the person running a camp is looking at a roster of names and has no
 * account ids at all. A `userId` here would be an id the client was never given, and a
 * UI that had to invent one would be a UI registering people under accounts they do not
 * have.
 *
 * Both ids are in the path and the body carries only what happened. That is not
 * tidiness — it is the thing that makes the pair checkable. A registration id on its
 * own would be enough to mark somebody present at any camp, and the service refuses a
 * registration that belongs to a different camp.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ campId: string; registrationId: string }> }
) {
  const { campId, registrationId } = await context.params;
  const parsedCamp = campIdSchema.safeParse(campId);
  const parsedRegistration = registrationIdSchema.safeParse(registrationId);

  return handleRequest(request, async ({ store, actor, readBody }) => {
    if (!parsedCamp.success) throw invalidRequest(['campId']);
    if (!parsedRegistration.success) throw invalidRequest(['registrationId']);

    const parsedBody = markAttendanceSchema.safeParse(await readBody());
    if (!parsedBody.success) throw invalidRequest(['status']);

    return markCampAttendance(store, {
      actor,
      campId: parsedCamp.data,
      registrationId: parsedRegistration.data,
      input: parsedBody.data,
    });
  });
}
