import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleAssistantRequest } from '../lib/assistant/handler';
import { emptyRedactedContext } from '../lib/assistant/context';
import { retrieveEducationSources, type EducationDoc } from '../lib/assistant/retrieval';


const SECRET = 'test-key-must-never-be-echoed';

/** The handler's env shape: a plain record, so no process.env mutation is needed. */
type Env = Record<string, string | undefined>;

/**
 * Retrieval takes the corpus from the caller so the view can localise article
 * text before ranking. The tests supply a small corpus, following the pattern
 * already used in learn-search.test.ts. The ids are real, because the route
 * allowlists article ids against the bundled corpus.
 */
const docs: EducationDoc[] = [
  {
    id: 'fertileWindow',
    topic: 'cycleBasics',
    titleKey: 'articles.fertileWindow.title',
    summaryKey: 'articles.fertileWindow.summary',
    title: 'Your fertile window',
    summary: 'When you are most likely to conceive.',
    body: 'The fertile window spans the days around ovulation, usually six days.',
  },
  {
    id: 'pcosOverview',
    topic: 'conditions',
    titleKey: 'articles.pcosOverview.title',
    summaryKey: 'articles.pcosOverview.summary',
    title: 'Living with PCOS',
    summary: 'Common symptoms and day to day management.',
    body: 'PCOS is a common hormonal condition. Symptoms can include irregular cycles and acne.',
  },
];

const sources = () =>
  retrieveEducationSources(docs, 'what is the fertile window').map((source) => ({
    articleId: source.articleId,
    topic: source.topic,
    score: source.score,
    titleKey: source.titleKey,
    summaryKey: source.summaryKey,
    title: source.title,
    summary: source.summary,
    excerpt: source.excerpt,
  }));

const source = () => sources()[0];

const request = (overrides: Record<string, unknown> = {}) => ({
  text: 'what is the fertile window',
  context: {
    ...emptyRedactedContext('en'),
    recordedCycles: 3,
    recordedDailyLogs: 1,
  },
  sources: sources(),
  ...overrides,
});

const enabledEnv = {
  PMSIFY_ASSISTANT_GATEWAY: 'enabled',
  PMSIFY_GEMMA_API_KEY: SECRET,
  PMSIFY_GEMMA_ENDPOINT: 'https://provider.test/v1',
  PMSIFY_GEMMA_MODEL: 'gemma-test',
} as Env;

const OFF = {} as Env;

/**
 * A provider reply. The parser expects the OpenAI-compatible shape
 * `choices[0].message.content`, which is what the self-hosted Gemma servers
 * this feature targets expose.
 */
const providerSays = (text: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* Off by default                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The whole feature works with the gateway off: the client composes the reply
 * locally, so an offline answer needs no server round trip at all. These tests
 * exist to prove the default never reaches for the network.
 */
describe('the endpoint is off unless explicitly enabled', () => {
  it('reports offline when the flag is absent', async () => {
    const { status, body } = await handleAssistantRequest(request(), OFF);
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, mode: 'offline' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['disabled', 'on', 'true', ''])('treats %j as off', async (flag) => {
    const { status, body } = await handleAssistantRequest(request(), {
      ...enabledEnv,
      PMSIFY_ASSISTANT_GATEWAY: flag,
    } as Env);
    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true, mode: 'offline' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts the flag case-insensitively', async () => {
    fetchMock.mockResolvedValue(providerSays('ok'));
    const { body } = await handleAssistantRequest(request(), {
      ...enabledEnv,
      PMSIFY_ASSISTANT_GATEWAY: 'ENABLED',
    } as Env);
    expect(body).toMatchObject({ ok: true, mode: 'gateway' });
  });

  it('reports offline when enabled but no key is configured', async () => {
    const { status, body } = await handleAssistantRequest(request(), {
      PMSIFY_ASSISTANT_GATEWAY: 'enabled',
      PMSIFY_GEMMA_ENDPOINT: 'https://provider.test/v1',
    } as Env);
    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true, mode: 'offline' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports offline when enabled but no endpoint is configured', async () => {
    const { status, body } = await handleAssistantRequest(request(), {
      PMSIFY_ASSISTANT_GATEWAY: 'enabled',
      PMSIFY_GEMMA_API_KEY: SECRET,
    } as Env);
    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true, mode: 'offline' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

describe('input validation rejects anything unexpected', () => {
  const rejects = async (overrides: Record<string, unknown>) => {
    const { status, body } = await handleAssistantRequest(request(overrides), enabledEnv);
    expect(status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    return body;
  };

  it('rejects an empty question', () => rejects({ text: '' }));
  it('rejects whitespace-only question', () => rejects({ text: '   ' }));
  it('rejects an over-long question', () => rejects({ text: 'x'.repeat(5001) }));
  it('rejects a non-object context', () => rejects({ context: 'everything' }));
  it('rejects a context carrying a forbidden key', () =>
    rejects({ context: { ...emptyRedactedContext('en'), pinHash: 'leak' } }));
  it('rejects an unsupported locale in the context', () =>
    rejects({ context: { ...emptyRedactedContext('en'), locale: 'fr' } }));
  it('rejects a locale smuggled in at the top level', () => rejects({ locale: 'en' }));
  it('rejects an unknown top-level key', () => rejects({ isAdmin: true }));
  it('rejects a non-array sources value', () => rejects({ sources: {} }));
  it('rejects a source with an extra property', () =>
    rejects({ sources: [{ ...source(), html: '<b>' }] }));
  it('rejects an over-long excerpt', () =>
    rejects({ sources: [{ ...source(), excerpt: 'y'.repeat(2001) }] }));
  it('rejects a source citing an article the app does not ship', () =>
    rejects({ sources: [{ ...source(), articleId: 'not-a-real-article' }] }));
  it('rejects a context with an over-long string', () =>
    rejects({ context: { ...emptyRedactedContext('en'), dataSufficiency: 'z'.repeat(300) } }));

  it('reports only field paths, never the submitted values', async () => {
    const body = (await rejects({ text: '' })) as { fields: string[]; error: string };
    expect(body.error).toBe('invalid_request');
    expect(body.fields).toContain('text');
    expect(JSON.stringify(body)).not.toContain('5001');
  });

  it('accepts a well-formed request', async () => {
    fetchMock.mockResolvedValue(providerSays('ok'));
    const { status, body } = await handleAssistantRequest(request(), enabledEnv);
    expect(status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body).toMatchObject({ ok: true, mode: 'gateway' });
  });
});

/* -------------------------------------------------------------------------- */
/* The provider boundary                                                       */
/* -------------------------------------------------------------------------- */

describe('the provider is only contacted for a safe, configured request', () => {
  it('returns the provider text in gateway mode', async () => {
    fetchMock.mockResolvedValue(providerSays('Your fertile window usually spans six days.'));
    const { status, body } = await handleAssistantRequest(request(), enabledEnv);
    expect(status).toBe(200);
    expect(body).toEqual({
      ok: true,
      mode: 'gateway',
      text: 'Your fertile window usually spans six days.',
    });
  });

  it('sends the key in the Authorization header and never in the body', async () => {
    fetchMock.mockResolvedValue(providerSays('ok'));
    await handleAssistantRequest(request(), enabledEnv);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(String(headers.Authorization)).toContain(SECRET);
    expect(String(init.body)).not.toContain(SECRET);
  });

  it('sends the model and grounding, and nothing else', async () => {
    fetchMock.mockResolvedValue(providerSays('ok'));
    await handleAssistantRequest(request(), enabledEnv);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://provider.test/v1');
    const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(sent.model).toBe('gemma-test');
    expect(JSON.stringify(sent)).toContain('fertileWindow');
  });

  it.each([
    ['a network failure', () => Promise.reject(new Error('network down')), 'upstream_unavailable'],
    ['a 500 response', () => Promise.resolve(new Response('boom', { status: 500 })), 'upstream_unavailable'],
    ['a 401 response', () => Promise.resolve(new Response('nope', { status: 401 })), 'upstream_rejected'],
    ['a 403 response', () => Promise.resolve(new Response('nope', { status: 403 })), 'upstream_rejected'],
    [
      'an unusable body',
      () => Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: 42 } }] }))),
      'empty_response',
    ],
    [
      'a native Gemini body, which is not the shape this parser speaks',
      () => Promise.resolve(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] }))),
      'empty_response',
    ],
    ['malformed JSON', () => Promise.resolve(new Response('not json')), 'upstream_unavailable'],
  ])('collapses %s into a typed failure', async (_label, impl, reason) => {
    fetchMock.mockImplementation(impl as () => Promise<Response>);
    const { status, body } = await handleAssistantRequest(request(), enabledEnv);
    expect(status).toBe(502);
    expect(body).toEqual({ ok: false, error: 'gateway_unavailable', reason });
  });

  it('never leaks the key or the upstream body on failure', async () => {
    fetchMock.mockResolvedValue(new Response('upstream exploded', { status: 500 }));
    const { body } = await handleAssistantRequest(request(), enabledEnv);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain('upstream exploded');
  });

  it('sends no text for an empty provider reply', async () => {
    fetchMock.mockResolvedValue(providerSays('   '));
    const { status } = await handleAssistantRequest(request(), enabledEnv);
    expect(status).toBe(502);
  });
});

/* -------------------------------------------------------------------------- */
/* Guardrails                                                                  */
/* -------------------------------------------------------------------------- */

describe('guardrails short-circuit before the provider', () => {
  it.each([
    'I want to kill myself',
    'should I take iron tablets',
    'do I have PCOS',
    'what is the share price of tata motors',
  ])('never forwards %j', async (text) => {
    const { status, body } = await handleAssistantRequest(request({ text }), enabledEnv);
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, mode: 'offline' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
