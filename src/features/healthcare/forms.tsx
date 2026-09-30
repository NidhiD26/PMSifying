'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { callHealthcareApi, errorMessageKey, HealthcareRequestError } from './api-client';

/**
 * The form half of the feature.
 *
 * Every write in this feature is a form or a single button, and both end up in the same
 * place: the envelope, and a refusal reported as a code. What the forms add on top is
 * *which* field the server objected to.
 *
 * WHY FIELD NAMES COME BACK TO A FORM
 * The API answers a rejected body with `fields: ['assessment']` — paths, not prose, and
 * never the value that failed. A clinical note with a missing assessment should put the
 * complaint on the assessment input, where the clinician can fix it; a form that only
 * said "invalid request" would make them re-read their own work to work out which of
 * five boxes was wrong. The paths are matched against the inputs' own `name`s, and an
 * unrecognised path highlights nothing, so the summary line is still the backstop and
 * nothing fails silently.
 *
 * THE VALIDATION HERE IS A COURTESY, NOT A CONTROL
 * Required, length and type attributes are in the markup so the phone keyboard is the
 * right one and the form is usable before a request leaves. Every one of those rules is
 * enforced again by `@/lib/healthcare/validation`, and the checks only a server can
 * make — that this worker owns the household, that this doctor is assigned to the case,
 * that the camp has room — exist nowhere else. A form that appeared to enforce
 * authorization would be a lie told to the person using it.
 */

export type FieldValues = Record<string, string>;

/** A request that has been worked out from the form's values but not yet sent. */
interface RecordRequest {
  path: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  toBody: (values: FieldValues) => unknown;
}

export interface FormRenderProps {
  values: FieldValues;
  setValue: (name: string, value: string) => void;
  /** Field names the server rejected, to be marked on the inputs. */
  invalid: string[];
}

export const FormField: React.FC<{
  label: string;
  name: string;
  required?: boolean;
  hint?: string;
  invalid?: boolean;
  children: (props: {
    id: string;
    name: string;
    required: boolean;
    'aria-invalid': true | undefined;
    'aria-describedby': string | undefined;
  }) => React.ReactNode;
}> = ({ label, name, required, hint, invalid, children }) => {
  const id = `healthcare-${name}`;
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-[#1E1E24]">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-xs text-[#5A5A66]">
          {hint}
        </p>
      ) : null}
      {children({
        id,
        name,
        required: required === true,
        'aria-invalid': invalid || undefined,
        'aria-describedby': hint ? hintId : undefined,
      })}
    </div>
  );
};

const CONTROL =
  'w-full rounded-xl border border-[#D8CCC2] bg-[#FFFFFF] px-3 py-2 text-sm text-[#1E1E24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8837D] aria-[invalid=true]:border-[#C94A46]';

export const TextField: React.FC<{
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
  invalid?: boolean;
  type?: 'text' | 'number' | 'date' | 'time';
  maxLength?: number;
  min?: number;
  max?: number;
}> = ({ label, name, value, onChange, required, hint, invalid, type = 'text', maxLength, min, max }) => (
  <FormField label={label} name={name} required={required} hint={hint} invalid={invalid}>
    {(props) => (
      <input
        {...props}
        type={type}
        value={value}
        maxLength={maxLength}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className={CONTROL}
      />
    )}
  </FormField>
);

export const TextAreaField: React.FC<{
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
  invalid?: boolean;
  rows?: number;
  maxLength?: number;
}> = ({ label, name, value, onChange, required, hint, invalid, rows = 3, maxLength }) => (
  <FormField label={label} name={name} required={required} hint={hint} invalid={invalid}>
    {(props) => (
      <textarea
        {...props}
        rows={rows}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className={CONTROL}
      />
    )}
  </FormField>
);

export const SelectField: React.FC<{
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  invalid?: boolean;
  /** The option for "nothing chosen yet", which is a real state here. */
  emptyLabel?: string;
}> = ({ label, name, value, onChange, options, required, invalid, emptyLabel }) => (
  <FormField label={label} name={name} required={required} invalid={invalid}>
    {(props) => (
      <select
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={CONTROL}
      >
        {emptyLabel !== undefined ? <option value="">{emptyLabel}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )}
  </FormField>
);

/**
 * A form that sends one healthcare write.
 *
 * On success the page is re-fetched rather than patched in place, for the same reason
 * `HealthcareAction` does it: what comes back is the record the service produced,
 * including the parts of it this form never sent and the server computed itself.
 */
export const RecordForm: React.FC<{
  title: string;
  description?: string;
  submitLabel: string;
  build: (values: FieldValues) => RecordRequest;
  children: (props: FormRenderProps) => React.ReactNode;
}> = ({ title, description, submitLabel, build, children }) => {
  const t = useTranslations('healthcare');
  const router = useRouter();
  const [values, setValues] = React.useState<FieldValues>({});
  const [invalidFields, setInvalidFields] = React.useState<string[]>([]);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const setValue = (name: string, value: string) =>
    setValues((previous) => ({ ...previous, [name]: value }));

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFailure(null);
    setSaved(false);
    setInvalidFields([]);

    const request = build(values);
    startTransition(async () => {
      try {
        await callHealthcareApi(request.path, {
          method: request.method,
          body: request.method === 'DELETE' ? undefined : request.toBody(values),
        });
        setValues({});
        setSaved(true);
        router.refresh();
      } catch (error) {
        if (error instanceof HealthcareRequestError) {
          setInvalidFields(error.fields);
          setFailure(errorMessageKey(error.code));
        } else {
          setFailure(errorMessageKey('unknown'));
        }
      }
    });
  };

  // One sentence above the fields, so a screen reader hears the refusal before it
  // reaches the input it belongs to rather than only as a red outline.
  const summary = failure ? t(failure) : invalidFields.length > 0 ? t('forms.invalidSummary') : null;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-[#2D1B2D]">{title}</h3>
        {description ? <p className="text-xs text-[#5A5A66]">{description}</p> : null}
      </div>

      {summary ? (
        <p role="alert" className="text-xs leading-relaxed text-[#C94A46]">
          {summary}
        </p>
      ) : null}
      {saved ? <p role="status" className="text-sm font-medium text-[#2E8B57]">Saved successfully.</p> : null}

      {children({ values, setValue, invalid: invalidFields })}

      <Button
        type="submit"
        variant="secondary"
        disabled={isPending}
        aria-busy={isPending || undefined}
      >
        {isPending ? t('loading') : submitLabel}
      </Button>
    </form>
  );
};

/**
 * The one place a form turns a text value into a number or leaves it out.
 *
 * The schemas are strict and their optional fields are `.optional()` rather than
 * nullable-by-accident, so an input the user left blank has to be *absent* from the
 * body, not present as `""`. Sending `""` for `ageYears` would be a number parse of an
 * empty string, and the error would name a field the user never filled in.
 */
export const optionalText = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/** An input that must be a whole number, or absent if it was left blank. */
export const optionalInteger = (value: string | undefined): number | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
};

/** A list, one entry per line, deduplicated — the shape `reportedSymptoms` expects. */
export const lines = (value: string | undefined): string[] => {
  const trimmed = value?.trim();
  if (!trimmed) return [];
  return [...new Set(trimmed.split('\n').map((line) => line.trim()).filter(Boolean))];
};
