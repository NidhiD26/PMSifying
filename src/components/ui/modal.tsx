'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /**
   * Accessible name for the close control.
   *
   * Optional rather than hardcoded, because this app renders every visible and
   * assistive string from a locale file. A caller that omits it keeps a sensible
   * default, so an existing caller is not broken by adding the prop.
   */
  closeLabel?: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  closeLabel,
  children,
  className,
}) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1E24]/40 backdrop-blur-sm transition-opacity"
    >
      <div
        className={cn(
          'relative w-full max-w-lg rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] p-6 shadow-lg transition-all',
          className
        )}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#E2D8D0]">
          {title && <h2 className="text-xl font-semibold text-[#2D1B2D]">{title}</h2>}
          <button
            onClick={onClose}
            aria-label={closeLabel ?? 'Close dialog'}
            className="rounded-full p-2 text-[#5A5A66] hover:bg-[#F9EBEA] hover:text-[#2D1B2D] min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
};
