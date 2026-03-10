import { AvailabilityType } from '@prisma/client';
import { z } from 'zod';

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createAvailabilitySchema = z
  .object({
    type: z.nativeEnum(AvailabilityType),
    dayOfWeek: z.number().int().min(0).max(6).optional(), // required for RECURRING
    date: z.string().optional(), // ISO date string, required for ONE_OFF
    startTime: z.string().regex(timePattern, 'Must be HH:MM format'),
    endTime: z.string().regex(timePattern, 'Must be HH:MM format'),
    isAvailable: z.boolean().default(true),
    note: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === AvailabilityType.RECURRING) return data.dayOfWeek !== undefined;
      if (data.type === AvailabilityType.ONE_OFF) return data.date !== undefined;
      return true;
    },
    {
      message: 'RECURRING requires dayOfWeek; ONE_OFF requires date',
    },
  );

export const updateAvailabilitySchema = z.object({
  startTime: z.string().regex(timePattern).optional(),
  endTime: z.string().regex(timePattern).optional(),
  isAvailable: z.boolean().optional(),
  note: z.string().optional(),
});

export type CreateAvailabilityDto = z.infer<typeof createAvailabilitySchema>;
export type UpdateAvailabilityDto = z.infer<typeof updateAvailabilitySchema>;
