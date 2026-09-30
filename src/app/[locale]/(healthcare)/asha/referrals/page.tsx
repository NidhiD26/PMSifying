import * as React from 'react';
import { isValidLocale } from '@/i18n/config';
import { DEFAULT_LOCALE } from '@/types/i18n';
import { resolvePageFor } from '@/lib/healthcare/page-guard';
import { listReferrals } from '@/lib/healthcare/service';
import { HealthcarePageGate } from '@/features/healthcare/healthcare-page-gate';
import { ReferralListView } from '@/features/healthcare/queue-views';

/**
 * The referrals this worker raised.
 *
 * `listReferrals` returns the caller's own referrals, so a worker sees what they sent
 * and whether anybody picked it up. The cancel control sits here rather than on the
 * clinician's side because a referral nobody has accepted is still the worker's to
 * withdraw — and once it is accepted it is not, which is why the row hides the button
 * at that point and the service refuses it as well.
 */
export default async function ASHAReferralsPage({
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

  const referrals = await listReferrals(page.store, { actor: page.actor, query: {} });

  return <ReferralListView referrals={referrals} role="ASHA" locale={locale} />;
}
