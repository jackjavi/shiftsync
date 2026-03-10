import { api } from '@/lib/api';
import type { Shift, PaginatedResponse, ApiResponse, CreateShiftFormData } from '@/types';

export interface ShiftFilters {
  locationId?:  number;
  skillId?:     number;
  from?:        string;
  to?:          string;
  isPublished?: boolean;
  page?:        number;
  limit?:       number;
}

export const shiftsService = {
  list: (filters?: ShiftFilters) =>
    api.get<PaginatedResponse<Shift>>('/shifts', { params: filters }).then((r) => r.data),

  get: (id: number) =>
    api.get<ApiResponse<Shift>>(`/shifts/${id}`).then((r) => r.data.data),

  create: (data: CreateShiftFormData) =>
    api.post<ApiResponse<Shift>>('/shifts', data).then((r) => r.data.data),

  update: (id: number, data: Partial<CreateShiftFormData>) =>
    api.patch<ApiResponse<Shift>>(`/shifts/${id}`, data).then((r) => r.data.data),

  delete: (id: number) =>
    api.delete(`/shifts/${id}`),

  publish: (id: number) =>
    api.post<ApiResponse<Shift>>(`/shifts/${id}/publish`).then((r) => r.data.data),

  unpublish: (id: number) =>
    api.post<ApiResponse<Shift>>(`/shifts/${id}/unpublish`).then((r) => r.data.data),

  publishWeek: (locationId: number, weekStart: string) =>
    api.post('/shifts/publish-week', { locationId, weekStart }).then((r) => r.data),
};
