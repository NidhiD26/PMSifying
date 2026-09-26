'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useFormState, useFormStatus } from 'react-dom';
import { ShieldQuestion } from 'lucide-react';
import { Surface } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { signInAction, signUpAction, type AuthFormState } from '@/features/secretchat/auth-actions';

/**
 * The sign-in gate.
 *
 * SecretChat is not anonymous-without-an-account; it is anonymous *with* one. A
 * member signs in with an email address, and that address is used for nothing else:
 * it never becomes a display name, never appears next to a post, and is not stored
 * in this app's own tables. The alias is the only identity the community sees.
 *
 * The gate explains that before asking for anything, because a field labelled
 * "email" on a screen full of anonymous aliases is a fair thing to be unsure about.
 * That is the whole privacy story of this feature, stated where it is relevant.
 *
 * Two forms rather than a toggle: a member who has never been here and a member
 * returning both see exactly one obvious action, and neither has to work out which
 * mode they are in.
 */

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {label}
    </Button>
  );
}

const AuthForm: React.FC<{
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  title: string;
  submitLabel: string;
  passwordHint: string;
  returnTo: string;
  errorLabels: Record<string, string>;
}> = ({ action, title, submitLabel, passwordHint, returnTo, errorLabels }) => {
  const t = useTranslations('secretChat.auth');
  const [state, formAction] = useFormState(action, { error: null });

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <h2 className="text-sm font-semibold text-[#2D1B2D]">{title}</h2>

      <div className="space-y-1">
        <label htmlFor={`${returnTo}-email`} className="block text-sm text-[#1E1E24]">
          {t('emailLabel')}
        </label>
        <input
          id={`${returnTo}-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={state?.field === 'email' || undefined}
          className="w-full rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] px-3 py-2 text-sm text-[#1E1E24] focus:border-[#2D1B2D] focus:outline-none focus:ring-2 focus:ring-[#2D1B2D]/20"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor={`${returnTo}-password`} className="block text-sm text-[#1E1E24]">
          {t('passwordLabel')}
        </label>
        <input
          id={`${returnTo}-password`}
          name="password"
          type="password"
          autoComplete={title === t('signInTitle') ? 'current-password' : 'new-password'}
          required
          aria-describedby={`${returnTo}-password-hint`}
          aria-invalid={state?.field === 'password' || undefined}
          className="w-full rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] px-3 py-2 text-sm text-[#1E1E24] focus:border-[#2D1B2D] focus:outline-none focus:ring-2 focus:ring-[#2D1B2D]/20"
        />
        <p id={`${returnTo}-password-hint`} className="text-xs text-[#5A5A66]">
          {passwordHint}
        </p>
      </div>

      {/* Same-site path only, and the server action re-validates it. */}
      <input type="hidden" name="returnTo" value={returnTo} />

      {state?.error && (
        <p role="alert" className="text-sm text-[#C94A46]">
          {errorLabels[state.error] ?? errorLabels.unknown}
        </p>
      )}

      <SubmitButton label={submitLabel} />
    </form>
  );
};

export const SecretChatAuthGate: React.FC<{ returnTo: string }> = ({ returnTo }) => {
  const t = useTranslations('secretChat.auth');
  const tErrors = useTranslations('secretChat.errors');

  const errorLabels: Record<string, string> = {
    notConfigured: tErrors('not_configured'),
    invalidCredentials: t('invalidCredentials'),
    emailInUse: t('emailInUse'),
    weakPassword: t('passwordHint'),
    invalidEmail: t('invalidEmail'),
    rateLimited: tErrors('rate_limited'),
    unknown: tErrors('unknown'),
  };

  return (
    <Surface variant="bordered" className="space-y-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2D1B2D]/5 text-[#2D1B2D]"
          aria-hidden="true"
        >
          <ShieldQuestion className="h-5 w-5" />
        </span>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-[#2D1B2D]">{t('gateTitle')}</h2>
          <p className="text-sm leading-relaxed text-[#5A5A66]">{t('gateBody')}</p>
        </div>
      </div>

      <div className="grid gap-5 border-t border-[#E2D8D0] pt-4 sm:grid-cols-2">
        <AuthForm
          action={signInAction}
          title={t('signInTitle')}
          submitLabel={t('signInSubmit')}
          passwordHint={t('passwordHint')}
          returnTo={`${returnTo}-in`}
          errorLabels={errorLabels}
        />
        <AuthForm
          action={signUpAction}
          title={t('signUpTitle')}
          submitLabel={t('signUpSubmit')}
          passwordHint={t('passwordHint')}
          returnTo={`${returnTo}-up`}
          errorLabels={errorLabels}
        />
      </div>
    </Surface>
  );
};
