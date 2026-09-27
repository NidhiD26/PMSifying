'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  lines,
  optionalInteger,
  optionalText,
  RecordForm,
  SelectField,
  TextAreaField,
  TextField,
  type FormRenderProps,
} from './forms';

/**
 * The writes a case can collect.
 *
 * A case is a thread that different people add to: the worker records what they saw,
 * the doctor writes what they think, and the doctor hands the thread to somebody — a
 * colleague, or the worker who raised it — with a date on it. Each of those is a
 * separate form here rather than one form with optional sections, because the fields
 * are not optional: a prescription without a dose is not a prescription, and a form
 * that let a clinician submit a half-filled one would produce a record that reads as
 * complete and is not.
 *
 * Every form posts to a child of the case, and none of them names the case in its
 * body. The id is in the path, the service reads it from there, and the schemas are
 * `.strict()` so a body that carries a second copy of it is a 400 that says so instead
 * of a request that quietly ignores half of itself.
 */


/** What the worker saw, and how bad it looked. */export const ObservationForm: React.FC<{ caseId: string }> = ({ caseId }) => {
  const t = useTranslations('healthcare');
  const today = new Date().toISOString().slice(0, 10);

  return (
    <RecordForm
      title={t('forms.newObservation')}
      submitLabel={t('actions.save')}
      build={() => ({
        path: `/cases/${caseId}/observations`,
        method: 'POST',
        toBody: (form) => ({
          reportedSymptoms: lines(form['reportedSymptoms']),
          severity: form['severity'],
          observedOn: form['observedOn'],
          durationDays: optionalInteger(form['durationDays']) ?? null,
          notes: optionalText(form['notes']),
        }),
      })}
    >
      {({ values, setValue, invalid }: FormRenderProps) => (
        <>
          {/*
            The field is named `reportedSymptoms` and not `symptoms` so that a
            validation error the server sends back carries the same name this input
            knows: the `invalid` list is the server's field names, so renaming the
            field to something friendlier would quietly stop the worker's box from
            being marked when the service rejects an empty symptom list. The textarea
            holds one symptom per line and `lines()` turns that into the array.
          */}
          <TextAreaField
            label={t('observations.symptoms')}
            name="reportedSymptoms"
            value={values['reportedSymptoms'] ?? ''}
            onChange={(value) => setValue('reportedSymptoms', value)}
            required
            hint={t('forms.symptomsHint')}
            invalid={invalid.includes('reportedSymptoms')}
          />
          <SelectField
            label={t('observations.severity')}
            name="severity"
            value={values['severity'] ?? ''}
            onChange={(value) => setValue('severity', value)}
            required
            invalid={invalid.includes('severity')}
            emptyLabel={t('forms.choose')}
            options={[
              { value: 'MILD', label: t('status.MILD') },
              { value: 'MODERATE', label: t('status.MODERATE') },
              { value: 'SEVERE', label: t('status.SEVERE') },
            ]}
          />
          <TextField
            label={t('camps.date')}
            name="observedOn"
            type="date"
            value={values['observedOn'] ?? today}
            onChange={(value) => setValue('observedOn', value)}
            required
            invalid={invalid.includes('observedOn')}
          />
          <TextField
            label={t('observations.duration')}
            name="durationDays"
            type="number"
            min={0}
            max={3650}
            value={values['durationDays'] ?? ''}
            onChange={(value) => setValue('durationDays', value)}
            hint={t('observations.durationUnknown')}
            invalid={invalid.includes('durationDays')}
          />
          <TextAreaField
            label={t('observations.notes')}
            name="notes"
            value={values['notes'] ?? ''}
            onChange={(value) => setValue('notes', value)}
            invalid={invalid.includes('notes')}
          />
        </>
      )}
    </RecordForm>
  );
};

/** Sending a case to a named doctor, with the reason they will read first. */
export const ReferralForm: React.FC<{
  caseId: string;
  /** `GET /doctors`, mapped to the value that has to be sent and the label to show. */
  doctors: { value: string; label: string }[];
}> = ({ caseId, doctors }) => {
  const t = useTranslations('healthcare');

  return (
    <RecordForm
      title={t('forms.newReferral')}
      submitLabel={t('actions.save')}
      build={() => ({
        path: `/cases/${caseId}/referrals`,
        method: 'POST',
        toBody: (form) => ({
          doctorId: form['doctorId'],
          reason: form['reason']?.trim(),
          priority: form['priority'] || 'ROUTINE',
        }),
      })}
    >
      {({ values, setValue, invalid }: FormRenderProps) => (
        <>
          <SelectField
            label={t('referrals.referredTo')}
            name="doctorId"
            value={values['doctorId'] ?? ''}
            onChange={(value) => setValue('doctorId', value)}
            required
            invalid={invalid.includes('doctorId')}
            emptyLabel={t('forms.choose')}
            options={doctors}
          />
          <TextAreaField
            label={t('referrals.reason')}
            name="reason"
            value={values['reason'] ?? ''}
            onChange={(value) => setValue('reason', value)}
            required
            invalid={invalid.includes('reason')}
          />
          <SelectField
            label={t('cases.priority')}
            name="priority"
            value={values['priority'] ?? 'ROUTINE'}
            onChange={(value) => setValue('priority', value)}
            invalid={invalid.includes('priority')}
            options={[
              { value: 'ROUTINE', label: t('status.ROUTINE') },
              { value: 'URGENT', label: t('status.URGENT') },
            ]}
          />
        </>
      )}
    </RecordForm>
  );
};

/**
 * The clinician's assessment.
 *
 * Assessment and advice are both required by the schema, and the difference is kept in
 * the labels on purpose: the assessment is what the clinician concludes, the advice is
 * what the person is told to do about it. Collapsing them into one free-text box
 * produces notes that are readable and unusable — a record of a conclusion with no
 * instruction, which is the part the patient needed.
 */
export const ClinicalNoteForm: React.FC<{ caseId: string }> = ({ caseId }) => {
  const t = useTranslations('healthcare');

  return (
    <RecordForm
      title={t('forms.newNote')}
      submitLabel={t('actions.save')}
      build={() => ({
        path: `/cases/${caseId}/clinical-notes`,
        method: 'POST',
        toBody: (form) => ({
          assessment: form['assessment']?.trim(),
          observations: optionalText(form['observations']),
          advice: form['advice']?.trim(),
          followUpOn: optionalText(form['followUpOn']) ?? null,
        }),
      })}
    >
      {({ values, setValue, invalid }: FormRenderProps) => (
        <>
          <TextAreaField
            label={t('clinicalNotes.assessment')}
            name="assessment"
            value={values['assessment'] ?? ''}
            onChange={(value) => setValue('assessment', value)}
            required
            invalid={invalid.includes('assessment')}
          />
          <TextAreaField
            label={t('clinicalNotes.observations')}
            name="observations"
            value={values['observations'] ?? ''}
            onChange={(value) => setValue('observations', value)}
            invalid={invalid.includes('observations')}
          />
          <TextAreaField
            label={t('clinicalNotes.advice')}
            name="advice"
            value={values['advice'] ?? ''}
            onChange={(value) => setValue('advice', value)}
            required
            invalid={invalid.includes('advice')}
          />
          <TextField
            label={t('clinicalNotes.followUpOn')}
            name="followUpOn"
            type="date"
            value={values['followUpOn'] ?? ''}
            onChange={(value) => setValue('followUpOn', value)}
            hint={t('observations.durationUnknown')}
            invalid={invalid.includes('followUpOn')}
          />
        </>
      )}
    </RecordForm>
  );
};

/**
 * A prescription.
 *
 * `clinicalNoteId` is accepted by the schema and is deliberately not sent: the note is
 * an assessment, and tying a medicine to it by id would make the note the unit of
 * prescribing, so a second prescription written at the same visit would have no note to
 * point at. The prescription stands on its own against the case.
 */
export const PrescriptionForm: React.FC<{ caseId: string }> = ({ caseId }) => {
  const t = useTranslations('healthcare');

  return (
    <RecordForm
      title={t('forms.newPrescription')}
      submitLabel={t('actions.save')}
      build={() => ({
        path: `/cases/${caseId}/prescriptions`,
        method: 'POST',
        toBody: (form) => ({
          medicineName: form['medicineName']?.trim(),
          dosage: form['dosage']?.trim(),
          frequency: form['frequency']?.trim(),
          duration: form['duration']?.trim(),
          instructions: optionalText(form['instructions']),
        }),
      })}
    >
      {({ values, setValue, invalid }: FormRenderProps) => (
        <>
          <TextField
            label={t('prescriptions.medicine')}
            name="medicineName"
            value={values['medicineName'] ?? ''}
            onChange={(value) => setValue('medicineName', value)}
            required
            invalid={invalid.includes('medicineName')}
          />
          <TextField
            label={t('prescriptions.dosage')}
            name="dosage"
            value={values['dosage'] ?? ''}
            onChange={(value) => setValue('dosage', value)}
            required
            invalid={invalid.includes('dosage')}
          />
          <TextField
            label={t('prescriptions.frequency')}
            name="frequency"
            value={values['frequency'] ?? ''}
            onChange={(value) => setValue('frequency', value)}
            required
            invalid={invalid.includes('frequency')}
          />
          <TextField
            label={t('prescriptions.duration')}
            name="duration"
            value={values['duration'] ?? ''}
            onChange={(value) => setValue('duration', value)}
            required
            invalid={invalid.includes('duration')}
          />
          <TextAreaField
            label={t('prescriptions.instructions')}
            name="instructions"
            value={values['instructions'] ?? ''}
            onChange={(value) => setValue('instructions', value)}
            invalid={invalid.includes('instructions')}
          />
        </>
      )}
    </RecordForm>
  );
};

/**
 * Handing the case back to somebody with a date on it.
 *
 * The choice is a *role*, not an account, and the select says so: the service resolves
 * the account itself, so there is no account id in the request to get wrong and no way
 * for a caller to assign a visit to a colleague by guessing an id. `ADMIN` is in the
 * list because the schema allows it, and it is offered here rather than filtered out
 * by the interface — a client that hides a legal option and a server that refuses it
 * are two different behaviours, and only one of them can be trusted.
 */
export const FollowUpForm: React.FC<{ caseId: string }> = ({ caseId }) => {
  const t = useTranslations('healthcare');

  return (
    <RecordForm
      title={t('forms.newFollowUp')}
      submitLabel={t('actions.save')}
      build={() => ({
        path: `/cases/${caseId}/follow-ups`,
        method: 'POST',
        toBody: (form) => ({
          assignedRole: form['assignedRole'],
          dueDate: form['dueDate'],
          notes: optionalText(form['notes']),
        }),
      })}
    >
      {({ values, setValue, invalid }: FormRenderProps) => (
        <>
          <SelectField
            label={t('followUps.assignedTo')}
            name="assignedRole"
            value={values['assignedRole'] ?? ''}
            onChange={(value) => setValue('assignedRole', value)}
            required
            invalid={invalid.includes('assignedRole')}
            emptyLabel={t('forms.choose')}
            options={[
              { value: 'ASHA', label: t('roles.ASHA') },
              { value: 'DOCTOR', label: t('roles.DOCTOR') },
              { value: 'ADMIN', label: t('roles.ADMIN') },
            ]}
          />
          <TextField
            label={t('followUps.due')}
            name="dueDate"
            type="date"
            value={values['dueDate'] ?? ''}
            onChange={(value) => setValue('dueDate', value)}
            required
            invalid={invalid.includes('dueDate')}
          />
          <TextAreaField
            label={t('followUps.notes')}
            name="notes"
            value={values['notes'] ?? ''}
            onChange={(value) => setValue('notes', value)}
            invalid={invalid.includes('notes')}
          />
        </>
      )}
    </RecordForm>
  );
};

export const RecommendCampForm: React.FC<{
  caseId: string;
  camps: { value: string; label: string }[];
}> = ({ caseId, camps }) => {
  const t = useTranslations('healthcare');

  return (
    <RecordForm
      title="Recommend Patient for Health Camp"
      description="Associate this case and patient with a community health screening camp."
      submitLabel="Recommend & Register for Camp"
      build={() => ({
        path: `/cases/${caseId}/recommend-camp`,
        method: 'POST',
        toBody: (form) => ({
          campId: form['campId'],
        }),
      })}
    >
      {({ values, setValue, invalid }: FormRenderProps) => (
        <>
          <SelectField
            label="Select Health Camp"
            name="campId"
            value={values['campId'] ?? ''}
            onChange={(value) => setValue('campId', value)}
            required
            invalid={invalid.includes('campId')}
            emptyLabel="Choose a Health Camp..."
            options={camps}
          />
        </>
      )}
    </RecordForm>
  );
};

