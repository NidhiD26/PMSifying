'use client';

import * as React from 'react';

/**
 * A row of counts, as a description list.
 *
 * Deliberately not a grid of cards. A dashboard here is a working surface: somebody is
 * checking a number and moving on, so the numbers are a compact list with the label
 * beside the value, which is also how a screen reader reads them. Six large panels with
 * an icon in each would say the same thing with more pixels and worse semantics.
 */
export interface Stat {
  /** Already-translated label. */
  label: string;
  value: number;
  /** Optional destination, for the few counts a worker clicks through to. */
  href?: string;
  /** Appended as a visually hidden suffix so a link reads as a sentence. */
  hrefSuffix?: string;
}

export const StatList: React.FC<{ stats: Stat[]; caption: string }> = ({ stats, caption }) => {
  if (stats.length === 0) return null;

  return (
    <dl
      aria-label={caption}
      className="divide-y divide-[#E2D8D0] rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF]"
    >
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-baseline justify-between gap-4 px-4 py-3">
          <dt className="text-sm text-[#5A5A66]">{stat.label}</dt>
          <dd className="text-lg font-semibold text-[#2D1B2D]">
            {stat.href ? (
              <a
                href={stat.href}
                className="rounded underline decoration-[#E8837D] underline-offset-4 hover:bg-[#F9EBEA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8837D]"
              >
                {stat.value}
                {stat.hrefSuffix ? <span className="sr-only"> {stat.hrefSuffix}</span> : null}
              </a>
            ) : (
              stat.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
};
