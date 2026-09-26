'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Heart, Send, Trash2 } from 'lucide-react';
import type { FeedComment } from '@/types/secretchat';
import { Button } from '@/components/ui/button';
import { useAuthorLabel, useTimestamp } from '@/features/secretchat/author-label';
import { useErrorMessage } from '@/features/secretchat/error-message';
import { LIMITS } from '@/lib/secretchat/service';
import { cn } from '@/lib/utils/cn';

/**
 * The replies under one post.
 *
 * Rendered inside the post card's own region, so the list is a `section` with a
 * heading naming the post rather than a floating panel. Replies are a list, so
 * `role="list"` with list items: a screen reader announces "list, 3 items" before
 * reading the threads, which is what makes a long discussion skimmable.
 *
 * A removed reply keeps its place with a short notice. Removing text from the
 * middle of a conversation makes the remaining replies look like they were
 * addressing each other when they were not.
 */
export const CommentThread: React.FC<{
  comments: FeedComment[];
  onLike: (comment: FeedComment) => void;
  onDelete: (comment: FeedComment) => void;
  onSubmit: (content: string) => Promise<boolean>;
  loading: boolean;
  headingLabel: string;
}> = ({ comments, onLike, onDelete, onSubmit, loading, headingLabel }) => {
  const t = useTranslations('secretChat');
  const tCommon = useTranslations('common');
  const authorLabel = useAuthorLabel();
  const timestamp = useTimestamp();
  const errorFor = useErrorMessage();

  const [content, setContent] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputId = React.useId();
  const listId = React.useId();

  const canSubmit = content.trim().length > 0 && !pending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setPending(true);
    setError(null);
    const ok = await onSubmit(content);
    setPending(false);
    if (ok) {
      setContent('');
      return;
    }
    setError('unknown');
  };

  return (
    <section aria-label={headingLabel} className="space-y-3">
      {loading ? (
        <p role="status" aria-live="polite" className="text-sm text-[#5A5A66]">
          {tCommon('loading')}
        </p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-[#5A5A66]">{t('comments.empty')}</p>
      ) : (
        <ul id={listId} className="space-y-3">
          {comments.map((comment) => {
            const author = authorLabel(comment.author);
            return (
              <li key={comment.id} className="rounded-xl bg-[#F9F7F5] p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <p className="text-xs font-semibold text-[#2D1B2D]">{author}</p>
                  <time dateTime={comment.createdAt} className="text-xs text-[#8A8A96]">
                    {timestamp(comment.createdAt)}
                  </time>
                </div>

                {comment.isDeleted ? (
                  <p className="mt-1 text-sm italic text-[#8A8A96]">{t('deletedComment')}</p>
                ) : (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#1E1E24]">
                    {comment.content}
                  </p>
                )}

                {!comment.isDeleted && (
                  <div className="mt-2 flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onLike(comment)}
                      aria-pressed={comment.likedByYou}
                      aria-label={t('actions.like', { count: comment.likeCount })}
                      className={cn(comment.likedByYou && 'text-[#C94A46]')}
                    >
                      <Heart
                        className={cn('h-4 w-4 mr-1.5', comment.likedByYou && 'fill-current')}
                        aria-hidden="true"
                      />
                      <span aria-hidden="true">{comment.likeCount}</span>
                    </Button>

                    {comment.canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(comment)}
                        aria-label={t('actions.deleteComment')}
                        className="text-[#C94A46]"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row" noValidate>
        <label htmlFor={inputId} className="sr-only">
          {t('comments.label')}
        </label>
        <input
          id={inputId}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={LIMITS.maxCommentChars}
          placeholder={t('comments.placeholder')}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="flex-1 rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] px-3 py-2 text-sm text-[#1E1E24] placeholder:text-[#8A8A96] focus:border-[#2D1B2D] focus:outline-none focus:ring-2 focus:ring-[#2D1B2D]/20"
        />
        <Button type="submit" size="sm" disabled={!canSubmit}>
          <Send className="h-4 w-4 mr-1.5" aria-hidden="true" />
          {t('comments.submit')}
        </Button>
      </form>

      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-sm text-[#C94A46]">
          {errorFor(error)}
        </p>
      )}
    </section>
  );
};
