'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Activity, ArrowRight, Bot, CheckCircle2, Heart, MessageSquare, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { CycleRepository } from '@/lib/db/repositories/cycle-repository';
import { DailyLogRepository } from '@/lib/db/repositories/daily-log-repository';
import type { CycleDomainModel, DailyLogDomainModel } from '@/types/health';
import { analyzeCycles } from '@/lib/cycle-engine/engine';
import { computeHealthAnalytics } from '@/lib/analytics';
import { getInsights } from '@/lib/insights';
import { PAIN_LABELS } from '@/lib/health/daily-health-options';
import { formatLocalDateIso } from '@/lib/utils/date-utils';
import { PeriodModal } from '@/features/period-logging/period-modal';
import { deriveCycleStatus } from '@/features/shared/cycle-status';
import { LocaleLink } from '@/components/navigation/locale-link';
import { Surface } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';

const NOT_AVAILABLE = '—';

/**
 * Section heading.
 *
 * A rule under the heading does the grouping work, so the page reads as four
 * or five blocks of information rather than a stack of cards.
 */
const SectionHeading: React.FC<{ id: string; children: React.ReactNode; action?: React.ReactNode }> = ({
  id,
  children,
  action,
}) => (
  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#E2D8D0] pb-3">
    <h2 id={id} className="text-lg font-semibold text-[#2D1B2D]">
      {children}
    </h2>
    {action}
  </div>
);

/** One label/value line inside a section. */
const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 py-2.5">
    <dt className="text-sm text-[#5A5A66]">{label}</dt>
    <dd className="text-sm font-medium text-[#1E1E24] text-right break-words">{children}</dd>
  </div>
);

const DetailList: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <dl className="divide-y divide-[#F1E7E3]">{children}</dl>
);

export const DashboardView: React.FC = () => {
  const t = useTranslations('dashboard');
  const tNav = useTranslations('nav');
  const tDaily = useTranslations('dailyHealth');
  const tPeriod = useTranslations('period');
  const tInsights = useTranslations('insights');

  const todayIso = React.useMemo(() => formatLocalDateIso(new Date()), []);

  const [cycles, setCycles] = React.useState<CycleDomainModel[]>([]);
  const [todayLog, setTodayLog] = React.useState<DailyLogDomainModel | undefined>(undefined);
  const [dailyLogs, setDailyLogs] = React.useState<DailyLogDomainModel[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [isPeriodModalOpen, setIsPeriodModalOpen] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [fetchedCycles, fetchedTodayLog, fetchedAllLogs] = await Promise.all([
        CycleRepository.getAllCyclesChronological(),
        DailyLogRepository.getDailyLogByDate(todayIso),
        DailyLogRepository.getAllDailyLogs(),
      ]);
      setCycles(fetchedCycles);
      setTodayLog(fetchedTodayLog);
      setDailyLogs(fetchedAllLogs);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [todayIso]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Pure deterministic cycle analysis
  const cycleAnalysis = React.useMemo(() => analyzeCycles(cycles), [cycles]);
  const status = React.useMemo(
    () => deriveCycleStatus(cycles, todayIso, cycleAnalysis),
    [cycles, todayIso, cycleAnalysis]
  );

  const analytics = React.useMemo(
    () => computeHealthAnalytics({ cycles, dailyLogs, today: todayIso }),
    [cycles, dailyLogs, todayIso]
  );

  // Derived top personalized insights
  const topInsights = React.useMemo(() => {
    if (cycles.length === 0 && dailyLogs.length === 0) return [];
    return getInsights({
      analytics,
      recordedDates: dailyLogs.map((l) => l.date),
      limit: 2,
    });
  }, [analytics, cycles.length, dailyLogs]);

  const lastPeriod = status?.lastCycle ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
      {/* ---- Hero Command Header ---- */}
      <header className="flex flex-col gap-4 rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#2D1B2D] sm:text-3xl">
              {t('title')}
            </h1>
            <span className="rounded-full bg-[#F9EBEA] px-2.5 py-0.5 text-xs font-semibold text-[#2D1B2D]">
              Command Center
            </span>
          </div>
          <p className="text-sm text-[#5A5A66]">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="primary" onClick={() => setIsPeriodModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
            {t('logPeriodAction')}
          </Button>
          <LocaleLink
            href="/health"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] px-4 py-2 text-sm font-semibold text-[#1E1E24] shadow-xs transition-colors hover:bg-[#FDFBF7]"
          >
            <Activity className="h-4 w-4 mr-1.5 text-[#2D1B2D]" aria-hidden="true" />
            {t('logTodayAction')}
          </LocaleLink>
        </div>
      </header>

      {errorMsg && <ErrorState message={errorMsg} onRetry={loadData} />}

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          {/* ---- Top Command Center Grid (2 columns on md) ---- */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* ---- Column 1: Cycle Status Card ---- */}
            <Surface variant="bordered" className="flex flex-col justify-between space-y-4 p-5 sm:p-6">
              <div className="space-y-4">
                <SectionHeading id="dashboard-cycle">{t('currentStatus')}</SectionHeading>

                {status ? (
                  <div className="space-y-4">
                    <div className="flex items-baseline justify-between">
                      <div className="space-y-1">
                        <span className="text-4xl font-extrabold tracking-tight text-[#2D1B2D]">
                          {t('dayCount', { day: status.cycleDay })}
                        </span>
                        <div className="flex items-center gap-2 pt-1">
                          <Badge variant={status.tone}>{t(status.phaseKey)}</Badge>
                          <span className="text-xs text-[#5A5A66]">{todayIso}</span>
                        </div>
                      </div>
                    </div>

                    <DetailList>
                      <DetailRow label={t('nextPeriod')}>
                        {cycleAnalysis.nextPeriod.status === 'predicted'
                          ? cycleAnalysis.nextPeriod.estimatedStartDate
                          : NOT_AVAILABLE}
                      </DetailRow>
                      <DetailRow label={t('fertileWindow')}>
                        {cycleAnalysis.fertileWindow.status === 'estimated'
                          ? `${cycleAnalysis.fertileWindow.startDate} ${NOT_AVAILABLE} ${cycleAnalysis.fertileWindow.endDate}`
                          : NOT_AVAILABLE}
                      </DetailRow>
                      <DetailRow label={t('cycleSummary')}>
                        {cycleAnalysis.stats
                          ? t('cycleSummaryValue', {
                              days: cycleAnalysis.stats.averageCycleLength,
                              count: cycleAnalysis.stats.sampleSize,
                            })
                          : NOT_AVAILABLE}
                      </DetailRow>
                    </DetailList>
                  </div>
                ) : (
                  <EmptyState
                    icon={<Heart className="h-6 w-6" />}
                    title={t('welcomeTitle')}
                    description={t('noCycleData')}
                    action={
                      <Button variant="primary" onClick={() => setIsPeriodModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                        {t('logPeriodAction')}
                      </Button>
                    }
                  />
                )}
              </div>
            </Surface>

            {/* ---- Column 2: Today's Health Snapshot ---- */}
            <Surface variant="bordered" className="flex flex-col justify-between space-y-4 p-5 sm:p-6">
              <div className="space-y-4">
                <SectionHeading id="dashboard-today">{t('todayLog')}</SectionHeading>

                <div className="rounded-xl border border-[#E2D8D0]/80 bg-[#FDFBF7] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={
                          todayLog
                            ? 'flex h-8 w-8 items-center justify-center rounded-lg bg-[#2E8B57]/15 text-[#2E8B57]'
                            : 'flex h-8 w-8 items-center justify-center rounded-lg bg-[#F9EBEA] text-[#2D1B2D]'
                        }
                      >
                        {todayLog ? (
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Activity className="h-4 w-4" aria-hidden="true" />
                        )}
                      </span>
                      <p className="text-sm font-semibold text-[#1E1E24]">
                        {todayLog ? t('loggedToday') : t('notLoggedToday')}
                      </p>
                    </div>

                    <LocaleLink
                      href="/health"
                      className="inline-flex min-h-[36px] items-center text-xs font-semibold text-[#2D1B2D] hover:underline"
                    >
                      {t('logTodayAction')}
                      <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                    </LocaleLink>
                  </div>

                  {todayLog ? (
                    <DetailList>
                      <DetailRow label={tDaily('painLabel')}>
                        {tDaily(PAIN_LABELS[todayLog.painLevel]?.i18nKey ?? PAIN_LABELS[0].i18nKey)} (
                        {todayLog.painLevel})
                      </DetailRow>
                      <DetailRow label={tDaily('sleepLabel')}>
                        {todayLog.sleepHours > 0 ? `${todayLog.sleepHours} hrs` : NOT_AVAILABLE}
                      </DetailRow>
                      <DetailRow label={tDaily('hydrationLiteral')}>
                        {todayLog.hydrationMl > 0 ? `${todayLog.hydrationMl} ml` : NOT_AVAILABLE}
                      </DetailRow>
                    </DetailList>
                  ) : (
                    <p className="text-xs text-[#5A5A66] leading-relaxed">
                      Track symptoms, sleep, hydration, and mood to get personalized health insights.
                    </p>
                  )}
                </div>
              </div>

              {lastPeriod && (
                <div className="border-t border-[#E2D8D0] pt-3">
                  <div className="flex items-center justify-between text-xs text-[#5A5A66]">
                    <span>{t('recentPeriod')}: {lastPeriod.startDate}</span>
                    <span className="font-medium text-[#2D1B2D]">
                      {lastPeriod.endDate ? lastPeriod.endDate : tPeriod('ongoing')}
                    </span>
                  </div>
                </div>
              )}
            </Surface>
          </div>

          {/* ---- Middle Grid: Personal Insights & Observations ---- */}
          <section aria-labelledby="dashboard-insights" className="space-y-4">
            <SectionHeading
              id="dashboard-insights"
              action={
                <LocaleLink
                  href="/insights"
                  className="inline-flex min-h-[36px] items-center text-xs font-semibold text-[#2D1B2D] underline underline-offset-4 hover:text-[#C94A46]"
                >
                  {t('seeAllInsights')}
                </LocaleLink>
              }
            >
              {t('recentInsights')}
            </SectionHeading>

            {topInsights.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {topInsights.map((insight) => {
                  const titleKey = insight.titleKey.replace('insights.', '');
                  const messageKey = insight.messageKey.replace('insights.', '');
                  return (
                    <Surface key={insight.id} variant="bordered" className="p-4 space-y-2">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-[#2D1B2D]">
                        <Sparkles className="h-4 w-4 shrink-0 text-[#E8837D]" aria-hidden="true" />
                        {tInsights(titleKey, insight.params)}
                      </h3>
                      <p className="text-xs leading-relaxed text-[#5A5A66]">
                        {tInsights(messageKey, insight.params)}
                      </p>
                    </Surface>
                  );
                })}
              </div>
            ) : (
              <Surface variant="bordered" className="p-4 text-center">
                <p className="text-sm text-[#5A5A66]">{tInsights('empty')}</p>
              </Surface>
            )}
          </section>

          {/* ---- Quick Explore & Community Portals ---- */}
          <section aria-labelledby="dashboard-support" className="space-y-4">
            <SectionHeading id="dashboard-support">{t('askTitle')}</SectionHeading>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Surface variant="bordered" className="p-4 transition-all hover:border-[#E8837D]">
                <LocaleLink href="/ai-assistant" className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2D1B2D] text-[#FDFBF7]">
                    <Bot className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-sm font-bold text-[#2D1B2D]">
                      {tNav('aiAssistant')}
                    </span>
                    <span className="block text-xs leading-relaxed text-[#5A5A66]">
                      {t('askAiBody')}
                    </span>
                  </div>
                </LocaleLink>
              </Surface>

              <Surface variant="bordered" className="p-4 transition-all hover:border-[#E8837D]">
                <LocaleLink href="/secret-chat" className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2D1B2D] text-[#FDFBF7]">
                    <MessageSquare className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-sm font-bold text-[#2D1B2D]">
                      {tNav('secretChat')}
                    </span>
                    <span className="block text-xs leading-relaxed text-[#5A5A66]">
                      {t('askSecretChatBody')}
                    </span>
                  </div>
                </LocaleLink>
              </Surface>
            </div>
          </section>
        </>
      )}

      {/* ---- Offline & Privacy Guarantee Footer ---- */}
      <Surface variant="flat" className="flex items-center gap-2.5 p-4 text-xs text-[#5A5A66]">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[#2E8B57]" aria-hidden="true" />
        <span>{t('privacyFooter')}</span>
      </Surface>

      <PeriodModal
        isOpen={isPeriodModalOpen}
        onClose={() => setIsPeriodModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
};
