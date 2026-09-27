import * as React from 'react';
import { getTranslations } from 'next-intl/server';
import { withLocale } from '@/lib/navigation/locale-path';
import { isValidLocale } from '@/i18n/config';
import { DEFAULT_LOCALE } from '@/types/i18n';
import { getPortalContext } from '@/lib/healthcare/portal';
import { listCampRegistrations, listCamps } from '@/lib/healthcare/service';
import type { HealthcareStore } from '@/lib/healthcare/store';
import type { HealthcareActor } from '@/lib/healthcare/session';
import { PortalGate } from '@/features/healthcare/portal-gate';
import { UnavailablePanel } from '@/features/healthcare/unavailable-panel';
import { CampDetailView } from '@/features/healthcare/camp-views';

/**
 * One camp.
 *
 * There is no `GET /camps/{campId}`, so the camp is found in the list — which is also
 * what keeps the visibility rules honest. A member reads the published list; a member
 * who has a seat in a camp somebody has since completed can still read it, because
 * cancelling a registration on a finished camp is exactly the case
 * `cancelCampRegistration` was written for. Staff read every status, because an
 * organiser has to be able to open the draft they are still typing.
 *
 * Those status arguments are a display filter, not the control: the real one is the
 * camp-list RLS policy, which is what keeps a draft out of a member's result set. The
 * filter is here so the page behaves the same way against the in-memory fixture the
 * tests use, which has no policies of its own.
 */
export default async function HealthCampDetailPage({
  params,
}: {
  params: Promise<{ campId: string; locale: string }>;
}) {
  const { campId, locale: rawLocale } = await params;
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const t = await getTranslations('healthcare');

  const context = await getPortalContext();
  if (context.status === 'not_configured') {
    return <PortalGate status="not_configured" homeHref={withLocale('/', locale)} />;
  }
  if (context.status !== 'ok') {
    return <PortalGate status="unauthenticated" homeHref={withLocale('/health-camps', locale)} />;
  }

  const camp = await findVisibleCamp(context.store, context.actor, campId);
  if (!camp) {
    return (
      <UnavailablePanel
        message={t('errors.not_found')}
        backHref={withLocale('/health-camps', locale)}
        backLabel={t('actions.back')}
      />
    );
  }

  /*
   * The roster is fetched only when the camp says this viewer may run it, and the
   * answer comes from the DTO rather than from the page's own opinion of the role. A
   * page that asked "is the actor staff?" would show a roster to every worker, which is
   * the same class of bug as showing a camp's controls to every worker was. The read is
   * attempted only for a manager, so the forbidden branch is unreachable from here; if
   * it ever fires anyway, the empty roster is the right rendering, because the service
   * refused and the page must not render data it was not given.
   */
  const roster = camp.canManage
    ? await listCampRegistrations(context.store, { actor: context.actor, campId: camp.id }).catch(
        () => []
      )
    : undefined;

  return (
    <CampDetailView
      camp={camp}
      locale={locale}
      roster={roster}
      canMarkAttendance={camp.canManage}
      canChangeStatus={camp.canManage}
    />
  );
}

/**
 * The one camp, or nothing.
 *
 * Written as a lookup over the camps this reader may see rather than as a fetch by id,
 * because a fetch by id would have to decide the visibility question somewhere else —
 * and the answer to that question is the camp list's.
 */
async function findVisibleCamp(
  store: HealthcareStore,
  actor: HealthcareActor,
  campId: string
) {
  if (actor.role === 'USER') {
    const visible = await Promise.all([
      listCamps(store, { actor, query: { status: 'PUBLISHED' } }),
      listCamps(store, { actor, query: { status: 'COMPLETED' } }),
    ]);
    return visible.flat().find((camp) => camp.id === campId) ?? null;
  }

  const all = await listCamps(store, { actor, query: { status: 'ALL' } });
  return all.find((camp) => camp.id === campId) ?? null;
}
