'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Bell, BellOff, Clock, Info, TriangleAlert, Check } from 'lucide-react';
import { Surface } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/ui/state';
import { ReminderRepository } from '@/lib/db/repositories/reminder-repository';
import { CycleRepository } from '@/lib/db/repositories/cycle-repository';
import { analyzeCycles } from '@/lib/cycle-engine';
import { resolveReminderSchedule, type ReminderSchedule } from '@/lib/reminders/schedule';
import { formatLocalDateIso } from '@/lib/utils/date-utils';
import {
  getNotificationSupport,
  requestNotificationPermission,
  showReminderNotification,
  type NotificationSupport,
} from '@/lib/reminders/notifications';
import {
  MAX_LEAD_DAYS,
  MIN_LEAD_DAYS,
  isValidLeadDays,
  normalizeTimeOfDay,
  type ReminderKind,
  type ReminderRecord,
} from '@/types/reminders';
import type { CycleDomainModel } from '@/types/health';

const REMINDER_ORDER: ReminderKind[] = ['periodExpectation', 'dailyCheckIn'];

interface RemindersData {
  reminders: ReminderRecord[];
  prediction: ReturnType<typeof analyzeCycles>['nextPeriod'];
}

const TICK_MS = 30_000;

/**
 * Delivers a reminder while PMSify is open in a tab.
 *
 * PMSify has no background push service, so this cannot fire when the app is
 * fully closed — the Reminders screen states that limit explicitly rather than
 * hiding it. Within an open session each schedule fires at most once.
 */
function useReminderDelivery(schedules: Record<ReminderKind, ReminderSchedule> | null) {
  const t = useTranslations('reminders');
  const firedRef = React.useRef<Set<ReminderKind>>(new Set());

  React.useEffect(() => {
    if (!schedules) return;

    const attempt = () => {
      if (getNotificationSupport() !== 'granted') return;

      for (const kind of REMINDER_ORDER) {
        const schedule = schedules[kind];
        if (schedule.status !== 'scheduled' || !schedule.at) continue;
        if (firedRef.current.has(kind)) continue;

        // Lexicographic comparison is valid for 'YYYY-MM-DDTHH:MM'.
        if (schedule.at <= localMinuteStamp()) {
          firedRef.current.add(kind);
          showReminderNotification({
            title: t(`${kind}.notificationTitle`),
            body: t('notificationBody'),
            tag: `pmsify-reminder-${kind}`,
          });
        }
      }
    };

    attempt();
    const id = window.setInterval(attempt, TICK_MS);
    return () => window.clearInterval(id);
  }, [schedules, t]);
}

function localMinuteStamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${formatLocalDateIso(now)}T${hours}:${minutes}`;
}

export const RemindersView: React.FC = () => {
  const t = useTranslations('reminders');

  const [data, setData] = React.useState<RemindersData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [support, setSupport] = React.useState<NotificationSupport>('default');

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [reminders, cycles] = await Promise.all([
        ReminderRepository.getAllReminders(),
        CycleRepository.getAllCyclesChronological(),
      ]);
      setData({ reminders, prediction: analyzeCycles(cycles as CycleDomainModel[]).nextPeriod });
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    setSupport(getNotificationSupport());
  }, [load]);

  /** Single source of truth for "when does this next fire". */
  const schedules = React.useMemo<Record<ReminderKind, ReminderSchedule> | null>(() => {
    if (!data) return null;
    const byKind = new Map(data.reminders.map((r) => [r.id, r]));
    return {
      periodExpectation: resolveReminderSchedule(
        byKind.get('periodExpectation')!,
        new Date(),
        data.prediction
      ),
      dailyCheckIn: resolveReminderSchedule(byKind.get('dailyCheckIn')!, new Date()),
    };
  }, [data]);

  const persist = React.useCallback(
    async (next: ReminderRecord) => {
      setSaveError(null);
      try {
        await ReminderRepository.upsertReminder(next);
        await load();
      } catch (err) {
        setSaveError((err as Error).message);
      }
    },
    [load]
  );

  const handleToggle = React.useCallback(
    async (reminder: ReminderRecord, enabled: boolean) => {
      if (enabled && getNotificationSupport() === 'default') {
        await requestNotificationPermission();
        setSupport(getNotificationSupport());
      }
      await persist({ ...reminder, isEnabled: enabled });
    },
    [persist]
  );

  const handleTimeChange = React.useCallback(
    async (reminder: ReminderRecord, value: string) => {
      const normalized = normalizeTimeOfDay(value);
      if (!normalized) {
        setSaveError(t('validation.invalidTime'));
        return;
      }
      await persist({ ...reminder, timeOfDay: normalized });
    },
    [persist, t]
  );

  const handleLeadChange = React.useCallback(
    async (reminder: ReminderRecord, value: number) => {
      if (!isValidLeadDays(value)) {
        setSaveError(t('validation.invalidLead'));
        return;
      }
      await persist({ ...reminder, leadDays: value });
    },
    [persist, t]
  );

  const handleSendTest = React.useCallback(() => {
    const shown = showReminderNotification({
      title: t('testTitle'),
      body: t('testBody'),
      tag: 'pmsify-reminder-test',
    });
    if (!shown) {
      setSaveError(t('testFailed'));
    } else {
      setSaveError(null);
    }
  }, [t]);

  useReminderDelivery(schedules);

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#2D1B2D]">{t('title')}</h1>
          <p className="text-sm text-[#5A5A66] mt-1">{t('subtitle')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSendTest}
          disabled={support !== 'granted'}
        >
          <Bell className="h-4 w-4 mr-1.5" aria-hidden="true" />
          {t('sendTest')}
        </Button>
      </header>

      {/* Notification capability — stated honestly, never implied. */}
      <SupportBanner support={support} onRequest={async () => {
        await requestNotificationPermission();
        setSupport(getNotificationSupport());
      }} />

      {saveError && <ErrorState message={saveError} onRetry={load} />}

      {isLoading ? (
        <LoadingState />
      ) : errorMsg ? (
        <ErrorState message={errorMsg} onRetry={load} />
      ) : (
        <div className="space-y-4">
          {REMINDER_ORDER.map((kind) => {
            const reminder = data?.reminders.find((r) => r.id === kind);
            const schedule = schedules?.[kind];
            if (!reminder) return null;

            return (
              <ReminderCard
                key={kind}
                reminder={reminder}
                schedule={schedule}
                onToggle={(enabled) => void handleToggle(reminder, enabled)}
                onTimeChange={(value) => void handleTimeChange(reminder, value)}
                onLeadChange={(value) => void handleLeadChange(reminder, value)}
              />
            );
          })}
        </div>
      )}

      <Surface variant="bordered" className="p-5 flex items-start gap-3">
        <Info className="h-5 w-5 text-[#5A5A66] shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-[#5A5A66] leading-relaxed">{t('limitationWhileClosed')}</p>
      </Surface>
    </div>
  );
};

const SupportBanner: React.FC<{
  support: NotificationSupport;
  onRequest: () => void;
}> = ({ support, onRequest }) => {
  const t = useTranslations('reminders');

  if (support === 'unsupported') {
    return (
      <Surface variant="bordered" className="p-4 flex items-start gap-3">
        <TriangleAlert className="h-5 w-5 text-[#B8860B] shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-[#5A5A66] leading-relaxed">{t('supportUnsupported')}</p>
      </Surface>
    );
  }

  if (support === 'denied') {
    return (
      <Surface variant="bordered" className="p-4 flex items-start gap-3">
        <BellOff className="h-5 w-5 text-[#C94A46] shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-[#5A5A66] leading-relaxed">{t('supportDenied')}</p>
      </Surface>
    );
  }

  if (support === 'default') {
    return (
      <Surface variant="bordered" className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-[#5A5A66] leading-relaxed">{t('supportPrompt')}</p>
        <Button variant="secondary" size="sm" onClick={onRequest} className="self-start sm:self-auto">
          {t('enableNotifications')}
        </Button>
      </Surface>
    );
  }

  return null;
};

interface ReminderCardProps {
  reminder: ReminderRecord;
  schedule?: ReminderSchedule;
  onToggle: (enabled: boolean) => void;
  onTimeChange: (value: string) => void;
  onLeadChange: (value: number) => void;
}

const ReminderCard: React.FC<ReminderCardProps> = ({
  reminder,
  schedule,
  onToggle,
  onTimeChange,
  onLeadChange,
}) => {
  const t = useTranslations('reminders');
  const isPeriod = reminder.id === 'periodExpectation';

  return (
    <Surface variant="bordered" className="p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-[#2D1B2D]">{t(`${reminder.id}.title`)}</h2>
          <p className="text-sm text-[#5A5A66] leading-relaxed">{t(`${reminder.id}.description`)}</p>
        </div>
        <Toggle checked={reminder.isEnabled} onChange={onToggle} label={t(`${reminder.id}.title`)} />
      </div>

      <ScheduleStatus status={schedule?.status} at={schedule?.at} date={schedule?.date} />

      <fieldset
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E2D8D0]"
        disabled={!reminder.isEnabled}
      >
        <legend className="sr-only">{t('scheduleHeading')}</legend>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`time-${reminder.id}`} className="text-sm font-medium text-[#1E1E24]">
            {t('timeLabel')}
          </label>
          <div className="relative">
            <Clock
              className="h-4 w-4 text-[#5A5A66] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id={`time-${reminder.id}`}
              type="time"
              value={reminder.timeOfDay}
              onChange={(e) => onTimeChange(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] pl-10 pr-4 text-base text-[#1E1E24] disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        {isPeriod && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`lead-${reminder.id}`} className="text-sm font-medium text-[#1E1E24]">
              {t('leadLabel')}
            </label>
            <select
              id={`lead-${reminder.id}`}
              value={reminder.leadDays}
              onChange={(e) => onLeadChange(Number(e.target.value))}
              className="min-h-[48px] w-full rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] px-4 text-base text-[#1E1E24] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {Array.from({ length: MAX_LEAD_DAYS - MIN_LEAD_DAYS + 1 }, (_, i) => i + MIN_LEAD_DAYS).map(
                (days) => (
                  <option key={days} value={days}>
                    {t('leadValue', { days })}
                  </option>
                )
              )}
            </select>
          </div>
        )}
      </fieldset>
    </Surface>
  );
};

const ScheduleStatus: React.FC<{
  status?: ReminderSchedule['status'];
  at?: string;
  date?: string;
}> = ({ status, at, date }) => {
  const t = useTranslations('reminders');
  if (!status) return null;

  if (status === 'disabled') {
    return (
      <p className="text-xs font-medium text-[#5A5A66] flex items-center gap-2">
        <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
        {t('status.disabled')}
      </p>
    );
  }

  if (status === 'scheduled') {
    return (
      <p className="text-xs font-medium text-[#2E8B57] flex items-center gap-2">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        {t('status.scheduled', { date, time: at?.slice(11) })}
      </p>
    );
  }

  return (
    <p className="text-xs font-medium text-[#B8860B] flex items-center gap-2">
      <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
      {status === 'no_prediction' ? t('status.noPrediction') : t('status.alreadyPassed')}
    </p>
  );
};

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative shrink-0 w-14 h-8 rounded-full transition-colors ${
      checked ? 'bg-[#2E8B57]' : 'bg-[#5A5A66]/30'
    }`}
  >
    <span
      className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
      aria-hidden="true"
    />
  </button>
);
