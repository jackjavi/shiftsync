import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { SwapStatus, SwapType, UserRole } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { Roles } from '../shared/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { AuthenticatedUser } from '../shared/types/shared.types';
import { SwapsService } from './swaps.service';

const createSwapSchema = z.object({
  shiftId: z.number().int().positive(),
  targetId: z.number().int().positive().optional(),
  type: z.nativeEnum(SwapType),
  note: z.string().optional(),
});

const approveSchema = z.object({
  note: z.string().optional(),
});

@Controller('swaps')
export class SwapsController {
  constructor(private readonly service: SwapsService) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createSwapSchema)) body: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.service.createSwap(
        user.id,
        body.shiftId,
        body.targetId ?? null,
        body.type,
        body.note,
      ),
    };
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('locationId') locationId?: string,
    @Query('status') status?: SwapStatus,
    @Query('type') type?: SwapType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = user.role === UserRole.STAFF ? user.id : undefined;
    return this.service.findAll({
      userId,
      locationId: locationId ? parseInt(locationId) : undefined,
      status,
      type,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number) {
    return { data: await this.service.findById(id) };
  }

  @Post(':id/accept')
  async accept(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.acceptSwap(id, user.id) };
  }

  @Post(':id/reject')
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.rejectSwap(id, user.id) };
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(approveSchema)) body: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.approveSwap(id, user.id, body.note) };
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.cancelSwap(id, user.id) };
  }

  @Post(':id/pickup')
  async pickup(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.pickupDrop(id, user.id) };
  }
}
