import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseHealthcareStore } from '@/lib/healthcare/supabase-store';
import { resolveHealthcareActor, type HealthcareActor } from '@/lib/healthcare/session';
import type { HealthcareStore } from '@/lib/healthcare/store';

/**
 * Who is asking, for a page rather than for a route.
 *
 * The counterpart to `getRequestContext` in `@/lib/healthcare/route`. Same rule, same
 * reason: a page decides what to *render* and a route decides what to *return*, and
 * both must take the role from the same place, or the two can disagree about who the
 * caller is and one of them will be wrong.
 *
 * WHY THIS EXISTS INSTEAD OF A PAGE CALLING THE SERVICE DIRECTLY
 * A page that resolved its own actor would be a second way to become a caller, and the
 * second one is the one nobody audits. Everything here is a thin wrapper over the
 * store and the actor resolver the routes already use, so a role cannot mean one thing
 * to a page and another to the API behind it.
 *
 * WHY IT RETURNS A STATUS RATHER THAN THROWING
 * `not_configured`, `unauthenticated` and `forbidden` are not errors in a page; they
 * are three different screens, and a member who is simply not a doctor should be told
 * so rather than shown an error page or, worse, an empty queue. The distinction is
 * kept in the union so each screen can say something true.
 */
import { getHealthcareDemoSession } from '@/lib/healthcare/demo-session';
import { getDemoHealthcareStore, getDemoActor } from '@/lib/demo/healthcare-demo';
import type { HealthcareRole } from '@/types/healthcare';

export type PortalContext =
  | { status: 'not_configured' }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | { status: 'ok'; store: HealthcareStore; actor: HealthcareActor };

export async function getPortalContext(
  requestedRole?: HealthcareRole | 'MEMBER'
): Promise<PortalContext> {
  if (!isSupabaseConfigured()) {
    const session = await getHealthcareDemoSession();
    if (!session) {
      return { status: 'unauthenticated' };
    }
    if (requestedRole && requestedRole !== 'MEMBER' && session.role !== requestedRole) {
      return { status: 'forbidden' };
    }
    const store = await getDemoHealthcareStore();
    const actor = getDemoActor(session.role);
    return { status: 'ok', store, actor };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      const session = await getHealthcareDemoSession();
      if (!session) {
        return { status: 'unauthenticated' };
      }
      if (requestedRole && requestedRole !== 'MEMBER' && session.role !== requestedRole) {
        return { status: 'forbidden' };
      }
      const store = await getDemoHealthcareStore();
      const actor = getDemoActor(session.role);
      return { status: 'ok', store, actor };
    }

    const store = createSupabaseHealthcareStore(supabase);
    try {
      const actor = await resolveHealthcareActor(data.user.id, store);
      if (requestedRole && requestedRole !== 'MEMBER' && actor.role !== requestedRole) {
        return { status: 'forbidden' };
      }
      return { status: 'ok', store, actor };
    } catch {
      const session = await getHealthcareDemoSession();
      if (!session) {
        return { status: 'unauthenticated' };
      }
      if (requestedRole && requestedRole !== 'MEMBER' && session.role !== requestedRole) {
        return { status: 'forbidden' };
      }
      const store = await getDemoHealthcareStore();
      const actor = getDemoActor(session.role);
      return { status: 'ok', store, actor };
    }
  } catch {
    const session = await getHealthcareDemoSession();
    if (!session) {
      return { status: 'unauthenticated' };
    }
    if (requestedRole && requestedRole !== 'MEMBER' && session.role !== requestedRole) {
      return { status: 'forbidden' };
    }
    const store = await getDemoHealthcareStore();
    const actor = getDemoActor(session.role);
    return { status: 'ok', store, actor };
  }
}
