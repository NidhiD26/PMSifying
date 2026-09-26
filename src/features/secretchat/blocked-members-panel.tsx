'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { UserMinus } from 'lucide-react';
import type { BlockedMember } from '@/types/secretchat';
import { Button } from '@/components/ui/button';
import { SecretChatApiError, secretChatApi } from '@/features/secretchat/api-client';
import { useErrorMessage } from '@/features/secretchat/error-message';
import { useToast } from '@/features/secretchat/use-toast';

/**
 * The reader's blocked members, and the way back.
 *
 * Blocking without any way to undo it is a trap, so this is a real list rather than
 * a one-way action. It loads on open instead of on mount, because most members
 * never open it and there is no reason to spend a request proving that.
 *
 * Unblocking is a `<details>` disclosure rather than a page or dialog: it is a short
 * list that a member visits deliberately, and a disclosure keeps it on the same
 * screen as the feed it affects.
 */
export const BlockedMembersPanel: React.FC = () => {
  const t = useTranslations('secretChat');
  const errorFor = useErrorMessage();
  const { pushToast } = useToast();

  const [members, setMembers] = React.useState<BlockedMember[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<string | null>(null);
  const summaryId = React.useId();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setMembers(await secretChatApi.blockedMembers());
    } catch (caught) {
      setError(caught instanceof SecretChatApiError ? caught.code : 'upstream_unavailable');
    } finally {
      setLoading(false);
    }
  };

  const unblock = async (member: BlockedMember) => {
    setRemoving(member.blockRef);
    try {
      await secretChatApi.unblock(member.blockRef);
      setMembers((current) => (current ?? []).filter((item) => item.blockRef !== member.blockRef));
      pushToast(t('toast.unblocked'), 'success');
    } catch (caught) {
      pushToast(
        errorFor(caught instanceof SecretChatApiError ? caught.code : 'upstream_unavailable'),
        'error'
      );
    } finally {
      setRemoving(null);
    }
  };

  return (
    <details
      className="rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] px-4 py-3"
      onToggle={(event) => {
        // Fetched on open: most members never open this, so there is no reason to
        // spend a request proving the list is empty.
        if (event.currentTarget.open && members === null) void load();
      }}
    >
      <summary
        id={summaryId}
        className="cursor-pointer text-sm font-semibold text-[#2D1B2D]"
        aria-describedby={summaryId}
      >
        {t('blocked.title')}
      </summary>

      <div className="mt-3 space-y-2">
        {loading && (
          <p role="status" aria-live="polite" className="text-sm text-[#5A5A66]">
            {t('blocked.loading')}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-[#C94A46]">
            {errorFor(error)}
          </p>
        )}

        {members !== null && !loading && members.length === 0 && (
          <p className="text-sm text-[#5A5A66]">{t('blocked.empty')}</p>
        )}

        {members !== null && members.length > 0 && (
          <ul className="space-y-2">
            {members.map((member) => (
              <li
                key={member.blockRef}
                className="flex items-center justify-between gap-3 text-sm text-[#1E1E24]"
              >
                <span>
                  {member.displayName ??
                    t('author.anonymous', { number: member.aliasNumber })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void unblock(member)}
                  disabled={removing === member.blockRef}
                >
                  <UserMinus className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  {t('blocked.unblock')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
};
