'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { FollowUpDto, ReferralDto } from '@/types/healthcare';
import { EmptyState } from '@/components/ui/state';
import { CalendarCheck, Stethoscope } from 'lucide-react';
import { RecordDate, RoleLabel, Section, StatusBadge, TableHead, TableShell } from './record-parts';
import { ConfidentialityNote, PageHeader } from './portal-gate';
import { HealthcareAction } from './healthcare-action';

/**
 * The two queues a worker actually works through.
 *
 * Referrals and follow-ups are both "things that are waiting for somebody to do
 * something", so they are both tables with a state and a date, and both put the
 * actionable controls on the row rather than behind a detail page. A referral is three
 * clicks from being accepted; there is no reason for it to be four.
 *
 * The controls a row offers depend on its state and on the reader's role, and only
 * ever name transitions the state machine allows. The server enforces the same rules
 * again — a button that is visible here and refused there is a misunderstanding waiting
 * to happen, and the server is what decides which of the two it is.
 */

const ReferralListView: React.FC<{
  referrals: ReferralDto[];
  /** A doctor accepts, starts and completes. An ASHA can only cancel. */
  role: 'ASHA' | 'DOCTOR';
}> = ({ referrals, role }) => {
  const t = useTranslations('healthcare');

  if (referrals.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('referrals.title')} description={t('referrals.subtitle')} />
        <EmptyState
          icon={<Stethoscope className="h-6 w-6" />}
          title={t('referrals.empty.title')}
          description={t('referrals.empty.body')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('referrals.title')} description={t('referrals.subtitle')} />
      <ConfidentialityNote />

      <TableShell caption={t('referrals.title')}>
        <TableHead
          columns={[
            t('cases.member'),
            t('referrals.reason'),
            t('referrals.priority'),
            t('referrals.status'),
            t('referrals.raised'),
            t('actions.column'),
          ]}
        />
        <tbody className="divide-y divide-[#E2D8D0]">
          {referrals.map((referral) => (
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
                {referral.doctorName ? (
                  <span className="block text-xs text-[#5A5A66]">{referral.doctorName}</span>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <RecordDate value={referral.createdAt} />
              </td>
              <td className="px-4 py-3">
                <ReferralControls referral={referral} role={role} />
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
};

/**
 * The controls one referral offers, from its state and the reader's role.
 *
 * Rendered as a fragment of independent buttons rather than one menu, because at most
 * one of the clinician's transitions is ever legal: a referral is waiting to be
 * accepted, waiting to be reviewed, or waiting to be completed.
 *
 * WITHDRAWING IS THE WORKER'S, NOT THE CLINICIAN'S
 * `cancelReferral` requires the ASHA who filed it, so the button is not offered to a
 * doctor at all — not hidden-and-refused, but absent. A doctor who has read a referral
 * and decided it should not have been sent needs to say so through the worker, and
 * giving them a button that always fails would teach them that this interface's
 * buttons are decoration. The service allows a withdrawal from any state, so the
 * control is offered on a referral a doctor has already started reading: that is
 * exactly the case where a clinician is about to waste a consultation.
 */
const ReferralControls: React.FC<{ referral: ReferralDto; role: 'ASHA' | 'DOCTOR' }> = ({
  referral,
  role,
}) => {
  const t = useTranslations('healthcare');
  const { status, id } = referral;

  return (
    <span className="flex flex-wrap gap-2">
      {role === 'DOCTOR' && status === 'PENDING' ? (
        <HealthcareAction path={`/referrals/${id}/accept`} size="sm" variant="secondary">
          {t('referrals.action.accept')}
        </HealthcareAction>
      ) : null}
      {role === 'DOCTOR' && status === 'ACCEPTED' ? (
        <HealthcareAction
          path={`/referrals/${id}/progress`}
          body={{ action: 'startReview' }}
          size="sm"
          variant="secondary"
        >
          {t('referrals.action.startReview')}
        </HealthcareAction>
      ) : null}
      {role === 'DOCTOR' && status === 'IN_REVIEW' ? (
        <HealthcareAction
          path={`/referrals/${id}/progress`}
          body={{ action: 'complete' }}
          size="sm"
          variant="secondary"
        >
          {t('referrals.action.complete')}
        </HealthcareAction>
      ) : null}
      {role === 'ASHA' && status !== 'CANCELLED' ? (
        <HealthcareAction path={`/referrals/${id}/cancel`} size="sm" variant="outline">
          {t('referrals.action.cancel')}
        </HealthcareAction>
      ) : null}
    </span>
  );
};

const FollowUpListView: React.FC<{ followUps: FollowUpDto[] }> = ({ followUps }) => {
  const t = useTranslations('healthcare');

  if (followUps.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('followUps.title')} description={t('followUps.subtitle')} />
        <EmptyState
          icon={<CalendarCheck className="h-6 w-6" />}
          title={t('followUps.empty.title')}
          description={t('followUps.empty.body')}
        />
      </div>
    );
  }

  const pending = followUps.filter((row) => row.status === 'PENDING');
  const settled = followUps.filter((row) => row.status !== 'PENDING');

  return (
    <div className="space-y-6">
      <PageHeader title={t('followUps.title')} description={t('followUps.subtitle')} />
      <ConfidentialityNote />

      {pending.length > 0 ? (
        <Section title={t('dashboard.followUpList')}>
          <FollowUpTable followUps={pending} showActions />
        </Section>
      ) : null}

      {settled.length > 0 ? (
        <Section title={t('followUps.completedAt')}>
          <FollowUpTable followUps={settled} />
        </Section>
      ) : null}
    </div>
  );
};

const FollowUpTable: React.FC<{ followUps: FollowUpDto[]; showActions?: boolean }> = ({
  followUps,
  showActions = false,
}) => {
  const t = useTranslations('healthcare');

  return (
    <TableShell caption={t('followUps.title')}>
      <TableHead
        columns={[
          t('cases.member'),
          t('followUps.due'),
          t('followUps.assignedTo'),
          t('followUps.notes'),
          t('cases.status'),
          ...(showActions ? [t('actions.column')] : []),
        ]}
      />
      <tbody className="divide-y divide-[#E2D8D0]">
        {followUps.map((followUp) => (
          <tr key={followUp.id}>
            <th scope="row" className="px-4 py-3 text-left font-medium text-[#1E1E24]">
              {followUp.memberName}
              <span className="block font-mono text-xs font-normal text-[#5A5A66]">
                {followUp.caseNumber}
              </span>
            </th>
            <td className="px-4 py-3">
              <RecordDate value={followUp.dueDate} />
            </td>
            <td className="px-4 py-3">
              <RoleLabel role={followUp.assignedRole} />
            </td>
            <td className="px-4 py-3 text-[#5A5A66]">{followUp.notes ?? t('observations.none')}</td>
            <td className="px-4 py-3">
              <StatusBadge status={followUp.status} />
            </td>
            {showActions ? (
              <td className="px-4 py-3">
                {/*
                  All three settle actions are offered together, and the row they are on
                  is by definition still `PENDING` — settled rows are rendered by the
                  other table. `markMissed` and `complete` are the two honest answers for
                  a visit that has now happened, and `cancel` is for one that should
                  never have been booked; a worker who marks a visit missed when they
                  meant to call it off has quietly thrown away a follow-up.
                */}
                <span className="flex flex-wrap gap-2">
                  <HealthcareAction
                    path={`/follow-ups/${followUp.id}/settle`}
                    body={{ action: 'complete' }}
                    size="sm"
                    variant="secondary"
                  >
                    {t('followUps.action.complete')}
                  </HealthcareAction>
                  <HealthcareAction
                    path={`/follow-ups/${followUp.id}/settle`}
                    body={{ action: 'markMissed' }}
                    size="sm"
                    variant="outline"
                  >
                    {t('followUps.action.markMissed')}
                  </HealthcareAction>
                  <HealthcareAction
                    path={`/follow-ups/${followUp.id}/settle`}
                    body={{ action: 'cancel' }}
                    size="sm"
                    variant="outline"
                  >
                    {t('followUps.action.cancel')}
                  </HealthcareAction>
                </span>
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
};

export { ReferralListView, FollowUpListView };
