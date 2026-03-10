import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(name: string) {
    const existing = await this.prisma.skill.findUnique({ where: { name } });
    if (existing) throw new ConflictException(`Skill "${name}" already exists`);
    return this.prisma.skill.create({ data: { name } });
  }

  async findAll() {
    return this.prisma.skill.findMany({ orderBy: { name: 'asc' } });
  }

  async findById(id: number) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) throw new NotFoundException(`Skill #${id} not found`);
    return skill;
  }

  async delete(id: number) {
    await this.findById(id);
    return this.prisma.skill.delete({ where: { id } });
  }
}
