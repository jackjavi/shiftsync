import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    actorId: number,
    entityType: string,
    entityId: number,
    action: string,
    before?: object,
    after?: object,
  ) {
    return this.prisma.auditLog.create({
      data: { actorId, entityType, entityId, action, before, after },
    });
  }

  async findForShift(shiftId: number) {
    return this.prisma.auditLog.findMany({
      where: { entityType: 'Shift', entityId: shiftId },
      include: { actor: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(params: {
    entityType?: string;
    locationId?: number;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const skip = ((params.page ?? 1) - 1) * (params.limit ?? 50);
    const take = params.limit ?? 50;

    const where: any = {};
    if (params.entityType) where.entityType = params.entityType;
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, name: true, role: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data: logs, meta: { total, page: params.page ?? 1, limit: take } };
  }

  // ── Event listeners — auto-log domain events ─────────────────────────────

  @OnEvent('shift.created')
  async onShiftCreated(payload: { shift: any; actorId: number }) {
    await this.log(payload.actorId, 'Shift', payload.shift.id, 'CREATED', undefined, payload.shift);
  }

  @OnEvent('shift.updated')
  async onShiftUpdated(payload: { shift: any; previousShift: any; actorId: number }) {
    await this.log(payload.actorId, 'Shift', payload.shift.id, 'UPDATED', payload.previousShift, payload.shift);
  }

  @OnEvent('shift.published')
  async onShiftPublished(payload: { shift: any; actorId: number }) {
    await this.log(payload.actorId, 'Shift', payload.shift.id, 'PUBLISHED', undefined, { isPublished: true });
  }

  @OnEvent('assignment.created')
  async onAssignmentCreated(payload: { assignment: any; actorId: number }) {
    await this.log(payload.actorId, 'ShiftAssignment', payload.assignment.id, 'ASSIGNED', undefined, payload.assignment);
  }

  @OnEvent('assignment.removed')
  async onAssignmentRemoved(payload: { assignment: any; actorId: number }) {
    await this.log(payload.actorId, 'ShiftAssignment', payload.assignment.id, 'UNASSIGNED', payload.assignment, undefined);
  }

  @OnEvent('swap.approved')
  async onSwapApproved(payload: { swap: any; actorId: number }) {
    await this.log(payload.actorId, 'SwapRequest', payload.swap.id, 'APPROVED', undefined, payload.swap);
  }
}
