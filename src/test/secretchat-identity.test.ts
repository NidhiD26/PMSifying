import { describe, it, expect } from 'vitest';
import {
  ANONYMOUS_ALIAS_MAX,
  ANONYMOUS_ALIAS_MIN,
  ANONYMOUS_ALIAS_SPACE,
  anonymousAliasCandidate,
  authorKey,
  formatAnonymousAlias,
  fnv1a32,
  isAliasInRange,
  resolveAnonymousAlias,
} from '../lib/secretchat/anonymous-identity';

/**
 * The alias is the only thing standing between a member and their real identity,
 * so these tests are about what the alias is *derived from* as much as what it
 * looks like.
 */

/** Deterministic PRNG, so distribution measurements are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ids shaped like the ones Supabase actually issues: random v4 uuids. */
function seededUuids(count: number): string[] {
  const random = mulberry32(0x5eed);
  const hex = (length: number) =>
    Array.from({ length }, () => '0123456789abcdef'[Math.floor(random() * 16)]).join('');

  return Array.from({ length: count }, () => {
    const variant = '89ab'[Math.floor(random() * 4)];
    return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
  });
}

describe('the alias hash', () => {
  it('is the published FNV-1a 32-bit vector', () => {
    // The canonical test vectors. If these change, every claimed alias changes,
    // and the SQL function and this module stop agreeing.
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('stays a 32-bit unsigned integer', () => {
    for (const input of ['', 'a', 'pmsify:anon:', '𝔘𝔫𝔦𝔠𝔬𝔡𝔢', 'x'.repeat(10_000)]) {
      const hash = fnv1a32(input);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('is deterministic', () => {
    expect(fnv1a32('pmsify:anon:abc')).toBe(fnv1a32('pmsify:anon:abc'));
  });
});

describe('anonymousAliasCandidate', () => {
  it('always lands inside the four-digit alias space', () => {
    for (let i = 0; i < 5_000; i += 1) {
      const alias = anonymousAliasCandidate(`user-${i}`);
      expect(isAliasInRange(alias)).toBe(true);
    }
  });

  it('is stable for one account', () => {
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    expect(anonymousAliasCandidate(id)).toBe(anonymousAliasCandidate(id));
  });

  it('spreads realistically shaped account ids evenly across the space', () => {
    // Seeded so the measurement is reproducible: a random draw would make this
    // test flaky, and a flaky test gets deleted rather than trusted.
    const draws = 20_000;
    const seen = new Set<number>();
    for (const id of seededUuids(draws)) seen.add(anonymousAliasCandidate(id));

    // The number of distinct values obtainable from `draws` uniform draws out of
    // 9000 slots is not `draws` — the birthday effect dominates at this size, and
    // the ceiling is 9000 * (1 - (1 - 1/9000)^draws). Asserting a raw distinct
    // count above that ceiling is asserting a better-than-uniform hash, which is
    // a bug in the test, not a property of the code. So this compares the spread
    // against what uniformity actually promises.
    const ceiling = ANONYMOUS_ALIAS_SPACE * (1 - Math.pow(1 - 1 / ANONYMOUS_ALIAS_SPACE, draws));
    expect(seen.size).toBeGreaterThan(ceiling * 0.95);
  });

  /**
   * The property that matters most, and the easiest to break by accident: the
   * function takes an account id and nothing else, so there is no argument
   * through which an email, a name or a phone number could reach the digest.
   */
  it('has no parameter that could carry personal data', () => {
    expect(anonymousAliasCandidate.length).toBe(1);
  });

  it('namespaces the digest so it is not the same hash used elsewhere', () => {
    // The same uuid hashed without the namespace would collide with any other
    // feature that derives a number from a user id.
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    const namespaced = anonymousAliasCandidate(id);
    const bare = ANONYMOUS_ALIAS_MIN + (fnv1a32(id) % ANONYMOUS_ALIAS_SPACE);
    expect(namespaced).not.toBe(bare);
  });
});

describe('resolveAnonymousAlias', () => {
  it('returns the candidate when nothing is taken', () => {
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    expect(resolveAnonymousAlias(id, () => false)).toBe(anonymousAliasCandidate(id));
  });

  it('steps forward past a collision', () => {
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    const first = anonymousAliasCandidate(id);
    expect(resolveAnonymousAlias(id, (n) => n === first)).toBe(first + 1);
  });

  it('keeps walking past several collisions in order', () => {
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    const first = anonymousAliasCandidate(id);
    const taken = new Set([first, first + 1, first + 2]);
    expect(resolveAnonymousAlias(id, (n) => taken.has(n))).toBe(first + 3);
  });

  /**
   * Determinism is what makes a retried claim safe. If the answer depended on
   * iteration order or timing, a member could get alias 4821 on one attempt and
   * 5902 on the next, and their old posts would no longer match their name.
   */
  it('is deterministic for the same account and the same taken set', () => {
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    const first = anonymousAliasCandidate(id);
    const taken = new Set([first, first + 1]);
    const answers = Array.from({ length: 20 }, () =>
      resolveAnonymousAlias(id, (n) => taken.has(n))
    );
    expect(new Set(answers).size).toBe(1);
  });

  it('wraps around the top of the range instead of running off the end', () => {
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    const first = anonymousAliasCandidate(id);
    // Everything from the candidate up to 9999 is taken, so the only number left
    // anywhere in the space is the bottom one.
    const answer = resolveAnonymousAlias(id, (n) => n >= first);
    expect(answer).toBe(ANONYMOUS_ALIAS_MIN);
  });

  it('returns null rather than overwriting somebody when the space is full', () => {
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    expect(resolveAnonymousAlias(id, () => true)).toBeNull();
  });

  it('never proposes a number outside the space while walking', () => {
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    const first = anonymousAliasCandidate(id);
    const answer = resolveAnonymousAlias(
      id,
      (n) => n >= first - 1 // force the walk to cross the bottom boundary
    );
    expect(answer === null || isAliasInRange(answer)).toBe(true);
  });
});

describe('the alias space', () => {
  it('is four digits wide, which is the point', () => {
    expect(ANONYMOUS_ALIAS_MIN).toBe(1000);
    expect(ANONYMOUS_ALIAS_MAX).toBe(9999);
    expect(ANONYMOUS_ALIAS_SPACE).toBe(9000);
  });

  it('treats a number outside the space as not an alias', () => {
    expect(isAliasInRange(999)).toBe(false);
    expect(isAliasInRange(10_000)).toBe(false);
    expect(isAliasInRange(1000.5)).toBe(false);
    expect(isAliasInRange(1000)).toBe(true);
    expect(isAliasInRange(9999)).toBe(true);
  });
});

describe('formatAnonymousAlias', () => {
  it('is the stored display string, and is not translated', () => {
    // Deliberately English-only: an alias is an identifier, and translating the
    // frame would make one person look like two across a language switch. The UI
    // composes the translated frame around the number instead.
    expect(formatAnonymousAlias(4821)).toBe('Anonymous User #4821');
  });
});

describe('authorKey', () => {
  it('separates the same alias number held by two accounts', () => {
    // Two members colliding on a number is possible before a claim resolves, and
    // a React key that ignored the account would merge their rows.
    expect(authorKey(4821, 'a')).not.toBe(authorKey(4821, 'b'));
  });
});
