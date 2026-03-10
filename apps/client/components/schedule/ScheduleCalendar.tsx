'use client';

import React, { useRef, useState, useMemo, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin  from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventContentArg } from '@fullcalendar/core';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Calendar, Filter } from 'lucide-react';
import { cn, formatWeekRange, getWeekStart } from '@/lib/utils';
import { Button, Select, Skeleton } from '@/components/ui';
import { AssignModal } from './AssignModal';
import { shiftsService } from '@/services/shifts.service';
import { locationsService } from '@/services/index';
import { useAuth } from '@/context/AuthContext';
import type { Shift } from '@/types';

export function ScheduleCalendar() {
  const calRef = useRef<FullCalendar>(null);
  const { isManager } = useAuth();

  const [weekStart,     setWeekStart]     = useState(() => getWeekStart());
  const [locationId,    setLocationId]    = useState<number | undefined>();
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [assignOpen,    setAssignOpen]    = useState(false);
  const [view,          setView]          = useState<'timeGridWeek' | 'dayGridMonth'>('timeGridWeek');

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: locationsService.list,
  });

  // Compute week bounds
  const from = weekStart;
  const to   = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    return d.toISOString();
  }, [weekStart]);

  // Fetch shifts
  const { data: shiftsData, isLoading } = useQuery({
    queryKey: ['schedule', locationId, from, to],
    queryFn: () => shiftsService.list({ locationId, from, to, limit: 200 }),
  });

  // Build FullCalendar events
  const events = useMemo(() => {
    return (shiftsData?.data ?? []).map((shift) => {
      const assigned = shift.assignments?.filter((a) => a.status === 'ASSIGNED').length ?? 0;
      const filled   = assigned >= shift.headcount;
      return {
        id:    String(shift.id),
        title: shift.skill?.name?.replace('_', ' ') ?? 'Shift',
        start: shift.startAt,
        end:   shift.endAt,
        extendedProps: { shift, assignedCount: assigned },
        backgroundColor: shift.isPremium
          ? 'hsl(43 95% 56% / 0.15)'
          : filled
          ? 'hsl(155 60% 40% / 0.15)'
          : 'hsl(187 100% 42% / 0.12)',
        borderColor: shift.isPremium
          ? 'hsl(43 95% 56%)'
          : filled
          ? 'hsl(155 60% 40%)'
          : 'hsl(187 100% 42%)',
        textColor: 'var(--text-primary)',
      };
    });
  }, [shiftsData]);

  const navigate = useCallback((dir: 'prev' | 'next' | 'today') => {
    const api = calRef.current?.getApi();
    if (!api) return;
    if (dir === 'today') { api.today(); }
    else if (dir === 'prev') { api.prev(); }
    else { api.next(); }
    const d = api.getDate();
    setWeekStart(getWeekStart(d));
  }, []);

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const shift = arg.event.extendedProps.shift as Shift;
    setSelectedShift(shift);
    if (isManager()) setAssignOpen(true);
  }, [isManager]);

  const renderEventContent = useCallback((arg: EventContentArg) => {
    const shift = arg.event.extendedProps.shift as Shift;
    const count = arg.event.extendedProps.assignedCount as number;
    return (
      <div className="h-full w-full px-1.5 py-1 overflow-hidden">
        <div className="flex items-center gap-1">
          {shift.isPremium && <span className="text-[hsl(43_95%_56%)] text-[8px]">★</span>}
          <span className="text-[10px] font-bold font-nunito truncate capitalize text-[var(--text-primary)]">
            {shift.skill?.name?.replace('_', ' ')}
          </span>
        </div>
        <span className="text-[9px] text-[var(--text-muted)] font-nunito">
          {count}/{shift.headcount} staff
        </span>
      </div>
    );
  }, []);

  return (
    <div className="flex flex-col h-full gap-4 p-4 sm:p-6 animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-[var(--border)] overflow-hidden">
            <button
              onClick={() => navigate('prev')}
              className="px-3 py-2 hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('today')}
              className="px-4 py-2 text-sm font-semibold font-nunito text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] transition-colors border-x border-[var(--border)]"
            >
              Today
            </button>
            <button
              onClick={() => navigate('next')}
              className="px-3 py-2 hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] transition-colors"
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <span className="text-base font-semibold text-[var(--text-primary)] font-display hidden sm:block">
            {formatWeekRange(weekStart)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {locations && locations.length > 1 && (
            <Select
              options={[
                { value: '', label: 'All locations' },
                ...locations.map((l) => ({ value: l.id, label: l.name })),
              ]}
              value={locationId ?? ''}
              onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-44 h-9 text-sm"
            />
          )}
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            {(['timeGridWeek', 'dayGridMonth'] as const).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setView(v);
                  calRef.current?.getApi().changeView(v);
                }}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold font-nunito transition-colors',
                  view === v
                    ? 'bg-[hsl(187_100%_42%/0.15)] text-[hsl(187_100%_42%)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]',
                )}
              >
                {v === 'timeGridWeek' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {[
          { color: 'hsl(155 60% 40%)', label: 'Fully staffed' },
          { color: 'hsl(187 100% 42%)', label: 'Partially staffed' },
          { color: 'hsl(0 72% 54%)',    label: 'Unstaffed' },
          { color: 'hsl(43 95% 56%)',   label: 'Premium shift' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-[var(--text-muted)] font-nunito">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className={cn(
        'flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden',
        'relative min-h-[500px]',
      )}>
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col gap-4 p-4 bg-[var(--surface)]">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        )}
        <FullCalendar
          ref={calRef}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView={view}
          headerToolbar={false}
          events={events}
          eventContent={renderEventContent}
          eventClick={handleEventClick}
          height="100%"
          slotMinTime="06:00:00"
          slotMaxTime="26:00:00"
          allDaySlot={false}
          nowIndicator
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          scrollTime="08:00:00"
          initialDate={weekStart}
          expandRows
        />
      </div>

      {/* Assign modal */}
      {selectedShift && (
        <AssignModal
          shift={selectedShift}
          open={assignOpen}
          onClose={() => { setAssignOpen(false); setSelectedShift(null); }}
        />
      )}
    </div>
  );
}
