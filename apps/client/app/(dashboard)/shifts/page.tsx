'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Filter, LayoutList } from 'lucide-react';
import { Button, Select, Skeleton, Badge } from '@/components/ui';
import { ShiftCard } from '@/components/shifts/ShiftCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ShiftFormModal } from '@/components/shifts/ShiftFormModal';
import { shiftsService } from '@/services/shifts.service';
import { locationsService, skillsService } from '@/services/index';
import { useAuth } from '@/context/AuthContext';
import { getWeekStart, formatWeekRange } from '@/lib/utils';

export default function ShiftsPage() {
  const { isManager } = useAuth();
  const [locationId,  setLocationId]  = useState<number | undefined>();
  const [skillId,     setSkillId]     = useState<number | undefined>();
  const [published,   setPublished]   = useState<boolean | undefined>();
  const [page,        setPage]        = useState(1);
  const [createOpen,  setCreateOpen]  = useState(false);

  const { data: locations } = useQuery({ queryKey: ['locations'], queryFn: locationsService.list });
  const { data: skills }    = useQuery({ queryKey: ['skills'],    queryFn: skillsService.list    });

  const { data, isLoading } = useQuery({
    queryKey: ['shifts', locationId, skillId, published, page],
    queryFn: () => shiftsService.list({ locationId, skillId, isPublished: published, page, limit: 20 }),
  });

  const shifts = data?.data ?? [];
  const total  = data?.meta.total ?? 0;
  const pages  = Math.ceil(total / 20);

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] font-display">Shifts</h1>
          <p className="text-sm text-[var(--text-secondary)] font-nunito mt-1">
            {total > 0 ? `${total} shift${total !== 1 ? 's' : ''} found` : 'All scheduled shifts'}
          </p>
        </div>
        {isManager() && (
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateOpen(true)}
          >
            New Shift
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
        <Filter className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
        <Select
          options={[
            { value: '', label: 'All locations' },
            ...(locations ?? []).map((l) => ({ value: l.id, label: l.name })),
          ]}
          value={locationId ?? ''}
          onChange={(e) => { setLocationId(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
          className="w-40 h-9"
        />
        <Select
          options={[
            { value: '', label: 'All skills' },
            ...(skills ?? []).map((s) => ({ value: s.id, label: s.name.replace('_', ' ') })),
          ]}
          value={skillId ?? ''}
          onChange={(e) => { setSkillId(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
          className="w-36 h-9"
        />
        <Select
          options={[
            { value: '', label: 'All statuses' },
            { value: 'true',  label: 'Published' },
            { value: 'false', label: 'Drafts' },
          ]}
          value={published === undefined ? '' : String(published)}
          onChange={(e) => {
            setPublished(e.target.value === '' ? undefined : e.target.value === 'true');
            setPage(1);
          }}
          className="w-36 h-9"
        />
        {(locationId || skillId || published !== undefined) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setLocationId(undefined); setSkillId(undefined); setPublished(undefined); setPage(1); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : shifts.length === 0 ? (
        <EmptyState
          variant="shifts"
          action={isManager() ? (
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
              Create First Shift
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-3">
          {shifts.map((shift) => (
            <ShiftCard key={shift.id} shift={shift} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-[var(--text-muted)] font-nunito px-2">
            Page {page} of {pages}
          </span>
          <Button variant="secondary" size="sm" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      {createOpen && (
        <ShiftFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      )}
    </div>
  );
}
