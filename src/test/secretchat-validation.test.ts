import { describe, it, expect } from 'vitest';
import {
  blockByPostSchema,
  createCommentSchema,
  createPostSchema,
  createReportSchema,
  DEFAULT_FEED_PAGE_SIZE,
  feedQuerySchema,
  fieldPaths,
  likeTargetSchema,
  MAX_COMMENT_CHARS,
  MAX_FEED_PAGE_SIZE,
  MAX_POST_CHARS,
  MAX_REPORT_DETAILS_CHARS,
  postIdSchema,
  secretChatAuthSchema,
  unblockByRefSchema,
} from '../lib/secretchat/validation';

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const OTHER_UUID = '9c5b94b1-35ad-4b2c-8a1f-2f7d3e6b8a90';

/**
 * These schemas are the only thing between a hostile client and the database, so
 * the tests are written as attacks rather than as usage examples: each one tries
 * to smuggle in something the design says must be impossible.
 */

describe('content fields', () => {
  it('accepts ordinary text', () => {
    expect(createPostSchema.parse({ content: 'Period week is rough.' })).toEqual({
      content: 'Period week is rough.',
    });
  });

  it('trims surrounding whitespace', () => {
    expect(createPostSchema.parse({ content: '  hello  ' }).content).toBe('hello');
  });

  /**
   * Whitespace-only must fail, not be stored. A post of invisible characters is
   * indistinguishable from a bug and cannot be moderated.
   */
  it('rejects content that is only whitespace', () => {
    expect(createPostSchema.safeParse({ content: '     ' }).success).toBe(false);
    expect(createPostSchema.safeParse({ content: '\t\n  ' }).success).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(createPostSchema.safeParse({ content: '' }).success).toBe(false);
  });

  it('strips control characters instead of rejecting the whole post', () => {
    // One stray control character should not cost somebody their post.
    const parsed = createPostSchema.parse({ content: 'hello\u0007world' });
    expect(parsed.content).toBe('helloworld');
  });

  it('rejects content with no letters or digits at all', () => {
    expect(createPostSchema.safeParse({ content: '!!! ??? ...' }).success).toBe(false);
    expect(createPostSchema.safeParse({ content: '--- ***' }).success).toBe(false);
  });

  it('accepts a bare link, which is a thing people post', () => {
    // A URL is made of letters, so it clears the readable-text rule. That is the
    // intended behaviour: a link is conversation, and refusing it would be a
    // surprise. It is not a spam defence, and does not pretend to be one.
    expect(createPostSchema.safeParse({ content: 'https://example.com' }).success).toBe(true);
  });

  it('accepts non-latin scripts', () => {
    // The community is multilingual; a Devanagari or Kannada post is real content.
    expect(createPostSchema.safeParse({ content: 'मुझे थकान हो रही है' }).success).toBe(true);
    expect(createPostSchema.safeParse({ content: 'ನನಗೆ ತಕ್ಕಿರುತ್ತಿದೆ' }).success).toBe(true);
  });

  it('accepts content at exactly the limit and refuses one character more', () => {
    const exact = 'a'.repeat(MAX_POST_CHARS);
    expect(createPostSchema.safeParse({ content: exact }).success).toBe(true);
    expect(createPostSchema.safeParse({ content: `${exact}a` }).success).toBe(false);
  });

  it('measures the limit after trimming', () => {
    // Otherwise a post could smuggle padding past the cap.
    const padded = `   ${'a'.repeat(MAX_POST_CHARS)}   `;
    expect(createPostSchema.safeParse({ content: padded }).success).toBe(true);
  });

  it('caps comments well below posts', () => {
    expect(MAX_COMMENT_CHARS).toBeLessThan(MAX_POST_CHARS);
    expect(
      createCommentSchema.safeParse({ content: 'a'.repeat(MAX_COMMENT_CHARS + 1) }).success
    ).toBe(false);
  });

  it('refuses a missing or non-string content field', () => {
    expect(createPostSchema.safeParse({}).success).toBe(false);
    expect(createPostSchema.safeParse({ content: 42 }).success).toBe(false);
    expect(createPostSchema.safeParse({ content: null }).success).toBe(false);
    expect(createPostSchema.safeParse({ content: ['a'] }).success).toBe(false);
  });

  it('refuses a second content field', () => {
    expect(createPostSchema.safeParse({ content: 'a', body: 'b' }).success).toBe(false);
  });
});

describe('strictness', () => {
  /**
   * The important one: there is no field a client can add to post as somebody
   * else. `.strict()` turns an attempt into a refusal rather than a silent drop,
   * so a client that believes it succeeded cannot be quietly wrong.
   */
  it('refuses a smuggled author id on a post without echoing the key back', () => {
    const result = createPostSchema.safeParse({ content: 'hello', author_id: OTHER_UUID });
    expect(result.success).toBe(false);

    // Zod reports an unrecognised key with an empty path, and `fieldPaths` drops
    // those, so no field is named. That is the right outcome rather than an
    // accident: telling a caller which extra key it sent would turn the error
    // into a probe for what the schema does and does not accept.
    if (result.success) throw new Error('unreachable: expected the parse to fail');
    expect(fieldPaths(result.error)).toEqual([]);
  });

  it('refuses a smuggled author id on a comment', () => {
    expect(
      createCommentSchema.safeParse({ content: 'hello', author_id: OTHER_UUID }).success
    ).toBe(false);
  });

  it('refuses a smuggled author id on a like', () => {
    expect(
      likeTargetSchema.safeParse({
        targetType: 'post',
        targetId: UUID,
        liked: true,
        liker_id: OTHER_UUID,
      }).success
    ).toBe(false);
  });

  it('refuses a smuggled reporter id on a report', () => {
    expect(
      createReportSchema.safeParse({
        targetType: 'post',
        targetId: UUID,
        reason: 'spam',
        reporter_id: OTHER_UUID,
      }).success
    ).toBe(false);
  });

  it('refuses a smuggled blocked id on a block', () => {
    // The whole design: you block by naming a post, never a person.
    expect(
      blockByPostSchema.safeParse({ postId: UUID, blockedId: OTHER_UUID }).success
    ).toBe(false);
    expect(blockByPostSchema.safeParse({ blockedId: OTHER_UUID }).success).toBe(false);
  });
});

describe('uuid fields', () => {
  it('accepts a uuid', () => {
    expect(postIdSchema.safeParse(UUID).success).toBe(true);
  });

  it('rejects anything that is not a uuid', () => {
    for (const bad of [
      '',
      'abc',
      '123',
      `${UUID}; drop table posts`,
      `${UUID}'`,
      "3f2504e0-4f89-41d3-9a0c-0305e82c3301 OR 1=1",
      '3f2504e04f8941d39a0c0305e82c3301',
      '../../etc/passwd',
    ]) {
      expect(postIdSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('does not coerce a number into an id', () => {
    expect(postIdSchema.safeParse(12345).success).toBe(false);
  });
});

describe('likeTargetSchema', () => {
  it('takes one shape for both directions', () => {
    const base = { targetType: 'post', targetId: UUID };
    expect(likeTargetSchema.safeParse({ ...base, liked: true }).success).toBe(true);
    expect(likeTargetSchema.safeParse({ ...base, liked: false }).success).toBe(true);
  });

  it('requires liked to be an actual boolean', () => {
    const base = { targetType: 'post', targetId: UUID };
    expect(likeTargetSchema.safeParse({ ...base, liked: 'true' }).success).toBe(false);
    expect(likeTargetSchema.safeParse({ ...base, liked: 1 }).success).toBe(false);
    expect(likeTargetSchema.safeParse(base).success).toBe(false);
  });

  it('rejects an unknown target type', () => {
    expect(
      likeTargetSchema.safeParse({ targetType: 'user', targetId: UUID, liked: true }).success
    ).toBe(false);
  });
});

describe('createReportSchema', () => {
  const base = { targetType: 'post', targetId: UUID, reason: 'harassment' as const };

  it('accepts each known reason', () => {
    for (const reason of [
      'harassment',
      'sexual_content',
      'self_harm',
      'medical_misinformation',
      'spam',
      'other',
    ] as const) {
      const details = reason === 'other' ? 'Something specific happened.' : undefined;
      expect(createReportSchema.safeParse({ ...base, reason, details }).success).toBe(true);
    }
  });

  it('rejects an invented reason', () => {
    expect(createReportSchema.safeParse({ ...base, reason: 'because' }).success).toBe(false);
  });

  it('requires details for the "other" reason', () => {
    // Otherwise "other" is a bucket reports disappear into.
    expect(createReportSchema.safeParse({ ...base, reason: 'other' }).success).toBe(false);
    expect(
      createReportSchema.safeParse({ ...base, reason: 'other', details: '   ' }).success
    ).toBe(false);
  });

  it('refuses details attached to a specific reason', () => {
    // The reason is already specific; a wall of text attached to it buries it.
    expect(createReportSchema.safeParse({ ...base, details: 'long explanation' }).success).toBe(
      false
    );
  });

  it('caps details length', () => {
    const details = 'a'.repeat(MAX_REPORT_DETAILS_CHARS);
    expect(
      createReportSchema.safeParse({ ...base, reason: 'other', details }).success
    ).toBe(true);
    expect(
      createReportSchema.safeParse({ ...base, reason: 'other', details: `${details}a` }).success
    ).toBe(false);
  });
});

describe('feedQuerySchema', () => {
  it('defaults the page size', () => {
    expect(feedQuerySchema.parse({}).limit).toBe(DEFAULT_FEED_PAGE_SIZE);
  });

  it('clamps by rejecting a request for more than a page allows', () => {
    // The point is that a client cannot ask for the whole table.
    expect(feedQuerySchema.safeParse({ limit: MAX_FEED_PAGE_SIZE + 1 }).success).toBe(false);
    expect(feedQuerySchema.safeParse({ limit: 100_000 }).success).toBe(false);
  });

  it('rejects a nonsensical page size', () => {
    expect(feedQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(feedQuerySchema.safeParse({ limit: -5 }).success).toBe(false);
    expect(feedQuerySchema.safeParse({ limit: 2.5 }).success).toBe(false);
  });

  it('coerces a numeric string from the query string', () => {
    expect(feedQuerySchema.parse({ limit: '10' }).limit).toBe(10);
  });

  it('bounds the cursor length', () => {
    expect(feedQuerySchema.safeParse({ cursor: 'a'.repeat(201) }).success).toBe(false);
    expect(feedQuerySchema.safeParse({ cursor: '' }).success).toBe(false);
  });
});

describe('unblockByRefSchema', () => {
  it('takes only the opaque block handle', () => {
    expect(unblockByRefSchema.parse({ blockRef: UUID })).toEqual({ blockRef: UUID });
  });

  it('will not accept a person to unblock', () => {
    expect(unblockByRefSchema.safeParse({ userId: OTHER_UUID }).success).toBe(false);
    expect(unblockByRefSchema.safeParse({ blockedId: OTHER_UUID }).success).toBe(false);
  });
});

describe('secretChatAuthSchema', () => {
  it('normalises the email so casing cannot create two accounts', () => {
    const parsed = secretChatAuthSchema.parse({
      email: '  Reader@Example.COM ',
      password: 'longenough1',
    });
    expect(parsed.email).toBe('reader@example.com');
  });

  it('rejects an invalid email', () => {
    for (const email of ['', 'nope', 'a@b', 'a b@example.com', 'a@', '@example.com']) {
      expect(secretChatAuthSchema.safeParse({ email, password: 'longenough1' }).success).toBe(
        false
      );
    }
  });

  it('bounds the password at both ends', () => {
    expect(
      secretChatAuthSchema.safeParse({ email: 'a@example.com', password: 'short' }).success
    ).toBe(false);
    expect(
      secretChatAuthSchema.safeParse({ email: 'a@example.com', password: 'a'.repeat(73) }).success
    ).toBe(false);
  });

  it('accepts a password at the maximum', () => {
    expect(
      secretChatAuthSchema.safeParse({ email: 'a@example.com', password: 'a'.repeat(72) }).success
    ).toBe(true);
  });
});
