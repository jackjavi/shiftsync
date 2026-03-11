"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
} from "lucide-react";
import { Button, Skeleton, Avatar, Card } from "@/components/ui";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { auditService } from "@/services/index";
import { cn, timeAgo } from "@/lib/utils";

const ACTION_COLORS: Record<string, string> = {
  CREATED: "bg-[hsl(155_60%_40%/0.12)] text-[hsl(155_60%_40%)]",
  CREATE: "bg-[hsl(155_60%_40%/0.12)] text-[hsl(155_60%_40%)]",
  UPDATED: "bg-[hsl(187_100%_42%/0.12)] text-[hsl(187_100%_42%)]",
  UPDATE: "bg-[hsl(187_100%_42%/0.12)] text-[hsl(187_100%_42%)]",
  DELETED: "bg-[hsl(0_72%_54%/0.12)] text-[hsl(0_72%_54%)]",
  DELETE: "bg-[hsl(0_72%_54%/0.12)] text-[hsl(0_72%_54%)]",
  ASSIGNED: "bg-[hsl(210_90%_56%/0.12)] text-[hsl(210_90%_56%)]",
  ASSIGN: "bg-[hsl(210_90%_56%/0.12)] text-[hsl(210_90%_56%)]",
  UNASSIGNED: "bg-[hsl(38_95%_52%/0.12)] text-[hsl(38_95%_52%)]",
  UNASSIGN: "bg-[hsl(38_95%_52%/0.12)] text-[hsl(38_95%_52%)]",
  PUBLISHED: "bg-[hsl(155_60%_40%/0.12)] text-[hsl(155_60%_40%)]",
  PUBLISH: "bg-[hsl(155_60%_40%/0.12)] text-[hsl(155_60%_40%)]",
  UNPUBLISH: "bg-[hsl(38_95%_52%/0.12)] text-[hsl(38_95%_52%)]",
  APPROVED: "bg-[hsl(155_60%_40%/0.12)] text-[hsl(155_60%_40%)]",
  APPROVE: "bg-[hsl(155_60%_40%/0.12)] text-[hsl(155_60%_40%)]",
  OVERRIDE: "bg-[hsl(43_95%_56%/0.12)] text-[hsl(43_95%_56%)]",
};

export default function AuditPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["audit", page, entityType, from, to],
    queryFn: () =>
      auditService.list({
        page,
        limit: 30,
        entityType: entityType || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    enabled: isAdmin(),
  });

  const logs = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const pages = Math.ceil(total / 30);

  // ── Export handler ──────────────────────────────────────────────────────────

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (entityType) params.set("entityType", entityType);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const base =
        process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";
      const url = `${base}/audit/export?${params.toString()}`;
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("shiftsync_token")
          : null;

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error(`Server responded ${res.status}`);

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `audit-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      toast.success("Export ready", "Audit log downloaded as CSV.");
    } catch (err) {
      toast.error(
        "Export failed",
        err instanceof Error ? err.message : "Could not download CSV.",
      );
    } finally {
      setExporting(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setEntityType("");
    setFrom("");
    setTo("");
    setPage(1);
  };
  const hasFilters = !!(entityType || from || to);

  // ── Access guard ─────────────────────────────────────────────────────────────

  if (!isAdmin()) {
    return (
      <div className="p-6">
        <EmptyState
          variant="audit"
          title="Access denied"
          message="Only administrators can view the audit log."
        />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] font-display">
            Audit Log
          </h1>
          <p className="text-sm text-[var(--text-secondary)] font-nunito mt-1">
            {total > 0
              ? `${total} logged action${total !== 1 ? "s" : ""}${hasFilters ? " (filtered)" : ""}`
              : "Complete system change history"}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Download className="w-4 h-4" />}
          loading={exporting}
          onClick={handleExportCsv}
        >
          Export CSV
        </Button>
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 flex-wrap p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
        <Filter className="w-4 h-4 text-[var(--text-muted)] shrink-0" />

        {/* Entity type */}
        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          className="h-9 px-3 text-sm font-nunito rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[hsl(187_100%_42%)] transition-colors cursor-pointer"
        >
          <option value="">All entity types</option>
          <option value="Shift">Shift</option>
          <option value="ShiftAssignment">Assignment</option>
          <option value="SwapRequest">Swap</option>
          <option value="User">User</option>
        </select>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] font-nunito shrink-0">
            From
          </span>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 text-sm font-nunito rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[hsl(187_100%_42%)] transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] font-nunito shrink-0">
            To
          </span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 text-sm font-nunito rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[hsl(187_100%_42%)] transition-colors"
          />
        </div>

        {hasFilters && (
          <>
            <button
              onClick={clearFilters}
              className="text-xs font-semibold font-nunito text-[hsl(187_100%_42%)] hover:underline"
            >
              Clear filters
            </button>
            <span className="ml-auto text-xs text-[var(--text-muted)] font-nunito italic hidden sm:block">
              Active filters also apply to CSV export
            </span>
          </>
        )}
      </div>

      {/* ── Log list ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState variant="audit" />
      ) : (
        <Card padding="none">
          <div className="divide-y divide-[var(--border)]">
            {logs.map((log) => {
              const isOpen = expanded.has(log.id);
              const actionColor =
                ACTION_COLORS[log.action] ??
                "bg-[var(--surface-elevated)] text-[var(--text-secondary)]";
              const hasDiff = !!(log.before || log.after);

              return (
                <div key={log.id}>
                  <button
                    onClick={() => hasDiff && toggleExpand(log.id)}
                    className={cn(
                      "w-full flex items-center gap-4 px-5 py-3 text-left transition-colors",
                      hasDiff
                        ? "hover:bg-[var(--surface-elevated)]"
                        : "cursor-default",
                    )}
                  >
                    {/* Actor avatar */}
                    <Avatar name={log.actor?.name ?? "?"} size="xs" />

                    {/* Action badge + description */}
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded font-nunito shrink-0",
                          actionColor,
                        )}
                      >
                        {log.action}
                      </span>
                      <span className="text-sm text-[var(--text-primary)] font-nunito">
                        <span className="font-semibold">
                          {log.actor?.name ?? "System"}
                        </span>
                        {" · "}
                        <span className="text-[var(--text-secondary)] capitalize">
                          {log.entityType
                            .replace(/([A-Z])/g, " $1")
                            .trim()
                            .toLowerCase()}{" "}
                          #{log.entityId}
                        </span>
                      </span>
                    </div>

                    {/* Timestamp */}
                    <span className="text-[10px] text-[var(--text-muted)] font-nunito shrink-0">
                      {timeAgo(log.createdAt)}
                    </span>

                    {/* Expand chevron */}
                    {hasDiff &&
                      (isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                      ))}
                  </button>

                  {/* Expanded before/after diff */}
                  {isOpen && hasDiff && (
                    <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {log.before && (
                        <div>
                          <p className="text-[10px] font-bold text-[hsl(0_72%_54%)] font-nunito uppercase tracking-wide mb-1.5">
                            Before
                          </p>
                          <pre className="text-[10px] font-mono text-[var(--text-secondary)] bg-[var(--surface-elevated)] rounded-lg p-3 overflow-auto max-h-40 border border-[var(--border)]">
                            {JSON.stringify(log.before, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.after && (
                        <div>
                          <p className="text-[10px] font-bold text-[hsl(155_60%_40%)] font-nunito uppercase tracking-wide mb-1.5">
                            After
                          </p>
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

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-[var(--text-muted)] font-nunito px-2">
            Page {page} of {pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page === pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
