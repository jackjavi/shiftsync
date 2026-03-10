"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Zap,
  CheckCircle2,
  Plus,
  X,
  Calendar,
  Clock,
  BarChart2,
} from "lucide-react";
import { Button, Badge, Avatar, Card, Spinner, Select } from "@/components/ui";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  usersService,
  availabilityService,
  locationsService,
  skillsService,
} from "@/services/index";
import { parseApiError } from "@/lib/api";
import { cn, skillDisplayName, roleBadgeColor } from "@/lib/utils";
import type { AvailabilityWindow } from "@/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function StaffProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user: me, isManager } = useAuth();
  const toast = useToast();

  const userId = Number(id);
  const isOwnProfile = me?.id === userId;

  const { data: user, isLoading } = useQuery({
    queryKey: ["users", userId],
    queryFn: () => usersService.get(userId),
  });

  const { data: availability } = useQuery({
    queryKey: ["availability", userId],
    queryFn: () =>
      isOwnProfile
        ? availabilityService.me()
        : availabilityService.forUser(userId),
    enabled: !!user,
  });

  const { data: allSkills } = useQuery({
    queryKey: ["skills"],
    queryFn: skillsService.list,
  });
  const { data: allLocations } = useQuery({
    queryKey: ["locations"],
    queryFn: locationsService.list,
  });

  const [addSkillId, setAddSkillId] = useState("");
  const [addLocationId, setAddLocationId] = useState("");

  const addSkillMutation = useMutation({
    mutationFn: () => usersService.addSkill(userId, Number(addSkillId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", userId] });
      toast.success("Skill added");
      setAddSkillId("");
    },
    onError: (e) => toast.error("Failed", parseApiError(e).message),
  });

  const removeSkillMutation = useMutation({
    mutationFn: (skillId: number) => usersService.removeSkill(userId, skillId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", userId] });
      toast.success("Skill removed");
    },
    onError: (e) => toast.error("Failed", parseApiError(e).message),
  });

  const addCertMutation = useMutation({
    mutationFn: () => usersService.addCert(userId, Number(addLocationId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", userId] });
      toast.success("Certification added");
      setAddLocationId("");
    },
    onError: (e) => toast.error("Failed", parseApiError(e).message),
  });

  const removeCertMutation = useMutation({
    mutationFn: (locationId: number) =>
      usersService.removeCert(userId, locationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", userId] });
      toast.success("Certification removed");
    },
    onError: (e) => toast.error("Failed", parseApiError(e).message),
  });

  if (isLoading)
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  if (!user)
    return (
      <div className="p-6">
        <EmptyState
          variant="staff"
          title="Staff member not found"
          message="This profile may have been removed."
        />
      </div>
    );

  const canEdit = isManager() || isOwnProfile;

  const existingSkillIds = new Set(user.skills?.map((s) => s.skillId) ?? []);
  const existingCertLocationIds = new Set(
    user.certifications?.map((c) => c.locationId) ?? [],
  );
  const availableSkills = (allSkills ?? []).filter(
    (s) => !existingSkillIds.has(s.id),
  );
  const availableLocations = (allLocations ?? []).filter(
    (l) => !existingCertLocationIds.has(l.id),
  );

  // Group availability by day of week
  const recurringByDay = new Map<number, AvailabilityWindow[]>();
  (availability ?? [])
    .filter((a) => a.type === "RECURRING")
    .forEach((a) => {
      if (a.dayOfWeek !== null) {
        if (!recurringByDay.has(a.dayOfWeek))
          recurringByDay.set(a.dayOfWeek, []);
        recurringByDay.get(a.dayOfWeek)!.push(a);
      }
    });

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors font-nunito"
      >
        <ArrowLeft className="w-4 h-4" /> Back to staff
      </button>

      {/* Profile header */}
      <Card>
        <div className="flex items-start gap-4 flex-wrap">
          <Avatar name={user.name} size="lg" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-[var(--text-primary)] font-display">
                {user.name}
              </h1>
              <span
                className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-full font-nunito",
                  roleBadgeColor(user.role),
                )}
              >
                {user.role}
              </span>
              <Badge variant={user.isActive ? "success" : "default"} dot>
                {user.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-sm text-[var(--text-muted)] font-nunito">
              {user.email}
            </p>
            {user.desiredHoursPerWeek && (
              <p className="text-sm text-[var(--text-secondary)] font-nunito flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                Desired:{" "}
                <span className="font-semibold">
                  {user.desiredHoursPerWeek}h/week
                </span>
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Skills */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[hsl(187_100%_42%)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)] font-nunito">
              Skills
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {(user.skills ?? []).length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] font-nunito">
              No skills assigned.
            </p>
          ) : (
            user.skills!.map((us) => (
              <div
                key={us.skillId}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold font-nunito bg-[hsl(187_100%_42%/0.10)] text-[hsl(187_100%_42%)] border border-[hsl(187_100%_42%/0.20)]"
              >
                <Zap className="w-3 h-3" />
                {skillDisplayName(us.skill.name)}
                {canEdit && (
                  <button
                    onClick={() => removeSkillMutation.mutate(us.skillId)}
                    className="ml-1 hover:text-[hsl(0_72%_54%)] transition-colors"
                    aria-label={`Remove ${us.skill.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {canEdit && availableSkills.length > 0 && (
          <div className="flex items-center gap-2">
            <Select
              options={[
                { value: "", label: "Add skill…", disabled: true },
                ...availableSkills.map((s) => ({
                  value: s.id,
                  label: skillDisplayName(s.name),
                })),
              ]}
              value={addSkillId}
              onChange={(e) => setAddSkillId(e.target.value)}
              className="h-8 text-xs flex-1 max-w-48"
            />
            <Button
              variant="outline"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              disabled={!addSkillId}
              loading={addSkillMutation.isPending}
              onClick={() => addSkillMutation.mutate()}
            >
              Add
            </Button>
          </div>
        )}
      </Card>

      {/* Certifications */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4 text-[hsl(155_60%_40%)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)] font-nunito">
            Location Certifications
          </h2>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {(user.certifications ?? []).length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] font-nunito">
              Not certified for any location.
            </p>
          ) : (
            user.certifications!.map((cert) => (
              <div
                key={cert.locationId}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold font-nunito bg-[hsl(155_60%_40%/0.10)] text-[hsl(155_60%_40%)] border border-[hsl(155_60%_40%/0.20)]"
              >
                <CheckCircle2 className="w-3 h-3" />
                {cert.location.name}
                {canEdit && (
                  <button
                    onClick={() => removeCertMutation.mutate(cert.locationId)}
                    className="ml-1 hover:text-[hsl(0_72%_54%)] transition-colors"
                    aria-label={`Remove ${cert.location.name} cert`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {isManager() && availableLocations.length > 0 && (
          <div className="flex items-center gap-2">
            <Select
              options={[
                { value: "", label: "Add certification…", disabled: true },
                ...availableLocations.map((l) => ({
                  value: l.id,
                  label: l.name,
                })),
              ]}
              value={addLocationId}
              onChange={(e) => setAddLocationId(e.target.value)}
              className="h-8 text-xs flex-1 max-w-48"
            />
            <Button
              variant="outline"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              disabled={!addLocationId}
              loading={addCertMutation.isPending}
              onClick={() => addCertMutation.mutate()}
            >
              Certify
            </Button>
          </div>
        )}
      </Card>

      {/* Availability grid */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)] font-nunito">
            Weekly Availability
          </h2>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => {
            const windows = recurringByDay.get(day) ?? [];
            const isAvail = windows.some((w) => w.isAvailable);
            const isUnavail = windows.some((w) => !w.isAvailable);
            return (
              <div key={day} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-bold text-[var(--text-muted)] font-nunito uppercase tracking-wide">
                  {DAY_LABELS[day]}
                </span>
                <div
                  className={cn(
                    "w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold font-nunito border",
                    isAvail
                      ? "bg-[hsl(155_60%_40%/0.15)] border-[hsl(155_60%_40%/0.3)] text-[hsl(155_60%_40%)]"
                      : isUnavail
                        ? "bg-[hsl(0_72%_54%/0.10)] border-[hsl(0_72%_54%/0.2)] text-[hsl(0_72%_54%)]"
                        : "bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-muted)]",
                  )}
                >
                  {isAvail ? "✓" : isUnavail ? "✗" : "—"}
                </div>
                {windows.length > 0 && (
                  <span className="text-[9px] text-[var(--text-muted)] font-nunito text-center leading-tight">
                    {windows[0].startTime}–{windows[0].endTime}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
