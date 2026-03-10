'use client';

import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import type { ConstraintViolation } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'constraint';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;         // ms, 0 = persistent
  violations?: ConstraintViolation[];
}

interface ToastState {
  toasts: Toast[];
}

type ToastAction =
  | { type: 'ADD';    toast: Toast }
  | { type: 'REMOVE'; id: string }
  | { type: 'CLEAR' };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD':
      // Max 5 toasts — drop oldest
      return { toasts: [...state.toasts.slice(-4), action.toast] };
    case 'REMOVE':
      return { toasts: state.toasts.filter((t) => t.id !== action.id) };
    case 'CLEAR':
      return { toasts: [] };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ToastContextValue {
  toasts: Toast[];
  toast: {
    success:    (title: string, message?: string, duration?: number) => void;
    error:      (title: string, message?: string, duration?: number) => void;
    warning:    (title: string, message?: string, duration?: number) => void;
    info:       (title: string, message?: string, duration?: number) => void;
    constraint: (violations: ConstraintViolation[], message?: string) => void;
    dismiss:    (id: string) => void;
    clear:      () => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { toasts: [] });

  const add = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    dispatch({ type: 'ADD', toast: { ...toast, id } });

    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => dispatch({ type: 'REMOVE', id }), duration);
    }
  }, []);

  const toast = useMemo(() => ({
    success: (title: string, message?: string, duration?: number) =>
      add({ variant: 'success', title, message, duration }),

    error: (title: string, message?: string, duration?: number) =>
      add({ variant: 'error', title, message, duration: duration ?? 7000 }),

    warning: (title: string, message?: string, duration?: number) =>
      add({ variant: 'warning', title, message, duration: duration ?? 6000 }),

    info: (title: string, message?: string, duration?: number) =>
      add({ variant: 'info', title, message, duration }),

    constraint: (violations: ConstraintViolation[], message?: string) =>
      add({
        variant: 'constraint',
        title: 'Scheduling Conflict',
        message,
        violations,
        duration: 0, // persistent — user must dismiss
      }),

    dismiss: (id: string) => dispatch({ type: 'REMOVE', id }),
    clear: () => dispatch({ type: 'CLEAR' }),
  }), [add]);

  return (
    <ToastContext.Provider value={{ toasts: state.toasts, toast }}>
      {children}
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx.toast;
}

export function useToastState() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToastState must be used inside <ToastProvider>');
  return ctx.toasts;
}
