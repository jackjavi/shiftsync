'use client';

import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

interface AlertBannerProps {
  variant: AlertVariant;
  title?: string;
  message: string;
  dismissible?: boolean;
  className?: string;
  onDismiss?: () => void;
  actions?: React.ReactNode;
}

const config: Record<AlertVariant, {
  icon: React.FC<{ className?: string }>;
  accent: string;
  bg: string;
  border: string;
}> = {
  success: { icon: CheckCircle2, accent: 'text-[hsl(155_60%_40%)]', bg: 'bg-[hsl(155_60%_40%/0.08)]', border: 'border-[hsl(155_60%_40%/0.25)]' },
  error:   { icon: XCircle,      accent: 'text-[hsl(0_72%_54%)]',   bg: 'bg-[hsl(0_72%_54%/0.08)]',   border: 'border-[hsl(0_72%_54%/0.25)]'   },
  warning: { icon: AlertTriangle, accent: 'text-[hsl(38_95%_52%)]', bg: 'bg-[hsl(38_95%_52%/0.08)]', border: 'border-[hsl(38_95%_52%/0.25)]'   },
  info:    { icon: Info,          accent: 'text-[hsl(210_90%_56%)]', bg: 'bg-[hsl(210_90%_56%/0.08)]', border: 'border-[hsl(210_90%_56%/0.25)]' },
};

export function AlertBanner({
  variant,
  title,
  message,
  dismissible = true,
  className,
  onDismiss,
  actions,
}: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const c = config[variant];
  const Icon = c.icon;

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 animate-fade-in',
        c.bg,
        c.border,
        className,
      )}
      role="alert"
    >
      <Icon className={cn('mt-0.5 w-4 h-4 shrink-0', c.accent)} />
      <div className="flex-1 min-w-0">
        {title && (
          <p className={cn('text-sm font-semibold font-nunito', c.accent)}>{title}</p>
        )}
        <p className={cn('text-sm font-nunito text-[var(--text-secondary)]', title && 'mt-0.5')}>
          {message}
        </p>
        {actions && <div className="mt-3">{actions}</div>}
      </div>
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded-md hover:bg-[var(--surface-elevated)] transition-colors"
          aria-label="Dismiss alert"
        >
          <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        </button>
      )}
    </div>
  );
}
