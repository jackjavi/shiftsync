import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserRole } from '@prisma/client';

import { AvailabilityService } from '../availability/availability.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConstraintRule,
  ConstraintViolation,
  ConstraintWarning,
  StaffSuggestion,
  ValidationResult,
} from '../shared/types/shared.types';
import {
  getWeekEnd,
  getWeekStart,
  hoursBetweenShifts,
  shiftDurationHours,
} from '../shared/utils/timezone.utils';

const MIN_REST_HOURS = 10;
const DAILY_WARN_HOURS = 8;
const DAILY_HARD_BLOCK_HOURS = 12;
const WEEKLY_WARN_HOURS = 35;
const WEEKLY_HARD_BLOCK_HOURS = 40;
const CONSECUTIVE_DAY_WARN = 6;
const CONSECUTIVE_DAY_OVERRIDE_REQUIRED = 7;
const MAX_PENDING_SWAPS = 3;

@Injectable()
export class SchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Full constraint validation without committing. Returns violations, warnings, suggestions.
   */
  async validateAssignment(
    userId: number,
    shiftId: number,
  ): Promise<ValidationResult> {
    const violations: ConstraintViolation[] = [];
    const warnings: ConstraintWarning[] = [];

    const [user, shift] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          skills: true,
          certifications: { where: { revokedAt: null } },
        },
      }),
      this.prisma.shift.findUnique({
        where: { id: shiftId },
        include: { location: true, skill: true, assignments: { where: { status: 'ASSIGNED' } } },
      }),
    ]);

    if (!user) throw new NotFoundException(`User #${userId} not found`);
    if (!shift) throw new NotFoundException(`Shift #${shiftId} not found`);

    // ── 1. Skill match ─────────────────────────────────────────────────────────
    const hasSkill = user.skills.some((s) => s.skillId === shift.skillId);
    if (!hasSkill) {
      violations.push({
        rule: ConstraintRule.SKILL_MISMATCH,
        message: `${user.name} does not have the required skill: ${shift.skill.name}`,
        details: { requiredSkill: shift.skill.name, userId },
      });
    }

    // ── 2. Location certification ───────────────────────────────────────────────
    const isCertified = user.certifications.some(
      (c) => c.locationId === shift.locationId,
    );
    if (!isCertified) {
      violations.push({
        rule: ConstraintRule.CERTIFICATION_MISSING,
        message: `${user.name} is not certified to work at ${shift.location.name}`,
        details: { locationId: shift.locationId, locationName: shift.location.name },
      });
    }

    // ── 3. Headcount check ─────────────────────────────────────────────────────
    const alreadyAssigned = shift.assignments.some((a) => a.userId === userId);
    if (alreadyAssigned) {
      violations.push({
        rule: ConstraintRule.DOUBLE_BOOKING,
        message: `${user.name} is already assigned to this shift`,
      });
    }

    if (shift.assignments.length >= shift.headcount && !alreadyAssigned) {
      violations.push({
        rule: ConstraintRule.HEADCOUNT_FULL,
        message: `Shift is already fully staffed (${shift.headcount}/${shift.headcount})`,
      });
    }

    // ── 4. Double booking — overlapping shifts at ANY location ─────────────────
    const overlapping = await this.prisma.shiftAssignment.findFirst({
      where: {
        userId,
        status: 'ASSIGNED',
        shift: {
          id: { not: shiftId },
          AND: [
            { startAt: { lt: shift.endAt } },
            { endAt: { gt: shift.startAt } },
          ],
        },
      },
      include: { shift: { include: { location: true } } },
    });

    if (overlapping) {
      violations.push({
        rule: ConstraintRule.DOUBLE_BOOKING,
        message: `${user.name} already has an overlapping shift at ${overlapping.shift.location.name} (${overlapping.shift.startAt.toISOString()} – ${overlapping.shift.endAt.toISOString()})`,
        details: {
          conflictingShiftId: overlapping.shiftId,
          conflictingLocation: overlapping.shift.location.name,
        },
      });
    }

    // ── 5. Rest period (10h minimum between shifts) ────────────────────────────
    const adjacentShift = await this.prisma.shiftAssignment.findFirst({
      where: {
        userId,
        status: 'ASSIGNED',
        shift: {
          id: { not: shiftId },
          OR: [
            // Previous shift ending too close to this shift start
            {
              endAt: {
                gt: new Date(shift.startAt.getTime() - MIN_REST_HOURS * 60 * 60 * 1000),
                lte: shift.startAt,
              },
            },
            // Next shift starting too soon after this shift ends
            {
              startAt: {
                gte: shift.endAt,
                lt: new Date(shift.endAt.getTime() + MIN_REST_HOURS * 60 * 60 * 1000),
              },
            },
          ],
        },
      },
      include: { shift: true },
    });

    if (adjacentShift) {
      const gap = adjacentShift.shift.endAt <= shift.startAt
        ? hoursBetweenShifts(adjacentShift.shift.endAt, shift.startAt)
        : hoursBetweenShifts(shift.endAt, adjacentShift.shift.startAt);

      violations.push({
        rule: ConstraintRule.REST_PERIOD,
        message: `${user.name} would only have ${gap.toFixed(1)} hours of rest between shifts (minimum ${MIN_REST_HOURS}h required)`,
        details: { gapHours: gap, minimumRequired: MIN_REST_HOURS, conflictingShiftId: adjacentShift.shiftId },
      });
    }

    // ── 6. Availability check ──────────────────────────────────────────────────
    const availabilityCheck = await this.availabilityService.isUserAvailable(
      userId,
      shift.startAt,
      shift.endAt,
      shift.location.timezone,
    );

    if (!availabilityCheck.available) {
      violations.push({
        rule: ConstraintRule.UNAVAILABLE,
        message: availabilityCheck.reason ?? `${user.name} is not available during this shift`,
        details: { timezone: shift.location.timezone },
      });
    }

    // ── 7. Daily hours check ───────────────────────────────────────────────────
    const shiftDate = shift.startAt.toISOString().split('T')[0];
    const dayStart = new Date(`${shiftDate}T00:00:00.000Z`);
    const dayEnd = new Date(`${shiftDate}T23:59:59.999Z`);

    const dayAssignments = await this.prisma.shiftAssignment.findMany({
      where: {
        userId,
        status: 'ASSIGNED',
        shift: {
          id: { not: shiftId },
          startAt: { gte: dayStart, lte: dayEnd },
        },
      },
      include: { shift: true },
    });

    const existingDayHours = dayAssignments.reduce(
      (sum, a) => sum + shiftDurationHours(a.shift.startAt, a.shift.endAt),
      0,
    );
    const newShiftHours = shiftDurationHours(shift.startAt, shift.endAt);
    const projectedDayHours = existingDayHours + newShiftHours;

    if (projectedDayHours > DAILY_HARD_BLOCK_HOURS) {
      violations.push({
        rule: ConstraintRule.DAILY_HOURS_EXCEEDED,
        message: `${user.name} would work ${projectedDayHours.toFixed(1)} hours on this day (max ${DAILY_HARD_BLOCK_HOURS}h)`,
        details: { projectedHours: projectedDayHours, limit: DAILY_HARD_BLOCK_HOURS },
      });
    } else if (projectedDayHours > DAILY_WARN_HOURS) {
      warnings.push({
        rule: ConstraintRule.DAILY_HOURS_EXCEEDED,
        message: `${user.name} will work ${projectedDayHours.toFixed(1)} hours on this day (warning threshold: ${DAILY_WARN_HOURS}h)`,
        details: { projectedHours: projectedDayHours, warnThreshold: DAILY_WARN_HOURS },
      });
    }

    // ── 8. Weekly hours check ──────────────────────────────────────────────────
    const weekStart = getWeekStart(shift.startAt);
    const weekEnd = getWeekEnd(weekStart);

    const weekAssignments = await this.prisma.shiftAssignment.findMany({
      where: {
        userId,
        status: 'ASSIGNED',
        shift: {
          id: { not: shiftId },
          startAt: { gte: weekStart, lte: weekEnd },
        },
      },
      include: { shift: true },
    });

    const existingWeekHours = weekAssignments.reduce(
      (sum, a) => sum + shiftDurationHours(a.shift.startAt, a.shift.endAt),
      0,
    );
    const projectedWeekHours = existingWeekHours + newShiftHours;

    if (projectedWeekHours > WEEKLY_HARD_BLOCK_HOURS) {
      violations.push({
        rule: ConstraintRule.WEEKLY_HOURS_EXCEEDED,
        message: `${user.name} would work ${projectedWeekHours.toFixed(1)} hours this week (max ${WEEKLY_HARD_BLOCK_HOURS}h). Requires override.`,
        details: { projectedHours: projectedWeekHours, limit: WEEKLY_HARD_BLOCK_HOURS },
      });
    } else if (projectedWeekHours > WEEKLY_WARN_HOURS) {
      warnings.push({
        rule: ConstraintRule.WEEKLY_HOURS_EXCEEDED,
        message: `${user.name} will work ${projectedWeekHours.toFixed(1)} hours this week (approaching ${WEEKLY_HARD_BLOCK_HOURS}h overtime threshold)`,
        details: { projectedHours: projectedWeekHours, warnThreshold: WEEKLY_WARN_HOURS },
      });
    }

    // ── 9. Consecutive days check ──────────────────────────────────────────────
    const consecutiveDays = await this.countConsecutiveDays(userId, shift.startAt);
    if (consecutiveDays + 1 >= CONSECUTIVE_DAY_OVERRIDE_REQUIRED) {
      violations.push({
        rule: ConstraintRule.CONSECUTIVE_DAYS,
        message: `${user.name} would work their ${consecutiveDays + 1}th consecutive day. Manager override with documented reason required.`,
        details: { consecutiveDays: consecutiveDays + 1, overrideRequired: true },
      });
    } else if (consecutiveDays + 1 >= CONSECUTIVE_DAY_WARN) {
      warnings.push({
        rule: ConstraintRule.CONSECUTIVE_DAYS,
        message: `${user.name} would work their ${consecutiveDays + 1}th consecutive day`,
        details: { consecutiveDays: consecutiveDays + 1 },
      });
    }

    // ── Build suggestions if there are violations ─────────────────────────────
    let suggestions: StaffSuggestion[] | undefined;
    if (violations.length > 0) {
      suggestions = await this.suggestAlternatives(shiftId, userId);
    }

    return {
      isValid: violations.length === 0,
      violations,
      warnings,
      suggestions,
    };
  }

  /**
   * Assign a staff member to a shift with full constraint checking.
   * Uses a DB transaction to prevent race conditions (Simultaneous Assignment scenario).
   */
  async assign(
    userId: number,
    shiftId: number,
    actorId: number,
    forceOverride = false,
  ) {
    // Pre-validate outside transaction first (fast path)
    const validation = await this.validateAssignment(userId, shiftId);

    // Hard violations block the assignment entirely
    const hardViolations = validation.violations.filter(
      (v) => v.rule !== ConstraintRule.CONSECUTIVE_DAYS && v.rule !== ConstraintRule.WEEKLY_HOURS_EXCEEDED,
    );

    if (hardViolations.length > 0) {
      throw new BadRequestException({
        message: 'Assignment violates scheduling constraints',
        violations: validation.violations,
        warnings: validation.warnings,
        suggestions: validation.suggestions,
      });
    }

    // Overtime violations require explicit override
    const overtimeViolations = validation.violations.filter(
      (v) => v.rule === ConstraintRule.WEEKLY_HOURS_EXCEEDED || v.rule === ConstraintRule.CONSECUTIVE_DAYS,
    );

    if (overtimeViolations.length > 0 && !forceOverride) {
      throw new BadRequestException({
        message: 'Assignment requires manager override',
        violations: validation.violations,
        warnings: validation.warnings,
        requiresOverride: true,
      });
    }

    // Transactional assignment — prevents simultaneous double-booking
    const assignment = await this.prisma.$transaction(async (tx) => {
      // Re-check inside transaction to catch race conditions
      const existingAssignment = await tx.shiftAssignment.findFirst({
        where: {
          userId,
          status: 'ASSIGNED',
          shift: {
            AND: [
              { startAt: { lt: (await tx.shift.findUnique({ where: { id: shiftId } }))!.endAt } },
              { endAt: { gt: (await tx.shift.findUnique({ where: { id: shiftId } }))!.startAt } },
            ],
          },
        },
      });

      if (existingAssignment) {
        // Emit conflict event for real-time notification
        this.events.emit('assignment.conflict', {
          userId,
          shiftId,
          actorId,
          conflictingAssignmentId: existingAssignment.id,
        });
        throw new BadRequestException('Concurrent assignment conflict detected');
      }

      return tx.shiftAssignment.create({
        data: { shiftId, userId, assignedBy: actorId },
        include: {
          shift: { include: { location: true, skill: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });
    });

    this.events.emit('assignment.created', {
      assignment,
      actorId,
      warnings: validation.warnings,
    });

    return { assignment, warnings: validation.warnings };
  }

  async unassign(assignmentId: number, actorId: number) {
    const assignment = await this.prisma.shiftAssignment.findUnique({
      where: { id: assignmentId },
      include: { shift: true, user: { select: { id: true, name: true } } },
    });

    if (!assignment) throw new NotFoundException(`Assignment #${assignmentId} not found`);

    await this.prisma.shiftAssignment.update({
      where: { id: assignmentId },
      data: { status: 'DROPPED' },
    });

    this.events.emit('assignment.removed', { assignment, actorId });
    return { removed: true };
  }

  /**
   * What-if analysis: project hours impact before committing an assignment.
   */
  async whatIfAnalysis(userId: number, shiftId: number) {
    const shift = await this.prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException(`Shift #${shiftId} not found`);

    const weekStart = getWeekStart(shift.startAt);
    const weekEnd = getWeekEnd(weekStart);

    const weekAssignments = await this.prisma.shiftAssignment.findMany({
      where: {
        userId,
        status: 'ASSIGNED',
        shift: { startAt: { gte: weekStart, lte: weekEnd } },
      },
      include: { shift: true },
    });

    const currentWeekHours = weekAssignments.reduce(
      (sum, a) => sum + shiftDurationHours(a.shift.startAt, a.shift.endAt),
      0,
    );

    const newShiftHours = shiftDurationHours(shift.startAt, shift.endAt);
    const projectedWeekHours = currentWeekHours + newShiftHours;

    return {
      currentWeekHours: Math.round(currentWeekHours * 10) / 10,
      newShiftHours: Math.round(newShiftHours * 10) / 10,
      projectedWeekHours: Math.round(projectedWeekHours * 10) / 10,
      wouldTriggerOvertimeWarning: projectedWeekHours > WEEKLY_WARN_HOURS,
      wouldExceedOvertimeLimit: projectedWeekHours > WEEKLY_HARD_BLOCK_HOURS,
      overtimeHours: Math.max(0, projectedWeekHours - WEEKLY_HARD_BLOCK_HOURS),
    };
  }

  /**
   * Find qualified staff who could cover a given shift.
   * Used for Sunday Night Chaos scenario.
   */
  async suggestAlternatives(
    shiftId: number,
    excludeUserId?: number,
  ): Promise<StaffSuggestion[]> {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: { location: true, skill: true },
    });
    if (!shift) return [];

    // Find all staff with correct skill + certification
    const candidates = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: UserRole.STAFF,
        id: excludeUserId ? { not: excludeUserId } : undefined,
        skills: { some: { skillId: shift.skillId } },
        certifications: {
          some: { locationId: shift.locationId, revokedAt: null },
        },
        // Not already assigned to an overlapping shift
        assignments: {
          none: {
            status: 'ASSIGNED',
            shift: {
              AND: [
                { startAt: { lt: shift.endAt } },
                { endAt: { gt: shift.startAt } },
              ],
            },
          },
        },
      },
      include: {
        availabilityWindows: true,
        assignments: {
          where: { status: 'ASSIGNED' },
          include: { shift: true },
        },
      },
    });

    const suggestions: StaffSuggestion[] = [];

    for (const candidate of candidates) {
      const availabilityCheck = await this.availabilityService.isUserAvailable(
        candidate.id,
        shift.startAt,
        shift.endAt,
        shift.location.timezone,
      );

      if (!availabilityCheck.available) continue;

      // Check rest period
      const hasRestViolation = candidate.assignments.some((a) => {
        const prevGap = hoursBetweenShifts(a.shift.endAt, shift.startAt);
        const nextGap = hoursBetweenShifts(shift.endAt, a.shift.startAt);
        return (
          (a.shift.endAt <= shift.startAt && prevGap < MIN_REST_HOURS) ||
          (a.shift.startAt >= shift.endAt && nextGap < MIN_REST_HOURS)
        );
      });

      if (hasRestViolation) continue;

      suggestions.push({
        userId: candidate.id,
        userName: candidate.name,
        reason: `Has ${shift.skill.name} skill, certified at ${shift.location.name}, available`,
      });
    }

    return suggestions;
  }

  /**
   * Count consecutive days worked leading up to (but not including) a given date.
   * Decision: any shift on a day counts as a worked day regardless of duration.
   */
  private async countConsecutiveDays(
    userId: number,
    referenceDate: Date,
  ): Promise<number> {
    let count = 0;
    const checkDate = new Date(referenceDate);
    checkDate.setUTCDate(checkDate.getUTCDate() - 1); // Start from day before shift

    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(checkDate);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(checkDate);
      dayEnd.setUTCHours(23, 59, 59, 999);

      const worked = await this.prisma.shiftAssignment.findFirst({
        where: {
          userId,
          status: 'ASSIGNED',
          shift: { startAt: { gte: dayStart, lte: dayEnd } },
        },
      });

      if (!worked) break;
      count++;
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    }

    return count;
  }
}
