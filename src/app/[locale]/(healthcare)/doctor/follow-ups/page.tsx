import * as React from 'react';
import { withLocale } from '@/lib/navigation/locale-path';
import { isValidLocale } from '@/i18n/config';
import { DEFAULT_LOCALE } from '@/types/i18n';
import { resolvePageFor } from '@/lib/healthcare/page-guard';
import { listFollowUps } from '@/lib/healthcare/service';
import { PortalGate } from '@/features/healthcare/portal-gate';
import { FollowUpListView } from '@/features/healthcare/queue-views';

/** The visits this clinician was asked to make, and the ones already made. */
export default async function DoctorFollowUpsPage({
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

  const followUps = await listFollowUps(page.store, { actor: page.actor, query: {} });

  return <FollowUpListView followUps={followUps} />;
}
