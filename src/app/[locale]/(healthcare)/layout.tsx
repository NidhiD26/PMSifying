import * as React from 'react';
import Link from 'next/link';

export default function HealthcarePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col">
      <header className="border-b border-[#E2D8D0] bg-[#2D1B2D] text-[#FDFBF7] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-bold text-lg text-[#FDFBF7] hover:underline">
            PMSify
          </Link>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#E8837D]/20 text-[#E8837D] font-medium">
            Healthcare Portal
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/asha" className="hover:underline">
            ASHA Worker
          </Link>
          <Link href="/doctor" className="hover:underline">
            Doctor
          </Link>
          <Link href="/health-camps" className="hover:underline">
            Camps
          </Link>
        </div>
      </header>
      <main className="flex-1 p-6 max-w-6xl w-full mx-auto">{children}</main>
    </div>
  );
}
