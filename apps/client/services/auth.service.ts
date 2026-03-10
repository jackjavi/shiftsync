import { api } from '@/lib/api';
import type { LoginResponse, User } from '@/types';

export const authService = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }).then((r) => r.data),

  me: () =>
    api.get<{ data: User }>('/auth/me').then((r) => r.data.data),
};
