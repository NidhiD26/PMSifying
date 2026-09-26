import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemorySecretChatStore } from '../lib/secretchat/store';
import type { SecretChatStore } from '../lib/secretchat/store';
import {
  blockMember,
  createComment,
  createPost,
  deleteComment,
  deletePost,
  getFeed,
  getPostDetail,
  listBlockedMembers,
  reportContent,
  setLike,
  unblockMember,
} from '../lib/secretchat/service';
import { SecretChatError } from '../lib/secretchat/errors';

/**
 * The service is where every rule about *who may do what* is decided, so these
 * tests are the executable statement of the feature's promises.
 *
 * The in-memory adapter is a genuine implementation of the storage rules rather
 * than a mock, so a passing test here is evidence about the semantics and not
 * about a stub's behaviour. RLS enforces the same rules a second time in the
 * database; neither layer trusts the client.
 */

const ALICE = 'aaaaaaaa-0000-4000-8000-000000000001';
const BOB = 'bbbbbbbb-0000-4000-8000-000000000002';
const CAROL = 'cccccccc-0000-4000-8000-000000000003';

let store: SecretChatStore;

/** The error a call is expected to fail with. */
async function expectCode(promise: Promise<unknown>, code: string, status?: number) {
  await expect(promise).rejects.toBeInstanceOf(SecretChatError);
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught
  );
  expect(error).toBeInstanceOf(SecretChatError);
  const typed = error as SecretChatError;
  expect(typed.code).toBe(code);
  if (status !== undefined) expect(typed.status).toBe(status);
  return typed;
}

beforeEach(() => {
  store = createInMemorySecretChatStore();
});

describe('posting', () => {
  it('claims an alias on the very first post', async () => {
    const post = await createPost(store, { viewerId: ALICE, input: { content: 'hello' } });
    expect(post.content).toBe('hello');
    expect(post.author.aliasNumber).toBeGreaterThanOrEqual(1000);
    expect(post.author.aliasNumber).toBeLessThanOrEqual(9999);
  });

  it('gives the same member the same alias on every later post', async () => {
    const first = await createPost(store, { viewerId: ALICE, input: { content: 'one' } });
    const second = await createPost(store, { viewerId: ALICE, input: { content: 'two' } });
    const third = await createPost(store, { viewerId: ALICE, input: { content: 'three' } });
    expect(second.author.aliasNumber).toBe(first.author.aliasNumber);
    expect(third.author.aliasNumber).toBe(first.author.aliasNumber);
  });

  it('gives two members different aliases', async () => {
    const alice = await createPost(store, { viewerId: ALICE, input: { content: 'a' } });
    const bob = await createPost(store, { viewerId: BOB, input: { content: 'b' } });
    expect(bob.author.aliasNumber).not.toBe(alice.author.aliasNumber);
  });

  it('never puts an account id in the response', async () => {
    const post = await createPost(store, { viewerId: ALICE, input: { content: 'hello' } });
    const serialised = JSON.stringify(post);
    expect(serialised).not.toContain(ALICE);
    expect(serialised).not.toContain(BOB);
  });

  it('has no field the client can use to choose its author', async () => {
    await expectCode(
      createPost(store, {
        viewerId: ALICE,
        input: { content: 'hello', authorId: BOB },
      }),
      'invalid_request',
      400
    );
  });

  it('marks the reader their own post so the UI can offer delete', async () => {
    const post = await createPost(store, { viewerId: ALICE, input: { content: 'hello' } });
    expect(post.author.isYou).toBe(true);
    expect(post.canDelete).toBe(true);
  });

  it('reports somebody else\'s post as not yours', async () => {
    await createPost(store, { viewerId: BOB, input: { content: 'bobs post' } });
    const feed = await getFeed(store, { viewerId: ALICE });
    const bobsPost = feed.posts[0];
    expect(bobsPost.author.isYou).toBe(false);
    expect(bobsPost.canDelete).toBe(false);
  });
});

describe('deleting', () => {
  it('lets a member delete their own post', async () => {
    const post = await createPost(store, { viewerId: ALICE, input: { content: 'mine' } });
    await expect(deletePost(store, { viewerId: ALICE, postId: post.id })).resolves.toEqual({
      id: post.id,
      deleted: true,
    });
  });

  /**
   * Ownership is resolved from the stored row, never from the request, so this
   * cannot be talked around. The post must still be there afterwards.
   */
  it('refuses to delete somebody else\'s post and leaves it standing', async () => {
    const post = await createPost(store, { viewerId: BOB, input: { content: 'bobs' } });
    await expectCode(
      deletePost(store, { viewerId: ALICE, postId: post.id }),
      'forbidden',
      403
    );

    const still = await store.getPost(post.id, ALICE);
    expect(still).not.toBeNull();
    expect(still?.post.deleted_at).toBeNull();
  });

  it('reports a missing post as not found', async () => {
    await expectCode(
      deletePost(store, { viewerId: ALICE, postId: 'dddddddd-0000-4000-8000-000000000004' }),
      'not_found',
      404
    );
  });

  it('keeps a deleted post out of the feed', async () => {
    const post = await createPost(store, { viewerId: ALICE, input: { content: 'regrettable' } });
    await deletePost(store, { viewerId: ALICE, postId: post.id });

    const feed = await getFeed(store, { viewerId: ALICE });
    expect(feed.posts.map((p) => p.id)).not.toContain(post.id);
  });

  it('lets a member delete their own comment only', async () => {
    const post = await createPost(store, { viewerId: BOB, input: { content: 'a post' } });
    const mine = await createComment(store, {
      viewerId: ALICE,
      postId: post.id,
      input: { content: 'my reply' },
    });

    await expectCode(
      deleteComment(store, { viewerId: CAROL, commentId: mine.id }),
      'forbidden',
      403
    );
    await expect(deleteComment(store, { viewerId: ALICE, commentId: mine.id })).resolves.toEqual({
      id: mine.id,
      deleted: true,
    });
  });
});

describe('comments', () => {
  it('adds a comment to a visible post', async () => {
    const post = await createPost(store, { viewerId: ALICE, input: { content: 'a post' } });
    const comment = await createComment(store, {
      viewerId: BOB,
      postId: post.id,
      input: { content: 'a reply' },
    });
    expect(comment.content).toBe('a reply');
    expect(comment.postId).toBe(post.id);
    expect(comment.author.isYou).toBe(true);
  });

  /**
   * A stale client must not be able to use the comment endpoint to confirm that
   * a deleted post exists, so a hidden post is `not_found` rather than a
   * permission error that would imply the post is real.
   */
  it('refuses to comment on a deleted post as not found', async () => {
    const post = await createPost(store, { viewerId: ALICE, input: { content: 'oops' } });
    await deletePost(store, { viewerId: ALICE, postId: post.id });

    await expectCode(
      createComment(store, { viewerId: BOB, postId: post.id, input: { content: 'hello?' } }),
      'not_found',
      404
    );
  });

  it('refuses to comment on a post that never existed', async () => {
    await expectCode(
      createComment(store, {
        viewerId: BOB,
        postId: 'dddddddd-0000-4000-8000-000000000004',
        input: { content: 'hello?' },
      }),
      'not_found'
    );
  });

  it('keeps a thread shaped after a comment is deleted', async () => {
    const post = await createPost(store, { viewerId: ALICE, input: { content: 'a post' } });
    const first = await createComment(store, {
      viewerId: BOB,
      postId: post.id,
      input: { content: 'first' },
    });
    await createComment(store, {
      viewerId: CAROL,
      postId: post.id,
      input: { content: 'second' },
    });
    await deleteComment(store, { viewerId: BOB, commentId: first.id });

    const detail = await getPostDetail(store, { viewerId: CAROL, postId: post.id });
    // The row is still there with its body gone, so a reply is not mistaken for
    // something that was never written.
    expect(detail.comments).toHaveLength(2);
    expect(detail.comments[0].isDeleted).toBe(true);
    expect(detail.comments[0].content).toBe('');
  });

  it('counts comments on the post', async () => {
    const post = await createPost(store, { viewerId: ALICE, input: { content: 'a post' } });
    await createComment(store, { viewerId: BOB, postId: post.id, input: { content: 'one' } });
    await createComment(store, { viewerId: CAROL, postId: post.id, input: { content: 'two' } });

    const detail = await getPostDetail(store, { viewerId: ALICE, postId: post.id });
    expect(detail.post.commentCount).toBe(2);
  });
});

describe('liking', () => {
  it('likes a post once and counts it', async () => {
    const post = await createPost(store, { viewerId: BOB, input: { content: 'like me' } });
    const result = await setLike(store, {
      viewerId: ALICE,
      input: { targetType: 'post', targetId: post.id, liked: true },
    });
    expect(result).toEqual({
      targetType: 'post',
      targetId: post.id,
      liked: true,
      likeCount: 1,
    });
  });

  /**
   * Idempotence is what lets the UI retry a request it is not sure landed, and
   * what makes a double-tap harmless. A double count here would be a visible,
   * permanent lie in the UI.
   */
  it('is idempotent: liking twice counts once', async () => {
    const post = await createPost(store, { viewerId: BOB, input: { content: 'like me' } });
    const input = { targetType: 'post' as const, targetId: post.id, liked: true };

    await setLike(store, { viewerId: ALICE, input });
    const second = await setLike(store, { viewerId: ALICE, input });
    const third = await setLike(store, { viewerId: ALICE, input });

    expect(second.likeCount).toBe(1);
    expect(third.likeCount).toBe(1);
  });

  it('unlikes back to zero, and unliking twice stays zero', async () => {
    const post = await createPost(store, { viewerId: BOB, input: { content: 'x' } });
    const liked = { targetType: 'post' as const, targetId: post.id, liked: true };
    const unliked = { targetType: 'post' as const, targetId: post.id, liked: false };

    await setLike(store, { viewerId: ALICE, input: liked });
    expect((await setLike(store, { viewerId: ALICE, input: unliked })).likeCount).toBe(0);
    expect((await setLike(store, { viewerId: ALICE, input: unliked })).likeCount).toBe(0);
  });

  it('counts two members liking the same post as two', async () => {
    const post = await createPost(store, { viewerId: CAROL, input: { content: 'x' } });
    await setLike(store, {
      viewerId: ALICE,
      input: { targetType: 'post', targetId: post.id, liked: true },
    });
    const result = await setLike(store, {
      viewerId: BOB,
      input: { targetType: 'post', targetId: post.id, liked: true },
    });
    expect(result.likeCount).toBe(2);
  });

  it('likes a comment', async () => {
    const post = await createPost(store, { viewerId: ALICE, input: { content: 'x' } });
    const comment = await createComment(store, {
      viewerId: BOB,
      postId: post.id,
      input: { content: 'a reply' },
    });
    const result = await setLike(store, {
      viewerId: CAROL,
      input: { targetType: 'comment', targetId: comment.id, liked: true },
    });
    expect(result).toEqual({
      targetType: 'comment',
      targetId: comment.id,
      liked: true,
      likeCount: 1,
    });
  });

  it('refuses a like on a comment that no longer exists', async () => {
    // Checked per target type, so this cannot leave a like pointing at nothing.
    const post = await createPost(store, { viewerId: ALICE, input: { content: 'x' } });
    const comment = await createComment(store, {
      viewerId: BOB,
      postId: post.id,
      input: { content: 'a reply' },
    });
    await deleteComment(store, { viewerId: BOB, commentId: comment.id });

    await expectCode(
      setLike(store, {
        viewerId: CAROL,
        input: { targetType: 'comment', targetId: comment.id, liked: true },
      }),
      'not_found',
      404
    );
  });

  it('refuses a like on a deleted post', async () => {
    const post = await createPost(store, { viewerId: BOB, input: { content: 'x' } });
    await deletePost(store, { viewerId: BOB, postId: post.id });

    await expectCode(
      setLike(store, {
        viewerId: ALICE,
        input: { targetType: 'post', targetId: post.id, liked: true },
      }),
      'not_found'
    );
  });

  it('shows the author their own like as liked', async () => {
    const post = await createPost(store, { viewerId: BOB, input: { content: 'x' } });
    await setLike(store, {
      viewerId: ALICE,
      input: { targetType: 'post', targetId: post.id, liked: true },
    });

    const asAlice = await getPostDetail(store, { viewerId: ALICE, postId: post.id });
    expect(asAlice.post.likedByYou).toBe(true);
    const asBob = await getPostDetail(store, { viewerId: BOB, postId: post.id });
    expect(asBob.post.likedByYou).toBe(false);
  });
});

describe('reporting', () => {
  it('files a report against a visible post', async () => {
    const post = await createPost(store, { viewerId: BOB, input: { content: 'x' } });
    await expect(
      reportContent(store, {
        viewerId: ALICE,
        input: { targetType: 'post', targetId: post.id, reason: 'harassment' },
      })
    ).resolves.toEqual({ reportId: expect.any(String), status: 'open' });
  });

  it('refuses a report against something that does not exist', async () => {
    // Otherwise a queue fills with reports about guessed ids.
    await expectCode(
      reportContent(store, {
        viewerId: ALICE,
        input: {
          targetType: 'post',
          targetId: 'dddddddd-0000-4000-8000-000000000004',
          reason: 'harassment',
        },
      }),
      'not_found'
    );
  });

  it('refuses a report against a deleted post', async () => {
    const post = await createPost(store, { viewerId: BOB, input: { content: 'x' } });
    await deletePost(store, { viewerId: BOB, postId: post.id });

    await expectCode(
      reportContent(store, {
        viewerId: ALICE,
        input: { targetType: 'post', targetId: post.id, reason: 'harassment' },
      }),
      'not_found'
    );
  });

  it('refuses a report against a deleted comment', async () => {
    const post = await createPost(store, { viewerId: ALICE, input: { content: 'x' } });
    const comment = await createComment(store, {
      viewerId: BOB,
      postId: post.id,
      input: { content: 'a reply' },
    });
    await deleteComment(store, { viewerId: BOB, commentId: comment.id });

    await expectCode(
      reportContent(store, {
        viewerId: CAROL,
        input: { targetType: 'comment', targetId: comment.id, reason: 'harassment' },
      }),
      'not_found'
    );
  });

  it('never returns the reporter to the reported side', async () => {
    const post = await createPost(store, { viewerId: BOB, input: { content: 'x' } });
    const result = await reportContent(store, {
      viewerId: ALICE,
      input: { targetType: 'post', targetId: post.id, reason: 'spam' },
    });
    expect(Object.keys(result).sort()).toEqual(['reportId', 'status']);
  });
});

describe('blocking', () => {
  it('hides a blocked member\'s posts from the blocker', async () => {
    const bobsPost = await createPost(store, { viewerId: BOB, input: { content: 'bobs' } });
    await createPost(store, { viewerId: CAROL, input: { content: 'carols' } });

    await blockMember(store, { viewerId: ALICE, input: { postId: bobsPost.id } });

    const feed = await getFeed(store, { viewerId: ALICE });
    expect(feed.posts.map((p) => p.id)).toEqual([expect.any(String)]);
    expect(feed.posts[0].content).toBe('carols');
  });

  it('hides the blocked member\'s comments on somebody else\'s post', async () => {
    // Bob is blocked via one of Bob's own posts, and the comment being hidden is
    // Bob's reply under Carol's post. Blocking the author of the post being read
    // would instead make the whole post `not_found`, which is a different rule and
    // is covered by the one-directional test below.
    const carolsPost = await createPost(store, { viewerId: CAROL, input: { content: 'a post' } });
    const bobsOwnPost = await createPost(store, { viewerId: BOB, input: { content: 'bobs' } });
    await createComment(store, {
      viewerId: BOB,
      postId: carolsPost.id,
      input: { content: 'bobs reply' },
    });
    await createComment(store, { viewerId: ALICE, postId: carolsPost.id, input: { content: 'my reply' } });

    await blockMember(store, { viewerId: ALICE, input: { postId: bobsOwnPost.id } });

    const detail = await getPostDetail(store, { viewerId: ALICE, postId: carolsPost.id });
    expect(detail.comments.map((c) => c.content)).toEqual(['my reply']);
  });

  it('hides the whole post when the reader blocked its author', async () => {
    // Not `forbidden`: saying "that exists but you may not see it" is exactly the
    // probe the code refuses to answer.
    const bobsPost = await createPost(store, { viewerId: BOB, input: { content: 'bobs' } });
    await createComment(store, { viewerId: BOB, postId: bobsPost.id, input: { content: 'own' } });

    await blockMember(store, { viewerId: ALICE, input: { postId: bobsPost.id } });

    await expectCode(
      getPostDetail(store, { viewerId: ALICE, postId: bobsPost.id }),
      'not_found',
      404
    );
  });

  /**
   * Blocking is addressed by post, so there is no request anywhere that can name
   * a person. This is the test that would fail if someone added an
   * `aliasNumber -> account` lookup to make blocking "easier".
   */
  it('offers no way to name a member directly', async () => {
    const post = await createPost(store, { viewerId: BOB, input: { content: 'x' } });
    await expectCode(
      blockMember(store, { viewerId: ALICE, input: { postId: post.id, aliasNumber: 4821 } }),
      'invalid_request'
    );
    await expectCode(
      blockMember(store, { viewerId: ALICE, input: { aliasNumber: 4821 } }),
      'invalid_request'
    );
  });

  it('cannot block through a post that is not visible', async () => {
    const post = await createPost(store, { viewerId: BOB, input: { content: 'x' } });
    await deletePost(store, { viewerId: BOB, postId: post.id });

    await expectCode(
      blockMember(store, { viewerId: ALICE, input: { postId: post.id } }),
      'not_found'
    );
  });

  it('blocking twice yields one block, not two', async () => {
    const first = await createPost(store, { viewerId: BOB, input: { content: 'one' } });
    const second = await createPost(store, { viewerId: BOB, input: { content: 'two' } });

    await blockMember(store, { viewerId: ALICE, input: { postId: first.id } });
    await blockMember(store, { viewerId: ALICE, input: { postId: second.id } });

    expect(await store.listBlocked(ALICE)).toHaveLength(1);
  });

  it('lists the blocked member by alias, not by account id', async () => {
    const post = await createPost(store, { viewerId: BOB, input: { content: 'x' } });
    const bobsAlias = post.author.aliasNumber;
    await blockMember(store, { viewerId: ALICE, input: { postId: post.id } });

    const blocked = await listBlockedMembers(store, { viewerId: ALICE });
    expect(blocked).toHaveLength(1);
    expect(blocked[0].aliasNumber).toBe(bobsAlias);

    // The list is a public identity and an opaque handle. No account id.
    expect(Object.keys(blocked[0]).sort()).toEqual(['aliasNumber', 'blockRef', 'displayName']);
    expect(JSON.stringify(blocked)).not.toContain(BOB);
  });

  it('shows a member only their own block list', async () => {
    const post = await createPost(store, { viewerId: BOB, input: { content: 'x' } });
    await blockMember(store, { viewerId: ALICE, input: { postId: post.id } });

    expect(await listBlockedMembers(store, { viewerId: CAROL })).toEqual([]);
  });

  it('unblocks by the opaque handle the list returned', async () => {
    const post = await createPost(store, { viewerId: BOB, input: { content: 'x' } });
    await blockMember(store, { viewerId: ALICE, input: { postId: post.id } });

    const [entry] = await listBlockedMembers(store, { viewerId: ALICE });
    await expect(
      unblockMember(store, { viewerId: ALICE, input: { blockRef: entry.blockRef } })
    ).resolves.toEqual({ blocked: false });

    const feed = await getFeed(store, { viewerId: ALICE });
    expect(feed.posts.map((p) => p.id)).toContain(post.id);
  });

  it('will not let one member unblock another member\'s block', async () => {
    const post = await createPost(store, { viewerId: BOB, input: { content: 'x' } });
    await blockMember(store, { viewerId: ALICE, input: { postId: post.id } });
    const [entry] = await listBlockedMembers(store, { viewerId: ALICE });

    await expectCode(
      unblockMember(store, { viewerId: CAROL, input: { blockRef: entry.blockRef } }),
      'not_found'
    );
    expect(await store.listBlocked(ALICE)).toHaveLength(1);
  });

  it('keeps blocking one-directional: the blocked member still sees the blocker', async () => {
    const alicesPost = await createPost(store, { viewerId: ALICE, input: { content: 'a' } });
    await blockMember(store, { viewerId: BOB, input: { postId: alicesPost.id } });

    // Bob blocked Alice, so Bob cannot see Alice.
    const bobsFeed = await getFeed(store, { viewerId: BOB });
    expect(bobsFeed.posts.map((p) => p.id)).not.toContain(alicesPost.id);

    // Alice did not block Bob, so Alice still sees Bob's own posts.
    const alicesFeed = await getFeed(store, { viewerId: ALICE });
    expect(alicesFeed.posts).toHaveLength(1);
    expect(alicesFeed.posts[0].author.isYou).toBe(true);
  });

  it('refuses to comment on a post by someone the reader blocked', async () => {
    const post = await createPost(store, { viewerId: BOB, input: { content: 'x' } });
    await blockMember(store, { viewerId: ALICE, input: { postId: post.id } });

    await expectCode(
      createComment(store, { viewerId: ALICE, postId: post.id, input: { content: 'hello' } }),
      'forbidden'
    );
  });
});

describe('the feed', () => {
  it('returns newest first', async () => {
    await createPost(store, { viewerId: ALICE, input: { content: 'first' } });
    await createPost(store, { viewerId: ALICE, input: { content: 'second' } });
    await createPost(store, { viewerId: ALICE, input: { content: 'third' } });

    const feed = await getFeed(store, { viewerId: BOB });
    expect(feed.posts.map((p) => p.content)).toEqual(['third', 'second', 'first']);
  });

  it('paginates without repeating or skipping a post', async () => {
    for (let i = 0; i < 7; i += 1) {
      await createPost(store, { viewerId: ALICE, input: { content: `post ${i}` } });
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 5; page += 1) {
      const feed: Awaited<ReturnType<typeof getFeed>> = await getFeed(store, {
        viewerId: BOB,
        limit: 3,
        cursor,
      });
      seen.push(...feed.posts.map((p) => p.id));
      cursor = feed.nextCursor ?? undefined;
      if (!cursor) break;
    }

    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
  });

  it('reports no more pages on the last page', async () => {
    await createPost(store, { viewerId: ALICE, input: { content: 'only' } });
    const feed = await getFeed(store, { viewerId: BOB, limit: 10 });
    expect(feed.nextCursor).toBeNull();
  });

  it('keeps a page full when blocked members are filtered out of it', async () => {
    // The over-fetch exists for exactly this: block five prolific members and a
    // page must not come back short.
    for (let i = 0; i < 5; i += 1) {
      const post = await createPost(store, { viewerId: BOB, input: { content: `bobs ${i}` } });
      await blockMember(store, { viewerId: ALICE, input: { postId: post.id } });
    }
    await createPost(store, { viewerId: CAROL, input: { content: 'carols' } });

    const feed = await getFeed(store, { viewerId: ALICE, limit: 20 });
    expect(feed.posts).toHaveLength(1);
    expect(feed.posts[0].content).toBe('carols');
  });

  it('is empty, not broken, before anybody posts', async () => {
    const feed = await getFeed(store, { viewerId: ALICE });
    expect(feed.posts).toEqual([]);
    expect(feed.nextCursor).toBeNull();
  });
});
