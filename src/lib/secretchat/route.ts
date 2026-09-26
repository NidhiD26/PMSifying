import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import { notConfigured, invalidRequest, toSecretChatError, unauthenticated } from '@/lib/secretchat/errors';
import { createSupabaseSecretChatStore } from '@/lib/secretchat/supabase-store';
import type { SecretChatStore } from '@/lib/secretchat/store';
import { DEFAULT_FEED_PAGE_SIZE, feedQuerySchema } from '@/lib/secretchat/validation';

/**
 * Shared plumbing for the SecretChat route handlers.
 *
 * WHAT A ROUTE IS ALLOWED TO DO
 * A Next.js Route Handler module may only export the HTTP verbs, so anything
 * worth testing lives in a plain function. These helpers are that plain layer:
 * they check configuration, resolve the session, build the store, and turn any
 * outcome into a response. A route is then a couple of lines that say which
 * service function to call.
 *
 * WHY EVERY ROUTE GOES THROUGH `getRequestContext`
 * Three things must be true for every single operation, and none of them can be
 * left to an individual route author to remember:
 *   - the backend is configured, otherwise the reader gets `not_configured` and
 *     an honest setup message instead of a stack trace;
 *   - there is a session, otherwise `unauthenticated`;
 *   - the store runs as *that* session, so RLS applies.
 */

export interface RequestContext {
  store: SecretChatStore;
  userId: string;
  /**
   * Reads the JSON body. Malformed JSON becomes `invalid_request`.
   *
   * This is on the context rather than a free function so that reading the body is
   * *inside* the error boundary. A standalone `readJsonBody(request)` called before
   * `handleRequest` throws past the boundary, and a client sending a truncated body
   * gets an HTML error page instead of the JSON envelope it is coded to parse.
   */
  readBody: () => Promise<unknown>;
}

export async function getRequestContext(): Promise<Omit<RequestContext, 'readBody'>> {
  if (!isSupabaseConfigured()) throw notConfigured();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw unauthenticated();

  return { store: createSupabaseSecretChatStore(supabase), userId: data.user.id };
}

/**
 * Runs a service call and always answers with a JSON body.
 *
 * The request is a parameter so that `readBody` and any path-parameter validation
 * happen inside the `try`. Everything a client can get wrong - a missing session, a
 * truncated body, a malformed id, a failed service call - leaves through the same
 * `catch` and becomes the same shape of response. Nothing throws out of a route.
 *
 * An empty body is allowed through as `undefined` and left for the service's schema
 * to reject, so there is exactly one place that decides what a valid body is.
 */
export async function handleRequest(
  request: Request,
  run: (context: RequestContext) => Promise<unknown>
): Promise<NextResponse> {
  try {
    const context = await getRequestContext();

    const readBody = async (): Promise<unknown> => {
      try {
        return await request.json();
      } catch {
        throw invalidRequest();
      }
    };

    const body = await run({ ...context, readBody });
    return NextResponse.json({ ok: true, data: body });
  } catch (error) {
    const secretChatError = toSecretChatError(error);
    return NextResponse.json(secretChatError.toBody(), { status: secretChatError.status });
  }
}

/**
 * Reads pagination from the query string.
 *
 * A malformed value becomes the default page rather than an error: pagination
 * is a convenience, and a bad cursor should never leave a reader staring at a
 * failure screen. `feedQuerySchema` still bounds `limit`, so the clamp is a real
 * ceiling and not a suggestion.
 */
export function readFeedQuery(url: string): { limit: number; cursor?: string } {
  const params = new URL(url).searchParams;
  const parsed = feedQuerySchema.safeParse({
    limit: params.get('limit') ?? undefined,
    cursor: params.get('cursor') ?? undefined,
  });
  if (!parsed.success) {
    // Fall back to the default page rather than failing: a stale or hand-edited
    // cursor should show the top of the feed, not a failure screen. `limit` is
    // still bounded above by the schema, so an out-of-range value cannot be used
    // to ask for the whole table.
    return { limit: DEFAULT_FEED_PAGE_SIZE };
  }
  return parsed.data;
}
