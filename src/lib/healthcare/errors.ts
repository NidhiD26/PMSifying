import {
  ApiError,
  ApiErrorBody,
  ApiErrorCode,
  conflict,
  forbidden,
  invalidRequest,
  isApiError,
  notConfigured,
  notFound,
  rateLimited,
  toApiError,
  unauthenticated,
  upstreamUnavailable,
} from '@/lib/api/errors';

/**
 * Healthcare's error vocabulary.
 *
 * There is deliberately no second error class. The healthcare routes answer with
 * exactly the envelope SecretChat established, because the browser code that reads
 * them is written against that shape and a second format would mean a second
 * branch in every client.
 *
 * WHAT HEALTHCARE REUSES AND WHY
 *   - `forbidden` for a caller who is signed in and is the wrong role for the
 *     operation at all. This is the "you may never do this" answer: an ASHA
 *     worker calling a prescription endpoint gets this, and so does a plain member
 *     calling the referral queue.
 *   - `not_found` for a row that exists but is not visible to this caller, which
 *     is the same answer as a row that does not exist. A doctor asking for a
 *     household in another worker's patch must not be able to learn that it is
 *     real, so the two cases cannot be told apart from outside.
 *   - `conflict` for a move the state machine forbids. It is 409 rather than 400
 *     because the request was well-formed and the *world* said no: closing a case
 *     that is already closed, registering for a camp that is already full.
 *
 * WHY THESE ARE RE-EXPORTED RATHER THAN WRAPPAPPED
 * A wrapper would produce a second class that is not an `ApiError`, so every call
 * site would need a conversion and `toApiError` would start quietly rewriting
 * codes. The identities are kept, so `isApiError` and the factories work for both
 * features.
 */

export {
  ApiError,
  conflict,
  forbidden,
  invalidRequest,
  isApiError,
  notConfigured,
  notFound,
  rateLimited,
  toApiError,
  unauthenticated,
  upstreamUnavailable,
};

export type { ApiErrorBody, ApiErrorCode };

/**
 * "This row is not yours, so you are told it is not there."
 *
 * The helper exists as a *function* rather than as a convention so that the choice
 * is written down once. The temptation in a multi-worker healthcare tool is to
 * answer 403 for a household belonging to another ASHA worker, because it is more
 * informative; that is exactly the oracle this avoids.
 */
export const notVisible = notFound;

/**
 * Refuses an operation because of the caller's role.
 *
 * There is no role-aware message. A 403 that said "only a doctor may write a
 * prescription" confirms the endpoint exists and describes its rule to anyone who
 * is signed in, which is free reconnaissance for a caller hunting for staff-only
 * surfaces. Use `forbidden()`.
 */

/**
 * The request was understood and rejected on a business rule.
 *
 * Distinct from `invalidRequest`: the caller sent something well-formed, and the
 * refusal is about state — a closed case, a full camp, a repeat registration.
 */
export const ruleViolation = (fields: string[] = []): ApiError => conflict(fields);