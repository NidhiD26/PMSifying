'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LIMITS } from '@/lib/secretchat/service';
import { useErrorMessage } from '@/features/secretchat/error-message';

/**
 * The post composer.
 *
 * A visible character counter rather than a silent cap, because a member who hits
 * the limit should be able to see what happened instead of discovering their post
 * was truncated. The counter is advisory and counts code points rather than UTF-16
 * units, so a character outside the basic plane counts as the one character a
 * reader would count it as.
 *
 * Submitting is blocked while a request is in flight, and the textarea keeps focus
 * so a member can write the next post without reaching for the mouse.
 */
export const Composer: React.FC<{
  onSubmit: (content: string) => Promise<boolean>;
  disabled?: boolean;
}> = ({ onSubmit, disabled }) => {
  const t = useTranslations('secretChat');
  const tCommon = useTranslations('common');
  const errorFor = useErrorMessage();

  const [content, setContent] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<{ kind: 'error'; code: string } | null>(null);
  const textareaId = React.useId();

  const length = [...content].length;
  const remaining = LIMITS.maxPostChars - length;
  const canSubmit = content.trim().length > 0 && remaining >= 0 && !pending && !disabled;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setPending(true);
    setMessage(null);
    const ok = await onSubmit(content);
    setPending(false);

    if (ok) {
      setContent('');
      return;
    }
    setMessage({ kind: 'error', code: 'unknown' });
  };

  const overLimit = remaining < 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <label htmlFor={textareaId} className="sr-only">
        {t('composer.label')}
      </label>
      <textarea
        id={textareaId}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          // Enter alone posts; Shift+Enter is a newline. Keyboard-only members get
          // the same affordance as everyone else rather than hunting for a button.
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void handleSubmit(event);
          }
        }}
        rows={3}
        maxLength={LIMITS.maxPostChars + 200}
        placeholder={t('composer.placeholder')}
        aria-describedby={message ? `${textareaId}-status` : `${textareaId}-count`}
        aria-invalid={overLimit || undefined}
        className="w-full resize-y rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] p-3 text-sm text-[#1E1E24] placeholder:text-[#8A8A96] focus:border-[#2D1B2D] focus:outline-none focus:ring-2 focus:ring-[#2D1B2D]/20"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          id={`${textareaId}-count`}
          className={`text-xs ${overLimit ? 'text-[#C94A46]' : 'text-[#5A5A66]'}`}
          aria-live="polite"
        >
          {overLimit
            ? t('composer.tooLong', { count: Math.abs(remaining) })
            : t('composer.remaining', { count: remaining })}
        </p>

        <Button type="submit" disabled={!canSubmit} size="sm">
          <Send className="h-4 w-4 mr-1.5" aria-hidden="true" />
          {pending ? tCommon('saving') : t('composer.submit')}
        </Button>
      </div>

      {message && (
        <p id={`${textareaId}-status`} role="alert" className="text-sm text-[#C94A46]">
          {errorFor(message.code)}
        </p>
      )}
    </form>
  );
};
