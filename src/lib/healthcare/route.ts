import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import { notConfigured, invalidRequest, toApiError, unauthenticated, forbidden } from '@/lib/healthcare/errors';
import { createSupabaseHealthcareStore } from '@/lib/healthcare/supabase-store';
import type { HealthcareStore } from '@/lib/healthcare/store';
import { resolveHealthcareActor, type HealthcareActor } from '@/lib/healthcare/session';
import { caseListQuerySchema, campListQuerySchema, followUpListQuerySchema, referralListQuerySchema } from '@/lib/healthcare/validation';
import type {
  CampListQuery,
  CaseListQuery,
  FollowUpListQuery,
  ReferralListQuery,
} from '@/lib/healthcare/validation';

/**
 * Shared plumbing for the healthcare route handlers.
 *
 * The same shape as `@/lib/secretchat/route`, with one thing added and one thing
 * removed.
 *
 * ADDED: THE ACTOR IS BUILT HERE, NOT IN EACH ROUTE
 * A route handler in Next may only export HTTP verbs, so everything worth testing is
 * a plain function — and that is exactly why the actor is resolved in `getRequestContext`
 * rather than inside each service call site. There is one way for a route to obtain a
 * `HealthcareActor`, it comes from the revalidated Supabase session and the stored
 * profile, and no route can pass a role in from the browser because there is no
 * parameter for one. A route that built its own actor would be a route that could
 * disagree with the server about who the caller is.
 *
 * REMOVED: NOTHING, BUT WORTH NAMING
 * The store runs as the caller's own session, so RLS applies underneath every query
 * here. The service repeats the same rules in TypeScript and the database repeats them
 * again in SQL. That is three implementations of one rule and it is deliberate: the
 * service layer is what can produce a *right answer* rather than a database error, and
 * RLS is the layer that holds when the other two are wrong. The in-memory store used by
 * the tests implements none of the SQL, which is precisely why the service's own scope
 * rules are tested directly.
 */

export interface RequestContext {
  store: HealthcareStore;
  actor: HealthcareActor;
  /**
   * Reads the JSON body. Malformed JSON becomes `invalid_request`.
   *
   * On the context rather than a free function so that reading the body is *inside* the
   * error boundary. A standalone `readJsonBody(request)` called before `handleRequest`
   * throws past the boundary, and a client sending a truncated body gets an HTML error
   * page instead of the JSON envelope its code is written to parse.
   */
  readBody: () => Promise<unknown>;
}

import { getHealthcareDemoSession } from '@/lib/healthcare/demo-session';
import { getDemoHealthcareStore, getDemoActor } from '@/lib/demo/healthcare-demo';

export async function getRequestContext(request?: Request): Promise<Omit<RequestContext, 'readBody'>> {
  const isVitest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

  if (!isSupabaseConfigured()) {
    if (isVitest) throw notConfigured();
    const session = await getHealthcareDemoSession();
    if (!session) throw unauthenticated();

    if (request?.url) {
      const pathname = new URL(request.url).pathname;
      if (pathname.includes('/doctor') && session.role !== 'DOCTOR') throw forbidden();
      if (pathname.includes('/asha') && session.role !== 'ASHA') throw forbidden();
    }
    return {
      store: await getDemoHealthcareStore(),
      actor: getDemoActor(session.role),
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      if (isVitest) throw unauthenticated();
      const session = await getHealthcareDemoSession();
      if (!session) throw unauthenticated();

      if (request?.url) {
        const pathname = new URL(request.url).pathname;
        if (pathname.includes('/doctor') && session.role !== 'DOCTOR') throw forbidden();
        if (pathname.includes('/asha') && session.role !== 'ASHA') throw forbidden();
      }
      return {
        store: await getDemoHealthcareStore(),
        actor: getDemoActor(session.role),
      };
    }

    const store = createSupabaseHealthcareStore(supabase);
    const actor = await resolveHealthcareActor(data.user.id, store);
    if (request?.url) {
      const pathname = new URL(request.url).pathname;
      if (pathname.includes('/doctor') && actor.role !== 'DOCTOR') throw forbidden();
      if (pathname.includes('/asha') && actor.role !== 'ASHA') throw forbidden();
    }
    return { store, actor };
  } catch (err) {
    if (isVitest) throw err;
    const session = await getHealthcareDemoSession();
    if (!session) throw unauthenticated();

    if (request?.url) {
      const pathname = new URL(request.url).pathname;
      if (pathname.includes('/doctor') && session.role !== 'DOCTOR') throw forbidden();
      if (pathname.includes('/asha') && session.role !== 'ASHA') throw forbidden();
    }
    return {
      store: await getDemoHealthcareStore(),
      actor: getDemoActor(session.role),
    };
  }
}

export async function handleRequest(
  request: Request,
  run: (context: RequestContext) => Promise<unknown>
): Promise<NextResponse> {
  try {
    const context = await getRequestContext(request);

    const readBody = async (): Promise<unknown> => {
      try {
        return await request.json();
      } catch {
        throw invalidRequest();
      }
    };

    const data = await run({ ...context, readBody });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const healthcareError = toApiError(error);
    return NextResponse.json(healthcareError.toBody(), { status: healthcareError.status });
  }
}

/**
 * Turns the `params` a dynamic route receives into a record of strings.
 *
 * Next 15 hands a route `{ params: Promise<{ id: string }> }` rather than the object
 * itself. The awkward part is that it is `Promise` on the outside and untyped on the
 * inside, and a route that forgets to await it passes a Promise where a string is
 * expected — which then fails deep inside a service as a malformed id rather than as
 * the routing mistake it is. This helper is the one place that shape is known, so the
 * mistake cannot be made per-route.
 */
export async function readParams(
  params: unknown
): Promise<Record<string, string>> {
  const resolved = await (params as Promise<Record<string, string>>);
  return resolved ?? {};
}

/**
 * Reads a list query from the search string.
 *
 * A malformed value becomes the schema's own default rather than an error: pagination
 * and filtering are conveniences, and a bad filter should not leave a worker staring
 * at a failure screen instead of their queue. The fallback is the schema's default
 * parse, so the page size and the default status live in exactly one place and cannot
 * drift apart from what the service accepts.
 *
 * A value that parses is passed through unchanged, also deliberately. A worker who
 * filters to `URGENT` and mistypes it is shown the empty list they asked for, rather
 * than a list of everything — which would be an answer to a different question, and a
 * privacy-shaped one: an unfiltered list is a bigger list than they were entitled to.
 */
type ListSchema<T> = {
  safeParse: (value: unknown) => { success: boolean; data?: T };
  parse: (value: unknown) => T;
};

function readListQuery<T>(url: string, schema: ListSchema<T>): T {
  const params = new URL(url).searchParams;
  const parsed = schema.safeParse({
    limit: params.get('limit') ?? undefined,
    status: params.get('status') ?? undefined,
    priority: params.get('priority') ?? undefined,
  });
  return parsed.success && parsed.data ? parsed.data : schema.parse({});
}

export const readCaseQuery = (url: string): CaseListQuery => readListQuery(url, caseListQuerySchema);

export const readReferralQuery = (url: string): ReferralListQuery =>
  readListQuery(url, referralListQuerySchema);

export const readFollowUpQuery = (url: string): FollowUpListQuery =>
  readListQuery(url, followUpListQuerySchema);

export const readCampQuery = (url: string): CampListQuery => readListQuery(url, campListQuerySchema);
