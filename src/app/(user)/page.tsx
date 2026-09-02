import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Surface } from '@/components/ui/surface';
import { ShieldCheck } from 'lucide-react';

export default function UserHomePage() {
  const t = useTranslations('app');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#2D1B2D]">{t('title')}</h1>
        <p className="text-[#5A5A66] mt-1">{t('tagline')}</p>
      </div>

      <Surface variant="bordered" className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#2E8B57]/15 flex items-center justify-center text-[#2E8B57]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#1E1E24]">Phase 1 Foundation Active</h2>
            <p className="text-sm text-[#5A5A66]">
              Architecture, App Shell, Localization, Dexie storage boundary, and Supabase client setup ready.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[#E2D8D0]">
          <div className="p-4 rounded-xl bg-[#F9EBEA]/50 border border-[#E2D8D0]/60 space-y-1">
            <span className="text-xs font-semibold text-[#2D1B2D] uppercase tracking-wider">
              Local Vault
            </span>
            <p className="text-sm text-[#5A5A66]">100% Offline IndexedDB (Dexie.js 4.x)</p>
          </div>

          <div className="p-4 rounded-xl bg-[#F9EBEA]/50 border border-[#E2D8D0]/60 space-y-1">
            <span className="text-xs font-semibold text-[#2D1B2D] uppercase tracking-wider">
              Localization
            </span>
            <p className="text-sm text-[#5A5A66]">Static JSON (`en`, `hi`, `kn` dictionaries)</p>
          </div>

          <div className="p-4 rounded-xl bg-[#F9EBEA]/50 border border-[#E2D8D0]/60 space-y-1">
            <span className="text-xs font-semibold text-[#2D1B2D] uppercase tracking-wider">
              Cloud Boundary
            </span>
            <p className="text-sm text-[#5A5A66]">Supabase SSR Auth & Isolated DB setup</p>
          </div>
        </div>
      </Surface>
    </div>
  );
}
