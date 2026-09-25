'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChipSelect } from '@/components/ui/chip-select';
import {
  SYMPTOM_OPTIONS,
  MOOD_OPTIONS,
  PAIN_LABELS,
} from '@/lib/health/daily-health-options';
import type { SymptomEntry, MoodEntry } from '@/types/health';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export interface DailyHealthFormValues {
  date: string;
  symptoms: SymptomEntry[];
  mood: MoodEntry[];
  painLevel: number;
  sleepHours: string;
  hydrationMl: string;
  notes: string;
}

export interface DailyHealthFormProps {
  initialDate: string;
  initialValues?: Omit<DailyHealthFormValues, 'date'>;
  isEditing: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  errorMsg?: string | null;
  onSave: (values: DailyHealthFormValues) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}

export const DailyHealthForm: React.FC<DailyHealthFormProps> = ({
  initialDate,
  initialValues,
  isEditing,
  isSaving,
  isDeleting,
  errorMsg,
  onSave,
  onDelete,
  onCancel,
}) => {
  const t = useTranslations('dailyHealth');
  const tCommon = useTranslations('common');

  const [date, setDate] = React.useState(initialDate);
  const [symptomIds, setSymptomIds] = React.useState<string[]>(
    initialValues?.symptoms.map((s) => s.id) ?? []
  );
  const [moodIds, setMoodIds] = React.useState<string[]>(
    initialValues?.mood.map((m) => m.id) ?? []
  );
  const [painLevel, setPainLevel] = React.useState<number>(
    initialValues?.painLevel ?? 0
  );
  const [sleepHours, setSleepHours] = React.useState<string>(
    initialValues?.sleepHours != null ? String(initialValues.sleepHours) : ''
  );
  const [hydrationMl, setHydrationMl] = React.useState<string>(
    initialValues?.hydrationMl != null ? String(initialValues.hydrationMl) : ''
  );
  const [notes, setNotes] = React.useState<string>(initialValues?.notes ?? '');

  React.useEffect(() => {
    setDate(initialDate);
  }, [initialDate]);

  const handleToggleSymptom = (value: string) => {
    setSymptomIds((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleToggleMood = (value: string) => {
    setMoodIds((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      date,
      symptoms: symptomIds.map((id) => ({ id })),
      mood: moodIds.map((id) => ({ id })),
      painLevel,
      sleepHours,
      hydrationMl,
      notes,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-[#C94A46]/10 border border-[#C94A46]/30 flex items-start gap-2 text-sm text-[#C94A46]"
        >
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isEditing && (
        <div className="p-3.5 rounded-xl bg-[#2E8B57]/10 border border-[#2E8B57]/30 flex items-start gap-2 text-sm text-[#2E8B57]">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{t('editExisting')}</span>
        </div>
      )}

      {/* Date */}
      <Input
        type="date"
        label={t('dateLabel')}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
      />

      {/* Symptoms */}
      <section className="space-y-2.5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-[#1E1E24]">{t('symptomsLabel')}</h3>
          <span className="text-xs text-[#5A5A66]">{t('symptomsHelper')}</span>
        </div>
        <ChipSelect
          name="symptoms"
          options={SYMPTOM_OPTIONS.map((s) => ({
            value: s.id,
            label: t(s.i18nKey),
          }))}
          selected={symptomIds}
          onToggle={handleToggleSymptom}
          ariaLabel={t('symptomsLabel')}
        />
      </section>

      {/* Mood */}
      <section className="space-y-2.5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-[#1E1E24]">{t('moodLabel')}</h3>
          <span className="text-xs text-[#5A5A66]">{t('moodHelper')}</span>
        </div>
        <ChipSelect
          name="mood"
          options={MOOD_OPTIONS.map((m) => ({ value: m.id, label: t(m.i18nKey) }))}
          selected={moodIds}
          onToggle={handleToggleMood}
          ariaLabel={t('moodLabel')}
        />
      </section>

      {/* Pain */}
      <section className="space-y-2.5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-[#1E1E24]">{t('painLabel')}</h3>
          <span className="text-xs text-[#5A5A66]">{t('painHelper')}</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <input
            id="daily-pain-range"
            type="range"
            min={0}
            max={10}
            step={1}
            value={painLevel}
            onChange={(e) => setPainLevel(Number(e.target.value))}
            aria-label={t('painLabel')}
            aria-valuetext={`${painLevel} / 10`}
            className="w-full accent-[#2D1B2D]"
          />
          <div className="flex justify-between text-xs text-[#5A5A66]">
            <span>0</span>
            <span>10</span>
          </div>
          <span className="text-sm font-medium text-[#2D1B2D]">
            {t(PAIN_LABELS[painLevel].i18nKey)} ({painLevel})
          </span>
        </div>
      </section>

      {/* Sleep + Hydration */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex-col">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={24}
            step={0.5}
            label={t('sleepLabel')}
            value={sleepHours}
            onChange={(e) => setSleepHours(e.target.value)}
            placeholder="7.5"
          />
          <p className="mt-1 text-xs text-[#5A5A66]">{t('sleepHelper')}</p>
        </div>
        <div className="flex-col">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={10000}
            step={1}
            label={t('hydrationLabel')}
            value={hydrationMl}
            onChange={(e) => setHydrationMl(e.target.value)}
            placeholder="2000"
          />
          <p className="mt-1 text-xs text-[#5A5A66]">{t('hydrationHelper')}</p>
        </div>
      </section>

      {/* Notes */}
      <section className="space-y-2.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="daily-notes" className="text-sm font-semibold text-[#1E1E24]">
            {t('notesLabel')}
          </label>
          <span className="text-xs text-[#5A5A66]">{t('notesHelper')}</span>
        </div>
        <textarea
          id="daily-notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          className="w-full rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] p-3 text-base text-[#1E1E24] placeholder:text-[#5A5A66] focus-visible:border-[#E8837D] focus-visible:outline-none"
        />
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#E2D8D0]">
        <div>
          {onDelete && isEditing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-[#C94A46] hover:bg-[#C94A46]/10"
              onClick={onDelete}
              disabled={isDeleting}
            >
              {isDeleting ? tCommon('delete') : tCommon('delete')}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
              {tCommon('cancel')}
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? tCommon('loading') : t('logSavable')}
          </Button>
        </div>
      </div>
    </form>
  );
};
