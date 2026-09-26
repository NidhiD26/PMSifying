import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { db } from '../lib/db/dexie-db';
import { AssistantView } from '../features/assistant/assistant-view';

/**
 * The real locale file, so a renamed or missing key fails here rather than
 * rendering an empty bubble in production.
 */
const en = JSON.parse(readFileSync('public/locales/en.json', 'utf8')) as Record<
  string,
  unknown
>;

vi.mock('next-intl', () => {
  const cache = new Map<string, (key: string, params?: Record<string, unknown>) => string>();

  function getMessageFor(namespace: string) {
    const cached = cache.get(namespace);
    if (cached) return cached;

    const table = (en as Record<string, unknown>)[namespace] as
      | Record<string, unknown>
      | undefined;

    const getMessage = (key: string, params?: Record<string, unknown>): string => {
      let value: unknown = table;
      for (const part of key.split('.')) {
        if (value && typeof value === 'object' && part in (value as object)) {
          value = (value as Record<string, unknown>)[part];
        } else {
          return `MISSING:${namespace}.${key}`;
        }
      }
      if (typeof value !== 'string') return `MISSING:${namespace}.${key}`;
      return value.replace(/\{(\w+)[^}]*\}/g, (match, name: string) => {
        const replacement = params?.[name];
        return replacement === undefined ? match : String(replacement);
      });
    };

    type Translator = ((key: string, params?: Record<string, unknown>) => string) & {
      raw: (key: string) => string;
      has: (key: string) => boolean;
    };

    const translate = (key: string, params?: Record<string, unknown>) =>
      getMessage(key, params);
    const translator = translate as Translator;
    translator.raw = (key: string) => getMessage(key);
    translator.has = (key: string) => !getMessage(key).startsWith('MISSING:');

    cache.set(namespace, translator);
    return translator;
  }

  return {
    useTranslations: (namespace: string) => getMessageFor(namespace),
    useLocale: () => 'en',
  };
});

let fetchMock: ReturnType<typeof vi.fn>;

const ask = async (text: string) => {
  const input = await screen.findByRole('textbox');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /send|ask/i }));
};

/**
 * Flushes pending work and the state updates it triggers.
 *
 * The view loads records from Dexie and clears its "thinking" flag after the
 * request settles. Both land after the last assertion unless they are
 * explicitly drained, which leaves React reporting an act() warning and lets
 * the update leak into the next test. Draining microtasks alone is not enough:
 * fake-indexeddb resolves across macrotasks, so both are awaited here.
 */
const settle = async () => {
  // Several rounds: each await inside the view's error path (fetch -> json ->
  // catch -> setState) is a separate microtask turn, and fake-indexeddb adds
  // macrotask turns on top.
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

beforeEach(async () => {
  await db.cycles.clear();
  await db.daily_logs.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  // jsdom has no scrollTo; the view calls it when focusing the newest turn.
  Element.prototype.scrollTo = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the assistant view', () => {
  it('reaches a usable empty state with no records', async () => {
    render(<AssistantView />);
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeEnabled();
    });
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders a deterministic reply and still offers it to the server for rewording', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, mode: 'offline' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<AssistantView />);
    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    await ask('what is PCOS');

    await waitFor(() => {
      expect(screen.getByText(/education library says/i)).toBeInTheDocument();
    });
    // The client cannot read PMSIFY_ASSISTANT_GATEWAY, so it always asks. The
    // server decides, and the local reply is already on screen either way.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await settle();
  });

  it('sends only the redacted context, never notes or PIN material', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, mode: 'offline' }), { status: 200 })
    );
    await db.cycles.add({
      startDate: '2026-01-05',
      endDate: '2026-01-10',
      notes: 'SECRET-NOTE-CANARY',
      createdAt: '2026-01-05T00:00:00.000Z',
      updatedAt: '2026-01-05T00:00:00.000Z',
    } as never);

    render(<AssistantView />);
    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    await ask('what is PCOS');

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = String(init.body);
    expect(body).not.toContain('SECRET-NOTE-CANARY');
    expect(body).not.toContain('pinHash');
    expect(body).not.toContain('pinSalt');
    // The redacted context is the only user data that may travel.
    expect(body).toContain('"schemaVersion"');
  });

  it('adopts the provider wording when the server returns gateway mode', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, mode: 'gateway', text: 'PCOS is a common hormonal condition.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    render(<AssistantView />);
    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    await ask('what is PCOS');

    await waitFor(() => {
      expect(screen.getByText(/common hormonal condition/i)).toBeInTheDocument();
    });
  });

  it('keeps the deterministic reply when the server reports the gateway unavailable', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ ok: false, error: 'gateway_unavailable', reason: 'upstream_unavailable' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
    );
    render(<AssistantView />);
    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    await ask('what is PCOS');

    await waitFor(() => {
      expect(screen.getByText(/education library says/i)).toBeInTheDocument();
    });
  });

  it('keeps the deterministic reply when the API call fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    render(<AssistantView />);
    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    // Drain the record-loading effect before interacting, so its state updates
    // are attributed to act() rather than leaking into the assertions below.
    await settle();
    await ask('what is PCOS');
    await settle();

    await waitFor(() => {
      expect(screen.getByText(/education library says/i)).toBeInTheDocument();
    });
    // A network failure must not blank the conversation.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows crisis resources and never calls the API for a crisis message', async () => {
    render(<AssistantView />);
    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    await ask('I want to kill myself');

    await waitFor(() => {
      expect(screen.getByText(/112/)).toBeInTheDocument();
    });
    // A refusal is computed locally, so there is nothing to send anywhere.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a diagnosis question with no citations beside it', async () => {
    render(<AssistantView />);
    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    await ask('do I have PCOS');

    await waitFor(() => {
      expect(screen.getAllByText(/cannot tell you whether you have a condition/i).length).toBeGreaterThan(0);
    });
  });

  it('never renders a MISSING translation key', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, mode: 'offline' }), { status: 200 })
    );
    render(<AssistantView />);
    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    await ask('what is PCOS');
    await waitFor(() => {
      expect(screen.getByText(/education library says/i)).toBeInTheDocument();
    });
    expect(document.body.textContent).not.toContain('MISSING:');
    await settle();
  });
});
