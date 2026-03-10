import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// ─── Request Interceptor — attach JWT ─────────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('shiftsync_token');
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Response Interceptor — handle 401 ───────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Clear stale token and redirect to login
      localStorage.removeItem('shiftsync_token');
      localStorage.removeItem('shiftsync_user');
      // Only redirect if not already on login page
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// ─── Typed error helper ───────────────────────────────────────────────────────
export interface ApiError {
  message: string;
  violations?: import('@/types').ConstraintViolation[];
  warnings?: import('@/types').ConstraintWarning[];
  suggestions?: import('@/types').StaffSuggestion[];
  requiresOverride?: boolean;
  statusCode?: number;
}

export function parseApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    return {
      message: data?.message ?? error.message ?? 'An unexpected error occurred',
      violations: data?.violations,
      warnings: data?.warnings,
      suggestions: data?.suggestions,
      requiresOverride: data?.requiresOverride,
      statusCode: error.response?.status,
    };
  }
  return { message: 'An unexpected error occurred' };
}
