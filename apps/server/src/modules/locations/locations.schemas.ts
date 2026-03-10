import { z } from 'zod';

// Valid IANA timezone strings (partial list of common ones)
const IANA_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
] as const;

export const createLocationSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  timezone: z.string().min(1), // IANA timezone
});

export const updateLocationSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const assignManagerSchema = z.object({
  userId: z.number().int().positive(),
});

export type CreateLocationDto = z.infer<typeof createLocationSchema>;
export type UpdateLocationDto = z.infer<typeof updateLocationSchema>;
export type AssignManagerDto = z.infer<typeof assignManagerSchema>;
