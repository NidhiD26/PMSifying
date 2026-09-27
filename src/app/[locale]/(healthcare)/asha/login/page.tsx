'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ShieldCheck, UserCheck, Lock, AlertCircle, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';

export default function ASHALoginPage() {
  const t = useTranslations('healthcare');
  const router = useRouter();
  const [id, setId] = React.useState('ASHA1001');
  const [password, setPassword] = React.useState('asha123');
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const fillCredentials = () => {
    setId('ASHA1001');
    setPassword('asha123');
    setError(null);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/healthcare/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, password }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          router.push(data.data.redirectUrl || '/asha');
          router.refresh();
        } else {
          setError(data.message || 'Invalid Healthcare ID or Password.');
        }
      } catch {
        setError('Network error during authentication.');
      }
    });
  };

  return (
    <div className="mx-auto max-w-md py-8">
      <Surface variant="bordered" className="space-y-6 p-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8837D]/15 text-[#2D1B2D]">
            <UserCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-[#2D1B2D]">ASHA Portal Sign In</h1>
          <p className="text-xs text-[#5A5A66]">
            Community Health Worker Workspace Authentication
          </p>
        </div>

        {/* DEMO MODE NOTICE */}
        <div className="rounded-xl border border-[#E8837D]/40 bg-[#F9EBEA] p-3 text-xs text-[#2D1B2D]">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4 text-[#E8837D]" />
            <span>DEMO MODE ACTIVE</span>
          </div>
          <p className="mt-1 text-[#5A5A66]">
            Use centralized demo credentials to authenticate as Sunita Devi (ASHA Worker).
          </p>
          <button
            type="button"
            onClick={fillCredentials}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#E8837D] bg-white px-2.5 py-1 text-xs font-semibold text-[#2D1B2D] hover:bg-[#F9EBEA]"
          >
            <KeyRound className="h-3.5 w-3.5 text-[#E8837D]" />
            Quick Fill: ASHA1001 / asha123
          </button>
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="asha-id" className="block text-xs font-semibold text-[#2D1B2D]">
              ASHA Worker ID
            </label>
            <div className="relative">
              <UserCheck className="absolute left-3 top-2.5 h-4 w-4 text-[#5A5A66]" />
              <input
                id="asha-id"
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                required
                className="w-full rounded-xl border border-[#D8CCC2] bg-[#FFFFFF] py-2 pl-9 pr-3 text-sm text-[#1E1E24] focus:outline-none focus:ring-2 focus:ring-[#E8837D]"
                placeholder="ASHA1001"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="asha-password" className="block text-xs font-semibold text-[#2D1B2D]">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-[#5A5A66]" />
              <input
                id="asha-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-[#D8CCC2] bg-[#FFFFFF] py-2 pl-9 pr-3 text-sm text-[#1E1E24] focus:outline-none focus:ring-2 focus:ring-[#E8837D]"
                placeholder="••••••••"
              />
            </div>
          </div>

          <Button type="submit" variant="secondary" className="w-full" disabled={isPending}>
            {isPending ? 'Authenticating...' : 'Sign In as ASHA Worker'}
          </Button>
        </form>

        <div className="border-t border-[#E2D8D0] pt-3 text-center text-xs text-[#5A5A66]">
          Are you a Doctor?{' '}
          <a href="/en/doctor/login" className="font-semibold text-[#2D1B2D] underline">
            Sign In to Doctor Portal
          </a>
        </div>
      </Surface>
    </div>
  );
}
