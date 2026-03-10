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
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { Roles } from '../shared/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { AuthenticatedUser } from '../shared/types/shared.types';
import {
  createShiftSchema,
  shiftFilterSchema,
  updateShiftSchema,
} from './shifts.schemas';
import { ShiftsService } from './shifts.service';
import { z } from 'zod';

const publishWeekSchema = z.object({
  locationId: z.number().int().positive(),
  weekStart: z.string().datetime(),
});

@Controller('shifts')
export class ShiftsController {
  constructor(private readonly service: ShiftsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async create(
    @Body(new ZodValidationPipe(createShiftSchema)) body: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.create(body, user) };
  }

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(shiftFilterSchema)) filters: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(filters, user);
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number) {
    return { data: await this.service.findById(id) };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateShiftSchema)) body: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.update(id, body, user) };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.delete(id, user) };
  }

  @Post(':id/publish')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async publish(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.publish(id, user) };
  }

  @Post(':id/unpublish')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async unpublish(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.unpublish(id, user) };
  }

  @Post('publish-week')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async publishWeek(
    @Body(new ZodValidationPipe(publishWeekSchema)) body: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.publishWeek(body.locationId, body.weekStart, user) };
  }
}
