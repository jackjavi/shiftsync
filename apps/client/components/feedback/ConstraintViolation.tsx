'use client';

import React from 'react';
import { AlertOctagon, AlertTriangle, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConstraintViolation, ConstraintWarning, StaffSuggestion } from '@/types';

interface ConstraintViolationPanelProps {
  violations?: ConstraintViolation[];
  warnings?: ConstraintWarning[];
  suggestions?: StaffSuggestion[];
  requiresOverride?: boolean;
  onForceOverride?: () => void;
  className?: string;
}

const ruleLabels: Record<string, string> = {
  SKILL_MISMATCH:          'Skill Mismatch',
  CERTIFICATION_MISSING:   'Location Not Certified',
  DOUBLE_BOOKING:          'Double Booking',
  HEADCOUNT_FULL:          'Headcount Full',
  REST_PERIOD:             'Insufficient Rest Period',
  UNAVAILABLE:             'Outside Availability',
  DAILY_HOURS_EXCEEDED:    'Daily Hours Exceeded',
  WEEKLY_HOURS_EXCEEDED:   'Weekly Hours Exceeded',
  CONSECUTIVE_DAYS:        'Consecutive Days',
};

export function ConstraintViolationPanel({
  violations = [],
  warnings = [],
  suggestions = [],
  requiresOverride = false,
  onForceOverride,
  className,
}: ConstraintViolationPanelProps) {
  const [showSuggestions, setShowSuggestions] = React.useState(true);

  if (violations.length === 0 && warnings.length === 0) return null;

  return (
    <div className={cn('rounded-xl border border-[hsl(0_72%_54%/0.25)] overflow-hidden animate-scale-in', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(0_72%_54%/0.08)] border-b border-[hsl(0_72%_54%/0.15)]">
        <AlertOctagon className="w-5 h-5 text-[hsl(0_72%_54%)] shrink-0" />
        <div>
          <p className="text-sm font-semibold text-[hsl(0_72%_54%)] font-nunito">
            Scheduling Conflict{violations.length > 1 ? 's' : ''} Detected
          </p>
          <p className="text-xs text-[var(--text-muted)] font-nunito">
            {violations.length} violation{violations.length !== 1 ? 's' : ''}
            {warnings.length > 0 ? `, ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4 bg-[var(--surface)]">
        {/* Hard violations */}
        {violations.length > 0 && (
          <div className="space-y-2">
            {violations.map((v, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-[hsl(0_72%_54%/0.06)] border border-[hsl(0_72%_54%/0.15)]"
              >
                <div className="mt-0.5 w-2 h-2 rounded-full bg-[hsl(0_72%_54%)] shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-[hsl(0_72%_54%)] font-nunito uppercase tracking-wide">
                    {ruleLabels[v.rule] ?? v.rule}
                  </span>
                  <p className="mt-0.5 text-sm text-[var(--text-secondary)] font-nunito leading-relaxed">
                    {v.message}
                  </p>
                  {v.details && Object.keys(v.details).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {Object.entries(v.details).map(([k, val]) => (
                        <span
                          key={k}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-elevated)] text-[var(--text-muted)] border border-[var(--border)]"
                        >
                          {k}: {String(val)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[hsl(38_95%_52%)] uppercase tracking-wide font-nunito">
              Warnings
            </p>
            {warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-[hsl(38_95%_52%/0.06)] border border-[hsl(38_95%_52%/0.15)]"
              >
                <AlertTriangle className="mt-0.5 w-4 h-4 text-[hsl(38_95%_52%)] shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-[hsl(38_95%_52%)] font-nunito uppercase tracking-wide">
                    {ruleLabels[w.rule] ?? w.rule}
                  </span>
                  <p className="mt-0.5 text-sm text-[var(--text-secondary)] font-nunito">
                    {w.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Force override */}
        {requiresOverride && onForceOverride && (
          <div className="p-3 rounded-lg bg-[hsl(38_95%_52%/0.06)] border border-[hsl(38_95%_52%/0.20)]">
            <p className="text-xs font-semibold text-[hsl(38_95%_52%)] font-nunito mb-2">
              Manager Override Required
            </p>
            <p className="text-xs text-[var(--text-secondary)] font-nunito mb-3">
              This assignment exceeds overtime limits. A manager override will be logged in the audit trail.
            </p>
            <button
              onClick={onForceOverride}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[hsl(38_95%_52%)] text-[hsl(215_28%_7%)] hover:bg-[hsl(38_95%_46%)] transition-colors font-nunito"
            >
              Force Override & Assign
            </button>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div>
            <button
              onClick={() => setShowSuggestions((p) => !p)}
              className="flex items-center gap-2 text-xs font-semibold text-[hsl(187_100%_42%)] font-nunito mb-2 hover:text-[hsl(187_100%_50%)] transition-colors"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              {suggestions.length} Available Alternative{suggestions.length !== 1 ? 's' : ''}
              {showSuggestions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showSuggestions && (
              <div className="space-y-1.5">
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-[hsl(187_100%_42%/0.06)] border border-[hsl(187_100%_42%/0.15)]"
                  >
                    <div className="w-7 h-7 rounded-full bg-[hsl(187_100%_42%/0.15)] flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-[hsl(187_100%_42%)] font-nunito">
                        {s.userName.charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)] font-nunito">{s.userName}</p>
                      <p className="text-xs text-[var(--text-muted)] font-nunito truncate">{s.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
