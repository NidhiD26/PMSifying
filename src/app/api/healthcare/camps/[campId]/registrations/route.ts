import {
  cancelCampRegistration,
  listCampRegistrations,
  registerForCamp,
} from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';
import { campIdSchema } from '@/lib/healthcare/validation';
import { invalidRequest } from '@/lib/healthcare/errors';

/**
 * GET /api/healthcare/camps/[campId]/registrations
 *
 * The roster, for the organiser or an administrator and nobody else. This is the read
 * that makes attendance reachable: `markCampAttendance` needs a registration id, and a
 * registration id is only ever handed out here.
 *
 * The authorization is in `listCampRegistrations` rather than here, and it is the same
 * predicate the attendance write uses. A member registering for a camp is *not* how you
 * see a camp's roster — the member who signed up gets their own seat back from
 * `listCamps` (`isRegisteredByViewer`) and nothing about anybody else's.
 *
 * POST /api/healthcare/camps/[campId]/registrations
 *
 * Signing the caller up. There is no body: the person registering is the session and
 * the camp is in the path, so a request cannot register somebody else. A body is never
 * read, which also means there is no body through which a role could be smuggled in.
 *
 * DELETE /api/healthcare/camps/[campId]/registrations
 *
 * The same identification, removing the caller's own seat. Allowed on a published camp
 * and on a finished one, because the commonest case is somebody who signed up in the
 * morning and cannot come — refusing once the camp was marked complete would leave the
 * roster still saying they were coming, and somebody would wait for them.
 *
 * A full camp answers `conflict`, and a second registration for the same person
 * answers `conflict` too rather than quietly taking a second seat.
 */
export async function GET(request: Request, context: { params: Promise<{ campId: string }> }) {
  const { campId } = await context.params;
  const parsed = campIdSchema.safeParse(campId);

  return handleRequest(request, async ({ store, actor }) => {
    if (!parsed.success) throw invalidRequest(['campId']);
    return listCampRegistrations(store, { actor, campId: parsed.data });
  });
}

export async function POST(request: Request, context: { params: Promise<{ campId: string }> }) {
  const { campId } = await context.params;
  const parsed = campIdSchema.safeParse(campId);

  return handleRequest(request, async ({ store, actor }) => {
    if (!parsed.success) throw invalidRequest(['campId']);
    return registerForCamp(store, { actor, campId: parsed.data });
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ campId: string }> }) {
  const { campId } = await context.params;
  const parsed = campIdSchema.safeParse(campId);

  return handleRequest(request, async ({ store, actor }) => {
    if (!parsed.success) throw invalidRequest(['campId']);
    return cancelCampRegistration(store, { actor, campId: parsed.data });
  });
}
