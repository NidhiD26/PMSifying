'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Lock, LogIn, ServerCrash } from 'lucide-react';
import { Surface } from '@/components/ui/surface';

/**
 * The three screens that are not data.
 *
 * A healthcare page has exactly three ways to have nothing to show, and they are not
 * the same thing to the person in front of it:
 *
 *   not_configured  the deployment has no database. A sign-in form here could only
 *                   fail, so the page says what is missing instead.
 *   unauthenticated nobody is signed in. Clinical records need an account.
 *   forbidden       signed in, wrong role. Nothing has been loaded, and the page says
 *                   that rather than showing an empty queue, which would read as "you
 *                   have no work" instead of "this is not your workspace".
 *
 * Each one is an explanation with a way forward, not a spinner and not a stack trace.
 */
export type PortalStatus = 'not_configured' | 'unauthenticated' | 'forbidden';

const TONE: Record<PortalStatus, 'bg-[#F9EBEA] text-[#2D1B2D]' | 'bg-[#2E8B57]/10 text-[#2E8B57]'> = {
  not_configured: 'bg-[#F9EBEA] text-[#2D1B2D]',
  unauthenticated: 'bg-[#2E8B57]/10 text-[#2E8B57]',
  forbidden: 'bg-[#F9EBEA] text-[#2D1B2D]',
};

const ICON: Record<PortalStatus, React.ReactNode> = {
  not_configured: <ServerCrash className="h-5 w-5" aria-hidden="true" />,
  unauthenticated: <LogIn className="h-5 w-5" aria-hidden="true" />,
  forbidden: <Lock className="h-5 w-5" aria-hidden="true" />,
};

/**
 * Status to message key.
 *
 * The statuses are named after what the server found — `not_configured`,
 * `unauthenticated` — and the sentences are named after what the reader is being told,
 * because those are not the same sentence. Keeping the two in one place means the
 * lookup is exhaustive: a fourth status cannot be added without this switch refusing to
 * compile, rather than rendering `t('forbidden.title')` for something else.
 */
const MESSAGE: Record<PortalStatus, { title: string; body: string; action: string | null }> = {
  not_configured: { title: 'notConfigured.title', body: 'notConfigured.body', action: null },
  unauthenticated: { title: 'signIn.title', body: 'signIn.body', action: 'signIn.action' },
  forbidden: { title: 'wrongRole.title', body: 'wrongRole.body', action: 'wrongRole.action' },
};

/**
 * The two ways out of a blocked portal, which are not the same place.
 *
 * `homeHref` is where somebody with **no session** goes to get one, and it has to be a
 * healthcare sign-in page. `workspaceHref` is where somebody who is **already signed in
 * with the wrong role** goes instead, and it has to be the workspace their own role is —
 * sending a doctor who typed `/asha` to the ASHA sign-in form would ask a signed-in
 * clinician to authenticate again in order to be told, again, that she is not an ASHA.
 *
 * This is the distinction the gate used to collapse into one prop, and the reason
 * "Sign in to portal" on the ASHA and doctor portals walked readers to the personal PMSify
 * dashboard: one link, filled in with `/` by every page, for two questions that have two
 * different answers. `HealthcarePageGate` supplies both.
 */
export const PortalGate: React.FC<{
  status: PortalStatus;
  /** The healthcare sign-in page for the portal this page belongs to. */
  homeHref: string;
  /** Where a signed-in reader with the wrong role goes. Falls back to `homeHref`. */
  workspaceHref?: string;
}> = ({ status, homeHref, workspaceHref }) => {
  const t = useTranslations('healthcare');
  const message = MESSAGE[status];
  const actionHref = status === 'forbidden' ? (workspaceHref ?? homeHref) : homeHref;

  return (
    <Surface variant="bordered" className="mx-auto max-w-2xl">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONE[status]}`}
          aria-hidden="true"
        >
          {ICON[status]}
        </span>
        <div className="space-y-2">
          <h1 className="text-lg font-bold text-[#2D1B2D]">{t(message.title)}</h1>
          <p className="text-sm leading-relaxed text-[#5A5A66]">{t(message.body)}</p>
          {message.action ? (
            <a
              href={actionHref}
              className="inline-flex min-h-[40px] items-center rounded-xl px-1 text-sm font-medium text-[#2D1B2D] underline decoration-[#E8837D] underline-offset-4 hover:bg-[#F9EBEA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8837D]"
            >
              {t(message.action)}
            </a>
          ) : null}
        </div>
      </div>
    </Surface>
  );
};

/**
 * The confidentiality line, shown above every record list.
 *
 * One sentence, in the reader's language, saying that the screen is filtered to their
 * role. It is the honest framing for a page of other people's ages and symptoms, and it
 * costs one line: without it, an ASHA's household list reads like the whole village.
 */
export const ConfidentialityNote: React.FC = () => {
  const t = useTranslations('healthcare');
  return (
    <p className="border-l-2 border-[#E8837D] pl-3 text-xs leading-relaxed text-[#5A5A66]">
      {t('confidentialityNote')}
    </p>
  );
};

/** A page heading, so every list and detail page starts the same way. */
export const PageHeader: React.FC<{ title: string; description?: string }> = ({
  title,
  description,
}) => (
  <header className="space-y-1">
    <h1 className="text-2xl font-bold text-[#2D1B2D]">{title}</h1>
    {description ? <p className="text-sm text-[#5A5A66]">{description}</p> : null}
  </header>
);
