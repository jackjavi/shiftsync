'use client';

import React from 'react';
import Link from 'next/link';
import { Star, Users, Clock, MapPin, ChevronRight } from 'lucide-react';
import { cn, formatTimeTz, formatDateTz, formatShiftDuration, skillDisplayName } from '@/lib/utils';
import { Badge, Avatar } from '@/components/ui';
import type { Shift } from '@/types';

interface ShiftCardProps {
  shift: Shift;
  className?: string;
}

export function ShiftCard({ shift, className }: ShiftCardProps) {
  const assigned = shift.assignments?.filter((a) => a.status === 'ASSIGNED') ?? [];
  const filled   = assigned.length >= shift.headcount;
  const partial  = assigned.length > 0 && !filled;
  const empty    = assigned.length === 0;

  const tz = shift.location?.timezone ?? 'UTC';

  return (
    <Link
      href={`/shifts/${shift.id}`}
      className={cn(
        'group flex items-start gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]',
        'hover:border-[hsl(187_100%_42%/0.3)] hover:shadow-[0_4px_24px_hsl(0_0%_0%/0.10)]',
        'transition-all duration-200',
        className,
      )}
    >
      {/* Colour stripe */}
      <div className={cn(
        'w-1 self-stretch rounded-full shrink-0 mt-0.5',
        shift.isPremium ? 'bg-[hsl(43_95%_56%)]'
      : filled          ? 'bg-[hsl(155_60%_40%)]'
      : partial         ? 'bg-[hsl(187_100%_42%)]'
      :                   'bg-[hsl(0_72%_54%)]',
      )} />

      <div className="flex-1 min-w-0 space-y-2">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-[var(--text-primary)] font-nunito capitalize">
              {skillDisplayName(shift.skill?.name ?? '')}
            </span>
            {shift.isPremium && (
              <Badge variant="premium">
                <Star className="w-2.5 h-2.5" fill="currentColor" /> Premium
              </Badge>
            )}
            <Badge variant={shift.isPublished ? 'success' : 'warning'} dot>
              {shift.isPublished ? 'Published' : 'Draft'}
            </Badge>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[hsl(187_100%_42%)] transition-colors shrink-0 mt-0.5" />
        </div>

        {/* Meta row */}
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)] font-nunito">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDateTz(shift.startAt, tz)} · {formatTimeTz(shift.startAt, tz)}–{formatTimeTz(shift.endAt, tz)}
            <span className="text-[var(--text-muted)]">({formatShiftDuration(shift.startAt, shift.endAt)})</span>
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {shift.location?.name}
          </span>
        </div>

        {/* Staff row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {assigned.slice(0, 4).map((a) => (
                <Avatar key={a.id} name={a.user?.name ?? '?'} size="xs" className="ring-2 ring-[var(--surface)]" />
              ))}
            </div>
            <span className={cn(
              'text-xs font-semibold font-nunito flex items-center gap-1',
              filled   ? 'text-[hsl(155_60%_40%)]'
            : partial  ? 'text-[hsl(187_100%_42%)]'
            :             'text-[hsl(0_72%_54%)]',
            )}>
              <Users className="w-3 h-3" />
              {assigned.length}/{shift.headcount}
              {filled ? ' · Full' : empty ? ' · Needs staff' : ' · Partial'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
