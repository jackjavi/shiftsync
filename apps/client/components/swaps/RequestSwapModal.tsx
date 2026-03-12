"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Trash2, Search, Clock, MapPin } from "lucide-react";
import { Modal, Button, Select, Spinner } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { swapsService } from "@/services/index";
import { shiftsService } from "@/services/shifts.service";
import { usersService } from "@/services/index";
import { parseApiError } from "@/lib/api";
import { formatInTz, formatShiftDuration } from "@/lib/utils";
import type { Shift } from "@/types";

interface RequestSwapModalProps {
  open: boolean;
  onClose: () => void;
}

export function RequestSwapModal({ open, onClose }: RequestSwapModalProps) {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const [type, setType] = useState<"SWAP" | "DROP">("DROP");
  const [shiftId, setShiftId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [note, setNote] = useState("");

  // Fetch my upcoming assigned shifts
  const { data: myShiftsData, isLoading: loadingShifts } = useQuery({
    queryKey: ["my-shifts"],
    queryFn: () => shiftsService.myShifts({ limit: 50 }),
    enabled: open,
  });

  const myShifts = myShiftsData?.data ?? [];

  // Only show future shifts
  const upcomingShifts = myShifts.filter(
    (s) => new Date(s.startAt) > new Date(),
  );

  const selectedShift: Shift | undefined = upcomingShifts.find(
    (s) => String(s.id) === shiftId,
  );

  // When swap selected, fetch the shift detail which includes all assignments
  // This avoids calling GET /users (requires ADMIN/MANAGER) as a STAFF user.
  // Co-workers are derived from the shift's assignments filtered by same skill.
  const { data: shiftDetail, isLoading: loadingCandidates } = useQuery({
    queryKey: ["shift-detail", selectedShift?.id],
    queryFn: () => shiftsService.get(selectedShift!.id),
    enabled: type === "SWAP" && !!selectedShift,
  });

  // Candidates = staff assigned to any shift at same location with same skill, excluding self
  const { data: locationShifts } = useQuery({
    queryKey: [
      "location-shifts-for-swap",
      selectedShift?.locationId,
      selectedShift?.skillId,
    ],
    queryFn: () =>
      shiftsService.list({
        locationId: selectedShift!.locationId,
        skillId: selectedShift!.skillId,
        isPublished: true,
        limit: 200,
      }),
    enabled: type === "SWAP" && !!selectedShift,
  });

  const candidates = useMemo(() => {
    if (!locationShifts?.data || !user) return [];
    const seen = new Set<number>();
    const result: { id: number; name: string }[] = [];
    for (const shift of locationShifts.data) {
      for (const a of shift.assignments ?? []) {
        if (
          a.status === "ASSIGNED" &&
          a.userId !== user.id &&
          !seen.has(a.userId) &&
          a.user
        ) {
          seen.add(a.userId);
          result.push({ id: a.userId, name: a.user.name });
        }
      }
    }
    return result;
  }, [locationShifts, user]);

  const mutation = useMutation({
    mutationFn: () =>
      swapsService.create({
        shiftId: Number(shiftId),
        type,
        targetId: type === "SWAP" && targetId ? Number(targetId) : undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["swaps"] });
      toast.success(
        type === "DROP" ? "Drop request submitted" : "Swap request sent",
        type === "DROP"
          ? "Managers will be notified. The shift is now available for pickup."
          : "The other staff member will be notified to accept or decline.",
      );
      handleClose();
    },
    onError: (e) => toast.error("Request failed", parseApiError(e).message),
  });

  const handleClose = () => {
    setType("DROP");
    setShiftId("");
    setTargetId("");
    setNote("");
    onClose();
  };

  const canSubmit = !!shiftId && (type === "DROP" || !!targetId);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Request Swap or Drop"
      size="md"
    >
      <div className="space-y-5">
        {/* Type selector */}
        <div className="grid grid-cols-2 gap-3">
          {(["DROP", "SWAP"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setType(t);
                setTargetId("");
              }}
              className={[
                "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-left",
                type === t
                  ? "border-[hsl(187_100%_42%)] bg-[hsl(187_100%_42%/0.08)]"
                  : "border-[var(--border)] hover:border-[var(--border-hover)] bg-[var(--surface-elevated)]",
              ].join(" ")}
            >
              {t === "DROP" ? (
                <Trash2
                  className={`w-5 h-5 ${type === t ? "text-[hsl(187_100%_42%)]" : "text-[var(--text-muted)]"}`}
                />
              ) : (
                <ArrowLeftRight
                  className={`w-5 h-5 ${type === t ? "text-[hsl(187_100%_42%)]" : "text-[var(--text-muted)]"}`}
                />
              )}
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)] font-nunito">
                  {t === "DROP" ? "Drop Shift" : "Swap Shift"}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] font-nunito mt-0.5">
                  {t === "DROP"
                    ? "Make available for any qualified staff to pick up"
                    : "Request a direct swap with another staff member"}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Shift selector */}
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] font-nunito mb-1.5">
            Which of your shifts?
          </label>
          {loadingShifts ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--surface-elevated)]">
              <Spinner size="sm" />{" "}
              <span className="text-sm text-[var(--text-muted)] font-nunito">
                Loading your shifts…
              </span>
            </div>
          ) : upcomingShifts.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] font-nunito p-3 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)]">
              You have no upcoming assigned shifts.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {upcomingShifts.map((shift) => (
                <button
                  key={shift.id}
                  onClick={() => setShiftId(String(shift.id))}
                  className={[
                    "w-full text-left p-3 rounded-xl border transition-all",
                    String(shift.id) === shiftId
                      ? "border-[hsl(187_100%_42%)] bg-[hsl(187_100%_42%/0.08)]"
                      : "border-[var(--border)] hover:border-[var(--border-hover)] bg-[var(--surface-elevated)]",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)] font-nunito capitalize">
                      {shift.skill?.name?.replace("_", " ")}
                      {shift.isPremium && (
                        <span className="ml-1 text-[hsl(43_95%_56%)]">★</span>
                      )}
                    </span>
                    <span className="text-xs font-semibold text-[var(--text-muted)] font-nunito">
                      {formatShiftDuration(shift.startAt, shift.endAt)}h
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-[var(--text-muted)] font-nunito">
                      <Clock className="w-3 h-3" />
                      {formatInTz(
                        shift.startAt,
                        shift.location?.timezone ?? "UTC",
                        "EEE MMM d, h:mm a",
                      )}
                    </span>
                    {shift.location && (
                      <span className="flex items-center gap-1 text-xs text-[var(--text-muted)] font-nunito">
                        <MapPin className="w-3 h-3" />
                        {shift.location.name}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Swap target */}
        {type === "SWAP" && selectedShift && (
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] font-nunito mb-1.5">
              Swap with which staff member?
            </label>
            {loadingCandidates ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--surface-elevated)]">
                <Spinner size="sm" />{" "}
                <span className="text-sm text-[var(--text-muted)] font-nunito">
                  Finding eligible staff…
                </span>
              </div>
            ) : (
              <Select
                options={[
                  { value: "", label: "Select staff member…", disabled: true },
                  ...(candidates ?? []).map((u) => ({
                    value: u.id,
                    label: u.name,
                  })),
                ]}
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
              />
            )}
            {candidates?.length === 0 && (
              <p className="text-xs text-[hsl(43_95%_56%)] font-nunito mt-1.5">
                No other staff share this skill at this location. Consider a
                drop request instead.
              </p>
            )}
          </div>
        )}

        {/* Note */}
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] font-nunito mb-1.5">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              type === "DROP"
                ? "Reason for dropping…"
                : "Message for the other staff member…"
            }
            rows={2}
            className="w-full px-3 py-2 text-sm font-nunito rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[hsl(187_100%_42%/0.4)] resize-none transition-colors"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            loading={mutation.isPending}
            icon={
              type === "DROP" ? (
                <Trash2 className="w-4 h-4" />
              ) : (
                <ArrowLeftRight className="w-4 h-4" />
              )
            }
            onClick={() => mutation.mutate()}
          >
            {type === "DROP" ? "Drop Shift" : "Request Swap"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
