'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { CampRosterEntryDto, HealthCampDto } from '@/types/healthcare';
import type { Locale } from '@/types/i18n';
import { EmptyState } from '@/components/ui/state';
import { HeartPulse } from 'lucide-react';
import { RecordDate, RecordLink, Section, StatusBadge, TableHead, TableShell } from './record-parts';
import { PageHeader } from './portal-gate';
import { HealthcareAction } from './healthcare-action';

/**
 * Health camps, and the roster behind one.
 *
 * The camp list is the one healthcare page a plain member reaches, because a published
 * camp is open to whoever turns up — which is why the register control is on the card
 * and not behind a sign-in. Everything past registration (the roster, the attendance
 * marks) is staff-only, and the roster is only ever rendered when the server has given
 * one, so there is no version of this page that shows who else came.
 *
 * THE ROSTER IS THE MOST SENSITIVE LIST IN THE FEATURE
 * It is a room of people who were all in the same place, which makes it a map of a
 * village's health-seeking in one screen. So it is not on the public camp page, it is
 * marked from the camp page only by an organiser or an administrator, and what a mark
 * records is an attendance state — never a symptom, a diagnosis or a note.
 */

const CampListView: React.FC<{
  camps: HealthCampDto[];
  locale: Locale;
  /** Staff see a count of cases that came out of the camp; a member does not. */
  showReferredCount?: boolean;
}> = ({ camps, locale, showReferredCount = false }) => {
  const t = useTranslations('healthcare');

  if (camps.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('camps.title')} description={t('camps.subtitle')} />
        <EmptyState
          icon={<HeartPulse className="h-6 w-6" />}
          title={t('camps.empty.title')}
          description={t('camps.empty.body')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('camps.title')} description={t('camps.subtitle')} />

      <ul className="space-y-3">
        {camps.map((camp) => {
          const placesLeft = Math.max(camp.capacity - camp.registeredCount, 0);
          return (
            <li key={camp.id} className="rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h2 className="text-base font-semibold text-[#2D1B2D]">{camp.title}</h2>
                  {camp.description ? (
                    <p className="text-sm text-[#5A5A66]">{camp.description}</p>
                  ) : null}
                </div>
                <StatusBadge status={camp.status} />
              </div>

              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <CampFact label={t('camps.date')}>
                  <RecordDate value={camp.campDate} />
                </CampFact>
                <CampFact label={t('camps.time')}>
                  {camp.startTime} – {camp.endTime}
                </CampFact>
                <CampFact label={t('camps.location')}>{camp.location}</CampFact>
                <CampFact label={t('camps.capacity')}>
                  {t('camps.registered')} {camp.registeredCount} / {camp.capacity}
                </CampFact>
              </dl>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {camp.isRegisteredByViewer ? (
                  <>
                    <span className="text-sm font-medium text-[#2E8B57]">
                      {t('camps.registered_action')}
                    </span>
                    {/*
                      Cancelling is offered on a finished camp as well as a published
                      one, which is what `cancelCampRegistration` allows and the case it
                      was written for: somebody who signed up in the morning and cannot
                      come, after the camp has been marked complete. Leaving their seat
                      on the register is the thing that makes somebody wait.
                    */}
                    <HealthcareAction
                      path={`/camps/${camp.id}/registrations`}
                      method="DELETE"
                      size="sm"
                      variant="outline"
                    >
                      {t('camps.cancelRegistration')}
                    </HealthcareAction>
                  </>
                ) : camp.status !== 'PUBLISHED' ? null : camp.isFull ? (
                  <span className="text-sm text-[#5A5A66]">{t('camps.full')}</span>
                ) : (
                  <>
                    <span className="text-sm text-[#5A5A66]">
                      {t('camps.spotsLeft', { count: placesLeft })}
                    </span>
                    <HealthcareAction
                      path={`/camps/${camp.id}/registrations`}
                      size="sm"
                      variant="secondary"
                    >
                      {t('camps.register')}
                    </HealthcareAction>
                  </>
                )}
                <RecordLink href={`/health-camps/${camp.id}`} locale={locale}>
                  {t('camps.open')}
                </RecordLink>
                {showReferredCount && typeof camp.referredCaseCount === 'number' ? (
                  <span className="text-xs text-[#5A5A66]">
                    {t('dashboard.campActivity')}: {camp.referredCaseCount}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const CampDetailView: React.FC<{
  camp: HealthCampDto;
  locale: Locale;
  /** Present only for an organiser or an administrator. */
  roster?: CampRosterEntryDto[];
  canMarkAttendance?: boolean;
  canChangeStatus?: boolean;
}> = ({ camp, locale, roster, canMarkAttendance = false, canChangeStatus = false }) => {
  const t = useTranslations('healthcare');

  return (
    <div className="space-y-6">
      <PageHeader
        title={camp.title}
        description={[camp.campDate, camp.startTime, camp.location].filter(Boolean).join(' · ')}
      />

      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <CampFact label={t('camps.capacity')}>
          {t('camps.registered')} {camp.registeredCount} / {camp.capacity}
        </CampFact>
        <CampFact label={t('camps.attended')}>{camp.attendedCount}</CampFact>
      </dl>

      {canChangeStatus ? (
        <Section title={t('camps.statusChanges')}>
          {/*
            One button per legal move, from `HEALTH_CAMP_TRANSITIONS`: a draft may be
            published or cancelled, a published camp may be completed or cancelled, and
            nothing leaves a completed or cancelled camp. A completed camp is not
            reopenable, because attendance is recorded against it and reopening would
            put an event that has happened back on the list of camps to attend.
          */}
          <div className="flex flex-wrap gap-2">
            {camp.status === 'DRAFT' ? (
              <HealthcareAction
                path={`/camps/${camp.id}/status`}
                body={{ status: 'PUBLISHED' }}
                size="sm"
                variant="secondary"
              >
                {t('camps.publish')}
              </HealthcareAction>
            ) : null}
            {camp.status === 'PUBLISHED' ? (
              <HealthcareAction
                path={`/camps/${camp.id}/status`}
                body={{ status: 'COMPLETED' }}
                size="sm"
                variant="secondary"
              >
                {t('camps.completeCamp')}
              </HealthcareAction>
            ) : null}
            {camp.status === 'DRAFT' || camp.status === 'PUBLISHED' ? (
              <HealthcareAction
                path={`/camps/${camp.id}/status`}
                body={{ status: 'CANCELLED' }}
                size="sm"
                variant="outline"
              >
                {t('camps.cancelCamp')}
              </HealthcareAction>
            ) : null}
          </div>
        </Section>
      ) : null}

      {roster ? (
        <Section title={t('camps.roster.title')}>
          {roster.length === 0 ? (
            <EmptyState
              icon={<HeartPulse className="h-6 w-6" />}
              title={t('camps.roster.empty.title')}
              description={t('camps.roster.empty.body')}
            />
          ) : (
            <TableShell caption={t('camps.roster.title')}>
              <TableHead
                columns={[
                  t('camps.roster.attendee'),
                  t('camps.roster.attendance'),
                  ...(canMarkAttendance ? [t('actions.open')] : []),
                ]}
              />
              <tbody className="divide-y divide-[#E2D8D0]">
                {roster.map((entry) => (
                  <tr key={entry.registrationId}>
                    <th scope="row" className="px-4 py-3 text-left font-medium text-[#1E1E24]">
                      {entry.userId}
                    </th>
                    <td className="px-4 py-3">
                      <StatusBadge status={entry.attendanceStatus} />
                    </td>
                    {canMarkAttendance ? (
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap gap-2">
                          <HealthcareAction
                            path={`/camps/${camp.id}/registrations/${entry.registrationId}/attendance`}
                            body={{ status: 'ATTENDED' }}
                            size="sm"
                            variant="secondary"
                          >
                            {t('camps.roster.markAttended')}
                          </HealthcareAction>
                          <HealthcareAction
                            path={`/camps/${camp.id}/registrations/${entry.registrationId}/attendance`}
                            body={{ status: 'ABSENT' }}
                            size="sm"
                            variant="outline"
                          >
                            {t('camps.roster.markAbsent')}
                          </HealthcareAction>
                        </span>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </Section>
      ) : null}

      <p className="text-xs text-[#5A5A66]">
        <RecordLink href="/health-camps" locale={locale}>
          {t('actions.back')}
        </RecordLink>
      </p>
    </div>
  );
};

const CampFact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex gap-2">
    <dt className="shrink-0 text-[#5A5A66]">{label}:</dt>
    <dd className="text-[#1E1E24]">{children}</dd>
  </div>
);

export { CampListView, CampDetailView };
