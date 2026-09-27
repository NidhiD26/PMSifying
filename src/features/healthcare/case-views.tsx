'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { CaseReviewDto, CaseSummaryDto } from '@/types/healthcare';
import type { Locale } from '@/types/i18n';
import { EmptyState } from '@/components/ui/state';
import { FileText } from 'lucide-react';
import {
  RecordDate,
  RecordLink,
  Section,
  StatusBadge,
  TableHead,
  TableShell,
} from './record-parts';
import { ConfidentialityNote, PageHeader } from './portal-gate';
import { HealthcareAction } from './healthcare-action';
import { ClinicalNoteForm, FollowUpForm, ObservationForm, PrescriptionForm, ReferralForm, RecommendCampForm } from './case-forms';

/**
 * Cases, and one case in full.
 *
 * The list is the queue: who, which household, how urgent, what is the state. The
 * review page is the clinical record, and its order is the order a clinician reads in
 * — who this is, why they were referred, what was observed, what has been said and
 * prescribed, and what is still outstanding.
 *
 * WHAT IS NOT ON THE REVIEW PAGE
 * The rest of the household. The DTO carries one member, so there is nothing to render
 * even if a future change wanted to: see `src/test/healthcare-privacy.test.ts`. What a
 * clinician is entitled to is the patient in front of them, and the household code
 * identifies the family without listing it.
 */

export const CaseListView: React.FC<{
  cases: CaseSummaryDto[];
  locale: Locale;
  basePath: string;
}> = ({ cases, locale, basePath }) => {
  const t = useTranslations('healthcare');

  if (cases.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('cases.title')} description={t('cases.subtitle')} />
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={t('cases.empty.title')}
          description={t('cases.empty.body')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('cases.title')} description={t('cases.subtitle')} />
      <ConfidentialityNote />

      <TableShell caption={t('cases.title')}>
        <TableHead
          columns={[
            t('cases.member'),
            t('cases.household'),
            t('cases.summary'),
            t('cases.priority'),
            t('cases.status'),
            t('cases.opened'),
          ]}
        />
        <tbody className="divide-y divide-[#E2D8D0]">
          {cases.map((row) => (
            <tr key={row.id}>
              <th scope="row" className="px-4 py-3 text-left font-medium text-[#1E1E24]">
                <RecordLink href={`${basePath}/${row.id}`} locale={locale}>
                  {row.memberName}
                </RecordLink>
              </th>
              <td className="px-4 py-3 font-mono text-xs text-[#5A5A66]">{row.householdCode}</td>
              <td className="px-4 py-3 text-[#5A5A66]">{row.summary}</td>
              <td className="px-4 py-3">
                <StatusBadge status={row.priority} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-4 py-3">
                <RecordDate value={row.openedAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
};

export const CaseReviewView: React.FC<{
  review: CaseReviewDto;
  locale: Locale;
  /** Present only for a doctor: the referral actions the workflow allows. */
  canManageReferral?: boolean;
  /** Where "back" goes. The two roles arrive at a case from different queues. */
  backPath?: string;
  /**
   * Which set of forms to offer, and it is the role rather than a set of booleans
   * because the split is the workflow: the worker writes what they saw in the house,
   * the clinician writes what they concluded. Offering a worker a prescription form, or
   * a clinician an observation form, would be offering a control the service refuses.
   */
  role?: 'ASHA' | 'DOCTOR';
  /**
   * The doctors a worker may refer to, already shaped as `{value, label}` options.
   *
   * Passed in from the server page rather than fetched in the browser because the roster
   * is staff-only (`listDoctors` refuses a member) and because the options must be the
   * ones the server offered: a client that could invent a doctor id would defeat the
   * whole point of the roster being the source of the choice.
   */
  doctorOptions?: { value: string; label: string }[];
  campOptions?: { value: string; label: string }[];
}> = ({
  review,
  locale,
  canManageReferral = false,
  backPath = '/doctor/cases',
  role,
  doctorOptions = [],
  campOptions = [],
}) => {
  const t = useTranslations('healthcare');
  const { case: record, member, observations, referrals, clinicalNotes, prescriptions, followUps } =
    review;
  const pendingReferral = referrals.find((referral) => referral.status !== 'COMPLETED');
  const isAsha = role === 'ASHA';
  const isDoctor = role === 'DOCTOR';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t('caseReview.title')} · ${record.caseNumber}`}
        description={record.summary}
      />
      <ConfidentialityNote />

      <Section title={t('caseReview.member')}>
        <dl className="divide-y divide-[#E2D8D0] rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF]">
          <div className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-[#5A5A66]">{t('cases.member')}</dt>
            <dd className="text-sm font-medium text-[#1E1E24]">{member.fullName}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-[#5A5A66]">{t('members.age')}</dt>
            <dd className="text-sm font-medium text-[#1E1E24]">
              {member.ageYears === null
                ? t('members.ageUnknown')
                : t('members.years', { age: member.ageYears })}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-[#5A5A66]">{t('cases.household')}</dt>
            <dd className="font-mono text-xs text-[#5A5A66]">{review.householdCode}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-[#5A5A66]">{t('cases.status')}</dt>
            <dd>
              <StatusBadge status={record.status} />
            </dd>
          </div>
        </dl>
      </Section>

      {pendingReferral ? (
        <Section
          title={t('caseReview.referralReason')}
          action={
            canManageReferral ? (
              <span className="flex flex-wrap gap-2">
                {pendingReferral.status === 'PENDING' ? (
                  <HealthcareAction
                    path={`/referrals/${pendingReferral.id}/accept`}
                    size="sm"
                    variant="secondary"
                  >
                    {t('referrals.action.accept')}
                  </HealthcareAction>
                ) : null}
                {pendingReferral.status === 'ACCEPTED' ? (
                  <HealthcareAction
                    path={`/referrals/${pendingReferral.id}/progress`}
                    body={{ action: 'startReview' }}
                    size="sm"
                    variant="secondary"
                  >
                    {t('referrals.action.startReview')}
                  </HealthcareAction>
                ) : null}
                {pendingReferral.status === 'IN_REVIEW' ? (
                  <HealthcareAction
                    path={`/referrals/${pendingReferral.id}/progress`}
                    body={{ action: 'complete' }}
                    size="sm"
                    variant="secondary"
                  >
                    {t('referrals.action.complete')}
                  </HealthcareAction>
                ) : null}
              </span>
            ) : null
          }
        >
          <p className="rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] px-4 py-3 text-sm text-[#1E1E24]">
            {pendingReferral.reason}
          </p>
          <p className="flex items-center gap-2 text-xs text-[#5A5A66]">
            <StatusBadge status={pendingReferral.status} />
            {pendingReferral.doctorName ?? t('referrals.unassigned')}
          </p>
        </Section>
      ) : null}

      {/*
        Filing a referral, in the worker's own section rather than under the existing
        one. It is offered whenever a worker is on this case, and not only when there is
        no referral yet: a second opinion on the same case is a normal thing to want, and
        a second referral is a separate row with its own doctor, so nothing is
        overwritten. What the service will accept is still the authority — a case that is
        closed takes no referral regardless of what this renders.
      */}
      {isAsha ? (
        <Section title={t('caseReview.referralReason')}>
          {doctorOptions.length === 0 ? (
            <EmptyNote
              title={t('referrals.noDoctors.title')}
              body={t('referrals.noDoctors.body')}
            />
          ) : (
            <div className="rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] p-4">
              <ReferralForm caseId={record.id} doctors={doctorOptions} />
            </div>
          )}
        </Section>
      ) : null}

      <Section title={t('caseReview.history')}>
        {observations.length === 0 ? (
          <EmptyNote title={t('caseReview.emptyObservations.title')} body={t('caseReview.emptyObservations.body')} />
        ) : (
          <ol className="space-y-3">
            {observations.map((observation) => (
              <li
                key={observation.id}
                className="rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <RecordDate value={observation.observedOn} />
                  <StatusBadge status={observation.severity} />
                </div>
                <p className="mt-2 text-sm text-[#1E1E24]">
                  {t('observations.symptoms')}: {observation.reportedSymptoms.join(', ')}
                </p>
                {observation.durationDays !== null ? (
                  <p className="mt-1 text-xs text-[#5A5A66]">
                    {t('observations.duration')}:{' '}
                    {t('observations.durationDays', { count: observation.durationDays })}
                  </p>
                ) : null}
                {observation.notes ? (
                  <p className="mt-1 text-xs text-[#5A5A66]">{observation.notes}</p>
                ) : null}
                <p className="mt-2 text-xs text-[#5A5A66]">
                  {t('observations.recordedBy')}: {observation.recordedByName}
                </p>
              </li>
            ))}
          </ol>
        )}
        {/*
          The worker's own contribution, inside the observations section rather than in
          a drawer of its own: an observation is written by the person who was in the
          house, and it is the first thing a clinician reads after the referral reason.
        */}
        {isAsha ? (
          <div className="rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] p-4">
            <ObservationForm caseId={record.id} />
          </div>
        ) : null}
      </Section>

      <Section title={t('caseReview.clinicalNotes')}>
        {clinicalNotes.length === 0 ? (
          <EmptyNote title={t('caseReview.emptyNotes.title')} body={t('caseReview.emptyNotes.body')} />
        ) : (
          <ul className="space-y-3">
            {clinicalNotes.map((note) => (
              <li key={note.id} className="rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] p-4">
                <dl className="space-y-1 text-sm">
                  <Field label={t('clinicalNotes.assessment')}>{note.assessment}</Field>
                  {note.observations ? (
                    <Field label={t('clinicalNotes.observations')}>{note.observations}</Field>
                  ) : null}
                  <Field label={t('clinicalNotes.advice')}>{note.advice}</Field>
                  {note.followUpOn ? (
                    <Field label={t('clinicalNotes.followUpOn')}>
                      <RecordDate value={note.followUpOn} />
                    </Field>
                  ) : null}
                </dl>
                <p className="mt-2 text-xs text-[#5A5A66]">
                  {t('clinicalNotes.author')}: {note.doctorName}
                </p>
              </li>
            ))}
          </ul>
        )}
        {isDoctor ? (
          <div className="rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] p-4">
            <ClinicalNoteForm caseId={record.id} />
          </div>
        ) : null}
      </Section>

      <Section title={t('caseReview.prescriptions')}>
        {prescriptions.length === 0 ? (
          <EmptyNote title={t('caseReview.emptyPrescriptions.title')} body={t('caseReview.emptyPrescriptions.body')} />
        ) : (
          <ul className="space-y-3">
            {prescriptions.map((prescription) => (
              <li key={prescription.id} className="rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] p-4">
                <p className="text-sm font-medium text-[#1E1E24]">{prescription.medicineName}</p>
                <dl className="mt-1 space-y-1 text-sm text-[#5A5A66]">
                  <Field label={t('prescriptions.dosage')}>{prescription.dosage}</Field>
                  <Field label={t('prescriptions.frequency')}>{prescription.frequency}</Field>
                  <Field label={t('prescriptions.duration')}>{prescription.duration}</Field>
                  {prescription.instructions ? (
                    <Field label={t('prescriptions.instructions')}>{prescription.instructions}</Field>
                  ) : null}
                </dl>
                <p className="mt-2 text-xs text-[#5A5A66]">
                  {t('prescriptions.prescriber')}: {prescription.doctorName}
                </p>
              </li>
            ))}
          </ul>
        )}
        {isDoctor ? (
          <div className="rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] p-4">
            <PrescriptionForm caseId={record.id} />
          </div>
        ) : null}
      </Section>

      <Section title={t('caseReview.followUps')}>
        {followUps.length === 0 ? (
          <EmptyNote title={t('caseReview.emptyFollowUps.title')} body={t('caseReview.emptyFollowUps.body')} />
        ) : (
          <ul className="space-y-2">
            {followUps.map((followUp) => (
              <li
                key={followUp.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] px-4 py-3"
              >
                <span className="text-sm text-[#1E1E24]">
                  <RecordDate value={followUp.dueDate} />
                </span>
                <StatusBadge status={followUp.status} />
              </li>
            ))}
          </ul>
        )}
        {isDoctor ? (
          <div className="rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] p-4">
            <FollowUpForm caseId={record.id} />
          </div>
        ) : null}
      </Section>

      {isDoctor && campOptions.length > 0 ? (
        <Section title="Health Camp Recommendation">
          <div className="rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] p-4">
            <RecommendCampForm caseId={record.id} camps={campOptions} />
          </div>
        </Section>
      ) : null}

      <p className="text-xs text-[#5A5A66]">
        <RecordLink href={backPath} locale={locale}>
          {t('actions.back')}
        </RecordLink>
      </p>
    </div>
  );
};

/** A label and its value, for the clinical detail lists. */
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex gap-2">
    <dt className="shrink-0 text-[#5A5A66]">{label}:</dt>
    <dd className="text-[#1E1E24]">{children}</dd>
  </div>
);

/** A calm inline "nothing here yet", for a section rather than a whole page. */
const EmptyNote: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div className="rounded-2xl border border-dashed border-[#E2D8D0] bg-[#FFFFFF] px-4 py-6">
    <p className="text-sm font-medium text-[#2D1B2D]">{title}</p>
    <p className="mt-1 text-sm text-[#5A5A66]">{body}</p>
  </div>
);
