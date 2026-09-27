import * as React from 'react';
import { withLocale } from '@/lib/navigation/locale-path';
import { isValidLocale } from '@/i18n/config';
import { DEFAULT_LOCALE } from '@/types/i18n';
import { resolvePageFor } from '@/lib/healthcare/page-guard';
import { getDoctorDashboard } from '@/lib/healthcare/service';
import { PortalGate } from '@/features/healthcare/portal-gate';
import { DoctorDashboardView } from '@/features/healthcare/dashboard-views';

/**
 * The clinician's home: referrals waiting to be read, cases under review, visits due.
 *
 * Read on the server with the caller's own store, so the queue the dashboard summarises
 * is the same queue the RLS policies produced, and a doctor who is not signed in is
 * refused before a single count is read rather than after.
 */
export default async function DoctorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  const page = await resolvePageFor('DOCTOR');
  if (page.status !== 'ok') {
    return <PortalGate status={page.status} homeHref={withLocale('/', locale)} />;
  }

  const dashboard = await getDoctorDashboard(page.store, { actor: page.actor });

  return <DoctorDashboardView dashboard={dashboard} locale={locale} />;
}
