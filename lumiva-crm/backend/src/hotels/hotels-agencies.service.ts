import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelAgency } from './hotel-agency.entity';

const DEFAULT_AGENCIES = [
  'Прямая продажа',
  'Anex Tour',
  'Coral Travel',
  'Pegas Touristik',
  'TUI',
  'Booking.com',
  'Local Agent · Antalya',
];

@Injectable()
export class HotelsAgenciesService {
  constructor(
    @InjectRepository(HotelAgency)
    private readonly repo: Repository<HotelAgency>,
  ) {}

  async listOrSeed(tenantId: string) {
    const existing = await this.repo.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
    if (existing.length) return existing;
    return this.repo.save(DEFAULT_AGENCIES.map((name) => this.repo.create({ tenantId, name })));
  }

  create(tenantId: string, name: string) {
    return this.repo.save(this.repo.create({ tenantId, name }));
  }

  async remove(tenantId: string, id: string) {
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Агентство не найдено');
    await this.repo.remove(row);
    return { ok: true };
  }
}
