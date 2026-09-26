'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  ShieldCheck,
  Database,
  Download,
  Trash2,
  KeyRound,
  TriangleAlert,
  Check,
  Info,
  Calculator,
} from 'lucide-react';
import { Surface } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { LoadingState, ErrorState } from '@/components/ui/state';
import { PreferencesRepository } from '@/lib/db/repositories/preferences-repository';
import { HealthRepository } from '@/lib/db/repositories/health-repository';
import { CycleRepository } from '@/lib/db/repositories/cycle-repository';
import { DailyLogRepository } from '@/lib/db/repositories/daily-log-repository';
import { ReminderRepository } from '@/lib/db/repositories/reminder-repository';
import {
  buildLocalVaultExport,
  downloadLocalVaultExport,
} from '@/lib/settings/local-export';
import { PIN_LENGTH, buildPinSetup, isValidPinFormat, verifyPin } from '@/lib/security/pin';
import { formatLocalDateIso } from '@/lib/utils/date-utils';
import type { UserPreferencesRecord } from '@/types/db';

type PinDraft = { pin: string; confirm: string };

const EMPTY_DRAFT: PinDraft = { pin: '', confirm: '' };

export const SettingsView: React.FC = () => {
  const t = useTranslations('settings');

  const [prefs, setPrefs] = React.useState<UserPreferencesRecord | null>(null);
  const [counts, setCounts] = React.useState<{ cycles: number; dailyLogs: number; reminders: number } | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const [pinMode, setPinMode] = React.useState<'idle' | 'setup' | 'change' | 'remove'>('idle');
  const [draft, setDraft] = React.useState<PinDraft>(EMPTY_DRAFT);
  const [currentPin, setCurrentPin] = React.useState('');
  const [pinError, setPinError] = React.useState<string | null>(null);
  const [isSavingPin, setIsSavingPin] = React.useState(false);

  const [isWipeOpen, setIsWipeOpen] = React.useState(false);
  const [wipeConfirm, setWipeConfirm] = React.useState('');
  const [isWiping, setIsWiping] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [loadedPrefs, loadedCounts] = await Promise.all([
        PreferencesRepository.getPreferences(),
        HealthRepository.getLocalRecordCounts(),
      ]);
      setPrefs(loadedPrefs);
      setCounts(loadedCounts);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  function closePinDialog() {
    setPinMode('idle');
    setDraft(EMPTY_DRAFT);
    setCurrentPin('');
    setPinError(null);
  }

  const handleSavePin = async () => {
    setPinError(null);

    if (!isValidPinFormat(draft.pin)) {
      setPinError(t('pin.invalidFormat', { length: PIN_LENGTH }));
      return;
    }
    if (draft.pin !== draft.confirm) {
      setPinError(t('pin.mismatch'));
      return;
    }

    setIsSavingPin(true);
    try {
      if (pinMode === 'change') {
        const ok = await verifyPin(currentPin, prefs!);
        if (ok !== true) {
          setPinError(t('pin.wrongCurrent'));
          return;
        }
      }
      const setup = await buildPinSetup(draft.pin);
      await PreferencesRepository.updatePreferences(setup);
      setStatus(t('pin.enabledStatus'));
      closePinDialog();
      await load();
    } catch (err) {
      setPinError((err as Error).message);
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleRemovePin = async () => {
    setPinError(null);
    setIsSavingPin(true);
    try {
      const ok = await verifyPin(currentPin, prefs!);
      if (ok !== true) {
        setPinError(t('pin.wrongCurrent'));
        return;
      }
      await PreferencesRepository.updatePreferences({
        isPinEnabled: false,
        pinHash: undefined,
        pinSalt: undefined,
      });
      setStatus(t('pin.disabledStatus'));
      closePinDialog();
      await load();
    } catch (err) {
      setPinError((err as Error).message);
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleExport = async () => {
    setActionError(null);
    setStatus(null);
    try {
      const [cycles, dailyLogs, reminders, preferences] = await Promise.all([
        CycleRepository.getAllCyclesChronological(),
        DailyLogRepository.getAllDailyLogs(),
        ReminderRepository.getAllReminders(),
        PreferencesRepository.getPreferences(),
      ]);

      const payload = buildLocalVaultExport({ cycles, dailyLogs, reminders, preferences }, new Date());
      downloadLocalVaultExport(payload, `pmsify-local-data-${formatLocalDateIso(new Date())}.json`);
      setStatus(t('export.success'));
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const handleWipe = async () => {
    if (wipeConfirm !== t('wipe.confirmPhrase')) return;
    setIsWiping(true);
    setActionError(null);
    try {
      await HealthRepository.clearAllLocalData();
      setIsWipeOpen(false);
      setWipeConfirm('');
      setPinMode('idle');
      setStatus(t('wipe.success'));
      await load();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setIsWiping(false);
    }
  };

  if (isLoading) return <LoadingState className="py-16 text-center text-sm text-[#5A5A66] max-w-3xl mx-auto" />;
  if (errorMsg) {
    return (
      <div className="max-w-3xl mx-auto">
        <ErrorState message={errorMsg} onRetry={load} />
      </div>
    );
  }

  const isPinEnabled = prefs?.isPinEnabled ?? false;
  const totalRecords = (counts?.cycles ?? 0) + (counts?.dailyLogs ?? 0);

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold text-[#2D1B2D]">{t('title')}</h1>
        <p className="text-sm text-[#5A5A66] mt-1">{t('subtitle')}</p>
      </header>

      {actionError && <ErrorState message={actionError} />}

      {status && (
        <Surface
          variant="bordered"
          className="p-4 flex items-center gap-3 text-sm text-[#2E8B57] border-[#2E8B57]/30 bg-[#2E8B57]/10"
          role="status"
          aria-live="polite"
        >
          <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p>{status}</p>
        </Surface>
      )}

      {/* ---------------- Security ---------------- */}
      <section className="space-y-4">
        <SectionHeading
          icon={<KeyRound className="h-5 w-5" aria-hidden="true" />}
          title={t('securityTitle')}
          description={t('securityDescription')}
        />

        <Surface variant="bordered" className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#2D1B2D]">{t('pin.title')}</h3>
              <p className="text-sm text-[#5A5A66] leading-relaxed">
                {isPinEnabled ? t('pin.enabledBody') : t('pin.disabledBody')}
              </p>
            </div>
            <div className="flex gap-2 self-start sm:self-auto shrink-0">
              {isPinEnabled ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setPinMode('change')}>
                    {t('pin.changeAction')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPinMode('remove')}>
                    {t('pin.removeAction')}
                  </Button>
                </>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setPinMode('setup')}>
                  {t('pin.enableAction')}
                </Button>
              )}
            </div>
          </div>

          <p className="text-xs text-[#5A5A66] leading-relaxed flex items-start gap-2 pt-3 border-t border-[#E2D8D0]">
            <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            {t('pin.honestNote')}
          </p>
        </Surface>

        <Surface variant="bordered" className="p-5 flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-[#2E8B57]/10 flex items-center justify-center text-[#2E8B57] shrink-0">
            <Calculator className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#2D1B2D]">{t('engine.title')}</h3>
            <p className="text-xs text-[#5A5A66] leading-relaxed">{t('engine.body')}</p>
          </div>
        </Surface>
      </section>

      {/* ---------------- Local data ---------------- */}
      <section className="space-y-4">
        <SectionHeading
          icon={<Database className="h-5 w-5" aria-hidden="true" />}
          title={t('dataTitle')}
          description={t('dataDescription')}
        />

        <Surface variant="bordered" className="p-5 space-y-4">
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <CountStat label={t('data.cycleRecords')} value={counts?.cycles ?? 0} />
            <CountStat label={t('data.dailyRecords')} value={counts?.dailyLogs ?? 0} />
            <CountStat label={t('data.reminderRecords')} value={counts?.reminders ?? 0} />
          </dl>

          <div className="pt-4 border-t border-[#E2D8D0] flex flex-col sm:flex-row gap-2">
            <Button variant="secondary" size="sm" onClick={handleExport} disabled={totalRecords === 0}>
              <Download className="h-4 w-4 mr-1.5" aria-hidden="true" />
              {t('data.exportAction')}
            </Button>
            <Button variant="danger" size="sm" onClick={() => setIsWipeOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
              {t('data.wipeAction')}
            </Button>
          </div>

          <p className="text-xs text-[#5A5A66] leading-relaxed flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-[#2E8B57] shrink-0 mt-0.5" aria-hidden="true" />
            {t('data.exportNote')}
          </p>
        </Surface>
      </section>

      {/* ---------------- PIN dialog ---------------- */}
      <Modal
        isOpen={pinMode !== 'idle'}
        onClose={closePinDialog}
        title={
          pinMode === 'remove'
            ? t('pin.removeTitle')
            : pinMode === 'change'
              ? t('pin.changeTitle')
              : t('pin.setupTitle')
        }
      >
        <div className="space-y-4">
          {pinMode === 'setup' && (
            <p className="text-sm text-[#5A5A66] leading-relaxed flex items-start gap-2">
              <TriangleAlert className="h-4 w-4 text-[#B8860B] shrink-0 mt-0.5" aria-hidden="true" />
              {t('pin.noRecoveryWarning')}
            </p>
          )}

          {pinMode !== 'setup' && (
            <Input
              label={t('pin.currentLabel')}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={PIN_LENGTH}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
              error={pinError ?? undefined}
            />
          )}

          {pinMode !== 'remove' && (
            <>
              <Input
                label={t('pin.newLabel', { length: PIN_LENGTH })}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={PIN_LENGTH}
                value={draft.pin}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, pin: e.target.value.replace(/\D/g, '') }));
                  setPinError(null);
                }}
                error={pinError ?? undefined}
              />
              <Input
                label={t('pin.confirmLabel')}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={PIN_LENGTH}
                value={draft.confirm}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, confirm: e.target.value.replace(/\D/g, '') }));
                  setPinError(null);
                }}
              />
            </>
          )}

          {pinMode === 'remove' && (
            <p className="text-sm text-[#5A5A66] leading-relaxed">{t('pin.removeWarning')}</p>
          )}

          <div className="flex flex-col sm:flex-row-reverse gap-2 pt-2">
            <Button
              variant={pinMode === 'remove' ? 'danger' : 'primary'}
              onClick={pinMode === 'remove' ? handleRemovePin : handleSavePin}
              disabled={isSavingPin}
            >
              {isSavingPin
                ? t('saving')
                : pinMode === 'remove'
                  ? t('pin.removeAction')
                  : t('pin.saveAction')}
            </Button>
            <Button variant="ghost" onClick={closePinDialog} disabled={isSavingPin}>
              {t('cancelAction')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---------------- Wipe confirmation ---------------- */}
      <Modal isOpen={isWipeOpen} onClose={() => setIsWipeOpen(false)} title={t('wipe.title')}>
        <div className="space-y-4">
          <p className="text-sm text-[#5A5A66] leading-relaxed">{t('wipe.message')}</p>
          <Input
            label={t('wipe.confirmLabel', { phrase: t('wipe.confirmPhrase') })}
            value={wipeConfirm}
            onChange={(e) => setWipeConfirm(e.target.value)}
            placeholder={t('wipe.confirmPhrase')}
          />
          <div className="flex flex-col sm:flex-row-reverse gap-2 pt-2">
            <Button
              variant="danger"
              onClick={handleWipe}
              disabled={isWiping || wipeConfirm !== t('wipe.confirmPhrase')}
            >
              {isWiping ? t('wipe.working') : t('wipe.confirmAction')}
            </Button>
            <Button variant="ghost" onClick={() => setIsWipeOpen(false)} disabled={isWiping}>
              {t('cancelAction')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const SectionHeading: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="flex items-start gap-3">
    <div className="h-10 w-10 rounded-xl bg-[#2D1B2D] flex items-center justify-center text-[#FDFBF7] shrink-0">
      {icon}
    </div>
    <div className="space-y-0.5">
      <h2 className="text-xl font-bold text-[#2D1B2D]">{title}</h2>
      <p className="text-sm text-[#5A5A66] leading-relaxed">{description}</p>
    </div>
  </div>
);

const CountStat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E2D8D0] space-y-1">
    <dt className="text-xs font-semibold text-[#5A5A66]">{label}</dt>
    <dd className="text-xl font-bold text-[#2D1B2D] tabular-nums">{value}</dd>
  </div>
);
