'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, addWeeks, subWeeks, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, AlertTriangle, XCircle, Clock } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { Button, Select, Spinner, Card, ProgressBar, Avatar } from '@/components/ui';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AlertBanner } from '@/components/feedback/AlertBanner';
import { locationsService, overtimeService } from '@/services/index';
import { formatWeekRange, getWeekStart, formatHours, cn } from '@/lib/utils';
import type { StaffWeeklyHours } from '@/types';

export default function OvertimePage() {
  const [weekStart,  setWeekStart]  = useState(() => getWeekStart());
  const [locationId, setLocationId] = useState<number | undefined>();

  const { data: locations } = useQuery({ queryKey: ['locations'], queryFn: locationsService.list });

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['overtime', locationId, weekStart],
    queryFn:  () => overtimeService.dashboard(locationId ?? 0, weekStart),
    enabled:  !!locationId,
  });

  const navigate = (dir: 'prev' | 'next') => {
    const d = parseISO(weekStart);
    setWeekStart(getWeekStart(dir === 'prev' ? subWeeks(d, 1) : addWeeks(d, 1)));
  };

  const staff    = dashboard?.staff ?? [];
  const atRisk   = staff.filter((s) => s.hasOvertimeWarning || s.hasOvertimeViolation);
  const violations = staff.filter((s) => s.requiresOverride);

  // Chart data
  const chartData = staff.map((s) => ({
    name:     s.userName.split(' ')[0],
    hours:    s.scheduledHours,
    desired:  s.desiredHours ?? 0,
    overtime: s.overtimeHours,
  }));

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] font-display">Overtime Tracker</h1>
          <p className="text-sm text-[var(--text-secondary)] font-nunito mt-1">
            Weekly hours and overtime risk dashboard
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          options={[
            { value: '', label: 'Select location…', disabled: !locationId },
            ...(locations ?? []).map((l) => ({ value: l.id, label: l.name })),
          ]}
          value={locationId ?? ''}
          onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : undefined)}
          className="w-48 h-10"
        />
        <div className="flex items-center rounded-lg border border-[var(--border)] overflow-hidden">
          <button onClick={() => navigate('prev')} className="px-3 py-2 hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-4 py-2 text-sm font-semibold font-nunito text-[var(--text-secondary)] border-x border-[var(--border)]">
            {formatWeekRange(weekStart)}
          </span>
          <button onClick={() => navigate('next')} className="px-3 py-2 hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!locationId ? (
        <AlertBanner variant="info" message="Select a location to view overtime data." dismissible={false} />
      ) : isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : staff.length === 0 ? (
        <EmptyState variant="analytics" title="No data for this week" message="No shifts scheduled at this location for the selected week." />
      ) : (
        <>
          {/* Summary stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Staff',     value: staff.length,                       icon: Clock,         color: 'text-[hsl(187_100%_42%)]' },
              { label: 'At Risk',         value: atRisk.length,                      icon: AlertTriangle, color: 'text-[hsl(38_95%_52%)]'   },
              { label: 'Violations',      value: violations.length,                  icon: XCircle,       color: 'text-[hsl(0_72%_54%)]'    },
              { label: 'Total OT Hours',  value: `${formatHours(dashboard?.totalOvertimeHours ?? 0)}`, icon: Clock, color: 'text-[hsl(0_72%_54%)]' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} padding="md">
                <div className="flex items-center gap-3">
                  <Icon className={cn('w-5 h-5 shrink-0', color)} />
                  <div>
                    <p className="text-xl font-bold text-[var(--text-primary)] font-nunito">{value}</p>
                    <p className="text-xs text-[var(--text-muted)] font-nunito">{label}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <Card>
              <h2 className="text-base font-semibold text-[var(--text-primary)] font-nunito mb-4">
                Scheduled Hours by Staff
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 8 }}
                    labelStyle={{ color: 'var(--text-primary)', fontFamily: 'var(--font-nunito)' }}
                  />
                  <ReferenceLine y={35} stroke="hsl(38 95% 52%)" strokeDasharray="4 2" label={{ value: 'Warn 35h', fill: 'hsl(38 95% 52%)', fontSize: 10 }} />
                  <ReferenceLine y={40} stroke="hsl(0 72% 54%)"  strokeDasharray="4 2" label={{ value: 'Limit 40h', fill: 'hsl(0 72% 54%)',  fontSize: 10 }} />
                  <Bar dataKey="hours"    fill="hsl(187 100% 42% / 0.7)" radius={[3, 3, 0, 0]} name="Scheduled" />
                  <Bar dataKey="overtime" fill="hsl(0 72% 54% / 0.7)"   radius={[3, 3, 0, 0]} name="Overtime"  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Staff table */}
          <Card padding="none">
            <div className="px-5 pt-5 pb-3 border-b border-[var(--border)]">
              <h2 className="text-base font-semibold text-[var(--text-primary)] font-nunito">Staff Detail</h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {staff.map((s) => <StaffOvertimeRow key={s.userId} data={s} />)}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function StaffOvertimeRow({ data }: { data: StaffWeeklyHours }) {
  const status = data.hasOvertimeViolation ? 'violation'
               : data.hasOvertimeWarning   ? 'warning'
               : 'ok';

  return (
    <div className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--surface-elevated)] transition-colors">
      <Avatar name={data.userName} size="sm" />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)] font-nunito">{data.userName}</span>
          {data.hasOvertimeViolation && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[hsl(0_72%_54%/0.12)] text-[hsl(0_72%_54%)] font-nunito">EXCEEDS LIMIT</span>
          )}
          {data.hasOvertimeWarning && !data.hasOvertimeViolation && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[hsl(38_95%_52%/0.12)] text-[hsl(38_95%_52%)] font-nunito">AT RISK</span>
          )}
          {data.consecutiveDays >= 6 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[hsl(280_60%_56%/0.12)] text-[hsl(280_60%_56%)] font-nunito">{data.consecutiveDays}D CONSEC</span>
          )}
        </div>
        <ProgressBar
          value={data.scheduledHours}
          max={40}
          color={status === 'violation' ? 'danger' : status === 'warning' ? 'warning' : 'success'}
          className="max-w-xs"
        />
      </div>
      <div className="text-right shrink-0">
        <p className={cn(
          'text-sm font-bold font-nunito',
          status === 'violation' ? 'text-[hsl(0_72%_54%)]'
        : status === 'warning'   ? 'text-[hsl(38_95%_52%)]'
        :                          'text-[var(--text-primary)]',
        )}>
          {formatHours(data.scheduledHours)}
        </p>
        {data.desiredHours && (
          <p className="text-[10px] text-[var(--text-muted)] font-nunito">of {formatHours(data.desiredHours)} desired</p>
        )}
      </div>
    </div>
  );
}
