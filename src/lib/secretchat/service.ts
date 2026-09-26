import type { BlockedMember, FeedComment, FeedPage, PostDetail } from '@/types/secretchat';
import type { ReportReason, ReportTargetType } from '@/types/supabase-database';
import { buildFeedPage, decodeCursor, toFeedComment, toFeedPost } from '@/lib/secretchat/feed';
import { forbidden, invalidRequest, notFound, toSecretChatError } from '@/lib/secretchat/errors';
import type { SecretChatStore } from '@/lib/secretchat/store';
import {
  blockByPostSchema,
  createCommentSchema,
  createPostSchema,
  createReportSchema,
  DEFAULT_FEED_PAGE_SIZE,
  fieldPaths,
  likeTargetSchema,
  MAX_COMMENT_CHARS,
  MAX_POST_CHARS,
  unblockByRefSchema,
} from '@/lib/secretchat/validation';
import { ZodError, z } from 'zod';

/**
 * Every SecretChat operation, as a plain function over the store port.
 *
 * WHY THE LOGIC LIVES HERE AND NOT IN A ROUTE
 * A Route Handler module may only export HTTP verbs, so the request contract
 * cannot be unit tested from `app/api/.../route.ts`. Everything that decides an
 * outcome is here instead: the routes are two-line adapters, and this file is
 * what the tests exercise. The same split the assistant gateway already uses in
 * this codebase.
 *
 * THE ORDER OF CONCERNS IN EVERY FUNCTION
 *   1. validate the input, so a malformed request never reaches the database;
 *   2. load what the answer depends on;
 *   3. check ownership or permission, and fail with the *most specific* error
 *      the reader can safely be told;
 *   4. write, then read back the counts the UI needs, so a returned number is
 *      never a guess.
 *
 * Server-side authorization: step 3 runs here on the server, and RLS runs the
 * same check again in the database. Neither one trusts the client.
 */

/** Coerces a Zod failure into the shared error shape, without echoing values. */
function fromZod(error: unknown): never {
  if (error instanceof ZodError) {
    // `fieldPaths` rather than mapping the issues here, so the deduplication and
    // the dropping of path-less issues live in one place.
    throw invalidRequest(fieldPaths(error));
  }
  throw toSecretChatError(error);
}

function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  try {
    return schema.parse(value);
  } catch (error) {
    fromZod(error);
  }
}

export interface FeedArgs {
  viewerId: string;
  limit?: number;
  cursor?: string;
}

/**
 * GET feed.
 *
 * Newest first, keyset paginated, deleted posts excluded, and blocked authors
 * excluded in both directions: what the reader blocked never appears, and the
 * reader never appears in a feed that excludes them.
 *
 * The over-fetch is not an optimisation. Blocked rows are removed *after* the
 * query, so asking for `limit + 1 + blocked` rows is what keeps a page full when
 * the reader has blocked a few prolific members; the extra row is what makes
 * "is there more" answerable without a count.
 */
export async function getFeed(store: SecretChatStore, args: FeedArgs): Promise<FeedPage> {
  const limit = args.limit ?? DEFAULT_FEED_PAGE_SIZE;
  const cursor = decodeCursor(args.cursor);
  const blockedIds = new Set(await store.listBlockedIds(args.viewerId));

  const rows = await store.listFeed({
    viewerId: args.viewerId,
    limit: limit + 1 + blockedIds.size,
    cursor: cursor ?? undefined,
    excludeAuthorIds: [...blockedIds],
  });

  return buildFeedPage({ rows, limit, viewerId: args.viewerId, blockedIds });
}

/** GET a single post with its comments. */
export async function getPostDetail(
  store: SecretChatStore,
  args: { viewerId: string; postId: string }
): Promise<PostDetail> {
  const row = await store.getPost(args.postId, args.viewerId);
  if (!row) throw notFound();

  const blockedIds = new Set(await store.listBlockedIds(args.viewerId));
  // A single post is reachable by id, so block filtering is checked here too.
  if (blockedIds.has(row.post.author_id)) throw notFound();

  const comments: FeedComment[] = (await store.listComments(args.postId, args.viewerId))
    .filter((comment) => !blockedIds.has(comment.comment.author_id))
    .map((comment) => toFeedComment(comment, args.viewerId));

  return { post: toFeedPost(row, args.viewerId), comments };
}

/**
 * CREATE post.
 *
 * The alias is claimed before the post is written, so a first-ever post can
 * never be stored against a member with no public identity.
 */
export async function createPost(
  store: SecretChatStore,
  args: { viewerId: string; input: unknown }
): Promise<PostDetail['post']> {
  const input = parse(createPostSchema, args.input);
  const profile = await store.ensureAnonymousProfile(args.viewerId);
  if (!profile) throw notFound();

  const row = await store.insertPost(args.viewerId, input.content);
  return toFeedPost(
    {
      post: row,
      aliasNumber: profile.alias_number,
      displayName: profile.display_name,
      likeCount: 0,
      commentCount: 0,
      likedByViewer: false,
    },
    args.viewerId
  );
}

/**
 * DELETE own post.
 *
 * Ownership is resolved from the stored row, never from the request: a client
 * that sends somebody else's post id gets `forbidden`, and learns nothing else.
 * The delete is a soft delete, so a comment thread keeps its shape and a
 * moderator action stays auditable.
 */
export async function deletePost(
  store: SecretChatStore,
  args: { viewerId: string; postId: string }
): Promise<{ id: string; deleted: true }> {
  const result = await store.softDeletePost(args.postId, args.viewerId);

  // The store's result distinguishes three cases, and they must not be collapsed:
  //   no author  -> the row is not there at all
  //   not ok     -> the row is there and belongs to somebody else
  //   ok         -> the actor's own row, now hidden
  //
  // Testing `!result.ok` first would report somebody else's post as missing,
  // which is both wrong and self-defeating: a member who cannot delete a post
  // needs to be told it is not theirs, not that it does not exist, or a routine
  // permission problem presents as a bug.
  if (!result.authorId) throw notFound();
  if (!result.ok) throw forbidden();

  return { id: args.postId, deleted: true };
}

/** CREATE comment on a post that is still visible. */
export async function createComment(
  store: SecretChatStore,
  args: { viewerId: string; postId: string; input: unknown }
): Promise<FeedComment> {
  const input = parse(createCommentSchema, args.input);

  const post = await store.getPost(args.postId, args.viewerId);
  if (!post) throw notFound();

  const blockedIds = new Set(await store.listBlockedIds(args.viewerId));
  if (blockedIds.has(post.post.author_id)) throw forbidden();

  const profile = await store.ensureAnonymousProfile(args.viewerId);
  if (!profile) throw notFound();

  const row = await store.insertComment(args.postId, args.viewerId, input.content);
  return toFeedComment(
    {
      comment: row,
      aliasNumber: profile.alias_number,
      displayName: profile.display_name,
      likeCount: 0,
      likedByViewer: false,
    },
    args.viewerId
  );
}

/** DELETE own comment. */
export async function deleteComment(
  store: SecretChatStore,
  args: { viewerId: string; commentId: string }
): Promise<{ id: string; deleted: true }> {
  const result = await store.softDeleteComment(args.commentId, args.viewerId);

  // Three cases, kept apart for the same reason as `deletePost`: absent, present
  // but not yours, and your own.
  if (!result.authorId) throw notFound();
  if (!result.ok) throw forbidden();

  return { id: args.commentId, deleted: true };
}

export interface LikeResult {
  targetType: ReportTargetType;
  targetId: string;
  liked: boolean;
  likeCount: number;
}

/**
 * LIKE / UNLIKE a post or a comment.
 *
 * Idempotent by design. Liking twice is not an error and does not double the
 * count: the database has a unique constraint on `(target, liker)` and this
 * reports the count that actually resulted. That is what makes a double-tap, a
 * retried request after a flaky network, or two devices agree.
 *
 * Both target types are checked for existence first, including comments. A like
 * on a comment that no longer exists is `not_found` rather than a silently
 * stored row pointing at nothing, and the RLS insert policy enforces the same
 * thing in the database.
 */
export async function setLike(
  store: SecretChatStore,
  args: { viewerId: string; input: unknown }
): Promise<LikeResult> {
  const input = parse(likeTargetSchema, args.input);

  if (input.targetType === 'post') {
    const post = await store.getPost(input.targetId, args.viewerId);
    if (!post) throw notFound();
    const result = await store.setPostLike(input.targetId, {
      likerId: args.viewerId,
      liked: input.liked,
    });
    return { targetType: 'post', targetId: input.targetId, liked: input.liked, likeCount: result.likeCount };
  }

  const comment = await store.getComment(input.targetId, args.viewerId);
  if (!comment) throw notFound();

  const result = await store.setCommentLike(input.targetId, {
    likerId: args.viewerId,
    liked: input.liked,
  });
  return {
    targetType: 'comment',
    targetId: input.targetId,
    liked: input.liked,
    likeCount: result.likeCount,
  };
}

export interface ReportResult {
  reportId: string;
  status: 'open';
}

/**
 * REPORT a post or a comment.
 *
 * A report is a one-way door on purpose: the reporter is recorded, and the
 * reported person is never told who reported them. The store writes the
 * reporter id and nothing else, and no read path exposes a report to anyone but
 * a moderator.
 *
 * The target must be visible to the reporter, checked per type. A report against
 * something that does not exist is refused rather than stored, so a queue cannot
 * be filled with reports about ids that were guessed.
 */
export async function reportContent(
  store: SecretChatStore,
  args: { viewerId: string; input: unknown }
): Promise<ReportResult> {
  const input = parse(createReportSchema, args.input);

  if (input.targetType === 'post') {
    const post = await store.getPost(input.targetId, args.viewerId);
    if (!post) throw notFound();
  } else {
    const comment = await store.getComment(input.targetId, args.viewerId);
    if (!comment) throw notFound();
  }

  const report = await store.insertReport({
    reporterId: args.viewerId,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason as ReportReason,
    details: input.details ?? null,
  });

  return { reportId: report.id, status: 'open' };
}

/**
 * BLOCK a member, by naming one of their posts.
 *
 * The browser holds no user id, so it cannot send one. It sends a post id, which
 * it could only have got by reading that post — at which point the author is not
 * new information. The server resolves the author from the row it can already
 * read, and under RLS a post the blocker cannot see resolves to nothing at all.
 *
 * This is why there is no "resolve alias to account" endpoint anywhere in this
 * feature. Such an endpoint would be an oracle: nine thousand calls would rebuild
 * the complete alias-to-account mapping, and in a community this small that map
 * re-identifies people. Blocking by post has the same user benefit and no such
 * hole.
 */
export async function blockMember(
  store: SecretChatStore,
  args: { viewerId: string; input: unknown }
): Promise<{ postId: string; blocked: true }> {
  const input = parse(blockByPostSchema, args.input);

  const result = await store.blockAuthorOfPost(args.viewerId, input.postId);
  if (!result) throw notFound();

  return { postId: input.postId, blocked: true };
}

/**
 * UNBLOCK a member, by the opaque handle the block list gave back.
 *
 * The handle identifies the block, not the member, so it can be stored by the
 * client and replayed safely. Blocking twice is a no-op that returns the original
 * handle, so a double-tap cannot produce a second block.
 */
export async function unblockMember(
  store: SecretChatStore,
  args: { viewerId: string; input: unknown }
): Promise<{ blocked: false }> {
  const input = parse(unblockByRefSchema, args.input);

  const removed = await store.unblockByRef(args.viewerId, input.blockRef);
  if (!removed) throw notFound();

  return { blocked: false };
}

/**
 * The reader's own block list, as public identities.
 *
 * Only the reader's own rows are read, and the account ids are resolved to alias
 * numbers on the way out, so this endpoint hands back the same thing the feed
 * shows and nothing more.
 */
export async function listBlockedMembers(
  store: SecretChatStore,
  args: { viewerId: string }
): Promise<BlockedMember[]> {
  const rows = await store.listBlocked(args.viewerId);
  const identities = await store.resolveIdentities(rows.map((row) => row.blockedId));

  return rows.map((row) => ({
    blockRef: row.ref,
    aliasNumber: identities.get(row.blockedId)?.aliasNumber ?? 0,
    displayName: identities.get(row.blockedId)?.displayName ?? null,
  }));
}

export const LIMITS = {
  maxPostChars: MAX_POST_CHARS,
  maxCommentChars: MAX_COMMENT_CHARS,
} as const;
