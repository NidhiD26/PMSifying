import * as React from 'react';
import { withLocale } from '@/lib/navigation/locale-path';
import { isValidLocale } from '@/i18n/config';
import { DEFAULT_LOCALE } from '@/types/i18n';
import { getPortalContext } from '@/lib/healthcare/portal';
import { listCamps } from '@/lib/healthcare/service';
import { PortalGate } from '@/features/healthcare/portal-gate';
import { CampListView } from '@/features/healthcare/camp-views';

/**
 * The camp list — the one healthcare page a member is allowed on.
 *
 * `resolvePageFor('MEMBER')` narrows the role to `USER` without narrowing it to a
 * worker, so a member sees camps instead of being told this is not their workspace. The
 * *service* still refuses every other role the clinical records, so what the page
 * grants and what the server permits stay the same set.
 *
 * A session is still required, and that is worth being plain about rather than implying
 * otherwise: `listCamps` needs an actor because the DTOs carry `isRegisteredByViewer`
 * and a member's list is the one they can withdraw from. A signed-out visitor is sent
 * to sign in, not shown the list, so nothing about a camp is readable anonymously today.
 * Publishing the date, hall and places left without a login is a reasonable thing to
 * want, and it is a change to the service's read path rather than a page-level tweak.
 *
 * The query is left empty, which `campListQuerySchema` defaults to `PUBLISHED`, so a
 * draft camp cannot appear here even for an organiser. Staff who want to see their own
 * drafts use the camp page, not this list.
 */
export default async function HealthCampsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  const context = await getPortalContext();
  if (context.status === 'not_configured') {
    return <PortalGate status="not_configured" homeHref={withLocale('/', locale)} />;
  }

  // A signed-out visitor has no actor, so there is no store to read camps with. The
  // page is reachable, and the list is the one thing it needs a session for, so it says
  // so rather than rendering an empty list that would read as "no camps are on".
  if (context.status !== 'ok') {
    return <PortalGate status="unauthenticated" homeHref={withLocale('/', locale)} />;
  }

  const camps = await listCamps(context.store, { actor: context.actor, query: {} });

  return (
    <CampListView camps={camps} locale={locale} showReferredCount={context.actor.role !== 'USER'} />
  );
}
