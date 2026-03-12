"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell, LogOut, User, ChevronDown, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Avatar, Badge } from "@/components/ui";
import { ThemeButtons } from "@/components/theme-buttons";

interface TopbarProps {
  title?: string;
  notificationCount?: number;
}

export function Topbar({ title, notificationCount = 0 }: TopbarProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b border-[var(--border)] bg-[var(--surface)]">
      {/* Left — page title */}
      <div className="flex items-center gap-3">
        {title && (
          <h1 className="text-base font-semibold text-[var(--text-primary)] font-nunito hidden sm:block">
            {title}
          </h1>
        )}
      </div>

      {/* Right — controls */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <ThemeButtons />

        {/* Notifications bell */}
        <Link
          href="/notifications"
          className={cn(
            "relative p-2 rounded-lg transition-colors",
            "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]",
          )}
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[hsl(0_72%_54%)] flex items-center justify-center text-[9px] font-bold text-white">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </Link>

        {/* User menu */}
        {user && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((p) => !p)}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200",
                "hover:bg-[var(--surface-elevated)]",
                menuOpen && "bg-[var(--surface-elevated)]",
              )}
              aria-expanded={menuOpen}
              aria-haspopup="true"
            >
              <Avatar name={user.name} size="sm" />
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-[var(--text-primary)] font-nunito leading-none">
                  {user.name ? user.name.split(" ")[0] : ""}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] font-nunito uppercase tracking-wide mt-0.5">
                  {user.role}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 text-[var(--text-muted)] transition-transform",
                  menuOpen && "rotate-180",
                )}
              />
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <div
                className={cn(
                  "absolute right-0 top-full mt-2 w-52 z-50",
                  "rounded-xl border border-[var(--border)] bg-[var(--surface)]",
                  "shadow-[0_8px_32px_hsl(0_0%_0%/0.20)]",
                  "animate-slide-down",
                )}
              >
                {/* User info */}
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <p className="text-sm font-semibold text-[var(--text-primary)] font-nunito truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] font-nunito truncate">
                    {user.email}
                  </p>
                  <Badge
                    variant={
                      user.role === "ADMIN"
                        ? "premium"
                        : user.role === "MANAGER"
                          ? "accent"
                          : "default"
                    }
                    className="mt-1.5 text-[10px]"
                    dot
                  >
                    {user.role}
                  </Badge>
                </div>

                {/* Menu items */}
                <div className="p-1.5">
                  <Link
                    href="/staff/me"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors font-nunito"
                  >
                    <User className="w-4 h-4" />
                    My Profile
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors font-nunito"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>

                  <div className="border-t border-[var(--border)] my-1" />

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[hsl(0_72%_54%)] hover:bg-[hsl(0_72%_54%/0.08)] transition-colors font-nunito"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
