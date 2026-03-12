"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Resolver } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Button, Input, Select } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { usersService } from "@/services/index";
import { parseApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["STAFF", "MANAGER", "ADMIN"]),
  desiredHoursPerWeek: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(1).max(60).optional(),
  ),
});
type FormData = z.infer<typeof schema>;

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateUserModal({ open, onClose }: CreateUserModalProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const { isAdmin } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { role: "STAFF" },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => usersService.create(data),
    onSuccess: (createdUser) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(
        "Staff created",
        `${(createdUser as { name: string }).name} has been added to the system.`,
      );
      reset();
      onClose();
    },
    onError: (e) => toast.error("Create failed", parseApiError(e).message),
  });

  return (
    <Modal open={open} onClose={onClose} title="Create Staff Member" size="md">
      <form
        onSubmit={handleSubmit((d) => mutation.mutate(d as FormData))}
        className="space-y-4"
        noValidate
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Full name"
            placeholder="Jane Smith"
            error={errors.name?.message}
            {...register("name")}
          />
          <Input
            label="Email address"
            type="email"
            placeholder="jane@example.com"
            error={errors.email?.message}
            {...register("email")}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Password"
            type="password"
            placeholder="Min. 8 characters"
            error={errors.password?.message}
            hint="Staff can change this later in Settings"
            {...register("password")}
          />
          <Select
            label="Role"
            options={[
              { value: "STAFF", label: "Staff" },
              { value: "MANAGER", label: "Manager", disabled: !isAdmin() },
              { value: "ADMIN", label: "Admin", disabled: !isAdmin() },
            ]}
            error={errors.role?.message}
            {...register("role")}
          />
        </div>

        <Input
          label="Desired hours / week (optional)"
          type="number"
          min={1}
          max={60}
          placeholder="e.g. 32"
          hint="Used by the fairness scheduling engine"
          {...register("desiredHoursPerWeek")}
        />

        <p className="text-xs text-[var(--text-muted)] font-nunito bg-[var(--surface-elevated)] rounded-lg p-3 border border-[var(--border)]">
          After creating the account, go to the staff profile to assign{" "}
          <strong>skills</strong> and
          <strong> location certifications</strong>.
        </p>

        <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={isSubmitting}>
            Create Staff Member
          </Button>
        </div>
      </form>
    </Modal>
  );
}
