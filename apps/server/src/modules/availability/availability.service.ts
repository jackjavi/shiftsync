import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AvailabilityType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  isWithinAvailabilityWindow,
  recurringWindowAppliesOnShiftDate,
} from '../shared/utils/timezone.utils';
import {
  CreateAvailabilityDto,
  UpdateAvailabilityDto,
} from './availability.schemas';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateAvailabilityDto) {
    return this.prisma.availabilityWindow.create({
      data: {
        userId,
        type: dto.type,
        dayOfWeek: dto.dayOfWeek,
        date: dto.date ? new Date(dto.date) : undefined,
        startTime: dto.startTime,
        endTime: dto.endTime,
        isAvailable: dto.isAvailable,
        note: dto.note,
      },
    });
  }

  async findForUser(userId: number) {
    return this.prisma.availabilityWindow.findMany({
      where: { userId },
      orderBy: [{ type: 'asc' }, { dayOfWeek: 'asc' }],
    });
  }

  async update(id: number, userId: number, dto: UpdateAvailabilityDto) {
    const window = await this.prisma.availabilityWindow.findUnique({ where: { id } });
    if (!window) throw new NotFoundException(`Availability window #${id} not found`);
    if (window.userId !== userId) throw new ForbiddenException('Cannot modify another user\'s availability');

    return this.prisma.availabilityWindow.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: number, userId: number) {
    const window = await this.prisma.availabilityWindow.findUnique({ where: { id } });
    if (!window) throw new NotFoundException(`Availability window #${id} not found`);
    if (window.userId !== userId) throw new ForbiddenException('Cannot modify another user\'s availability');

    return this.prisma.availabilityWindow.delete({ where: { id } });
  }

  /**
   * Core availability check used by SchedulingService.
   *
   * The Timezone Tangle resolution:
   * Staff sets "09:00–17:00" as their available hours.
   * This window is evaluated in the LOCATION's timezone.
   * So "9am" means "9am at the location" — not 9am wherever the staff member lives.
   *
   * If a staff member works at two locations in different timezones:
   * - Pacific location shift at 10am PT → check if 10am falls in their 9-5 window ✓
   * - Eastern location shift at 10am ET (= 7am PT) → check if 10am ET falls in their 9-5 window ✓
   *   (Note: the window is always evaluated in the LOCATION's timezone, so 10am ET is within 9-5)
   * - Eastern location shift at 8am ET (= 5am PT) → 8am ET is within 9-5 window ✓
   *   BUT if staff also has a Pacific shift ending at 5pm PT (8pm ET) there's still 10h rest to check.
   *
   * @param userId Staff member
   * @param shiftStartUtc UTC shift start
   * @param shiftEndUtc UTC shift end
   * @param locationTimezone IANA timezone of the shift location
   */
  async isUserAvailable(
    userId: number,
    shiftStartUtc: Date,
    shiftEndUtc: Date,
    locationTimezone: string,
  ): Promise<{ available: boolean; reason?: string }> {
    const windows = await this.prisma.availabilityWindow.findMany({
      where: { userId },
    });

    if (windows.length === 0) {
      // No availability set = available anytime (open availability)
      return { available: true };
    }

    // Check ONE_OFF windows first — they override recurring for specific dates
    const oneOffWindows = windows.filter((w) => w.type === AvailabilityType.ONE_OFF);
    const recurringWindows = windows.filter((w) => w.type === AvailabilityType.RECURRING);

    // Find any ONE_OFF window matching the shift's date (in location timezone)
    const matchingOneOff = oneOffWindows.find((w) => {
      if (!w.date) return false;
      // Compare date strings in location timezone
      const windowDate = w.date.toISOString().split('T')[0];
      const shiftDate = this.getDateInTz(shiftStartUtc, locationTimezone);
      return windowDate === shiftDate;
    });

    if (matchingOneOff) {
      if (!matchingOneOff.isAvailable) {
        return {
          available: false,
          reason: `Staff has marked ${matchingOneOff.date?.toISOString().split('T')[0]} as unavailable`,
        };
      }
      const withinWindow = isWithinAvailabilityWindow(
        shiftStartUtc,
        shiftEndUtc,
        matchingOneOff.startTime,
        matchingOneOff.endTime,
        locationTimezone,
      );
      if (!withinWindow) {
        return {
          available: false,
          reason: `Shift falls outside one-off availability window (${matchingOneOff.startTime}–${matchingOneOff.endTime})`,
        };
      }
      return { available: true };
    }

    // Check RECURRING windows for the day of week
    const matchingRecurring = recurringWindows.filter((w) => {
      if (w.dayOfWeek === null || w.dayOfWeek === undefined) return false;
      return recurringWindowAppliesOnShiftDate(shiftStartUtc, w.dayOfWeek, locationTimezone);
    });

    if (matchingRecurring.length === 0) {
      // No recurring window for this day = unavailable by default
      return {
        available: false,
        reason: 'No availability set for this day of the week',
      };
    }

    // Check if any recurring window covers the shift time
    for (const window of matchingRecurring) {
      if (!window.isAvailable) {
        return {
          available: false,
          reason: `Staff is marked unavailable for this recurring window`,
        };
      }
      const withinWindow = isWithinAvailabilityWindow(
        shiftStartUtc,
        shiftEndUtc,
        window.startTime,
        window.endTime,
        locationTimezone,
      );
      if (withinWindow) return { available: true };
    }

    return {
      available: false,
      reason: `Shift falls outside recurring availability windows`,
    };
  }

  private getDateInTz(utcDate: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(utcDate);
  }
}
