import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../shared/types/shared.types';
import {
  AssignManagerDto,
  CreateLocationDto,
  UpdateLocationDto,
} from './locations.schemas';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLocationDto) {
    return this.prisma.location.create({ data: dto });
  }

  async findAll(actor: AuthenticatedUser) {
    const where: any = { isActive: true };

    // Managers only see their assigned locations
    if (actor.role === UserRole.MANAGER) {
      where.managers = { some: { userId: actor.id } };
    }

    return this.prisma.location.findMany({
      where,
      include: {
        managers: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { shifts: true, certifications: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: number, actor: AuthenticatedUser) {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: {
        managers: { include: { user: { select: { id: true, name: true, email: true } } } },
        certifications: {
          where: { revokedAt: null },
          include: { user: { select: { id: true, name: true, email: true, skills: { include: { skill: true } } } } },
        },
      },
    });

    if (!location) throw new NotFoundException(`Location #${id} not found`);

    // Managers can only view their own locations
    if (actor.role === UserRole.MANAGER) {
      const isManager = location.managers.some((m) => m.userId === actor.id);
      if (!isManager) throw new ForbiddenException('Access denied to this location');
    }

    return location;
  }

  async update(id: number, dto: UpdateLocationDto) {
    await this.prisma.location.findUniqueOrThrow({ where: { id } });
    return this.prisma.location.update({ where: { id }, data: dto });
  }

  async assignManager(locationId: number, dto: AssignManagerDto) {
    // Verify location and user exist
    const [location, user] = await Promise.all([
      this.prisma.location.findUnique({ where: { id: locationId } }),
      this.prisma.user.findUnique({ where: { id: dto.userId } }),
    ]);

    if (!location) throw new NotFoundException(`Location #${locationId} not found`);
    if (!user) throw new NotFoundException(`User #${dto.userId} not found`);
    if (user.role !== UserRole.MANAGER && user.role !== UserRole.ADMIN) {
      throw new ConflictException('User must have MANAGER or ADMIN role');
    }

    const existing = await this.prisma.locationManager.findUnique({
      where: { userId_locationId: { userId: dto.userId, locationId } },
    });
    if (existing) throw new ConflictException('User is already a manager for this location');

    return this.prisma.locationManager.create({
      data: { userId: dto.userId, locationId },
      include: { user: { select: { id: true, name: true, email: true } }, location: true },
    });
  }

  async removeManager(locationId: number, userId: number) {
    const existing = await this.prisma.locationManager.findUnique({
      where: { userId_locationId: { userId, locationId } },
    });
    if (!existing) throw new NotFoundException('Manager assignment not found');

    return this.prisma.locationManager.delete({
      where: { userId_locationId: { userId, locationId } },
    });
  }

  async getStaff(locationId: number) {
    return this.prisma.staffCertification.findMany({
      where: { locationId, revokedAt: null },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            desiredHoursPerWeek: true,
            skills: { include: { skill: true } },
          },
        },
      },
    });
  }

  /** Check if user is manager of a location (used by guards in other modules) */
  async isManagerOf(userId: number, locationId: number): Promise<boolean> {
    const assignment = await this.prisma.locationManager.findUnique({
      where: { userId_locationId: { userId, locationId } },
    });
    return !!assignment;
  }
}
