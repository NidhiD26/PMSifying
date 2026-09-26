import type {
  AnonymousProfileRow,
  CommentRow,
  PostRow,
  ReportReason,
  ReportRow,
  ReportTargetType,
} from '@/types/supabase-database';
import { resolveAnonymousAlias } from '@/lib/secretchat/anonymous-identity';

/**
 * The port every SecretChat data operation goes through.
 *
 * WHY A PORT EXISTS
 * The interesting rules in this feature — a duplicate like is a no-op, a
 * blocked author is invisible, a member can only delete their own post, a
 * deleted post keeps its place in the feed but shows no body — are logic, not
 * SQL. Putting them behind this interface means they can be exercised by tests
 * with no database and no credentials, while production runs the same logic on
 * top of Postgres and RLS.
 *
 * The split of responsibility:
 *   - this port stores and counts, and refuses to violate data integrity
 *     (unique likes, soft deletes, no resurrecting a deleted row);
 *   - `@/lib/secretchat/service` decides who may ask and shapes the result;
 *   - RLS decides who may ask at all, and is the layer a bug in the other two
 *     cannot get past.
 *
 * WHY NOTHING HERE TAKES AN ACCOUNT ID
 * The browser never receives one, so no method accepts a target user id from the
 * client. Blocking is addressed by a post the member can already read, and the
 * server resolves its author. That is not a stylistic choice: a method that
 * turned an alias number into an account id would be an oracle — a caller could
 * sweep all nine thousand aliases and rebuild the complete alias-to-account map,
 * which is exactly the mapping the whole feature exists to keep private.
 */

/** A post plus the counts and viewer state the feed needs. */
export interface FeedPostRow {
  post: PostRow;
  aliasNumber: number;
  displayName: string | null;
  likeCount: number;
  commentCount: number;
  likedByViewer: boolean;
}

export interface FeedCommentRow {
  comment: CommentRow;
  aliasNumber: number;
  displayName: string | null;
  likeCount: number;
  likedByViewer: boolean;
}

/** Keyset pagination: strictly older than this point, newest first. */
export interface FeedCursor {
  createdAt: string;
  id: string;
}

export interface ListFeedArgs {
  /** Rows to return. The service may ask for more than a page to absorb blocks. */
  limit: number;
  cursor?: FeedCursor;
  /** The signed-in member, so "did I like this" can be answered in one query. */
  viewerId: string;
}

export interface SetLikeArgs {
  likerId: string;
  liked: boolean;
}

export interface SetLikeResult {
  likeCount: number;
  /** False when the request was already satisfied. Idempotent by design. */
  changed: boolean;
}

export interface CreateReportArgs {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details: string | null;
}

/** One row of the blocker's own block list. */
export interface BlockedMemberRow {
  /**
   * Opaque handle for this block pair, minted when the block was created.
   *
   * Unblocking needs something the client can name, and the client has no user
   * id to name. This is a per-pair random uuid: it identifies the block, not the
   * member, so holding it reveals nothing a blocker does not already know.
   */
  ref: string;
  blockedId: string;
  createdAt: string;
}

export interface SecretChatStore {
  /**
   * Returns the member's anonymous identity, claiming one on first use.
   *
   * Must be idempotent: calling it again returns the same alias, which is what
   * makes an alias stable across sessions.
   */
  ensureAnonymousProfile(userId: string): Promise<AnonymousProfileRow>;

  /** Reads rows newer-first, oldest-first tiebreak, excluding blocked authors. */
  listFeed(args: ListFeedArgs & { excludeAuthorIds: string[] }): Promise<FeedPostRow[]>;

  /** One post with its counts. `null` when it does not exist or is hidden. */
  getPost(postId: string, viewerId: string): Promise<FeedPostRow | null>;

  /** Comments on a visible post, oldest first, including soft-deleted ones. */
  listComments(postId: string, viewerId: string): Promise<FeedCommentRow[]>;

  /**
   * One comment by its own id, or null when it is not visible to this reader.
   *
   * Separate from `listComments` because a like or a report addresses a comment
   * directly, and "list the whole thread to check whether one exists" is both
   * wasteful and wrong: it would let a request pass on a thread it cannot see.
   */
  getComment(commentId: string, viewerId: string): Promise<FeedCommentRow | null>;

  insertPost(authorId: string, content: string): Promise<PostRow>;

  /**
   * Soft-deletes a post, and only ever the actor's own.
   *
   * Returns the stored author so the service can answer "not yours" precisely.
   * The store must not modify a row it is about to report as not-owned.
   */
  softDeletePost(postId: string, actorId: string): Promise<{ ok: boolean; authorId: string | null }>;

  insertComment(postId: string, authorId: string, content: string): Promise<CommentRow>;

  /** Soft-deletes a comment, and only ever the actor's own. */
  softDeleteComment(
    commentId: string,
    actorId: string
  ): Promise<{ ok: boolean; authorId: string | null; postId: string | null }>;

  setPostLike(postId: string, args: SetLikeArgs): Promise<SetLikeResult>;
  setCommentLike(commentId: string, args: SetLikeArgs): Promise<SetLikeResult>;

  insertReport(args: CreateReportArgs): Promise<ReportRow>;

  /**
   * Blocks the author of a post the blocker can read.
   *
   * Addressing by post rather than by member is what keeps the account id out of
   * the browser's hands: the member supplies something they already saw, and the
   * row they can see already tells the server who wrote it. Returns null when
   * the post is not visible to this blocker, which under RLS also covers "does
   * not exist".
   */
  blockAuthorOfPost(
    blockerId: string,
    postId: string
  ): Promise<{ ref: string; blockedId: string; createdAt: string } | null>;

  /** Removes one of the blocker's own blocks, addressed by its opaque ref. */
  unblockByRef(blockerId: string, ref: string): Promise<{ blockedId: string } | null>;

  /** The blocker's own block list. Never anybody else's. */
  listBlocked(blockerId: string): Promise<BlockedMemberRow[]>;

  /**
   * Resolves the public identity of accounts the caller already holds ids for.
   *
   * Exposed as a port method rather than folded into the read methods so the
   * block list can be rendered with real aliases. It answers only about the ids
   * passed in, and never returns a listing, which is what stops it becoming a
   * directory of who owns which alias.
   */
  resolveIdentities(
    userIds: string[]
  ): Promise<Map<string, { aliasNumber: number; displayName: string | null }>>;

  /** Convenience: the ids above, for feed filtering. */
  listBlockedIds(userId: string): Promise<string[]>;
}

/**
 * In-memory implementation of the port.
 *
 * This is the reference implementation of the *storage* rules, and the fixture
 * the service tests run against. It is a genuine adapter rather than a mock: it
 * enforces the same uniqueness and soft-delete behaviour as the SQL, so a test
 * that passes here is testing the semantics, not a stub's behaviour.
 *
 * It is not used by the app. Production reads and writes go through
 * `supabase-store.ts`, which adds the row level security that only a database
 * can enforce.
 */
export function createInMemorySecretChatStore(): SecretChatStore {
  const now = () => new Date().toISOString();

  // Insertion-ordered maps with an explicit sort on read, so ordering never
  // depends on Map iteration luck.
  const profiles = new Map<string, AnonymousProfileRow>();
  const posts = new Map<string, PostRow>();
  const comments = new Map<string, CommentRow>();
  const postLikes = new Map<string, SetLikeArgs & { postId: string }>();
  const commentLikes = new Map<string, SetLikeArgs & { commentId: string }>();
  const reports = new Map<string, ReportRow>();
  const blocks = new Map<
    string,
    { blockerId: string; blockedId: string; ref: string; createdAt: string }
  >();

  let sequence = 0;
  const nextId = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;

  const countPostLikes = (postId: string) =>
    [...postLikes.values()].filter((like) => like.postId === postId).length;

  const countCommentLikes = (commentId: string) =>
    [...commentLikes.values()].filter((like) => like.commentId === commentId).length;

  const countComments = (postId: string) =>
    [...comments.values()].filter((comment) => comment.post_id === postId).length;

  const aliasOf = (authorId: string) => profiles.get(authorId);

  const likedPostBy = (postId: string, likerId: string) =>
    [...postLikes.values()].some((like) => like.postId === postId && like.likerId === likerId);

  const likedCommentBy = (commentId: string, likerId: string) =>
    [...commentLikes.values()].some(
      (like) => like.commentId === commentId && like.likerId === likerId
    );

  return {
    async ensureAnonymousProfile(userId) {
      const existing = profiles.get(userId);
      if (existing) return existing;

      const taken = new Set([...profiles.values()].map((profile) => profile.alias_number));
      const aliasNumber = resolveAnonymousAlias(userId, (candidate) => taken.has(candidate));
      if (aliasNumber === null) {
        throw new Error('anonymous alias space exhausted');
      }

      const row: AnonymousProfileRow = {
        id: nextId(),
        user_id: userId,
        alias_number: aliasNumber,
        display_name: null,
        created_at: now(),
        updated_at: now(),
      };
      profiles.set(userId, row);
      return row;
    },

    async listFeed({ limit, cursor, excludeAuthorIds, viewerId }) {
      const excluded = new Set(excludeAuthorIds);
      return [...posts.values()]
        .filter((post) => post.deleted_at === null)
        .filter((post) => !excluded.has(post.author_id))
        .filter((post) =>
          cursor
            ? post.created_at < cursor.createdAt ||
              (post.created_at === cursor.createdAt && post.id < cursor.id)
            : true
        )
        .sort((a, b) =>
          a.created_at === b.created_at
            ? b.id.localeCompare(a.id)
            : b.created_at.localeCompare(a.created_at)
        )
        .slice(0, limit)
        .map((post) => {
          const profile = aliasOf(post.author_id);
          return {
            post,
            aliasNumber: profile?.alias_number ?? 0,
            displayName: profile?.display_name ?? null,
            likeCount: countPostLikes(post.id),
            commentCount: countComments(post.id),
            likedByViewer: likedPostBy(post.id, viewerId),
          };
        });
    },

    async getPost(postId, viewerId) {
      const post = posts.get(postId);
      if (!post || post.deleted_at !== null) return null;
      const profile = aliasOf(post.author_id);
      return {
        post,
        aliasNumber: profile?.alias_number ?? 0,
        displayName: profile?.display_name ?? null,
        likeCount: countPostLikes(postId),
        commentCount: countComments(postId),
        likedByViewer: likedPostBy(postId, viewerId),
      };
    },

    async listComments(postId, viewerId) {
      return [...comments.values()]
        .filter((comment) => comment.post_id === postId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((comment) => {
          const profile = aliasOf(comment.author_id);
          return {
            comment,
            aliasNumber: profile?.alias_number ?? 0,
            displayName: profile?.display_name ?? null,
            likeCount: countCommentLikes(comment.id),
            likedByViewer: likedCommentBy(comment.id, viewerId),
          };
        });
    },

    async getComment(commentId, viewerId) {
      const comment = comments.get(commentId);
      if (!comment || comment.deleted_at !== null) return null;
      // A comment on a hidden post is not readable either, matching the insert
      // policy that refuses to create one in the first place.
      const post = posts.get(comment.post_id);
      if (!post || post.deleted_at !== null) return null;

      const profile = aliasOf(comment.author_id);
      return {
        comment,
        aliasNumber: profile?.alias_number ?? 0,
        displayName: profile?.display_name ?? null,
        likeCount: countCommentLikes(comment.id),
        likedByViewer: likedCommentBy(comment.id, viewerId),
      };
    },

    async insertPost(authorId, content) {
      const row: PostRow = {
        id: nextId(),
        author_id: authorId,
        content,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
        deleted_by_moderator: false,
      };
      posts.set(row.id, row);
      return row;
    },

    async softDeletePost(postId, actorId) {
      const post = posts.get(postId);
      if (!post) return { ok: false, authorId: null };

      // Ownership is settled before anything is written. Mutating first and
      // reporting afterwards would let a member remove somebody else's post and
      // only then be told they were not allowed to.
      if (post.author_id !== actorId) return { ok: false, authorId: post.author_id };

      if (post.deleted_at === null) {
        post.deleted_at = now();
        post.updated_at = now();
      }
      return { ok: true, authorId: post.author_id };
    },

    async insertComment(postId, authorId, content) {
      const row: CommentRow = {
        id: nextId(),
        post_id: postId,
        author_id: authorId,
        content,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
        deleted_by_moderator: false,
      };
      comments.set(row.id, row);
      return row;
    },

    async softDeleteComment(commentId, actorId) {
      const comment = comments.get(commentId);
      if (!comment) return { ok: false, authorId: null, postId: null };

      if (comment.author_id !== actorId) {
        return { ok: false, authorId: comment.author_id, postId: comment.post_id };
      }

      if (comment.deleted_at === null) {
        comment.deleted_at = now();
        comment.updated_at = now();
      }
      return { ok: true, authorId: comment.author_id, postId: comment.post_id };
    },

    async setPostLike(postId, { likerId, liked }) {
      const key = `${postId}:${likerId}`;
      const existed = postLikes.has(key);
      if (liked && !existed) postLikes.set(key, { postId, likerId, liked: true });
      if (!liked && existed) postLikes.delete(key);
      return { likeCount: countPostLikes(postId), changed: liked !== existed };
    },

    async setCommentLike(commentId, { likerId, liked }) {
      const key = `${commentId}:${likerId}`;
      const existed = commentLikes.has(key);
      if (liked && !existed) commentLikes.set(key, { commentId, likerId, liked: true });
      if (!liked && existed) commentLikes.delete(key);
      return { likeCount: countCommentLikes(commentId), changed: liked !== existed };
    },

    async insertReport(args) {
      const row: ReportRow = {
        id: nextId(),
        reporter_id: args.reporterId,
        target_type: args.targetType,
        target_id: args.targetId,
        reason: args.reason,
        details: args.details,
        status: 'open',
        created_at: now(),
        updated_at: now(),
        resolved_at: null,
        resolved_by: null,
      };
      reports.set(row.id, row);
      return row;
    },

    async blockAuthorOfPost(blockerId, postId) {
      const post = posts.get(postId);
      if (!post || post.deleted_at !== null) return null;

      const key = `${blockerId}:${post.author_id}`;
      const existing = blocks.get(key);
      // Blocking the same member from a second one of their posts returns the
      // first block rather than a second one, matching the unique constraint.
      if (existing) return existing;

      const row = { blockerId, blockedId: post.author_id, ref: nextId(), createdAt: now() };
      blocks.set(key, row);
      return row;
    },

    async unblockByRef(blockerId, ref) {
      for (const [key, block] of blocks) {
        if (block.blockerId !== blockerId || block.ref !== ref) continue;
        blocks.delete(key);
        return { blockedId: block.blockedId };
      }
      return null;
    },

    async listBlocked(blockerId) {
      return [...blocks.values()]
        .filter((block) => block.blockerId === blockerId)
        .map((block) => ({ ref: block.ref, blockedId: block.blockedId, createdAt: block.createdAt }));
    },

    async listBlockedIds(userId) {
      const ids = new Set<string>();
      for (const block of blocks.values()) {
        if (block.blockerId === userId) ids.add(block.blockedId);
      }
      return [...ids];
    },

    async resolveIdentities(userIds) {
      // The in-memory adapter already holds the private table, so this is a direct
      // lookup — the same question the SQL function answers, asked the same way:
      // only about ids the caller supplied.
      return new Map(
        userIds.map((userId) => {
          const profile = profiles.get(userId);
          return [
            userId,
            { aliasNumber: profile?.alias_number ?? 0, displayName: profile?.display_name ?? null },
          ];
        })
      );
    },
  };
}
