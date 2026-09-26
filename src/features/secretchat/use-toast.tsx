'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

/**
 * A tiny confirmation queue.
 *
 * Deliberately not a global store: two components needing a confirmation is not
 * two components needing shared state, and a provider here would be a way to reach
 * into every screen. The feed owns its toasts and renders them itself.
 *
 * Toasts expire on a timer that pauses when the member is interacting with them,
 * so a message cannot disappear while it is being read or while its dismiss button
 * is being aimed at.
 */

export interface Toast {
  id: number;
  message: string;
  kind: 'success' | 'error';
  dismissLabel: string;
}

interface ToastContextValue {
  toasts: Toast[];
  pushToast: (message: string, kind: Toast['kind']) => void;
  dismiss: (id: number) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

/** How long a confirmation stays before it removes itself. */
const TOAST_TTL_MS = 6000;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const t = useTranslations('common');
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const nextId = React.useRef(0);
  const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = React.useCallback(
    (message: string, kind: Toast['kind']) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, kind, dismissLabel: t('dismiss') }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_TTL_MS)
      );
    },
    [dismiss, t]
  );

  // Clearing on unmount keeps a timer from firing into an unmounted tree, which
  // is a warning in development and a leak in production.
  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const value = React.useMemo(
    () => ({ toasts, pushToast, dismiss }),
    [toasts, pushToast, dismiss]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
