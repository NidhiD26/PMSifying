import * as React from 'react';
import { getTranslations } from 'next-intl/server';
import { MessageSquare, ShieldCheck, Terminal } from 'lucide-react';
import { Surface } from '@/components/ui/surface';
import { getSecretChatSession } from '@/lib/secretchat/session';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { SecretChatAuthGate } from '@/features/secretchat/secret-chat-auth-gate';
import { SecretChatFeed } from '@/features/secretchat/secret-chat-feed';
import { BlockedMembersPanel } from '@/features/secretchat/blocked-members-panel';
import { ToastProvider } from '@/features/secretchat/use-toast';
import { AnonymousBadge } from '@/features/secretchat/anonymous-badge';

/**
 * SecretChat: anonymous, separated, and honest about both.
 *
 * WHY THE PAGE CHECKS THE BACKEND BEFORE RENDERING A FORM
 * A sign-in form that cannot possibly work is worse than an explanation. When the
 * Supabase environment is missing, the page says exactly which variables are
 * missing and what to do about it, rather than accepting a password and then
 * failing.
 *
 * WHY THE SESSION IS RESOLVED ON THE SERVER
 * The page is a server component, so "is anyone signed in" is answered with the
 * session cookie and never with anything the browser asserted. The feed then mounts
 * as a client component, but it only ever renders behind this check, so there is no
 * flash of an empty feed for a member who is not signed in.
 *
 * WHY NO HEALTH DATA APPEARS ANYWHERE BELOW
 * This page reads nothing but the auth session and one identity row. There is no
 * Dexie access, no cycle record, and no path by which anything from World A could
 * reach a post. The privacy note in the composer says so, in the reader's language.
 */
export default async function SecretChatPage() {
  const tNav = await getTranslations('nav');
  const t = await getTranslations('secretChat');
  const tPrivacy = await getTranslations('privacy');

  const configured = isSupabaseConfigured();
  const session = configured ? await getSecretChatSession() : null;

  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-[#2D1B2D]">{tNav('secretChat')}</h1>
          <AnonymousBadge />
          {!configured && (
            <span className="rounded-full bg-[#F9EBEA] border border-[#E8837D]/40 px-3 py-0.5 text-xs font-medium text-[#2D1B2D]">
              Demo Mode
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-[#5A5A66]">
          {tPrivacy('systems.communitySummary')}
        </p>
      </header>

      {configured && !session ? (
        <SecretChatAuthGate returnTo="/secret-chat" />
      ) : (
        <ToastProvider>
          <div className="space-y-5">
            <Surface variant="bordered" className="flex items-start gap-3 p-4">
              <ShieldCheck
                className="mt-0.5 h-5 w-5 shrink-0 text-[#2E8B57]"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-[#2D1B2D]">{t('identity.title')}</h2>
                <p className="text-sm leading-relaxed text-[#5A5A66]">
                  {t('identity.body')}
                </p>
              </div>
            </Surface>

            <SecretChatFeed />

            <BlockedMembersPanel />
          </div>
        </ToastProvider>
      )}
    </div>
  );
}

/**
 * What to do when the backend is not connected.
 *
 * Shows the variable names because that is what the operator needs, and says
 * plainly that nothing is stored locally meanwhile. Someone reading this should
 * understand both that the feature is off and that no data is being written
 * anywhere.
 */
async function SetupNotice() {
  const t = await getTranslations('secretChat.setup');

  return (
    <Surface variant="bordered" className="space-y-3">
      <div className="flex items-start gap-3">
        <Terminal className="mt-0.5 h-5 w-5 shrink-0 text-[#2D1B2D]" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-[#2D1B2D]">{t('title')}</h2>
          <p className="text-sm leading-relaxed text-[#5A5A66]">{t('body')}</p>
        </div>
      </div>

      <ul className="space-y-1.5 border-t border-[#E2D8D0] pt-3">
        {['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'].map((name) => (
          <li key={name} className="text-xs text-[#1E1E24]">
            <code className="rounded bg-[#F7F5F3] px-1.5 py-0.5 font-mono">{name}</code>
          </li>
        ))}
      </ul>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-[#5A5A66]">
        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('noLocalStorage')}
      </p>
    </Surface>
  );
}
