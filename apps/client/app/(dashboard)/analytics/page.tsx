"use client";

import React, { useState, useMemo } from "react";
import { useRealtime } from "@/context/RealtimeContext";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { BarChart3, Star, TrendingUp, Users } from "lucide-react";
import { Button, Select, Spinner, Card, Avatar } from "@/components/ui";
import { EmptyState } from "@/components/feedback/EmptyState";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { locationsService, analyticsService } from "@/services/index";
import { formatHours, cn } from "@/lib/utils";

const TEAL = "hsl(187, 100%, 42%)";
const GOLD = "hsl(43, 95%, 56%)";
const GREEN = "hsl(155, 60%, 40%)";
const WARN = "hsl(38, 95%, 52%)";
const PURPLE = "hsl(280, 60%, 56%)";
const CHART_COLORS = [
  TEAL,
  GOLD,
  GREEN,
  WARN,
  PURPLE,
  "hsl(340, 80%, 54%)",
  "hsl(20, 90%, 52%)",
];

export default function AnalyticsPage() {
  const [locationId, setLocationId] = useState<number | undefined>();
  const today = format(new Date(), "yyyy-MM-dd");
  const from30 = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: locationsService.list,
  });

  const { data: fairness, isLoading } = useQuery({
    queryKey: ["analytics", "fairness", locationId, from30, today],
    queryFn: () => analyticsService.fairness(locationId!, from30, today),
    enabled: !!locationId,
  });

  // On-duty: prefer socket push, fall back to HTTP on initial load
  const { onDutyByLocation } = useRealtime();
  const { data: onDutyHttp } = useQuery({
    queryKey: ["analytics", "on-duty"],
    queryFn: analyticsService.onDuty,
    // Only HTTP-poll as a safety net — socket push keeps this fresh
    refetchInterval: onDutyByLocation.size > 0 ? false : 60_000,
  });

  // Merge: socket data takes priority; HTTP data covers initial load.
  // Both paths are normalised to { locationId, locationName, onDuty[] }
  const onDuty = useMemo(() => {
    if (onDutyByLocation.size > 0) {
      return Array.from(onDutyByLocation.entries()).map(
        ([locationId, onDutyStaff]) => ({
          locationId,
          locationName:
            onDutyStaff[0]?.locationName ?? `Location ${locationId}`,
          onDuty: onDutyStaff,
        }),
      );
    }
    // HTTP response from getOnDutyNow() uses `staff` — remap to `onDuty`
    return (onDutyHttp ?? []).map((loc: any) => ({
      locationId: loc.locationId,
      locationName: loc.locationName,
      onDuty: loc.staff ?? loc.onDuty ?? [],
    }));
  }, [onDutyByLocation, onDutyHttp]);

  const staff = fairness?.staff ?? [];
  const score = fairness?.fairnessScore ?? 0;
  const scoreColor =
    score >= 80 ? GREEN : score >= 60 ? WARN : "hsl(0, 72%, 54%)";

  const hoursData = staff.map((s) => ({
    name: s.userName.split(" ")[0],
    hours: s.totalHours,
  }));
  const premiumData = staff.map((s) => ({
    name: s.userName.split(" ")[0],
    premium: s.premiumShifts,
    regular: s.regularShifts,
  }));

  const premiumPieData = [
    { name: "Premium", value: staff.reduce((a, s) => a + s.premiumShifts, 0) },
    { name: "Regular", value: staff.reduce((a, s) => a + s.regularShifts, 0) },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] font-display">
            Analytics
          </h1>
          <p className="text-sm text-[var(--text-secondary)] font-nunito mt-1">
            Fairness scoring, hours distribution, and premium shift allocation
          </p>
        </div>
        <Select
          options={[
            { value: "", label: "Select location…" },
            ...(locations ?? []).map((l) => ({ value: l.id, label: l.name })),
          ]}
          value={locationId ?? ""}
          onChange={(e) =>
            setLocationId(e.target.value ? Number(e.target.value) : undefined)
          }
          className="w-48 h-10"
        />
      </div>

      {/* On Duty Now */}
      {onDuty && onDuty.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[hsl(155_60%_40%)] animate-pulse" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)] font-nunito">
              On Duty Now
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {onDuty.map((loc) => (
              <div
                key={loc.locationId}
                className="p-3 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)]"
              >
                <p className="text-xs font-bold text-[hsl(187_100%_42%)] font-nunito mb-2">
                  {loc.locationName}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {loc.onDuty.map((staff: any) => (
                    <div
                      key={staff.userId}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[hsl(155_60%_40%/0.10)] border border-[hsl(155_60%_40%/0.20)]"
                    >
                      <Avatar name={staff.userName} size="xs" />
                      <span className="text-[10px] font-semibold text-[hsl(155_60%_40%)] font-nunito">
                        {staff.userName.split(" ")[0]}
                      </span>
                    </div>
                  ))}
                  {loc.onDuty.length === 0 && (
                    <span className="text-xs text-[var(--text-muted)] font-nunito">
                      No one on duty
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!locationId ? (
        <AlertBanner
          variant="info"
          message="Select a location to view analytics for the past 30 days."
          dismissible={false}
        />
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : staff.length === 0 ? (
        <EmptyState variant="analytics" />
      ) : (
        <>
          {/* Fairness Score + Pie */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Gauge */}
            <Card>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] font-nunito mb-1">
                Fairness Score
              </h2>
              <p className="text-xs text-[var(--text-muted)] font-nunito mb-4">
                Based on hours and premium shift distribution
              </p>
              <div className="relative flex items-center justify-center h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    innerRadius="60%"
                    outerRadius="90%"
                    data={[{ value: score, fill: scoreColor }]}
                    startAngle={225}
                    endAngle={-45}
                  >
                    <RadialBar
                      dataKey="value"
                      cornerRadius={8}
                      background={{ fill: "var(--surface-elevated)" }}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className="text-3xl font-bold font-nunito"
                    style={{ color: scoreColor }}
                  >
                    {score}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] font-nunito">
                    /100
                  </span>
                </div>
              </div>
              <p
                className={cn(
                  "text-center text-sm font-semibold font-nunito mt-2",
                  score >= 80
                    ? "text-[hsl(155_60%_40%)]"
                    : score >= 60
                      ? "text-[hsl(38_95%_52%)]"
                      : "text-[hsl(0_72%_54%)]",
                )}
              >
                {score >= 80
                  ? "Excellent distribution"
                  : score >= 60
                    ? "Needs attention"
                    : "Highly unequal — review schedule"}
              </p>
            </Card>

            {/* Premium distribution pie */}
            <Card>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] font-nunito mb-1">
                Shift Composition
              </h2>
              <p className="text-xs text-[var(--text-muted)] font-nunito mb-4">
                Last 30 days
              </p>
              <div className="flex items-center justify-center gap-6">
                <ResponsiveContainer width={130} height={130}>
                  <PieChart>
                    <Pie
                      data={premiumPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={58}
                      dataKey="value"
                      paddingAngle={3}
                    >
                      <Cell fill={GOLD} />
                      <Cell fill={TEAL} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {premiumPieData.map((entry, i) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ background: i === 0 ? GOLD : TEAL }}
                      />
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-primary)] font-nunito">
                          {entry.name}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] font-nunito">
                          {entry.value} shift{entry.value !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Hours distribution chart */}
          <Card>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] font-nunito mb-4">
              Hours per Staff Member
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={hoursData}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                  labelStyle={{
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-nunito)",
                  }}
                />
                <Bar
                  dataKey="hours"
                  fill={TEAL}
                  radius={[4, 4, 0, 0]}
                  name="Total Hours"
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Premium vs Regular chart */}
          <Card>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] font-nunito mb-4">
              Premium vs Regular Shifts
              <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                — fairness check: premium shifts should be evenly distributed
              </span>
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={premiumData}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                  labelStyle={{
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-nunito)",
                  }}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: 11,
                    fontFamily: "var(--font-nunito)",
                  }}
                />
                <Bar
                  dataKey="premium"
                  stackId="a"
                  fill={GOLD}
                  name="Premium"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="regular"
                  stackId="a"
                  fill={TEAL}
                  name="Regular"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Staff fairness table */}
          <Card padding="none">
            <div className="px-5 pt-5 pb-3 border-b border-[var(--border)]">
              <h2 className="text-base font-semibold text-[var(--text-primary)] font-nunito">
                Individual Breakdown
              </h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {staff.map((s) => (
                <div
                  key={s.userId}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--surface-elevated)] transition-colors"
                >
                  <Avatar name={s.userName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] font-nunito">
                      {s.userName}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] font-nunito">
                      {s.regularShifts} regular · {s.premiumShifts} premium
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[var(--text-primary)] font-nunito">
                      {formatHours(s.totalHours)}
                    </p>
                    {s.hoursVsDesired !== 0 && (
                      <p
                        className={cn(
                          "text-[10px] font-semibold font-nunito",
                          s.hoursVsDesired > 0
                            ? "text-[hsl(38_95%_52%)]"
                            : "text-[hsl(0_72%_54%)]",
                        )}
                      >
                        {s.hoursVsDesired > 0 ? "+" : ""}
                        {formatHours(s.hoursVsDesired)} vs desired
                      </p>
                    )}
                  </div>
                  {Math.abs(s.premiumDeviation) > 1 && (
                    <span
                      className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded font-nunito",
                        s.premiumDeviation > 0
                          ? "bg-[hsl(43_95%_56%/0.12)] text-[hsl(43_95%_56%)]"
                          : "bg-[hsl(0_72%_54%/0.12)] text-[hsl(0_72%_54%)]",
                      )}
                    >
                      {s.premiumDeviation > 0 ? "+" : ""}
                      {s.premiumDeviation.toFixed(1)} prem
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
