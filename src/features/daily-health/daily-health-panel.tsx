'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { DailyLogRepository } from '@/lib/db/repositories/daily-log-repository';
import type { DailyLogDomainModel } from '@/types/health';
import { todayIso, isValidIsoDate } from '@/lib/health/date-utils';
import { Surface } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { DailyHealthForm, type DailyHealthFieldErrors } from './daily-health-form';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { ShieldCheck, Plus, AlertTriangle, CheckCircle2, ClipboardList, CalendarDays } from 'lucide-react';

export interface DailyHealthPanelProps {
  initialDate?: string;
}

const MAX_SLEEP_HOURS = 24;
const MAX_HYDRATION_ML = 10000;

/**
 * Reads a `?date=YYYY-MM-DD` deep link.
 *
 * The calendar links a specific day to this screen, so the date arrives in the
 * URL. Reading it from `location.search` keeps this component independent of
 * the router, so it can be rendered on its own.
 */
function readDateFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const requested = new URLSearchParams(window.location.search).get('date');
  if (requested && isValidIsoDate(requested) && requested <= todayIso()) {
    return requested;
  }
  return null;
}

export const DailyHealthPanel: React.FC<DailyHealthPanelProps> = ({ initialDate }) => {
  const t = useTranslations('dailyHealth');
  const tCommon = useTranslations('common');

  const validInitial = initialDate && isValidIsoDate(initialDate) ? initialDate : todayIso();

  const [selectedDate, setSelectedDate] = React.useState<string>(validInitial);
  const [existingLog, setExistingLog] = React.useState<DailyLogDomainModel | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<DailyHealthFieldErrors>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const loadLog = React.useCallback(
    async (date: string, options?: { keepSuccessMessage?: boolean }) => {
      setIsLoading(true);
      setLoadError(null);
      if (!options?.keepSuccessMessage) setSuccessMsg(null);
      setIsCreating(false);
      try {
        const log = await DailyLogRepository.getDailyLogByDate(date);
        setExistingLog(log ?? null);
      } catch {
        setLoadError(t('loadFailed'));
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  // Honour a ?date= deep link from the calendar on first render.
  React.useEffect(() => {
    const requested = readDateFromUrl();
    if (requested) setSelectedDate(requested);
  }, []);

  React.useEffect(() => {
    loadLog(selectedDate);
  }, [selectedDate, loadLog]);

  const handleDateChange = (date: string) => {
    if (!isValidIsoDate(date)) return;
    setSelectedDate(date);
    setSaveError(null);
    setFieldErrors({});
  };

  const handleStartCreate = () => {
    setSaveError(null);
    setFieldErrors({});
    setIsCreating(true);
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setSaveError(null);
    setFieldErrors({});
  };

  const handleSave = async (values: {
    date: string;
    symptoms: { id: string }[];
    mood: { id: string }[];
    painLevel: number;
    sleepHours: string;
    hydrationMl: string;
    notes: string;
  }) => {
    setSaveError(null);
    setSuccessMsg(null);
    setFieldErrors({});

    const sleepNumber = values.sleepHours === '' ? 0 : Number(values.sleepHours);
    const hydrationNumber = values.hydrationMl === '' ? 0 : Number(values.hydrationMl);

    if (Number.isNaN(sleepNumber) || sleepNumber < 0 || sleepNumber > MAX_SLEEP_HOURS) {
      setFieldErrors({ sleep: t('validation.invalidSleep') });
      return;
    }
    if (
      Number.isNaN(hydrationNumber) ||
      hydrationNumber < 0 ||
      hydrationNumber > MAX_HYDRATION_ML
    ) {
      setFieldErrors({ hydration: t('validation.invalidHydration') });
      return;
    }
    if (!isValidIsoDate(values.date)) {
      setSaveError(t('validation.invalidDate'));
      return;
    }
    if (values.date > todayIso()) {
      setSaveError(t('validation.futureDateDisallowed'));
      return;
    }

    setIsSaving(true);
    try {
      await DailyLogRepository.upsertDailyLog({
        date: values.date,
        symptoms: values.symptoms,
        mood: values.mood,
        painLevel: values.painLevel,
        sleepHours: sleepNumber,
        hydrationMl: hydrationNumber,
        notes: values.notes || undefined,
      });

      setSuccessMsg(t('saveSuccess'));
      await loadLog(values.date, { keepSuccessMessage: true });
    } catch {
      setSaveError(t('saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await DailyLogRepository.deleteDailyLogByDate(selectedDate);
      setExistingLog(null);
      setIsCreating(false);
      setSuccessMsg(t('deleteSuccess'));
      setIsDeleteConfirmOpen(false);
    } catch {
      setSaveError(t('saveFailed'));
      setIsDeleteConfirmOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const isToday = selectedDate === todayIso();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* The single place the day is chosen. */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2D1B2D]">{t('title')}</h1>
          <p className="mt-1 text-sm text-[#5A5A66]">{t('subtitle')}</p>
        </div>
        <div className="flex flex-col gap-1.5 sm:items-end">
          <label htmlFor="daily-health-date" className="text-sm font-medium text-[#1E1E24]">
            {t('dateLabel')}
          </label>
          <div className="relative">
            <CalendarDays
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A5A66]"
              aria-hidden="true"
            />
            <input
              id="daily-health-date"
              type="date"
              value={selectedDate}
              max={todayIso()}
              onChange={(e) => handleDateChange(e.target.value)}
              className="min-h-[48px] rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] pl-9 pr-3 text-sm text-[#1E1E24] focus-visible:border-[#E8837D] focus-visible:outline-none"
            />
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-xs text-[#5A5A66]">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[#2E8B57]" aria-hidden="true" />
        <span>{tCommon('offlineMode')}</span>
        <span aria-hidden="true">&middot;</span>
        <span>{selectedDate}</span>
        {isToday && <span className="text-[#2D1B2D] font-medium">{t('isTodayLabel')}</span>}
      </div>

      {successMsg && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-[#2E8B57]/30 bg-[#2E8B57]/10 p-3.5 text-sm text-[#2E8B57]"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => loadLog(selectedDate)} />
      ) : existingLog || isCreating ? (
        <Surface variant="bordered" className="p-5 sm:p-6">
          {existingLog && (
            <div className="mb-5 flex items-center gap-2 border-b border-[#E2D8D0] pb-4">
              <span className="inline-flex items-center rounded-full bg-[#2E8B57]/10 px-3 py-1 text-xs font-semibold text-[#2E8B57]">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                {t('editingLabel')}
              </span>
            </div>
          )}
          <DailyHealthForm
            key={`${selectedDate}-${existingLog ? 'edit' : 'new'}`}
            initialDate={selectedDate}
            initialValues={
              existingLog
                ? {
                    symptoms: existingLog.symptoms,
                    mood: existingLog.mood,
                    painLevel: existingLog.painLevel,
                    sleepHours: String(existingLog.sleepHours),
                    hydrationMl: String(existingLog.hydrationMl),
                    notes: existingLog.notes ?? '',
                  }
                : undefined
            }
            isEditing={!!existingLog}
            isSaving={isSaving}
            isDeleting={isDeleting}
            errorMsg={saveError}
            fieldErrors={fieldErrors}
            onSave={handleSave}
            onDelete={existingLog ? () => setIsDeleteConfirmOpen(true) : undefined}
            onCancel={existingLog ? undefined : handleCancelCreate}
          />
        </Surface>
      ) : (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title={t('noLogTitle')}
          description={t('noLogDescription')}
          action={
            <Button variant="primary" onClick={handleStartCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('startLogging')}
            </Button>
          }
        />
      )}

      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title={t('deleteTitle')}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-[#C94A46]/30 bg-[#C94A46]/10 p-3.5 text-sm text-[#C94A46]">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="leading-relaxed">{t('deleteMessage')}</p>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={isDeleting}
            >
              {tCommon('cancel')}
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? tCommon('loading') : t('deleteConfirm')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
