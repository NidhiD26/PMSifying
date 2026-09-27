/**
 * The one error type every PMSify server route answers with.
 *
 * WHY THIS IS SHARED RATHER THAN PER-FEATURE
 * SecretChat established the contract first: a JSON envelope, a stable machine
 * readable `code`, an HTTP status that matches it, and never a stack trace or an
 * internal message. Healthcare is a different feature with a different domain, but
 * the browser code that talks to it must be written against exactly the same
 * shape, so the two features share this module instead of each inventing one.
 * `@/lib/secretchat/errors` re-exports these factories as `SecretChatError` so the
 * pre-existing behaviour, codes and tests are unchanged.
 *
 * WHY THE CODE SET IS CLOSED
 * A client switches on `code`, not on prose and not on a status number. An open
 * set of codes is how a caller ends up with a `default:` branch that swallows a
 * real failure, so adding one is a deliberate edit to this union rather than
 * something a call site can invent.
 *
 * THE DISTINCTIONS THAT MATTER
 *   401 vs 403  "you are not signed in" and "you are not allowed" are different
 *               states: one offers a sign-in form, the other offers going back.
 *   404 vs 403  a row that is not yours is reported as not found, so a caller
 *               cannot turn an id into an oracle for what exists. `forbidden` is
 *               reserved for a caller who is known and known to be the wrong role
 *               for the operation at all.
 *   503 vs 502  `not_configured` is a deployment step the operator has to
 *               perform; `upstream_unavailable` is a transient failure a retry
 *               may well fix. The UI shows setup instructions for one and a retry
 *               button for the other.
 */

export type ApiErrorCode =
  | 'invalid_request'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'not_configured'
  | 'upstream_unavailable'
  | 'rate_limited';

export interface ApiErrorBody {
  ok: false;
  code: ApiErrorCode;
  /** Field paths only. A message may echo the submitted value; a path may not. */
  fields?: string[];
  message?: string;
}

/**
 * One class for every failure, carrying the HTTP status and the stable code.
 *
 * A single class rather than a `switch` of strings at each call site, because the
 * interesting failures are the ones that must not be confused: reporting somebody
 * else's post is `forbidden`, not `not_found`, while liking a post that was deleted
 * a second ago is `not_found`. Collapsing them would either leak the existence of
 * deleted content or make a real permission problem look like a bug.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fields: string[];

  constructor(code: ApiErrorCode, status: number, fields: string[] = [], message?: string) {
    super(message ?? code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }

  toBody(): ApiErrorBody {
    const body: ApiErrorBody = { ok: false, code: this.code };
    if (this.fields.length > 0) body.fields = this.fields;
    if (this.message && this.message !== this.code) body.message = this.message;
    return body;
  }
}

export const invalidRequest = (fields: string[] = []): ApiError =>
  new ApiError('invalid_request', 400, fields);

export const unauthenticated = (): ApiError => new ApiError('unauthenticated', 401);

export const forbidden = (): ApiError => new ApiError('forbidden', 403);

/**
 * The row is gone, or was never visible to this reader.
 *
 * Used for both on purpose: reporting "this exists but not for you" would turn a
 * delete — or another worker's household — into a way to probe for what exists.
 */
export const notFound = (): ApiError => new ApiError('not_found', 404);

/**
 * The request was well formed and the world said no.
 *
 * `fields` is optional rather than absent because a rule violation is often
 * attached to one input — "this camp is full", on `campId` — and a form wants to
 * show the message there instead of only at the top. SecretChat never needed this
 * and does not pass it.
 */
export const conflict = (fields: string[] = []): ApiError => new ApiError('conflict', 409, fields);

/**
 * The backend is not connected yet.
 *
 * Distinct from `upstream_unavailable` on purpose: this one is a deployment step
 * the operator has to perform, so the UI can show setup instructions instead of a
 * retry button that will never help.
 */
export const notConfigured = (): ApiError => new ApiError('not_configured', 503);

/** Configured, but the database call failed. A retry may well work. */
export const upstreamUnavailable = (): ApiError => new ApiError('upstream_unavailable', 502);

export const rateLimited = (): ApiError => new ApiError('rate_limited', 429);

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/**
 * Maps an unknown throwable onto a response-safe error.
 *
 * Everything that is not already one of ours becomes `upstream_unavailable`, which
 * is what keeps a connection string, a stack frame or a driver message out of a
 * response body.
 */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error;
  return upstreamUnavailable();
}
