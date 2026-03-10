import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../shared/types/shared.types';
import {
  buildPaginatedResponse,
  getPaginationParams,
} from '../shared/utils/pagination.utils';
import { isPremiumShift } from '../shared/utils/timezone.utils';
import {
  CreateShiftDto,
  ShiftFilterDto,
  UpdateShiftDto,
} from './shifts.schemas';

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(dto: CreateShiftDto, actor: AuthenticatedUser) {
    const location = await this.prisma.location.findUnique({
      where: { id: dto.locationId },
    });
    if (!location) throw new NotFoundException(`Location #${dto.locationId} not found`);

    const skill = await this.prisma.skill.findUnique({ where: { id: dto.skillId } });
    if (!skill) throw new NotFoundException(`Skill #${dto.skillId} not found`);

    // Managers can only create shifts for their locations
    if (actor.role === UserRole.MANAGER) {
      const isManager = await this.prisma.locationManager.findUnique({
        where: { userId_locationId: { userId: actor.id, locationId: dto.locationId } },
      });
      if (!isManager) throw new ForbiddenException('You can only create shifts for your locations');
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    // Auto-tag premium shifts (Fri/Sat evenings)
    const premium = isPremiumShift(startAt, location.timezone);

    const shift = await this.prisma.shift.create({
      data: {
        locationId: dto.locationId,
        skillId: dto.skillId,
        startAt,
        endAt,
        headcount: dto.headcount,
        notes: dto.notes,
        editCutoffHours: dto.editCutoffHours,
        isPremium: premium,
      },
      include: {
        location: true,
        skill: true,
        assignments: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    this.events.emit('shift.created', { shift, actorId: actor.id });
    return shift;
  }

  async findAll(filters: ShiftFilterDto, actor: AuthenticatedUser) {
    const { skip, take, page, limit } = getPaginationParams(filters);

    const where: any = {};

    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.skillId) where.skillId = filters.skillId;
    if (filters.isPublished !== undefined) where.isPublished = filters.isPublished;
    if (filters.from || filters.to) {
      where.startAt = {};
      if (filters.from) where.startAt.gte = new Date(filters.from);
      if (filters.to) where.startAt.lte = new Date(filters.to);
    }

    // Managers only see their location shifts
    if (actor.role === UserRole.MANAGER) {
      where.location = {
        managers: { some: { userId: actor.id } },
      };
    }

    // Staff only see published shifts
    if (actor.role === UserRole.STAFF) {
      where.isPublished = true;
    }

    const [shifts, total] = await Promise.all([
      this.prisma.shift.findMany({
        where,
        skip,
        take,
        orderBy: { startAt: 'asc' },
        include: {
          location: { select: { id: true, name: true, timezone: true } },
          skill: true,
          assignments: {
            where: { status: 'ASSIGNED' },
            include: { user: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.shift.count({ where }),
    ]);

    return buildPaginatedResponse(shifts, total, page, limit);
  }

  async findById(id: number) {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      include: {
        location: true,
        skill: true,
        assignments: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        swapRequests: {
          where: { status: { in: ['PENDING', 'ACCEPTED'] } },
          include: {
            requester: { select: { id: true, name: true } },
            target: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!shift) throw new NotFoundException(`Shift #${id} not found`);
    return shift;
  }

  async update(id: number, dto: UpdateShiftDto, actor: AuthenticatedUser) {
    const shift = await this.findById(id);

    if (actor.role === UserRole.MANAGER) {
      const isManager = await this.prisma.locationManager.findUnique({
        where: { userId_locationId: { userId: actor.id, locationId: shift.locationId } },
      });
      if (!isManager) throw new ForbiddenException('You can only edit shifts for your locations');
    }

    // Check edit cutoff — cannot edit within cutoff hours of shift start
    const cutoffHours = shift.editCutoffHours;
    const now = new Date();
    const hoursUntilShift = (shift.startAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (shift.isPublished && hoursUntilShift < cutoffHours) {
      throw new BadRequestException(
        `Cannot edit a published shift within ${cutoffHours} hours of start time`,
      );
    }

    const updateData: any = { ...dto };
    if (dto.startAt) updateData.startAt = new Date(dto.startAt);
    if (dto.endAt) updateData.endAt = new Date(dto.endAt);

    // Re-evaluate premium status if times changed
    if (dto.startAt) {
      const location = await this.prisma.location.findUnique({ where: { id: shift.locationId } });
      updateData.isPremium = isPremiumShift(updateData.startAt, location!.timezone);
    }

    const updated = await this.prisma.shift.update({
      where: { id },
      data: updateData,
      include: { location: true, skill: true, assignments: { include: { user: { select: { id: true, name: true } } } } },
    });

    // Cancel any pending swap requests on this shift
    this.events.emit('shift.updated', { shift: updated, previousShift: shift, actorId: actor.id });

    return updated;
  }

  async delete(id: number, actor: AuthenticatedUser) {
    const shift = await this.findById(id);

    if (actor.role === UserRole.MANAGER) {
      const isManager = await this.prisma.locationManager.findUnique({
        where: { userId_locationId: { userId: actor.id, locationId: shift.locationId } },
      });
      if (!isManager) throw new ForbiddenException('You can only delete shifts for your locations');
    }

    await this.prisma.shift.delete({ where: { id } });
    this.events.emit('shift.deleted', { shiftId: id, actorId: actor.id });
    return { deleted: true };
  }

  async publish(id: number, actor: AuthenticatedUser) {
    const shift = await this.findById(id);

    if (shift.isPublished) {
      throw new BadRequestException('Shift is already published');
    }

    const updated = await this.prisma.shift.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date() },
      include: { location: true, skill: true, assignments: { include: { user: { select: { id: true, name: true } } } } },
    });

    this.events.emit('shift.published', { shift: updated, actorId: actor.id });
    return updated;
  }

  async unpublish(id: number, actor: AuthenticatedUser) {
    const shift = await this.findById(id);

    const now = new Date();
    const hoursUntilShift = (shift.startAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilShift < shift.editCutoffHours) {
      throw new BadRequestException(
        `Cannot unpublish a shift within ${shift.editCutoffHours} hours of start`,
      );
    }

    const updated = await this.prisma.shift.update({
      where: { id },
      data: { isPublished: false, publishedAt: null },
    });

    this.events.emit('shift.unpublished', { shift: updated, actorId: actor.id });
    return updated;
  }

  /**
   * Publish all unpublished shifts for a location for a given week.
   */
  async publishWeek(
    locationId: number,
    weekStart: string,
    actor: AuthenticatedUser,
  ) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);

    const shifts = await this.prisma.shift.findMany({
      where: {
        locationId,
        isPublished: false,
        startAt: { gte: start, lt: end },
      },
    });

    if (shifts.length === 0) {
      throw new BadRequestException('No unpublished shifts found for this week');
    }

    const updated = await this.prisma.shift.updateMany({
      where: { id: { in: shifts.map((s) => s.id) } },
      data: { isPublished: true, publishedAt: new Date() },
    });

    this.events.emit('schedule.published', { locationId, weekStart, shiftIds: shifts.map((s) => s.id), actorId: actor.id });
    return { published: updated.count };
  }
}
