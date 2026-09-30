import * as React from 'react';
import { redirect } from 'next/navigation';
import { getSignedInPortal } from '@/lib/healthcare/portal';
import {
  healthcareHomeHref,
  healthcareLoginHref,
  type HealthcarePortal,
} from '@/lib/healthcare/portal-routes';
import { PortalGate, type PortalStatus } from '@/features/healthcare/portal-gate';
import type { Locale } from '@/types/i18n';

/**
 * The one place a blocked healthcare page decides where "sign in" actually goes.
 *
 * A protected healthcare route reaches the same three states every time — no session, or
 * a session whose role is not the one this page is for — and every one of those states
 * used to hand the reader a link to the personal PMSify dashboard. A health worker who
 * clicked "Sign in to portal" left the healthcare system and landed in a cycle tracker,
 * which is both useless and the reason healthcare and personal sessions have to stay
 * visibly separate: the personal dashboard is reached by a local PIN on a device, the
 * healthcare portal by an account, and linking one to the other conflates them.
 *
 * SO WHAT THIS DECIDES, AND WHAT IT DOES NOT
 * It decides which screen renders and which healthcare sign-in page that screen offers.
 * It authorises nothing. The role check that produced `status` happened in
 * `resolvePageFor`, and every read behind this screen happens again in the service with
 * the same actor, so a reader who types a healthcare path directly is refused exactly as
 * before — they are simply told where to sign in rather than being handed the dashboard.
 *
 * WHY `unauthenticated` REDIRECTS BUT `forbidden` DOES NOT
 * Somebody with no session on `/hi/asha` is a person who has not signed in yet, and the
 * only thing between them and the queue is the sign-in page, so they are sent to it and
 * the URL says so — a refresh, a bookmark and a shared link all resume at the right
 * place. Somebody who is already signed in as a doctor and typed `/hi/asha` is not
 * confused about how to sign in; redirecting them to a login form would throw away a
 * session they hold and imply they could get a queue this way. They get the explanation,
 * and a link to the workspace their own role *is* — which is why the gate needs two
 * destinations rather than one. Collapsing them, as this file's bug did, is what sent
 * both cases to the dashboard.
 */
export const HealthcarePageGate: React.FC<{
  status: PortalStatus;
  portal: HealthcarePortal;
  locale: Locale;
}> = async ({ status, portal, locale }) => {
  if (status === 'unauthenticated' && portal !== 'MEMBER') {
    redirect(healthcareLoginHref(portal, locale));
  }

  /*
   * Only read on the `forbidden` path. On any other status this would be a second
   * session resolution per page load for no benefit, and a wrong-role visit is rare
   * enough that the cost does not matter.
   */
  const signedInPortal = status === 'forbidden' ? await getSignedInPortal() : null;

  return (
    <PortalGate
      status={status}
      homeHref={healthcareLoginHref(portal, locale)}
      workspaceHref={healthcareHomeHref(signedInPortal ?? portal, locale)}
    />
  );
};
