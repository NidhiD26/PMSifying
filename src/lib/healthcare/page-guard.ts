import { getPortalContext, type PortalContext } from '@/lib/healthcare/portal';
import type { HealthcareActor } from '@/lib/healthcare/session';
import type { HealthcareStore } from '@/lib/healthcare/store';
import type { HealthcareRole } from '@/types/healthcare';
import type { PortalStatus } from '@/features/healthcare/portal-gate';

/**
 * Which page gets to render its records.
 *
 * Every healthcare page begins with the same three questions — is the backend
 * configured, is anybody signed in, and is the role the one this page is for — and the
 * answers are the same three screens. Written out thirteen times they would drift, and
 * one page that forgot the role check would be a page showing a doctor a worker's queue.
 *
 * SO WHAT THIS IS AND IS NOT
 * It decides whether a page renders a queue or an explanation. It is not the thing that
 * keeps records private: the service decides that, again, on the server, for the same
 * call. Making the page agree with the server is worth doing so a member sees "this is
 * not your workspace" rather than an empty queue, and it is worth nothing as a security
 * control, because a member who types a healthcare path directly gets here, is refused,
 * and never reaches a record either way.
 *
 * `'MEMBER'` is the odd one out: it is the only page that is for the `USER` role, and
 * the only one that is not additionally narrowed to `ASHA` or `DOCTOR`. It still needs a
 * session, though — the early return above happens before the role is looked at, and
 * that is not an accident. Every service read takes a `HealthcareActor`, because the
 * DTOs carry per-viewer facts such as `isRegisteredByViewer` and a member's camp list is
 * built around what *they* registered for. A published camp being public information
 * (the date, the hall, the places left) does not make the list readable without an
 * actor, and the alternative — a second anonymous read path that skips the actor — is
 * the kind of side door that quietly outlives the reason it was cut.
 */
export type ResolvedPage =
  | { status: PortalStatus }
  | { status: 'ok'; store: HealthcareStore; actor: HealthcareActor };

export async function resolvePageFor(
  role: HealthcareRole | 'MEMBER'
): Promise<ResolvedPage> {
  const context: PortalContext = await getPortalContext(role);

  if (context.status !== 'ok') return { status: context.status };
  if (role === 'MEMBER') return { status: 'ok', store: context.store, actor: context.actor };
  if (context.actor.role !== role) return { status: 'forbidden' };

  return { status: 'ok', store: context.store, actor: context.actor };
}
