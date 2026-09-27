import { ApiError } from '@/lib/api/errors';
import type { SecretChatErrorBody, SecretChatErrorCode } from '@/types/secretchat';

/**
 * SecretChat's view of the shared API error.
 *
 * The envelope, the codes and the statuses were defined here first and are now
 * implemented once in `@/lib/api/errors`, because Healthcare needed the identical
 * contract and two independent copies of it would be free to drift. This subclass
 * keeps the name, the `instanceof` check and every factory export exactly as they
 * were, so the feature's existing behaviour and tests are untouched.
 *
 * `SecretChatErrorCode` and `SecretChatErrorBody` are aliases of the shared types
 * in `@/types/secretchat`, so "the two vocabularies agree" is a fact of the type
 * system rather than a convention.
 */
export class SecretChatError extends ApiError {
  constructor(
    code: SecretChatErrorCode,
    status: number,
    fields: string[] = [],
    message?: string
  ) {
    super(code, status, fields, message);
    this.name = 'SecretChatError';
  }

  /** The shared envelope, typed with SecretChat's own code union. */
  override toBody(): SecretChatErrorBody {
    return super.toBody() as SecretChatErrorBody;
  }
}

export const invalidRequest = (fields: string[] = []): SecretChatError =>
  new SecretChatError('invalid_request', 400, fields);

/**
 * No session. 401 rather than 403, because "you are not signed in" and "you
 * are not allowed" are different states, and the UI reacts differently: one
 * offers sign-in, the other offers going back.
 */
export const unauthenticated = (): SecretChatError => new SecretChatError('unauthenticated', 401);

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
