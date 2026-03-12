// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = "ADMIN" | "MANAGER" | "STAFF";
export type AvailabilityType = "RECURRING" | "ONE_OFF";
export type AssignmentStatus = "ASSIGNED" | "DROPPED" | "SWAPPED";
export type SwapType = "SWAP" | "DROP";
export type SwapStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED"
  | "APPROVED";
export type NotificationType =
  | "SHIFT_ASSIGNED"
  | "SHIFT_CHANGED"
  | "SHIFT_UNASSIGNED"
  | "SWAP_REQUESTED"
  | "SWAP_ACCEPTED"
  | "SWAP_REJECTED"
  | "SWAP_CANCELLED"
  | "SWAP_APPROVED"
  | "SWAP_EXPIRED"
  | "DROP_AVAILABLE"
  | "DROP_EXPIRING"
  | "SCHEDULE_PUBLISHED"
  | "SCHEDULE_UNPUBLISHED"
  | "OVERTIME_WARNING"
  | "CONSECUTIVE_DAY_WARNING"
  | "AVAILABILITY_CHANGED";

export type OvertimeOverrideReason =
  | "EMERGENCY_COVERAGE"
  | "BUSINESS_NECESSITY"
  | "STAFF_REQUEST"
  | "OTHER";

export type ConstraintRule =
  | "SKILL_MISMATCH"
  | "CERTIFICATION_MISSING"
  | "DOUBLE_BOOKING"
  | "HEADCOUNT_FULL"
  | "REST_PERIOD"
  | "UNAVAILABLE"
  | "DAILY_HOURS_EXCEEDED"
  | "WEEKLY_HOURS_EXCEEDED"
  | "CONSECUTIVE_DAYS";

// ─── Core Models ──────────────────────────────────────────────────────────────

export interface Skill {
  id: number;
  name: string;
}

export interface Location {
  id: number;
  name: string;
  address: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserSkill {
  userId: number;
  skillId: number;
  skill: Skill;
}

export interface StaffCertification {
  userId: number;
  locationId: number;
  certifiedAt: string;
  revokedAt: string | null;
  location: Location;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  desiredHoursPerWeek: number | null;
  emailNotificationsEnabled?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  skills?: UserSkill[];
  certifications?: StaffCertification[];
}

export interface AvailabilityWindow {
  id: number;
  userId: number;
  type: AvailabilityType;
  dayOfWeek: number | null;
  date: string | null;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftAssignment {
  id: number;
  shiftId: number;
  userId: number;
  status: AssignmentStatus;
  assignedBy: number | null;
  createdAt: string;
  updatedAt: string;
  user?: User;
}

export interface Shift {
  id: number;
  locationId: number;
  skillId: number;
  startAt: string;
  endAt: string;
  headcount: number;
  isPublished: boolean;
  isPremium: boolean;
  publishedAt: string | null;
  editCutoffHours: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  location?: Location;
  skill?: Skill;
  assignments?: ShiftAssignment[];
}

export interface SwapRequest {
  id: number;
  shiftId: number;
  requesterId: number;
  targetId: number | null;
  type: SwapType;
  status: SwapStatus;
  requesterNote: string | null;
  managerNote: string | null;
  expiresAt: string | null;
  resolvedAt: string | null;
  resolvedBy: number | null;
  createdAt: string;
  updatedAt: string;
  shift?: Shift;
  requester?: Pick<User, "id" | "name" | "email">;
  target?: Pick<User, "id" | "name" | "email"> | null;
}

export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  actorId: number;
  entityType: string;
  entityId: number;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actor?: Pick<User, "id" | "name" | "email">;
}

export interface OvertimeOverride {
  id: number;
  userId: number;
  weekStart: string;
  authorizedBy: number;
  reason: OvertimeOverrideReason;
  notes: string | null;
  createdAt: string;
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

// ─── Scheduling / Constraint Engine ──────────────────────────────────────────

export interface ConstraintViolation {
  rule: ConstraintRule;
  message: string;
  details?: Record<string, unknown>;
}

export interface ConstraintWarning {
  rule: ConstraintRule;
  message: string;
  details?: Record<string, unknown>;
}

export interface StaffSuggestion {
  userId: number;
  userName: string;
  reason: string;
}

export interface ValidationResult {
  isValid: boolean;
  violations: ConstraintViolation[];
  warnings: ConstraintWarning[];
  suggestions: StaffSuggestion[];
}

export interface AssignmentResult {
  assignment: ShiftAssignment;
  warnings: ConstraintWarning[];
}

export interface WhatIfResult {
  currentWeekHours: number;
  newShiftHours: number;
  projectedWeekHours: number;
  wouldTriggerOvertimeWarning: boolean;
  wouldExceedOvertimeLimit: boolean;
  overtimeHours: number;
}

// ─── Overtime & Analytics ─────────────────────────────────────────────────────

export interface StaffWeeklyHours {
  userId: number;
  userName: string;
  email: string;
  scheduledHours: number;
  desiredHours: number | null;
  overtimeHours: number;
  hasOvertimeWarning: boolean;
  hasOvertimeViolation: boolean;
  consecutiveDays: number;
  hasConsecutiveDayWarning: boolean;
  requiresOverride: boolean;
}

export interface OvertimeDashboard {
  locationId: number;
  weekStart: string;
  staff: StaffWeeklyHours[];
  totalOvertimeHours: number;
  staffAtRisk: number;
}

export interface StaffFairness {
  userId: number;
  userName: string;
  totalHours: number;
  premiumShifts: number;
  regularShifts: number;
  hoursVsDesired: number;
  premiumDeviation: number;
}

export interface FairnessReport {
  locationId: number;
  fairnessScore: number;
  period: { from: string; to: string };
  staff: StaffFairness[];
  averagePremiumShifts: number;
}

export interface OnDutyLocation {
  locationId: number;
  locationName: string;
  timezone: string;
  onDuty: Array<{
    userId: number;
    userName: string;
    shiftId: number;
    startAt: string;
    endAt: string;
    skill: string;
  }>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  user: User;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// ─── Form Types ───────────────────────────────────────────────────────────────

export interface LoginFormData {
  email: string;
  password: string;
}

export interface CreateShiftFormData {
  locationId: number;
  skillId: number;
  startAt: string;
  endAt: string;
  headcount: number;
  notes?: string;
  editCutoffHours?: number;
}

export interface CreateAvailabilityFormData {
  type: AvailabilityType;
  dayOfWeek?: number;
  date?: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  note?: string;
}

export interface AssignStaffFormData {
  userId: number;
  shiftId: number;
  forceOverride?: boolean;
  overrideReason?: string;
}

export interface CreateSwapFormData {
  shiftId: number;
  type: SwapType;
  targetId?: number;
  note?: string;
}

// ─── Socket.IO Events ─────────────────────────────────────────────────────────

export interface SocketNotificationEvent {
  notification: Notification;
}

export interface SocketShiftUpdatedEvent {
  shift: Shift;
}

export interface SocketAssignmentCreatedEvent {
  assignment: ShiftAssignment;
  shiftId: number;
}

export interface SocketAssignmentConflictEvent {
  message: string;
  shiftId: number;
  userId: number;
}

export interface SocketSchedulePublishedEvent {
  locationId: number;
  weekStart: string;
  shiftCount: number;
}

export interface SocketOnDutyUpdateEvent {
  locations: OnDutyLocation[];
}
