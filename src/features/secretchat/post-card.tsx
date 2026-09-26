'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Flag, Heart, MessageCircle, MoreHorizontal, Trash2, UserMinus } from 'lucide-react';
import type { FeedPost } from '@/types/secretchat';
import { Surface } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { useAuthorLabel, useTimestamp } from '@/features/secretchat/author-label';
import { cn } from '@/lib/utils/cn';

/**
 * One post in the feed.
 *
 * A card presents content, so it is an `article` with its own heading and its
 * author and time in the accessible name of the region. That means a screen reader
 * user can list the feed and jump to "post by Anonymous User #4821" without
 * reading every post in order.
 *
 * The action row is a real toolbar of small buttons rather than icons alone, each
 * with a translated accessible name that includes the count, so "like, 4 people"
 * is announced instead of a bare heart.
 */
export const PostCard: React.FC<{
  post: FeedPost;
  onLike: (post: FeedPost) => void;
  onDelete: (post: FeedPost) => void;
  onReport: (post: FeedPost) => void;
  onBlock: (post: FeedPost) => void;
  onToggleComments: (post: FeedPost) => void;
  commentsOpen: boolean;
  children?: React.ReactNode;
}> = ({
  post,
  onLike,
  onDelete,
  onReport,
  onBlock,
  onToggleComments,
  commentsOpen,
  children,
}) => {
  const t = useTranslations('secretChat');
  const authorLabel = useAuthorLabel();
  const timestamp = useTimestamp();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuId = React.useId();
  const menuRef = React.useRef<HTMLDivElement>(null);

  // The overflow menu closes on an outside click or Escape, so it never traps a
  // member's attention behind a panel they cannot see how they opened.
  React.useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const author = authorLabel(post.author);
  const time = timestamp(post.createdAt);
  const headingId = `post-${post.id}-author`;

  return (
    <Surface variant="bordered" className="p-4 sm:p-5">
      <article aria-labelledby={headingId} className="space-y-3">
        <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 id={headingId} className="text-sm font-semibold text-[#2D1B2D]">
            {author}
          </h3>
          <time dateTime={post.createdAt} className="text-xs text-[#8A8A96]">
            {time}
          </time>
        </header>

        {post.isDeleted ? (
          <p className="rounded-lg bg-[#F7F5F3] px-3 py-2 text-sm italic text-[#8A8A96]">
            {t('deletedPost')}
          </p>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#1E1E24]">
            {post.content}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onLike(post)}
            aria-pressed={post.likedByYou}
            aria-label={t('actions.like', { count: post.likeCount })}
            className={cn(post.likedByYou && 'text-[#C94A46]')}
          >
            <Heart
              className={cn('h-4 w-4 mr-1.5', post.likedByYou && 'fill-current')}
              aria-hidden="true"
            />
            <span aria-hidden="true">{post.likeCount}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleComments(post)}
            aria-expanded={commentsOpen}
            aria-controls={commentsOpen ? `comments-${post.id}` : undefined}
            aria-label={t('actions.comments', { count: post.commentCount })}
          >
            <MessageCircle className="h-4 w-4 mr-1.5" aria-hidden="true" />
            <span aria-hidden="true">{post.commentCount}</span>
          </Button>

          <div className="relative ml-auto" ref={menuRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-haspopup="menu"
              aria-label={t('actions.more', { author })}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>

            {menuOpen && (
              <div
                id={menuId}
                role="menu"
                aria-label={t('actions.menuLabel', { author })}
                className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] p-1 shadow-lg"
              >
                {!post.author.isYou && (
                  <MenuItem
                    icon={<Flag className="h-4 w-4" aria-hidden="true" />}
                    label={t('actions.report')}
                    onClick={() => {
                      setMenuOpen(false);
                      onReport(post);
                    }}
                  />
                )}
                {!post.author.isYou && (
                  <MenuItem
                    icon={<UserMinus className="h-4 w-4" aria-hidden="true" />}
                    label={t('actions.block')}
                    onClick={() => {
                      setMenuOpen(false);
                      onBlock(post);
                    }}
                  />
                )}
                {post.canDelete && (
                  <MenuItem
                    icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                    label={t('actions.delete')}
                    destructive
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(post);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {commentsOpen && (
          <div id={`comments-${post.id}`} className="border-t border-[#E2D8D0] pt-3">
            {children}
          </div>
        )}
      </article>
    </Surface>
  );
};

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}> = ({ icon, label, onClick, destructive }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className={cn(
      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
      destructive ? 'text-[#C94A46] hover:bg-[#F9EBEA]' : 'text-[#1E1E24] hover:bg-[#F7F5F3]'
    )}
  >
    {icon}
    {label}
  </button>
);
