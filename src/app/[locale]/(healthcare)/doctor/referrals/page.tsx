import * as React from 'react';
import { withLocale } from '@/lib/navigation/locale-path';
import { isValidLocale } from '@/i18n/config';
import { DEFAULT_LOCALE } from '@/types/i18n';
import { resolvePageFor } from '@/lib/healthcare/page-guard';
import { listReferrals } from '@/lib/healthcare/service';
import { PortalGate } from '@/features/healthcare/portal-gate';
import { ReferralListView } from '@/features/healthcare/queue-views';

/**
 * The referral queue.
 *
 * A clinician's list is the referrals addressed to them, and accept / start review /
 * complete sit on the rows, because those three transitions are the work and a detail
 * page in between would be three extra taps per referral for no information the row does
 * not already carry.
 *
 * The controls follow the row's state and the service enforces the same transitions
 * again. That redundancy is deliberate: a stale button is a control the worker can see
 * is wrong, whereas a request that fails on a hidden rule is a failure the interface
 * has to explain after the fact.
 */
export default async function DoctorReferralsPage({
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

  const referrals = await listReferrals(page.store, { actor: page.actor, query: {} });

  return <ReferralListView referrals={referrals} role="DOCTOR" />;
}
