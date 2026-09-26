'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { secretChatAuthSchema } from '@/lib/secretchat/validation';

/**
 * Sign in, sign up, sign out. The only three places a credential is accepted.
 *
 * WHY SERVER ACTIONS AND NOT A CLIENT SDK CALL
 * Nothing here is privileged — a browser could call Supabase's own sign-in
 * endpoint — so this is not about authority. It is about the session: a server
 * action sets the auth cookies through the same server client the rest of the
 * feature reads, so there is one cookie path rather than two, and the redirect
 * afterwards happens on a request that is already authenticated.
 *
 * The email is never logged, echoed into a message, or stored anywhere in this
 * app. The auth provider holds it; `profiles` holds nothing identifying.
 */

export interface AuthFormState {
  error: AuthErrorKey | null;
  /** Field the message belongs to, so the form can mark the right input. */
  field?: 'email' | 'password';
}

export type AuthErrorKey =
  | 'notConfigured'
  | 'invalidCredentials'
  | 'emailInUse'
  | 'weakPassword'
  | 'invalidEmail'
  | 'rateLimited'
  | 'unknown';

/**
 * Maps an auth error to a key the UI can translate.
 *
 * The provider's own message is never returned: it can echo the submitted email
 * address, and this app does not put an email address into a rendered string.
 */
function classify(message: string): AuthErrorKey {
  const text = message.toLowerCase();
  if (text.includes('invalid login')) return 'invalidCredentials';
  if (text.includes('already registered') || text.includes('already been registered')) {
    return 'emailInUse';
  }
  if (text.includes('password')) return 'weakPassword';
  if (text.includes('email')) return 'invalidEmail';
  if (text.includes('rate limit') || text.includes('too many')) return 'rateLimited';
  return 'unknown';
}

function readMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'message' in value) {
    return String((value as { message: unknown }).message);
  }
  return 'unknown';
}

/** Shared tail for both submit actions: bounce back to the feed on success. */
function finish(returnTo: string, state: AuthFormState | null): AuthFormState | never {
  if (state?.error) return state;
  redirect(returnTo);
}

function safeReturnTo(value: FormDataEntryValue | null): string {
  // Only a same-site path is honoured. Accepting an absolute URL here would turn
  // the sign-in form into an open redirect that a phished link could exploit.
  const raw = typeof value === 'string' ? value : '';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/secret-chat';
  return raw;
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return { error: 'notConfigured' };

  const parsed = secretChatAuthSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path[0];
    return { error: 'invalidEmail', field: path === 'password' ? 'password' : 'email' };
  }

  const returnTo = safeReturnTo(formData.get('returnTo'));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { error: classify(readMessage(error)) };
  return finish(returnTo, null);
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return { error: 'notConfigured' };

  const parsed = secretChatAuthSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path[0];
    return { error: 'invalidEmail', field: path === 'password' ? 'password' : 'email' };
  }

  const returnTo = safeReturnTo(formData.get('returnTo'));
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp(parsed.data);

  if (error) return { error: classify(readMessage(error)) };
  return finish(returnTo, null);
}

export async function signOutAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(safeReturnTo(formData.get('returnTo')));
}
