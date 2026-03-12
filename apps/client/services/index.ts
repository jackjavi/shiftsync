import { api } from "@/lib/api";
import type {
  Notification,
  PaginatedResponse,
  ApiResponse,
  SwapRequest,
  CreateSwapFormData,
  SwapStatus,
  User,
  AvailabilityWindow,
  CreateAvailabilityFormData,
  FairnessReport,
  OvertimeDashboard,
  OnDutyLocation,
  AuditLog,
  Location,
  Skill,
} from "@/types";

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsService = {
  list: (params?: { isRead?: boolean; page?: number; limit?: number }) =>
    api
      .get<PaginatedResponse<Notification>>("/notifications", { params })
      .then((r) => r.data),

  markRead: (id: number) =>
    api
      .patch<ApiResponse<Notification>>(`/notifications/${id}/read`)
      .then((r) => r.data.data),

  markAllRead: () => api.patch("/notifications/read-all"),
};

// ─── Swaps ────────────────────────────────────────────────────────────────────

export const swapsService = {
  list: (params?: {
    status?: SwapStatus;
    type?: "SWAP" | "DROP";
    locationId?: number;
    page?: number;
    limit?: number;
  }) =>
    api
      .get<PaginatedResponse<SwapRequest>>("/swaps", { params })
      .then((r) => r.data),

  get: (id: number) =>
    api.get<ApiResponse<SwapRequest>>(`/swaps/${id}`).then((r) => r.data.data),

  create: (data: CreateSwapFormData) =>
    api.post<ApiResponse<SwapRequest>>("/swaps", data).then((r) => r.data.data),

  accept: (id: number) =>
    api
      .post<ApiResponse<SwapRequest>>(`/swaps/${id}/accept`)
      .then((r) => r.data.data),

  reject: (id: number) =>
    api
      .post<ApiResponse<SwapRequest>>(`/swaps/${id}/reject`)
      .then((r) => r.data.data),

  approve: (id: number, note?: string) =>
    api
      .post<ApiResponse<SwapRequest>>(`/swaps/${id}/approve`, { note })
      .then((r) => r.data.data),

  cancel: (id: number) =>
    api
      .post<ApiResponse<SwapRequest>>(`/swaps/${id}/cancel`)
      .then((r) => r.data.data),

  pickup: (id: number) =>
    api
      .post<ApiResponse<SwapRequest>>(`/swaps/${id}/pickup`)
      .then((r) => r.data.data),
};

// ─── Users ────────────────────────────────────────────────────────────────────

export const usersService = {
  list: (params?: {
    role?: string;
    locationId?: number;
    page?: number;
    limit?: number;
  }) =>
    api.get<PaginatedResponse<User>>("/users", { params }).then((r) => r.data),

  get: (id: number) =>
    api.get<ApiResponse<User>>(`/users/${id}`).then((r) => r.data.data),

  create: (data: {
    name: string;
    email: string;
    password: string;
    role: string;
    desiredHoursPerWeek?: number;
  }) => api.post<ApiResponse<User>>("/users", data).then((r) => r.data.data),

  updateMe: (data: Partial<User>) =>
    api.patch<ApiResponse<User>>("/users/me", data).then((r) => r.data.data),

  addSkill: (userId: number, skillId: number) =>
    api.post(`/users/${userId}/skills`, { skillId }),

  removeSkill: (userId: number, skillId: number) =>
    api.delete(`/users/${userId}/skills/${skillId}`),

  addCert: (userId: number, locationId: number) =>
    api.post(`/users/${userId}/certifications`, { locationId }),

  removeCert: (userId: number, locationId: number) =>
    api.delete(`/users/${userId}/certifications/${locationId}`),
};

// ─── Availability ─────────────────────────────────────────────────────────────

export const availabilityService = {
  me: () =>
    api
      .get<ApiResponse<AvailabilityWindow[]>>("/availability/me")
      .then((r) => r.data.data),

  forUser: (userId: number) =>
    api
      .get<ApiResponse<AvailabilityWindow[]>>(`/availability/user/${userId}`)
      .then((r) => r.data.data),

  create: (data: CreateAvailabilityFormData) =>
    api
      .post<ApiResponse<AvailabilityWindow>>("/availability", data)
      .then((r) => r.data.data),

  update: (id: number, data: Partial<CreateAvailabilityFormData>) =>
    api
      .patch<ApiResponse<AvailabilityWindow>>(`/availability/${id}`, data)
      .then((r) => r.data.data),

  delete: (id: number) => api.delete(`/availability/${id}`),
};

// ─── Locations ────────────────────────────────────────────────────────────────

export const locationsService = {
  list: () =>
    api.get<ApiResponse<Location[]>>("/locations").then((r) => r.data.data),

  get: (id: number) =>
    api.get<ApiResponse<Location>>(`/locations/${id}`).then((r) => r.data.data),
};

// ─── Skills ───────────────────────────────────────────────────────────────────

export const skillsService = {
  list: () => api.get<ApiResponse<Skill[]>>("/skills").then((r) => r.data.data),
};

// ─── Analytics & Overtime ─────────────────────────────────────────────────────

export const analyticsService = {
  fairness: (locationId: number, from: string, to: string) =>
    api
      .get<ApiResponse<FairnessReport>>(`/analytics/fairness/${locationId}`, {
        params: { from, to },
      })
      .then((r) => r.data.data),

  hours: (locationId: number, from: string, to: string) =>
    api
      .get<ApiResponse<unknown>>(`/analytics/hours/${locationId}`, {
        params: { from, to },
      })
      .then((r) => r.data.data),

  onDuty: () =>
    api
      .get<ApiResponse<OnDutyLocation[]>>("/analytics/on-duty")
      .then((r) => r.data.data),
};

export const overtimeService = {
  dashboard: (locationId: number, weekStart: string) =>
    api
      .get<ApiResponse<OvertimeDashboard>>(
        `/overtime/dashboard/${locationId}`,
        {
          params: { weekStart },
        },
      )
      .then((r) => r.data.data),

  myWeekly: () =>
    api
      .get<ApiResponse<unknown>>("/overtime/weekly/me")
      .then((r) => r.data.data),
};

// ─── Audit ────────────────────────────────────────────────────────────────────

export const auditService = {
  list: (params?: {
    page?: number;
    limit?: number;
    entityType?: string;
    from?: string;
    to?: string;
  }) =>
    api
      .get<PaginatedResponse<AuditLog>>("/audit", { params })
      .then((r) => r.data),

  forShift: (shiftId: number) =>
    api
      .get<ApiResponse<AuditLog[]>>(`/audit/shift/${shiftId}`)
      .then((r) => r.data.data),

  export: (params?: { entityType?: string; from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.entityType) query.set("entityType", params.entityType);
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    return api.get(`/audit/export?${query.toString()}`, {
      responseType: "blob",
    });
  },
};
