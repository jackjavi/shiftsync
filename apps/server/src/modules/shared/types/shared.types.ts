import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: number;       // userId
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: UserRole;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface ValidationResult {
  isValid: boolean;
  violations: ConstraintViolation[];
  warnings: ConstraintWarning[];
  suggestions?: StaffSuggestion[];
}

export interface ConstraintViolation {
  rule: ConstraintRule;
  message: string;
  details?: Record<string, any>;
}

export interface ConstraintWarning {
  rule: ConstraintRule;
  message: string;
  details?: Record<string, any>;
}

export interface StaffSuggestion {
  userId: number;
  userName: string;
  reason: string;
}

export enum ConstraintRule {
  DOUBLE_BOOKING        = 'DOUBLE_BOOKING',
  REST_PERIOD           = 'REST_PERIOD',
  SKILL_MISMATCH        = 'SKILL_MISMATCH',
  CERTIFICATION_MISSING = 'CERTIFICATION_MISSING',
  UNAVAILABLE           = 'UNAVAILABLE',
  DAILY_HOURS_EXCEEDED  = 'DAILY_HOURS_EXCEEDED',
  WEEKLY_HOURS_EXCEEDED = 'WEEKLY_HOURS_EXCEEDED',
  CONSECUTIVE_DAYS      = 'CONSECUTIVE_DAYS',
  SHIFT_NOT_PUBLISHED   = 'SHIFT_NOT_PUBLISHED',
  EDIT_CUTOFF_PASSED    = 'EDIT_CUTOFF_PASSED',
  HEADCOUNT_FULL        = 'HEADCOUNT_FULL',
}

export interface DomainEvent {
  type: string;
  payload: Record<string, any>;
  actorId: number;
  timestamp: Date;
}
