import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { Roles } from '../shared/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { AuthenticatedUser } from '../shared/types/shared.types';
import { SchedulingService } from './scheduling.service';

const assignSchema = z.object({
  userId: z.number().int().positive(),
  shiftId: z.number().int().positive(),
  forceOverride: z.boolean().optional().default(false),
  overrideReason: z.string().optional(),
});

@Controller('scheduling')
export class SchedulingController {
  constructor(private readonly service: SchedulingService) {}

  /** Dry-run validation — no side effects */
  @Get('validate')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async validate(
    @Query('userId', ParseIntPipe) userId: number,
    @Query('shiftId', ParseIntPipe) shiftId: number,
  ) {
    return { data: await this.service.validateAssignment(userId, shiftId) };
  }

  /** Commit an assignment */
  @Post('assign')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async assign(
    @Body(new ZodValidationPipe(assignSchema)) body: any,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return {
      data: await this.service.assign(
        body.userId,
        body.shiftId,
        actor.id,
        body.forceOverride,
      ),
    };
  }

  /** Remove an assignment */
  @Delete('assign/:assignmentId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async unassign(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return { data: await this.service.unassign(assignmentId, actor.id) };
  }

  /** What-if: project hours before assigning */
  @Get('what-if')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async whatIf(
    @Query('userId', ParseIntPipe) userId: number,
    @Query('shiftId', ParseIntPipe) shiftId: number,
  ) {
    return { data: await this.service.whatIfAnalysis(userId, shiftId) };
  }

  /** Get qualified alternatives for a shift (Sunday Night Chaos helper) */
  @Get('suggestions/:shiftId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async suggestions(@Param('shiftId', ParseIntPipe) shiftId: number) {
    return { data: await this.service.suggestAlternatives(shiftId) };
  }
}
