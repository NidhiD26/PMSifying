'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { withLocale } from '@/lib/navigation/locale-path';
import type { Locale } from '@/types/i18n';
import { RoleLabel, StatusBadge } from './status-badge';

/**
 * The list, table and empty-state shapes every healthcare record list shares.
 *
 * A record list here is read on a phone, in a corridor, by somebody in a hurry, so it
 * is a real `<table>` with a caption and header cells rather than a set of cards: a
 * table is what a screen reader announces row by row, and it is what a 360px-wide
 * screen can still render without a horizontal swipe per record.
 *
 * `locale` is passed in rather than read from the router so that every link in the
 * table is built by the same `withLocale` the server layout uses, and so a component
 * test can assert a link without a router or a pathname.
 */

export const TableShell: React.FC<{ caption: string; children: React.ReactNode }> = ({
  caption,
  children,
}) => (
  <div className="overflow-x-auto rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF]">
    <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      {children}
    </table>
  </div>
);

/** Header cells, in the order the columns are written below them. */
export const TableHead: React.FC<{ columns: string[] }> = ({ columns }) => (
  <thead>
    <tr className="border-b border-[#E2D8D0]">
      {columns.map((column) => (
        <th
          key={column}
          scope="col"
          className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#5A5A66]"
        >
          {column}
        </th>
      ))}
    </tr>
  </thead>
);

/** A whole-row message for a list with nothing in it. */
export const EmptyRow: React.FC<{ columns: number; children: React.ReactNode }> = ({
  columns,
  children,
}) => (
  <tbody>
    <tr>
      <td colSpan={columns} className="px-4 py-8 text-center text-sm text-[#5A5A66]">
        {children}
      </td>
    </tr>
  </tbody>
);

/** A titled block, so a page reads as a sequence of them rather than one long wall. */
export const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, children, action }) => (
  <section className="space-y-3">
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-base font-semibold text-[#2D1B2D]">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

/**
 * A record's date, rendered as a full date and given a machine-readable value.
 *
 * The ISO string goes in `dateTime` rather than being parsed for display, so a reader
 * sees one unambiguous date and assistive technology gets a value that does not depend
 * on the browser's locale settings.
 */
export const RecordDate: React.FC<{ value: string }> = ({ value }) => {
  const t = useTranslations('healthcare');
  if (!value) return <span className="text-[#5A5A66]">{t('observations.none')}</span>;

  return (
    <time dateTime={value} className="whitespace-nowrap">
      {value.slice(0, 10)}
    </time>
  );
};

/** A link into a healthcare record, locale-preserving. */
export const RecordLink: React.FC<{
  href: string;
  locale: Locale;
  children: React.ReactNode;
}> = ({ href, locale, children }) => (
  <a
    href={withLocale(href, locale)}
    className="rounded font-medium text-[#2D1B2D] underline decoration-[#E8837D] underline-offset-4 hover:bg-[#F9EBEA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8837D]"
  >
    {children}
  </a>
);

export { RoleLabel, StatusBadge };
