import {
  addDays,
  differenceInHours,
  differenceInMinutes,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
} from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

/**
 * Convert a local datetime string in a given timezone to UTC Date.
 * e.g. "2024-03-15T22:00:00" in "America/Los_Angeles" → UTC Date
 */
export function toUtc(localDateTimeStr: string, timezone: string): Date {
  return fromZonedTime(localDateTimeStr, timezone);
}

/**
 * Convert a UTC Date to a zoned Date object for display in a timezone.
 */
export function toZoned(utcDate: Date, timezone: string): Date {
  return toZonedTime(utcDate, timezone);
}

/**
 * Format a UTC date for display in a given IANA timezone.
 */
export function formatInTz(
  utcDate: Date,
  timezone: string,
  formatStr = 'yyyy-MM-dd HH:mm:ss zzz',
): string {
  return formatInTimeZone(utcDate, timezone, formatStr);
}

/**
 * Get the day of week (0=Sun … 6=Sat) for a UTC datetime in a given timezone.
 * Accounts for DST — e.g. a UTC midnight might be Saturday in Pacific time.
 */
export function getDayOfWeekInTz(utcDate: Date, timezone: string): number {
  const zoned = toZonedTime(utcDate, timezone);
  return zoned.getDay();
}

/**
 * Get the local date string (YYYY-MM-DD) for a UTC datetime in a given timezone.
 */
export function getLocalDateInTz(utcDate: Date, timezone: string): string {
  return formatInTimeZone(utcDate, timezone, 'yyyy-MM-dd');
}

/**
 * Check whether a UTC shift falls within an availability window.
 *
 * The Timezone Tangle:
 *  - Staff sets availability as "09:00–17:00"
 *  - That window is evaluated in the LOCATION's timezone (not the staff's)
 *  - So a shift at 10am Pacific = 1pm Eastern — the staff is "available" in Pacific
 *    but if they also have a shift at a Eastern location starting at 9am Eastern,
 *    that's 6am Pacific — outside their "09:00–17:00" window when evaluated in Pacific.
 *
 * @param shiftStartUtc UTC start of shift
 * @param shiftEndUtc   UTC end of shift
 * @param windowStartTime "HH:MM" string
 * @param windowEndTime   "HH:MM" string
 * @param locationTimezone IANA timezone of the shift's location
 */
export function isWithinAvailabilityWindow(
  shiftStartUtc: Date,
  shiftEndUtc: Date,
  windowStartTime: string,
  windowEndTime: string,
  locationTimezone: string,
): boolean {
  const localDate = getLocalDateInTz(shiftStartUtc, locationTimezone);

  // Build window boundaries as UTC datetimes for this specific date
  // Using fromZonedTime handles DST correctly for the specific calendar date
  const windowStart = fromZonedTime(
    `${localDate}T${windowStartTime}:00`,
    locationTimezone,
  );
  const windowEnd = fromZonedTime(
    `${localDate}T${windowEndTime}:00`,
    locationTimezone,
  );

  // Handle overnight windows (e.g. 22:00–02:00)
  const effectiveWindowEnd =
    windowEnd <= windowStart ? addDays(windowEnd, 1) : windowEnd;

  return (
    !isBefore(shiftStartUtc, windowStart) &&
    !isAfter(shiftEndUtc, effectiveWindowEnd)
  );
}

/**
 * Check if a recurring availability window applies on the date of a shift
 * (evaluated in the location's timezone to handle DST).
 */
export function recurringWindowAppliesOnShiftDate(
  shiftStartUtc: Date,
  windowDayOfWeek: number,
  locationTimezone: string,
): boolean {
  const shiftDayOfWeek = getDayOfWeekInTz(shiftStartUtc, locationTimezone);
  return shiftDayOfWeek === windowDayOfWeek;
}

/**
 * Calculate shift duration in hours (handles overnight shifts correctly).
 */
export function shiftDurationHours(startAt: Date, endAt: Date): number {
  return differenceInHours(endAt, startAt);
}

/**
 * Calculate shift duration in minutes.
 */
export function shiftDurationMinutes(startAt: Date, endAt: Date): number {
  return differenceInMinutes(endAt, startAt);
}

/**
 * Get the start of a week (Monday 00:00 UTC) for a given UTC date.
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of a week (Sunday 23:59:59 UTC) for a given UTC date.
 */
export function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/**
 * Determine if a shift qualifies as "premium" (Friday or Saturday evening).
 * Premium = starts on Fri/Sat between 17:00 and 23:59 in the location's timezone.
 */
export function isPremiumShift(startAt: Date, locationTimezone: string): boolean {
  const localDay = getDayOfWeekInTz(startAt, locationTimezone);
  const localHour = parseInt(
    formatInTimeZone(startAt, locationTimezone, 'H'),
    10,
  );
  // Friday=5, Saturday=6; 17:00+ is "evening"
  return (localDay === 5 || localDay === 6) && localHour >= 17;
}

/**
 * Get number of hours between end of one shift and start of next.
 */
export function hoursBetweenShifts(shift1End: Date, shift2Start: Date): number {
  return differenceInHours(shift2Start, shift1End);
}
