import { createBrowserClient } from '@supabase/ssr';
import { PLACEHOLDER_ANON_KEY, PLACEHOLDER_URL, getSupabasePublicEnv } from '@/lib/supabase/env';

/**
 * Browser Supabase client.
 *
 * Pre-existing architecture, kept: SecretChat reuses this rather than creating
 * a second browser client. The only change is that configuration is read from
 * `@/lib/supabase/env`, so the browser, the server and the setup check can never
 * disagree about whether the backend exists.
 *
 * When nothing is configured this still returns a usable client object pointed
 * at a placeholder host. Callers must check `isSupabaseConfigured()` (or handle
 * a failed request) instead of assuming a working backend, because a client can
 * be constructed without a project.
 *
 * The anon key is the only credential used here. Every read and write is
 * subject to Row Level Security; nothing in the browser can widen its own
 * permissions.
 */
export function createClient() {
  const env = getSupabasePublicEnv();

  return createBrowserClient(env?.url ?? PLACEHOLDER_URL, env?.anonKey ?? PLACEHOLDER_ANON_KEY);
}
