'use client';

import * as React from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import type { PublicAuthor } from '@/types/secretchat';

/**
 * How a member's visible name is composed.
 *
 * The server deliberately does not send a formatted name, because it cannot know
 * which language the reader is using. It sends an alias number, an optional label
 * the member chose, and whether the author is you — and the three cases are
 * rendered here from locale files, so "Anonymous User #4821" reads naturally in
 * English, Hindi and Kannada rather than being English three times.
 *
 * The chosen label wins when there is one. It is member-supplied free text and is
 * therefore never translated: a member who writes their name in Kannada should
 * see it in Kannada, not transliterated into the reader's language.
 */
export function useAuthorLabel(): (author: PublicAuthor) => string {
  const t = useTranslations('secretChat');
  return React.useCallback(
    (author: PublicAuthor) => {
      if (author.displayName) return author.displayName;
      if (author.isYou) return t('author.you');
      return t('author.anonymous', { number: author.aliasNumber });
    },
    [t]
  );
}

/**
 * Timestamps, formatted for the reader's locale.
 *
 * Uses the active locale rather than the browser's, so a reader who has chosen
 * Hindi gets Hindi-style formatting wherever they are, which is the whole point
 * of the app being localised. A date in the future is shown as "now" rather than
 * a timestamp from tomorrow, which can happen when two devices disagree about the
 * clock.
 */
export function useTimestamp(): (iso: string) => string {
  const format = useFormatter();

  return React.useCallback(
    (iso: string) => {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '';

      const now = Date.now();
      const diffMs = now - date.getTime();

      // A date in the future is shown as "now" rather than as a timestamp from
      // tomorrow, which happens when two devices disagree about the clock. A
      // negative relative time in the reader's language reads as nonsense here.
      if (diffMs < 60_000) return format.relativeTime(date, { unit: 'second', now: new Date(now) });

      const minutes = Math.floor(diffMs / 60_000);
      if (minutes < 60) return format.relativeTime(date, { unit: 'minute', now: new Date(now) });

      const hours = Math.floor(minutes / 60);
      if (hours < 24) return format.relativeTime(date, { unit: 'hour', now: new Date(now) });

      if (hours < 24 * 7) {
        return format.relativeTime(date, { unit: 'day', now: new Date(now) });
      }

      return format.dateTime(date, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    },
    [format]
  );
}
