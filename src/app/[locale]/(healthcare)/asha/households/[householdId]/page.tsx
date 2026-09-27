import * as React from 'react';
import { getTranslations } from 'next-intl/server';
import { withLocale } from '@/lib/navigation/locale-path';
import { isValidLocale } from '@/i18n/config';
import { DEFAULT_LOCALE } from '@/types/i18n';
import { resolvePageFor } from '@/lib/healthcare/page-guard';
import { getHouseholdDetail } from '@/lib/healthcare/service';
import { isApiError } from '@/lib/api/errors';
import { PortalGate } from '@/features/healthcare/portal-gate';
import { HouseholdDetailView } from '@/features/healthcare/household-views';
import { UnavailablePanel } from '@/features/healthcare/unavailable-panel';

/**
 * One household, with its members.
 *
 * The id comes from the path and is checked against the worker's own patch by the
 * service, which answers `not_found` for a household in another worker's area rather
 * than `forbidden` — a 403 would confirm the household exists, which is a disclosure
 * about somebody else's register. A household outside the patch therefore lands on the
 * same panel as one that does not exist, which is the honest answer for both, and which
 * says "not available to you" rather than "forbidden" for the same reason.
 */
export default async function ASHAHouseholdDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; locale: string }>;
}) {
  const { householdId, locale: rawLocale } = await params;
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const t = await getTranslations('healthcare');

  const page = await resolvePageFor('ASHA');
  if (page.status !== 'ok') {
    return <PortalGate status={page.status} homeHref={withLocale('/', locale)} />;
  }

  let detail;
  try {
    detail = await getHouseholdDetail(page.store, { actor: page.actor, householdId });
  } catch (error) {
    // Anything the service refuses here is a visibility answer, not a crash: the row is
    // either absent or in another worker's patch, and the reader learns nothing new
    // either way. An unexpected failure is shown as the same sentence rather than as an
    // exception page, so an internal message never reaches a screen.
    const code = isApiError(error) && error.code === 'not_found' ? 'not_found' : 'unknown';
    return (
      <UnavailablePanel
        message={t(`errors.${code}`)}
        backHref={withLocale('/asha/households', locale)}
        backLabel={t('actions.back')}
      />
    );
  }

  return (
    <HouseholdDetailView
      detail={detail}
      locale={locale}
      basePath="/asha/households"
      casesPath="/asha/cases"
    />
  );
}
