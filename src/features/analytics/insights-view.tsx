'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CycleRepository } from '@/lib/db/repositories/cycle-repository';
import { DailyLogRepository } from '@/lib/db/repositories/daily-log-repository';
import {
  computeHealthAnalytics,
  type HealthAnalytics,
  type AnalyticsValue,
} from '@/lib/analytics';
import { getInsights, type PersonalInsight } from '@/lib/insights';
import { SYMPTOM_OPTIONS, MOOD_OPTIONS } from '@/lib/health/daily-health-options';
import { todayIso } from '@/lib/health/date-utils';
import type { CycleDomainModel, DailyLogDomainModel } from '@/types/health';
import { Activity, Check, HeartHandshake, ShieldCheck, Info } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';

type RangeKey = 'all' | 'recent';

const RECENT_DAYS = 90;

function recentStart(today: string, days: number): string {
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString().split('T')[0];
}

function formatNumber(value: number, decimals = 1): string {
  const rounded = Math.round(value * 10 ** decimals) / 10 ** decimals;
  return String(rounded);
}

function symptomLabelKey(id: string): string {
  const opt = SYMPTOM_OPTIONS.find((o) => o.id === id);
  return opt ? opt.i18nKey : id;
}

function moodLabelKey(id: string): string {
  const opt = MOOD_OPTIONS.find((o) => o.id === id);
  return opt ? opt.i18nKey : id;
}

function StatRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-[#5A5A66]">{label}</dt>
      <dd className="text-sm font-semibold text-[#2D1B2D] text-right whitespace-nowrap">
        {children}
      </dd>
    </div>
  );
}

/** Renders an analytics value with proper available / insufficient / no_data handling. */
function StatValue({
  value,
  t,
  formatter,
}: {
  value: AnalyticsValue;
  t: (key: string) => string;
  formatter?: (v: number) => string;
}) {
  if (value.sufficiency === 'available' && value.value !== null) {
    return <>{formatter ? formatter(value.value) : formatNumber(value.value)}</>;
  }
  const key = value.messageKey ?? 'analytics.noData';
  const msg = key.startsWith('analytics.') ? t(key.slice('analytics.'.length)) : key;
  return <span className="font-normal italic text-[#5A5A66]">{msg}</span>;
}

function SectionTitle({
  id,
  children,
  hint,
}: {
  id: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="pb-3 border-b border-[#E2D8D0]">
      <h2
        id={id}
        className="text-sm font-semibold uppercase tracking-wide text-[#2D1B2D]"
      >
        {children}
      </h2>
      {hint && <p className="text-xs text-[#5A5A66] mt-0.5">{hint}</p>}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[#5A5A66] py-2 italic">{children}</p>;
}

/**
 * One insight, ordered by how much it should change what the reader does next:
 * the pattern, then why it may matter, then what to keep recording.
 */
function InsightItem({ title, message }: { title: string; message: string }) {
  return (
    <li className="border-l-2 border-[#2D1B2D] pl-4">
      <h3 className="text-sm font-semibold text-[#2D1B2D]">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-[#5A5A66]">{message}</p>
    </li>
  );
}

export const InsightsView: React.FC = () => {
  const t = useTranslations('analytics');
  const tInsights = useTranslations('insights');
  const tDaily = useTranslations('dailyHealth');
  const tPeriod = useTranslations('period');
  const tCommon = useTranslations('common');

  const [range, setRange] = React.useState<RangeKey>('all');
  const [cycles, setCycles] = React.useState<CycleDomainModel[]>([]);
  const [dailyLogs, setDailyLogs] = React.useState<DailyLogDomainModel[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const [c, d] = await Promise.all([
          CycleRepository.getAllCyclesChronological(),
          DailyLogRepository.getAllDailyLogs(),
        ]);
        if (!cancelled) {
          setCycles(c);
          setDailyLogs(d);
        }
      } catch (err) {
        if (!cancelled) setErrorMsg((err as Error).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = todayIso();

  const analytics: HealthAnalytics = React.useMemo(() => {
    return computeHealthAnalytics({
      cycles,
      dailyLogs,
      today,
      range:
        range === 'recent'
          ? { startDate: recentStart(today, RECENT_DAYS), endDate: today }
          : undefined,
    });
  }, [cycles, dailyLogs, range, today]);

  const fullAnalytics: HealthAnalytics = React.useMemo(() => {
    return computeHealthAnalytics({ cycles, dailyLogs, today });
  }, [cycles, dailyLogs, today]);

  const personalInsightsResult: PersonalInsight[] = React.useMemo(() => {
    if (cycles.length === 0 && dailyLogs.length === 0) return [];
    const recordedDates = dailyLogs.map((l) => l.date);
    return getInsights({ analytics: fullAnalytics, recordedDates, limit: 3 });
  }, [fullAnalytics, cycles, dailyLogs]);

  const hasAnyData = cycles.length > 0 || dailyLogs.length > 0;
  // A day counts even when only sleep or hydration was filled in, so the gate
  // has to look at every daily metric rather than the symptom ones alone.
  const hasDailyData =
    analytics.symptoms.sufficiency !== 'no_data' ||
    analytics.mood.sufficiency !== 'no_data' ||
    analytics.pain.sufficiency !== 'no_data' ||
    analytics.sleep.sufficiency !== 'no_data' ||
    analytics.hydration.sufficiency !== 'no_data';

  const recentDates = [...analytics.pain.trend]
    .slice(-RECENT_DAYS)
    .map((p) => p.date);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2D1B2D]/5 text-[#2D1B2D]">
          <Activity className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-[#2D1B2D]">{t('title')}</h1>
          <p className="mt-1 text-sm text-[#5A5A66]">{t('subtitle')}</p>
        </div>
      </header>

      <div className="flex items-center gap-2 text-xs text-[#5A5A66]">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[#2E8B57]" aria-hidden="true" />
        <span>{tCommon('offlineMode')}</span>
      </div>

      {errorMsg && <ErrorState message={errorMsg} />}

      {isLoading ? (
        <LoadingState label={t('loading')} />
      ) : !hasAnyData ? (
        <EmptyState
          icon={<Activity className="h-6 w-6" />}
          title={t('noData')}
          description={t('noDataHint')}
        />
      ) : (
        <>
          {/* Range scopes every figure below it. */}
          <div className="flex flex-wrap items-center gap-3">
            <span id="insights-range-label" className="text-sm text-[#5A5A66]">
              {t('rangeLabel')}
            </span>
            <div
              role="group"
              aria-labelledby="insights-range-label"
              className="inline-flex rounded-xl border border-[#E2D8D0] overflow-hidden"
            >
              <button
                type="button"
                aria-pressed={range === 'all'}
                onClick={() => setRange('all')}
                className={`px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8837D] focus-visible:ring-inset ${
                  range === 'all'
                    ? 'bg-[#2D1B2D] text-[#FDFBF7]'
                    : 'bg-[#FFFFFF] text-[#1E1E24] hover:bg-[#F9EBEA]'
                }`}
              >
                {t('rangeAll')}
              </button>
              <button
                type="button"
                aria-pressed={range === 'recent'}
                onClick={() => setRange('recent')}
                className={`px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8837D] focus-visible:ring-inset ${
                  range === 'recent'
                    ? 'bg-[#2D1B2D] text-[#FDFBF7]'
                    : 'bg-[#FFFFFF] text-[#1E1E24] hover:bg-[#F9EBEA]'
                }`}
              >
                {t('rangeRecentDays', { count: RECENT_DAYS })}
              </button>
            </div>
          </div>

          {/* What stands out, and what to do about it. */}
          <section aria-labelledby="insights-pattern" className="space-y-4">
            <SectionTitle id="insights-pattern">{tInsights('sectionTitle')}</SectionTitle>
            {personalInsightsResult.length > 0 ? (
              <>
                <p className="text-xs text-[#5A5A66]">{tInsights('basedOn')}</p>
                <ul className="space-y-4">
                  {personalInsightsResult.map((insight) => (
                    <InsightItem
                      key={insight.id}
                      title={tInsights(insight.titleKey.replace('insights.', ''), insight.params ?? {})}
                      message={tInsights(
                        insight.messageKey.replace('insights.', ''),
                        insight.params ?? {}
                      )}
                    />
                  ))}
                </ul>
              </>
            ) : (
              <EmptyNote>{tInsights('empty')}</EmptyNote>
            )}
          </section>

          <div className="border-t border-[#E2D8D0]" aria-hidden="true" />

          {/* Cycle section */}
          <section aria-labelledby="insights-cycle" className="space-y-4">
            <SectionTitle id="insights-cycle">{t('sectionCycle')}</SectionTitle>
            {analytics.cycle.recordedCycles === 0 ? (
              <EmptyNote>{t('noCycleData')}</EmptyNote>
            ) : (
              <dl className="divide-y divide-[#F1E7E3]">
                <StatRow label={t('cycleRecordedCycles')}>
                  {analytics.cycle.recordedCycles}
                </StatRow>
                <StatRow label={t('cycleAverage')}>
                  <StatValue value={analytics.cycle.averageCycleLength} t={t} formatter={(v) => t('daysUnit', { value: formatNumber(v) })} />
                </StatRow>
                <StatRow label={t('cycleShortest')}>
                  <StatValue value={analytics.cycle.shortestCycle} t={t} formatter={(v) => t('daysUnit', { value: formatNumber(v, 0) })} />
                </StatRow>
                <StatRow label={t('cycleLongest')}>
                  <StatValue value={analytics.cycle.longestCycle} t={t} formatter={(v) => t('daysUnit', { value: formatNumber(v, 0) })} />
                </StatRow>
                <StatRow label={t('cycleMostRecent')}>
                  <StatValue value={analytics.cycle.mostRecentCycleLength} t={t} formatter={(v) => t('daysUnit', { value: formatNumber(v, 0) })} />
                </StatRow>
                <StatRow label={t('cyclePredictionAvailable')}>
                  {analytics.cycle.predictionAvailable ? (
                    <span className="inline-flex items-center gap-1.5 text-[#2E8B57]">
                      <Check className="h-4 w-4" aria-hidden="true" />
                      {t('cyclePredictionReady')}
                    </span>
                  ) : (
                    <span className="font-normal text-[#5A5A66]">
                      {t('cyclePredictionUnavailable')}
                    </span>
                  )}
                </StatRow>
              </dl>
            )}

            {analytics.trends.cycleLengths.length > 1 && (
              <div className="pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#5A5A66]">
                  {t('cycleTrendHeading')}
                </h3>
                <p className="text-xs text-[#5A5A66] mt-0.5">{t('cycleTrendHint')}</p>
                <ol
                  aria-label={t('cycleTrendSeries')}
                  className="mt-3 flex flex-wrap gap-1.5"
                >
                  {[...analytics.trends.cycleLengths].reverse().map((p) => (
                    <li
                      key={p.startDate}
                      className="px-2 py-1 rounded-lg bg-[#F9EBEA]/70 text-xs font-medium text-[#2D1B2D]"
                      title={p.startDate}
                    >
                      {t('daysUnit', { value: formatNumber(p.cycleLengthDays, 0) })}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>

          <div className="border-t border-[#E2D8D0]" aria-hidden="true" />

          {/* Period section */}
          <section aria-labelledby="insights-period" className="space-y-4">
            <SectionTitle id="insights-period">{t('sectionPeriod')}</SectionTitle>
            {analytics.period.recordedPeriods === 0 ? (
              <EmptyNote>{t('noCycleData')}</EmptyNote>
            ) : (
              <dl className="divide-y divide-[#F1E7E3]">
                <StatRow label={t('periodRecorded')}>
                  {analytics.period.recordedPeriods}
                </StatRow>
                <StatRow label={t('periodAverage')}>
                  <StatValue value={analytics.period.averageDuration} t={t} formatter={(v) => t('daysUnit', { value: formatNumber(v) })} />
                </StatRow>
                <StatRow label={t('periodShortest')}>
                  <StatValue value={analytics.period.shortestDuration} t={t} formatter={(v) => t('daysUnit', { value: formatNumber(v, 0) })} />
                </StatRow>
                <StatRow label={t('periodLongest')}>
                  <StatValue value={analytics.period.longestDuration} t={t} formatter={(v) => t('daysUnit', { value: formatNumber(v, 0) })} />
                </StatRow>
                <StatRow label={t('periodMostRecent')}>
                  <StatValue value={analytics.period.mostRecentDuration} t={t} formatter={(v) => t('daysUnit', { value: formatNumber(v, 0) })} />
                </StatRow>
                {analytics.period.ongoingPeriod && (
                  <StatRow label={t('periodOngoing')}>{tPeriod('ongoing')}</StatRow>
                )}
                {analytics.period.flowDistribution.length > 0 && (
                  <StatRow label={t('flowDistribution')}>
                    <span className="font-normal">
                      {analytics.period.flowDistribution
                        .map((d) => `${tPeriod('flow' + d.level[0].toUpperCase() + d.level.slice(1))} (${d.count})`)
                        .join(' · ')}
                    </span>
                  </StatRow>
                )}
              </dl>
            )}
          </section>

          <div className="border-t border-[#E2D8D0]" aria-hidden="true" />

          {/* Daily health section */}
          {hasDailyData ? (
            <section aria-labelledby="insights-daily" className="space-y-6">
              <SectionTitle
                id="insights-daily"
                hint={recentDates.length ? `${recentDates[0]} — ${recentDates[recentDates.length - 1]}` : undefined}
              >
                {t('sectionDailyHealth')}
              </SectionTitle>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[#1E1E24]">{t('sectionPain')}</h3>
                <dl className="divide-y divide-[#F1E7E3]">
                  <StatRow label={t('painAverage')}>
                    <StatValue value={analytics.pain.average} t={t} formatter={(v) => `${formatNumber(v)} / 10`} />
                  </StatRow>
                  <StatRow label={t('painHighest')}>
                    <StatValue value={analytics.pain.highest} t={t} formatter={(v) => `${formatNumber(v, 0)} / 10`} />
                  </StatRow>
                  <StatRow label={t('painLowest')}>
                    <StatValue value={analytics.pain.lowest} t={t} formatter={(v) => `${formatNumber(v, 0)} / 10`} />
                  </StatRow>
                </dl>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[#1E1E24]">{t('sectionSleep')}</h3>
                <dl className="divide-y divide-[#F1E7E3]">
                  <StatRow label={t('sleepAverage')}>
                    <StatValue value={analytics.sleep.average} t={t} formatter={(v) => t('hoursUnit', { value: formatNumber(v) })} />
                  </StatRow>
                  <StatRow label={t('sleepMinimum')}>
                    <StatValue value={analytics.sleep.minimum} t={t} formatter={(v) => t('hoursUnit', { value: formatNumber(v) })} />
                  </StatRow>
                  <StatRow label={t('sleepMaximum')}>
                    <StatValue value={analytics.sleep.maximum} t={t} formatter={(v) => t('hoursUnit', { value: formatNumber(v) })} />
                  </StatRow>
                </dl>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[#1E1E24]">{t('sectionHydration')}</h3>
                <dl className="divide-y divide-[#F1E7E3]">
                  <StatRow label={t('hydrationAverage')}>
                    <StatValue value={analytics.hydration.average} t={t} formatter={(v) => t('litersUnit', { value: formatNumber(v / 1000) })} />
                  </StatRow>
                  <StatRow label={t('hydrationMinimum')}>
                    <StatValue value={analytics.hydration.minimum} t={t} formatter={(v) => t('litersUnit', { value: formatNumber(v / 1000) })} />
                  </StatRow>
                  <StatRow label={t('hydrationMaximum')}>
                    <StatValue value={analytics.hydration.maximum} t={t} formatter={(v) => t('litersUnit', { value: formatNumber(v / 1000) })} />
                  </StatRow>
                </dl>
              </div>
            </section>
          ) : (
            <section aria-labelledby="insights-daily-empty" className="space-y-4">
              <SectionTitle id="insights-daily-empty">{t('sectionDailyHealth')}</SectionTitle>
              <EmptyNote>{t('noDailyData')}</EmptyNote>
            </section>
          )}

          <div className="border-t border-[#E2D8D0]" aria-hidden="true" />

          {/* Symptoms & Mood */}
          <section aria-labelledby="insights-patterns" className="space-y-6">
            <h2 id="insights-patterns" className="sr-only">
              {t('sectionSymptoms')}
            </h2>
            <div className="space-y-3">
              <SectionTitle id="insights-patterns-symptoms">
                {t('sectionSymptoms')}
              </SectionTitle>
              {analytics.symptoms.sufficiency === 'no_data' ? (
                <EmptyNote>{t('noDailyData')}</EmptyNote>
              ) : (
                <ul className="space-y-1.5">
                  {analytics.symptoms.mostFrequent.map((f) => (
                    <li key={f.id} className="flex items-baseline justify-between gap-4">
                      <span className="text-sm text-[#1E1E24]">
                        {tDaily(symptomLabelKey(f.id))}
                      </span>
                      <span className="text-xs text-[#5A5A66] whitespace-nowrap">
                        {t('recordedOnDays', { count: f.count })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-3">
              <SectionTitle id="insights-patterns-mood">{t('sectionMood')}</SectionTitle>
              {analytics.mood.sufficiency === 'no_data' ? (
                <EmptyNote>{t('noDailyData')}</EmptyNote>
              ) : (
                <ul className="space-y-1.5">
                  {analytics.mood.mostFrequent.map((f) => (
                    <li key={f.id} className="flex items-baseline justify-between gap-4">
                      <span className="text-sm text-[#1E1E24]">
                        {tDaily(moodLabelKey(f.id))}
                      </span>
                      <span className="text-xs text-[#5A5A66] whitespace-nowrap">
                        {t('recordedOnDays', { count: f.count })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Keeping expectations honest about what these figures are. */}
          <section aria-labelledby="insights-care" className="space-y-3 rounded-xl bg-[#F9EBEA]/50 p-4">
            <h2
              id="insights-care"
              className="flex items-center gap-2 text-sm font-semibold text-[#2D1B2D]"
            >
              <HeartHandshake className="h-4 w-4 shrink-0" aria-hidden="true" />
              {tInsights('careTitle')}
            </h2>
            <p className="text-sm leading-relaxed text-[#5A5A66]">{tInsights('careBody')}</p>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-[#5A5A66]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {tInsights('notMedicalAdvice')}
            </p>
          </section>
        </>
      )}
    </div>
  );
};
