'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, MessageSquare, ShieldCheck } from 'lucide-react';
import type { FeedComment, FeedPost, ReportReason, ReportTargetType } from '@/types/secretchat';
import { Surface } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/state';
import { Composer } from '@/features/secretchat/composer';
import { PostCard } from '@/features/secretchat/post-card';
import { CommentThread } from '@/features/secretchat/comment-thread';
import { ReportDialog } from '@/features/secretchat/report-dialog';
import { useAuthorLabel } from '@/features/secretchat/author-label';
import { SecretChatApiError, secretChatApi } from '@/features/secretchat/api-client';
import { useErrorMessage } from '@/features/secretchat/error-message';
import { useToast } from '@/features/secretchat/use-toast';

/**
 * The SecretChat feed.
 *
 * STATE SHAPE
 * The feed is a plain array plus a cursor, and every mutation updates that array
 * in place rather than refetching. A refetch would be simpler to write but would
 * move the page under a member who is reading, and would briefly blank replies
 * someone had already opened.
 *
 * WHY BLOCKING IS IMMEDIATE BUT NOT OPTIMISTIC
 * Blocking removes a person's posts from the reader's feed, which is the entire
 * point of doing it. The UI does not pretend it succeeded before the server
 * agrees, though: the post is removed once the request resolves, and a failure
 * leaves the feed untouched with a message. An optimistic removal that later had
 * to be undone would be worse than a short wait.
 *
 * WHY "LOAD MORE" RATHER THAN INFINITE SCROLL
 * Infinite scroll makes the end of a conversation unreachable and replaces it with
 * an endless column. A member reading about a difficult topic can stop, and knows
 * they have stopped.
 */
export const SecretChatFeed: React.FC = () => {
  const t = useTranslations('secretChat');
  const authorLabel = useAuthorLabel();
  const errorFor = useErrorMessage();
  const { pushToast } = useToast();

  const [posts, setPosts] = React.useState<FeedPost[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [openThreadFor, setOpenThreadFor] = React.useState<string | null>(null);
  const [comments, setComments] = React.useState<Record<string, FeedComment[]>>({});
  const [commentsLoading, setCommentsLoading] = React.useState(false);

  const [reportTarget, setReportTarget] = React.useState<{
    targetType: ReportTargetType;
    targetId: string;
    authorLabel: string;
  } | null>(null);

  const loaded = React.useRef(false);

  const loadFirstPage = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const page = await secretChatApi.feed();
      setPosts(page.posts);
      setCursor(page.nextCursor);
    } catch (error) {
      setLoadError(error instanceof SecretChatApiError ? error.code : 'upstream_unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // The ref guards against a second fetch in React's development double-effect,
    // which would otherwise issue the same request twice on every mount.
    if (loaded.current) return;
    loaded.current = true;
    void loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const page = await secretChatApi.feed({ cursor });
      setPosts((current) => [...current, ...page.posts]);
      setCursor(page.nextCursor);
    } catch (error) {
      setLoadError(error instanceof SecretChatApiError ? error.code : 'upstream_unavailable');
    } finally {
      setLoadingMore(false);
    }
  };

  const createPost = async (content: string): Promise<boolean> => {
    try {
      const created = await secretChatApi.createPost(content);
      setPosts((current) => [created, ...current]);
      return true;
    } catch (error) {
      pushToast(
        errorFor(error instanceof SecretChatApiError ? error.code : 'upstream_unavailable'),
        'error'
      );
      return false;
    }
  };

  const deletePost = async (post: FeedPost) => {
    try {
      await secretChatApi.deletePost(post.id);
      setPosts((current) => current.filter((item) => item.id !== post.id));
      pushToast(t('toast.postDeleted'), 'success');
    } catch (error) {
      pushToast(
        errorFor(error instanceof SecretChatApiError ? error.code : 'upstream_unavailable'),
        'error'
      );
    }
  };

  const toggleLike = async (post: FeedPost) => {
    const liked = !post.likedByYou;
    try {
      const result = await secretChatApi.like({
        targetType: 'post',
        targetId: post.id,
        liked,
      });
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? { ...item, likedByYou: liked, likeCount: result.likeCount }
            : item
        )
      );
    } catch (error) {
      pushToast(
        errorFor(error instanceof SecretChatApiError ? error.code : 'upstream_unavailable'),
        'error'
      );
    }
  };

  const blockPost = async (post: FeedPost) => {
    try {
      await secretChatApi.blockPost(post.id);
      // Everything by that author leaves the feed, not just the post that was used
      // to identify them, which is the behaviour a member expects from a block.
      setPosts((current) => current.filter((item) => item.author.aliasNumber !== post.author.aliasNumber));
      setComments({});
      setOpenThreadFor(null);
      pushToast(t('toast.blocked', { author: authorLabel(post.author) }), 'success');
    } catch (error) {
      pushToast(
        errorFor(error instanceof SecretChatApiError ? error.code : 'upstream_unavailable'),
        'error'
      );
    }
  };

  const openComments = async (post: FeedPost) => {
    if (openThreadFor === post.id) {
      setOpenThreadFor(null);
      return;
    }
    setOpenThreadFor(post.id);
    if (comments[post.id]) return;

    setCommentsLoading(true);
    try {
      const detail = await secretChatApi.post(post.id);
      setComments((current) => ({ ...current, [post.id]: detail.comments }));
    } catch (error) {
      pushToast(
        errorFor(error instanceof SecretChatApiError ? error.code : 'upstream_unavailable'),
        'error'
      );
    } finally {
      setCommentsLoading(false);
    }
  };

  const createComment = (post: FeedPost) => async (content: string): Promise<boolean> => {
    try {
      const created = await secretChatApi.createComment(post.id, content);
      setComments((current) => ({ ...current, [post.id]: [...(current[post.id] ?? []), created] }));
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id ? { ...item, commentCount: item.commentCount + 1 } : item
        )
      );
      return true;
    } catch (error) {
      pushToast(
        errorFor(error instanceof SecretChatApiError ? error.code : 'upstream_unavailable'),
        'error'
      );
      return false;
    }
  };

  const toggleCommentLike = async (postId: string, comment: FeedComment) => {
    const liked = !comment.likedByYou;
    try {
      const result = await secretChatApi.like({
        targetType: 'comment',
        targetId: comment.id,
        liked,
      });
      setComments((current) => ({
        ...current,
        [postId]: (current[postId] ?? []).map((item) =>
          item.id === comment.id
            ? { ...item, likedByYou: liked, likeCount: result.likeCount }
            : item
        ),
      }));
    } catch (error) {
      pushToast(
        errorFor(error instanceof SecretChatApiError ? error.code : 'upstream_unavailable'),
        'error'
      );
    }
  };

  const deleteComment = async (postId: string, comment: FeedComment) => {
    try {
      await secretChatApi.deleteComment(comment.id);
      setComments((current) => ({
        ...current,
        [postId]: (current[postId] ?? []).map((item) =>
          item.id === comment.id
            ? { ...item, isDeleted: true, content: '', canDelete: false }
            : item
        ),
      }));
    } catch (error) {
      pushToast(
        errorFor(error instanceof SecretChatApiError ? error.code : 'upstream_unavailable'),
        'error'
      );
    }
  };

  const submitReport = async (reason: ReportReason, details?: string): Promise<boolean> => {
    if (!reportTarget) return false;
    try {
      await secretChatApi.report({
        targetType: reportTarget.targetType,
        targetId: reportTarget.targetId,
        reason,
        details,
      });
      pushToast(t('toast.reported'), 'success');
      return true;
    } catch (error) {
      pushToast(
        errorFor(error instanceof SecretChatApiError ? error.code : 'upstream_unavailable'),
        'error'
      );
      return false;
    }
  };

  return (
    <div className="space-y-5">
      <ToastRegion />

      <Surface variant="bordered" className="space-y-3">
        <h2 className="text-sm font-semibold text-[#2D1B2D]">{t('composer.heading')}</h2>
        <p className="text-xs leading-relaxed text-[#5A5A66]">{t('privacy.note')}</p>
        <Composer onSubmit={createPost} disabled={loading} />
      </Surface>

      {loading ? (
        <div role="status" aria-live="polite" className="py-10 text-center text-sm text-[#5A5A66]">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden="true" />
          {t('feed.loading')}
        </div>
      ) : loadError && posts.length === 0 ? (
        <ErrorState message={errorFor(loadError)} onRetry={() => void loadFirstPage()} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-6 w-6" />}
          title={t('feed.emptyTitle')}
          description={t('feed.emptyBody')}
        />
      ) : (
        <>
          <ul className="space-y-4">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard
                  post={post}
                  onLike={(item) => void toggleLike(item)}
                  onDelete={(item) => void deletePost(item)}
                  onReport={(item) =>
                    setReportTarget({
                      targetType: 'post',
                      targetId: item.id,
                      authorLabel: authorLabel(item.author),
                    })
                  }
                  onBlock={(item) => void blockPost(item)}
                  onToggleComments={(item) => void openComments(item)}
                  commentsOpen={openThreadFor === post.id}
                >
                  <CommentThread
                    comments={comments[post.id] ?? []}
                    loading={commentsLoading}
                    headingLabel={t('comments.heading', { author: authorLabel(post.author) })}
                    onLike={(comment) => void toggleCommentLike(post.id, comment)}
                    onDelete={(comment) => void deleteComment(post.id, comment)}
                    onSubmit={createComment(post)}
                  />
                </PostCard>
              </li>
            ))}
          </ul>

          {loadError && (
            <ErrorState message={errorFor(loadError)} onRetry={() => void loadMore()} />
          )}

          {cursor && (
            <div className="flex justify-center pt-1">
              <Button
                variant="outline"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? t('feed.loadingMore') : t('feed.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}

      <ReportDialog
        isOpen={reportTarget !== null}
        authorLabel={reportTarget?.authorLabel ?? ''}
        onClose={() => setReportTarget(null)}
        onSubmit={submitReport}
      />
    </div>
  );
};

/**
 * Where transient confirmations appear.
 *
 * Modelled as a polite live region rather than a modal, because a confirmation is
 * not something a member needs to dismiss before continuing to read. Errors are
 * assertive so they interrupt, which is right for a failure and wrong for "post
 * deleted".
 */
const ToastRegion: React.FC = () => {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div className="space-y-2" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <Surface
          key={toast.id}
          variant="bordered"
          className={`flex items-start gap-2 p-3 text-sm ${
            toast.kind === 'error'
              ? 'border-[#C94A46]/30 bg-[#C94A46]/10 text-[#C94A46]'
              : 'border-[#2E8B57]/30 bg-[#2E8B57]/10 text-[#2E8B57]'
          }`}
        >
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="flex-1 leading-relaxed">{toast.message}</p>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            className="text-xs underline underline-offset-2"
          >
            {toast.dismissLabel}
          </button>
        </Surface>
      ))}
    </div>
  );
};
