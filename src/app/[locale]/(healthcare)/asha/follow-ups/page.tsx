import * as React from 'react';
import { isValidLocale } from '@/i18n/config';
import { DEFAULT_LOCALE } from '@/types/i18n';
import { resolvePageFor } from '@/lib/healthcare/page-guard';
import { listFollowUps } from '@/lib/healthcare/service';
import { HealthcarePageGate } from '@/features/healthcare/healthcare-page-gate';
import { FollowUpListView } from '@/features/healthcare/queue-views';

/**
 * Follow-ups addressed to this worker.
 *
 * The list is keyed on the caller's own account rather than on the `ASHA` role, so it
 * holds the visits this worker was actually given and not every visit in the patch. A
 * role-wide list would be a to-do list for a colleague, which is both noise and a small
 * disclosure about the rest of the caseload.
 */
export default async function ASHAFollowUpsPage({
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

  const followUps = await listFollowUps(page.store, { actor: page.actor, query: {} });

  return <FollowUpListView followUps={followUps} />;
}
