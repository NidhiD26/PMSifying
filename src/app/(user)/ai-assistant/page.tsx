import * as React from 'react';
import { Surface } from '@/components/ui/surface';

export default function AIAssistantPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#2D1B2D]">AI Health Assistant</h1>
      <Surface variant="bordered">
        <p className="text-[#5A5A66]">Conversational health literacy Q&A shell foundation (Gemma Gateway).</p>
      </Surface>
    </div>
  );
}
