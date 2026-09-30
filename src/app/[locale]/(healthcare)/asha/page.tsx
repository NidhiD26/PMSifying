import * as React from 'react';
import { isValidLocale } from '@/i18n/config';
import { DEFAULT_LOCALE } from '@/types/i18n';
import { resolvePageFor } from '@/lib/healthcare/page-guard';
import { getAshaDashboard } from '@/lib/healthcare/service';
import { HealthcarePageGate } from '@/features/healthcare/healthcare-page-gate';
import { AshaDashboardView } from '@/features/healthcare/dashboard-views';

/**
 * The community health worker's home.
 *
 * A server component, so the session is read from the cookie and the dashboard is
 * fetched with the caller's own store — RLS applies to the very first read of the
 * page, not only to the actions taken from it. A member who types this path gets the
 * "not your workspace" screen and no numbers, because the role check happens before the
 * fetch rather than after it, and a visitor with no session is sent to the ASHA sign-in
 * page rather than being left on a portal they cannot use.
 */
export default async function ASHAPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  const page = await resolvePageFor('ASHA');
  if (page.status !== 'ok') {
    return <HealthcarePageGate status={page.status} portal="ASHA" locale={locale} />;
  }

  const dashboard = await getAshaDashboard(page.store, { actor: page.actor });

  return <AshaDashboardView dashboard={dashboard} locale={locale} />;
}
