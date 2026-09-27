import type { ReportReason, ReportTargetType } from '@/types/supabase-database';
import type { ApiErrorBody, ApiErrorCode } from '@/lib/api/errors';

/** Re-exported so client code needs one import for a report reason. */
export type { ReportReason, ReportTargetType };

/**
 * The SecretChat data-transfer shapes.
 *
 * These are the only types that cross the network boundary, and they are
 * deliberately *narrower* than the database rows: nothing here carries a user
 * id, an email address, a moderation flag, or anything from World A. The server
 * maps rows into these DTOs and the browser only ever sees the result, so adding
 * a column to a table can never leak it into the UI by accident.
 */

/**
 * A member as the community sees them: an alias number and nothing else.
 *
 * There is deliberately no preformatted `alias` string here. A server-rendered
 * "Anonymous User #4821" would be English, and every visible string in this app
 * is rendered from a locale file in the reader's language. So the wire format
 * carries the number and the reader's own optional label, and the UI composes the
 * visible name from `aliasNumber`, `displayName` and `isYou`.
 */
export interface PublicAuthor {
  /** Alias number, e.g. 4821. Stable, random, never derived from an identity. */
  aliasNumber: number;
  /**
   * A label the member chose for themselves, or null. Optional, never required to
   * post, and never populated from their account by default.
   */
  displayName: string | null;
  /** True when the author is the signed-in member reading this feed. */
  isYou: boolean;
}

export interface FeedComment {
  id: string;
  postId: string;
  author: PublicAuthor;
  content: string;
  createdAt: string;
  likeCount: number;
  likedByYou: boolean;
  /** True only for the signed-in member's own comment. */
  canDelete: boolean;
  isDeleted: boolean;
}

export interface FeedPost {
  id: string;
  author: PublicAuthor;
  content: string;
  createdAt: string;
  likeCount: number;
  likedByYou: boolean;
  commentCount: number;
  /** True only for the signed-in member's own post. */
  canDelete: boolean;
  isDeleted: boolean;
}

/**
 * One page of the feed.
 *
 * `nextCursor` is opaque to the client: it is the pair `(created_at, id)` the
 * server encodes, so keyset pagination stays correct when new posts arrive
 * between requests. `null` means the end of the feed was reached.
 */
export interface FeedPage {
  posts: FeedPost[];
  nextCursor: string | null;
}

export interface PostDetail {
  post: FeedPost;
  comments: FeedComment[];
}

export interface CreatePostInput {
  content: string;
}

export interface CreateCommentInput {
  postId: string;
  content: string;
}

export interface CreateReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
}

/**
 * Blocking input: a post the reader has already seen.
 *
 * Not an alias and not a user id, for reasons that are about privacy rather than
 * convenience — see the note on the store port. The server resolves the author
 * from a row it is allowed to read.
 */
export interface BlockMemberInput {
  postId: string;
}

export interface UnblockMemberInput {
  /** Opaque handle for one block, returned by the block list. */
  blockRef: string;
}

/** One entry of the reader's own block list. */
export interface BlockedMember {
  blockRef: string;
  aliasNumber: number;
  /** The member's own chosen label, when they set one. */
  displayName: string | null;
}

/** Uniform failure envelope. `code` is a stable machine-readable string. */
export type SecretChatErrorCode = ApiErrorCode;

export type SecretChatErrorBody = ApiErrorBody;

/** Ordered as they are shown in the report dialog. */
export const REPORT_REASONS: ReportReason[] = [
  'harassment',
  'sexual_content',
  'self_harm',
  'medical_misinformation',
  'spam',
  'other',
] as const;

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === 'string' && (REPORT_REASONS as string[]).includes(value);
}
