import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SwapStatus, SwapType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { SchedulingService } from '../scheduling/scheduling.service';

const MAX_PENDING_SWAPS = 3;
const DROP_EXPIRY_HOURS_BEFORE_SHIFT = 24;

@Injectable()
export class SwapsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
    private readonly events: EventEmitter2,
  ) {}

  async createSwap(
    requesterId: number,
    shiftId: number,
    targetId: number | null,
    type: SwapType,
    note?: string,
  ) {
    // Verify requester is actually assigned to the shift
    const assignment = await this.prisma.shiftAssignment.findFirst({
      where: { userId: requesterId, shiftId, status: 'ASSIGNED' },
    });
    if (!assignment) {
      throw new BadRequestException(
        'You must be assigned to a shift to request a swap or drop',
      );
    }

    // Enforce max 3 pending requests
    const pendingCount = await this.prisma.swapRequest.count({
      where: { requesterId, status: 'PENDING' },
    });
    if (pendingCount >= MAX_PENDING_SWAPS) {
      throw new BadRequestException(
        `You cannot have more than ${MAX_PENDING_SWAPS} pending swap/drop requests at once`,
      );
    }

    // Check no existing pending request for this shift
    const existing = await this.prisma.swapRequest.findFirst({
      where: { shiftId, requesterId, status: { in: ['PENDING', 'ACCEPTED'] } },
    });
    if (existing) {
      throw new BadRequestException(
        'You already have a pending swap/drop request for this shift',
      );
    }

    // For SWAP: validate target is qualified
    if (type === SwapType.SWAP && targetId) {
      const validation = await this.scheduling.validateAssignment(
        targetId,
        shiftId,
      );
      if (!validation.isValid) {
        throw new BadRequestException({
          message: 'Target staff member cannot take this shift',
          violations: validation.violations,
        });
      }
    }

    // Set expiry for DROP requests (24h before shift starts)
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
    });
    let expiresAt: Date | undefined;
    if (type === SwapType.DROP) {
      expiresAt = new Date(
        shift!.startAt.getTime() -
          DROP_EXPIRY_HOURS_BEFORE_SHIFT * 60 * 60 * 1000,
      );
    }

    const swapRequest = await this.prisma.swapRequest.create({
      data: {
        shiftId,
        requesterId,
        targetId,
        type,
        status: SwapStatus.PENDING,
        requesterNote: note,
        expiresAt,
      },
      include: {
        shift: { include: { location: true, skill: true } },
        requester: { select: { id: true, name: true, email: true } },
        target: { select: { id: true, name: true, email: true } },
      },
    });

    this.events.emit('swap.created', { swapRequest, actorId: requesterId });
    return swapRequest;
  }

  async acceptSwap(swapId: number, targetUserId: number) {
    const swap = await this.findById(swapId);

    if (swap.type !== SwapType.SWAP) {
      throw new BadRequestException(
        'Only SWAP requests can be accepted by a target',
      );
    }
    if (swap.targetId !== targetUserId) {
      throw new ForbiddenException(
        'Only the target staff member can accept this swap',
      );
    }
    if (swap.status !== SwapStatus.PENDING) {
      throw new BadRequestException(
        `Swap is not in PENDING state (current: ${swap.status})`,
      );
    }

    const updated = await this.prisma.swapRequest.update({
      where: { id: swapId },
      data: { status: SwapStatus.ACCEPTED },
      include: this.swapIncludes(),
    });

    this.events.emit('swap.accepted', { swap: updated, actorId: targetUserId });
    return updated;
  }

  async rejectSwap(swapId: number, targetUserId: number) {
    const swap = await this.findById(swapId);

    if (swap.targetId !== targetUserId) {
      throw new ForbiddenException(
        'Only the target staff member can reject this swap',
      );
    }
    if (swap.status !== SwapStatus.PENDING) {
      throw new BadRequestException('Swap is not in PENDING state');
    }

    const updated = await this.prisma.swapRequest.update({
      where: { id: swapId },
      data: { status: SwapStatus.REJECTED, resolvedAt: new Date() },
      include: this.swapIncludes(),
    });

    this.events.emit('swap.rejected', { swap: updated, actorId: targetUserId });
    return updated;
  }

  async approveSwap(swapId: number, managerId: number, note?: string) {
    const swap = await this.findById(swapId);

    const allowedStatuses: SwapStatus[] = [
      SwapStatus.PENDING,
      SwapStatus.ACCEPTED,
    ];
    if (!allowedStatuses.includes(swap.status)) {
      throw new BadRequestException(
        `Cannot approve swap with status: ${swap.status}`,
      );
    }

    // For DROP: pick up by any qualified person (targetId set by pickup flow)
    // For SWAP: both parties must have agreed (status=ACCEPTED) or manager can force
    if (swap.type === SwapType.SWAP && swap.status === SwapStatus.PENDING) {
      throw new BadRequestException(
        'Swap must be accepted by the target before manager approval',
      );
    }

    // Execute the actual assignment change in a transaction
    await this.prisma.$transaction(async (tx) => {
      if (swap.type === SwapType.SWAP && swap.targetId) {
        // Transfer assignment from requester to target
        await tx.shiftAssignment.updateMany({
          where: {
            userId: swap.requesterId,
            shiftId: swap.shiftId,
            status: 'ASSIGNED',
          },
          data: { status: 'SWAPPED' },
        });
        await tx.shiftAssignment.create({
          data: {
            shiftId: swap.shiftId,
            userId: swap.targetId,
            assignedBy: managerId,
          },
        });
      } else if (swap.type === SwapType.DROP && swap.targetId) {
        // Transfer to whoever picked it up
        await tx.shiftAssignment.updateMany({
          where: {
            userId: swap.requesterId,
            shiftId: swap.shiftId,
            status: 'ASSIGNED',
          },
          data: { status: 'DROPPED' },
        });
        await tx.shiftAssignment.create({
          data: {
            shiftId: swap.shiftId,
            userId: swap.targetId,
            assignedBy: managerId,
          },
        });
      }

      await tx.swapRequest.update({
        where: { id: swapId },
        data: {
          status: SwapStatus.APPROVED,
          resolvedAt: new Date(),
          resolvedBy: managerId,
          managerNote: note,
        },
      });
    });

    const updated = await this.findById(swapId);
    this.events.emit('swap.approved', { swap: updated, actorId: managerId });
    return updated;
  }

  async cancelSwap(swapId: number, requesterId: number) {
    const swap = await this.findById(swapId);

    if (swap.requesterId !== requesterId) {
      throw new ForbiddenException(
        'Only the requester can cancel a swap request',
      );
    }
    if (
      !([SwapStatus.PENDING, SwapStatus.ACCEPTED] as SwapStatus[]).includes(
        swap.status,
      )
    ) {
      throw new BadRequestException(
        `Cannot cancel swap with status: ${swap.status}`,
      );
    }

    // The Regret Swap: Staff A cancels before manager approval
    // Decision: original assignment remains (no change to ShiftAssignment)
    const updated = await this.prisma.swapRequest.update({
      where: { id: swapId },
      data: { status: SwapStatus.CANCELLED, resolvedAt: new Date() },
      include: this.swapIncludes(),
    });

    this.events.emit('swap.cancelled', { swap: updated, actorId: requesterId });
    return updated;
  }

  /**
   * Staff picks up an open DROP request.
   */
  async pickupDrop(swapId: number, pickupUserId: number) {
    const swap = await this.findById(swapId);

    if (swap.type !== SwapType.DROP) {
      throw new BadRequestException('This is not a DROP request');
    }
    if (swap.status !== SwapStatus.PENDING) {
      throw new BadRequestException('Drop request is no longer available');
    }
    if (swap.requesterId === pickupUserId) {
      throw new BadRequestException('You cannot pick up your own drop request');
    }

    // Validate the pickup person can work this shift
    const validation = await this.scheduling.validateAssignment(
      pickupUserId,
      swap.shiftId,
    );
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'You cannot pick up this shift due to constraint violations',
        violations: validation.violations,
      });
    }

    // Set as target (awaiting manager approval)
    const updated = await this.prisma.swapRequest.update({
      where: { id: swapId },
      data: { targetId: pickupUserId, status: SwapStatus.ACCEPTED },
      include: this.swapIncludes(),
    });

    this.events.emit('drop.picked_up', {
      swap: updated,
      actorId: pickupUserId,
    });
    return updated;
  }

  async findAll(params: {
    userId?: number;
    locationId?: number;
    status?: SwapStatus;
    type?: SwapType;
    page?: number;
    limit?: number;
  }) {
    const skip = ((params.page ?? 1) - 1) * (params.limit ?? 20);
    const take = params.limit ?? 20;

    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.type) where.type = params.type;
    if (params.userId) {
      where.OR = [{ requesterId: params.userId }, { targetId: params.userId }];
    }
    if (params.locationId) {
      where.shift = { locationId: params.locationId };
    }

    const [requests, total] = await Promise.all([
      this.prisma.swapRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: this.swapIncludes(),
      }),
      this.prisma.swapRequest.count({ where }),
    ]);

    return {
      data: requests,
      meta: { total, page: params.page ?? 1, limit: take },
    };
  }

  async findById(id: number) {
    const swap = await this.prisma.swapRequest.findUnique({
      where: { id },
      include: this.swapIncludes(),
    });
    if (!swap) throw new NotFoundException(`Swap request #${id} not found`);
    return swap;
  }

  /**
   * Cron: expire drop requests that haven't been claimed 24h before shift.
   * Also auto-cancel pending swap requests when shift is edited.
   */
  @Cron('*/15 * * * *') // Every 15 minutes
  async expireDropRequests() {
    const expired = await this.prisma.swapRequest.updateMany({
      where: {
        type: SwapType.DROP,
        status: SwapStatus.PENDING,
        expiresAt: { lte: new Date() },
      },
      data: { status: SwapStatus.EXPIRED, resolvedAt: new Date() },
    });

    if (expired.count > 0) {
      this.events.emit('swap.batch_expired', { count: expired.count });
    }
  }

  /**
   * Called when a shift is edited — cancels all pending swaps for that shift.
   */
  async cancelPendingSwapsForShift(shiftId: number, reason: string) {
    const pending = await this.prisma.swapRequest.findMany({
      where: {
        shiftId,
        status: { in: [SwapStatus.PENDING, SwapStatus.ACCEPTED] },
      },
      include: this.swapIncludes(),
    });

    await this.prisma.swapRequest.updateMany({
      where: { id: { in: pending.map((s) => s.id) } },
      data: { status: SwapStatus.CANCELLED, resolvedAt: new Date() },
    });

    for (const swap of pending) {
      this.events.emit('swap.auto_cancelled', { swap, reason });
    }

    return pending.length;
  }

  private swapIncludes() {
    return {
      shift: {
        include: {
          location: { select: { id: true, name: true, timezone: true } },
          skill: true,
        },
      },
      requester: { select: { id: true, name: true, email: true } },
      target: { select: { id: true, name: true, email: true } },
    };
  }
}
