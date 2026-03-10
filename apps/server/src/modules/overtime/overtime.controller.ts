import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { Roles } from '../shared/decorators/roles.decorator';
import { AuthenticatedUser } from '../shared/types/shared.types';
import { OvertimeService } from './overtime.service';

@Controller('overtime')
export class OvertimeController {
  constructor(private readonly service: OvertimeService) {}

  @Get('weekly/:userId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getWeekly(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('weekStart') weekStart: string,
  ) {
    return { data: await this.service.getWeeklyHours(userId, weekStart ?? new Date().toISOString()) };
  }

  @Get('weekly/me')
  async getMyWeekly(
    @CurrentUser() user: AuthenticatedUser,
    @Query('weekStart') weekStart: string,
  ) {
    return { data: await this.service.getWeeklyHours(user.id, weekStart ?? new Date().toISOString()) };
  }

  @Get('dashboard/:locationId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getDashboard(
    @Param('locationId', ParseIntPipe) locationId: number,
    @Query('weekStart') weekStart: string,
  ) {
    return { data: await this.service.getLocationDashboard(locationId, weekStart ?? new Date().toISOString()) };
  }
}
