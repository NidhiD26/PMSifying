import * as React from 'react';
import { withLocale } from '@/lib/navigation/locale-path';
import { isValidLocale } from '@/i18n/config';
import { DEFAULT_LOCALE } from '@/types/i18n';
import { resolvePageFor } from '@/lib/healthcare/page-guard';
import { PortalGate } from '@/features/healthcare/portal-gate';
import { RegisterWomanForm } from '@/features/healthcare/register-woman-form';

export default async function ASHARegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  const page = await resolvePageFor('ASHA');
  if (page.status !== 'ok') {
    return <PortalGate status={page.status} homeHref={withLocale('/asha/login', locale)} />;
  }

  return (
    <div className="space-y-6">
      <RegisterWomanForm locale={locale} />
    </div>
  );
}
