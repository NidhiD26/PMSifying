import * as React from 'react';

export default function GlobalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2D1B2D] border-t-transparent" />
        <span className="text-sm font-medium text-[#5A5A66]">Loading PMSify...</span>
      </div>
    </div>
  );
}
