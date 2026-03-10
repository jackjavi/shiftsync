'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { Button, Skeleton, Avatar, Badge, Card } from '@/components/ui';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { auditService } from '@/services/index';
import { cn, timeAgo } from '@/lib/utils';

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-[hsl(155_60%_40%/0.12)] text-[hsl(155_60%_40%)]',
  UPDATE: 'bg-[hsl(187_100%_42%/0.12)] text-[hsl(187_100%_42%)]',
  DELETE: 'bg-[hsl(0_72%_54%/0.12)] text-[hsl(0_72%_54%)]',
  ASSIGN: 'bg-[hsl(210_90%_56%/0.12)] text-[hsl(210_90%_56%)]',
  UNASSIGN: 'bg-[hsl(38_95%_52%/0.12)] text-[hsl(38_95%_52%)]',
  PUBLISH: 'bg-[hsl(155_60%_40%/0.12)] text-[hsl(155_60%_40%)]',
  UNPUBLISH: 'bg-[hsl(38_95%_52%/0.12)] text-[hsl(38_95%_52%)]',
  APPROVE: 'bg-[hsl(155_60%_40%/0.12)] text-[hsl(155_60%_40%)]',
  OVERRIDE: 'bg-[hsl(43_95%_56%/0.12)] text-[hsl(43_95%_56%)]',
};

export default function AuditPage() {
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page],
    queryFn:  () => auditService.list({ page, limit: 30 }),
    enabled:  isAdmin(),
  });

  const logs  = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const pages = Math.ceil(total / 30);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (!isAdmin()) {
    return (
      <div className="p-6">
        <EmptyState variant="audit" title="Access denied" message="Only administrators can view the audit log." />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] font-display">Audit Log</h1>
        <p className="text-sm text-[var(--text-secondary)] font-nunito mt-1">
          {total > 0 ? `${total} logged actions` : 'Complete system change history'}
        </p>
      </div>

      {/* Log list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState variant="audit" />
      ) : (
        <Card padding="none">
          <div className="divide-y divide-[var(--border)]">
            {logs.map((log) => {
              const isOpen = expanded.has(log.id);
              const actionColor = ACTION_COLORS[log.action] ?? 'bg-[var(--surface-elevated)] text-[var(--text-secondary)]';
              const hasDiff = !!(log.before || log.after);

              return (
                <div key={log.id}>
                  <button
                    onClick={() => hasDiff && toggleExpand(log.id)}
                    className={cn(
                      'w-full flex items-center gap-4 px-5 py-3 text-left transition-colors',
                      hasDiff ? 'hover:bg-[var(--surface-elevated)]' : 'cursor-default',
                    )}
                  >
                    {/* Actor */}
                    <Avatar name={log.actor?.name ?? '?'} size="xs" />

                    {/* Action + entity */}
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded font-nunito', actionColor)}>
                        {log.action}
                      </span>
                      <span className="text-sm text-[var(--text-primary)] font-nunito">
                        <span className="font-semibold">{log.actor?.name}</span>
                        {' '}
                        <span className="text-[var(--text-secondary)]">
                          {log.entityType.toLowerCase()} #{log.entityId}
                        </span>
                      </span>
                    </div>

                    {/* Time */}
                    <span className="text-[10px] text-[var(--text-muted)] font-nunito shrink-0">{timeAgo(log.createdAt)}</span>

                    {/* Expand chevron */}
                    {hasDiff && (
                      isOpen
                        ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                    )}
                  </button>

                  {/* Expanded diff */}
                  {isOpen && hasDiff && (
                    <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {log.before && (
                        <div>
                          <p className="text-[10px] font-bold text-[hsl(0_72%_54%)] font-nunito uppercase mb-1">Before</p>
                          <pre className="text-[10px] font-mono text-[var(--text-secondary)] bg-[var(--surface-elevated)] rounded-lg p-3 overflow-auto max-h-40 border border-[var(--border)]">
                            {JSON.stringify(log.before, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.after && (
                        <div>
                          <p className="text-[10px] font-bold text-[hsl(155_60%_40%)] font-nunito uppercase mb-1">After</p>
                          <pre className="text-[10px] font-mono text-[var(--text-secondary)] bg-[var(--surface-elevated)] rounded-lg p-3 overflow-auto max-h-40 border border-[var(--border)]">
                            {JSON.stringify(log.after, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-[var(--text-muted)] font-nunito px-2">Page {page} of {pages}</span>
          <Button variant="secondary" size="sm" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
