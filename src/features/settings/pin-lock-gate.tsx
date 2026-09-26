'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Lock, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { LoadingState } from '@/components/ui/state';
import { PreferencesRepository } from '@/lib/db/repositories/preferences-repository';
import { PIN_LENGTH, verifyPin } from '@/lib/security/pin';
import type { UserPreferencesRecord } from '@/types/db';

/**
 * Gate for the personal health system.
 *
 * When no local PIN is set this renders its children untouched, so it adds no
 * cost to the normal path. When a PIN IS set it withholds the children entirely
 * until the correct PIN is entered — content is never briefly visible first.
 *
 * Because the PIN is stored in the same local database as the data it guards,
 * it is a privacy lock against a shared device, not authentication. That limit
 * is stated on the lock screen.
 */
export const PinLockGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const t = useTranslations('settings');

  const [prefs, setPrefs] = React.useState<UserPreferencesRecord | null>(null);
  const [isResolved, setIsResolved] = React.useState(false);
  const [isUnlocked, setIsUnlocked] = React.useState(false);
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isChecking, setIsChecking] = React.useState(false);
  const [isRecoveryOpen, setIsRecoveryOpen] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    PreferencesRepository.getPreferences()
      .then((loaded) => {
        if (active) setPrefs(loaded);
      })
      .catch(() => {
        if (active) setPrefs(null);
      })
      .finally(() => {
        if (active) setIsResolved(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!prefs || isChecking) return;

    setIsChecking(true);
    setError(null);
    try {
      const ok = await verifyPin(pin, prefs);
      if (ok === true) {
        setPin('');
        setError(null);
        setIsUnlocked(true);
        return;
      }
      setError(t('pin.lockWrong'));
    } finally {
      setIsChecking(false);
    }
  };

  if (!isResolved) {
    return <LoadingState className="min-h-screen flex items-center justify-center text-sm text-[#5A5A66]" />;
  }

  if (!prefs?.isPinEnabled || isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="h-14 w-14 rounded-2xl bg-[#2D1B2D] flex items-center justify-center text-[#FDFBF7] mx-auto">
            <Lock className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-[#2D1B2D]">{t('pin.lockTitle')}</h1>
          <p className="text-sm text-[#5A5A66] leading-relaxed">{t('pin.lockSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={PIN_LENGTH}
            label={t('pin.lockLabel')}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''));
              setError(null);
            }}
            error={error ?? undefined}
          />
          <Button type="submit" variant="primary" className="w-full" disabled={pin.length !== PIN_LENGTH || isChecking}>
            {isChecking ? t('saving') : t('pin.unlockAction')}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <button
            type="button"
            onClick={() => setIsRecoveryOpen(true)}
            className="text-xs font-medium text-[#5A5A66] underline underline-offset-2 hover:text-[#2D1B2D] min-h-[40px]"
          >
            {t('pin.forgotAction')}
          </button>
          <p className="text-xs text-[#5A5A66] leading-relaxed flex items-start gap-1.5 text-left">
            <ShieldCheck className="h-3.5 w-3.5 text-[#2E8B57] shrink-0 mt-0.5" aria-hidden="true" />
            {t('pin.lockScopeNote')}
          </p>
        </div>
      </div>

      <Modal isOpen={isRecoveryOpen} onClose={() => setIsRecoveryOpen(false)} title={t('pin.recoveryTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-[#5A5A66] leading-relaxed flex items-start gap-2">
            <TriangleAlert className="h-4 w-4 text-[#C94A46] shrink-0 mt-0.5" aria-hidden="true" />
            {t('pin.recoveryMessage')}
          </p>
          <div className="flex flex-col sm:flex-row-reverse gap-2 pt-2">
            <Button
              variant="danger"
              onClick={async () => {
                const { HealthRepository } = await import('@/lib/db/repositories/health-repository');
                await HealthRepository.clearAllLocalData();
                setIsRecoveryOpen(false);
                window.location.reload();
              }}
            >
              {t('pin.recoveryEraseAction')}
            </Button>
            <Button variant="ghost" onClick={() => setIsRecoveryOpen(false)}>
              {t('cancelAction')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
