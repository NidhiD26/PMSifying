'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { ReportReason } from '@/types/secretchat';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { REPORT_REASONS } from '@/types/secretchat';
import { MAX_REPORT_DETAILS_CHARS } from '@/lib/secretchat/validation';
import { useErrorMessage } from '@/features/secretchat/error-message';

/**
 * Filing a report.
 *
 * The reason list is a radio group, not a select, so a screen reader announces the
 * options as a set and arrow keys move between them. "Other" reveals a free-text
 * field, and that field is required only when "other" is chosen â€” the same rule the
 * server enforces, so a member is never told they were wrong about their own form.
 *
 * What the dialog says about anonymity is deliberate and specific: the reported
 * member is not told who reported them. A report that quietly carried that
 * consequence would feel like it was hiding something.
 */
export const ReportDialog: React.FC<{
  isOpen: boolean;
  authorLabel: string;
  onClose: () => void;
  onSubmit: (reason: ReportReason, details?: string) => Promise<boolean>;
}> = ({ isOpen, authorLabel, onClose, onSubmit }) => {
  const t = useTranslations('secretChat');
  const tCommon = useTranslations('common');
  const errorFor = useErrorMessage();

  const [reason, setReason] = React.useState<ReportReason>('harassment');
  const [details, setDetails] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const groupName = React.useId();
  const detailsId = React.useId();

  React.useEffect(() => {
    if (!isOpen) {
      setReason('harassment');
      setDetails('');
      setError(null);
    }
  }, [isOpen]);

  const needsDetails = reason === 'other';
  const canSubmit = !pending && (!needsDetails || details.trim().length > 0);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setPending(true);
    setError(null);
    const ok = await onSubmit(reason, needsDetails ? details.trim() : undefined);
    setPending(false);
    if (ok) {
      onClose();
      return;
    }
    setError('unknown');
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('report.title')}
      closeLabel={tCommon('close')}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <p className="text-sm leading-relaxed text-[#5A5A66]">
          {t('report.intro', { author: authorLabel })}
        </p>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-[#2D1B2D]">{t('report.reasonLabel')}</legend>
          {REPORT_REASONS.map((option) => {
            const id = `${groupName}-${option}`;
            return (
              <div key={option} className="flex items-start gap-2">
                <input
                  type="radio"
                  id={id}
                  name={`${groupName}-reason`}
                  value={option}
                  checked={reason === option}
                  onChange={() => setReason(option)}
                  className="mt-1 h-4 w-4 accent-[#2D1B2D]"
                />
                <label htmlFor={id} className="text-sm text-[#1E1E24]">
                  {t(`report.reasons.${option}`)}
                </label>
              </div>
            );
          })}
        </fieldset>

        {needsDetails && (
          <div className="space-y-1">
            <label htmlFor={detailsId} className="text-sm font-semibold text-[#2D1B2D]">
              {t('report.detailsLabel')}
            </label>
            <textarea
              id={detailsId}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={3}
              maxLength={MAX_REPORT_DETAILS_CHARS}
              required
              aria-describedby={`${detailsId}-hint`}
              className="w-full resize-y rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] p-3 text-sm text-[#1E1E24] focus:border-[#2D1B2D] focus:outline-none focus:ring-2 focus:ring-[#2D1B2D]/20"
            />
            <p id={`${detailsId}-hint`} className="text-xs text-[#5A5A66]">
              {t('report.detailsHint', { count: MAX_REPORT_DETAILS_CHARS })}
            </p>
          </div>
        )}

        <p className="rounded-lg bg-[#F7F5F3] px-3 py-2 text-xs leading-relaxed text-[#5A5A66]">
          {t('report.anonymityNote')}
        </p>

        {error && (
          <p role="alert" className="text-sm text-[#C94A46]">
            {errorFor(error)}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={!canSubmit}>
            {pending ? tCommon('saving') : t('report.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
