"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  Check,
  X,
  ShieldCheck,
  Clock,
  Star,
  MapPin,
} from "lucide-react";
import { Button, Badge, Avatar, Card, Skeleton, Select } from "@/components/ui";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { swapsService } from "@/services/index";
import { parseApiError } from "@/lib/api";
import {
  cn,
  formatInTz,
  swapStatusColor,
  timeAgo,
  skillDisplayName,
} from "@/lib/utils";
import type { SwapRequest, SwapStatus } from "@/types";

const STATUS_TABS: Array<{ value: SwapStatus | ""; label: string }> = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "EXPIRED", label: "Expired" },
];

export default function SwapsPage() {
  const { isManager, user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState<SwapStatus | "">("PENDING");
  const [type, setType] = useState<"SWAP" | "DROP" | "">("");
  const [managerNote, setManagerNote] = useState<Record<number, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["swaps", status, type],
    queryFn: () =>
      swapsService.list({
        status: status || undefined,
        type: type || undefined,
        limit: 50,
      }),
  });

  const swaps = data?.data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["swaps"] });

  const handleAccept = (id: number) =>
    swapsService
      .accept(id)
      .then(() => {
        invalidate();
        toast.success("Swap accepted");
      })
      .catch((e) => toast.error("Failed", parseApiError(e).message));

  const handleReject = (id: number) =>
    swapsService
      .reject(id)
      .then(() => {
        invalidate();
        toast.success("Swap rejected");
      })
      .catch((e) => toast.error("Failed", parseApiError(e).message));

  const handleApprove = (id: number) =>
    swapsService
      .approve(id, managerNote[id])
      .then(() => {
        invalidate();
        toast.success("Swap approved");
      })
      .catch((e) => toast.error("Failed", parseApiError(e).message));

  const handleCancel = (id: number) =>
    swapsService
      .cancel(id)
      .then(() => {
        invalidate();
        toast.success("Swap cancelled");
      })
      .catch((e) => toast.error("Failed", parseApiError(e).message));

  const handlePickup = (id: number) =>
    swapsService
      .pickup(id)
      .then(() => {
        invalidate();
        toast.success("Shift picked up!");
      })
      .catch((e) => toast.error("Failed", parseApiError(e).message));

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] font-display">
          Swaps & Drops
        </h1>
        <p className="text-sm text-[var(--text-secondary)] font-nunito mt-1">
          Staff swap requests and open drop listings
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status tabs */}
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold font-nunito transition-colors",
                status === tab.value
                  ? "bg-[hsl(187_100%_42%/0.15)] text-[hsl(187_100%_42%)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Select
          options={[
            { value: "", label: "All types" },
            { value: "SWAP", label: "Swaps" },
            { value: "DROP", label: "Drops" },
          ]}
          value={type}
          onChange={(e) => setType(e.target.value as "SWAP" | "DROP" | "")}
          className="w-32 h-9"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : swaps.length === 0 ? (
        <EmptyState variant="swaps" />
      ) : (
        <div className="space-y-3">
          {swaps.map((swap) => (
            <SwapCard
              key={swap.id}
              swap={swap}
              currentUserId={user?.id}
              isManager={isManager()}
              onAccept={handleAccept}
              onReject={handleReject}
              onApprove={handleApprove}
              onCancel={handleCancel}
              onPickup={handlePickup}
              managerNote={managerNote[swap.id] ?? ""}
              onNoteChange={(n) =>
                setManagerNote((prev) => ({ ...prev, [swap.id]: n }))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Swap Card ────────────────────────────────────────────────────────────────

interface SwapCardProps {
  swap: SwapRequest;
  currentUserId?: number;
  isManager: boolean;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
  onApprove: (id: number) => void;
  onCancel: (id: number) => void;
  onPickup: (id: number) => void;
  managerNote: string;
  onNoteChange: (n: string) => void;
}

function SwapCard({
  swap,
  currentUserId,
  isManager,
  onAccept,
  onReject,
  onApprove,
  onCancel,
  onPickup,
  managerNote,
  onNoteChange,
}: SwapCardProps) {
  const tz = swap.shift?.location?.timezone ?? "UTC";
  const isDrop = swap.type === "DROP";
  const isRequester = swap.requesterId === currentUserId;
  const isTarget = swap.targetId === currentUserId;

  return (
    <Card
      className={cn(
        "space-y-4",
        swap.status === "PENDING" && "border-[hsl(38_95%_52%/0.25)]",
        swap.status === "APPROVED" && "border-[hsl(155_60%_40%/0.25)]",
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-nunito",
              isDrop
                ? "bg-[hsl(210_90%_56%/0.12)] text-[hsl(210_90%_56%)] border border-[hsl(210_90%_56%/0.25)]"
                : "bg-[hsl(280_60%_56%/0.12)] text-[hsl(280_60%_56%)] border border-[hsl(280_60%_56%/0.25)]",
            )}
          >
            <ArrowLeftRight className="w-3 h-3" />
            {isDrop ? "Drop" : "Swap"}
          </div>
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-xs font-semibold font-nunito",
              swapStatusColor(swap.status),
            )}
          >
            {swap.status}
          </span>
        </div>
        <span className="text-xs text-[var(--text-muted)] font-nunito">
          {timeAgo(swap.createdAt)}
        </span>
      </div>

      {/* Shift info */}
      {swap.shift && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)]">
          <div
            className={cn(
              "w-1 self-stretch rounded-full shrink-0",
              swap.shift.isPremium
                ? "bg-[hsl(43_95%_56%)]"
                : "bg-[hsl(187_100%_42%)]",
            )}
          />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--text-primary)] font-nunito capitalize">
                {skillDisplayName(swap.shift.skill?.name ?? "")}
              </span>
              {swap.shift.isPremium && (
                <span className="text-[hsl(43_95%_56%)] text-xs flex items-center gap-0.5">
                  <Star className="w-3 h-3" fill="currentColor" /> Premium
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-[var(--text-muted)] font-nunito">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatInTz(swap.shift.startAt, tz, "EEE MMM d · h:mm a")}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {swap.shift.location?.name}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* People */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Avatar name={swap.requester?.name ?? "?"} size="sm" />
          <div>
            <p className="text-xs font-semibold text-[var(--text-primary)] font-nunito">
              {swap.requester?.name}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] font-nunito">
              Requester
            </p>
          </div>
        </div>
        {!isDrop && swap.target && (
          <>
            <ArrowLeftRight className="w-4 h-4 text-[var(--text-muted)]" />
            <div className="flex items-center gap-2">
              <Avatar name={swap.target.name ?? "?"} size="sm" />
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)] font-nunito">
                  {swap.target.name}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] font-nunito">
                  Target
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Notes */}
      {swap.requesterNote && (
        <p className="text-xs text-[var(--text-secondary)] font-nunito italic border-l-2 border-[var(--border)] pl-3">
          &ldquo;{swap.requesterNote}&rdquo;
        </p>
      )}

      {/* Expiry */}
      {swap.expiresAt && swap.status === "PENDING" && (
        <p className="text-xs text-[hsl(38_95%_52%)] font-nunito flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Expires {timeAgo(swap.expiresAt)}
        </p>
      )}

      {/* Manager note input */}
      {isManager && swap.status === "ACCEPTED" && (
        <div>
          <input
            type="text"
            placeholder="Optional manager note…"
            value={managerNote}
            onChange={(e) => onNoteChange(e.target.value)}
            className="w-full h-8 px-3 text-xs font-nunito rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[hsl(187_100%_42%)]"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        {/* Staff target can accept/reject a pending directed swap */}
        {isTarget && swap.status === "PENDING" && !isDrop && (
          <>
            <Button
              size="xs"
              variant="primary"
              icon={<Check className="w-3.5 h-3.5" />}
              onClick={() => onAccept(swap.id)}
            >
              Accept
            </Button>
            <Button
              size="xs"
              variant="danger"
              icon={<X className="w-3.5 h-3.5" />}
              onClick={() => onReject(swap.id)}
            >
              Decline
            </Button>
          </>
        )}

        {/* Any staff can pick up an open drop */}
        {isDrop && swap.status === "PENDING" && !isRequester && (
          <Button
            size="xs"
            variant="primary"
            icon={<Check className="w-3.5 h-3.5" />}
            onClick={() => onPickup(swap.id)}
          >
            Pick Up Shift
          </Button>
        )}

        {/* Manager can approve an accepted swap */}
        {isManager && swap.status === "ACCEPTED" && (
          <Button
            size="xs"
            variant="primary"
            icon={<ShieldCheck className="w-3.5 h-3.5" />}
            onClick={() => onApprove(swap.id)}
          >
            Approve
          </Button>
        )}

        {/* Requester can cancel their own pending request */}
        {isRequester && swap.status === "PENDING" && (
          <Button
            size="xs"
            variant="ghost"
            icon={<X className="w-3.5 h-3.5" />}
            onClick={() => onCancel(swap.id)}
            className="text-[hsl(0_72%_54%)] hover:bg-[hsl(0_72%_54%/0.08)]"
          >
            Cancel
          </Button>
        )}
      </div>
    </Card>
  );
}
