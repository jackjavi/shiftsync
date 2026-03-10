import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../shared/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('hours/:locationId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getHoursDistribution(
    @Param('locationId', ParseIntPipe) locationId: number,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return { data: await this.service.getHoursDistribution(locationId, from, to) };
  }

  @Get('fairness/:locationId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getFairness(
    @Param('locationId', ParseIntPipe) locationId: number,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return { data: await this.service.getFairnessReport(locationId, from, to) };
  }

  @Get('on-duty')
  async getOnDuty() {
    return { data: await this.service.getOnDutyNow() };
  }
}
