"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Button, Input, Select } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { shiftsService } from "@/services/shifts.service";
import { locationsService, skillsService } from "@/services/index";
import { parseApiError } from "@/lib/api";
import type { Shift } from "@/types";

const schema = z.object({
  locationId: z.coerce.number().min(1, "Select a location"),
  skillId: z.coerce.number().min(1, "Select a skill"),
  startAt: z.string().min(1, "Start time is required"),
  endAt: z.string().min(1, "End time is required"),
  headcount: z.coerce.number().min(1).max(20),
  notes: z.string().optional(),
  editCutoffHours: z.coerce.number().min(0).max(168).optional(),
});
type FormData = z.infer<typeof schema>;

interface ShiftFormModalProps {
  open: boolean;
  onClose: () => void;
  shift?: Shift; // if provided → edit mode
}

export function ShiftFormModal({ open, onClose, shift }: ShiftFormModalProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const isEdit = !!shift;

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: locationsService.list,
  });
  const { data: skills } = useQuery({
    queryKey: ["skills"],
    queryFn: skillsService.list,
  });

  const toLocalDatetime = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: shift
      ? {
          locationId: shift.locationId,
          skillId: shift.skillId,
          startAt: toLocalDatetime(shift.startAt),
          endAt: toLocalDatetime(shift.endAt),
          headcount: shift.headcount,
          notes: shift.notes ?? "",
          editCutoffHours: shift.editCutoffHours,
        }
      : { headcount: 1, editCutoffHours: 48 },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        ...data,
        startAt: new Date(data.startAt).toISOString(),
        endAt: new Date(data.endAt).toISOString(),
      };
      return isEdit
        ? shiftsService.update(shift!.id, payload)
        : shiftsService.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["schedule"] });
      toast.success(
        isEdit ? "Shift updated" : "Shift created",
        isEdit ? "Changes saved." : "New shift added to schedule.",
      );
      onClose();
    },
    onError: (err) => {
      toast.error(
        isEdit ? "Update failed" : "Create failed",
        parseApiError(err).message,
      );
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Shift" : "Create Shift"}
      size="md"
    >
      <form
        onSubmit={handleSubmit((d: FormData) => mutation.mutate(d))}
        className="space-y-4"
        noValidate
      >
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Location"
            options={[
              { value: "", label: "Select location…", disabled: true },
              ...(locations ?? []).map((l) => ({ value: l.id, label: l.name })),
            ]}
            error={errors.locationId?.message}
            {...register("locationId")}
          />
          <Select
            label="Required skill"
            options={[
              { value: "", label: "Select skill…", disabled: true },
              ...(skills ?? []).map((s) => ({
                value: s.id,
                label: s.name.replace("_", " "),
              })),
            ]}
            error={errors.skillId?.message}
            {...register("skillId")}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start time"
            type="datetime-local"
            error={errors.startAt?.message}
            {...register("startAt")}
          />
          <Input
            label="End time"
            type="datetime-local"
            error={errors.endAt?.message}
            {...register("endAt")}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Headcount"
            type="number"
            min={1}
            max={20}
            error={errors.headcount?.message}
            {...register("headcount")}
          />
          <Input
            label="Edit cutoff (hours)"
            type="number"
            min={0}
            hint="Hours before shift when editing is locked"
            {...register("editCutoffHours")}
          />
        </div>
        <Input
          label="Notes (optional)"
          placeholder="Any details for this shift…"
          {...register("notes")}
        />

        <div className="flex justify-end gap-3 pt-2 border-t border-(--border)">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={isSubmitting}>
            {isEdit ? "Save Changes" : "Create Shift"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
