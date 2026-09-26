'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CycleRepository } from '@/lib/db/repositories/cycle-repository';
import { DailyLogRepository } from '@/lib/db/repositories/daily-log-repository';
import { computeHealthAnalytics, type HealthAnalytics } from '@/lib/analytics';
import { getInsights, type PersonalInsight } from '@/lib/insights';
import { composeReport, type ReportData, type ReportDateRange, type ReportRangeKey } from '@/lib/reports';
import { downloadPdf } from '@/lib/reports/export-pdf';
import { downloadCsv } from '@/lib/reports/export-csv';
import { downloadJson } from '@/lib/reports/export-json';
import { SYMPTOM_OPTIONS, MOOD_OPTIONS } from '@/lib/health/daily-health-options';
import { todayIso } from '@/lib/health/date-utils';
import type { CycleDomainModel, DailyLogDomainModel } from '@/types/health';
import { AlertCircle, ShieldCheck, FileText, Download } from 'lucide-react';
import { LoadingState } from '@/components/ui/state';

type ExportFormat = 'pdf' | 'csv' | 'json';

function recentStartDate(today: string, days: number): string {
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString().split('T')[0];
}

function sixMonthsStartDate(today: string): string {
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() - 6);
  return d.toISOString().split('T')[0];
}

function formatNumber(v: number, decimals = 1): string {
  return String(Math.round(v * 10 ** decimals) / 10 ** decimals);
}

function sufficiencyText(
  v: { sufficiency: string; value: number | null; messageKey: string | null },
  t: (key: string) => string,
  formatter?: (v: number) => string
): string {
  if (v.sufficiency === 'available' && v.value !== null) {
    return formatter ? formatter(v.value) : formatNumber(v.value);
  }
  if (v.sufficiency === 'insufficient') return t('insufficient');
  return t('noData');
}

function ReportSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-[#2D1B2D] border-b border-[#E2D8D0] pb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function DataRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-sm text-[#5A5A66]">{label}</dt>
      <dd className="text-sm font-medium text-[#1E1E24] text-right whitespace-nowrap">{value}</dd>
    </div>
  );
}

function symptomLabel(id: string): string {
  return SYMPTOM_OPTIONS.find((o) => o.id === id)?.i18nKey ?? id;
}

function moodLabel(id: string): string {
  return MOOD_OPTIONS.find((o) => o.id === id)?.i18nKey ?? id;
}

export const ReportsView: React.FC = () => {
  const t = useTranslations('reports');
  const tInsights = useTranslations('insights');
  const tDaily = useTranslations('dailyHealth');
  const tCommon = useTranslations('common');

  const [rangeKey, setRangeKey] = React.useState<ReportRangeKey>('all');
  const [customStart, setCustomStart] = React.useState('');
  const [customEnd, setCustomEnd] = React.useState('');
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
        if (!cancelled) { setCycles(c); setDailyLogs(d); }
      } catch (err) {
        if (!cancelled) setErrorMsg((err as Error).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const today = todayIso();

  const dateRange: ReportDateRange = React.useMemo(() => {
    switch (rangeKey) {
      case '90d':
        return { startDate: recentStartDate(today, 90), endDate: today, key: '90d' };
      case '6m':
        return { startDate: sixMonthsStartDate(today), endDate: today, key: '6m' };
      case 'custom': {
        const s = customStart || today;
        const e = customEnd || today;
        return { startDate: s <= e ? s : e, endDate: s <= e ? e : s, key: 'custom' };
      }
      default:
        return { startDate: '0000-01-01', endDate: today, key: 'all' };
    }
  }, [rangeKey, customStart, customEnd, today]);

  const hasCustomError = rangeKey === 'custom' && customStart && customEnd && customStart > customEnd;

  const analytics: HealthAnalytics = React.useMemo(() => {
    return computeHealthAnalytics({
      cycles,
      dailyLogs,
      today,
      range: rangeKey === 'all' ? undefined : { startDate: dateRange.startDate, endDate: dateRange.endDate },
    });
  }, [cycles, dailyLogs, rangeKey, dateRange.startDate, dateRange.endDate, today]);

  const personalInsights: PersonalInsight[] = React.useMemo(() => {
    if (cycles.length === 0 && dailyLogs.length === 0) return [];
    const recordedDates = dailyLogs.map((l) => l.date);
    return getInsights({ analytics, recordedDates, limit: 10 });
  }, [analytics, cycles, dailyLogs]);

  const report: ReportData = React.useMemo(() => {
    return composeReport({
      analytics,
      insights: personalInsights,
      cycles,
      dateRange,
      today,
    });
  }, [analytics, personalInsights, cycles, dateRange, today]);

  const hasAnyData = cycles.length > 0 || dailyLogs.length > 0;

  const handleExport = React.useCallback((format: ExportFormat) => {
    switch (format) {
      case 'pdf': downloadPdf(report); break;
      case 'csv': downloadCsv(report); break;
      case 'json': downloadJson(report); break;
    }
  }, [report]);

  return (
    <div className="space-y-8 max-w-3xl report-container" id="report-content">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#2D1B2D]/5 flex items-center justify-center text-[#2D1B2D]">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#2D1B2D]">{t('title')}</h1>
            <p className="text-sm text-[#5A5A66] mt-1">{t('subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Privacy banner */}
      <div className="p-3.5 rounded-xl bg-[#F9EBEA]/60 border border-[#E2D8D0] flex items-center gap-2 text-xs text-[#5A5A66] no-print">
        <ShieldCheck className="h-4 w-4 text-[#2E8B57] shrink-0" />
        <span>{tCommon('offlineMode')}</span>
      </div>

      {/* Date range selector */}
      <div className="space-y-3 no-print">
        <h2 className="text-sm font-semibold text-[#2D1B2D]">{t('dateRange')}</h2>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('dateRange')}>
          {([
            ['all', t('rangeAll')],
            ['90d', t('range90d')],
            ['6m', t('range6m')],
            ['custom', t('rangeCustom')],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={rangeKey === key}
              onClick={() => setRangeKey(key)}
              className={`px-4 py-2 text-sm font-medium rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8837D] ${
                rangeKey === key
                  ? 'bg-[#2D1B2D] text-[#FDFBF7] border-[#2D1B2D]'
                  : 'bg-white text-[#1E1E24] border-[#E2D8D0] hover:bg-[#F9EBEA]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {rangeKey === 'custom' && (
          <div className="flex items-center gap-3 mt-2">
            <label className="text-sm text-[#5A5A66]">
              {t('from')}
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="ml-2 px-3 py-1.5 text-sm border border-[#E2D8D0] rounded-xl bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8837D]"
              />
            </label>
            <label className="text-sm text-[#5A5A66]">
              {t('to')}
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="ml-2 px-3 py-1.5 text-sm border border-[#E2D8D0] rounded-xl bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8837D]"
              />
            </label>
          </div>
        )}
        {hasCustomError && (
          <p className="text-sm text-[#C94A46]" role="alert">{t('invalidRange')}</p>
        )}
      </div>

      {/* Export controls */}
      {!isLoading && hasAnyData && !hasCustomError && (
        <div className="flex flex-wrap items-center gap-2 no-print" role="group" aria-label={t('exportActions')}>
          <button
            type="button"
            onClick={() => handleExport('pdf')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-[#2D1B2D] text-[#FDFBF7] hover:bg-[#3D283D] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8837D]"
          >
            <Download className="h-4 w-4" />
            {t('exportPdf')}
          </button>
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-[#E2D8D0] bg-white text-[#1E1E24] hover:bg-[#F9EBEA] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8837D]"
          >
            <Download className="h-4 w-4" />
            {t('exportCsv')}
          </button>
          <button
            type="button"
            onClick={() => handleExport('json')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-[#E2D8D0] bg-white text-[#1E1E24] hover:bg-[#F9EBEA] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8837D]"
          >
            <Download className="h-4 w-4" />
            {t('exportJson')}
          </button>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div role="alert" className="p-4 rounded-xl bg-[#C94A46]/10 border border-[#C94A46]/30 flex items-center gap-3 text-sm text-[#C94A46]">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <LoadingState />
      ) : !hasAnyData ? (
        <div className="py-16 text-center">
          <p className="text-sm text-[#5A5A66]">{t('noData')}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Report meta */}
          <div className="text-xs text-[#5A5A66]">
            {t('reportPeriod')}: {dateRange.startDate} — {dateRange.endDate}
          </div>

          {/* Cycle */}
          <ReportSection title={t('sectionCycle')}>
            {report.cycle.recordedCycles === 0 ? (
              <p className="text-sm text-[#5A5A66] italic">{t('noCycleData')}</p>
            ) : (
              <dl className="divide-y divide-[#F1E7E3]">
                <DataRow label={t('cycleRecordedCycles')} value={String(report.cycle.recordedCycles)} />
                <DataRow label={t('cycleAverage')} value={sufficiencyText(report.cycle.averageCycleLength, () => t('insufficientData'), (v) => t('daysValue', { value: formatNumber(v) }))} />
                <DataRow label={t('cycleShortest')} value={sufficiencyText(report.cycle.shortestCycle, () => t('insufficientData'), (v) => t('daysValue', { value: formatNumber(v, 0) }))} />
                <DataRow label={t('cycleLongest')} value={sufficiencyText(report.cycle.longestCycle, () => t('insufficientData'), (v) => t('daysValue', { value: formatNumber(v, 0) }))} />
                <DataRow label={t('cycleMostRecent')} value={sufficiencyText(report.cycle.mostRecentCycleLength, () => t('insufficientData'), (v) => t('daysValue', { value: formatNumber(v, 0) }))} />
                <DataRow label={t('variability')} value={report.cycle.variability.category} />
                <DataRow label={t('predictionAvailable')} value={report.cycle.predictionAvailable ? t('yes') : t('no')} />
              </dl>
            )}
          </ReportSection>

          {/* Period */}
          <ReportSection title={t('sectionPeriod')}>
            {report.period.recordedPeriods === 0 ? (
              <p className="text-sm text-[#5A5A66] italic">{t('noPeriodData')}</p>
            ) : (
              <dl className="divide-y divide-[#F1E7E3]">
                <DataRow label={t('periodRecorded')} value={String(report.period.recordedPeriods)} />
                <DataRow label={t('periodAverage')} value={sufficiencyText(report.period.averageDuration, () => t('insufficientData'), (v) => t('daysValue', { value: formatNumber(v) }))} />
                <DataRow label={t('periodShortest')} value={sufficiencyText(report.period.shortestDuration, () => t('insufficientData'), (v) => t('daysValue', { value: formatNumber(v, 0) }))} />
                <DataRow label={t('periodLongest')} value={sufficiencyText(report.period.longestDuration, () => t('insufficientData'), (v) => t('daysValue', { value: formatNumber(v, 0) }))} />
                <DataRow label={t('periodOngoing')} value={report.period.ongoingPeriod ? t('yes') : t('no')} />
                {report.period.flowDistribution.length > 0 && (
                  <DataRow label={t('flowDistribution')} value={report.period.flowDistribution.map((f) => `${tDaily('flow' + f.level[0].toUpperCase() + f.level.slice(1))} (${f.count})`).join(' · ')} />
                )}
              </dl>
            )}
          </ReportSection>

          {/* Symptoms */}
          <ReportSection title={t('sectionSymptoms')}>
            {report.symptoms.recordedDays === 0 ? (
              <p className="text-sm text-[#5A5A66] italic">{t('noSymptomData')}</p>
            ) : (
              <>
                <p className="text-sm text-[#5A5A66]">{t('recordedDays', { count: report.symptoms.recordedDays })}</p>
                {report.symptoms.mostFrequent.length > 0 && (
                  <ul className="space-y-1">
                    {report.symptoms.mostFrequent.map((s) => (
                      <li key={s.id} className="flex items-baseline justify-between gap-4 text-sm">
                        <span className="text-[#1E1E24]">{tDaily(symptomLabel(s.id))}</span>
                        <span className="text-[#5A5A66] whitespace-nowrap">{t('daysCount', { count: s.count })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </ReportSection>

          {/* Mood */}
          <ReportSection title={t('sectionMood')}>
            {report.mood.recordedDays === 0 ? (
              <p className="text-sm text-[#5A5A66] italic">{t('noMoodData')}</p>
            ) : (
              <>
                <p className="text-sm text-[#5A5A66]">{t('recordedDays', { count: report.mood.recordedDays })}</p>
                {report.mood.mostFrequent.length > 0 && (
                  <ul className="space-y-1">
                    {report.mood.mostFrequent.map((m) => (
                      <li key={m.id} className="flex items-baseline justify-between gap-4 text-sm">
                        <span className="text-[#1E1E24]">{tDaily(moodLabel(m.id))}</span>
                        <span className="text-[#5A5A66] whitespace-nowrap">{t('daysCount', { count: m.count })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </ReportSection>

          {/* Pain */}
          <ReportSection title={t('sectionPain')}>
            {report.pain.recordedDays === 0 ? (
              <p className="text-sm text-[#5A5A66] italic">{t('noPainData')}</p>
            ) : (
              <dl className="divide-y divide-[#F1E7E3]">
                <DataRow label={t('recordedDaysLabel')} value={String(report.pain.recordedDays)} />
                <DataRow label={t('painAverage')} value={sufficiencyText(report.pain.average, () => t('insufficientData'), (v) => `${formatNumber(v)} / 10`)} />
                <DataRow label={t('painHighest')} value={sufficiencyText(report.pain.highest, () => t('insufficientData'), (v) => `${formatNumber(v, 0)} / 10`)} />
                <DataRow label={t('painLowest')} value={sufficiencyText(report.pain.lowest, () => t('insufficientData'), (v) => `${formatNumber(v, 0)} / 10`)} />
              </dl>
            )}
          </ReportSection>

          {/* Sleep */}
          <ReportSection title={t('sectionSleep')}>
            {report.sleep.recordedDays === 0 ? (
              <p className="text-sm text-[#5A5A66] italic">{t('noSleepData')}</p>
            ) : (
              <dl className="divide-y divide-[#F1E7E3]">
                <DataRow label={t('recordedDaysLabel')} value={String(report.sleep.recordedDays)} />
                <DataRow label={t('sleepAverage')} value={sufficiencyText(report.sleep.average, () => t('insufficientData'), (v) => t('hoursValue', { value: formatNumber(v) }))} />
                <DataRow label={t('sleepMinimum')} value={sufficiencyText(report.sleep.minimum, () => t('insufficientData'), (v) => t('hoursValue', { value: formatNumber(v) }))} />
                <DataRow label={t('sleepMaximum')} value={sufficiencyText(report.sleep.maximum, () => t('insufficientData'), (v) => t('hoursValue', { value: formatNumber(v) }))} />
              </dl>
            )}
          </ReportSection>

          {/* Hydration */}
          <ReportSection title={t('sectionHydration')}>
            {report.hydration.recordedDays === 0 ? (
              <p className="text-sm text-[#5A5A66] italic">{t('noHydrationData')}</p>
            ) : (
              <dl className="divide-y divide-[#F1E7E3]">
                <DataRow label={t('recordedDaysLabel')} value={String(report.hydration.recordedDays)} />
                <DataRow label={t('hydrationAverage')} value={sufficiencyText(report.hydration.average, () => t('insufficientData'), (v) => t('mlValue', { value: formatNumber(v) }))} />
                <DataRow label={t('hydrationMinimum')} value={sufficiencyText(report.hydration.minimum, () => t('insufficientData'), (v) => t('mlValue', { value: formatNumber(v) }))} />
                <DataRow label={t('hydrationMaximum')} value={sufficiencyText(report.hydration.maximum, () => t('insufficientData'), (v) => t('mlValue', { value: formatNumber(v) }))} />
              </dl>
            )}
          </ReportSection>

          {/* Insights */}
          <ReportSection title={t('sectionInsights')}>
            {report.insights.length === 0 ? (
              <p className="text-sm text-[#5A5A66] italic">{t('noInsights')}</p>
            ) : (
              <div className="space-y-3">
                {report.insights.map((insight) => {
                  const titleKey = insight.titleKey.replace('insights.', '');
                  const msgKey = insight.messageKey.replace('insights.', '');
                  return (
                    <div key={insight.id} className="p-3 rounded-xl bg-[#F9EBEA]/40 border border-[#E2D8D0]">
                      <h3 className="text-sm font-semibold text-[#2D1B2D]">
                        {tInsights(titleKey)}
                      </h3>
                      <p className="text-sm text-[#5A5A66] mt-1">
                        {tInsights(msgKey, insight.params ?? {})}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </ReportSection>

          {/* Privacy note */}
          <div className="text-xs text-[#5A5A66] border-t border-[#E2D8D0] pt-4">
            {t('privacyNote')}
          </div>
        </div>
      )}
    </div>
  );
};
