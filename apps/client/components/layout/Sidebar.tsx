"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Users,
  ArrowLeftRight,
  BarChart3,
  Bell,
  FileText,
  Clock,
  Zap,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Avatar, Badge } from "@/components/ui";

// ─── Nav config ───────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.FC<{ className?: string }>;
  badge?: string;
  roles?: Array<"ADMIN" | "MANAGER" | "STAFF">;
  description: string;
}

const NAV: NavItem[] = [
  {
    label: "Schedule",
    href: "/schedule",
    icon: Calendar,
    description: "Weekly shift calendar",
  },
  {
    label: "Shifts",
    href: "/shifts",
    icon: LayoutDashboard,
    description: "All shifts across locations",
  },
  {
    label: "Staff",
    href: "/staff",
    icon: Users,
    description: "Staff profiles and skills",
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "Swaps",
    href: "/swaps",
    icon: ArrowLeftRight,
    description: "Swap and drop requests",
  },
  {
    label: "Overtime",
    href: "/overtime",
    icon: Clock,
    description: "Hours tracking dashboard",
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    description: "Fairness and distribution",
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: Bell,
    description: "Alerts and updates",
  },
  {
    label: "Audit Log",
    href: "/audit",
    icon: FileText,
    description: "System change history",
    roles: ["ADMIN"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Profile and preferences",
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  notificationCount?: number;
}

export function Sidebar({ notificationCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const { user, isAdmin, isManager } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const filteredNav = NAV.filter((item) => {
    if (!item.roles) return true;
    if (item.roles.includes("ADMIN") && isAdmin()) return true;
    if (item.roles.includes("MANAGER") && isManager()) return true;
    if (item.roles.includes("STAFF") && !isManager()) return true;
    return false;
  });

  return (
    <aside
      className={cn(
        "relative flex flex-col h-full border-r border-[var(--border)] bg-[var(--surface)]",
        "transition-all duration-300 ease-in-out shrink-0",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-5 border-b border-[var(--border)]",
          collapsed && "justify-center px-0",
        )}
      >
        <div className="w-8 h-8 rounded-lg bg-[hsl(187_100%_42%)] flex items-center justify-center shrink-0 shadow-[0_0_16px_hsl(187_100%_42%/0.35)]">
          <Zap className="w-4 h-4 text-[hsl(215_28%_7%)]" fill="currentColor" />
        </div>
        {!collapsed && (
          <span className="text-base font-bold text-[var(--text-primary)] font-nunito tracking-tight">
            ShiftSync
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {filteredNav.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const showBadge =
            item.href === "/notifications" && notificationCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-lg",
                "text-sm font-semibold font-nunito transition-all duration-200",
                "relative overflow-hidden",
                isActive
                  ? "bg-[hsl(187_100%_42%/0.12)] text-[hsl(187_100%_42%)] border border-[hsl(187_100%_42%/0.20)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]",
                collapsed && "justify-center px-2",
              )}
            >
              {/* Active accent line */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4/5 bg-[hsl(187_100%_42%)] rounded-r" />
              )}

              <div className="relative shrink-0">
                <Icon className="w-4 h-4" />
                {showBadge && !collapsed && (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[hsl(0_72%_54%)] flex items-center justify-center text-[8px] font-bold text-white">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </div>

              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{item.label}</span>
                  {showBadge && (
                    <Badge
                      variant="danger"
                      className="text-[10px] px-1.5 py-0 h-5"
                    >
                      {notificationCount > 99 ? "99+" : notificationCount}
                    </Badge>
                  )}
                </>
              )}

              {/* Tooltip for collapsed */}
              {collapsed && (
                <div className="absolute left-full ml-3 px-2 py-1 rounded-md bg-[var(--surface-elevated)] border border-[var(--border)] text-xs font-nunito text-[var(--text-primary)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      {user && (
        <div
          className={cn(
            "border-t border-[var(--border)] p-3",
            collapsed ? "flex justify-center" : "flex items-center gap-3",
          )}
        >
          <Avatar name={user.name} size="sm" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--text-primary)] font-nunito truncate">
                {user.name}
              </p>
              <p className="text-[10px] text-[var(--text-muted)] font-nunito uppercase tracking-wide">
                {user.role}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((p) => !p)}
        className={cn(
          "absolute -right-3 top-1/2 -translate-y-1/2 z-10",
          "w-6 h-6 rounded-full border border-[var(--border)] bg-[var(--surface)]",
          "flex items-center justify-center",
          "text-[var(--text-muted)] hover:text-[hsl(187_100%_42%)] hover:border-[hsl(187_100%_42%/0.4)]",
          "transition-all duration-200 shadow-sm",
        )}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </aside>
  );
}
