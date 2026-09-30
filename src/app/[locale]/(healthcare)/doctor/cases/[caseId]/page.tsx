import * as React from 'react';
import { getTranslations } from 'next-intl/server';
import { withLocale } from '@/lib/navigation/locale-path';
import { isValidLocale } from '@/i18n/config';
import { DEFAULT_LOCALE } from '@/types/i18n';
import { resolvePageFor } from '@/lib/healthcare/page-guard';
import { getCaseReview, listCamps } from '@/lib/healthcare/service';
import { isApiError } from '@/lib/api/errors';
import { HealthcarePageGate } from '@/features/healthcare/healthcare-page-gate';
import { UnavailablePanel } from '@/features/healthcare/unavailable-panel';
import { CaseReviewView } from '@/features/healthcare/case-views';

export default async function DoctorCaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string; locale: string }>;
}) {
  const { caseId, locale: rawLocale } = await params;
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const t = await getTranslations('healthcare');

  const page = await resolvePageFor('DOCTOR');
  if (page.status !== 'ok') {
    return <HealthcarePageGate status={page.status} portal="DOCTOR" locale={locale} />;
  }

  let review;
  let camps = [];
  try {
    [review, camps] = await Promise.all([
      getCaseReview(page.store, { actor: page.actor, caseId }),
      listCamps(page.store, { actor: page.actor }),
    ]);
  } catch (error) {
    const code = isApiError(error) && error.code === 'not_found' ? 'not_found' : 'unknown';
    return (
      <UnavailablePanel
        message={t(`errors.${code}`)}
        backHref={withLocale('/doctor/cases', locale)}
        backLabel={t('actions.back')}
      />
    );
  }

  const campOptions = camps
    .filter((c) => c.status === 'PUBLISHED' && c.campDate >= new Date().toISOString().slice(0, 10))
    .map((c) => ({
      value: c.id,
      label: `${c.title} (${c.campDate} · ${c.location})`,
    }));

  return (
    <CaseReviewView
      review={review}
      locale={locale}
      role="DOCTOR"
      canManageReferral
      backPath="/doctor/cases"
      campOptions={campOptions}
    />
  );
}
