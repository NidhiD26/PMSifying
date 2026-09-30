'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Sparkles, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';

export interface RegisterWomanResult {
  caseId: string;
  caseNumber: string;
  memberId: string;
  memberName: string;
  householdId: string;
  referralId: string;
}

export const RegisterWomanForm: React.FC<{ locale: string }> = ({ locale }) => {
  const router = useRouter();

  const [name, setName] = React.useState('');
  const [age, setAge] = React.useState('');
  const [contact, setContact] = React.useState('');
  const [householdName, setHouseholdName] = React.useState('');
  const [addressLine, setAddressLine] = React.useState('');
  const [primaryConcern, setPrimaryConcern] = React.useState('');
  const [symptoms, setSymptoms] = React.useState('');
  const [durationDays, setDurationDays] = React.useState('');
  const [priority, setPriority] = React.useState<'ROUTINE' | 'URGENT'>('URGENT');
  const [notes, setNotes] = React.useState('');
  const [referToDoctorId, setReferToDoctorId] = React.useState('doctor-demo-user-id');

  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<RegisterWomanResult | null>(null);

  const fillTestScenario = () => {
    setName('Kamla Devi');
    setAge('32');
    setContact('9876543210');
    setHouseholdName('Devi Household');
    setAddressLine('House #89, Cross Street, Sector 4');
    setPrimaryConcern('Irregular periods');
    setSymptoms('Heavy bleeding\nFatigue');
    setDurationDays('14');
    setPriority('URGENT');
    setNotes('Patient reports heavy menstrual flow and fatigue for 2 weeks. Specialist evaluation requested.');
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Woman\'s full name is required.');
      return;
    }
    if (!primaryConcern.trim()) {
      setError('Primary health concern is required.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/healthcare/asha/register-woman', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            age: age ? Number(age) : undefined,
            contact: contact.trim() || undefined,
            householdName: householdName.trim() || undefined,
            addressLine: addressLine.trim() || undefined,
            primaryConcern: primaryConcern.trim(),
            symptoms: symptoms.trim() || undefined,
            durationDays: durationDays ? Number(durationDays) : undefined,
            priority,
            notes: notes.trim() || undefined,
            referToDoctorId,
          }),
        });

        const envelope = await res.json();
        if (res.ok && envelope.ok) {
          setResult(envelope.data);
          router.refresh();
        } else {
          setError(envelope.message || 'Failed to submit healthcare registration.');
        }
      } catch {
        setError('Network error submitting healthcare registration.');
      }
    });
  };

  if (result) {
    return (
      <Surface variant="bordered" className="space-y-6 p-6">
        <div className="flex items-center gap-3 text-[#2E8B57]">
          <CheckCircle2 className="h-8 w-8 shrink-0" />
          <div>
            <h2 className="text-xl font-bold text-[#2D1B2D]">Registration & Case Submitted!</h2>
            <p className="text-xs text-[#5A5A66]">
              Case record created and referred to Specialist Doctor.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] p-4 space-y-2 text-sm text-[#1E1E24]">
          <div className="flex justify-between">
            <span className="text-[#5A5A66]">Patient Name:</span>
            <span className="font-bold">{result.memberName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#5A5A66]">Case Number:</span>
            <span className="font-mono font-bold text-[#E8837D]">{result.caseNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#5A5A66]">Assigned Specialist:</span>
            <span className="font-semibold text-[#2E8B57]">Dr. Ananya Rao, MD</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href={`/${locale}/asha/cases/${result.caseId}`}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2D1B2D] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#3D283D]"
          >
            <span>View Case Record</span>
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href={`/${locale}/asha/households/${result.householdId}`}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D8CCC2] bg-white px-4 py-2.5 text-xs font-semibold text-[#2D1B2D] hover:bg-[#FDFBF7]"
          >
            <span>View Household</span>
          </a>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setName('');
              setAge('');
              setContact('');
              setPrimaryConcern('');
              setSymptoms('');
              setNotes('');
            }}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Register Another Woman
          </button>
        </div>
      </Surface>
    );
  }

  return (
    <Surface variant="bordered" className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2D8D0] pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#2D1B2D]">
            <UserPlus className="h-5 w-5 text-[#E8837D]" />
            Register Woman & Create Case
          </h2>
          <p className="text-xs text-[#5A5A66]">
            Record patient registration, symptoms, primary health concern, and submit to Doctor.
          </p>
        </div>

        <button
          type="button"
          onClick={fillTestScenario}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8837D]/50 bg-[#F9EBEA] px-3 py-1.5 text-xs font-semibold text-[#2D1B2D] hover:bg-[#E8837D]/20"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#E8837D]" />
          Fill Test Scenario (Kamla Devi)
        </button>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* PATIENT DEMOGRAPHICS */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A5A66]">
            1. Patient Demographics & Location
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#2D1B2D]">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Kamla Devi"
                className="w-full rounded-xl border border-[#D8CCC2] bg-white px-3 py-2 text-sm text-[#1E1E24] focus:outline-none focus:ring-2 focus:ring-[#E8837D]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#2D1B2D]">Age (Years)</label>
              <input
                type="number"
                min={1}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 32"
                className="w-full rounded-xl border border-[#D8CCC2] bg-white px-3 py-2 text-sm text-[#1E1E24] focus:outline-none focus:ring-2 focus:ring-[#E8837D]"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#2D1B2D]">Contact Information</label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full rounded-xl border border-[#D8CCC2] bg-white px-3 py-2 text-sm text-[#1E1E24] focus:outline-none focus:ring-2 focus:ring-[#E8837D]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#2D1B2D]">Household Name</label>
              <input
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="e.g. Devi Household"
                className="w-full rounded-xl border border-[#D8CCC2] bg-white px-3 py-2 text-sm text-[#1E1E24] focus:outline-none focus:ring-2 focus:ring-[#E8837D]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#2D1B2D]">Address / Location</label>
            <input
              type="text"
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder="e.g. House #89, Cross Street, Sector 4"
              className="w-full rounded-xl border border-[#D8CCC2] bg-white px-3 py-2 text-sm text-[#1E1E24] focus:outline-none focus:ring-2 focus:ring-[#E8837D]"
            />
          </div>
        </div>

        {/* CLINICAL SYMPTOMS & CASE DETAILS */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A5A66]">
            2. Health Concern & Symptoms
          </h3>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#2D1B2D]">
              Primary Health Concern <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={primaryConcern}
              onChange={(e) => setPrimaryConcern(e.target.value)}
              required
              placeholder="e.g. Irregular periods"
              className="w-full rounded-xl border border-[#D8CCC2] bg-white px-3 py-2 text-sm text-[#1E1E24] focus:outline-none focus:ring-2 focus:ring-[#E8837D]"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#2D1B2D]">
                Reported Symptoms (one per line)
              </label>
              <textarea
                rows={3}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Heavy bleeding&#10;Fatigue&#10;Pelvic pain"
                className="w-full rounded-xl border border-[#D8CCC2] bg-white px-3 py-2 text-sm text-[#1E1E24] focus:outline-none focus:ring-2 focus:ring-[#E8837D]"
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#2D1B2D]">
                  Symptom Duration (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  placeholder="e.g. 14"
                  className="w-full rounded-xl border border-[#D8CCC2] bg-white px-3 py-2 text-sm text-[#1E1E24] focus:outline-none focus:ring-2 focus:ring-[#E8837D]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#2D1B2D]">
                  Priority Level
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'ROUTINE' | 'URGENT')}
                  className="w-full rounded-xl border border-[#D8CCC2] bg-white px-3 py-2 text-sm text-[#1E1E24] focus:outline-none focus:ring-2 focus:ring-[#E8837D]"
                >
                  <option value="URGENT">URGENT (High Priority Specialist Referral)</option>
                  <option value="ROUTINE">ROUTINE (Standard Clinical Evaluation)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#2D1B2D]">
              ASHA Field Observations & Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record patient notes, observations, or special instructions..."
              className="w-full rounded-xl border border-[#D8CCC2] bg-white px-3 py-2 text-sm text-[#1E1E24] focus:outline-none focus:ring-2 focus:ring-[#E8837D]"
            />
          </div>
        </div>

        {/* REFERRAL TO DOCTOR */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A5A66]">
            3. Referral to Specialist Doctor
          </h3>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#2D1B2D]">
              Refer to Doctor
            </label>
            <select
              value={referToDoctorId}
              onChange={(e) => setReferToDoctorId(e.target.value)}
              className="w-full rounded-xl border border-[#D8CCC2] bg-white px-3 py-2 text-sm text-[#1E1E24] focus:outline-none focus:ring-2 focus:ring-[#E8837D]"
            >
              <option value="doctor-demo-user-id">Dr. Ananya Rao, MD (Obstetrics & Gynecology)</option>
            </select>
          </div>
        </div>

        <Button type="submit" variant="secondary" className="w-full" disabled={isPending}>
          {isPending ? 'Creating Case & Submitting Referral...' : 'Submit Case to Doctor'}
        </Button>
      </form>
    </Surface>
  );
};
