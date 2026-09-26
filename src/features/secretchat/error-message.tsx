'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { SecretChatErrorCode } from '@/types/secretchat';

/**
 * Error codes become sentences, in the reader's language.
 *
 * A code is turned into a message in one place so no component invents its own
 * wording, and so the fallback is a calm, honest sentence rather than a raw status
 * code shown to a member.
 *
 * `not_configured` gets real instructions because it is the one failure a member
 * cannot fix themselves and retrying will never help. Everything else is either
 * retryable or a "go back" case.
 */
const KNOWN_CODES: SecretChatErrorCode[] = [
  'invalid_request',
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  'not_configured',
  'upstream_unavailable',
  'rate_limited',
];

/**
 * Turns an error code into a sentence in the reader's language.
 *
 * The list of known codes is spelled out rather than interpolated, so a code that
 * has no translation cannot produce a raw key in the interface: an unknown value
 * gets `errors.unknown`, which is always written.
 */
export function useErrorMessage(): (code: unknown) => string {
  const t = useTranslations('secretChat.errors');

  return React.useCallback(
    (code: unknown) => {
      if (typeof code !== 'string') return t('unknown');
      return KNOWN_CODES.includes(code as SecretChatErrorCode) ? t(code) : t('unknown');
    },
    [t]
  );
}
