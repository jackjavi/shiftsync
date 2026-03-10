'use client';

import React from 'react';
import { TrendingUp, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn, formatHours } from '@/lib/utils';
import { ProgressBar } from '@/components/ui';
import type { WhatIfResult } from '@/types';

interface WhatIfPanelProps {
  data: WhatIfResult;
  userName: string;
}

export function WhatIfPanel({ data, userName }: WhatIfPanelProps) {
  const { currentWeekHours, newShiftHours, projectedWeekHours,
          wouldTriggerOvertimeWarning, wouldExceedOvertimeLimit } = data;

  const status = wouldExceedOvertimeLimit ? 'block'
               : wouldTriggerOvertimeWarning ? 'warn'
               : 'ok';

  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-4 animate-scale-in',
      status === 'block' ? 'border-[hsl(0_72%_54%/0.3)] bg-[hsl(0_72%_54%/0.05)]'
    : status === 'warn'  ? 'border-[hsl(38_95%_52%/0.3)] bg-[hsl(38_95%_52%/0.05)]'
    : 'border-[hsl(155_60%_40%/0.3)] bg-[hsl(155_60%_40%/0.05)]',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2">
        {status === 'block' && <XCircle className="w-4 h-4 text-[hsl(0_72%_54%)]" />}
        {status === 'warn'  && <AlertTriangle className="w-4 h-4 text-[hsl(38_95%_52%)]" />}
        {status === 'ok'   && <CheckCircle2 className="w-4 h-4 text-[hsl(155_60%_40%)]" />}
        <p className={cn(
          'text-sm font-semibold font-nunito',
          status === 'block' ? 'text-[hsl(0_72%_54%)]'
        : status === 'warn'  ? 'text-[hsl(38_95%_52%)]'
        : 'text-[hsl(155_60%_40%)]',
        )}>
          What-If: {userName}
        </p>
      </div>

      {/* Hours breakdown */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Current', value: currentWeekHours, sub: 'this week' },
          { label: '+ Shift',  value: newShiftHours,     sub: 'added'    },
          { label: 'Total',    value: projectedWeekHours, sub: 'projected', highlight: true },
        ].map(({ label, value, sub, highlight }) => (
          <div key={label} className={cn(
            'text-center p-2 rounded-lg',
            highlight ? 'bg-[var(--surface-elevated)] border border-[var(--border)]' : '',
          )}>
            <p className={cn(
              'text-xl font-bold font-nunito',
              highlight && status === 'block' ? 'text-[hsl(0_72%_54%)]'
            : highlight && status === 'warn'  ? 'text-[hsl(38_95%_52%)]'
            : highlight ? 'text-[var(--text-primary)]'
            : 'text-[var(--text-secondary)]',
            )}>
              {formatHours(value)}
            </p>
            <p className="text-[10px] font-semibold text-[var(--text-muted)] font-nunito uppercase tracking-wide">{label}</p>
            <p className="text-[9px] text-[var(--text-muted)] font-nunito">{sub}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <ProgressBar
        value={projectedWeekHours}
        max={40}
        showLabel
        label="vs 40h limit"
        color={status === 'block' ? 'danger' : status === 'warn' ? 'warning' : 'success'}
      />

      {/* Status message */}
      {status !== 'ok' && (
        <p className={cn(
          'text-xs font-nunito',
          status === 'block' ? 'text-[hsl(0_72%_54%)]' : 'text-[hsl(38_95%_52%)]',
        )}>
          {status === 'block'
            ? `Assigning this shift would put ${userName} at ${formatHours(projectedWeekHours)} — exceeds the 40h limit. Manager override required.`
            : `${userName} will approach overtime (${formatHours(projectedWeekHours)}/40h). Consider redistributing hours.`}
        </p>
      )}
    </div>
  );
}
