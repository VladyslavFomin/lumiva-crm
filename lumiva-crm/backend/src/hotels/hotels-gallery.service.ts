import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  listPhotos(tenantId: string, hotelId: string, categoryId?: string) {
    const where: any = { tenantId, hotelId };
    if (categoryId) where.categoryId = categoryId;
    return this.photosRepo.find({ where, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  async createPhotoFromUpload(
    tenantId: string,
    hotelId: string,
    categoryId: string | null,
    filename: string,
  ) {
    const count = await this.photosRepo.count({ where: { tenantId, hotelId } });
    return this.photosRepo.save(
      this.photosRepo.create({
        tenantId,
        hotelId,
        categoryId,
        url: `/v1/uploads/hotels/${tenantId}/${hotelId}/gallery/${filename}`,
        sortOrder: count,
      }),
    );
  }

  async removePhoto(tenantId: string, id: string) {
    const row = await this.photosRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Фото не найдено');
    await this.photosRepo.remove(row);
    return { ok: true };
  }
}
