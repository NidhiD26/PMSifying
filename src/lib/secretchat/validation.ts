import { z } from 'zod';
import { REPORT_REASONS, type ReportReason } from '@/types/secretchat';

/**
 * Every value a SecretChat request can carry, validated before it reaches the
 * database.
 *
 * WHY ZOD IS THE ONLY GATE
 * The API routes and the service both parse through these schemas. RLS is the
 * authority on *who* may do something; these schemas are the authority on
 * *what* may be sent, and they are the reason a hostile or buggy client cannot
 * turn a text field into a megabyte of storage, a UUID field into a malformed
 * query, or a content field into a second one.
 *
 * Every object is `.strict()`. An unexpected key is an error rather than being
 * silently dropped, so a client that tries to smuggle in `author_id` — to post
 * as somebody else — is refused outright instead of quietly ignored.
 */

/** Generous enough for a real account, small enough to keep feeds readable. */
export const MAX_POST_CHARS = 2000;
/** A reply is a reply: it is capped well below a post. */
export const MAX_COMMENT_CHARS = 800;
/** Free text attached to an "other" report. */
export const MAX_REPORT_DETAILS_CHARS = 500;
/** One page of the feed. Bounded so a client cannot ask for the whole table. */
export const MAX_FEED_PAGE_SIZE = 50;
export const DEFAULT_FEED_PAGE_SIZE = 20;

/** Supabase auth uses UUIDs; anything else is not an id we will query with. */
const uuidSchema = z.string().uuid('must be a valid uuid');

/**
 * Shared content rules.
 *
 * `.trim()` runs before the length check, so a body of only spaces is rejected
 * as empty rather than stored as invisible content. Control characters are
 * stripped rather than rejected: they are never legitimate in a post, and a
 * single stray one should not cost a member their post.
 */
const contentField = (max: number) =>
  z
    .string()
    .transform((value) => stripControlCharacters(value).trim())
    .refine((value) => value.length > 0, 'content must not be empty')
    .refine((value) => value.length <= max, `content must be at most ${max} characters`)
    // A post that is nothing but a link or a run of punctuation is not abuse,
    // but it is not conversation either; keep the bar low and explicit.
    .refine((value) => hasReadableContent(value), 'content must contain readable text');

function stripControlCharacters(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function hasReadableContent(value: string): boolean {
  return /[\p{L}\p{N}]/u.test(value);
}

export const createPostSchema = z
  .object({
    content: contentField(MAX_POST_CHARS),
  })
  .strict();

export const createCommentSchema = z
  .object({
    content: contentField(MAX_COMMENT_CHARS),
  })
  .strict();

export const postIdSchema = uuidSchema;

export const commentIdSchema = uuidSchema;

/**
 * Cursor pagination input.
 *
 * `cursor` is the server's own opaque token; it is validated as a string and
 * decoded by the server, never interpolated into a query. `limit` is clamped
 * rather than rejected so a client asking for 500 rows gets a page instead of
 * an error.
 */
export const feedQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(MAX_FEED_PAGE_SIZE).default(DEFAULT_FEED_PAGE_SIZE),
    cursor: z.string().min(1).max(200).optional(),
  })
  .strict();

/**
 * Like and unlike.
 *
 * One schema for both, with `liked` as the intent, so the two HTTP verbs cannot
 * drift apart in what they accept.
 */
export const likeTargetSchema = z
  .object({
    targetType: z.enum(['post', 'comment']),
    targetId: uuidSchema,
    liked: z.boolean(),
  })
  .strict();

export const createReportSchema = z
  .object({
    targetType: z.enum(['post', 'comment']),
    targetId: uuidSchema,
    // Typed as a tuple of literals so the schema and the `report_reason` enum in
    // the database cannot drift apart: adding a reason here without adding it
    // there becomes a compile error rather than a runtime insert failure.
    reason: z.enum(REPORT_REASONS as [ReportReason, ...ReportReason[]]),
    details: z
      .string()
      .transform((value) => stripControlCharacters(value).trim())
      .refine((value) => value.length <= MAX_REPORT_DETAILS_CHARS, 'details is too long')
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    // Details are only meaningful for "other"; every other reason is already
    // specific. Accepting them silently would let a reporter attach a wall of
    // text to a harassment report and bury the reason.
    if (data.details && data.reason !== 'other') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'details are only accepted for the "other" reason',
        path: ['details'],
      });
    }
    if (data.reason === 'other' && !data.details) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'details are required for the "other" reason',
        path: ['details'],
      });
    }
  });

/**
 * Blocking is addressed by a post, not by a member.
 *
 * The feed never shows a user id, so a client has nothing identifying to send.
 * A post id is something the client legitimately already has, and the server can
 * resolve its author from a row it is allowed to read. Accepting an alias number
 * instead would look equivalent but is not: the server would have to turn that
 * number into an account, which any caller could then repeat for all nine
 * thousand aliases and use to rebuild the complete alias-to-account map.
 */
export const blockByPostSchema = z
  .object({
    postId: uuidSchema,
  })
  .strict();

/**
 * Unblocking is addressed by the opaque handle the block list returned.
 *
 * The handle is a random uuid minted per block, so it names a block rather than a
 * person: a client may store it, display it, or replay it, and learning nothing
 * from it.
 */
export const unblockByRefSchema = z
  .object({
    blockRef: uuidSchema,
  })
  .strict();

/** Sign-in and sign-up, the only two places a credential is ever accepted. */
export const secretChatAuthSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('enter a valid email address').max(254),
    password: z
      .string()
      .min(8, 'password must be at least 8 characters')
      .max(72, 'password must be at most 72 characters'),
  })
  .strict();

export type CreatePostBody = z.infer<typeof createPostSchema>;
export type CreateCommentBody = z.infer<typeof createCommentSchema>;
export type FeedQuery = z.infer<typeof feedQuerySchema>;
export type LikeTargetBody = z.infer<typeof likeTargetSchema>;
export type CreateReportBody = z.infer<typeof createReportSchema>;
export type BlockByPostBody = z.infer<typeof blockByPostSchema>;
export type UnblockByRefBody = z.infer<typeof unblockByRefSchema>;
export type SecretChatAuthBody = z.infer<typeof secretChatAuthSchema>;

/**
 * Field paths only: an issue message can echo the submitted value.
 *
 * Deduplicated, because one field can fail more than one refinement — an empty
 * string fails both "must not be empty" and "must contain readable text" — and
 * the client would otherwise be told the same field is wrong twice.
 */
export function fieldPaths(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.path.join('.')))].filter(
    (path) => path.length > 0
  );
}
