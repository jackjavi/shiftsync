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
  createAvailabilitySchema,
  updateAvailabilitySchema,
} from './availability.schemas';
import { AvailabilityService } from './availability.service';

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly service: AvailabilityService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createAvailabilitySchema)) body: any,
  ) {
    return { data: await this.service.create(user.id, body) };
  }

  @Get('me')
  async findMine(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.service.findForUser(user.id) };
  }

  @Get('user/:userId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async findForUser(@Param('userId', ParseIntPipe) userId: number) {
    return { data: await this.service.findForUser(userId) };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateAvailabilitySchema)) body: any,
  ) {
    return { data: await this.service.update(id, user.id, body) };
  }

  @Delete(':id')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.delete(id, user.id) };
  }
}
