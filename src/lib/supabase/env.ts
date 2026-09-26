/**
 * The single place that reads Supabase configuration.
 *
 * Three clients exist in this app, and they must never disagree about whether
 * the backend is configured:
 *
 *   - `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
 *     the browser client and the cookie-backed server client. These two are
 *     the *only* credentials that reach a client bundle, and every read and
 *     write they perform is subject to Row Level Security.
 *   - `SUPABASE_SERVICE_ROLE_KEY`
 *     server-only, used exclusively by moderation paths that must bypass RLS
 *     to act *on behalf of* a moderator. It is deliberately not `NEXT_PUBLIC_`,
 *     never imported by a client component, and never returned in a response.
 *
 * `isSupabaseConfigured()` answers the one question the UI needs: should this
 * screen offer the community features, or explain how to connect the backend?
 * It is a pure read of `process.env`, so it can be unit tested directly.
 */

/** Placeholder values the shipped code falls back to when nothing is set. */
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_ANON_KEY = 'placeholder-key';

function clean(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export interface SupabasePublicEnv {
  url: string;
  anonKey: string;
}

export interface SupabaseAdminEnv extends SupabasePublicEnv {
  serviceRoleKey: string;
}

/**
 * Reads the public (anon-key) configuration.
 *
 * Returns `null` when either value is missing or is still one of the
 * placeholders, which is the only signal the UI needs to show setup
 * instructions instead of a broken feed.
 */
export function getSupabasePublicEnv(
  env: Record<string, string | undefined> = process.env
): SupabasePublicEnv | null {
  const url = clean(env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = clean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anonKey) return null;
  if (url === PLACEHOLDER_URL || anonKey === PLACEHOLDER_ANON_KEY) return null;

  return { url, anonKey };
}

/**
 * Reads the elevated configuration, including the service role key.
 *
 * Kept separate from the public read so a missing service key degrades only the
 * moderation paths, and never the reader-facing feed.
 */
export function getSupabaseAdminEnv(
  env: Record<string, string | undefined> = process.env
): SupabaseAdminEnv | null {
  const publicEnv = getSupabasePublicEnv(env);
  const serviceRoleKey = clean(env.SUPABASE_SERVICE_ROLE_KEY);

  if (!publicEnv || !serviceRoleKey) return null;

  return { ...publicEnv, serviceRoleKey };
}

/** Whether the reader-facing community features can talk to a real backend. */
export function isSupabaseConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return getSupabasePublicEnv(env) !== null;
}

/** Whether moderation paths can run. Requires more than the feed does. */
export function isSupabaseAdminConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return getSupabaseAdminEnv(env) !== null;
}

export { PLACEHOLDER_URL, PLACEHOLDER_ANON_KEY };
