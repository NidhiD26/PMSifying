import * as React from 'react';
import { getTranslations } from 'next-intl/server';
import { withLocale } from '@/lib/navigation/locale-path';
import { isValidLocale } from '@/i18n/config';
import { DEFAULT_LOCALE } from '@/types/i18n';
import { resolvePageFor } from '@/lib/healthcare/page-guard';
import { getCaseReview, listDoctors } from '@/lib/healthcare/service';
import { isApiError } from '@/lib/api/errors';
import { HealthcarePageGate } from '@/features/healthcare/healthcare-page-gate';
import { UnavailablePanel } from '@/features/healthcare/unavailable-panel';
import { CaseReviewView } from '@/features/healthcare/case-views';

/**
 * One case for the worker who raised it.
 *
 * The worker's view of their own case carries the same single member a clinician's does
 * — a worker looking at a case is looking at the person in it, and the household
 * register is one page away rather than folded into this one. The forms are the other
 * difference: a worker records observations here and can withdraw a referral, and is
 * offered nothing to do with a prescription or a clinical note, because the service
 * would refuse it.
 */
export default async function ASHACaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string; locale: string }>;
}) {
  const { caseId, locale: rawLocale } = await params;
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const t = await getTranslations('healthcare');

  const page = await resolvePageFor('ASHA');
  if (page.status !== 'ok') {
    return <HealthcarePageGate status={page.status} portal="ASHA" locale={locale} />;
  }

  let review;
  try {
    review = await getCaseReview(page.store, { actor: page.actor, caseId });
  } catch (error) {
    const code = isApiError(error) && error.code === 'not_found' ? 'not_found' : 'unknown';
    return (
      <UnavailablePanel
        message={t(`errors.${code}`)}
        backHref={withLocale('/asha/cases', locale)}
        backLabel={t('actions.back')}
      />
    );
  }

  /*
   * The doctor roster, read on the server and shaped into select options here.
   *
   * `listDoctors` refuses a member, and the page is already resolved to `ASHA`, so this
   * cannot fail into a page that offers a referral to somebody with no doctors to refer
   * to. It is read here rather than in the browser so the option values are the ids the
   * server published; the form has no way to produce a doctor id of its own.
   */
  const doctors = await listDoctors(page.store, { actor: page.actor });
  const doctorOptions = doctors.map((doctor) => ({
    value: doctor.id,
    // The registration number and speciality are already on the wire, so the label can
    // carry the two things that distinguish one doctor from another at a glance —
    // otherwise the dropdown is a list of names with no way to tell them apart.
    label: [doctor.fullName, doctor.registrationNumber, doctor.speciality]
      .filter(Boolean)
      .join(' · '),
  }));

  return (
    <CaseReviewView
      review={review}
      locale={locale}
      role="ASHA"
      backPath="/asha/cases"
      doctorOptions={doctorOptions}
    />
  );
}
