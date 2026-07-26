import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelFactsheetItem, HotelFactsheetItemKind } from './hotel-factsheet-item.entity';

export interface HotelFactsheetItemInput {
  kind: HotelFactsheetItemKind;
  name: string;
  description?: string | null;
  hours?: string | null;
  paid?: boolean | null;
  extra?: Record<string, string>;
}

@Injectable()
export class HotelsFactsheetService {
  constructor(
    @InjectRepository(HotelFactsheetItem)
    private readonly repo: Repository<HotelFactsheetItem>,
  ) {}

  listItems(tenantId: string, hotelId: string, kind?: HotelFactsheetItemKind) {
    const where: any = { tenantId, hotelId };
    if (kind) where.kind = kind;
    return this.repo.find({ where, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  async createItem(tenantId: string, hotelId: string, dto: HotelFactsheetItemInput) {
    const count = await this.repo.count({ where: { tenantId, hotelId, kind: dto.kind } });
    return this.repo.save(
      this.repo.create({
        tenantId,
        hotelId,
        kind: dto.kind,
        name: dto.name,
        description: dto.description ?? null,
        hours: dto.hours ?? null,
        paid: dto.paid ?? null,
        extra: dto.extra ?? {},
        sortOrder: count,
      }),
    );
  }

  async updateItem(tenantId: string, id: string, dto: Partial<HotelFactsheetItemInput>) {
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Запись не найдена');
    Object.assign(row, dto);
    return this.repo.save(row);
  }

  async removeItem(tenantId: string, id: string) {
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Запись не найдена');
    await this.repo.remove(row);
    return { ok: true };
  }
}
