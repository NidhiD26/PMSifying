import { createClient } from '@/lib/supabase/server';

/**
 * Who is signed in, as far as the server knows.
 *
 * A single place resolves the session so no caller is tempted to trust something
 * the client sent. Note the use of `auth.getUser()` rather than `auth.session()`:
 * `getUser()` revalidates with the auth server, whereas a session read can be
 * satisfied by a cookie the caller wrote. For anything that decides access, only
 * the revalidated answer is worth having, and this runs once per request.
 */
export interface SecretChatSession {
  userId: string;
  /** The alias the community sees, claimed lazily on first post. */
  aliasNumber: number | null;
  displayName: string | null;
}

export async function getSecretChatSession(): Promise<SecretChatSession | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  // A missing identity row is normal, not an error: the alias is claimed the
  // first time a member posts, so a member who has only read has none yet.
  const { data: profile } = await supabase
    .from('anonymous_profiles')
    .select('alias_number, display_name')
    .eq('user_id', data.user.id)
    .maybeSingle();

  return {
    userId: data.user.id,
    aliasNumber: profile?.alias_number ?? null,
    displayName: profile?.display_name ?? null,
  };
}
