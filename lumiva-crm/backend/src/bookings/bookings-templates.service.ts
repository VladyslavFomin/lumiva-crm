import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingNotificationTemplate } from './booking-notification-template.entity';
import { BookingsProjectsService } from './bookings-projects.service';

@Injectable()
export class BookingsTemplatesService {
  constructor(
    @InjectRepository(BookingNotificationTemplate)
    private readonly repo: Repository<BookingNotificationTemplate>,
    private readonly projects: BookingsProjectsService,
  ) {}

  async list(tenantId: string): Promise<BookingNotificationTemplate[]> {
    return this.repo.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
  }

  async create(
    tenantId: string,
    dto: Partial<BookingNotificationTemplate>,
  ): Promise<BookingNotificationTemplate> {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const entity = this.repo.create({ ...dto, tenantId, projectId: project.id });
    return this.repo.save(entity);
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<BookingNotificationTemplate>,
  ): Promise<BookingNotificationTemplate> {
    const entity = await this.repo.findOne({ where: { id, tenantId } });
    if (!entity) throw new NotFoundException('Template not found');
    const { id: _id, tenantId: _t, projectId: _p, ...rest } = dto as any;
    Object.assign(entity, rest);
    return this.repo.save(entity);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.repo.delete({ id, tenantId });
  }
}
