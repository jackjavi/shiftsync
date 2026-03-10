'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth }   from '@/context/AuthContext';
import { Sidebar }   from '@/components/layout/Sidebar';
import { Topbar }    from '@/components/layout/Topbar';
import { Spinner }   from '@/components/ui';
import { useQuery }  from '@tanstack/react-query';
import { api }       from '@/lib/api';
import type { PaginatedResponse, Notification } from '@/types';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Fetch unread notification count
  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Notification>>('/notifications?isRead=false&limit=1');
      return res.data.meta.total;
    },
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[hsl(187_100%_42%)] flex items-center justify-center">
            <span className="text-[hsl(215_28%_7%)] font-bold text-lg">⚡</span>
          </div>
          <Spinner size="md" />
          <p className="text-sm text-[var(--text-muted)] font-nunito">Loading ShiftSync…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      {/* Sidebar */}
      <Sidebar notificationCount={notifData ?? 0} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar notificationCount={notifData ?? 0} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
