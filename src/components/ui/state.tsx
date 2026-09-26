'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Surface } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';

interface LoadingStateProps {
  /** Optional override; defaults to common.loading. */
  label?: string;
  className?: string;
}

/** Consistent, accessible loading indicator for feature views. */
export const LoadingState: React.FC<LoadingStateProps> = ({ label, className }) => {
  const t = useTranslations('common');
  return (
    <div className={className ?? 'py-16 text-center text-sm text-[#5A5A66]'}>
      <div
        className="h-8 w-8 animate-spin rounded-full border-3 border-[#2D1B2D] border-t-transparent mx-auto mb-3"
        aria-hidden="true"
      />
      <span role="status" aria-live="polite">
        {label ?? t('loading')}
      </span>
    </div>
  );
};

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/** Error panel with an optional retry affordance. */
export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry, className }) => {
  const t = useTranslations('common');
  return (
    <Surface
      variant="bordered"
      className={`p-4 border-[#C94A46]/30 bg-[#C94A46]/10 flex items-start gap-3 text-sm text-[#C94A46] ${className ?? ''}`}
      role="alert"
    >
      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="space-y-3 w-full">
        <p className="leading-relaxed">{message ?? t('error')}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="border-[#C94A46]/40 text-[#C94A46] hover:bg-[#C94A46]/10">
            <RefreshCw className="h-4 w-4 mr-1.5" aria-hidden="true" />
            {t('retry')}
          </Button>
        )}
      </div>
    </Surface>
  );
};

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

/** Empty state with a calm, non-alarming presentation. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => (
  <Surface variant="bordered" className={`p-8 text-center space-y-4 ${className ?? ''}`}>
    {icon && (
      <div
        className="h-12 w-12 rounded-2xl bg-[#F9EBEA] flex items-center justify-center text-[#2D1B2D] mx-auto"
        aria-hidden="true"
      >
        {icon}
      </div>
    )}
    <div className="max-w-md mx-auto space-y-2">
      <h3 className="text-lg font-bold text-[#2D1B2D]">{title}</h3>
      <p className="text-sm text-[#5A5A66] leading-relaxed">{description}</p>
    </div>
    {action}
  </Surface>
);
