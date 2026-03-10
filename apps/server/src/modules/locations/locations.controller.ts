import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { Roles } from '../shared/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { AuthenticatedUser } from '../shared/types/shared.types';
import {
  assignManagerSchema,
  createLocationSchema,
  updateLocationSchema,
} from './locations.schemas';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly service: LocationsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  async create(
    @Body(new ZodValidationPipe(createLocationSchema)) body: any,
  ) {
    return { data: await this.service.create(body) };
  }

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.service.findAll(user) };
  }

  @Get(':id')
  async findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.findById(id, user) };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateLocationSchema)) body: any,
  ) {
    return { data: await this.service.update(id, body) };
  }

  @Post(':id/managers')
  @Roles(UserRole.ADMIN)
  async assignManager(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(assignManagerSchema)) body: any,
  ) {
    return { data: await this.service.assignManager(id, body) };
  }

  @Delete(':id/managers/:userId')
  @Roles(UserRole.ADMIN)
  async removeManager(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return { data: await this.service.removeManager(id, userId) };
  }

  @Get(':id/staff')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getStaff(@Param('id', ParseIntPipe) id: number) {
    return { data: await this.service.getStaff(id) };
  }
}
