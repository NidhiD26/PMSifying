'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { UserRound } from 'lucide-react';

/**
 * The badge that says this space is anonymous.
 *
 * It is on the page rather than repeated on every post because it describes the
 * space, not the author. Each author already carries their own alias, and a badge
 * per post would be a badge per person — which is the opposite of what anonymity
 * needs: a stable, visible marker is how a person becomes recognisable in a
 * screenshot.
 *
 * The label is a tooltip as well as text, so a member who only sees the icon still
 * gets the meaning from a screen reader.
 */
export const AnonymousBadge: React.FC = () => {
  const t = useTranslations('secretChat');
  const [open, setOpen] = React.useState(false);
  const id = React.useId();

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#2D1B2D]/5 px-3 py-1 text-xs font-medium text-[#2D1B2D] hover:bg-[#2D1B2D]/10"
      >
        <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
        {t('badge.label')}
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] p-3 text-xs leading-relaxed text-[#1E1E24] shadow-lg"
        >
          {t('badge.explanation')}
        </span>
      )}
    </span>
  );
};
