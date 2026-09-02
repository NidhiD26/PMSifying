import * as React from 'react';
import { Surface } from '@/components/ui/surface';
import { ShieldCheck } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#2D1B2D]">Privacy Charter & Security Architecture</h1>
      <Surface variant="bordered" className="space-y-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-[#2E8B57]" />
          <h2 className="text-lg font-semibold text-[#1E1E24]">Local Storage Guarantee</h2>
        </div>
        <p className="text-sm text-[#5A5A66]">
          Your personal health logs, period dates, symptoms, and notes are stored strictly in local IndexedDB (`PMSify_Local_DB`). No cloud telemetry or automatic cloud backups are performed for tracking data.
        </p>
      </Surface>
    </div>
  );
}
