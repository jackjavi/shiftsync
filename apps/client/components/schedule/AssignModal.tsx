"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus, Zap, Star } from "lucide-react";
import {
  cn,
  formatTimeTz,
  formatDateTz,
  formatShiftDuration,
  skillDisplayName,
} from "@/lib/utils";
import { Modal, Button, Input, Avatar, Badge, Spinner } from "@/components/ui";
import { WhatIfPanel } from "./WhatIfPanel";
import { ConstraintViolationPanel } from "@/components/feedback/ConstraintViolation";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { useToast } from "@/context/ToastContext";
import { schedulingService } from "@/services/scheduling.service";
import { usersService } from "@/services/index";
import type { Shift, User, ValidationResult, WhatIfResult } from "@/types";
import { parseApiError } from "@/lib/api";

interface AssignModalProps {
  shift: Shift;
  open: boolean;
  onClose: () => void;
}

export function AssignModal({ shift, open, onClose }: AssignModalProps) {
  const qc = useQueryClient();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [whatIf, setWhatIf] = useState<WhatIfResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [forceOverride, setForceOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  // Fetch all staff
  const { data: staffData, isLoading: loadingStaff } = useQuery({
    queryKey: ["users", "staff"],
    queryFn: () => usersService.list({ role: "STAFF", limit: 100 }),
    enabled: open,
  });

  // Fetch suggestions for this shift
  const { data: suggestions } = useQuery({
    queryKey: ["suggestions", shift.id],
    queryFn: () => schedulingService.suggestions(shift.id),
    enabled: open,
  });

  const staff = staffData?.data ?? [];
  const filtered = staff.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  // Validate when user selected
  const handleSelectUser = async (user: User) => {
    setSelectedUser(user);
    setValidation(null);
    setWhatIf(null);
    setForceOverride(false);
    setValidating(true);
    try {
      const [val, wi] = await Promise.all([
        schedulingService.validate(user.id, shift.id),
        schedulingService.whatIf(user.id, shift.id),
      ]);
      setValidation(val);
      setWhatIf(wi);
    } catch {
      toast.error("Validation failed", "Could not check constraints");
    } finally {
      setValidating(false);
    }
  };

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: () =>
      schedulingService.assign(
        selectedUser!.id,
        shift.id,
        forceOverride,
        forceOverride ? overrideReason : undefined,
      ),
    onSuccess: ({ warnings }) => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["schedule"] });
      if (warnings.length > 0) {
        toast.warning("Assigned with warnings", warnings[0].message);
      } else {
        toast.success(
          "Staff assigned",
          `${selectedUser!.name} added to shift.`,
        );
      }
      onClose();
    },
    onError: (err) => {
      const apiErr = parseApiError(err);
      if (apiErr.violations?.length) {
        toast.constraint(apiErr.violations);
      } else {
        toast.error("Assignment failed", apiErr.message);
      }
    },
  });

  const canAssign =
    validation?.isValid ||
    (forceOverride &&
      validation?.violations.every(
        (v) =>
          v.rule === "WEEKLY_HOURS_EXCEEDED" || v.rule === "CONSECUTIVE_DAYS",
      ));

  const requiresOverride =
    validation?.violations.some(
      (v) =>
        v.rule === "WEEKLY_HOURS_EXCEEDED" || v.rule === "CONSECUTIVE_DAYS",
    ) &&
    validation?.violations.every(
      (v) =>
        v.rule === "WEEKLY_HOURS_EXCEEDED" || v.rule === "CONSECUTIVE_DAYS",
    );

  const handleClose = () => {
    setSelectedUser(null);
    setValidation(null);
    setWhatIf(null);
    setSearch("");
    setForceOverride(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Assign Staff to Shift"
      size="lg"
    >
      <div className="space-y-5">
        {/* Shift summary */}
        <div className="flex items-start gap-4 p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)]">
          <div
            className={cn(
              "w-1 self-stretch rounded-full shrink-0",
              shift.isPremium
                ? "bg-[hsl(43_95%_56%)]"
                : "bg-[hsl(187_100%_42%)]",
            )}
          />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-[var(--text-primary)] font-nunito capitalize">
                {skillDisplayName(shift.skill?.name ?? "")}
              </span>
              {shift.isPremium && (
                <Badge variant="premium" dot>
                  <Star className="w-2.5 h-2.5" fill="currentColor" /> Premium
                </Badge>
              )}
              <Badge variant={shift.isPublished ? "success" : "warning"} dot>
                {shift.isPublished ? "Published" : "Unpublished"}
              </Badge>
            </div>
            <p className="text-sm text-[var(--text-secondary)] font-nunito">
              {shift.location?.name}
            </p>
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] font-nunito flex-wrap">
              <span>
                {formatDateTz(shift.startAt, shift.location?.timezone ?? "UTC")}
              </span>
              <span>·</span>
              <span>
                {formatTimeTz(shift.startAt, shift.location?.timezone ?? "UTC")}{" "}
                – {formatTimeTz(shift.endAt, shift.location?.timezone ?? "UTC")}
              </span>
              <span>·</span>
              <span>{formatShiftDuration(shift.startAt, shift.endAt)}</span>
              <span>·</span>
              <span>
                {shift.assignments?.filter((a) => a.status === "ASSIGNED")
                  .length ?? 0}
                /{shift.headcount} filled
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left — staff picker */}
          <div className="space-y-3">
            {/* Suggestions strip */}
            {suggestions && suggestions.length > 0 && !selectedUser && (
              <div className="p-3 rounded-xl bg-[hsl(187_100%_42%/0.06)] border border-[hsl(187_100%_42%/0.15)]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="w-3.5 h-3.5 text-[hsl(187_100%_42%)]" />
                  <span className="text-xs font-bold text-[hsl(187_100%_42%)] font-nunito uppercase tracking-wide">
                    Suggested
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.slice(0, 4).map((s) => {
                    const u = staff.find((x) => x.id === s.userId);
                    if (!u) return null;
                    return (
                      <button
                        key={s.userId}
                        onClick={() => handleSelectUser(u)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold font-nunito bg-[hsl(187_100%_42%/0.12)] text-[hsl(187_100%_42%)] border border-[hsl(187_100%_42%/0.20)] hover:bg-[hsl(187_100%_42%/0.20)] transition-colors"
                      >
                        <Avatar name={u.name} size="xs" />
                        {u.name.split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Input
              placeholder="Search staff…"
              leftIcon={<Search className="w-4 h-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {loadingStaff ? (
                <div className="flex justify-center py-6">
                  <Spinner size="sm" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] font-nunito py-4 text-center">
                  No staff found
                </p>
              ) : (
                filtered.map((u) => {
                  const isSuggested = suggestions?.some(
                    (s) => s.userId === u.id,
                  );
                  return (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left",
                        "transition-all duration-150",
                        selectedUser?.id === u.id
                          ? "bg-[hsl(187_100%_42%/0.12)] border border-[hsl(187_100%_42%/0.25)]"
                          : "hover:bg-[var(--surface-elevated)] border border-transparent",
                      )}
                    >
                      <Avatar name={u.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-[var(--text-primary)] font-nunito truncate">
                            {u.name}
                          </span>
                          {isSuggested && (
                            <Zap className="w-3 h-3 text-[hsl(187_100%_42%)] shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] font-nunito truncate">
                          {u.email}
                        </p>
                      </div>
                      {validating && selectedUser?.id === u.id && (
                        <Spinner size="sm" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right — validation panel */}
          <div className="space-y-3">
            {!selectedUser && (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] rounded-xl border border-dashed border-[var(--border)]">
                <UserPlus className="w-8 h-8 text-[var(--text-muted)] mb-2" />
                <p className="text-sm text-[var(--text-muted)] font-nunito">
                  Select a staff member to validate
                </p>
              </div>
            )}

            {selectedUser && validating && (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px]">
                <Spinner size="md" />
                <p className="mt-3 text-sm text-[var(--text-muted)] font-nunito">
                  Checking constraints…
                </p>
              </div>
            )}

            {selectedUser && !validating && whatIf && (
              <WhatIfPanel
                data={whatIf}
                userName={selectedUser.name.split(" ")[0]}
              />
            )}

            {selectedUser && !validating && validation && (
              <>
                {validation.isValid && validation.warnings.length === 0 && (
                  <AlertBanner
                    variant="success"
                    title="All clear"
                    message={`${selectedUser.name} can be assigned to this shift with no issues.`}
                    dismissible={false}
                  />
                )}
                {(validation.violations.length > 0 ||
                  validation.warnings.length > 0) && (
                  <ConstraintViolationPanel
                    violations={validation.violations}
                    warnings={validation.warnings}
                    suggestions={validation.suggestions}
                    requiresOverride={!!requiresOverride}
                    onForceOverride={() => setForceOverride(true)}
                  />
                )}
                {forceOverride && (
                  <Input
                    label="Override reason (required)"
                    placeholder="e.g. Emergency coverage approved by district manager"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => assignMutation.mutate()}
            loading={assignMutation.isPending}
            disabled={
              !selectedUser ||
              validating ||
              !canAssign ||
              (forceOverride && !overrideReason.trim())
            }
            icon={<UserPlus className="w-4 h-4" />}
          >
            {forceOverride ? "Force Assign" : "Assign"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
