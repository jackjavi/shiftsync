'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Calendar, Clock, Check } from 'lucide-react';
import { Card, Button, Select, Spinner } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { availabilityService } from '@/services/index';
import { parseApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { AvailabilityWindow } from '@/types';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  userId:       number;
  isOwnProfile: boolean;
  canEdit:      boolean;
}

export function AvailabilityManager({ userId, isOwnProfile, canEdit }: Props) {
  const qc    = useQueryClient();
  const toast = useToast();

  const [adding,    setAdding]    = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime,   setEndTime]   = useState('17:00');
  const [isAvail,   setIsAvail]   = useState(true);

  const queryKey = isOwnProfile ? ['availability', 'me'] : ['availability', userId];

  const { data: windows = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => isOwnProfile ? availabilityService.me() : availabilityService.forUser(userId),
  });

  const recurring = windows.filter((w) => w.type === 'RECURRING');
  const byDay     = new Map<number, AvailabilityWindow[]>();
  recurring.forEach((w) => {
    if (w.dayOfWeek !== null) {
      if (!byDay.has(w.dayOfWeek)) byDay.set(w.dayOfWeek, []);
      byDay.get(w.dayOfWeek)!.push(w);
    }
  });

  const createMutation = useMutation({
    mutationFn: () => availabilityService.create({
      type:        'RECURRING',
      dayOfWeek:   Number(dayOfWeek),
      startTime,
      endTime,
      isAvailable: isAvail,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success('Availability saved');
      setAdding(false);
    },
    onError: (e) => toast.error('Failed', parseApiError(e).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => availabilityService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success('Removed'); },
    onError: (e) => toast.error('Failed', parseApiError(e).message),
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)] font-nunito">Weekly Availability</h2>
        </div>
        {canEdit && !adding && (
          <Button
            variant="outline"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setAdding(true)}
          >
            Add window
          </Button>
        )}
      </div>

      {/* 7-day summary grid */}
      <div className="grid grid-cols-7 gap-1.5 mb-5">
        {[0, 1, 2, 3, 4, 5, 6].map((day) => {
          const dayWindows = byDay.get(day) ?? [];
          const hasAvail   = dayWindows.some((w) => w.isAvailable);
          const hasUnavail = dayWindows.some((w) => !w.isAvailable);
          return (
            <div key={day} className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] font-nunito uppercase tracking-wide">
                {DAY_SHORT[day]}
              </span>
              <div className={cn(
                'w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold font-nunito border',
                hasAvail    ? 'bg-[hsl(155_60%_40%/0.15)] border-[hsl(155_60%_40%/0.3)] text-[hsl(155_60%_40%)]' :
                hasUnavail  ? 'bg-[hsl(0_72%_54%/0.10)] border-[hsl(0_72%_54%/0.2)] text-[hsl(0_72%_54%)]' :
                              'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-muted)]',
              )}>
                {hasAvail ? '✓' : hasUnavail ? '✗' : '—'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed windows list */}
      {isLoading ? (
        <div className="flex items-center gap-2"><Spinner size="sm" /><span className="text-sm text-[var(--text-muted)] font-nunito">Loading…</span></div>
      ) : recurring.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] font-nunito">
          No recurring availability set.{canEdit ? ' Click "Add window" to define your schedule.' : ''}
        </p>
      ) : (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => {
            const dayWindows = byDay.get(day);
            if (!dayWindows?.length) return null;
            return (
              <div key={day} className="flex items-start gap-3">
                <span className="text-xs font-semibold text-[var(--text-muted)] font-nunito w-10 pt-1 flex-shrink-0">
                  {DAY_SHORT[day]}
                </span>
                <div className="flex flex-wrap gap-2 flex-1">
                  {dayWindows.map((w) => (
                    <div
                      key={w.id}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold font-nunito border',
                        w.isAvailable
                          ? 'bg-[hsl(155_60%_40%/0.10)] text-[hsl(155_60%_40%)] border-[hsl(155_60%_40%/0.25)]'
                          : 'bg-[hsl(0_72%_54%/0.08)] text-[hsl(0_72%_54%)] border-[hsl(0_72%_54%/0.2)]',
                      )}
                    >
                      <Clock className="w-3 h-3" />
                      {w.startTime}–{w.endTime}
                      {w.isAvailable ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {canEdit && (
                        <button
                          onClick={() => deleteMutation.mutate(w.id)}
                          disabled={deleteMutation.isPending}
                          className="ml-0.5 hover:opacity-60 transition-opacity"
                          aria-label="Remove"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add window form */}
      {adding && canEdit && (
        <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-3">
          <p className="text-xs font-semibold text-[var(--text-secondary)] font-nunito">New recurring window</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Select
              label="Day"
              options={DAY_LABELS.map((l, i) => ({ value: i, label: l }))}
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value)}
            />
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] font-nunito mb-1">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-sm font-nunito rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[hsl(187_100%_42%/0.4)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] font-nunito mb-1">End</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 text-sm font-nunito rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[hsl(187_100%_42%/0.4)]"
              />
            </div>
            <Select
              label="Status"
              options={[
                { value: 'true',  label: '✓ Available'   },
                { value: 'false', label: '✗ Unavailable' },
              ]}
              value={String(isAvail)}
              onChange={(e) => setIsAvail(e.target.value === 'true')}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
