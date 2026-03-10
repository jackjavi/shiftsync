'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button, Skeleton, Badge } from '@/components/ui';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useToast } from '@/context/ToastContext';
import { notificationsService } from '@/services/index';
import { parseApiError } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';

const NOTIF_ICONS: Record<string, string> = {
  SHIFT_ASSIGNED:    '📋', SHIFT_CHANGED:   '✏️',  SHIFT_UNASSIGNED: '❌',
  SWAP_REQUESTED:    '🔄', SWAP_ACCEPTED:   '✅',  SWAP_REJECTED:    '❌',
  SWAP_APPROVED:     '✅', SWAP_CANCELLED:  '🚫', SWAP_EXPIRED:     '⏰',
  DROP_AVAILABLE:    '🎯', DROP_EXPIRING:   '⏰',
  SCHEDULE_PUBLISHED:'📢', SCHEDULE_UNPUBLISHED: '📴',
  OVERTIME_WARNING:  '⚠️', CONSECUTIVE_DAY_WARNING: '🔴',
  AVAILABILITY_CHANGED: '📅',
};

export default function NotificationsPage() {
  const qc    = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => notificationsService.list({ limit: 50 }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['notifications'] }); toast.success('All marked as read'); },
    onError:    (e) => toast.error('Failed', parseApiError(e).message),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: number) => notificationsService.markRead(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.data ?? [];
  const unreadCount   = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] font-display">Notifications</h1>
          {unreadCount > 0 && (
            <Badge variant="danger" dot>{unreadCount} unread</Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            icon={<CheckCheck className="w-4 h-4" />}
            loading={markAllMutation.isPending}
            onClick={() => markAllMutation.mutate()}
          >
            Mark all read
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState variant="notifications" />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                'flex items-start gap-4 p-4 rounded-xl border transition-all duration-200',
                n.isRead
                  ? 'border-[var(--border)] bg-[var(--surface)]'
                  : 'border-[hsl(187_100%_42%/0.20)] bg-[hsl(187_100%_42%/0.04)]',
              )}
            >
              {/* Icon */}
              <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0',
                n.isRead ? 'bg-[var(--surface-elevated)]' : 'bg-[hsl(187_100%_42%/0.12)]',
              )}>
                {NOTIF_ICONS[n.type] ?? '🔔'}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn(
                    'text-sm font-semibold font-nunito',
                    n.isRead ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]',
                  )}>
                    {n.title}
                  </p>
                  <span className="text-[10px] text-[var(--text-muted)] font-nunito shrink-0">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] font-nunito mt-0.5 leading-relaxed">{n.body}</p>
              </div>

              {/* Mark read */}
              {!n.isRead && (
                <button
                  onClick={() => markOneMutation.mutate(n.id)}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-[var(--surface-elevated)] text-[hsl(187_100%_42%)] transition-colors"
                  aria-label="Mark as read"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
