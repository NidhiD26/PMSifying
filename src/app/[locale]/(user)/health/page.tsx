'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { CycleRepository } from '@/lib/db/repositories/cycle-repository';
import type { CycleDomainModel } from '@/types/health';
import { PeriodModal } from '@/features/period-logging/period-modal';
import { PeriodHistory } from '@/features/period-logging/period-history';
import { PeriodEmptyState } from '@/features/period-logging/period-empty-state';
import { DailyHealthPanel } from '@/features/daily-health/daily-health-panel';
import { Plus, ShieldCheck, AlertCircle, CalendarClock } from 'lucide-react';

export default function HealthPage() {
  const t = useTranslations('period');
  const tHealth = useTranslations('health');
  const tCommon = useTranslations('common');
  const tPrivacy = useTranslations('privacy');

  const [cycles, setCycles] = React.useState<CycleDomainModel[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingCycle, setEditingCycle] = React.useState<CycleDomainModel | null>(null);

  const loadCycles = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const records = await CycleRepository.getAllCyclesChronological();
      // Reverse to show most recent period first
      setCycles([...records].reverse());
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCycles();
  }, [loadCycles]);

  const handleOpenCreate = () => {
    setEditingCycle(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cycle: CycleDomainModel) => {
    setEditingCycle(cycle);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    await CycleRepository.deleteCycle(id);
    await loadCycles();
  };

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#2D1B2D]">{tHealth('sectionDaily')} &amp; {tHealth('sectionPeriod')}</h1>
          <p className="text-sm text-[#5A5A66] mt-1">{tCommon('offlineMode')}</p>
        </div>
      </div>

      {/* Local Offline Privacy Banner */}
      <div className="p-3.5 rounded-xl bg-[#F9EBEA]/60 border border-[#E2D8D0] flex items-center justify-between gap-3 text-xs text-[#5A5A66]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#2E8B57] shrink-0" />
          <span>{tCommon('offlineMode')} — {tPrivacy('localDexieVault')}</span>
        </div>
      </div>

      {/* ============ DAILY HEALTH SECTION ============ */}
      <section className="space-y-5">
        <DailyHealthPanel />
      </section>

      <div className="border-t border-[#E2D8D0]" aria-hidden="true" />

      {/* ============ PERIOD SECTION ============ */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#C94A46]/10 flex items-center justify-center text-[#C94A46]">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#2D1B2D]">{tHealth('sectionPeriod')}</h2>
              <p className="text-sm text-[#5A5A66] mt-0.5">{tHealth('sectionPeriodSubtitle')}</p>
            </div>
          </div>
          {cycles.length > 0 && (
            <Button variant="primary" onClick={handleOpenCreate} className="self-start sm:self-auto">
              <Plus className="h-4 w-4 mr-2" />
              {t('logPeriod')}
            </Button>
          )}
        </div>

        {/* Error View */}
        {errorMsg && (
          <Surface variant="bordered" className="p-4 border-[#C94A46]/30 bg-[#C94A46]/10 flex items-center gap-3 text-sm text-[#C94A46]">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{errorMsg}</p>
          </Surface>
        )}

        {/* Loading View */}
        {isLoading ? (
          <div className="py-12 text-center text-sm text-[#5A5A66]">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2D1B2D] border-t-transparent mx-auto mb-3" />
            <span>{tCommon('loading')}</span>
          </div>
        ) : cycles.length === 0 ? (
          <PeriodEmptyState onLogFirst={handleOpenCreate} />
        ) : (
          <PeriodHistory cycles={cycles} onEdit={handleOpenEdit} onDelete={handleDelete} />
        )}
      </section>

      {/* Period Modal */}
      <PeriodModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadCycles}
        cycleToEdit={editingCycle}
      />
    </div>
  );
}
