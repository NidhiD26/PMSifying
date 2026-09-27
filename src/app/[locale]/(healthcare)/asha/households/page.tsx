import * as React from 'react';
import { withLocale } from '@/lib/navigation/locale-path';
import { isValidLocale } from '@/i18n/config';
import { DEFAULT_LOCALE } from '@/types/i18n';
import { resolvePageFor } from '@/lib/healthcare/page-guard';
import { listHouseholds } from '@/lib/healthcare/service';
import { PortalGate } from '@/features/healthcare/portal-gate';
import { HouseholdListView } from '@/features/healthcare/household-views';

/** The households in this worker's patch. Nobody else's, and never a whole register. */
export default async function ASHAHouseholdsPage({
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

  const households = await listHouseholds(page.store, { actor: page.actor });

  return (
    <HouseholdListView
      households={households}
      locale={locale}
      basePath="/asha/households"
      casesPath="/asha/cases"
    />
  );
}
