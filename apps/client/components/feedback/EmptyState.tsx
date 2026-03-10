'use client';

import React from 'react';
import { Calendar, Users, ArrowLeftRight, BarChart3, Bell, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

type EmptyStateVariant = 'shifts' | 'staff' | 'swaps' | 'analytics' | 'notifications' | 'audit' | 'generic';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}

const presets: Record<EmptyStateVariant, { icon: React.FC<{ className?: string }>; title: string; message: string }> = {
  shifts:        { icon: Calendar,        title: 'No shifts yet',            message: 'Create your first shift to get the schedule started.' },
  staff:         { icon: Users,           title: 'No staff found',           message: 'Add staff members and assign them skills and certifications.' },
  swaps:         { icon: ArrowLeftRight,  title: 'No swap requests',         message: 'Swap and drop requests will appear here when staff submit them.' },
  analytics:     { icon: BarChart3,       title: 'No data for this period',  message: 'Adjust the date range or add shifts to see analytics.' },
  notifications: { icon: Bell,            title: "You're all caught up",     message: 'New notifications will appear here.' },
  audit:         { icon: FileText,        title: 'No audit logs',            message: 'System changes and schedule edits will be tracked here.' },
  generic:       { icon: FileText,        title: 'Nothing here yet',         message: 'Data will appear here once available.' },
};

export function EmptyState({ variant = 'generic', title, message, action, className }: EmptyStateProps) {
  const preset = presets[variant];
  const Icon = preset.icon;

  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {/* Decorative ring */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-[var(--surface-elevated)] flex items-center justify-center border border-[var(--border)]">
          <Icon className="w-8 h-8 text-[var(--text-muted)]" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-[hsl(187_100%_42%/0.15)] scale-110" />
        <div className="absolute inset-0 rounded-full border border-[hsl(187_100%_42%/0.08)] scale-125" />
      </div>

      <h3 className="text-base font-semibold text-[var(--text-primary)] font-nunito mb-2">
        {title ?? preset.title}
      </h3>
      <p className="text-sm text-[var(--text-muted)] font-nunito max-w-xs leading-relaxed">
        {message ?? preset.message}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
