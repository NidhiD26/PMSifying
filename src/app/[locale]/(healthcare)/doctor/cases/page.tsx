import * as React from 'react';
import { isValidLocale } from '@/i18n/config';
import { DEFAULT_LOCALE } from '@/types/i18n';
import { resolvePageFor } from '@/lib/healthcare/page-guard';
import { listCases } from '@/lib/healthcare/service';
import { HealthcarePageGate } from '@/features/healthcare/healthcare-page-gate';
import { CaseListView } from '@/features/healthcare/case-views';

/**
 * The cases under this clinician's care.
 *
 * `listCases` for a doctor returns the cases they were referred, which is the whole
 * unit of access: the case and the one member on it, never the household that member
 * happens to belong to. The list therefore has no household column to leak through.
 */
export default async function DoctorCasesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  const page = await resolvePageFor('DOCTOR');
  if (page.status !== 'ok') {
    return <HealthcarePageGate status={page.status} portal="DOCTOR" locale={locale} />;
  }

  const cases = await listCases(page.store, { actor: page.actor, query: {} });

  return <CaseListView cases={cases} locale={locale} basePath="/doctor/cases" />;
}
