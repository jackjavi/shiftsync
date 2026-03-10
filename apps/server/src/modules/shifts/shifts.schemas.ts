import { z } from 'zod';

export const createShiftSchema = z
  .object({
    locationId: z.number().int().positive(),
    skillId: z.number().int().positive(),
    startAt: z.string().datetime({ message: 'startAt must be a valid ISO datetime' }),
    endAt: z.string().datetime({ message: 'endAt must be a valid ISO datetime' }),
    headcount: z.number().int().positive().default(1),
    notes: z.string().optional(),
    editCutoffHours: z.number().int().min(0).max(168).default(48),
  })
  .refine((d) => new Date(d.endAt) > new Date(d.startAt), {
    message: 'endAt must be after startAt',
    path: ['endAt'],
  });

export const updateShiftSchema = z.object({
  skillId: z.number().int().positive().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  headcount: z.number().int().positive().optional(),
  notes: z.string().optional(),
  editCutoffHours: z.number().int().min(0).max(168).optional(),
});

export const shiftFilterSchema = z.object({
  locationId: z.coerce.number().int().positive().optional(),
  skillId: z.coerce.number().int().positive().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  isPublished: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type CreateShiftDto = z.infer<typeof createShiftSchema>;
export type UpdateShiftDto = z.infer<typeof updateShiftSchema>;
export type ShiftFilterDto = z.infer<typeof shiftFilterSchema>;
