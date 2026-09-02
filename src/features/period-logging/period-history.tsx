'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Surface } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import type { CycleDomainModel, FlowLevel } from '@/types/health';
import { Edit2, Trash2, Calendar, AlertTriangle } from 'lucide-react';

export interface PeriodHistoryProps {
  cycles: CycleDomainModel[];
  onEdit: (cycle: CycleDomainModel) => void;
  onDelete: (id: number) => Promise<void>;
}

export const PeriodHistory: React.FC<PeriodHistoryProps> = ({ cycles, onEdit, onDelete }) => {
  const t = useTranslations('period');
  const tCommon = useTranslations('common');

  const [deleteTargetId, setDeleteTargetId] = React.useState<number | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const calculateDurationDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const flowBadgeMap: Record<FlowLevel, { variant: 'period' | 'fertile' | 'ovulation' | 'accent'; labelKey: string }> = {
    spotting: { variant: 'accent', labelKey: 'flowSpotting' },
    light: { variant: 'fertile', labelKey: 'flowLight' },
    medium: { variant: 'period', labelKey: 'flowMedium' },
    heavy: { variant: 'period', labelKey: 'flowHeavy' },
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await onDelete(deleteTargetId);
      setDeleteTargetId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {cycles.map((cycle) => {
        const duration = cycle.endDate ? calculateDurationDays(cycle.startDate, cycle.endDate) : null;
        const flowInfo = cycle.flow ? flowBadgeMap[cycle.flow] : null;

        return (
          <Surface key={cycle.id || cycle.startDate} variant="bordered" className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-[#C94A46]/10 flex items-center justify-center text-[#C94A46] shrink-0 mt-0.5">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-base text-[#1E1E24]">
                    {cycle.startDate} {cycle.endDate ? `— ${cycle.endDate}` : ''}
                  </span>
                  {cycle.endDate ? (
                    <span className="text-xs text-[#5A5A66] bg-[#F9EBEA] px-2 py-0.5 rounded-md font-medium">
                      {t('daysCount', { count: duration || 1 })}
                    </span>
                  ) : (
                    <Badge variant="period">{t('ongoing')}</Badge>
                  )}
                  {flowInfo && (
                    <Badge variant={flowInfo.variant}>
                      {t(flowInfo.labelKey)}
                    </Badge>
                  )}
                </div>

                {cycle.notes && (
                  <p className="text-xs text-[#5A5A66] italic line-clamp-2 mt-1">
                    &quot;{cycle.notes}&quot;
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(cycle)}
                aria-label={`${tCommon('edit')} period starting ${cycle.startDate}`}
              >
                <Edit2 className="h-4 w-4 mr-1.5" />
                {tCommon('edit')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-[#C94A46] hover:bg-[#C94A46]/10"
                onClick={() => cycle.id && setDeleteTargetId(cycle.id)}
                aria-label={`${tCommon('delete')} period starting ${cycle.startDate}`}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                {tCommon('delete')}
              </Button>
            </div>
          </Surface>
        );
      })}

      {/* Delete Confirmation Dialog */}
      <Modal
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        title={t('deleteConfirmTitle')}
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-[#C94A46]/10 border border-[#C94A46]/30 flex items-start gap-3 text-sm text-[#C94A46]">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>{t('deleteConfirmMessage')}</p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTargetId(null)}
              disabled={isDeleting}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? t('deleting') : t('deletePeriod')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
