'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Star, Clock, MapPin, Users, Edit2, Trash2,
  Send, SendHorizonal, UserPlus, UserMinus, FileText,
} from 'lucide-react';
import {
  Button, Badge, Avatar, Card, Spinner,
} from '@/components/ui';
import { AlertBanner } from '@/components/feedback/AlertBanner';
import { AssignModal } from '@/components/schedule/AssignModal';
import { ShiftFormModal } from '@/components/shifts/ShiftFormModal';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { shiftsService } from '@/services/shifts.service';
import { schedulingService } from '@/services/scheduling.service';
import { auditService } from '@/services/index';
import { parseApiError } from '@/lib/api';
import {
  cn, formatInTz, formatShiftDuration,
  skillDisplayName, timeAgo,
} from '@/lib/utils';

export default function ShiftDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const router     = useRouter();
  const qc         = useQueryClient();
  const { isManager } = useAuth();
  const toast      = useToast();

  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen,   setEditOpen]   = useState(false);
  const [showAudit,  setShowAudit]  = useState(false);

  const { data: shift, isLoading } = useQuery({
    queryKey: ['shifts', Number(id)],
    queryFn:  () => shiftsService.get(Number(id)),
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['audit', 'shift', Number(id)],
    queryFn:  () => auditService.forShift(Number(id)),
    enabled:  showAudit && isManager(),
  });

  const publishMutation = useMutation({
    mutationFn: () =>
      shift?.isPublished
        ? shiftsService.unpublish(shift.id)
        : shiftsService.publish(shift!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] });
      toast.success(shift?.isPublished ? 'Shift unpublished' : 'Shift published');
    },
    onError: (err) => toast.error('Failed', parseApiError(err).message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => shiftsService.delete(shift!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Shift deleted');
      router.push('/shifts');
    },
    onError: (err) => toast.error('Delete failed', parseApiError(err).message),
  });

  const unassignMutation = useMutation({
    mutationFn: (assignmentId: number) => schedulingService.unassign(assignmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts', Number(id)] });
      toast.success('Staff unassigned');
    },
    onError: (err) => toast.error('Unassign failed', parseApiError(err).message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="p-6">
        <EmptyState variant="shifts" title="Shift not found" message="This shift may have been deleted." />
      </div>
    );
  }

  const tz       = shift.location?.timezone ?? 'UTC';
  const assigned = shift.assignments?.filter((a) => a.status === 'ASSIGNED') ?? [];
  const filled   = assigned.length >= shift.headcount;
  const partial  = assigned.length > 0 && !filled;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors font-nunito"
      >
        <ArrowLeft className="w-4 h-4" /> Back to shifts
      </button>

      {/* Hero card */}
      <Card padding="none" className="overflow-hidden">
        {/* Accent bar */}
        <div className={cn(
          'h-1',
          shift.isPremium ? 'bg-[hsl(43_95%_56%)]'
        : filled          ? 'bg-[hsl(155_60%_40%)]'
        : partial         ? 'bg-[hsl(187_100%_42%)]'
        :                   'bg-[hsl(0_72%_54%)]',
        )} />

        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-[var(--text-primary)] font-display capitalize">
                  {skillDisplayName(shift.skill?.name ?? '')}
                </h1>
                {shift.isPremium && (
                  <Badge variant="premium">
                    <Star className="w-3 h-3" fill="currentColor" /> Premium
                  </Badge>
                )}
                <Badge variant={shift.isPublished ? 'success' : 'warning'} dot>
                  {shift.isPublished ? 'Published' : 'Draft'}
                </Badge>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-[var(--text-secondary)] font-nunito">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[var(--text-muted)]" />
                  {shift.location?.name}
                  <span className="text-xs text-[var(--text-muted)]">({shift.location?.timezone})</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                  {formatInTz(shift.startAt, tz, 'EEE, MMM d · h:mm a')} – {formatInTz(shift.endAt, tz, 'h:mm a')}
                  <span className="text-xs text-[var(--text-muted)]">({formatShiftDuration(shift.startAt, shift.endAt)})</span>
                </span>
              </div>
            </div>

            {isManager() && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Edit2 className="w-3.5 h-3.5" />}
                  onClick={() => setEditOpen(true)}
                >
                  Edit
                </Button>
                <Button
                  variant={shift.isPublished ? 'warning' : 'primary'}
                  size="sm"
                  loading={publishMutation.isPending}
                  icon={<Send className="w-3.5 h-3.5" />}
                  onClick={() => publishMutation.mutate()}
                >
                  {shift.isPublished ? 'Unpublish' : 'Publish'}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  loading={deleteMutation.isPending}
                  onClick={() => {
                    if (confirm('Delete this shift? This cannot be undone.')) deleteMutation.mutate();
                  }}
                >
                  Delete
                </Button>
              </div>
            )}
          </div>

          {shift.notes && (
            <div className="mt-4 p-3 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)]">
              <p className="text-sm text-[var(--text-secondary)] font-nunito">{shift.notes}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Staff assignments */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--text-muted)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)] font-nunito">
              Assigned Staff
            </h2>
            <Badge
              variant={filled ? 'success' : partial ? 'accent' : 'danger'}
              dot
            >
              {assigned.length}/{shift.headcount}
            </Badge>
          </div>
          {isManager() && (
            <Button
              variant="primary"
              size="sm"
              icon={<UserPlus className="w-3.5 h-3.5" />}
              onClick={() => setAssignOpen(true)}
              disabled={filled}
            >
              Assign
            </Button>
          )}
        </div>

        {assigned.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-[var(--text-muted)] font-nunito">No staff assigned yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {assigned.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--surface-elevated)] transition-colors"
              >
                <Avatar name={a.user?.name ?? '?'} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] font-nunito">{a.user?.name}</p>
                  <p className="text-xs text-[var(--text-muted)] font-nunito">{a.user?.email}</p>
                </div>
                <Badge variant="success" dot>Assigned</Badge>
                {isManager() && (
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={<UserMinus className="w-3.5 h-3.5" />}
                    onClick={() => unassignMutation.mutate(a.id)}
                    loading={unassignMutation.isPending}
                    className="text-[hsl(0_72%_54%)] hover:bg-[hsl(0_72%_54%/0.08)]"
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {!filled && (
          <AlertBanner
            variant="warning"
            message={`This shift needs ${shift.headcount - assigned.length} more staff member${shift.headcount - assigned.length !== 1 ? 's' : ''}.`}
            dismissible={false}
            className="mt-4"
          />
        )}
      </Card>

      {/* Audit log (managers only) */}
      {isManager() && (
        <Card>
          <button
            onClick={() => setShowAudit((p) => !p)}
            className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] font-nunito hover:text-[var(--text-primary)] transition-colors w-full"
          >
            <FileText className="w-4 h-4" />
            Shift Audit Log
            <span className="ml-auto text-xs text-[var(--text-muted)]">{showAudit ? 'Hide' : 'Show'}</span>
          </button>

          {showAudit && (
            <div className="mt-4 space-y-2">
              {!auditLogs ? (
                <Spinner size="sm" className="mx-auto" />
              ) : auditLogs.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] font-nunito py-2 text-center">No audit history.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)]">
                    <Avatar name={log.actor?.name ?? '?'} size="xs" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)] font-nunito">
                        {log.actor?.name} — <span className="font-normal text-[var(--text-secondary)]">{log.action}</span>
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] font-nunito mt-0.5">{timeAgo(log.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
      )}

      {assignOpen && (
        <AssignModal shift={shift} open={assignOpen} onClose={() => setAssignOpen(false)} />
      )}
      {editOpen && (
        <ShiftFormModal shift={shift} open={editOpen} onClose={() => setEditOpen(false)} />
      )}
    </div>
  );
}
