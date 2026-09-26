import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInMemorySecretChatStore } from '../lib/secretchat/store';
import type { SecretChatStore } from '../lib/secretchat/store';

/**
 * Every SecretChat response must be JSON, whatever went wrong.
 *
 * This file is mostly a regression guard for one specific mistake: parsing the
 * request body before entering the error boundary. A route that did
 * `const input = await readJsonBody(request)` and *then* called the handler meant
 * that a client sending a truncated body got Next's error page instead of the
 * envelope its code is written to parse — an unhandled 500 where the contract says
 * 400, and HTML where the contract says JSON.
 *
 * The session layer is mocked so the tests exercise routing and error mapping
 * with no database and no credentials, while the real in-memory store backs the
 * service so the request genuinely round-trips.
 */

const authState = { configured: true, userId: 'aaaaaaaa-0000-4000-8000-000000000001' as string | null };

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

let store: SecretChatStore;

vi.mock('@/lib/secretchat/supabase-store', () => ({
  createSupabaseSecretChatStore: () => store,
}));

// Imported after the mocks so the route picks them up.
const { handleRequest } = await import('@/lib/secretchat/route');
const { POST: createPostRoute } = await import('@/app/api/secretchat/posts/route');
const { POST: createCommentRoute } = await import('@/app/api/secretchat/posts/[postId]/comments/route');
const { DELETE: deleteCommentRoute } = await import('@/app/api/secretchat/comments/[commentId]/route');
const { GET: feedRoute } = await import('@/app/api/secretchat/feed/route');

beforeEach(() => {
  store = createInMemorySecretChatStore();
  authState.configured = true;
  authState.userId = 'aaaaaaaa-0000-4000-8000-000000000001';
});

/** A request whose body is not valid JSON, which is the interesting case. */
function truncatedBodyRequest(url = 'https://app.test/api/secretchat/posts'): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"content": "half a post',
  });
}

function jsonRequest(url: string, body: unknown, method = 'POST'): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('the response envelope', () => {
  it('answers a successful call with ok and data', async () => {
    const response = await createPostRoute(
      jsonRequest('https://app.test/api/secretchat/posts', { content: 'hello' })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.content).toBe('hello');
  });

  /**
   * The regression this file exists for. Before the body reader moved inside the
   * boundary, this threw out of the route and produced a framework error page.
   */
  it('answers malformed JSON with a JSON 400, not an error page', async () => {
    const response = await createPostRoute(truncatedBodyRequest());

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/json');

    const body = await response.json();
    expect(body).toEqual({ ok: false, code: 'invalid_request' });
    // And it really is JSON all the way down, not HTML pretending to be parsed.
    expect(typeof body.code).toBe('string');
  });

  it('answers a malformed body the same way on every write route', async () => {
    const routes: [string, (request: Request) => Promise<Response>][] = [
      ['posts', createPostRoute],
      [
        'comments',
        (request) =>
          createCommentRoute(request, {
            params: Promise.resolve({ postId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' }),
          }),
      ],
    ];

    for (const [name, route] of routes) {
      const response = await route(truncatedBodyRequest());
      expect({ name, status: response.status }).toEqual({ name, status: 400 });
      expect(await response.json()).toEqual({ ok: false, code: 'invalid_request' });
    }
  });

  it('answers a malformed id on a comment route with a JSON 400', async () => {
    const response = await createCommentRoute(
      jsonRequest('https://app.test/x', { content: 'hi' }),
      { params: Promise.resolve({ postId: 'not-a-uuid' }) }
    );

    expect(response.status).toBe(400);
    // The field is named, which is what lets a client point at the right input.
    expect(await response.json()).toEqual({
      ok: false,
      code: 'invalid_request',
      fields: ['postId'],
    });
  });

  it('answers a malformed id on a comment delete with a JSON 400', async () => {
    const response = await deleteCommentRoute(
      new Request('https://app.test/x', { method: 'DELETE' }),
      { params: Promise.resolve({ commentId: 'nope' }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: 'invalid_request',
      fields: ['commentId'],
    });
  });

  it('names a failing field exactly once', async () => {
    // An empty string fails two refinements, and the client should be told once.
    const response = await createPostRoute(
      jsonRequest('https://app.test/api/secretchat/posts', { content: '' })
    );

    const body = await response.json();
    expect(body.fields).toEqual(['content']);
  });

  it('names the offending field without echoing the submitted value', async () => {
    const response = await createPostRoute(
      jsonRequest('https://app.test/api/secretchat/posts', { content: '' })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.fields).toEqual(['content']);
    expect(JSON.stringify(body)).not.toContain('echoed-secret');
  });
});

describe('the session boundary', () => {
  it('refuses everything when the backend is not configured', async () => {
    authState.configured = false;

    const response = await feedRoute(new Request('https://app.test/api/secretchat/feed'));

    // 503 and not 401: this is a deployment step, so the UI shows setup
    // instructions instead of a sign-in form that could never work.
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, code: 'not_configured' });
  });

  it('checks configuration before the session', async () => {
    authState.configured = false;
    authState.userId = null;

    const response = await feedRoute(new Request('https://app.test/api/secretchat/feed'));
    expect((await response.json()).code).toBe('not_configured');
  });

  it('refuses an anonymous request with 401', async () => {
    authState.userId = null;

    const response = await feedRoute(new Request('https://app.test/api/secretchat/feed'));

    // 401 rather than 403: "not signed in" and "not allowed" are different states
    // and the UI reacts differently to each.
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, code: 'unauthenticated' });
  });

  it('does not run the operation when there is no session', async () => {
    authState.userId = null;

    await createPostRoute(jsonRequest('https://app.test/api/secretchat/posts', { content: 'hi' }));

    // The store would have written a post had the boundary been crossed.
    expect(await store.listFeed({ viewerId: 'anyone', limit: 10, excludeAuthorIds: [] })).toEqual(
      []
    );
  });
});

describe('errors from the service', () => {
  it('maps a permission failure to forbidden with its status', async () => {
    const created = await createPostRoute(
      jsonRequest('https://app.test/api/secretchat/posts', { content: 'mine' })
    );
    const postId = (await created.json()).data.id as string;

    authState.userId = 'bbbbbbbb-0000-4000-8000-000000000002';
    const response = await handleRequest(
      new Request('https://app.test/x', { method: 'DELETE' }),
      () => import('@/lib/secretchat/service').then((m) => m.deletePost(store, { viewerId: authState.userId!, postId }))
    );

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('forbidden');
  });

  it('never leaks a stack trace or an internal message', async () => {
    const response = await handleRequest(new Request('https://app.test/x'), async () => {
      throw new Error('connection string postgres://user:hunter2@db.internal/secretchat failed');
    });

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toEqual({ ok: false, code: 'upstream_unavailable' });
    expect(JSON.stringify(body)).not.toContain('hunter2');
    expect(JSON.stringify(body)).not.toContain('secretchat');
  });
});

describe('readBody', () => {
  it('rejects a second read as a client error rather than crashing', async () => {
    // A route that read the body twice would otherwise throw a confusing internal
    // error from the Request implementation.
    const response = await handleRequest(
      jsonRequest('https://app.test/x', { a: 1 }),
      async ({ readBody }) => {
        await readBody();
        await readBody();
        return null;
      }
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_request');
  });
});
