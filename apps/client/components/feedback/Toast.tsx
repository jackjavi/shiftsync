'use client';

import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X, AlertOctagon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Toast as ToastType, ToastVariant } from '@/context/ToastContext';
import { useToastState, useToast } from '@/context/ToastContext';

// ─── Config ───────────────────────────────────────────────────────────────────

const variantConfig: Record<
  ToastVariant,
  { icon: React.FC<{ className?: string }>; accent: string; bg: string; border: string; progress: string }
> = {
  success: {
    icon:     CheckCircle2,
    accent:   'text-[hsl(155_60%_40%)]',
    bg:       'bg-[hsl(155_60%_40%/0.08)]',
    border:   'border-[hsl(155_60%_40%/0.30)]',
    progress: 'bg-[hsl(155_60%_40%)]',
  },
  error: {
    icon:     XCircle,
    accent:   'text-[hsl(0_72%_54%)]',
    bg:       'bg-[hsl(0_72%_54%/0.08)]',
    border:   'border-[hsl(0_72%_54%/0.30)]',
    progress: 'bg-[hsl(0_72%_54%)]',
  },
  warning: {
    icon:     AlertTriangle,
    accent:   'text-[hsl(38_95%_52%)]',
    bg:       'bg-[hsl(38_95%_52%/0.08)]',
    border:   'border-[hsl(38_95%_52%/0.30)]',
    progress: 'bg-[hsl(38_95%_52%)]',
  },
  info: {
    icon:     Info,
    accent:   'text-[hsl(210_90%_56%)]',
    bg:       'bg-[hsl(210_90%_56%/0.08)]',
    border:   'border-[hsl(210_90%_56%/0.30)]',
    progress: 'bg-[hsl(210_90%_56%)]',
  },
  constraint: {
    icon:     AlertOctagon,
    accent:   'text-[hsl(0_72%_54%)]',
    bg:       'bg-[hsl(0_72%_54%/0.08)]',
    border:   'border-[hsl(0_72%_54%/0.30)]',
    progress: 'bg-[hsl(0_72%_54%)]',
  },
};

// ─── Single Toast Item ────────────────────────────────────────────────────────

function ToastItem({ toast }: { toast: ToastType }) {
  const dismiss = useToast();
  const config  = variantConfig[toast.variant];
  const Icon    = config.icon;
  const hasDuration = (toast.duration ?? 5000) > 0;

  return (
    <div
      className={cn(
        'relative flex gap-3 min-w-[300px] max-w-[420px] w-full',
        'rounded-xl border p-4 overflow-hidden',
        'shadow-[0_8px_32px_hsl(0_0%_0%/0.25)] backdrop-blur-sm',
        'animate-[toast-in_0.35s_cubic-bezier(0.16,1,0.3,1)_both]',
        config.bg,
        config.border,
      )}
      role="alert"
    >
      {/* Icon */}
      <div className="mt-0.5 shrink-0">
        <Icon className={cn('w-5 h-5', config.accent)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold font-nunito leading-tight', config.accent)}>
          {toast.title}
        </p>
        {toast.message && (
          <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed font-nunito">
            {toast.message}
          </p>
        )}

        {/* Constraint violations */}
        {toast.violations && toast.violations.length > 0 && (
          <ul className="mt-2 space-y-1">
            {toast.violations.map((v, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                <span className={cn('mt-0.5 w-1.5 h-1.5 rounded-full shrink-0', config.accent.replace('text-', 'bg-'))} />
                <span className="font-nunito">{v.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => dismiss.dismiss(toast.id)}
        className="shrink-0 mt-0.5 p-1 rounded-md hover:bg-[var(--surface-elevated)] transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      </button>

      {/* Progress bar */}
      {hasDuration && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--border)]">
          <div
            className={cn('h-full', config.progress)}
            style={{
              animation: `progress ${toast.duration ?? 5000}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Toast Container ──────────────────────────────────────────────────────────

export function ToastContainer() {
  const toasts = useToastState();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-3 items-end"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
