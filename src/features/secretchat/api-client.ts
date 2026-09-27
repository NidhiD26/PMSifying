import type {
  BlockedMember,
  FeedComment,
  FeedPage,
  FeedPost,
  PostDetail,
  ReportReason,
  SecretChatErrorCode,
} from '@/types/secretchat';

/**
 * The one place the browser talks to the SecretChat API.
 *
 * WHY THE ERROR IS AN EXCEPTION
 * Every call here either succeeds or throws, and a throw carries a machine
 * readable `code`. Components then branch on the code instead of inspecting a
 * status number, and a failed call cannot be mistaken for an empty result — the
 * difference between "nobody has posted yet" and "the database is unreachable".
 *
 * Every response is checked, including on success. A proxy that returns an HTML
 * error page with a 200 is a real failure mode, and trusting `res.ok` alone would
 * turn it into a render crash.
 */

export class SecretChatApiError extends Error {
  readonly code: SecretChatErrorCode;
  readonly fields: string[];

  constructor(code: SecretChatErrorCode, fields: string[] = []) {
    super(code);
    this.name = 'SecretChatApiError';
    this.code = code;
    this.fields = fields;
  }
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  code?: SecretChatErrorCode;
  fields?: string[];
}

async function request<T>(
  url: string,
  init?: RequestInit,
  demoFallback?: () => Promise<T>
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    let payload: Envelope<T> | null = null;
    try {
      payload = (await response.json()) as Envelope<T>;
    } catch {
      if (demoFallback) return await demoFallback();
      throw new SecretChatApiError('upstream_unavailable');
    }

    if (!response.ok || !payload?.ok) {
      const code = payload?.code ?? 'upstream_unavailable';
      if ((code === 'not_configured' || code === 'unauthenticated') && demoFallback) {
        return await demoFallback();
      }
      throw new SecretChatApiError(code, payload?.fields ?? []);
    }
    if (payload.data === undefined) {
      if (demoFallback) return await demoFallback();
      throw new SecretChatApiError('upstream_unavailable');
    }
    return payload.data;
  } catch (err) {
    if (err instanceof SecretChatApiError && (err.code === 'not_configured' || err.code === 'unauthenticated') && demoFallback) {
      return await demoFallback();
    }
    if (demoFallback && !(err instanceof SecretChatApiError)) {
      return await demoFallback();
    }
    throw err;
  }
}

export const secretChatApi = {
  async feed(args: { limit?: number; cursor?: string | null } = {}): Promise<FeedPage> {
    const params = new URLSearchParams();
    if (args.limit) params.set('limit', String(args.limit));
    if (args.cursor) params.set('cursor', args.cursor);
    const query = params.toString();
    const { secretChatDemoStore } = await import('@/lib/demo/secretchat-demo');
    return request<FeedPage>(
      `/api/secretchat/feed${query ? `?${query}` : ''}`,
      undefined,
      () => secretChatDemoStore.getFeed(args)
    );
  },

  async post(id: string): Promise<PostDetail> {
    const { secretChatDemoStore } = await import('@/lib/demo/secretchat-demo');
    return request<PostDetail>(
      `/api/secretchat/posts/${id}`,
      undefined,
      () => secretChatDemoStore.getPost(id)
    );
  },

  async createPost(content: string): Promise<FeedPost> {
    const { secretChatDemoStore } = await import('@/lib/demo/secretchat-demo');
    return request<FeedPost>(
      '/api/secretchat/posts',
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      },
      () => secretChatDemoStore.createPost(content)
    );
  },

  async deletePost(id: string): Promise<{ id: string; deleted: true }> {
    const { secretChatDemoStore } = await import('@/lib/demo/secretchat-demo');
    return request<{ id: string; deleted: true }>(
      `/api/secretchat/posts/${id}`,
      { method: 'DELETE' },
      () => secretChatDemoStore.deletePost(id)
    );
  },

  async createComment(postId: string, content: string): Promise<FeedComment> {
    const { secretChatDemoStore } = await import('@/lib/demo/secretchat-demo');
    return request<FeedComment>(
      `/api/secretchat/posts/${postId}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      },
      () => secretChatDemoStore.createComment(postId, content)
    );
  },

  async deleteComment(id: string): Promise<{ id: string; deleted: true }> {
    const { secretChatDemoStore } = await import('@/lib/demo/secretchat-demo');
    return request<{ id: string; deleted: true }>(
      `/api/secretchat/comments/${id}`,
      { method: 'DELETE' },
      () => secretChatDemoStore.deleteComment(id)
    );
  },

  async like(args: { targetType: 'post' | 'comment'; targetId: string; liked: boolean }): Promise<{
    likeCount: number;
    liked: boolean;
  }> {
    const { secretChatDemoStore } = await import('@/lib/demo/secretchat-demo');
    return request(
      '/api/secretchat/likes',
      {
        method: args.liked ? 'POST' : 'DELETE',
        body: JSON.stringify(args),
      },
      () => secretChatDemoStore.like(args)
    );
  },

  async report(args: {
    targetType: 'post' | 'comment';
    targetId: string;
    reason: ReportReason;
    details?: string;
  }): Promise<{ reportId: string; status: 'open' }> {
    const { secretChatDemoStore } = await import('@/lib/demo/secretchat-demo');
    return request(
      '/api/secretchat/reports',
      { method: 'POST', body: JSON.stringify(args) },
      () => secretChatDemoStore.report(args)
    );
  },

  async blockedMembers(): Promise<BlockedMember[]> {
    const { secretChatDemoStore } = await import('@/lib/demo/secretchat-demo');
    return request<BlockedMember[]>(
      '/api/secretchat/blocks',
      undefined,
      () => secretChatDemoStore.blockedMembers()
    );
  },

  async blockPost(postId: string): Promise<{ postId: string; blocked: true }> {
    const { secretChatDemoStore } = await import('@/lib/demo/secretchat-demo');
    return request(
      '/api/secretchat/blocks',
      {
        method: 'POST',
        body: JSON.stringify({ postId }),
      },
      () => secretChatDemoStore.blockPost(postId)
    );
  },

  async unblock(blockRef: string): Promise<{ blocked: false }> {
    const { secretChatDemoStore } = await import('@/lib/demo/secretchat-demo');
    return request(
      '/api/secretchat/blocks',
      {
        method: 'DELETE',
        body: JSON.stringify({ blockRef }),
      },
      () => secretChatDemoStore.unblock(blockRef)
    );
  },
};
