import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  getWeekEnd,
  getWeekStart,
  shiftDurationHours,
} from '../shared/utils/timezone.utils';

const WEEKLY_WARN_HOURS = 35;
const WEEKLY_HARD_BLOCK_HOURS = 40;

@Injectable()
export class OvertimeService {
  constructor(private readonly prisma: PrismaService) {}

  async getWeeklyHours(userId: number, weekStartDate: string) {
    const weekStart = getWeekStart(new Date(weekStartDate));
    const weekEnd = getWeekEnd(weekStart);

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        userId,
        status: 'ASSIGNED',
        shift: { startAt: { gte: weekStart, lte: weekEnd } },
      },
      include: { shift: { include: { location: { select: { name: true, timezone: true } } } } },
    });

    const dailyBreakdown: Record<string, number> = {};
    let totalHours = 0;

    for (const a of assignments) {
      const hours = shiftDurationHours(a.shift.startAt, a.shift.endAt);
      const dateKey = a.shift.startAt.toISOString().split('T')[0];
      dailyBreakdown[dateKey] = (dailyBreakdown[dateKey] ?? 0) + hours;
      totalHours += hours;
    }

    return {
      userId,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalHours: Math.round(totalHours * 10) / 10,
      overtimeHours: Math.max(0, totalHours - WEEKLY_HARD_BLOCK_HOURS),
      isApproachingOvertime: totalHours > WEEKLY_WARN_HOURS,
      isOvertime: totalHours > WEEKLY_HARD_BLOCK_HOURS,
      dailyBreakdown,
      assignments: assignments.map((a) => ({
        shiftId: a.shiftId,
        date: a.shift.startAt.toISOString(),
        hours: Math.round(shiftDurationHours(a.shift.startAt, a.shift.endAt) * 10) / 10,
        location: a.shift.location.name,
        isOvertimeContributor: totalHours > WEEKLY_HARD_BLOCK_HOURS,
      })),
    };
  }

  async getLocationDashboard(locationId: number, weekStartDate: string) {
    const weekStart = getWeekStart(new Date(weekStartDate));
    const weekEnd = getWeekEnd(weekStart);

    // Get all staff scheduled at this location this week
    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        status: 'ASSIGNED',
        shift: {
          locationId,
          startAt: { gte: weekStart, lte: weekEnd },
        },
      },
      include: {
        user: { select: { id: true, name: true } },
        shift: true,
      },
    });

    // Group by user and calculate total hours
    const staffMap = new Map<number, { name: string; hours: number; shifts: any[] }>();

    for (const a of assignments) {
      const hours = shiftDurationHours(a.shift.startAt, a.shift.endAt);
      if (!staffMap.has(a.userId)) {
        staffMap.set(a.userId, { name: a.user.name, hours: 0, shifts: [] });
      }
      const entry = staffMap.get(a.userId)!;
      entry.hours += hours;
      entry.shifts.push({
        shiftId: a.shiftId,
        date: a.shift.startAt.toISOString(),
        hours,
      });
    }

    const staffSummaries = Array.from(staffMap.entries()).map(([userId, data]) => ({
      userId,
      name: data.name,
      scheduledHours: Math.round(data.hours * 10) / 10,
      isApproachingOvertime: data.hours > WEEKLY_WARN_HOURS,
      isOvertime: data.hours > WEEKLY_HARD_BLOCK_HOURS,
      overtimeHours: Math.max(0, Math.round((data.hours - WEEKLY_HARD_BLOCK_HOURS) * 10) / 10),
      shifts: data.shifts,
    }));

    const totalProjectedOvertimeHours = staffSummaries.reduce(
      (sum, s) => sum + s.overtimeHours,
      0,
    );

    return {
      locationId,
      weekStart: weekStart.toISOString(),
      staffCount: staffSummaries.length,
      staffApproachingOvertime: staffSummaries.filter((s) => s.isApproachingOvertime).length,
      staffInOvertime: staffSummaries.filter((s) => s.isOvertime).length,
      totalProjectedOvertimeHours: Math.round(totalProjectedOvertimeHours * 10) / 10,
      staff: staffSummaries.sort((a, b) => b.scheduledHours - a.scheduledHours),
    };
  }
}
