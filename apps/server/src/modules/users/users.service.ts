import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import {
  buildPaginatedResponse,
  getPaginationParams,
} from '../shared/utils/pagination.utils';
import {
  AddCertificationDto,
  AddSkillDto,
  CreateUserDto,
  UpdateUserDto,
} from './users.schemas';

const BCRYPT_ROUNDS = 10;

// Strip passwordHash from any user object before returning
function sanitizeUser(user: any) {
  if (!user) return null;
  const { passwordHash: _, ...rest } = user;
  return rest;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: dto.role,
        desiredHoursPerWeek: dto.desiredHoursPerWeek,
      },
      include: { skills: { include: { skill: true } }, certifications: { include: { location: true } } },
    });

    return sanitizeUser(user);
  }

  async findAll(params: { page?: number; limit?: number; role?: UserRole; locationId?: number }) {
    const { skip, take, page, limit } = getPaginationParams(params);

    const where: any = { isActive: true };
    if (params.role) where.role = params.role;
    if (params.locationId) {
      where.certifications = {
        some: { locationId: params.locationId, revokedAt: null },
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          skills: { include: { skill: true } },
          certifications: {
            where: { revokedAt: null },
            include: { location: true },
          },
          managedLocations: { include: { location: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResponse(users.map(sanitizeUser), total, page, limit);
  }

  async findById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        skills: { include: { skill: true } },
        certifications: {
          where: { revokedAt: null },
          include: { location: true },
        },
        managedLocations: { include: { location: true } },
      },
    });

    if (!user) throw new NotFoundException(`User #${id} not found`);
    return sanitizeUser(user);
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.findById(id); // throws if not found

    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: dto.email, id: { not: id } },
      });
      if (existing) throw new ConflictException('Email already in use');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      include: {
        skills: { include: { skill: true } },
        certifications: { where: { revokedAt: null }, include: { location: true } },
      },
    });

    return sanitizeUser(user);
  }

  async addSkill(userId: number, dto: AddSkillDto) {
    await this.findById(userId);

    const skill = await this.prisma.skill.findUnique({ where: { id: dto.skillId } });
    if (!skill) throw new NotFoundException(`Skill #${dto.skillId} not found`);

    const existing = await this.prisma.userSkill.findUnique({
      where: { userId_skillId: { userId, skillId: dto.skillId } },
    });
    if (existing) throw new ConflictException('User already has this skill');

    return this.prisma.userSkill.create({ data: { userId, skillId: dto.skillId } });
  }

  async removeSkill(userId: number, skillId: number) {
    await this.findById(userId);

    const existing = await this.prisma.userSkill.findUnique({
      where: { userId_skillId: { userId, skillId } },
    });
    if (!existing) throw new NotFoundException('User does not have this skill');

    return this.prisma.userSkill.delete({
      where: { userId_skillId: { userId, skillId } },
    });
  }

  async addCertification(userId: number, dto: AddCertificationDto, actorId: number) {
    await this.findById(userId);

    const location = await this.prisma.location.findUnique({
      where: { id: dto.locationId },
    });
    if (!location) throw new NotFoundException(`Location #${dto.locationId} not found`);

    // Check if already certified (active)
    const existing = await this.prisma.staffCertification.findUnique({
      where: { userId_locationId: { userId, locationId: dto.locationId } },
    });

    if (existing && !existing.revokedAt) {
      throw new ConflictException('User is already certified for this location');
    }

    // If previously revoked, restore it
    if (existing && existing.revokedAt) {
      return this.prisma.staffCertification.update({
        where: { userId_locationId: { userId, locationId: dto.locationId } },
        data: { revokedAt: null, revokedBy: null, certifiedAt: new Date() },
        include: { location: true },
      });
    }

    return this.prisma.staffCertification.create({
      data: { userId, locationId: dto.locationId },
      include: { location: true },
    });
  }

  async revokeCertification(userId: number, locationId: number, actorId: number) {
    const cert = await this.prisma.staffCertification.findUnique({
      where: { userId_locationId: { userId, locationId } },
    });

    if (!cert || cert.revokedAt) {
      throw new NotFoundException('Active certification not found');
    }

    // Decision: historical assignments remain valid after revocation
    // Only future assignments are blocked
    return this.prisma.staffCertification.update({
      where: { userId_locationId: { userId, locationId } },
      data: { revokedAt: new Date(), revokedBy: actorId },
    });
  }

  async findAvailableForShift(shiftId: number) {
    // Returns staff who have the skill + certification for this shift
    // Used by SchedulingService.suggestAlternatives
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: { location: true, skill: true },
    });
    if (!shift) throw new NotFoundException(`Shift #${shiftId} not found`);

    return this.prisma.user.findMany({
      where: {
        isActive: true,
        role: UserRole.STAFF,
        skills: { some: { skillId: shift.skillId } },
        certifications: {
          some: { locationId: shift.locationId, revokedAt: null },
        },
      },
      include: {
        skills: { include: { skill: true } },
        availabilityWindows: true,
      },
    });
  }
}
