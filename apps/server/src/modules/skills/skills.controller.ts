import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { Roles } from '../shared/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { SkillsService } from './skills.service';

const createSkillSchema = z.object({ name: z.string().min(1) });

@Controller('skills')
export class SkillsController {
  constructor(private readonly service: SkillsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body(new ZodValidationPipe(createSkillSchema)) body: { name: string }) {
    return { data: await this.service.create(body.name) };
  }

  @Get()
  async findAll() {
    return { data: await this.service.findAll() };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async delete(@Param('id', ParseIntPipe) id: number) {
    return { data: await this.service.delete(id) };
  }
}
