import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AnonymousProfileRow,
  CommentRow,
  Database,
  PostRow,
  ReportRow,
} from '@/types/supabase-database';
import type {
  BlockedMemberRow,
  CreateReportArgs,
  FeedCommentRow,
  FeedCursor,
  FeedPostRow,
  ListFeedArgs,
  SecretChatStore,
  SetLikeArgs,
  SetLikeResult,
} from '@/lib/secretchat/store';
import { upstreamUnavailable } from '@/lib/secretchat/errors';

/**
 * The production adapter: Postgres through Row Level Security.
 *
 * The client passed in here is the *cookie-backed anon-key* client from
 * `@/lib/supabase/server`, so every statement below is evaluated by Postgres as
 * the signed-in member. That is the point: this file issues ordinary queries and
 * relies on the policies in `0002_secretchat_rls.sql` to decide what they may
 * touch. A bug in this file can under-fetch, but it cannot over-fetch, because
 * there is no privilege here that the caller's session does not already have.
 *
 * Notes on the specific queries:
 *   - counts and "did I like this" come from embedded aggregates rather than a
 *     round trip per post, so a feed page is a fixed number of queries;
 *   - author identities are resolved with `secretchat_identities(ids)`, which
 *     answers only about ids the caller already has. There is deliberately no
 *     query here that turns an alias into an account, because such a query would
 *     be an oracle for the whole alias-to-account map;
 *   - every write that must not double-apply relies on a unique constraint
 *     declared in `0001_secretchat_schema.sql`, not on a check in this file.
 */

const POST_SELECT = `
  id, author_id, content, created_at, updated_at, deleted_at, deleted_by_moderator,
  post_likes ( count ),
  comments ( count )
`;

const COMMENT_SELECT = `
  id, post_id, author_id, content, created_at, updated_at, deleted_at, deleted_by_moderator,
  comment_likes ( count )
`;

type PostSelectRow = PostRow & {
  post_likes: { count: number }[];
  comments: { count: number }[];
};

type CommentSelectRow = CommentRow & {
  comment_likes: { count: number }[];
};

/** PostgREST returns embedded counts as arrays, absent when nothing matched. */
function countOf(value: { count: number }[] | null | undefined): number {
  return value?.[0]?.count ?? 0;
}

function toFeedPostRow(
  row: PostSelectRow,
  identity: Identity,
  likedPostIds: ReadonlySet<string>
): FeedPostRow {
  return {
    post: row,
    aliasNumber: identity.aliasNumber,
    displayName: identity.displayName,
    likeCount: countOf(row.post_likes),
    commentCount: countOf(row.comments),
    likedByViewer: likedPostIds.has(row.id),
  };
}

function toFeedCommentRow(
  row: CommentSelectRow,
  identity: Identity,
  likedCommentIds: ReadonlySet<string>
): FeedCommentRow {
  return {
    comment: row,
    aliasNumber: identity.aliasNumber,
    displayName: identity.displayName,
    likeCount: countOf(row.comment_likes),
    likedByViewer: likedCommentIds.has(row.id),
  };
}

interface Identity {
  aliasNumber: number;
  displayName: string | null;
}

/**
 * Builds the adapter.
 *
 * The client is a parameter rather than being created here so the caller
 * decides which session the queries run under, and so a test can pass a
 * deliberately empty session and assert that nothing is readable.
 */
export function createSupabaseSecretChatStore(
  client: SupabaseClient<Database>
): SecretChatStore {
  /** Throws the shared error when PostgREST reports a problem. */
  const unwrap = <T>(result: { data: T | null; error: { message: string } | null }): T => {
    if (result.error) throw upstreamUnavailable();
    if (result.data === null) throw upstreamUnavailable();
    return result.data;
  };

  /**
   * Resolves the public identity of author ids the caller already holds.
   *
   * The returned map is keyed by the id that was asked about, so a row whose
   * author has no identity yet resolves to a zero alias rather than throwing:
   * a missing identity should not take the whole feed down.
   */
  const identitiesFor = async (userIds: string[]): Promise<Map<string, Identity>> => {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return new Map();

    const rows = unwrap(
      await client.rpc('secretchat_identities', { p_user_ids: unique })
    ) as unknown as { user_id: string; alias_number: number; display_name: string | null }[];

    return new Map(
      rows.map((row) => [
        row.user_id,
        { aliasNumber: row.alias_number, displayName: row.display_name },
      ])
    );
  };

  const identityOf = (map: Map<string, Identity>, userId: string): Identity =>
    map.get(userId) ?? { aliasNumber: 0, displayName: null };

  const postLikesFor = async (postIds: string[], likerId: string): Promise<Set<string>> => {
    if (postIds.length === 0) return new Set();
    const rows = unwrap(
      await client
        .from('post_likes')
        .select('post_id')
        .eq('liker_id', likerId)
        .in('post_id', postIds)
    );
    return new Set((rows as unknown as { post_id: string }[]).map((row) => row.post_id));
  };

  const commentLikesFor = async (commentIds: string[], likerId: string): Promise<Set<string>> => {
    if (commentIds.length === 0) return new Set();
    const rows = unwrap(
      await client
        .from('comment_likes')
        .select('comment_id')
        .eq('liker_id', likerId)
        .in('comment_id', commentIds)
    );
    return new Set((rows as unknown as { comment_id: string }[]).map((row) => row.comment_id));
  };

  return {
    async ensureAnonymousProfile(userId) {
      // Read first: the stored row is authoritative, which is what keeps an
      // alias stable no matter how many times this is called.
      const existing = await client
        .from('anonymous_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (existing.error) throw upstreamUnavailable();
      if (existing.data) return existing.data as AnonymousProfileRow;

      // First time. The claim itself happens in a security-definer SQL function
      // so the collision check and the insert cannot be raced apart; this call
      // is a convenience wrapper, not the authority. No argument is passed: the
      // function reads the caller from `auth.uid()` and ignores anything else, so
      // there is no parameter a caller could use to claim somebody else's alias.
      const claimed = unwrap(await client.rpc('secretchat_claim_anonymous_profile'));
      return claimed;
    },

    async listFeed(args: ListFeedArgs & { excludeAuthorIds: string[] }) {
      let query = client
        .from('posts')
        .select(POST_SELECT)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(args.limit);

      if (args.cursor) {
        query = applyKeysetCursor(query, args.cursor);
      }

      if (args.excludeAuthorIds.length > 0) {
        // `not.in` with a parenthesised list. The ids come from this member's own
        // block rows, never from the request, so there is nothing to validate.
        query = query.not('author_id', 'in', `(${args.excludeAuthorIds.join(',')})`);
      }

      const rows = unwrap(await query) as unknown as PostSelectRow[];
      if (rows.length === 0) return [];

      const [identities, liked] = await Promise.all([
        identitiesFor(rows.map((row) => row.author_id)),
        postLikesFor(
          rows.map((row) => row.id),
          args.viewerId
        ),
      ]);

      return rows.map((row) =>
        toFeedPostRow(row, identityOf(identities, row.author_id), liked)
      );
    },

    async getPost(postId, viewerId) {
      const rows = unwrap(
        await client.from('posts').select(POST_SELECT).eq('id', postId).is('deleted_at', null).limit(1)
      ) as unknown as PostSelectRow[];

      const row = rows[0];
      if (!row) return null;

      const [identities, liked] = await Promise.all([
        identitiesFor([row.author_id]),
        postLikesFor([postId], viewerId),
      ]);
      return toFeedPostRow(row, identityOf(identities, row.author_id), liked);
    },

    async listComments(postId, viewerId) {
      const rows = unwrap(
        await client
          .from('comments')
          .select(COMMENT_SELECT)
          .eq('post_id', postId)
          .order('created_at', { ascending: true })
      ) as unknown as CommentSelectRow[];
      if (rows.length === 0) return [];

      const [identities, liked] = await Promise.all([
        identitiesFor(rows.map((row) => row.author_id)),
        commentLikesFor(
          rows.map((row) => row.id),
          viewerId
        ),
      ]);

      return rows.map((row) =>
        toFeedCommentRow(row, identityOf(identities, row.author_id), liked)
      );
    },

    async getComment(commentId, viewerId) {
      // A comment is readable only while both it and its post are visible, so the
      // post is checked in the same round trip rather than trusted.
      const rows = unwrap(
        await client
          .from('comments')
          .select(COMMENT_SELECT)
          .eq('id', commentId)
          .is('deleted_at', null)
          .limit(1)
      ) as unknown as CommentSelectRow[];

      const row = rows[0];
      if (!row) return null;

      const parent = await client
        .from('posts')
        .select('id')
        .eq('id', row.post_id)
        .is('deleted_at', null)
        .maybeSingle();
      if (parent.error) throw upstreamUnavailable();
      if (!parent.data) return null;

      const [identities, liked] = await Promise.all([
        identitiesFor([row.author_id]),
        commentLikesFor([commentId], viewerId),
      ]);
      return toFeedCommentRow(row, identityOf(identities, row.author_id), liked);
    },

    async insertPost(authorId, content) {
      const row = unwrap<unknown>(
        await client.from('posts').insert({ author_id: authorId, content }).select('*').single()
      );
      return row as PostRow;
    },

    async softDeletePost(postId, actorId) {
      // RLS restricts this update to the author's own row; a member deleting
      // somebody else's post matches zero rows rather than changing it. The
      // `deleted_by_moderator` guard in the policy also stops a member from
      // un-hiding something a moderator removed.
      const rows = unwrap(
        await client
          .from('posts')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', postId)
          .eq('author_id', actorId)
          .is('deleted_at', null)
          .select('author_id')
      ) as unknown as { author_id: string }[];

      if (rows.length > 0) return { ok: true, authorId: rows[0].author_id };

      // Zero rows means "not there", "not yours", or "already removed". Look the
      // row up so the service can answer precisely, which a member is entitled to
      // know about their own content.
      const owner = await client.from('posts').select('author_id').eq('id', postId).maybeSingle();
      if (owner.error) throw upstreamUnavailable();
      if (!owner.data) return { ok: false, authorId: null };
      return { ok: false, authorId: (owner.data as { author_id: string }).author_id };
    },

    async insertComment(postId, authorId, content) {
      const row = unwrap<unknown>(
        await client
          .from('comments')
          .insert({ post_id: postId, author_id: authorId, content })
          .select('*')
          .single()
      );
      return row as CommentRow;
    },

    async softDeleteComment(commentId, actorId) {
      const rows = unwrap(
        await client
          .from('comments')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', commentId)
          .eq('author_id', actorId)
          .is('deleted_at', null)
          .select('author_id, post_id')
      ) as unknown as { author_id: string; post_id: string }[];

      if (rows.length > 0) {
        return { ok: true, authorId: rows[0].author_id, postId: rows[0].post_id };
      }

      const owner = await client
        .from('comments')
        .select('author_id, post_id')
        .eq('id', commentId)
        .maybeSingle();
      if (owner.error) throw upstreamUnavailable();
      if (!owner.data) return { ok: false, authorId: null, postId: null };
      return {
        ok: false,
        authorId: (owner.data as { author_id: string }).author_id,
        postId: (owner.data as { post_id: string }).post_id,
      };
    },

    async setPostLike(postId, { likerId, liked }: SetLikeArgs): Promise<SetLikeResult> {
      if (liked) {
        // `ignoreDuplicates` makes a repeated like a no-op instead of an error, so
        // a double-tap cannot fail or double the count. The unique constraint on
        // (post_id, liker_id) is what actually enforces it; `upsert` is used only
        // because this PostgREST client exposes a conflict target on upsert, not
        // on insert.
        const result = await client
          .from('post_likes')
          .upsert(
            { post_id: postId, liker_id: likerId },
            { onConflict: 'post_id,liker_id', ignoreDuplicates: true }
          )
          .select('post_id');
        if (result.error) throw upstreamUnavailable();
      } else {
        const result = await client
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('liker_id', likerId);
        if (result.error) throw upstreamUnavailable();
      }

      return { likeCount: await postLikeCount(postId), changed: liked };
    },

    async setCommentLike(commentId, { likerId, liked }: SetLikeArgs): Promise<SetLikeResult> {
      if (liked) {
        const result = await client
          .from('comment_likes')
          .upsert(
            { comment_id: commentId, liker_id: likerId },
            { onConflict: 'comment_id,liker_id', ignoreDuplicates: true }
          )
          .select('comment_id');
        if (result.error) throw upstreamUnavailable();
      } else {
        const result = await client
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('liker_id', likerId);
        if (result.error) throw upstreamUnavailable();
      }

      return { likeCount: await commentLikeCount(commentId), changed: liked };
    },

    async insertReport(args: CreateReportArgs) {
      const row = unwrap<unknown>(
        await client
          .from('reports')
          .insert({
            reporter_id: args.reporterId,
            target_type: args.targetType,
            target_id: args.targetId,
            reason: args.reason,
            details: args.details,
          })
          .select('*')
          .single()
      );
      return row as ReportRow;
    },

    async blockAuthorOfPost(blockerId, postId) {
      // Resolving the author from a post the blocker can read is what keeps the
      // account id out of the browser. Under RLS a post that is not visible to
      // this member simply does not come back, so an unknown or hidden post id
      // is indistinguishable here, which is the intended behaviour.
      const post = await client
        .from('posts')
        .select('author_id')
        .eq('id', postId)
        .is('deleted_at', null)
        .maybeSingle();
      if (post.error) throw upstreamUnavailable();
      if (!post.data) return null;

      const blockedId = (post.data as { author_id: string }).author_id;
      if (blockedId === blockerId) return null;

      const inserted = await client
        .from('blocks')
        .upsert(
          { blocker_id: blockerId, blocked_id: blockedId },
          { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true }
        )
        .select('ref, blocked_id, created_at');
      if (inserted.error) throw upstreamUnavailable();

      // With `ignoreDuplicates` an already-existing block returns no rows, so the
      // row is read back rather than assumed. This is the same handle the block
      // list returns, which is what makes unblock addressable later.
      const stored = await client
        .from('blocks')
        .select('ref, blocked_id, created_at')
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId)
        .maybeSingle();
      if (stored.error) throw upstreamUnavailable();
      if (!stored.data) return null;

      const row = stored.data as unknown as { ref: string; blocked_id: string; created_at: string };
      return { ref: row.ref, blockedId: row.blocked_id, createdAt: row.created_at };
    },

    async unblockByRef(blockerId, ref) {
      // The ref is scoped by the blocker in the same query, so one member's ref
      // cannot remove another member's block.
      const removed = await client
        .from('blocks')
        .delete()
        .eq('blocker_id', blockerId)
        .eq('ref', ref)
        .select('blocked_id');
      if (removed.error) throw upstreamUnavailable();

      const rows = removed.data as unknown as { blocked_id: string }[] | null;
      const row = rows?.[0];
      return row ? { blockedId: row.blocked_id } : null;
    },

    async listBlocked(blockerId): Promise<BlockedMemberRow[]> {
      const rows = unwrap(
        await client.from('blocks').select('ref, blocked_id, created_at').eq('blocker_id', blockerId)
      ) as unknown as { ref: string; blocked_id: string; created_at: string }[];

      return rows.map((row) => ({
        ref: row.ref,
        blockedId: row.blocked_id,
        createdAt: row.created_at,
      }));
    },

    async listBlockedIds(userId) {
      const rows = await client.from('blocks').select('blocked_id').eq('blocker_id', userId);
      if (rows.error) throw upstreamUnavailable();
      return ((rows.data ?? []) as unknown as { blocked_id: string }[]).map(
        (row) => row.blocked_id
      );
    },

    async resolveIdentities(userIds) {
      return identitiesFor(userIds);
    },
  };

  async function postLikeCount(postId: string): Promise<number> {
    const rows = unwrap(
      await client.from('posts').select('post_likes(count)').eq('id', postId).limit(1)
    ) as unknown as { post_likes: { count: number }[] }[];
    return countOf(rows[0]?.post_likes);
  }

  async function commentLikeCount(commentId: string): Promise<number> {
    const rows = unwrap(
      await client.from('comments').select('comment_likes(count)').eq('id', commentId).limit(1)
    ) as unknown as { comment_likes: { count: number }[] }[];
    return countOf(rows[0]?.comment_likes);
  }
}

/**
 * Keyset pagination as a tuple comparison.
 *
 * `created_at` alone is not enough: two posts written in the same microsecond
 * would make the last row of one page the first row of the next, and a reader
 * scrolling would see a post twice. Comparing `(created_at, id)` makes the order
 * total, so every post lands on exactly one page.
 *
 * The timestamp is double-quoted because an ISO value contains `:` and `+`, which
 * PostgREST would otherwise parse as filter syntax. It is safe to interpolate at
 * all only because `decodeCursor` has already proven the value matches an ISO
 * timestamp exactly, and the id matches a UUID.
 */
function applyKeysetCursor<
  T extends {
    lt: (column: string, value: string) => T;
    or: (filters: string) => T;
  }
>(query: T, cursor: FeedCursor): T {
  const createdAt = `"${cursor.createdAt}"`;
  return query.or(
    `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${cursor.id})`
  );
}
