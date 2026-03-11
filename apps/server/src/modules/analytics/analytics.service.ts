import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { shiftDurationHours } from '../shared/utils/timezone.utils';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Hours distribution per staff member over a date range.
   * Shows who is over/under scheduled vs their desired hours.
   */
  async getHoursDistribution(locationId: number, from: string, to: string) {
    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        status: 'ASSIGNED',
        shift: {
          locationId,
          startAt: { gte: new Date(from), lte: new Date(to) },
        },
      },
      include: {
        user: { select: { id: true, name: true, desiredHoursPerWeek: true } },
        shift: true,
      },
    });

    const staffMap = new Map<
      number,
      {
        name: string;
        desiredPerWeek: number | null;
        totalHours: number;
        shiftCount: number;
      }
    >();

    for (const a of assignments) {
      const hours = shiftDurationHours(a.shift.startAt, a.shift.endAt);
      if (!staffMap.has(a.userId)) {
        staffMap.set(a.userId, {
          name: a.user.name,
          desiredPerWeek: a.user.desiredHoursPerWeek,
          totalHours: 0,
          shiftCount: 0,
        });
      }
      const entry = staffMap.get(a.userId)!;
      entry.totalHours += hours;
      entry.shiftCount += 1;
    }

    // Calculate weeks in range
    const weeks =
      (new Date(to).getTime() - new Date(from).getTime()) /
      (7 * 24 * 60 * 60 * 1000);

    return Array.from(staffMap.entries()).map(([userId, data]) => {
      const desiredTotal = data.desiredPerWeek
        ? data.desiredPerWeek * weeks
        : null;
      const variance = desiredTotal ? data.totalHours - desiredTotal : null;

      return {
        userId,
        name: data.name,
        totalHours: Math.round(data.totalHours * 10) / 10,
        shiftCount: data.shiftCount,
        desiredHoursPerPeriod: desiredTotal
          ? Math.round(desiredTotal * 10) / 10
          : null,
        variance: variance ? Math.round(variance * 10) / 10 : null,
        status:
          variance === null
            ? 'unknown'
            : variance > 5
              ? 'over_scheduled'
              : variance < -5
                ? 'under_scheduled'
                : 'on_target',
      };
    });
  }

  /**
   * Premium shift fairness report.
   * The Fairness Complaint scenario: track Friday/Saturday evening shift distribution.
   * Fairness score: 100 = perfectly equal; lower = more unequal.
   */
  async getFairnessReport(locationId: number, from: string, to: string) {
    const premiumAssignments = await this.prisma.shiftAssignment.findMany({
      where: {
        status: 'ASSIGNED',
        shift: {
          locationId,
          isPremium: true,
          startAt: { gte: new Date(from), lte: new Date(to) },
        },
      },
      include: {
        user: { select: { id: true, name: true } },
        shift: { select: { id: true, startAt: true, isPremium: true } },
      },
    });

    const staffPremiumMap = new Map<
      number,
      { name: string; premiumShifts: number; shiftDates: string[] }
    >();

    for (const a of premiumAssignments) {
      if (!staffPremiumMap.has(a.userId)) {
        staffPremiumMap.set(a.userId, {
          name: a.user.name,
          premiumShifts: 0,
          shiftDates: [],
        });
      }
      const entry = staffPremiumMap.get(a.userId)!;
      entry.premiumShifts += 1;
      entry.shiftDates.push(a.shift.startAt.toISOString().split('T')[0]);
    }

    const counts = Array.from(staffPremiumMap.values()).map(
      (v) => v.premiumShifts,
    );
    const mean = counts.length
      ? counts.reduce((a, b) => a + b, 0) / counts.length
      : 0;
    const variance = counts.length
      ? counts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) /
        counts.length
      : 0;
    const stdDev = Math.sqrt(variance);

    // Fairness score: 100 - normalized std deviation
    const maxPremiumShifts = Math.max(...counts, 1);
    const fairnessScore = Math.max(
      0,
      Math.round(100 - (stdDev / maxPremiumShifts) * 100),
    );

    return {
      locationId,
      from,
      to,
      totalPremiumShifts: premiumAssignments.length,
      fairnessScore,
      interpretation:
        fairnessScore >= 80
          ? 'Fair distribution'
          : fairnessScore >= 60
            ? 'Slightly uneven — review recommended'
            : 'Significant imbalance — redistribution needed',
      staff: Array.from(staffPremiumMap.entries())
        .map(([userId, data]) => ({
          userId,
          name: data.name,
          premiumShifts: data.premiumShifts,
          shiftDates: data.shiftDates,
          deviationFromMean: Math.round((data.premiumShifts - mean) * 10) / 10,
        }))
        .sort((a, b) => b.premiumShifts - a.premiumShifts),
    };
  }

  /** On-duty now: who is currently clocked into a shift at each location */
  async getOnDutyNow() {
    const now = new Date();

    const activeAssignments = await this.prisma.shiftAssignment.findMany({
      where: {
        status: 'ASSIGNED',
        shift: {
          startAt: { lte: now },
          endAt: { gte: now },
          isPublished: true,
        },
      },
      include: {
        user: { select: { id: true, name: true } },
        shift: {
          include: {
            location: { select: { id: true, name: true, timezone: true } },
            skill: true,
          },
        },
      },
    });

    // Group by location
    const locationMap = new Map<
      number,
      { locationName: string; timezone: string; staff: any[] }
    >();

    for (const a of activeAssignments) {
      const locId = a.shift.locationId;
      if (!locationMap.has(locId)) {
        locationMap.set(locId, {
          locationName: a.shift.location.name,
          timezone: a.shift.location.timezone,
          staff: [],
        });
      }
      locationMap.get(locId)!.staff.push({
        userId: a.userId,
        userName: a.user.name,
        skillName: a.shift.skill.name,
        shiftId: a.id,
        locationName: a.shift.location.name,
        shiftEnd: a.shift.endAt,
      });
    }

    return Array.from(locationMap.entries()).map(([locationId, data]) => ({
      locationId,
      ...data,
    }));
  }
}
