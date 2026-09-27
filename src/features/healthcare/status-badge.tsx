'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';

/**
 * A record's state, in the reader's language, with a tone that means something.
 *
 * The mapping is a closed switch over the vocabularies in `@/types/healthcare` rather
 * than a lookup keyed by whatever the server sent. Two reasons: an unknown status must
 * not be rendered as a raw `UNDER_REVIEW` in capitals, and a status the UI does not
 * recognise yet should show as "not recorded" rather than be styled as if it were
 * understood. A total function over a known set is also a compile error when a new
 * status is added, which is the moment somebody should decide what it looks like.
 */

/** The vocabularies a record's state can come from. */
export type HealthcareStatus =
  | 'OPEN'
  | 'REFERRED'
  | 'UNDER_REVIEW'
  | 'FOLLOW_UP'
  | 'CLOSED'
  | 'PENDING'
  | 'ACCEPTED'
  | 'IN_REVIEW'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'MISSED'
  | 'DRAFT'
  | 'PUBLISHED'
  | 'REGISTERED'
  | 'ATTENDED'
  | 'ABSENT'
  | 'ROUTINE'
  | 'URGENT'
  | 'MILD'
  | 'MODERATE'
  | 'SEVERE';

const TONE_BY_STATUS: Record<HealthcareStatus, 'neutral' | 'ovulation' | 'fertile' | 'period'> = {
  // Settled and finished.
  COMPLETED: 'ovulation',
  ATTENDED: 'ovulation',
  PUBLISHED: 'ovulation',
  ACCEPTED: 'ovulation',
  // Refused or missed: worth a reader's attention, never a shout.
  CANCELLED: 'period',
  MISSED: 'period',
  ABSENT: 'period',
  URGENT: 'period',
  SEVERE: 'period',
  // In flight.
  IN_REVIEW: 'fertile',
  UNDER_REVIEW: 'fertile',
  FOLLOW_UP: 'fertile',
  MODERATE: 'fertile',
  // Waiting, or simply unremarkable.
  OPEN: 'neutral',
  PENDING: 'neutral',
  REFERRED: 'neutral',
  DRAFT: 'neutral',
  REGISTERED: 'neutral',
  CLOSED: 'neutral',
  ROUTINE: 'neutral',
  MILD: 'neutral',
};

/** Statuses the types declare. A record in one of these is always labelled. */
const KNOWN: ReadonlySet<string> = new Set<string>(Object.keys(TONE_BY_STATUS));

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const t = useTranslations('healthcare');

  // `has` before the lookup so an unexpected value cannot reach the message lookup:
  // next-intl throws on a missing key, and a thrown error inside a table row takes the
  // whole list down with it. The fallback is its own sentence rather than another
  // status, because "None recorded" is a claim about a record and an unrecognised
  // status is a statement about the interface.
  if (!KNOWN.has(status)) return <Badge>{t('statusUnknown')}</Badge>;

  return <Badge variant={TONE_BY_STATUS[status as HealthcareStatus]}>{t(`status.${status}`)}</Badge>;
};

/**
 * A role, as a word rather than as a stored value.
 *
 * A follow-up carries the role it was assigned to, and the stored value is an enum
 * member: rendering `ASHA` in capitals is a machine value shown to a person who is
 * trying to work out whether the visit is theirs. The set is closed and checked the
 * same way statuses are, so a role added to the database without a sentence here shows
 * as unknown rather than as an acronym.
 */
const ROLES: ReadonlySet<string> = new Set(['ASHA', 'DOCTOR', 'ADMIN', 'USER']);

export const RoleLabel: React.FC<{ role: string }> = ({ role }) => {
  const t = useTranslations('healthcare');
  if (!ROLES.has(role)) return <span className="text-[#5A5A66]">{t('statusUnknown')}</span>;
  return <span>{t(`roles.${role}`)}</span>;
};
