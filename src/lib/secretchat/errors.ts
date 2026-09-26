import type { SecretChatErrorBody, SecretChatErrorCode } from '@/types/secretchat';

/**
 * One error type for every SecretChat failure, carrying the HTTP status and the
 * stable code the client switches on.
 *
 * A single class rather than a `switch` of strings at each call site, because
 * the interesting failures are the ones that must not be confused: reporting
 * someone else's post is `forbidden`, not `not_found`, while liking a post that
 * was deleted a second ago is `not_found`. Collapsing them would either leak
 * the existence of deleted content or make a real permission problem look like
 * a bug.
 */
export class SecretChatError extends Error {
  readonly code: SecretChatErrorCode;
  readonly status: number;
  readonly fields: string[];

  constructor(code: SecretChatErrorCode, status: number, fields: string[] = [], message?: string) {
    super(message ?? code);
    this.name = 'SecretChatError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }

  toBody(): SecretChatErrorBody {
    const body: SecretChatErrorBody = { ok: false, code: this.code };
    if (this.fields.length > 0) body.fields = this.fields;
    if (this.message && this.message !== this.code) body.message = this.message;
    return body;
  }
}

export const invalidRequest = (fields: string[] = []): SecretChatError =>
  new SecretChatError('invalid_request', 400, fields);

/**
 * No session. 401 rather than 403, because "you are not signed in" and "you
 * are not allowed" are different states, and the UI reacts differently: one
 * offers sign-in, the other offers going back.
 */
export const unauthenticated = (): SecretChatError =>
  new SecretChatError('unauthenticated', 401);

/** Signed in, but not allowed to touch this row. */
export const forbidden = (): SecretChatError => new SecretChatError('forbidden', 403);

/**
 * The row is gone, or was never visible to this reader.
 *
 * Used for both on purpose: reporting "this exists but not for you" would turn
 * a delete into a way to probe for other people's content.
 */
export const notFound = (): SecretChatError => new SecretChatError('not_found', 404);

export const conflict = (): SecretChatError => new SecretChatError('conflict', 409);

/**
 * The backend is not connected yet.
 *
 * Distinct from `upstream_unavailable` on purpose: this one is a deployment
 * step the operator has to perform, so the UI can show setup instructions
 * instead of a retry button that will never help.
 */
export const notConfigured = (): SecretChatError => new SecretChatError('not_configured', 503);

/** Configured, but the database call failed. A retry may well work. */
export const upstreamUnavailable = (): SecretChatError =>
  new SecretChatError('upstream_unavailable', 502);

export const rateLimited = (): SecretChatError => new SecretChatError('rate_limited', 429);

export function isSecretChatError(value: unknown): value is SecretChatError {
  return value instanceof SecretChatError;
}

/** Maps an unknown throwable onto a response-safe error. */
export function toSecretChatError(error: unknown): SecretChatError {
  if (isSecretChatError(error)) return error;
  return upstreamUnavailable();
}
