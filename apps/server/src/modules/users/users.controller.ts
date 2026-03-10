import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { Public } from '../shared/decorators/public.decorator';
import { Roles } from '../shared/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { AuthenticatedUser } from '../shared/types/shared.types';
import {
  addCertificationSchema,
  addSkillSchema,
  createUserSchema,
  updateUserSchema,
} from './users.schemas';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  /** Public registration (creates STAFF role by default) */
  @Public()
  @Post('register')
  @UsePipes(new ZodValidationPipe(createUserSchema))
  async register(@Body() body: any) {
    return { data: await this.service.create({ ...body, role: UserRole.STAFF }) };
  }

  /** Admin creates any user role */
  @Post()
  @Roles(UserRole.ADMIN)
  @UsePipes(new ZodValidationPipe(createUserSchema))
  async create(@Body() body: any) {
    return { data: await this.service.create(body) };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: UserRole,
    @Query('locationId') locationId?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      role,
      locationId: locationId ? parseInt(locationId) : undefined,
    });
  }

  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.service.findById(user.id) };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async findById(@Param('id', ParseIntPipe) id: number) {
    return { data: await this.service.findById(id) };
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateUserSchema)) body: any,
  ) {
    return { data: await this.service.update(user.id, body) };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateUserSchema)) body: any,
  ) {
    return { data: await this.service.update(id, body) };
  }

  @Post(':id/skills')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async addSkill(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(addSkillSchema)) body: any,
  ) {
    return { data: await this.service.addSkill(id, body) };
  }

  @Delete(':id/skills/:skillId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async removeSkill(
    @Param('id', ParseIntPipe) id: number,
    @Param('skillId', ParseIntPipe) skillId: number,
  ) {
    return { data: await this.service.removeSkill(id, skillId) };
  }

  @Post(':id/certifications')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async addCertification(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(addCertificationSchema)) body: any,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return { data: await this.service.addCertification(id, body, actor.id) };
  }

  @Delete(':id/certifications/:locationId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async revokeCertification(
    @Param('id', ParseIntPipe) id: number,
    @Param('locationId', ParseIntPipe) locationId: number,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return { data: await this.service.revokeCertification(id, locationId, actor.id) };
  }
}
