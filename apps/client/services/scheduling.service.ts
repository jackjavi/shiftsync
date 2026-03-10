import { api } from '@/lib/api';
import type {
  ValidationResult, AssignmentResult, WhatIfResult,
  StaffSuggestion, ShiftAssignment, ApiResponse,
} from '@/types';

export const schedulingService = {
  validate: (userId: number, shiftId: number) =>
    api.get<ApiResponse<ValidationResult>>('/scheduling/validate', {
      params: { userId, shiftId },
    }).then((r) => r.data.data),

  assign: (userId: number, shiftId: number, forceOverride = false, overrideReason?: string) =>
    api.post<ApiResponse<AssignmentResult>>('/scheduling/assign', {
      userId, shiftId, forceOverride, overrideReason,
    }).then((r) => r.data.data),

  unassign: (assignmentId: number) =>
    api.delete(`/scheduling/assign/${assignmentId}`),

  whatIf: (userId: number, shiftId: number) =>
    api.get<ApiResponse<WhatIfResult>>('/scheduling/what-if', {
      params: { userId, shiftId },
    }).then((r) => r.data.data),

  suggestions: (shiftId: number) =>
    api.get<ApiResponse<StaffSuggestion[]>>(`/scheduling/suggestions/${shiftId}`)
      .then((r) => r.data.data),
};
