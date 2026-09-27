'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, UserCheck, Stethoscope } from 'lucide-react';
import type { DemoSession } from '@/lib/healthcare/demo-session';

export const HealthcareUserNav: React.FC<{ session: DemoSession | null; locale: string }> = ({
  session,
  locale,
}) => {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      try {
        await fetch('/api/healthcare/auth/logout', { method: 'POST' });
        router.push(session?.role === 'DOCTOR' ? `/${locale}/doctor/login` : `/${locale}/asha/login`);
        router.refresh();
      } catch {
        router.push(`/${locale}/asha/login`);
      }
    });
  };

  if (!session) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <a
          href={`/${locale}/asha/login`}
          className="rounded-lg bg-[#E8837D]/20 px-2.5 py-1 font-semibold text-[#E8837D] hover:bg-[#E8837D]/30"
        >
          ASHA Login
        </a>
        <a
          href={`/${locale}/doctor/login`}
          className="rounded-lg bg-[#2E8B57]/20 px-2.5 py-1 font-semibold text-[#2E8B57] hover:bg-[#2E8B57]/30"
        >
          Doctor Login
        </a>
      </div>
    );
  }

  const isAsha = session.role === 'ASHA';

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white">
        {isAsha ? (
          <UserCheck className="h-3.5 w-3.5 text-[#E8837D]" />
        ) : (
          <Stethoscope className="h-3.5 w-3.5 text-[#2E8B57]" />
        )}
        <span className="font-medium">{session.name}</span>
        <span className="font-mono text-[10px] text-white/70">({session.loginId})</span>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        disabled={isPending}
        className="flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-1 font-medium text-red-200 hover:bg-red-500/30 hover:text-white"
        title="Sign Out"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span>{isPending ? '...' : 'Sign Out'}</span>
      </button>
    </div>
  );
};
