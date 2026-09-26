import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminEnv } from '@/lib/supabase/env';
import type { Database } from '@/types/supabase-database';

/**
 * The elevated Supabase client, for moderation only.
 *
 * WHY THIS EXISTS SEPARATELY
 * A moderation action has to do something a normal user must never do: read
 * every report regardless of who filed it, hide another person's post, or write
 * an immutable audit row. Row Level Security exists to stop a *signed-in
 * member* from doing that, so RLS cannot also be the tool that lets it happen.
 * The service role key bypasses RLS, which is precisely why it is quarantined
 * here instead of being threaded through the rest of the code.
 *
 * THE RULES FOR THIS FILE
 *   1. Server-only. Nothing in `src/features` or any `'use client'` module may
 *      import it, and the key is not `NEXT_PUBLIC_`, so it cannot enter a
 *      client bundle.
 *   2. Never used to serve reader-facing reads or writes. Posts, comments,
 *      likes, reports and blocks all go through `@/lib/supabase/server`, which
 *      runs as the reader under RLS.
 *   3. Every call is authorised first by `@/lib/secretchat/moderation`, which
 *      checks the caller is a moderator. The key is the second lock, not the
 *      first.
 *   4. It returns `null` rather than throwing when unconfigured, so a missing
 *      secret degrades the moderation path instead of taking the app down.
 */
export function createAdminClient(): SupabaseClient<Database> | null {
  const env = getSupabaseAdminEnv();
  if (!env) return null;

  return createSupabaseClient<Database>(env.url, env.serviceRoleKey, {
    auth: {
      // The service role key is a project credential, not a user session.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
