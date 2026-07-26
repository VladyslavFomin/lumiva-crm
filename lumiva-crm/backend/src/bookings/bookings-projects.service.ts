import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingProject } from './booking-project.entity';

@Injectable()
export class BookingsProjectsService {
  constructor(
    @InjectRepository(BookingProject)
    private readonly repo: Repository<BookingProject>,
  ) {}

  /** v1: один проект на тенанта, авто-создаётся при первом обращении. */
  async getOrCreateDefaultProject(tenantId: string): Promise<BookingProject> {
    const existing = await this.repo.findOne({ where: { tenantId } });
    if (existing) return existing;
    const created = this.repo.create({
      tenantId,
      name: 'Бронирования',
      businessType: 'salon',
      status: 'in_progress',
    });
    return this.repo.save(created);
  }

  async updateSettings(
    tenantId: string,
    dto: Partial<BookingProject>,
  ): Promise<BookingProject> {
    const project = await this.getOrCreateDefaultProject(tenantId);
    const { id, tenantId: _t, createdAt, updatedAt, ...rest } = dto as any;
    Object.assign(project, rest);
    return this.repo.save(project);
  }
}
