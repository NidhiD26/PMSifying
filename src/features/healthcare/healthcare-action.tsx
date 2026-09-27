'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { callHealthcareApi, errorMessageKey, HealthcareRequestError } from './api-client';

/**
 * A button that performs one healthcare action.
 *
 * Every write in this feature goes through here, for two reasons.
 *
 * The first is honesty about state. The pages are server components, so the data they
 * rendered is already on the way to the browser by the time a button is pressed; a
 * local optimistic update would show a change the server may have refused. So the
 * action runs, and then the page is re-fetched, and the truth arrives from the same
 * service that enforced the rule.
 *
 * The second is what happens when the server says no. A refused action is a normal
 * outcome, not an exception: a case already closed, a camp already full, a referral
 * somebody else accepted a minute ago. The refusal is shown as the translated sentence
 * for its code, in the place the button is, so a worker is told what to do next rather
 * than left with a control that appears to have done nothing.
 */
export const HealthcareAction: React.FC<{
  /** Locale-agnostic path under `/api/healthcare`. */
  path: string;
  method?: 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  className?: string;
  /** Announced while the request is in flight. */
  busyLabel?: string;
}> = ({ path, method = 'POST', body, children, variant, size, className, busyLabel }) => {
  const t = useTranslations('healthcare');
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [failure, setFailure] = React.useState<string | null>(null);

  const run = () => {
    setFailure(null);
    startTransition(async () => {
      try {
        await callHealthcareApi(path, { method, body });
        router.refresh();
      } catch (error) {
        setFailure(
          error instanceof HealthcareRequestError
            ? errorMessageKey(error.code)
            : errorMessageKey('unknown')
        );
      }
    });
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={run}
        disabled={isPending}
        aria-busy={isPending || undefined}
      >
        {children}
      </Button>
      {isPending ? (
        <span role="status" className="text-xs text-[#5A5A66]">
          {busyLabel ?? t('loading')}
        </span>
      ) : null}
      {failure ? (
        <span role="alert" className="max-w-xs text-xs leading-relaxed text-[#C94A46]">
          {t(failure)}
        </span>
      ) : null}
    </span>
  );
};
