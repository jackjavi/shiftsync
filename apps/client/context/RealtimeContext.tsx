"use client";

/**
 * RealtimeContext
 *
 * Manages a single Socket.IO connection to the ShiftSync server.
 * On auth, it joins the user's personal room (`user:<id>`) and any location
 * rooms the manager owns (`location:<id>`).
 *
 * Exposes:
 *   - `socket`        — the raw Socket instance (for custom subscriptions)
 *   - `connected`     — boolean connection state
 *   - `onDutyByLocation` — Map<locationId, OnDutyEntry[]> updated by server push
 *
 * Side-effects wired here:
 *   - `notification` events → TanStack Query invalidation + toast
 *   - `on-duty.update` events → updates `onDutyByLocation` state
 *   - `assignment.conflict` events → toast warning
 *   - `swap.requested` / `swap.approved` → toast + query invalidation
 *   - `schedule.published` → query invalidation
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnDutyEntry {
  userId: number;
  userName: string;
  skillName: string;
  shiftId: number;
  locationName?: string;
}

interface RealtimeContextValue {
  socket: Socket | null;
  connected: boolean;
  onDutyByLocation: Map<number, OnDutyEntry[]>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const RealtimeContext = createContext<RealtimeContextValue>({
  socket: null,
  connected: false,
  onDutyByLocation: new Map(),
});

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

// ─── Provider ─────────────────────────────────────────────────────────────────

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, managedLocationIds } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onDutyByLocation, setOnDutyByLocation] = useState<
    Map<number, OnDutyEntry[]>
  >(new Map());

  // ── Connect / disconnect based on auth state ─────────────────────────────

  useEffect(() => {
    if (!isAuthenticated || !user) {
      // Disconnect if user logged out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    // Already connected — re-join rooms if locations changed
    if (socketRef.current?.connected) {
      joinRooms(socketRef.current, user.id, managedLocationIds);
      return;
    }

    // Read token from localStorage (set by AuthContext on login)
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("shiftsync_token")
        : null;

    const socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
      auth: token ? { token } : undefined,
    });

    socketRef.current = socket;

    // ── Lifecycle ──────────────────────────────────────────────────────────

    socket.on("connect", () => {
      setConnected(true);
      joinRooms(socket, user.id, managedLocationIds);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("connect_error", (err) => {
      // Silent — no toast spam on transient network blips
      console.warn("[ShiftSync WS]", err.message);
    });

    // ── Domain events ──────────────────────────────────────────────────────

    /** In-app notification persisted by the server */
    socket.on("notification", (notification: any) => {
      // Refresh the notifications list and badge count
      qc.invalidateQueries({ queryKey: ["notifications"] });

      // Show a toast for high-signal types
      const TOASTABLE = new Set([
        "SHIFT_ASSIGNED",
        "SCHEDULE_PUBLISHED",
        "SWAP_REQUESTED",
        "SWAP_ACCEPTED",
        "SWAP_APPROVED",
        "SWAP_REJECTED",
        "DROP_AVAILABLE",
        "OVERTIME_WARNING",
        "CONSECUTIVE_DAY_WARNING",
      ]);
      if (TOASTABLE.has(notification.type)) {
        toast.info(notification.title, notification.body);
      }
    });

    /** On-duty push from the every-minute cron */
    socket.on(
      "on-duty.update",
      (payload: {
        locationId: number;
        staff: OnDutyEntry[];
        timestamp: string;
      }) => {
        setOnDutyByLocation((prev) => {
          const next = new Map(prev);
          next.set(payload.locationId, payload.staff);
          return next;
        });
        // Also invalidate so any HTTP-polling queries pick up the latest
        qc.invalidateQueries({ queryKey: ["analytics", "on-duty"] });
      },
    );

    /** Another manager just took the last slot we were trying to fill */
    socket.on("assignment.conflict", (payload: any) => {
      toast.warning(
        "Assignment conflict",
        payload.message ??
          "Another manager just assigned that staff member to this shift.",
      );
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["schedule"] });
    });

    /** A swap request was directed at this user */
    socket.on("swap.requested", (swapRequest: any) => {
      toast.info(
        "Swap request received",
        `${swapRequest.requester?.name ?? "A colleague"} wants to swap a shift with you.`,
      );
      qc.invalidateQueries({ queryKey: ["swaps"] });
    });

    /** A swap involving this user was approved */
    socket.on("swap.approved", () => {
      qc.invalidateQueries({ queryKey: ["swaps"] });
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["schedule"] });
    });

    /** Schedule was published at a location this manager manages */
    socket.on("schedule.published", () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["schedule"] });
    });

    /** New assignment at a location room (manager view refresh) */
    socket.on("assignment.created", () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["schedule"] });
    });

    /** Shift was updated by another session */
    socket.on("shift.updated", () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["schedule"] });
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("notification");
      socket.off("on-duty.update");
      socket.off("assignment.conflict");
      socket.off("swap.requested");
      socket.off("swap.approved");
      socket.off("schedule.published");
      socket.off("assignment.created");
      socket.off("shift.updated");
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  // Re-join location rooms when the manager's list changes
  useEffect(() => {
    if (socketRef.current?.connected && user) {
      joinRooms(socketRef.current, user.id, managedLocationIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managedLocationIds]);

  return (
    <RealtimeContext.Provider
      value={{ socket: socketRef.current, connected, onDutyByLocation }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRealtime() {
  return useContext(RealtimeContext);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function joinRooms(socket: Socket, userId: number, locationIds: number[]) {
  socket.emit("join:user", { userId });
  for (const id of locationIds) {
    socket.emit("join:location", { locationId: id });
  }
}
