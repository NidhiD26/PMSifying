import type { FeedComment, FeedPage, FeedPost, PublicAuthor } from '@/types/secretchat';
import type { FeedCommentRow, FeedCursor, FeedPostRow } from '@/lib/secretchat/store';

/**
 * Turning stored rows into what the browser is allowed to see.
 *
 * Every function here is pure, so the privacy rules can be tested directly:
 *
 *   - no user id is ever copied into a DTO;
 *   - a deleted post keeps its slot in the feed but loses its body;
 *   - a blocked author is dropped even if the query let one through.
 *
 * The last point is deliberate redundancy. The SQL filters blocked authors, and
 * this filters again. A feed that leaks a blocked member because of a query
 * mistake is a real failure, and the cheapest defence is a second check in the
 * one place every feed passes through.
 */

/** Keyset pagination token: opaque to the client, validated before use. */
const CURSOR_SEPARATOR = '\u001f';

export function encodeCursor(cursor: FeedCursor): string {
  const raw = `${cursor.createdAt}${CURSOR_SEPARATOR}${cursor.id}`;
  return base64UrlEncode(raw);
}

/**
 * Decodes a cursor, or returns null for anything unrecognised.
 *
 * A malformed cursor is not an error: it degrades to "start from the newest
 * post", because a stale or hand-edited cursor should show the reader the top
 * of the feed rather than a failure screen.
 */
export function decodeCursor(token: string | undefined): FeedCursor | null {
  if (!token) return null;

  const decoded = base64UrlDecode(token);
  if (!decoded) return null;

  const index = decoded.indexOf(CURSOR_SEPARATOR);
  if (index <= 0) return null;

  const createdAt = decoded.slice(0, index);
  const id = decoded.slice(index + 1);
  if (!isIsoTimestamp(createdAt) || !isUuid(id)) return null;

  return { createdAt, id };
}

function base64UrlEncode(value: string): string {
  const base64 =
    typeof btoa === 'function'
      ? btoa(value)
      : Buffer.from(value, 'utf8').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  try {
    if (typeof atob === 'function') {
      return atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
    }
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function isIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * The only place an author is turned into something displayable.
 *
 * The account id is compared, never returned, so the client receives a boolean
 * instead of an identifier. The visible name is *not* built here: it is composed
 * in the UI from `aliasNumber`/`displayName`/`isYou` so it can be translated
 * into the reader's language.
 */
export function toPublicAuthor(args: {
  aliasNumber: number;
  displayName: string | null;
  authorId: string;
  viewerId: string;
}): PublicAuthor {
  return {
    aliasNumber: args.aliasNumber,
    displayName: args.displayName?.trim() ? args.displayName : null,
    isYou: args.authorId === args.viewerId,
  };
}

export function toFeedPost(row: FeedPostRow, viewerId: string): FeedPost {
  const isDeleted = row.post.deleted_at !== null;
  return {
    id: row.post.id,
    author: toPublicAuthor({
      aliasNumber: row.aliasNumber,
      displayName: row.displayName,
      authorId: row.post.author_id,
      viewerId,
    }),
    content: isDeleted ? '' : row.post.content,
    createdAt: row.post.created_at,
    likeCount: row.likeCount,
    likedByYou: row.likedByViewer,
    commentCount: row.commentCount,
    canDelete: row.post.author_id === viewerId,
    isDeleted,
  };
}

export function toFeedComment(row: FeedCommentRow, viewerId: string): FeedComment {
  const isDeleted = row.comment.deleted_at !== null;
  return {
    id: row.comment.id,
    postId: row.comment.post_id,
    author: toPublicAuthor({
      aliasNumber: row.aliasNumber,
      displayName: row.displayName,
      authorId: row.comment.author_id,
      viewerId,
    }),
    content: isDeleted ? '' : row.comment.content,
    createdAt: row.comment.created_at,
    likeCount: row.likeCount,
    likedByYou: row.likedByViewer,
    canDelete: row.comment.author_id === viewerId,
    isDeleted,
  };
}

/** True when a row's author may be shown to this reader. */
export function isVisibleToViewer(authorId: string, blockedIds: ReadonlySet<string>): boolean {
  return !blockedIds.has(authorId);
}

export interface BuildFeedPageArgs {
  rows: FeedPostRow[];
  limit: number;
  viewerId: string;
  blockedIds: ReadonlySet<string>;
}

/**
 * Assembles one page.
 *
 * `nextCursor` is null when the fetched rows are exhausted, and otherwise comes
 * from the last row actually returned — not from the last row fetched — so a
 * page whose tail was filtered out still advances past the posts the reader saw.
 *
 * A full "there is more" answer therefore depends on the caller over-fetching
 * by at least one row, which the service does.
 */
export function buildFeedPage({ rows, limit, viewerId, blockedIds }: BuildFeedPageArgs): FeedPage {
  const visible = rows.filter((row) => isVisibleToViewer(row.post.author_id, blockedIds));
  const page = visible.slice(0, limit);
  const hasMore = visible.length > limit;

  const last = page[page.length - 1];
  const nextCursor = hasMore && last
    ? encodeCursor({ createdAt: last.post.created_at, id: last.post.id })
    : null;

  return { posts: page.map((row) => toFeedPost(row, viewerId)), nextCursor };
}
