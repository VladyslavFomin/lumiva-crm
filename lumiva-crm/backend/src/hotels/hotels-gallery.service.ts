import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { HotelGalleryCategory } from './hotel-gallery-category.entity';
import { HotelPhoto } from './hotel-photo.entity';

@Injectable()
export class HotelsGalleryService {
  constructor(
    @InjectRepository(HotelGalleryCategory)
    private readonly categoriesRepo: Repository<HotelGalleryCategory>,
    @InjectRepository(HotelPhoto)
    private readonly photosRepo: Repository<HotelPhoto>,
  ) {}

  /* ---------- categories ---------- */

  listCategories(tenantId: string, hotelId: string) {
    return this.categoriesRepo.find({ where: { tenantId, hotelId }, order: { sortOrder: 'ASC' } });
  }

  async createCategory(tenantId: string, hotelId: string, name: string) {
    const count = await this.categoriesRepo.count({ where: { tenantId, hotelId } });
    return this.categoriesRepo.save(
      this.categoriesRepo.create({ tenantId, hotelId, name, sortOrder: count }),
    );
  }

  async renameCategory(tenantId: string, id: string, name: string) {
    const row = await this.categoriesRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Категория не найдена');
    row.name = name;
    return this.categoriesRepo.save(row);
  }

  async removeCategory(tenantId: string, id: string) {
    const row = await this.categoriesRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Категория не найдена');
    // Фото не удаляются вместе с категорией — становятся некатегоризированными
    // (ON DELETE SET NULL на "categoryId", см. миграцию HotelsInfoAndGallery).
    await this.categoriesRepo.remove(row);
    return { ok: true };
  }

  /* ---------- photos ---------- */

  listPhotos(tenantId: string, hotelId: string, opts: { categoryId?: string; roomTypeId?: string } = {}) {
    const where: any = { tenantId, hotelId };
    if (opts.categoryId) where.categoryId = opts.categoryId;
    // Общая галерея отеля (roomTypeId не передан) не должна показывать фото, привязанные к
    // конкретному типу номера, и наоборот — это две раздельные галереи, не общий пул.
    where.roomTypeId = opts.roomTypeId ? opts.roomTypeId : IsNull();
    return this.photosRepo.find({ where, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  async createPhotoFromUpload(
    tenantId: string,
    hotelId: string,
    categoryId: string | null,
    filename: string,
    roomTypeId?: string | null,
  ) {
    const count = await this.photosRepo.count({ where: { tenantId, hotelId, roomTypeId: roomTypeId || IsNull() } });
    const dir = roomTypeId ? `gallery/room-types/${roomTypeId}` : 'gallery';
    return this.photosRepo.save(
      this.photosRepo.create({
        tenantId,
        hotelId,
        categoryId: roomTypeId ? null : categoryId,
        roomTypeId: roomTypeId || null,
        url: `/v1/uploads/hotels/${tenantId}/${hotelId}/${dir}/${filename}`,
        sortOrder: count,
      }),
    );
  }

  async updatePhoto(tenantId: string, id: string, dto: { categoryId?: string | null }) {
    const row = await this.photosRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Фото не найдено');
    if (dto.categoryId !== undefined) row.categoryId = dto.categoryId;
    return this.photosRepo.save(row);
  }

  async replacePhotoFile(tenantId: string, id: string, filename: string) {
    const row = await this.photosRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Фото не найдено');
    row.url = `/v1/uploads/hotels/${tenantId}/gallery-replace/${id}/${filename}`;
    return this.photosRepo.save(row);
  }

  async removePhoto(tenantId: string, id: string) {
    const row = await this.photosRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Фото не найдено');
    await this.photosRepo.remove(row);
    return { ok: true };
  }
}
