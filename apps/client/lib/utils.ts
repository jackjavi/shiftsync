import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  format,
  formatDistanceToNow,
  parseISO,
  isToday,
  isTomorrow,
  isYesterday,
} from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

// ─── Tailwind ─────────────────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Date & Timezone ──────────────────────────────────────────────────────────

/**
 * Format a UTC datetime string in a specific IANA timezone.
 */
export function formatInTz(
  utcDateStr: string,
  timezone: string,
  fmt = "MMM d, h:mm a",
): string {
  try {
    return formatInTimeZone(parseISO(utcDateStr), timezone, fmt);
  } catch {
    return utcDateStr;
  }
}

/**
 * Format just the time portion in a timezone.
 */
export function formatTimeTz(utcDateStr: string, timezone: string): string {
  return formatInTz(utcDateStr, timezone, "h:mm a");
}

/**
 * Format just the date in a timezone.
 */
export function formatDateTz(utcDateStr: string, timezone: string): string {
  return formatInTz(utcDateStr, timezone, "EEE, MMM d");
}

/**
 * Format shift duration as "Xh Ym".
 */
export function formatShiftDuration(startAt: string, endAt: string): string {
  const start = parseISO(startAt);
  const end = parseISO(endAt);
  const diffMs = end.getTime() - start.getTime();
  const totalMins = Math.abs(Math.round(diffMs / 60000));
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Relative time: "2 hours ago", "in 3 days", etc.
 */
export function timeAgo(utcDateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(utcDateStr), { addSuffix: true });
  } catch {
    return utcDateStr;
  }
}

/**
 * Human-friendly date: "Today", "Tomorrow", "Yesterday", or formatted date.
 */
export function friendlyDate(utcDateStr: string, timezone?: string): string {
  try {
    const date = parseISO(utcDateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    if (isYesterday(date)) return "Yesterday";
    if (timezone) return formatInTimeZone(date, timezone, "EEE, MMM d");
    return format(date, "EEE, MMM d");
  } catch {
    return utcDateStr;
  }
}

/**
 * Format a week range: "Mar 10 – Mar 16, 2026"
 */
export function formatWeekRange(weekStart: string): string {
  try {
    const start = parseISO(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
  } catch {
    return weekStart;
  }
}

/**
 * Get ISO week start (Monday) for a given date.
 */
export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Abbreviate IANA timezone: "America/Los_Angeles" → "PT"
 */
export function tzAbbr(timezone: string): string {
  const map: Record<string, string> = {
    "America/Los_Angeles": "PT",
    "America/Denver": "MT",
    "America/Chicago": "CT",
    "America/New_York": "ET",
    "America/Anchorage": "AKT",
    "Pacific/Honolulu": "HT",
    "Europe/London": "GMT",
    "Europe/Paris": "CET",
    "Europe/Berlin": "CET",
    "Asia/Tokyo": "JST",
    "Asia/Shanghai": "CST",
    "Australia/Sydney": "AEST",
  };
  return map[timezone] ?? timezone.split("/")[1]?.replace("_", " ") ?? timezone;
}

// ─── Number Formatters ────────────────────────────────────────────────────────

export function formatHours(hours: number): string {
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours.toFixed(1)}h`;
}

export function formatPercent(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

// ─── Role Helpers ─────────────────────────────────────────────────────────────

import type { UserRole } from "@/types";

export function isAdmin(role?: UserRole) {
  return role === "ADMIN";
}
export function isManager(role?: UserRole) {
  return role === "MANAGER" || role === "ADMIN";
}
export function isStaff(role?: UserRole) {
  return role === "STAFF";
}

export function roleBadgeColor(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "text-[hsl(43_95%_56%)] bg-[hsl(43_95%_56%/0.12)]";
    case "MANAGER":
      return "text-[hsl(187_100%_42%)] bg-[hsl(187_100%_42%/0.12)]";
    case "STAFF":
      return "text-[hsl(215_15%_58%)] bg-[hsl(215_15%_58%/0.12)]";
  }
}

// ─── Status Helpers ───────────────────────────────────────────────────────────

import type { SwapStatus, AssignmentStatus } from "@/types";

export function swapStatusColor(status: SwapStatus): string {
  switch (status) {
    case "PENDING":
      return "text-[hsl(38_95%_52%)] bg-[hsl(38_95%_52%/0.12)]";
    case "ACCEPTED":
      return "text-[hsl(210_90%_56%)] bg-[hsl(210_90%_56%/0.12)]";
    case "APPROVED":
      return "text-[hsl(155_60%_40%)] bg-[hsl(155_60%_40%/0.12)]";
    case "REJECTED":
      return "text-[hsl(0_72%_54%)] bg-[hsl(0_72%_54%/0.12)]";
    case "CANCELLED":
      return "text-[hsl(215_15%_58%)] bg-[hsl(215_15%_58%/0.12)]";
    case "EXPIRED":
      return "text-[hsl(215_15%_45%)] bg-[hsl(215_15%_45%/0.12)]";
  }
}

export function assignmentStatusColor(status: AssignmentStatus): string {
  switch (status) {
    case "ASSIGNED":
      return "text-[hsl(155_60%_40%)] bg-[hsl(155_60%_40%/0.12)]";
    case "DROPPED":
      return "text-[hsl(0_72%_54%)] bg-[hsl(0_72%_54%/0.12)]";
    case "SWAPPED":
      return "text-[hsl(210_90%_56%)] bg-[hsl(210_90%_56%/0.12)]";
  }
}

// ─── Initials ─────────────────────────────────────────────────────────────────

export function getInitials(name: string): string {
  // Fix - Cannot read properties of undefined (reading 'split')
  if (!name) return "";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
}

/**
 * Deterministic avatar background color from name.
 */
export function avatarColor(name: string): string {
  const colors = [
    "hsl(187 100% 42%)",
    "hsl(155 60% 40%)",
    "hsl(210 90% 56%)",
    "hsl(43 95% 56%)",
    "hsl(280 60% 56%)",
    "hsl(20 90% 52%)",
    "hsl(340 80% 54%)",
    "hsl(100 50% 44%)",
  ];
  let hash = 0;
  name = name || "";
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}…`;
}

export function pluralize(
  count: number,
  singular: string,
  plural?: string,
): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function skillDisplayName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
