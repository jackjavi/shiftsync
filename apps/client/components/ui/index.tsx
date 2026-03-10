'use client';

// ─── Button ───────────────────────────────────────────────────────────────────

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning' | 'outline';
type ButtonSize    = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant;
  size?:     ButtonSize;
  loading?:  boolean;
  icon?:     React.ReactNode;
  iconRight?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:   'bg-[hsl(187_100%_42%)] text-[hsl(215_28%_7%)] hover:bg-[hsl(187_100%_36%)] shadow-[0_0_20px_hsl(187_100%_42%/0.25)] hover:shadow-[0_0_28px_hsl(187_100%_42%/0.35)]',
  secondary: 'bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border)] hover:border-[hsl(187_100%_42%/0.4)] hover:bg-[hsl(187_100%_42%/0.06)]',
  ghost:     'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]',
  danger:    'bg-[hsl(0_72%_54%/0.12)] text-[hsl(0_72%_54%)] border border-[hsl(0_72%_54%/0.25)] hover:bg-[hsl(0_72%_54%/0.20)]',
  warning:   'bg-[hsl(38_95%_52%/0.12)] text-[hsl(38_95%_52%)] border border-[hsl(38_95%_52%/0.25)] hover:bg-[hsl(38_95%_52%/0.20)]',
  outline:   'border border-[hsl(187_100%_42%/0.4)] text-[hsl(187_100%_42%)] hover:bg-[hsl(187_100%_42%/0.06)]',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'h-7  px-2.5 text-xs  gap-1.5 rounded-md',
  sm: 'h-8  px-3   text-sm  gap-2   rounded-lg',
  md: 'h-10 px-4   text-sm  gap-2   rounded-lg',
  lg: 'h-12 px-6   text-base gap-2.5 rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold font-nunito',
        'transition-all duration-200 cursor-pointer select-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
      {iconRight && !loading && <span className="shrink-0">{iconRight}</span>}
    </button>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'premium' | 'accent';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const badgeStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border)]',
  success: 'bg-[hsl(155_60%_40%/0.12)] text-[hsl(155_60%_40%)] border border-[hsl(155_60%_40%/0.25)]',
  warning: 'bg-[hsl(38_95%_52%/0.12)]  text-[hsl(38_95%_52%)]  border border-[hsl(38_95%_52%/0.25)]',
  danger:  'bg-[hsl(0_72%_54%/0.12)]   text-[hsl(0_72%_54%)]   border border-[hsl(0_72%_54%/0.25)]',
  info:    'bg-[hsl(210_90%_56%/0.12)] text-[hsl(210_90%_56%)] border border-[hsl(210_90%_56%/0.25)]',
  premium: 'bg-[hsl(43_95%_56%/0.12)]  text-[hsl(43_95%_56%)]  border border-[hsl(43_95%_56%/0.25)]',
  accent:  'bg-[hsl(187_100%_42%/0.12)] text-[hsl(187_100%_42%)] border border-[hsl(187_100%_42%/0.25)]',
};

export function Badge({ variant = 'default', children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold font-nunito',
        badgeStyles[variant],
        className,
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  accent?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  onClick?: () => void;
}

export function Card({ children, className, hover, accent, padding = 'md', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-[var(--border)] bg-[var(--surface)]',
        'transition-all duration-200',
        hover && 'hover:border-[hsl(187_100%_42%/0.3)] hover:shadow-[0_4px_24px_hsl(0_0%_0%/0.12)] cursor-pointer',
        accent && 'border-l-2 border-l-[hsl(187_100%_42%)]',
        padding === 'sm'   && 'p-3',
        padding === 'md'   && 'p-5',
        padding === 'lg'   && 'p-6',
        padding === 'none' && '',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-base font-semibold text-[var(--text-primary)] font-nunito', className)}>
      {children}
    </h3>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:       string;
  error?:       string;
  hint?:        string;
  leftIcon?:    React.ReactNode;
  rightIcon?:   React.ReactNode;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, containerClassName, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-semibold text-[var(--text-secondary)] font-nunito">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-[var(--text-muted)]">{leftIcon}</div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full h-10 rounded-lg border bg-[var(--surface-elevated)]',
              'text-sm font-nunito text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
              'transition-all duration-200',
              'focus:outline-none focus:border-[hsl(187_100%_42%)] focus:ring-2 focus:ring-[hsl(187_100%_42%/0.15)]',
              error
                ? 'border-[hsl(0_72%_54%/0.5)] focus:border-[hsl(0_72%_54%)] focus:ring-[hsl(0_72%_54%/0.15)]'
                : 'border-[var(--border)]',
              leftIcon  ? 'pl-9'  : 'px-3',
              rightIcon ? 'pr-9'  : 'pr-3',
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 text-[var(--text-muted)]">{rightIcon}</div>
          )}
        </div>
        {error && <p className="text-xs text-[hsl(0_72%_54%)] font-nunito">{error}</p>}
        {hint && !error && <p className="text-xs text-[var(--text-muted)] font-nunito">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';

// ─── Select ───────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
  options: Array<{ value: string | number; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, containerClassName, className, options, placeholder, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label htmlFor={selectId} className="text-sm font-semibold text-[var(--text-secondary)] font-nunito">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full h-10 rounded-lg border bg-[var(--surface-elevated)] px-3',
            'text-sm font-nunito text-[var(--text-primary)]',
            'transition-all duration-200 cursor-pointer appearance-none',
            'focus:outline-none focus:border-[hsl(187_100%_42%)] focus:ring-2 focus:ring-[hsl(187_100%_42%/0.15)]',
            error ? 'border-[hsl(0_72%_54%/0.5)]' : 'border-[var(--border)]',
            className,
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-[hsl(0_72%_54%)] font-nunito">{error}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  open:        boolean;
  onClose:     () => void;
  title?:      string;
  children:    React.ReactNode;
  size?:       'sm' | 'md' | 'lg' | 'xl';
  className?:  string;
}

const modalSizes: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, children, size = 'md', className }: ModalProps) {
  React.useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[hsl(215_28%_7%/0.75)] backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        className={cn(
          'relative w-full rounded-2xl border border-[var(--border)]',
          'bg-[var(--surface)] shadow-xl',
          'animate-scale-in',
          modalSizes[size],
          className,
        )}
        role="dialog"
        aria-modal
      >
        {title && (
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] font-nunito">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <div className={cn('animate-spin rounded-full border-2 border-[var(--border)] border-t-[hsl(187_100%_42%)]', sizes[size], className)} />
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('rounded-lg shimmer', className)} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

import { getInitials, avatarColor } from '@/lib/utils';

interface AvatarProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const avatarSizes = { xs: 'w-6 h-6 text-[9px]', sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold font-nunito shrink-0 select-none',
        avatarSizes[size],
        className,
      )}
      style={{ backgroundColor: avatarColor(name) + '22', color: avatarColor(name) }}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  value:      number;  // 0–100
  max?:       number;
  color?:     'accent' | 'success' | 'warning' | 'danger';
  showLabel?: boolean;
  label?:     string;
  className?: string;
}

const progressColors = {
  accent:  'bg-[hsl(187_100%_42%)]',
  success: 'bg-[hsl(155_60%_40%)]',
  warning: 'bg-[hsl(38_95%_52%)]',
  danger:  'bg-[hsl(0_72%_54%)]',
};

export function ProgressBar({ value, max = 100, color = 'accent', showLabel, label, className }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const autoColor: typeof color =
    pct >= 100 ? 'danger' : pct >= 85 ? 'warning' : color;

  return (
    <div className={cn('space-y-1', className)}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center">
          {label && <span className="text-xs text-[var(--text-muted)] font-nunito">{label}</span>}
          {showLabel && <span className="text-xs font-semibold text-[var(--text-secondary)] font-nunito">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className="h-1.5 rounded-full bg-[var(--surface-elevated)] overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', progressColors[autoColor])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
