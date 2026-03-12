"use client";

import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Mail, BellOff, User, Clock, Save, Shield } from "lucide-react";
import { Card, Button, Input, Badge } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { usersService } from "@/services/index";
import { parseApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const [name, setName] = useState(user?.name ?? "");
  const [desiredHours, setDesiredHours] = useState(
    String(user?.desiredHoursPerWeek ?? ""),
  );
  const [emailNotif, setEmailNotif] = useState(
    user?.emailNotificationsEnabled ?? false,
  );

  // Sync when user loads
  useEffect(() => {
    if (user) {
      setName(user.name);
      setDesiredHours(String(user.desiredHoursPerWeek ?? ""));
      setEmailNotif(user.emailNotificationsEnabled ?? false);
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: (data: {
      name?: string;
      desiredHoursPerWeek?: number | null;
      emailNotificationsEnabled?: boolean;
    }) => usersService.updateMe(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      if (refreshUser) refreshUser();
      toast.success("Settings saved", "Your preferences have been updated.");
    },
    onError: (e) => toast.error("Save failed", parseApiError(e).message),
  });

  const handleSaveProfile = () => {
    updateMutation.mutate({
      name: name.trim() || undefined,
      desiredHoursPerWeek: desiredHours ? Number(desiredHours) : null,
    });
  };

  const handleToggleEmail = () => {
    const next = !emailNotif;
    setEmailNotif(next);
    updateMutation.mutate({ emailNotificationsEnabled: next });
  };

  if (!user) return null;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] font-display">
          Settings
        </h1>
        <p className="text-sm text-[var(--text-muted)] font-nunito mt-1">
          Manage your profile and preferences
        </p>
      </div>

      {/* Profile */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <User className="w-4 h-4 text-[hsl(187_100%_42%)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)] font-nunito">
            Profile
          </h2>
          <Badge variant="default" className="ml-auto text-xs">
            {user.role}
          </Badge>
        </div>

        <div className="space-y-4">
          <Input
            label="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Email address"
            value={user.email}
            disabled
            hint="Contact your admin to change your email"
          />
          <Input
            label="Desired hours per week"
            type="number"
            min={0}
            max={60}
            value={desiredHours}
            onChange={(e) => setDesiredHours(e.target.value)}
            hint="Used by managers to distribute shifts fairly"
          />
        </div>

        <div className="flex justify-end mt-5 pt-4 border-t border-[var(--border)]">
          <Button
            variant="primary"
            icon={<Save className="w-4 h-4" />}
            loading={updateMutation.isPending}
            onClick={handleSaveProfile}
          >
            Save profile
          </Button>
        </div>
      </Card>

      {/* Notification preferences */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <Bell className="w-4 h-4 text-[hsl(187_100%_42%)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)] font-nunito">
            Notifications
          </h2>
        </div>

        <div className="space-y-3">
          {/* In-app — always on */}
          <div
            className={cn(
              "flex items-center justify-between p-4 rounded-xl border",
              "border-[hsl(155_60%_40%/0.3)] bg-[hsl(155_60%_40%/0.06)]",
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[hsl(155_60%_40%/0.15)] flex items-center justify-center">
                <Bell className="w-4 h-4 text-[hsl(155_60%_40%)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)] font-nunito">
                  In-app notifications
                </p>
                <p className="text-xs text-[var(--text-muted)] font-nunito">
                  Alerts in the notification centre
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-[hsl(155_60%_40%)] bg-[hsl(155_60%_40%/0.15)] px-2.5 py-1 rounded-full font-nunito">
              Always on
            </span>
          </div>

          {/* Email — toggleable */}
          <button
            onClick={handleToggleEmail}
            disabled={updateMutation.isPending}
            className={cn(
              "w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left",
              emailNotif
                ? "border-[hsl(187_100%_42%/0.3)] bg-[hsl(187_100%_42%/0.06)]"
                : "border-[var(--border)] bg-[var(--surface-elevated)] opacity-70",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                  emailNotif
                    ? "bg-[hsl(187_100%_42%/0.15)]"
                    : "bg-[var(--surface)]",
                )}
              >
                {emailNotif ? (
                  <Mail className="w-4 h-4 text-[hsl(187_100%_42%)]" />
                ) : (
                  <BellOff className="w-4 h-4 text-[var(--text-muted)]" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)] font-nunito">
                  Email notifications
                </p>
                <p className="text-xs text-[var(--text-muted)] font-nunito">
                  {emailNotif
                    ? `Sending to ${user.email}`
                    : "Click to enable email alerts"}
                </p>
              </div>
            </div>
            {/* Toggle pill */}
            <div
              className={cn(
                "w-11 h-6 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0",
                emailNotif ? "bg-[hsl(187_100%_42%)]" : "bg-[var(--border)]",
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full bg-white shadow transition-transform",
                  emailNotif ? "translate-x-5" : "translate-x-0",
                )}
              />
            </div>
          </button>
        </div>

        <p className="text-xs text-[var(--text-muted)] font-nunito mt-4 leading-relaxed">
          Email notifications are sent for: new shift assignments, schedule
          published, swap request updates, and overtime warnings. In-app
          notifications always show everything regardless of this setting.
        </p>
      </Card>

      {/* Security */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-[hsl(187_100%_42%)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)] font-nunito">
            Security
          </h2>
        </div>
        <p className="text-sm text-[var(--text-muted)] font-nunito">
          Account:{" "}
          <span className="font-semibold text-[var(--text-secondary)]">
            {user.email}
          </span>
        </p>
        <p className="text-xs text-[var(--text-muted)] font-nunito mt-2">
          To change your password, contact your system administrator.
        </p>
      </Card>
    </div>
  );
}
