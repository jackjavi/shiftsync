import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import {
  buildPaginatedResponse,
  getPaginationParams,
} from '../shared/utils/pagination.utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date, tz = 'UTC') {
  try {
    return formatInTimeZone(d, tz, 'EEE, MMM d yyyy');
  } catch {
    return format(d, 'EEE, MMM d yyyy');
  }
}

function fmtTime(start: Date, end: Date, tz = 'UTC') {
  try {
    return `${formatInTimeZone(start, tz, 'h:mm a')} – ${formatInTimeZone(end, tz, 'h:mm a')} (${tz})`;
  } catch {
    return '';
  }
}

function weekRange(start: Date) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly email: EmailService,
  ) {}

  // ── Core ───────────────────────────────────────────────────────────────────

  async send(
    userId: number,
    type: NotificationType,
    title: string,
    body: string,
    metadata?: Record<string, any>,
  ) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, metadata },
    });
    this.events.emit('notification.created', { notification });
    return notification;
  }

  async findForUser(
    userId: number,
    params: { page?: number; limit?: number; unreadOnly?: boolean },
  ) {
    const { skip, take, page, limit } = getPaginationParams(params);
    const where: any = { userId };
    if (params.unreadOnly) where.isRead = false;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return {
      ...buildPaginatedResponse(notifications, total, page, limit),
      unreadCount,
    };
  }

  async markRead(id: number, userId: number) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: number) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  private async getUser(userId: number) {
    try {
      return await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
    } catch {
      return null;
    }
  }

  // ── Event Listeners ────────────────────────────────────────────────────────

  @OnEvent('assignment.created')
  async onAssignmentCreated(payload: { assignment: any; warnings: any[] }) {
    const { assignment } = payload;
    const tz = assignment.shift?.location?.timezone ?? 'UTC';
    const date = fmtDate(new Date(assignment.shift.startAt), tz);
    const time = fmtTime(
      new Date(assignment.shift.startAt),
      new Date(assignment.shift.endAt),
      tz,
    );
    const loc = assignment.shift.location?.name ?? 'your location';

    await this.send(
      assignment.userId,
      NotificationType.SHIFT_ASSIGNED,
      'New shift assigned',
      `You have been assigned a shift at ${loc} on ${date}`,
      { shiftId: assignment.shiftId },
    );

    const user = await this.getUser(assignment.userId);
    if (user)
      await this.email.sendShiftAssigned(
        user.email,
        user.name,
        loc,
        date,
        time,
      );
  }

  @OnEvent('shift.published')
  async onShiftPublished(payload: { shift: any; actorId: number }) {
    const { shift } = payload;
    const tz = shift.location?.timezone ?? 'UTC';
    for (const a of shift.assignments ?? []) {
      await this.send(
        a.userId,
        NotificationType.SCHEDULE_PUBLISHED,
        'Schedule published',
        `Your schedule for ${fmtDate(new Date(shift.startAt), tz)} has been published`,
        { shiftId: shift.id, locationId: shift.locationId },
      );
      const user = await this.getUser(a.userId);
      if (user)
        await this.email.sendSchedulePublished(
          user.email,
          user.name,
          shift.location?.name ?? '',
          weekRange(new Date(shift.startAt)),
        );
    }
  }

  @OnEvent('schedule.published')
  async onSchedulePublished(payload: {
    locationId: number;
    shiftIds: number[];
    actorId: number;
  }) {
    const assignments = await this.prisma.shiftAssignment.findMany({
      where: { shiftId: { in: payload.shiftIds }, status: 'ASSIGNED' },
      include: { shift: { include: { location: true } } },
    });

    const notified = new Set<number>();
    for (const a of assignments) {
      if (notified.has(a.userId)) continue;
      notified.add(a.userId);
      await this.send(
        a.userId,
        NotificationType.SCHEDULE_PUBLISHED,
        'Weekly schedule published',
        `Your schedule has been published at ${a.shift.location.name}`,
        { locationId: payload.locationId },
      );
      const user = await this.getUser(a.userId);
      if (user)
        await this.email.sendSchedulePublished(
          user.email,
          user.name,
          a.shift.location.name,
          weekRange(new Date(a.shift.startAt)),
        );
    }
  }

  @OnEvent('swap.created')
  async onSwapCreated(payload: { swapRequest: any }) {
    const { swapRequest } = payload;
    const tz = swapRequest.shift?.location?.timezone ?? 'UTC';
    const shiftDate = fmtDate(
      new Date(swapRequest.shift?.startAt ?? Date.now()),
      tz,
    );
    const locName = swapRequest.shift?.location?.name ?? 'your location';

    if (swapRequest.targetId) {
      await this.send(
        swapRequest.targetId,
        NotificationType.SWAP_REQUESTED,
        'Shift swap request',
        `${swapRequest.requester.name} has requested to swap shifts with you`,
        { swapId: swapRequest.id, shiftId: swapRequest.shiftId },
      );
      const target = await this.getUser(swapRequest.targetId);
      if (target)
        await this.email.sendSwapRequested(
          target.email,
          target.name,
          swapRequest.requester.name,
          shiftDate,
        );
    }

    if (swapRequest.type === 'DROP') {
      const locationId = swapRequest.shift?.locationId;

      const managers = await this.prisma.locationManager.findMany({
        where: { locationId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      for (const m of managers) {
        await this.send(
          m.userId,
          NotificationType.DROP_AVAILABLE,
          'Staff drop request',
          `${swapRequest.requester.name} has posted a shift for coverage`,
          { swapId: swapRequest.id, shiftId: swapRequest.shiftId },
        );
        await this.email.sendDropAvailable(
          m.user.email,
          m.user.name,
          swapRequest.requester.name,
          shiftDate,
          locName,
        );
      }

      if (locationId) {
        const certs = await this.prisma.staffCertification.findMany({
          where: {
            locationId,
            revokedAt: null,
            userId: { not: swapRequest.requesterId },
          },
          include: { user: { select: { id: true, name: true, email: true } } },
        });
        for (const cert of certs) {
          await this.send(
            cert.userId,
            NotificationType.DROP_AVAILABLE,
            'Shift available for pickup',
            `${swapRequest.requester.name} posted a shift on ${shiftDate} at ${locName} — log in to claim it`,
            { swapId: swapRequest.id, shiftId: swapRequest.shiftId },
          );
          await this.email.sendDropAvailable(
            cert.user.email,
            cert.user.name,
            swapRequest.requester.name,
            shiftDate,
            locName,
          );
        }
      }
    }
  }

  @OnEvent('swap.accepted')
  async onSwapAccepted(payload: { swap: any }) {
    const { swap } = payload;
    const tz = swap.shift?.location?.timezone ?? 'UTC';
    const shiftDate = fmtDate(new Date(swap.shift?.startAt ?? Date.now()), tz);

    await this.send(
      swap.requesterId,
      NotificationType.SWAP_ACCEPTED,
      'Swap request accepted',
      `${swap.target?.name} accepted your swap request. Awaiting manager approval.`,
      { swapId: swap.id },
    );
    const requester = await this.getUser(swap.requesterId);
    if (requester) {
      await this.email.send(
        requester.email,
        'ShiftSync — Swap accepted',
        `Hi ${requester.name},\n\n${swap.target?.name ?? 'A colleague'} accepted your swap request for ${shiftDate}.\nAwaiting manager approval.\n\n— ShiftSync`,
      );
    }

    const managers = await this.prisma.locationManager.findMany({
      where: { locationId: swap.shift?.locationId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    for (const m of managers) {
      await this.send(
        m.userId,
        NotificationType.SWAP_REQUESTED,
        'Swap needs approval',
        `A swap between ${swap.requester?.name} and ${swap.target?.name} needs your approval`,
        { swapId: swap.id },
      );
      await this.email.send(
        m.user.email,
        'ShiftSync — Swap awaiting approval',
        `Hi ${m.user.name},\n\nA swap between ${swap.requester?.name} and ${swap.target?.name} on ${shiftDate} awaits your approval.\n\nLog in to ShiftSync.\n\n— ShiftSync`,
      );
    }
  }

  @OnEvent('swap.approved')
  async onSwapApproved(payload: { swap: any }) {
    const { swap } = payload;
    const tz = swap.shift?.location?.timezone ?? 'UTC';
    const shiftDate = fmtDate(new Date(swap.shift?.startAt ?? Date.now()), tz);

    await this.send(
      swap.requesterId,
      NotificationType.SWAP_APPROVED,
      'Swap approved',
      'Your shift swap has been approved by the manager',
      { swapId: swap.id },
    );
    const requester = await this.getUser(swap.requesterId);
    if (requester)
      await this.email.sendSwapApproved(
        requester.email,
        requester.name,
        true,
        shiftDate,
      );

    if (swap.targetId) {
      await this.send(
        swap.targetId,
        NotificationType.SWAP_APPROVED,
        'Shift assigned via swap',
        'The swap was approved — the shift is now on your schedule',
        { swapId: swap.id },
      );
      const target = await this.getUser(swap.targetId);
      if (target)
        await this.email.sendSwapApproved(
          target.email,
          target.name,
          true,
          shiftDate,
        );
    }
  }

  @OnEvent('swap.rejected')
  async onSwapRejected(payload: { swap: any }) {
    const { swap } = payload;
    const tz = swap.shift?.location?.timezone ?? 'UTC';
    const shiftDate = fmtDate(new Date(swap.shift?.startAt ?? Date.now()), tz);
    await this.send(
      swap.requesterId,
      NotificationType.SWAP_REJECTED,
      'Swap request rejected',
      'Your shift swap request was rejected',
      { swapId: swap.id },
    );
    const requester = await this.getUser(swap.requesterId);
    if (requester)
      await this.email.sendSwapApproved(
        requester.email,
        requester.name,
        false,
        shiftDate,
      );
  }

  @OnEvent('swap.auto_cancelled')
  async onSwapAutoCancelled(payload: { swap: any; reason: string }) {
    await this.send(
      payload.swap.requesterId,
      NotificationType.SWAP_CANCELLED,
      'Swap request cancelled',
      `Your swap request was automatically cancelled: ${payload.reason}`,
      { swapId: payload.swap.id },
    );
  }

  @OnEvent('overtime.warning')
  async onOvertimeWarning(payload: {
    userId: number;
    scheduledHours: number;
    limitHours: number;
    weekStart: string;
  }) {
    await this.send(
      payload.userId,
      NotificationType.OVERTIME_WARNING,
      'Overtime warning',
      `You are scheduled for ${payload.scheduledHours}h this week, approaching the ${payload.limitHours}h limit`,
      {
        scheduledHours: payload.scheduledHours,
        limitHours: payload.limitHours,
      },
    );
    const user = await this.getUser(payload.userId);
    if (user)
      await this.email.sendOvertimeWarning(
        user.email,
        user.name,
        payload.scheduledHours,
        payload.limitHours,
      );
  }
}
