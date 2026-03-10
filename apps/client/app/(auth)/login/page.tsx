'use client';

import React, { useState } from 'react';
import { useForm }           from 'react-hook-form';
import { zodResolver }       from '@hookform/resolvers/zod';
import { z }                 from 'zod';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Zap } from 'lucide-react';
import { useAuth }           from '@/context/AuthContext';
import { useToast }          from '@/context/ToastContext';
import { parseApiError }     from '@/lib/api';
import { Button, Input }     from '@/components/ui';
import { cn }                from '@/lib/utils';
import type { LoginFormData } from '@/types';

// ─── Schema ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { login }         = useAuth();
  const toast             = useToast();
  const [showPw, setShowPw] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
      toast.success('Welcome back!', 'Redirecting to your schedule…');
    } catch (err) {
      const apiErr = parseApiError(err);
      toast.error('Login failed', apiErr.message);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — brand ────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[hsl(215_28%_7%)] flex-col justify-between p-12">
        {/* Grid background */}
        <div className="absolute inset-0 bg-grid opacity-40" />

        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-[hsl(187_100%_42%/0.08)] blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full bg-[hsl(210_90%_56%/0.06)] blur-3xl" />

        {/* Logo */}
        <div className="relative z-10 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[hsl(187_100%_42%)] flex items-center justify-center shadow-[0_0_24px_hsl(187_100%_42%/0.4)]">
              <Zap className="w-5 h-5 text-[hsl(215_28%_7%)]" fill="currentColor" />
            </div>
            <span className="text-xl font-bold text-white font-nunito tracking-tight">ShiftSync</span>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-6">
          <div className="animate-fade-in delay-100">
            <h1 className="text-5xl font-bold font-display text-white leading-tight">
              Scheduling,<br />
              <span className="gradient-text">simplified.</span>
            </h1>
          </div>
          <p className="text-lg text-[hsl(215_15%_65%)] font-nunito leading-relaxed max-w-sm animate-fade-in delay-200">
            Manage shifts across all four Coastal Eats locations — from Santa Monica to Fort Lauderdale — in one unified platform.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 animate-fade-in delay-300">
            {['Real-time updates', 'Smart constraints', 'Fairness analytics', 'Multi-timezone'].map((f) => (
              <span
                key={f}
                className="px-3 py-1 text-xs font-semibold rounded-full bg-[hsl(187_100%_42%/0.12)] text-[hsl(187_100%_42%)] border border-[hsl(187_100%_42%/0.20)] font-nunito"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <div className="relative z-10 animate-fade-in delay-400">
          <div className="border-l-2 border-[hsl(187_100%_42%/0.4)] pl-4">
            <p className="text-sm text-[hsl(215_15%_55%)] font-nunito italic">
              "No more spreadsheets. No more Sunday chaos."
            </p>
            <p className="mt-1 text-xs text-[hsl(215_15%_40%)] font-nunito">— Coastal Eats Operations Team</p>
          </div>
        </div>
      </div>

      {/* ── Right panel — form ────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-[var(--bg)]">
        <div className="w-full max-w-md animate-slide-up">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl bg-[hsl(187_100%_42%)] flex items-center justify-center">
              <Zap className="w-4 h-4 text-[hsl(215_28%_7%)]" fill="currentColor" />
            </div>
            <span className="text-lg font-bold text-[var(--text-primary)] font-nunito">ShiftSync</span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] font-nunito">
              Sign in to your account
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)] font-nunito">
              Enter your credentials to access the scheduling platform.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@coastaleats.com"
              leftIcon={<Mail className="w-4 h-4" />}
              error={errors.email?.message}
              {...register('email')}
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                leftIcon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => !p)}
                    className="hover:text-[var(--text-primary)] transition-colors"
                    tabIndex={-1}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                error={errors.password?.message}
                {...register('password')}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              className="w-full mt-2"
              iconRight={!isSubmitting && <ArrowRight className="w-4 h-4" />}
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          {/* Test credentials */}
          <div className="mt-8 p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)]">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide font-nunito mb-3">
              Test Credentials
            </p>
            <div className="space-y-2">
              {[
                { role: 'Admin',        email: 'admin@coastaleats.com',        pw: 'Admin1234!'  },
                { role: 'Manager (West)', email: 'manager.west@coastaleats.com', pw: 'Manager123!' },
                { role: 'Staff',        email: 'sarah@coastaleats.com',        pw: 'Staff123!'   },
              ].map(({ role, email, pw }) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => {
                    const emailInput = document.getElementById('email-address') as HTMLInputElement;
                    const pwInput    = document.getElementById('password') as HTMLInputElement;
                    // Use RHF setValue via direct input event simulation
                    const emailNative = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
                    if (emailNative?.set && emailInput && pwInput) {
                      emailNative.set.call(emailInput, email);
                      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                      emailNative.set.call(pwInput, pw);
                      pwInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg',
                    'text-left text-xs font-nunito transition-colors',
                    'hover:bg-[hsl(187_100%_42%/0.08)] border border-transparent hover:border-[hsl(187_100%_42%/0.15)]',
                  )}
                >
                  <span className="font-semibold text-[var(--text-secondary)]">{role}</span>
                  <span className="text-[var(--text-muted)] truncate ml-2">{email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
