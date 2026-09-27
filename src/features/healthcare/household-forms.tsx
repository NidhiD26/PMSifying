'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  optionalInteger,
  optionalText,
  RecordForm,
  SelectField,
  TextAreaField,
  TextField,
  type FormRenderProps,
} from './forms';

/**
 * The register a worker maintains.
 *
 * A household is a row with a code the clinic quotes back, and a member is a person in
 * it. Both are created by the worker who owns the patch, and neither can be assigned
 * to a different worker: `updateHouseholdSchema` has no field for it, and the service
 * reads the actor's own account for the assignment. Reassignment is an administrative
 * action, so there is deliberately nothing in this form that could express it.
 *
 * A member's age is a number the worker knows and a birthdate nobody recorded, so it is
 * a plain optional integer rather than a date field: asking for a date of birth for a
 * household register collects a far more identifying fact than the register needs, and
 * an age that becomes wrong is corrected in years, not to the day.
 */


export const HouseholdForm: React.FC = () => {
  const t = useTranslations('healthcare');

  return (
    <RecordForm
      title={t('forms.newHousehold')}
      submitLabel={t('actions.save')}
      build={() => ({
        path: '/households',
        method: 'POST',
        toBody: (form) => ({
          name: form['name']?.trim(),
          addressLine: optionalText(form['addressLine']),
        }),
      })}
    >
      {({ values, setValue, invalid }: FormRenderProps) => (
        <>
          <TextField
            label={t('forms.name')}
            name="name"
            value={values['name'] ?? ''}
            onChange={(value) => setValue('name', value)}
            required
            invalid={invalid.includes('name')}
          />
          <TextAreaField
            label={t('forms.address')}
            name="addressLine"
            value={values['addressLine'] ?? ''}
            onChange={(value) => setValue('addressLine', value)}
            rows={2}
            hint={t('forms.optional')}
            invalid={invalid.includes('addressLine')}
          />
        </>
      )}
    </RecordForm>
  );
};

/**
 * Editing the same household.
 *
 * One form, two paths: the request is a POST to create and a PATCH to amend, and
 * nothing else differs. A separate "edit" form would duplicate every field and let the
 * two drift apart — which is how an address ends up editable on one screen and
 * required on the other.
 */
export const EditHouseholdForm: React.FC<{ householdId: string }> = ({ householdId }) => {
  const t = useTranslations('healthcare');

  return (
    <RecordForm
      title={t('forms.editHousehold')}
      submitLabel={t('actions.save')}
      build={() => ({
        path: `/households/${householdId}`,
        method: 'PATCH',
        toBody: (form) => ({
          name: form['name']?.trim(),
          addressLine: optionalText(form['addressLine']),
        }),
      })}
    >
      {({ values, setValue, invalid }: FormRenderProps) => (
        <>
          <TextField
            label={t('forms.name')}
            name="name"
            value={values['name'] ?? ''}
            onChange={(value) => setValue('name', value)}
            required
            invalid={invalid.includes('name')}
          />
          <TextAreaField
            label={t('forms.address')}
            name="addressLine"
            value={values['addressLine'] ?? ''}
            onChange={(value) => setValue('addressLine', value)}
            rows={2}
            hint={t('forms.optional')}
            invalid={invalid.includes('addressLine')}
          />
        </>
      )}
    </RecordForm>
  );
};

export const MemberForm: React.FC<{ householdId: string }> = ({ householdId }) => {
  const t = useTranslations('healthcare');

  return (
    <RecordForm
      title={t('forms.newMember')}
      submitLabel={t('actions.save')}
      build={() => ({
        path: `/households/${householdId}/members`,
        method: 'POST',
        toBody: (form) => ({
          fullName: form['fullName']?.trim(),
          ageYears: optionalInteger(form['ageYears']) ?? null,
          sex: optionalText(form['sex']) ?? null,
          relationToHead: optionalText(form['relationToHead']),
          note: optionalText(form['note']),
        }),
      })}
    >
      {({ values, setValue, invalid }: FormRenderProps) => (
        <>
          <TextField
            label={t('cases.member')}
            name="fullName"
            value={values['fullName'] ?? ''}
            onChange={(value) => setValue('fullName', value)}
            required
            invalid={invalid.includes('fullName')}
          />
          <TextField
            label={t('members.age')}
            name="ageYears"
            type="number"
            min={0}
            max={130}
            value={values['ageYears'] ?? ''}
            onChange={(value) => setValue('ageYears', value)}
            hint={t('members.ageUnknown')}
            invalid={invalid.includes('ageYears')}
          />
          <SelectField
            label={t('members.sex')}
            name="sex"
            value={values['sex'] ?? ''}
            onChange={(value) => setValue('sex', value)}
            emptyLabel={t('members.sexUnknown')}
            invalid={invalid.includes('sex')}
            options={[
              { value: 'FEMALE', label: t('members.sexValues.FEMALE') },
              { value: 'MALE', label: t('members.sexValues.MALE') },
              { value: 'OTHER', label: t('members.sexValues.OTHER') },
            ]}
          />
          <TextField
            label={t('members.relation')}
            name="relationToHead"
            value={values['relationToHead'] ?? ''}
            onChange={(value) => setValue('relationToHead', value)}
            hint={t('members.relationUnknown')}
            invalid={invalid.includes('relationToHead')}
          />
          <TextAreaField
            label={t('members.note')}
            name="note"
            value={values['note'] ?? ''}
            onChange={(value) => setValue('note', value)}
            rows={2}
            hint={t('forms.optional')}
            invalid={invalid.includes('note')}
          />
        </>
      )}
    </RecordForm>
  );
};
