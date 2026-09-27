'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { HouseholdDetailDto, HouseholdSummaryDto } from '@/types/healthcare';
import type { Locale } from '@/types/i18n';
import { EmptyState } from '@/components/ui/state';
import { Users } from 'lucide-react';
import {
  RecordLink,
  Section,
  TableHead,
  TableShell,
} from './record-parts';
import { PageHeader, ConfidentialityNote } from './portal-gate';
import { EditHouseholdForm, HouseholdForm, MemberForm } from './household-forms';

/**
 * A community health worker's register.
 *
 * The list is scoped to the worker's own patch, which the service enforces; the
 * subtitle says so, because a worker who sees four households should be able to tell
 * whether four is the answer or the filter.
 *
 * The detail page shows every member of the household, because the worker who owns the
 * patch is entitled to all of them. A doctor is not, and there is deliberately no
 * household page for a doctor to arrive at — see `healthcare-privacy.test.ts`.
 */

export const HouseholdListView: React.FC<{
  households: HouseholdSummaryDto[];
  locale: Locale;
  basePath: string;
  /** Where the worker's cases live, for the link off a household. */
  casesPath: string;
}> = ({ households, locale, basePath, casesPath }) => {
  const t = useTranslations('healthcare');

  return (
    <div className="space-y-6">
      <PageHeader title={t('households.title')} description={t('households.subtitle')} />
      <ConfidentialityNote />

      {households.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={t('households.empty.title')}
          description={t('households.empty.body')}
        />
      ) : (
        <TableShell caption={t('households.title')}>
          <TableHead
            columns={[t('households.code'), t('cases.household'), t('households.members'), t('households.openCases')]}
          />
          <tbody className="divide-y divide-[#E2D8D0]">
            {households.map((household) => (
              <tr key={household.id}>
                <td className="px-4 py-3 font-mono text-xs text-[#5A5A66]">{household.code}</td>
                <td className="px-4 py-3">
                  <RecordLink href={`${basePath}/${household.id}`} locale={locale}>
                    {household.name}
                  </RecordLink>
                </td>
                <td className="px-4 py-3">
                  {household.memberCount === 1 ? '1 member' : household.memberCount + ' members'}
                </td>
                <td className="px-4 py-3">{household.openCaseCount}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      {/*
        Creating a household is the first thing a new worker does, so it is on the list
        page rather than behind a link — a register that can only be read is a dead end
        on day one. The form carries its own heading, so there is no section title
        wrapped around it saying the same thing twice.
      */}
      <div className="rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] p-4">
        <HouseholdForm />
      </div>

      <p className="text-xs text-[#5A5A66]">
        <RecordLink href={casesPath} locale={locale}>
          {t('cases.title')}
        </RecordLink>
      </p>
    </div>
  );
};

export const HouseholdDetailView: React.FC<{
  detail: HouseholdDetailDto;
  locale: Locale;
  basePath: string;
  casesPath: string;
}> = ({ detail, locale, basePath, casesPath }) => {
  const t = useTranslations('healthcare');
  const { household, members, asha } = detail;

  return (
    <div className="space-y-6">
      <PageHeader
        title={household.name}
        description={household.addressLine ?? household.code}
      />
      <ConfidentialityNote />

      <Section title={t('household.assignedWorker')}>
        <p className="text-sm text-[#1E1E24]">
          {asha ? asha.fullName : t('household.noWorker')}
          {asha?.registrationNumber ? (
            <span className="ml-2 font-mono text-xs text-[#5A5A66]">{asha.registrationNumber}</span>
          ) : null}
        </p>
      </Section>

      <Section title={t('members.title')}>
        {members.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title={t('household.emptyMembers.title')}
            description={t('household.emptyMembers.body')}
          />
        ) : (
          <TableShell caption={t('members.title')}>
            <TableHead
              columns={[
                t('cases.member'),
                t('members.age'),
                t('members.sex'),
                t('members.relation'),
              ]}
            />
            <tbody className="divide-y divide-[#E2D8D0]">
              {members.map((member) => (
                <tr key={member.id}>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-[#1E1E24]">
                    {member.fullName}
                  </th>
                  <td className="px-4 py-3">
                    {member.ageYears === null
                      ? t('members.ageUnknown')
                      : t('members.years', { age: member.ageYears })}
                  </td>
                  <td className="px-4 py-3">
                    {member.sex ? t(`members.sexValues.${member.sex}`) : t('members.sexUnknown')}
                  </td>
                  <td className="px-4 py-3">
                    {member.relationToHead ?? t('members.relationUnknown')}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Section>

      <Section title={t('household.openCases')}>
        <p className="text-sm text-[#1E1E24]">{t('households.openCases')}: {household.openCaseCount}</p>
        {/*
          The cases queue, not a case list filtered by this household. The service
          exposes no per-household case query, and the alternative — building a path
          like `/asha/households/{id}/cases` and filtering on the client — would put
          another worker's case in the URL shape of this worker's household.
        */}
        <p>
          <RecordLink href={casesPath} locale={locale}>
            {t('dashboard.viewAll')}
          </RecordLink>
        </p>
      </Section>

      {/*
        A member is added from the household it belongs to, so the household id comes
        from the path and is not a field: there is no way for the form to place a
        person in a different house than the one being looked at.
      */}
      <div className="rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] p-4">
        <MemberForm householdId={household.id} />
      </div>

      <div className="rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] p-4">
        <EditHouseholdForm householdId={household.id} />
      </div>

      <p className="text-xs text-[#5A5A66]">
        <RecordLink href={basePath} locale={locale}>
          {t('actions.back')}
        </RecordLink>
      </p>
    </div>
  );
};



