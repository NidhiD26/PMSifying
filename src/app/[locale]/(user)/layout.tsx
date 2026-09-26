import * as React from 'react';
import { DesktopSidebar } from '@/components/navigation/desktop-sidebar';
import { MobileBottomNav } from '@/components/navigation/mobile-bottom-nav';
import { HeaderBar } from '@/components/navigation/header-bar';
import { PinLockGate } from '@/features/settings/pin-lock-gate';

export default function UserPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PinLockGate>
      <div className="flex min-h-screen bg-[#FDFBF7]">
        <DesktopSidebar />
        <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
          <HeaderBar />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">{children}</main>
        </div>
        <MobileBottomNav />
      </div>
    </PinLockGate>
  );
}
