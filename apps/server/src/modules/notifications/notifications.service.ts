import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  buildPaginatedResponse,
  getPaginationParams,
} from '../shared/utils/pagination.utils';

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit() {
    // All domain events are wired here — single place for all notification logic
  }

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

    // Emit to WebSocket gateway for real-time delivery
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

    return { ...buildPaginatedResponse(notifications, total, page, limit), unreadCount };
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

  // ── Event Listeners ─────────────────────────────────────────────────────────

  @OnEvent('assignment.created')
  async onAssignmentCreated(payload: { assignment: any; warnings: any[] }) {
    const { assignment } = payload;
    await this.send(
      assignment.userId,
      NotificationType.SHIFT_ASSIGNED,
      'New shift assigned',
      `You have been assigned a shift at ${assignment.shift.location.name} on ${new Date(assignment.shift.startAt).toLocaleDateString()}`,
      { shiftId: assignment.shiftId },
    );
  }

  @OnEvent('shift.published')
  async onShiftPublished(payload: { shift: any; actorId: number }) {
    const { shift } = payload;
    for (const assignment of shift.assignments ?? []) {
      await this.send(
        assignment.userId,
        NotificationType.SCHEDULE_PUBLISHED,
        'Schedule published',
        `Your schedule for ${new Date(shift.startAt).toLocaleDateString()} has been published`,
        { shiftId: shift.id, locationId: shift.locationId },
      );
    }
  }

  @OnEvent('schedule.published')
  async onSchedulePublished(payload: { locationId: number; shiftIds: number[]; actorId: number }) {
    // Find all staff assigned to these shifts and notify them
    const assignments = await this.prisma.shiftAssignment.findMany({
      where: { shiftId: { in: payload.shiftIds }, status: 'ASSIGNED' },
      include: { shift: { include: { location: true } } },
    });

    const notified = new Set<number>();
    for (const a of assignments) {
      if (!notified.has(a.userId)) {
        await this.send(
          a.userId,
          NotificationType.SCHEDULE_PUBLISHED,
          'Weekly schedule published',
          `Your schedule has been published at ${a.shift.location.name}`,
          { locationId: payload.locationId },
        );
        notified.add(a.userId);
      }
    }
  }

  @OnEvent('swap.created')
  async onSwapCreated(payload: { swapRequest: any }) {
    const { swapRequest } = payload;

    if (swapRequest.targetId) {
      // Notify target of swap request
      await this.send(
        swapRequest.targetId,
        NotificationType.SWAP_REQUESTED,
        'Shift swap request',
        `${swapRequest.requester.name} has requested to swap shifts with you`,
        { swapId: swapRequest.id, shiftId: swapRequest.shiftId },
      );
    }

    // Notify location managers for drop requests
    if (swapRequest.type === 'DROP') {
      const managers = await this.prisma.locationManager.findMany({
        where: { locationId: swapRequest.shift.locationId },
      });
      for (const m of managers) {
        await this.send(
          m.userId,
          NotificationType.DROP_AVAILABLE,
          'Staff drop request',
          `${swapRequest.requester.name} has posted a shift for coverage`,
          { swapId: swapRequest.id, shiftId: swapRequest.shiftId },
        );
      }
    }
  }

  @OnEvent('swap.accepted')
  async onSwapAccepted(payload: { swap: any }) {
    await this.send(
      payload.swap.requesterId,
      NotificationType.SWAP_ACCEPTED,
      'Swap request accepted',
      `${payload.swap.target?.name} has accepted your swap request. Awaiting manager approval.`,
      { swapId: payload.swap.id },
    );

    // Also notify managers
    const managers = await this.prisma.locationManager.findMany({
      where: { locationId: payload.swap.shift.locationId },
    });
    for (const m of managers) {
      await this.send(
        m.userId,
        NotificationType.SWAP_REQUESTED,
        'Swap needs approval',
        `A shift swap between ${payload.swap.requester.name} and ${payload.swap.target?.name} needs your approval`,
        { swapId: payload.swap.id },
      );
    }
  }

  @OnEvent('swap.approved')
  async onSwapApproved(payload: { swap: any }) {
    await this.send(
      payload.swap.requesterId,
      NotificationType.SWAP_APPROVED,
      'Swap approved',
      'Your shift swap has been approved by the manager',
      { swapId: payload.swap.id },
    );
    if (payload.swap.targetId) {
      await this.send(
        payload.swap.targetId,
        NotificationType.SWAP_APPROVED,
        'Shift assigned via swap',
        'A shift swap has been approved — the shift is now on your schedule',
        { swapId: payload.swap.id },
      );
    }
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
}
