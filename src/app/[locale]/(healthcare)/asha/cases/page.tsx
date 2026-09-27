import * as React from 'react';
import { withLocale } from '@/lib/navigation/locale-path';
import { isValidLocale } from '@/i18n/config';
import { DEFAULT_LOCALE } from '@/types/i18n';
import { resolvePageFor } from '@/lib/healthcare/page-guard';
import { listCases } from '@/lib/healthcare/service';
import { PortalGate } from '@/features/healthcare/portal-gate';
import { CaseListView } from '@/features/healthcare/case-views';

/**
 * The worker's cases.
 *
 * `listCases` scopes to the caller's own patch, so the query the page passes is only a
 * page size: there is no `assignedTo` filter to supply, and no way for the URL to ask
 * for somebody else's work.
 */
export default async function ASHACasesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  const page = await resolvePageFor('ASHA');
  if (page.status !== 'ok') {
    return <PortalGate status={page.status} homeHref={withLocale('/', locale)} />;
  }

  const cases = await listCases(page.store, { actor: page.actor, query: {} });

  return <CaseListView cases={cases} locale={locale} basePath="/asha/cases" />;
}
