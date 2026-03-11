import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { format } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';

// ─── CSV helpers ──────────────────────────────────────────────────────────────

/** Escape a CSV cell: wrap in quotes, escape inner quotes */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Wrap in double-quotes and escape any embedded double-quotes
  return `"${str.replace(/"/g, '""')}"`;
}

function buildCsvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',');
}

const CSV_HEADERS = [
  'id',
  'timestamp',
  'actor_id',
  'actor_name',
  'actor_role',
  'entity_type',
  'entity_id',
  'action',
  'before',
  'after',
];

// ─── Service ──────────────────────────────────────────────────────────────────

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
    const where = this.buildWhere(params);

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

  /**
   * Export audit logs as a UTF-8 CSV string.
   * All matching rows are returned (no pagination) — callers stream the string
   * directly to the HTTP response with Content-Type: text/csv.
   */
  async exportCsv(params: {
    entityType?: string;
    from?: string;
    to?: string;
  }): Promise<string> {
    const where = this.buildWhere(params);

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, name: true, role: true } } },
    });

    const rows: string[] = [CSV_HEADERS.join(',')];

    for (const log of logs) {
      rows.push(
        buildCsvRow([
          log.id,
          format(log.createdAt, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
          log.actorId,
          log.actor?.name ?? '',
          log.actor?.role ?? '',
          log.entityType,
          log.entityId,
          log.action,
          log.before ? JSON.stringify(log.before) : '',
          log.after ? JSON.stringify(log.after) : '',
        ]),
      );
    }

    return rows.join('\r\n');
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private buildWhere(params: {
    entityType?: string;
    from?: string;
    to?: string;
  }): any {
    const where: any = {};
    if (params.entityType) where.entityType = params.entityType;
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }
    return where;
  }

  // ── Event listeners — auto-log domain events ─────────────────────────────

  @OnEvent('shift.created')
  async onShiftCreated(payload: { shift: any; actorId: number }) {
    await this.log(
      payload.actorId,
      'Shift',
      payload.shift.id,
      'CREATED',
      undefined,
      payload.shift,
    );
  }

  @OnEvent('shift.updated')
  async onShiftUpdated(payload: {
    shift: any;
    previousShift: any;
    actorId: number;
  }) {
    await this.log(
      payload.actorId,
      'Shift',
      payload.shift.id,
      'UPDATED',
      payload.previousShift,
      payload.shift,
    );
  }

  @OnEvent('shift.published')
  async onShiftPublished(payload: { shift: any; actorId: number }) {
    await this.log(
      payload.actorId,
      'Shift',
      payload.shift.id,
      'PUBLISHED',
      undefined,
      { isPublished: true },
    );
  }

  @OnEvent('assignment.created')
  async onAssignmentCreated(payload: { assignment: any; actorId: number }) {
    await this.log(
      payload.actorId,
      'ShiftAssignment',
      payload.assignment.id,
      'ASSIGNED',
      undefined,
      payload.assignment,
    );
  }

  @OnEvent('assignment.removed')
  async onAssignmentRemoved(payload: { assignment: any; actorId: number }) {
    await this.log(
      payload.actorId,
      'ShiftAssignment',
      payload.assignment.id,
      'UNASSIGNED',
      payload.assignment,
      undefined,
    );
  }

  @OnEvent('swap.approved')
  async onSwapApproved(payload: { swap: any; actorId: number }) {
    await this.log(
      payload.actorId,
      'SwapRequest',
      payload.swap.id,
      'APPROVED',
      undefined,
      payload.swap,
    );
  }
}
