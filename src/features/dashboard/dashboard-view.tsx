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
  const tAnalytics = useTranslations('analytics');
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
    <div className="mx-auto max-w-4xl space-y-10">
      {/* ---- Page header and the two things someone came here to do ---- */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#2D1B2D]">{t('title')}</h1>
          <p className="mt-1 text-sm text-[#5A5A66]">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => setIsPeriodModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
            {t('logPeriodAction')}
          </Button>
          <LocaleLink
            href="/health"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[#E2D8D0] px-5 py-2.5 text-base font-medium text-[#1E1E24] transition-colors hover:bg-[#FDFBF7]"
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
          {/* ---- Where the cycle stands today ---- */}
          <section aria-labelledby="dashboard-cycle" className="space-y-4">
            <SectionHeading id="dashboard-cycle">{t('currentStatus')}</SectionHeading>

            {status ? (
              <>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="text-4xl font-bold leading-none text-[#2D1B2D]">
                    {t('dayCount', { day: status.cycleDay })}
                  </span>
                  <Badge variant={status.tone}>{t(status.phaseKey)}</Badge>
                  <span className="text-sm text-[#5A5A66]">{todayIso}</span>
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
              </>
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
          </section>

          {/* ---- The last recorded period, as recorded ---- */}
          {lastPeriod && (
            <section aria-labelledby="dashboard-period" className="space-y-4">
              <SectionHeading id="dashboard-period">{t('recentPeriod')}</SectionHeading>
              <DetailList>
                <DetailRow label={tPeriod('startDate')}>{lastPeriod.startDate}</DetailRow>
                {lastPeriod.endDate ? (
                  <DetailRow label={tPeriod('endDate')}>{lastPeriod.endDate}</DetailRow>
                ) : (
                  <DetailRow label={tPeriod('endDate')}>{tPeriod('ongoing')}</DetailRow>
                )}
                {analytics.period.recordedPeriods > 0 && (
                  <DetailRow label={tAnalytics('periodMostRecent')}>
                    {analytics.period.mostRecentDuration.sufficiency === 'available' &&
                    analytics.period.mostRecentDuration.value !== null
                      ? tAnalytics('daysUnit', {
                          value: Math.round(analytics.period.mostRecentDuration.value),
                        })
                      : NOT_AVAILABLE}
                  </DetailRow>
                )}
              </DetailList>
            </section>
          )}

          {/* ---- Today ---- */}
          <section aria-labelledby="dashboard-today" className="space-y-4">
            <SectionHeading id="dashboard-today">{t('todayLog')}</SectionHeading>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={
                    todayLog
                      ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2E8B57]/10 text-[#2E8B57]'
                      : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F9EBEA] text-[#2D1B2D]'
                  }
                >
                  {todayLog ? (
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Activity className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>
                <p className="text-sm font-medium text-[#1E1E24]">
                  {todayLog ? t('loggedToday') : t('notLoggedToday')}
                </p>
              </div>

              <LocaleLink
                href="/health"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#F9EBEA] px-4 py-2 text-sm font-medium text-[#2D1B2D] transition-colors hover:bg-[#F2D7D5]"
              >
                {t('logTodayAction')}
                <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </LocaleLink>
            </div>

            {todayLog && (
              <DetailList>
                <DetailRow label={tDaily('painLabel')}>
                  {tDaily(PAIN_LABELS[todayLog.painLevel]?.i18nKey ?? PAIN_LABELS[0].i18nKey)} (
                  {todayLog.painLevel})
                </DetailRow>
                <DetailRow label={tDaily('sleepLabel')}>
                  {todayLog.sleepHours > 0 ? todayLog.sleepHours : NOT_AVAILABLE}
                </DetailRow>
                <DetailRow label={tDaily('hydrationLiteral')}>
                  {todayLog.hydrationMl > 0 ? todayLog.hydrationMl : NOT_AVAILABLE}
                </DetailRow>
              </DetailList>
            )}
          </section>

          {/* ---- What the recorded data suggests ---- */}
          <section aria-labelledby="dashboard-insights" className="space-y-4">
            <SectionHeading
              id="dashboard-insights"
              action={
                <LocaleLink
                  href="/insights"
                  className="inline-flex min-h-[40px] items-center text-sm font-medium text-[#2D1B2D] underline underline-offset-4 hover:text-[#C94A46]"
                >
                  {t('seeAllInsights')}
                </LocaleLink>
              }
            >
              {t('recentInsights')}
            </SectionHeading>

            {topInsights.length > 0 ? (
              <ul className="space-y-4">
                {topInsights.map((insight) => {
                  const titleKey = insight.titleKey.replace('insights.', '');
                  const messageKey = insight.messageKey.replace('insights.', '');
                  return (
                    <li key={insight.id} className="space-y-1">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-[#2D1B2D]">
                        <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {tInsights(titleKey, insight.params)}
                      </h3>
                      <p className="text-sm leading-relaxed text-[#5A5A66]">
                        {tInsights(messageKey, insight.params)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-[#5A5A66]">{tInsights('empty')}</p>
            )}
          </section>

          {/* ---- Support: a deterministic assistant, and a community ---- */}
          <section aria-labelledby="dashboard-support" className="space-y-4">
            <SectionHeading id="dashboard-support">{t('askTitle')}</SectionHeading>
            <ul className="divide-y divide-[#F1E7E3]">
              <li>
                <LocaleLink
                  href="/ai-assistant"
                  className="flex items-start gap-3 py-3.5 transition-opacity hover:opacity-80"
                >
                  <Bot className="mt-0.5 h-5 w-5 shrink-0 text-[#2D1B2D]" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[#2D1B2D]">
                      {tNav('aiAssistant')}
                    </span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-[#5A5A66]">
                      {t('askAiBody')}
                    </span>
                  </span>
                </LocaleLink>
              </li>
              <li>
                <LocaleLink
                  href="/secret-chat"
                  className="flex items-start gap-3 py-3.5 transition-opacity hover:opacity-80"
                >
                  <MessageSquare
                    className="mt-0.5 h-5 w-5 shrink-0 text-[#2D1B2D]"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[#2D1B2D]">
                      {tNav('secretChat')}
                    </span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-[#5A5A66]">
                      {t('askSecretChatBody')}
                    </span>
                  </span>
                </LocaleLink>
              </li>
            </ul>
          </section>
        </>
      )}

      <Surface variant="flat" className="flex items-center gap-2 p-3.5 text-xs text-[#5A5A66]">
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
