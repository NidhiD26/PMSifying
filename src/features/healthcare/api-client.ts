/**
 * The browser's half of the healthcare API.
 *
 * Every healthcare response is the envelope `@/lib/api/errors` defines:
 * `{ ok: true, data }` or `{ ok: false, code, fields?, message? }`. This module is
 * the only place in the UI that knows that, so a component asks for a record and gets
 * a record, and the one thing it has to handle is a failure.
 *
 * WHY THE FAILURE CARRIES A CODE AND NOT A MESSAGE
 * A message from the server is for logs. A member reading a screen in Kannada needs a
 * sentence in Kannada, and the only way to produce that is to turn the code into a
 * message key. So a failure arrives here as a code, is turned into
 * `healthcare.errors.<code>`, and the raw text is never shown — which is also what
 * keeps a stack trace, a SQL message or a Supabase internal out of the interface. An
 * unrecognised code falls back rather than rendering whatever arrived.
 */
export interface HealthcareRequestFailure {
  code: string;
  fields: string[];
}

/** Thrown by every call here. Never carries server prose. */
export class HealthcareRequestError extends Error {
  readonly code: string;
  readonly fields: string[];

  constructor(failure: HealthcareRequestFailure) {
    super(failure.code);
    this.name = 'HealthcareRequestError';
    this.code = failure.code;
    this.fields = failure.fields;
  }
}

type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; code?: string; fields?: string[]; message?: string };

/** The message key for a code, so a component can ask for it without a lookup table. */
export const errorMessageKey = (code: string): string =>
  `healthcare.errors.${code}`;

/**
 * A `fetch` that speaks the envelope.
 *
 * `path` is a locale-agnostic app path such as `/asha/referrals`; the caller is
 * responsible for the `/api/healthcare` prefix, which is written out here so a typo
 * cannot produce a request to the personal app's own routes.
 */
export async function callHealthcareApi<T>(
  path: string,
  init?: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown }
): Promise<T> {
  const response = await fetch(`/api/healthcare${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });

  // A non-JSON body means something upstream of the feature answered — a proxy, a
  // platform error page. Parsing it would throw inside a component, so it is read as
  // text and reported as a code the UI already has a sentence for.
  let envelope: Envelope<T>;
  try {
    envelope = (await response.json()) as Envelope<T>;
  } catch {
    throw new HealthcareRequestError({ code: 'unknown', fields: [] });
  }

  if (envelope && typeof envelope === 'object' && envelope.ok === true) {
    return envelope.data;
  }

  const failure = envelope as { code?: string; fields?: string[] } | null;
  throw new HealthcareRequestError({
    // The status is the fallback rather than the message: a proxy's 500 and our 500
    // are the same sentence to a reader, and the server's prose is never trusted.
    code: failure?.code ?? (response.status === 401 ? 'unauthenticated' : 'unknown'),
    fields: Array.isArray(failure?.fields) ? failure.fields : [],
  });
}
