import { UserRole } from '@prisma/client';
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1),
  role: z.nativeEnum(UserRole).default(UserRole.STAFF),
  desiredHoursPerWeek: z.number().int().min(0).max(168).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  desiredHoursPerWeek: z.number().int().min(0).max(168).optional(),
  isActive: z.boolean().optional(),
  emailNotificationsEnabled: z.boolean().optional(),
});

export const addSkillSchema = z.object({
  skillId: z.number().int().positive(),
});

export const addCertificationSchema = z.object({
  locationId: z.number().int().positive(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type AddSkillDto = z.infer<typeof addSkillSchema>;
export type AddCertificationDto = z.infer<typeof addCertificationSchema>;

