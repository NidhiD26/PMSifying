import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInMemoryHealthcareFixture, type InMemoryHealthcareFixture } from '@/lib/healthcare/store';

/**
 * Every healthcare response must be JSON, whatever went wrong.
 *
 * The regression this file exists for is one specific mistake: reading the request body
 * *before* entering the error boundary. A route that did `await readJsonBody(request)`
 * outside `handleRequest` throws past the catch, and a client sending a truncated body
 * gets Next's HTML error page instead of the envelope its code is written to parse — an
 * unhandled 500 where the contract says 400, and HTML where the contract says JSON. On
 * a phone on a bad connection, which is where a health worker will mostly be, a
 * truncated body is not an exotic case.
 *
 * The session layer is mocked so routing and error mapping run with no database and no
 * credentials; the real in-memory store backs the service, so a request genuinely
 * round-trips.
 */

const ASHA = '22222222-2222-4222-8222-222222222222';
const MEMBER = '11111111-1111-4111-8111-111111111111';

const authState = { configured: true, userId: MEMBER as string | null };
let fixture: InMemoryHealthcareFixture;

vi.mock('@/lib/supabase/env', () => ({
  isSupabaseConfigured: () => authState.configured,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () =>
        authState.userId === null
          ? { data: { user: null }, error: { message: 'no session' } }
          : { data: { user: { id: authState.userId } }, error: null },
    },
  }),
}));

vi.mock('@/lib/healthcare/supabase-store', () => ({
  createSupabaseHealthcareStore: () => fixture.store,
}));

// Imported after the mocks, so the routes pick them up.
const { GET: campsRoute, POST: createCampRoute } = await import('@/app/api/healthcare/camps/route');const { POST: createHouseholdRoute } = await import('@/app/api/healthcare/households/route');
const { GET: ashaDashboardRoute } = await import('@/app/api/healthcare/asha/dashboard/route');
const { GET: doctorDashboardRoute } = await import('@/app/api/healthcare/doctor/dashboard/route');
const { POST: prescriptionsRoute } = await import(
  '@/app/api/healthcare/cases/[caseId]/prescriptions/route'
);
const { GET: caseReviewRoute } = await import('@/app/api/healthcare/cases/[caseId]/route');
const { GET: registrationsRoute } = await import(
  '@/app/api/healthcare/camps/[campId]/registrations/route'
);
const { readCampQuery, readCaseQuery } = await import('@/lib/healthcare/route');

/** A request whose body is not valid JSON, which is the interesting case. */
function truncatedBodyRequest(url: string): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"title": "half a camp',
  });
}

function jsonRequest(url: string, body: unknown, method = 'POST'): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Dynamic-route params, in the shape Next 15 actually hands a handler: a Promise.
 *
 * Generic so the argument type survives, because a route handler declares the exact
 * keys it expects and widening them to Record<string, string> is a type error in its
 * own right — which is a small, useful thing: the handler cannot quietly start
 * expecting a parameter the folder does not provide.
 */
const params = <T extends Record<string, string>>(values: T) => ({ params: Promise.resolve(values) });

const body = async (response: Response) => (await response.json()) as Record<string, unknown>;

beforeEach(() => {
  fixture = createInMemoryHealthcareFixture();
  fixture.seedProfile(MEMBER);
  void fixture.store.createAshaProfile({
    userId: ASHA,
    fullName: 'Asha Worker',
    registrationNumber: 'ASHA-1',
    area: 'Block 1',
  });
  authState.configured = true;
  authState.userId = ASHA;
});

describe('the envelope holds for every failure', () => {
  it('answers JSON for a truncated body, not an HTML error page', async () => {
    const response = await createCampRoute(
      truncatedBodyRequest('https://app.test/api/healthcare/camps')
    );
    expect(response.status).toBe(400);
    const parsed = await body(response);
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('invalid_request');
  });

  it('answers JSON when there is no session', async () => {
    authState.userId = null;
    const response = await campsRoute(new Request('https://app.test/api/healthcare/camps'));
    expect(response.status).toBe(401);
    expect((await body(response)).code).toBe('unauthenticated');
  });

  it('answers JSON when the backend is not configured', async () => {
    authState.configured = false;
    const response = await campsRoute(new Request('https://app.test/api/healthcare/camps'));
    expect(response.status).toBe(503);
    expect((await body(response)).code).toBe('not_configured');
  });

  it('answers JSON for a malformed id in the path', async () => {
    const response = await caseReviewRoute(
      new Request('https://app.test/api/healthcare/cases/not-a-uuid'),
      params({ caseId: 'not-a-uuid' })
    );
    expect(response.status).toBe(400);
    const parsed = await body(response);
    expect(parsed.code).toBe('invalid_request');
    // A field path, never the value: the path is already known, but the habit is what
    // keeps a submitted value out of an error body everywhere else.
    expect(parsed.fields).toEqual(['caseId']);
  });

  it('wraps a success in the same envelope as every failure', async () => {
    const response = await createHouseholdRoute(
      jsonRequest('https://app.test/api/healthcare/households', {
        name: 'Sharma household',
        addressLine: '12 Field Road',
      })
    );
    expect(response.status).toBe(200);
    const parsed = await body(response);
    expect(parsed.ok).toBe(true);
    expect(parsed.data).toMatchObject({ name: 'Sharma household' });
  });
});

describe('the session is the only source of authority', () => {
  it('refuses a member the staff-only camp list', async () => {
    // The route passes no role and no user id; `getRequestContext` builds the actor from
    // the session. There is no parameter a client could have used to change that.
    authState.userId = MEMBER;
    const response = await createCampRoute(
      jsonRequest('https://app.test/api/healthcare/camps', {
        title: 'Not mine to run',
        campDate: '2030-02-01',
        startTime: '09:00',
        endTime: '13:00',
        location: 'Community hall',
        capacity: 10,
      })
    );
    expect(response.status).toBe(403);
    expect((await body(response)).code).toBe('forbidden');
  });

  it('refuses a member the worker dashboard', async () => {
    authState.userId = MEMBER;
    const response = await ashaDashboardRoute(
      new Request('https://app.test/api/healthcare/asha/dashboard')
    );
    expect(response.status).toBe(403);
  });

  it('refuses a member the doctor dashboard', async () => {
    authState.userId = MEMBER;
    const response = await doctorDashboardRoute(
      new Request('https://app.test/api/healthcare/doctor/dashboard')
    );
    expect(response.status).toBe(403);
  });

  it('refuses a member a prescription before it looks at the case', async () => {
    authState.userId = MEMBER;
    const response = await prescriptionsRoute(
      jsonRequest(
        'https://app.test/api/healthcare/cases/11111111-1111-4111-8111-111111111111/prescriptions',
        {
          medicineName: 'Paracetamol',
          dosage: '500mg',
          frequency: 'Twice daily',
          duration: '3 days',
        }
      ),
      params({ caseId: '11111111-1111-4111-8111-111111111111' })
    );
    // `forbidden`, not `not_found`: this is a statement about the caller's own role, and
    // a 404 would confirm the case they named exists.
    expect(response.status).toBe(403);
    expect((await body(response)).code).toBe('forbidden');
  });

  it('answers not_found for a case the caller cannot see', async () => {
    // No such case exists, and the caller is a plain member. Both facts lead to the
    // same answer, which is the point: the answer never distinguishes "no case" from
    // "a case you may not see".
    authState.userId = MEMBER;
    const response = await caseReviewRoute(
      new Request('https://app.test/api/healthcare/cases/11111111-1111-4111-8111-111111111111'),
      params({ caseId: '11111111-1111-4111-8111-111111111111' })
    );
    expect(response.status).toBe(404);
    expect((await body(response)).code).toBe('not_found');
  });
});

describe('list queries from the search string', () => {
  it('falls back to the schema default for a hand-edited limit', async () => {
    // A bad filter shows a queue rather than a failure screen, and the ceiling is the
    // schema's own, so `?limit=99999` cannot ask for the whole table.
    const query = readCaseQuery('https://app.test/api/healthcare/cases?limit=99999');
    expect(query.limit).toBeLessThanOrEqual(100);
  });

  it('keeps a value that parses', () => {
    const query = readCaseQuery('https://app.test/api/healthcare/cases?priority=URGENT&limit=5');
    expect(query).toMatchObject({ limit: 5, priority: 'URGENT' });
  });

  it('does not turn an unknown status into an unfiltered list', () => {
    // A typo in a filter is shown as the empty list that was asked for, never as
    // everything — an unfiltered list is a bigger list than anybody asked to see.
    const query = readCaseQuery('https://app.test/api/healthcare/cases?status=URGNET');
    expect(query.status).toBe('ALL');
  });

  it('defaults camps to the published ones, not to the drafts', () => {
    // A different default from the case list, and for a good reason: an unpublished
    // camp is a plan, and the public list is what people turn up to.
    expect(readCampQuery('https://app.test/api/healthcare/camps?limit=nonsense')).toMatchObject({
      status: 'PUBLISHED',
    });
  });
});

describe('the camp roster endpoint', () => {
  const campId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  const createCamp = async (): Promise<string> => {
    const response = await createCampRoute(
      jsonRequest('https://app.test/api/healthcare/camps', {
        title: 'Village health camp',
        description: null,
        campDate: '2030-03-01',
        startTime: '09:00',
        endTime: '13:00',
        location: 'Community hall',
        capacity: 5,
      })
    );
    const parsed = await body(response);
    return (parsed['data'] as { id: string }).id;
  };

  it('answers an empty roster for a camp nobody has signed up to', async () => {
    const id = await createCamp();
    authState.userId = ASHA;

    const response = await registrationsRoute(
      new Request(`https://app.test/api/healthcare/camps/${id}/registrations`),
      params({ campId: id })
    );

    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({ ok: true, data: [] });
  });

  it('refuses a member, and a worker who did not organise the camp', async () => {
    const id = await createCamp();

    // A member is refused on the role.
    authState.userId = MEMBER;
    const asMember = await registrationsRoute(
      new Request(`https://app.test/api/healthcare/camps/${id}/registrations`),
      params({ campId: id })
    );
    expect(asMember.status).toBe(403);
    expect((await body(asMember))['code']).toBe('forbidden');

    // And the envelope holds while saying so.
    authState.userId = ASHA;
    const asWorker = await registrationsRoute(
      new Request(`https://app.test/api/healthcare/camps/${id}/registrations`),
      params({ campId: id })
    );
    expect(asWorker.status).toBe(200);
  });

  it('refuses a camp id that is not an id, rather than passing it to the store', async () => {
    authState.userId = ASHA;
    const response = await registrationsRoute(
      new Request('https://app.test/api/healthcare/camps/not-a-uuid/registrations'),
      params({ campId: 'not-a-uuid' })
    );

    expect(response.status).toBe(400);
    expect((await body(response))['fields']).toEqual(['campId']);
  });

  it('answers 404 for a camp that does not exist, which is the organiser’s answer', async () => {
    authState.userId = ASHA;
    const response = await registrationsRoute(
      new Request(`https://app.test/api/healthcare/camps/${campId}/registrations`),
      params({ campId: campId })
    );

    expect(response.status).toBe(404);
  });

  it('is not reachable without a session', async () => {
    const id = await createCamp();
    authState.userId = null;

    const response = await registrationsRoute(
      new Request(`https://app.test/api/healthcare/camps/${id}/registrations`),
      params({ campId: id })
    );

    expect(response.status).toBe(401);
  });
});
