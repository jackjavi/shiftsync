'use client';

import React from 'react';
import { Star, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Shift } from '@/types';

interface ShiftEventCardProps {
  shift: Shift;
  assignedCount: number;
  compact?: boolean;
}

export function ShiftEventCard({ shift, assignedCount, compact }: ShiftEventCardProps) {
  const filled = assignedCount >= shift.headcount;
  const partial = assignedCount > 0 && !filled;

  return (
    <div
      className={cn(
        'h-full w-full px-2 py-1 rounded-md overflow-hidden',
        'flex flex-col gap-0.5',
        shift.isPremium
          ? 'bg-[hsl(43_95%_56%/0.20)] border-l-2 border-[hsl(43_95%_56%)]'
          : filled
          ? 'bg-[hsl(155_60%_40%/0.18)] border-l-2 border-[hsl(155_60%_40%)]'
          : partial
          ? 'bg-[hsl(187_100%_42%/0.18)] border-l-2 border-[hsl(187_100%_42%)]'
          : 'bg-[hsl(0_72%_54%/0.15)] border-l-2 border-[hsl(0_72%_54%)]',
      )}
    >
      <div className="flex items-center gap-1">
        {shift.isPremium && <Star className="w-2.5 h-2.5 text-[hsl(43_95%_56%)] shrink-0" fill="currentColor" />}
        <span
          className={cn(
            'text-[10px] font-bold font-nunito truncate leading-none',
            shift.isPremium ? 'text-[hsl(43_95%_56%)]' : 'text-[var(--text-primary)]',
          )}
        >
          {shift.skill?.name?.replace('_', ' ')}
        </span>
      </div>
      {!compact && (
        <div className="flex items-center gap-1">
          <Users className="w-2.5 h-2.5 text-[var(--text-muted)] shrink-0" />
          <span className="text-[9px] text-[var(--text-muted)] font-nunito">
            {assignedCount}/{shift.headcount}
          </span>
        </div>
      )}
    </div>
  );
}
