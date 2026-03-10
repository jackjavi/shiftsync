import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../shared/decorators/roles.decorator';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  async findAll(
    @Query('entityType') entityType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      entityType,
      from,
      to,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('shift/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async findForShift(@Param('id', ParseIntPipe) id: number) {
    return { data: await this.service.findForShift(id) };
  }
}
