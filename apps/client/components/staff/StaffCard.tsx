'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Zap, CheckCircle2 } from 'lucide-react';
import { cn, skillDisplayName, roleBadgeColor } from '@/lib/utils';
import { Avatar, Badge } from '@/components/ui';
import type { User } from '@/types';

interface StaffCardProps {
  user: User;
  className?: string;
}

export function StaffCard({ user, className }: StaffCardProps) {
  return (
    <Link
      href={`/staff/${user.id}`}
      className={cn(
        'group flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]',
        'hover:border-[hsl(187_100%_42%/0.3)] hover:shadow-[0_4px_24px_hsl(0_0%_0%/0.10)]',
        'transition-all duration-200',
        className,
      )}
    >
      <Avatar name={user.name} size="md" />

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[var(--text-primary)] font-nunito truncate">{user.name}</span>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full font-nunito', roleBadgeColor(user.role))}>
            {user.role}
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)] font-nunito truncate">{user.email}</p>

        {/* Skills */}
        {user.skills && user.skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {user.skills.slice(0, 4).map((us) => (
              <span
                key={us.skillId}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-nunito bg-[hsl(187_100%_42%/0.10)] text-[hsl(187_100%_42%)] border border-[hsl(187_100%_42%/0.20)]"
              >
                <Zap className="w-2.5 h-2.5" />
                {skillDisplayName(us.skill.name)}
              </span>
            ))}
            {user.skills.length > 4 && (
              <span className="text-[10px] text-[var(--text-muted)] font-nunito">+{user.skills.length - 4}</span>
            )}
          </div>
        )}

        {/* Certifications */}
        {user.certifications && user.certifications.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {user.certifications.map((cert) => (
              <span
                key={cert.locationId}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-nunito bg-[hsl(155_60%_40%/0.10)] text-[hsl(155_60%_40%)] border border-[hsl(155_60%_40%/0.20)]"
              >
                <CheckCircle2 className="w-2.5 h-2.5" />
                {cert.location.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        {user.desiredHoursPerWeek && (
          <span className="text-xs text-[var(--text-muted)] font-nunito">{user.desiredHoursPerWeek}h/wk</span>
        )}
        <Badge variant={user.isActive ? 'success' : 'default'} dot className="text-[10px]">
          {user.isActive ? 'Active' : 'Inactive'}
        </Badge>
        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[hsl(187_100%_42%)] transition-colors mt-1" />
      </div>
    </Link>
  );
}
