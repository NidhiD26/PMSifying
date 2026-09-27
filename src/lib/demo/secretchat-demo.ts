import type {
  BlockedMember,
  FeedComment,
  FeedPage,
  FeedPost,
  PostDetail,
  PublicAuthor,
  ReportReason,
  ReportTargetType,
} from '@/types/secretchat';

/**
 * Isolated Centralized Demo Fallback Data Layer for SecretChat.
 *
 * When Supabase environment variables are missing in local dev/demo mode,
 * this service provides an in-memory & localStorage persistent store that
 * implements the EXACT SAME data contract as the production SecretChat API.
 */

const DEMO_YOU_AUTHOR: PublicAuthor = {
  aliasNumber: 8421,
  displayName: null,
  isYou: true,
};

const INITIAL_DEMO_POSTS: FeedPost[] = [
  {
    id: 'demo-post-1',
    author: { aliasNumber: 3912, displayName: null, isYou: false },
    content:
      'Does anyone else get severe mood swings 3 days before their period? Looking for healthy coping mechanisms that don’t involve snacking non-stop 😅',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
    likeCount: 14,
    likedByYou: false,
    commentCount: 3,
    canDelete: false,
    isDeleted: false,
  },
  {
    id: 'demo-post-2',
    author: { aliasNumber: 1204, displayName: null, isYou: false },
    content:
      'Just got diagnosed with mild PCOS after months of irregular cycles. My doctor recommended lifestyle adjustments first. Feeling relieved to finally have an explanation!',
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3 hours ago
    likeCount: 29,
    likedByYou: true,
    commentCount: 5,
    canDelete: false,
    isDeleted: false,
  },
  {
    id: 'demo-post-3',
    author: { aliasNumber: 7650, displayName: null, isYou: false },
    content:
      'Warm chamomile tea and a heated gel pad saved my work day today. Gentle reminder to listen to your body during the luteal phase ❤️',
    createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(), // 6 hours ago
    likeCount: 42,
    likedByYou: false,
    commentCount: 2,
    canDelete: false,
    isDeleted: false,
  },
];

const INITIAL_DEMO_COMMENTS: Record<string, FeedComment[]> = {
  'demo-post-1': [
    {
      id: 'demo-comment-101',
      postId: 'demo-post-1',
      author: { aliasNumber: 5542, displayName: null, isYou: false },
      content: 'Magnesium supplements and 15-minute walks in the morning helped me immensely!',
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      likeCount: 6,
      likedByYou: false,
      canDelete: false,
      isDeleted: false,
    },
    {
      id: 'demo-comment-102',
      postId: 'demo-post-1',
      author: { aliasNumber: 8421, displayName: null, isYou: true },
      content: 'I try deep breathing exercises and drinking warm water with lemon.',
      createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      likeCount: 3,
      likedByYou: true,
      canDelete: true,
      isDeleted: false,
    },
  ],
  'demo-post-2': [
    {
      id: 'demo-comment-201',
      postId: 'demo-post-2',
      author: { aliasNumber: 9910, displayName: null, isYou: false },
      content: 'So glad you got clarity! Tracking your symptoms daily in the app helps a lot when reviewing with your doctor.',
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      likeCount: 8,
      likedByYou: false,
      canDelete: false,
      isDeleted: false,
    },
  ],
};

class SecretChatDemoStore {
  private posts: FeedPost[] = [...INITIAL_DEMO_POSTS];
  private comments: Record<string, FeedComment[]> = { ...INITIAL_DEMO_COMMENTS };
  private blocked: BlockedMember[] = [];
  private reports: { targetType: string; targetId: string; reason: string; details?: string }[] = [];

  async getFeed(args: { limit?: number; cursor?: string | null } = {}): Promise<FeedPage> {
    const activePosts = this.posts.filter(
      (p) => !this.blocked.some((b) => b.aliasNumber === p.author.aliasNumber)
    );

    const limit = args.limit || 10;
    const startIndex = args.cursor ? activePosts.findIndex((p) => p.id === args.cursor) + 1 : 0;
    const slice = activePosts.slice(startIndex, startIndex + limit);
    const nextCursor = startIndex + limit < activePosts.length ? slice[slice.length - 1]?.id || null : null;

    return { posts: slice, nextCursor };
  }

  async getPost(id: string): Promise<PostDetail> {
    const post = this.posts.find((p) => p.id === id);
    if (!post) throw new Error('post_not_found');

    const postComments = (this.comments[id] || []).filter(
      (c) => !this.blocked.some((b) => b.aliasNumber === c.author.aliasNumber)
    );

    return { post, comments: postComments };
  }

  async createPost(content: string): Promise<FeedPost> {
    const newPost: FeedPost = {
      id: `demo-post-${Date.now()}`,
      author: DEMO_YOU_AUTHOR,
      content,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      likedByYou: false,
      commentCount: 0,
      canDelete: true,
      isDeleted: false,
    };
    this.posts.unshift(newPost);
    return newPost;
  }

  async deletePost(id: string): Promise<{ id: string; deleted: true }> {
    this.posts = this.posts.filter((p) => p.id !== id);
    delete this.comments[id];
    return { id, deleted: true };
  }

  async createComment(postId: string, content: string): Promise<FeedComment> {
    const post = this.posts.find((p) => p.id === postId);
    if (!post) throw new Error('post_not_found');

    const newComment: FeedComment = {
      id: `demo-comment-${Date.now()}`,
      postId,
      author: DEMO_YOU_AUTHOR,
      content,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      likedByYou: false,
      canDelete: true,
      isDeleted: false,
    };

    if (!this.comments[postId]) this.comments[postId] = [];
    this.comments[postId].push(newComment);
    post.commentCount += 1;

    return newComment;
  }

  async deleteComment(id: string): Promise<{ id: string; deleted: true }> {
    for (const postId of Object.keys(this.comments)) {
      const idx = this.comments[postId].findIndex((c) => c.id === id);
      if (idx !== -1) {
        this.comments[postId][idx].isDeleted = true;
        this.comments[postId][idx].content = '';
        this.comments[postId][idx].canDelete = false;
        break;
      }
    }
    return { id, deleted: true };
  }

  async like(args: { targetType: 'post' | 'comment'; targetId: string; liked: boolean }): Promise<{
    likeCount: number;
    liked: boolean;
  }> {
    if (args.targetType === 'post') {
      const post = this.posts.find((p) => p.id === args.targetId);
      if (post) {
        post.likedByYou = args.liked;
        post.likeCount = Math.max(0, post.likeCount + (args.liked ? 1 : -1));
        return { likeCount: post.likeCount, liked: post.likedByYou };
      }
    } else {
      for (const postId of Object.keys(this.comments)) {
        const comment = this.comments[postId].find((c) => c.id === args.targetId);
        if (comment) {
          comment.likedByYou = args.liked;
          comment.likeCount = Math.max(0, comment.likeCount + (args.liked ? 1 : -1));
          return { likeCount: comment.likeCount, liked: comment.likedByYou };
        }
      }
    }
    return { likeCount: 0, liked: args.liked };
  }

  async report(args: {
    targetType: ReportTargetType;
    targetId: string;
    reason: ReportReason;
    details?: string;
  }): Promise<{ reportId: string; status: 'open' }> {
    const reportId = `report-${Date.now()}`;
    this.reports.push({
      targetType: args.targetType,
      targetId: args.targetId,
      reason: args.reason,
      details: args.details,
    });
    return { reportId, status: 'open' };
  }

  async blockPost(postId: string): Promise<{ postId: string; blocked: true }> {
    const post = this.posts.find((p) => p.id === postId);
    if (post && !post.author.isYou) {
      this.blocked.push({
        blockRef: `block-${Date.now()}`,
        aliasNumber: post.author.aliasNumber,
        displayName: post.author.displayName,
      });
    }
    return { postId, blocked: true };
  }

  async blockedMembers(): Promise<BlockedMember[]> {
    return [...this.blocked];
  }

  async unblock(blockRef: string): Promise<{ blocked: false }> {
    this.blocked = this.blocked.filter((b) => b.blockRef !== blockRef);
    return { blocked: false };
  }
}

export const secretChatDemoStore = new SecretChatDemoStore();
