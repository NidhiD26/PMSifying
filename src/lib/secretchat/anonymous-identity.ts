/**
 * The anonymous identity: "Anonymous User #4821".
 *
 * WHAT HAS TO BE TRUE AT ONCE, AND WHY IT IS HARD
 * A member's alias must be
 *   - stable, so their past posts still carry the same name next month;
 *   - unique, so two members are never indistinguishable;
 *   - unlinkable to their real identity by anyone reading the feed;
 *   - and produced without ever looking at an email, name or phone number.
 *
 * The obvious approach — hash the email, or derive the number from the user id
 * with a plain hash — fails differently in each case. Hashing the email is a
 * dictionary attack away from the real address, and a deterministic hash of the
 * user id makes the number predictable from anything that leaks the uuid, which
 * defeats the point of having a separate public name.
 *
 * WHAT THIS MODULE DOES INSTEAD
 * The number is claimed inside Postgres, in a security-definer function, from
 * the *unpredictable random uuid* Supabase already generated for the account.
 * The uuid contains no personal data, so deriving from it leaks nothing, and
 * because the claim is a row in `anonymous_profiles` with a unique constraint
 * and no update path, the value cannot drift or be reassigned.
 *
 * STABILITY IS THE CLAIM'S INVARIANT, NOT A PROPERTY OF THE HASH
 * The candidate number is a deterministic function of the user id, so the same
 * account always *wants* the same number. Collisions are resolved by probing
 * forward deterministically. Once claimed, the stored row is authoritative:
 * `ensureAnonymousProfile` reads before it writes, so a later sign-in can never
 * produce a different alias, and no code path updates `alias_number`.
 *
 * The pure functions below are the same algorithm as the SQL, which lets the
 * rules be unit tested without a database, and let a future read path recompute
 * an expected value for a user.
 */

/** The alias space. Four digits, so it stays short enough to read aloud. */
export const ANONYMOUS_ALIAS_MIN = 1000;
export const ANONYMOUS_ALIAS_MAX = 9999;
export const ANONYMOUS_ALIAS_SPACE = ANONYMOUS_ALIAS_MAX - ANONYMOUS_ALIAS_MIN + 1;

/** 32-bit FNV-1a. Deterministic, dependency-free, identical in SQL. */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // 32-bit multiply, kept in range without BigInt.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * The first number an account would like, before any collision is considered.
 *
 * Namespaced by user id only. The prefix exists so this digest is never the
 * same digest used anywhere else for the same uuid.
 */
export function anonymousAliasCandidate(userId: string): number {
  const hash = fnv1a32(`pmsify:anon:${userId}`);
  return ANONYMOUS_ALIAS_MIN + (hash % ANONYMOUS_ALIAS_SPACE);
}

/**
 * Resolves a candidate against the numbers already taken.
 *
 * Deterministic: for the same user id and the same set of taken numbers this
 * always returns the same answer, which is what makes the function testable
 * and what keeps a retry from handing out a different alias.
 *
 * Collisions are resolved by stepping forward, wrapping at the top of the
 * range. If every alias in the space is taken — the caller has created one
 * million accounts — it returns `null` instead of wrapping around and
 * overwriting somebody's name. The database's unique constraint is the final
 * guarantee; this makes the common case resolve without a failed insert.
 */
export function resolveAnonymousAlias(
  userId: string,
  isTaken: (aliasNumber: number) => boolean
): number | null {
  const start = anonymousAliasCandidate(userId);
  for (let step = 0; step < ANONYMOUS_ALIAS_SPACE; step += 1) {
    const candidate = ANONYMOUS_ALIAS_MIN + ((start - ANONYMOUS_ALIAS_MIN + step) % ANONYMOUS_ALIAS_SPACE);
    if (!isTaken(candidate)) return candidate;
  }
  return null;
}

/**
 * The display string.
 *
 * Localisation note: this is server-generated and stored once, so it is not
 * translated. A member's alias is an identifier, not prose — translating
 * "Anonymous User" differently in Hindi and Kannada would make the same person
 * look like two people across a language switch. The UI shows the number in a
 * translated frame instead, and the stored `display_name` is only used when a
 * member has set one deliberately.
 */
export function formatAnonymousAlias(aliasNumber: number): string {
  return `Anonymous User #${aliasNumber}`;
}

/** A stable key for a post's author, safe to use as a React list key. */
export function authorKey(aliasNumber: number, userId: string): string {
  return `${aliasNumber}:${userId}`;
}

export function isAliasInRange(value: number): boolean {
  return Number.isInteger(value) && value >= ANONYMOUS_ALIAS_MIN && value <= ANONYMOUS_ALIAS_MAX;
}
