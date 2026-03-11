import {
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { Roles } from '../shared/decorators/roles.decorator';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  /** Paginated JSON list — used by the admin UI */
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
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * CSV export — streams the full result set as a downloadable .csv file.
   * Example: GET /audit/export?from=2025-01-01&to=2025-12-31&entityType=Shift
   */
  @Get('export')
  @Roles(UserRole.ADMIN)
  async exportCsv(
    @Res() res: Response,
    @Query('entityType') entityType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const csv = await this.service.exportCsv({ entityType, from, to });

    const filename = `audit-export-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // BOM for Excel UTF-8 compatibility
    res.send('\uFEFF' + csv);
  }

  /** Audit trail for a specific shift — used on the shift detail page */
  @Get('shift/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async findForShift(@Param('id', ParseIntPipe) id: number) {
    return { data: await this.service.findForShift(id) };
  }
}
