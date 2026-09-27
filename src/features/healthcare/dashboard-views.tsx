'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { AshaDashboardDto, DoctorDashboardDto } from '@/types/healthcare';
import type { Locale } from '@/types/i18n';
import { EmptyState } from '@/components/ui/state';
import { CalendarCheck, FileText, Stethoscope, Users, UserPlus } from 'lucide-react';
import { RecordDate, Section, StatusBadge, TableHead, TableShell } from './record-parts';
import { StatList, type Stat } from './stat-list';
import { ConfidentialityNote, PageHeader } from './portal-gate';

/**
 * The two role dashboards.
 *
 * A community health worker's day is a list of houses to visit; a clinician's is a list
 * of referrals to read. So each dashboard opens with the counts that decide what to do
 * next and the rows that decide it, and neither opens with a wall of panels.
 *
 * The counts are the server's, not computed here. `getAshaDashboard` is the only
 * place that knows what "open" means for a case and what window counts as "this month",
 * and a dashboard that re-derived them would eventually disagree with the queue it is
 * summarising — which is the kind of disagreement that erodes trust in a record.
 */

const AshaDashboardView: React.FC<{ dashboard: AshaDashboardDto; locale: Locale }> = ({
  dashboard,
  locale,
}) => {
  const t = useTranslations('healthcare');

  const stats: Stat[] = [
    { label: t('dashboard.assignedHouseholds'), value: dashboard.assignedHouseholds, href: withPath('/asha/households', locale) },
    { label: t('dashboard.householdMembers'), value: dashboard.householdMembers },
    { label: t('dashboard.openCases'), value: dashboard.openCases, href: withPath('/asha/cases', locale) },
    {
      label: t('dashboard.pendingReferrals'),
      value: dashboard.pendingReferrals,
      href: withPath('/asha/referrals', locale),
    },
    {
      label: t('dashboard.upcomingFollowUps'),
      value: dashboard.upcomingFollowUps,
      href: withPath('/asha/follow-ups', locale),
    },
    { label: t('dashboard.campsThisMonth'), value: dashboard.campsThisMonth, href: withPath('/health-camps', locale) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title={t('dashboard.ashaTitle')} description={t('dashboard.ashaSubtitle')} />
        <a
          href={withPath('/asha/register', locale)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#E8837D] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#d9706a]"
        >
          <UserPlus className="h-4 w-4" />
          <span>Register Woman & Create Case</span>
        </a>
      </div>
      <ConfidentialityNote />

      <StatList stats={stats} caption={t('dashboard.ashaTitle')} />

      <Section title={t('dashboard.recentCases')}>
        {dashboard.recentCases.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title={t('cases.empty.title')}
            description={t('cases.empty.body')}
          />
        ) : (
          <TableShell caption={t('dashboard.recentCases')}>
            <TableHead
              columns={[t('cases.member'), t('cases.summary'), t('cases.priority'), t('cases.status')]}
            />
            <tbody className="divide-y divide-[#E2D8D0]">
              {dashboard.recentCases.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-[#1E1E24]">
                    {row.memberName}
                    <span className="block font-mono text-xs font-normal text-[#5A5A66]">
                      {row.caseNumber}
                    </span>
                  </th>
                  <td className="px-4 py-3 text-[#5A5A66]">{row.summary}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Section>

      <Section title={t('dashboard.pendingReferralList')}>
        {dashboard.pendingReferralList.length === 0 ? (
          <EmptyState
            icon={<Stethoscope className="h-6 w-6" />}
            title={t('referrals.empty.title')}
            description={t('referrals.empty.body')}
          />
        ) : (
          <TableShell caption={t('dashboard.pendingReferralList')}>
            <TableHead columns={[t('cases.member'), t('referrals.reason'), t('referrals.priority')]} />
            <tbody className="divide-y divide-[#E2D8D0]">
              {dashboard.pendingReferralList.map((referral) => (
                <tr key={referral.id}>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-[#1E1E24]">
                    {referral.memberName}
                  </th>
                  <td className="px-4 py-3 text-[#5A5A66]">{referral.reason}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={referral.priority} />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Section>

      <Section title={t('dashboard.followUpList')}>
        {dashboard.upcomingFollowUpsList.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck className="h-6 w-6" />}
            title={t('followUps.empty.title')}
            description={t('followUps.empty.body')}
          />
        ) : (
          <TableShell caption={t('dashboard.followUpList')}>
            <TableHead columns={[t('cases.member'), t('followUps.due'), t('cases.status')]} />
            <tbody className="divide-y divide-[#E2D8D0]">
              {dashboard.upcomingFollowUpsList.map((followUp) => (
                <tr key={followUp.id}>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-[#1E1E24]">
                    {followUp.memberName}
                  </th>
                  <td className="px-4 py-3">
                    <RecordDate value={followUp.dueDate} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={followUp.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Section>

      {dashboard.campActivity.length > 0 ? (
        <Section title={t('dashboard.campActivity')}>
          <ul className="space-y-2">
            {dashboard.campActivity.map((camp) => (
              <li
                key={camp.campId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] px-4 py-3"
              >
                <span className="text-sm text-[#1E1E24]">{camp.title}</span>
                <span className="flex items-center gap-3 text-xs text-[#5A5A66]">
                  <RecordDate value={camp.campDate} />
                  <StatusBadge status={camp.status} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <p className="flex flex-wrap gap-4 text-sm">
        <a className="underline underline-offset-4" href={withPath('/asha/households', locale)}>
          <Users className="mr-1 inline h-4 w-4" aria-hidden="true" />
          {t('households.title')}
        </a>
        <a className="underline underline-offset-4" href={withPath('/asha/follow-ups', locale)}>
          {t('followUps.title')}
        </a>
      </p>
    </div>
  );
};

const DoctorDashboardView: React.FC<{ dashboard: DoctorDashboardDto; locale: Locale }> = ({
  dashboard,
  locale,
}) => {
  const t = useTranslations('healthcare');

  const stats: Stat[] = [
    {
      label: t('dashboard.pendingReferrals'),
      value: dashboard.pendingReferrals,
      href: withPath('/doctor/referrals', locale),
    },
    {
      label: t('dashboard.casesUnderReview'),
      value: dashboard.casesUnderReview,
      href: withPath('/doctor/cases', locale),
    },
    {
      label: t('dashboard.followUpsDue'),
      value: dashboard.followUpsDue,
      href: withPath('/doctor/follow-ups', locale),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('dashboard.doctorTitle')} description={t('dashboard.doctorSubtitle')} />
      <ConfidentialityNote />

      <StatList stats={stats} caption={t('dashboard.doctorTitle')} />

      <Section title={t('dashboard.pendingReferralList')}>
        {dashboard.pendingReferralList.length === 0 ? (
          <EmptyState
            icon={<Stethoscope className="h-6 w-6" />}
            title={t('referrals.empty.title')}
            description={t('referrals.empty.body')}
          />
        ) : (
          <TableShell caption={t('dashboard.pendingReferralList')}>
            <TableHead
              columns={[
                t('cases.member'),
                t('referrals.reason'),
                t('referrals.priority'),
                t('cases.status'),
              ]}
            />
            <tbody className="divide-y divide-[#E2D8D0]">
              {dashboard.pendingReferralList.map((referral) => (
                <tr key={referral.id}>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-[#1E1E24]">
                    {referral.memberName}
                    <span className="block font-mono text-xs font-normal text-[#5A5A66]">
                      {referral.caseNumber}
                    </span>
                  </th>
                  <td className="px-4 py-3 text-[#5A5A66]">{referral.reason}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={referral.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={referral.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Section>

      <Section title={t('dashboard.recentCases')}>
        {dashboard.recentCases.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title={t('cases.empty.title')}
            description={t('cases.empty.body')}
          />
        ) : (
          <TableShell caption={t('dashboard.recentCases')}>
            <TableHead columns={[t('cases.member'), t('cases.summary'), t('cases.status')]} />
            <tbody className="divide-y divide-[#E2D8D0]">
              {dashboard.recentCases.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-[#1E1E24]">
                    {row.memberName}
                    <span className="block font-mono text-xs font-normal text-[#5A5A66]">
                      {row.caseNumber}
                    </span>
                  </th>
                  <td className="px-4 py-3 text-[#5A5A66]">{row.summary}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Section>

      {dashboard.campReferrals.length > 0 ? (
        <Section title={t('dashboard.campActivity')}>
          <ul className="space-y-2">
            {dashboard.campReferrals.map((referral) => (
              <li
                key={referral.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] px-4 py-3"
              >
                <span className="text-sm text-[#1E1E24]">{referral.memberName}</span>
                <span className="flex items-center gap-3 text-xs text-[#5A5A66]">
                  {referral.reason}
                  <StatusBadge status={referral.status} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/*
        The follow-ups a clinician is due to make, on the dashboard rather than behind
        the follow-up queue. A clinician's due list is short — it is the visits they
        themselves have to make — and burying it one navigation step away is how a
        follow-up silently becomes a follow-up next month.
      */}
      {dashboard.followUpList.length > 0 ? (
        <Section title={t('dashboard.followUpList')}>
          <ul className="space-y-2">
            {dashboard.followUpList.map((followUp) => (
              <li
                key={followUp.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] px-4 py-3"
              >
                <span className="text-sm text-[#1E1E24]">
                  {followUp.memberName}
                  {followUp.notes ? (
                    <span className="block text-xs text-[#5A5A66]">{followUp.notes}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-3 text-xs text-[#5A5A66]">
                  <RecordDate value={followUp.dueDate} />
                  <StatusBadge status={followUp.status} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
};

/** Localised path, so a dashboard link survives a language switch. */
function withPath(path: string, locale: Locale): string {
  return locale === 'en' ? path : `/${locale}${path}`;
}

export { AshaDashboardView, DoctorDashboardView };
