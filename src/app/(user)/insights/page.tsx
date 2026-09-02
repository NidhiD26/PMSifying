import * as React from 'react';
import { Surface } from '@/components/ui/surface';

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#2D1B2D]">Analytics & Insights</h1>
      <Surface variant="bordered">
        <p className="text-[#5A5A66]">Cycle trends and symptom analytics shell foundation.</p>
      </Surface>
    </div>
  );
}
