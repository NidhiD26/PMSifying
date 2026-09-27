'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

/**
 * The portal's loading state, matching the app's existing pattern.
 *
 * Scoped to the healthcare segment so it covers every page beneath it, and worded for
 * this feature: it says records are loading, because a healthcare page is a wait for a
 * server round trip rather than for local data, and a spinner that says nothing is
 * indistinguishable from a page that is broken.
 */
export default function HealthcareLoading() {
  const t = useTranslations('healthcare');

  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#2D1B2D] border-t-transparent"
          aria-hidden="true"
        />
        <span role="status" aria-live="polite" className="text-sm text-[#5A5A66]">
          {t('loading')}
        </span>
      </div>
    </div>
  );
}
