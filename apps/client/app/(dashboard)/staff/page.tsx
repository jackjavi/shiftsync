"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, UserPlus } from "lucide-react";
import { Input, Select, Skeleton, Button } from "@/components/ui";
import { StaffCard } from "@/components/staff/StaffCard";
import { CreateUserModal } from "@/components/staff/CreateUserModal";
import { EmptyState } from "@/components/feedback/EmptyState";
import { usersService } from "@/services/index";
import { useAuth } from "@/context/AuthContext";

export default function StaffPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const { isManager } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["users", roleFilter, page],
    queryFn: () =>
      usersService.list({ role: roleFilter || undefined, page, limit: 20 }),
  });

  const staff = (data?.data ?? []).filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );
  const total = data?.meta.total ?? 0;
  const pages = Math.ceil(total / 20);

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] font-display">
            Staff
          </h1>
          <p className="text-sm text-[var(--text-secondary)] font-nunito mt-1">
            {total > 0
              ? `${total} staff member${total !== 1 ? "s" : ""}`
              : "All staff across locations"}
          </p>
        </div>
        {isManager() && (
          <Button
            variant="primary"
            icon={<UserPlus className="w-4 h-4" />}
            onClick={() => setCreateOpen(true)}
          >
            Create Staff
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Search by name or email…"
          leftIcon={<Search className="w-4 h-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          containerClassName="flex-1 min-w-48 max-w-xs"
        />
        <Select
          options={[
            { value: "", label: "All roles" },
            { value: "STAFF", label: "Staff" },
            { value: "MANAGER", label: "Managers" },
            { value: "ADMIN", label: "Admins" },
          ]}
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="w-36 h-10"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : staff.length === 0 ? (
        <EmptyState variant="staff" />
      ) : (
        <div className="space-y-3">
          {staff.map((u) => (
            <StaffCard key={u.id} user={u} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            className="px-4 py-2 text-sm font-semibold font-nunito rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] disabled:opacity-40 transition-colors"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="text-sm text-[var(--text-muted)] font-nunito px-2">
            Page {page} of {pages}
          </span>
          <button
            className="px-4 py-2 text-sm font-semibold font-nunito rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] disabled:opacity-40 transition-colors"
            disabled={page === pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
