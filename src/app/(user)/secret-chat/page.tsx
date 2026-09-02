import * as React from 'react';
import { Surface } from '@/components/ui/surface';

export default function SecretChatPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#2D1B2D]">SecretChat Anonymous Community</h1>
      <Surface variant="bordered">
        <p className="text-[#5A5A66]">Anonymous peer discussion feed shell foundation (Isolated Cloud DB).</p>
      </Surface>
    </div>
  );
}
