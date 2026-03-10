"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { User, UserRole, LoginResponse } from "@/types";
import { api, parseApiError } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => void;

  // Role checks
  isAdmin: () => boolean;
  isManager: () => boolean; // true for ADMIN + MANAGER
  isStaffOnly: () => boolean;

  // Location access (manager can only access their locations)
  canManageLocation: (locationId: number) => boolean;

  // Managed location IDs (for managers)
  managedLocationIds: number[];
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "shiftsync_token";
const USER_KEY = "shiftsync_user";
const LOCS_KEY = "shiftsync_managed_locations";

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [managedLocationIds, setManagedLocationIds] = useState<number[]>([]);

  // ── Hydrate from localStorage on mount ──────────────────────────────────
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);
      const storedLocs = localStorage.getItem(LOCS_KEY);

      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser) as User;
        setToken(storedToken);
        setUser(parsedUser);
        if (storedLocs) {
          setManagedLocationIds(JSON.parse(storedLocs) as number[]);
        }
        // Verify token is still valid
        api
          .get<{ data: User }>("/auth/me")
          .then((res) => {
            setUser(res.data.data);
          })
          .catch(() => {
            // Token expired — clear everything
            clearAuth();
          });
      }
    } catch {
      clearAuth();
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch managed locations for managers ──────────────────────────────────
  const fetchManagedLocations = useCallback(async (userId: number) => {
    try {
      const res = await api.get<{ data: Array<{ locationId: number }> }>(
        `/locations?managedBy=${userId}`,
      );
      const ids = res.data.data.map((l) => l.locationId);
      setManagedLocationIds(ids);
      localStorage.setItem(LOCS_KEY, JSON.stringify(ids));
    } catch {
      // Non-critical — continue without
    }
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<LoginResponse>("/auth/login", {
        email,
        password,
      });
      const { access_token, user: loggedInUser } = res.data;

      localStorage.setItem(TOKEN_KEY, access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(loggedInUser));

      setToken(access_token);
      setUser(loggedInUser);

      // Fetch managed locations if manager
      if (loggedInUser.role === "MANAGER") {
        await fetchManagedLocations(loggedInUser.id);
      }

      router.push("/schedule");
    },
    [router, fetchManagedLocations],
  );

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearAuth();
    router.push("/login");
  }, [router]);

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LOCS_KEY);
    setToken(null);
    setUser(null);
    setManagedLocationIds([]);
  }

  // ── Role helpers ───────────────────────────────────────────────────────────
  const isAdmin = useCallback(() => user?.role === "ADMIN", [user]);
  const isManager = useCallback(
    () => user?.role === "ADMIN" || user?.role === "MANAGER",
    [user],
  );
  const isStaffOnly = useCallback(() => user?.role === "STAFF", [user]);

  const canManageLocation = useCallback(
    (locationId: number) => {
      if (!user) return false;
      if (user.role === "ADMIN") return true;
      if (user.role === "MANAGER")
        return managedLocationIds.includes(locationId);
      return false;
    },
    [user, managedLocationIds],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: !!user && !!token,
      login,
      logout,
      isAdmin,
      isManager,
      isStaffOnly,
      canManageLocation,
      managedLocationIds,
    }),
    [
      user,
      token,
      isLoading,
      login,
      logout,
      isAdmin,
      isManager,
      isStaffOnly,
      canManageLocation,
      managedLocationIds,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export { parseApiError };
