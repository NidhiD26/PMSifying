'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CycleRepository } from '@/lib/db/repositories/cycle-repository';
import { DailyLogRepository } from '@/lib/db/repositories/daily-log-repository';
import type { CycleDomainModel, DailyLogDomainModel } from '@/types/health';
import { analyzeCycles } from '@/lib/cycle-engine/engine';
import { computeHealthAnalytics } from '@/lib/analytics';
import { getInsights } from '@/lib/insights';
import { formatLocalDateIso } from '@/lib/utils/date-utils';
import { PeriodModal } from '@/features/period-logging/period-modal';
import { Surface } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CalendarClock,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Calendar as CalendarIcon,
  Sparkles,
  BarChart2,
  FileText,
  Activity,
  Heart,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const tDashboard = useTranslations('dashboard');
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
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
  const cycleAnalysis = React.useMemo(() => {
    return analyzeCycles(cycles);
  }, [cycles]);

  // Derived current cycle status
  const currentCycleInfo = React.useMemo(() => {
    if (cycles.length === 0) return null;
    const lastCycle = cycles[cycles.length - 1];

    let daysCount = 1;
    if (todayIso >= lastCycle.startDate) {
      const a = new Date(lastCycle.startDate + 'T00:00:00Z');
      const b = new Date(todayIso + 'T00:00:00Z');
      daysCount = Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
    }

    let phaseKey: 'phaseFollicular' | 'phaseOvulatory' | 'phaseLuteal' | 'phaseMenstrual' = 'phaseFollicular';
    let badgeVariant: 'period' | 'ovulation' | 'fertile' | 'neutral' = 'neutral';

    const fertile = cycleAnalysis.fertileWindow;

    if (!lastCycle.endDate || todayIso <= lastCycle.endDate) {
      phaseKey = 'phaseMenstrual';
      badgeVariant = 'period';
    } else if (
      fertile.status === 'estimated' &&
      fertile.startDate &&
      fertile.endDate &&
      todayIso >= fertile.startDate &&
      todayIso <= fertile.endDate
    ) {
      phaseKey = 'phaseOvulatory';
      badgeVariant = 'ovulation';
    } else if (
      fertile.status === 'estimated' &&
      fertile.endDate &&
      todayIso > fertile.endDate
    ) {
      phaseKey = 'phaseLuteal';
      badgeVariant = 'fertile';
    } else {
      phaseKey = 'phaseFollicular';
      badgeVariant = 'neutral';
    }

    return {
      lastCycle,
      cycleDay: daysCount,
      phaseKey,
      badgeVariant,
    };
  }, [cycles, todayIso, cycleAnalysis]);

  // Derived top personalized insights
  const topInsights = React.useMemo(() => {
    if (cycles.length === 0 && dailyLogs.length === 0) return [];
    const analytics = computeHealthAnalytics({ cycles, dailyLogs, today: todayIso });
    return getInsights({
      analytics,
      recordedDates: dailyLogs.map((l) => l.date),
      limit: 2,
    });
  }, [cycles, dailyLogs, todayIso]);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#2D1B2D]">{tDashboard('title')}</h1>
          <p className="text-sm text-[#5A5A66] mt-1">{tDashboard('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="primary" size="sm" onClick={() => setIsPeriodModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            {tDashboard('logPeriodAction')}
          </Button>
          <Link href="/health">
            <Button variant="outline" size="sm">
              <Activity className="h-4 w-4 mr-1.5 text-[#2D1B2D]" />
              {tDashboard('logTodayAction')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Error state */}
      {errorMsg && (
        <Surface variant="bordered" className="p-4 border-[#C94A46]/30 bg-[#C94A46]/10 flex items-center gap-3 text-sm text-[#C94A46]">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{errorMsg}</p>
        </Surface>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-[#5A5A66]">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2D1B2D] border-t-transparent mx-auto mb-3" />
          <span>{tCommon('loading')}</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Main Status Timeline Banner */}
          {currentCycleInfo ? (
            <Surface variant="bordered" className="p-6 space-y-6 bg-gradient-to-br from-[#FFFFFF] to-[#F9EBEA]/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2D8D0] pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-[#2D1B2D] flex items-center justify-center text-[#FDFBF7]">
                    <CalendarClock className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-[#2D1B2D]">
                        {tDashboard('dayCount', { day: currentCycleInfo.cycleDay })}
                      </span>
                      <Badge variant={currentCycleInfo.badgeVariant}>
                        {tDashboard(currentCycleInfo.phaseKey)}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#5A5A66] mt-0.5">
                      {tDashboard('currentStatus')} • {todayIso}
                    </p>
                  </div>
                </div>
              </div>

              {/* Cycle Predictions & Stats Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E2D8D0] space-y-1">
                  <span className="text-xs font-semibold text-[#5A5A66] block">
                    {tDashboard('nextPeriod')}
                  </span>
                  <p className="text-base font-bold text-[#2D1B2D]">
                    {cycleAnalysis.nextPeriod.status === 'predicted'
                      ? cycleAnalysis.nextPeriod.estimatedStartDate
                      : tDashboard('noCycleData').split('.')[0]}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E2D8D0] space-y-1">
                  <span className="text-xs font-semibold text-[#5A5A66] block">
                    {tDashboard('fertileWindow')}
                  </span>
                  <p className="text-base font-bold text-[#2D1B2D]">
                    {cycleAnalysis.fertileWindow.status === 'estimated'
                      ? `${cycleAnalysis.fertileWindow.startDate} – ${cycleAnalysis.fertileWindow.endDate}`
                      : '—'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E2D8D0] space-y-1">
                  <span className="text-xs font-semibold text-[#5A5A66] block">
                    {tDashboard('cycleSummary')}
                  </span>
                  <p className="text-base font-bold text-[#2D1B2D]">
                    {cycleAnalysis.stats
                      ? tDashboard('cycleSummaryValue', {
                          days: cycleAnalysis.stats.averageCycleLength,
                          count: cycleAnalysis.stats.sampleSize,
                        })
                      : '—'}
                  </p>
                </div>
              </div>
            </Surface>
          ) : (
            /* Empty State when zero period entries exist */
            <Surface variant="bordered" className="p-8 text-center space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-[#F9EBEA] flex items-center justify-center text-[#2D1B2D] mx-auto">
                <Heart className="h-6 w-6" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-lg font-bold text-[#2D1B2D]">{tDashboard('welcomeTitle')}</h3>
                <p className="text-sm text-[#5A5A66]">{tDashboard('noCycleData')}</p>
              </div>
              <Button variant="primary" onClick={() => setIsPeriodModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {tDashboard('logPeriodAction')}
              </Button>
            </Surface>
          )}

          {/* Today's Health Log Quick Status */}
          <Surface variant="bordered" className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#2E8B57]/10 flex items-center justify-center text-[#2E8B57]">
                {todayLog ? <CheckCircle2 className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-[#2D1B2D]">{tDashboard('todayLog')}</h3>
                <p className="text-xs text-[#5A5A66] mt-0.5">
                  {todayLog ? (
                    <span className="text-[#2E8B57] font-semibold">{tDashboard('loggedToday')}</span>
                  ) : (
                    <span>{tDashboard('notLoggedToday')}</span>
                  )}
                </p>
              </div>
            </div>
            <Link href="/health">
              <Button variant="secondary" size="sm">
                {tDashboard('logTodayAction')}
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </Link>
          </Surface>

          {/* Personalized Observations & Insights */}
          {topInsights.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#2D1B2D]" />
                <h2 className="text-xl font-bold text-[#2D1B2D]">{tDashboard('recentInsights')}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topInsights.map((insight) => {
                  const titleKey = insight.titleKey.replace('insights.', '') as Parameters<typeof tInsights>[0];
                  const msgKey = insight.messageKey.replace('insights.', '') as Parameters<typeof tInsights>[0];
                  return (
                    <Surface key={insight.id} variant="bordered" className="p-5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#5A5A66] uppercase tracking-wider">
                          {insight.category}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-[#2D1B2D]">
                        {tInsights(titleKey, insight.params)}
                      </h4>
                      <p className="text-xs text-[#5A5A66] leading-relaxed">
                        {tInsights(msgKey, insight.params)}
                      </p>
                    </Surface>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Navigation Links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link href="/calendar">
              <div className="p-4 rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] hover:bg-[#F9EBEA]/40 transition-colors flex flex-col items-center text-center space-y-2 cursor-pointer">
                <CalendarIcon className="h-6 w-6 text-[#2D1B2D]" />
                <span className="text-xs font-semibold text-[#2D1B2D]">{tNav('calendar')}</span>
              </div>
            </Link>
            <Link href="/health">
              <div className="p-4 rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] hover:bg-[#F9EBEA]/40 transition-colors flex flex-col items-center text-center space-y-2 cursor-pointer">
                <Activity className="h-6 w-6 text-[#2D1B2D]" />
                <span className="text-xs font-semibold text-[#2D1B2D]">{tNav('health')}</span>
              </div>
            </Link>
            <Link href="/insights">
              <div className="p-4 rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] hover:bg-[#F9EBEA]/40 transition-colors flex flex-col items-center text-center space-y-2 cursor-pointer">
                <BarChart2 className="h-6 w-6 text-[#2D1B2D]" />
                <span className="text-xs font-semibold text-[#2D1B2D]">{tNav('insights')}</span>
              </div>
            </Link>
            <Link href="/reports">
              <div className="p-4 rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] hover:bg-[#F9EBEA]/40 transition-colors flex flex-col items-center text-center space-y-2 cursor-pointer">
                <FileText className="h-6 w-6 text-[#2D1B2D]" />
                <span className="text-xs font-semibold text-[#2D1B2D]">{tNav('reports')}</span>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Offline Privacy Guarantee Banner */}
      <div className="p-3.5 rounded-xl bg-[#F9EBEA]/60 border border-[#E2D8D0] flex items-center justify-between gap-3 text-xs text-[#5A5A66]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#2E8B57] shrink-0" />
          <span>{tDashboard('privacyFooter')}</span>
        </div>
      </div>

      {/* Period Modal */}
      <PeriodModal
        isOpen={isPeriodModalOpen}
        onClose={() => setIsPeriodModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
};
