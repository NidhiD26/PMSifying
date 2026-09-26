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
import { AlertCircle, Trash2 } from 'lucide-react';

export interface DailyHealthFormValues {
  date: string;
  symptoms: SymptomEntry[];
  mood: MoodEntry[];
  painLevel: number;
  sleepHours: string;
  hydrationMl: string;
  notes: string;
}

/** Validation problems, attached to the field that caused them. */
export interface DailyHealthFieldErrors {
  sleep?: string;
  hydration?: string;
}

export interface DailyHealthFormProps {
  initialDate: string;
  initialValues?: Omit<DailyHealthFormValues, 'date'>;
  isEditing: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  errorMsg?: string | null;
  fieldErrors?: DailyHealthFieldErrors;
  onSave: (values: DailyHealthFormValues) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}

const MAX_SLEEP_HOURS = 24;
const MAX_HYDRATION_ML = 10000;

/** A labelled group of related controls. */
const FieldGroup: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <section className="space-y-3">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <h3 className="text-sm font-semibold text-[#1E1E24]">{label}</h3>
      {hint && <span className="text-xs text-[#5A5A66]">{hint}</span>}
    </div>
    {children}
  </section>
);

export const DailyHealthForm: React.FC<DailyHealthFormProps> = ({
  initialDate,
  initialValues,
  isEditing,
  isSaving,
  isDeleting,
  errorMsg,
  fieldErrors,
  onSave,
  onDelete,
  onCancel,
}) => {
  const t = useTranslations('dailyHealth');
  const tCommon = useTranslations('common');

  // The day being logged is owned by the panel's date picker, which sits above
  // this form. Tracking it here keeps a single control for the same choice.
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

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (value: string) => {
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      date,
      symptoms: symptomIds.map((id) => ({ id })),
      mood: moodIds.map((m) => ({ id: m })),
      painLevel,
      sleepHours,
      hydrationMl,
      notes,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-7" noValidate>
      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-[#C94A46]/30 bg-[#C94A46]/10 p-3.5 text-sm text-[#C94A46]"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}

      <FieldGroup label={t('symptomsLabel')} hint={t('symptomsHelper')}>
        <ChipSelect
          name="symptoms"
          options={SYMPTOM_OPTIONS.map((s) => ({
            value: s.id,
            label: t(s.i18nKey),
          }))}
          selected={symptomIds}
          onToggle={toggle(setSymptomIds)}
          ariaLabel={t('symptomsLabel')}
        />
      </FieldGroup>

      <FieldGroup label={t('moodLabel')} hint={t('moodHelper')}>
        <ChipSelect
          name="mood"
          options={MOOD_OPTIONS.map((m) => ({ value: m.id, label: t(m.i18nKey) }))}
          selected={moodIds}
          onToggle={toggle(setMoodIds)}
          ariaLabel={t('moodLabel')}
        />
      </FieldGroup>

      <FieldGroup label={t('painLabel')} hint={t('painHelper')}>
        <div className="space-y-1.5">
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
          <div className="flex items-baseline justify-between text-xs text-[#5A5A66]">
            <span>0</span>
            <span>10</span>
          </div>
          <p className="text-sm font-medium text-[#2D1B2D]">
            {t(PAIN_LABELS[painLevel].i18nKey)}{' '}
            <span className="text-[#5A5A66]">({painLevel} / 10)</span>
          </p>
        </div>
      </FieldGroup>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={MAX_SLEEP_HOURS}
            step={0.5}
            label={t('sleepLabel')}
            value={sleepHours}
            onChange={(e) => setSleepHours(e.target.value)}
            placeholder="7.5"
            error={fieldErrors?.sleep}
            aria-describedby="daily-sleep-hint"
          />
          <p id="daily-sleep-hint" className="text-xs text-[#5A5A66]">
            {t('sleepHelper')}
          </p>
        </div>
        <div className="space-y-1.5">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_HYDRATION_ML}
            step={1}
            label={t('hydrationLabel')}
            value={hydrationMl}
            onChange={(e) => setHydrationMl(e.target.value)}
            placeholder="2000"
            error={fieldErrors?.hydration}
            aria-describedby="daily-hydration-hint"
          />
          <p id="daily-hydration-hint" className="text-xs text-[#5A5A66]">
            {t('hydrationHelper')}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="daily-notes" className="text-sm font-semibold text-[#1E1E24]">
          {t('notesLabel')}
        </label>
        <textarea
          id="daily-notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          className="w-full rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] p-3 text-base text-[#1E1E24] placeholder:text-[#5A5A66] focus-visible:border-[#E8837D] focus-visible:outline-none"
        />
        <p className="text-xs text-[#5A5A66]">{t('notesHelper')}</p>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-[#E2D8D0] pt-4 sm:flex-row sm:items-center sm:justify-between">
        {onDelete && isEditing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start text-[#C94A46] hover:bg-[#C94A46]/10"
            onClick={onDelete}
            disabled={isDeleting || isSaving}
          >
            <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {tCommon('delete')}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
              {tCommon('cancel')}
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? tCommon('loading') : t('logSavable')}
          </Button>
        </div>
      </div>
    </form>
  );
};
