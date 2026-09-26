import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { PLACEHOLDER_ANON_KEY, PLACEHOLDER_URL, getSupabasePublicEnv } from '@/lib/supabase/env';

/**
 * Cookie-backed server Supabase client.
 *
 * Pre-existing architecture, kept. This is the client every SecretChat data
 * operation runs through, on purpose:
 *
 *   - it carries the reader's session cookies, so PostgREST evaluates
 *     Row Level Security as *that signed-in user*. Authorization is therefore
 *     enforced by the database, not by trusting a client-supplied user id.
 *   - it uses the anon key, not the service role key, so a bug in the
 *     application can never grant more access than a signed-in user has.
 *
 * `setAll` swallows writes during Server Component renders (Next forbids
 * cookie mutation there); the same code runs in Route Handlers and Server
 * Actions, where the write succeeds and refreshes the session.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = getSupabasePublicEnv();

  return createServerClient(env?.url ?? PLACEHOLDER_URL, env?.anonKey ?? PLACEHOLDER_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Handled during Server Component renders
        }
      },
    },
  });
}
