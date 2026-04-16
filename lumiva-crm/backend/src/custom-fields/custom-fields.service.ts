// src/custom-fields/custom-fields.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomField, EntityType, FieldType } from './custom-field.entity';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';

@Injectable()
export class CustomFieldsService {
  constructor(
    @InjectRepository(CustomField)
    private readonly repo: Repository<CustomField>,
  ) {}

  /**
   * Получить все кастомные поля для типа сущности
   */
  async findByEntityType(
    tenantId: string,
    entityType: string,
  ): Promise<CustomField[]> {
    return this.repo.find({
      where: { tenantId, entityType, isActive: true },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Получить все кастомные поля тенанта
   */
  async findAll(
    tenantId: string,
    entityType?: string,
  ): Promise<CustomField[]> {
    const where: any = { tenantId };
    if (entityType) {
      where.entityType = entityType;
    }

    return this.repo.find({
      where,
      order: { entityType: 'ASC', order: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Получить одно поле
   */
  async findOne(tenantId: string, id: string): Promise<CustomField> {
    const field = await this.repo.findOne({
      where: { id, tenantId },
    });

    if (!field) {
      throw new NotFoundException('Custom field not found');
    }

    return field;
  }

  /**
   * Создать кастомное поле
   */
  async create(
    tenantId: string,
    dto: CreateCustomFieldDto,
  ): Promise<CustomField> {
    // Проверяем уникальность key для entityType
    const existing = await this.repo.findOne({
      where: { tenantId, entityType: dto.entityType, key: dto.key },
    });

    if (existing) {
      throw new BadRequestException(
        `Field with key "${dto.key}" already exists for ${dto.entityType}`,
      );
    }

    // Валидация: для select/multiselect должны быть options
    if (
      (dto.type === FieldType.SELECT || dto.type === FieldType.MULTISELECT) &&
      (!dto.options || dto.options.length === 0)
    ) {
      throw new BadRequestException(
        'Options are required for select/multiselect fields',
      );
    }

    const field = this.repo.create({
      tenantId,
      entityType: dto.entityType,
      key: dto.key,
      label: dto.label,
      type: dto.type,
      required: dto.required || false,
      placeholder: dto.placeholder || null,
      helpText: dto.helpText || null,
      options: dto.options || null,
      defaultValue: dto.defaultValue || null,
      order: dto.order || 0,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    return this.repo.save(field);
  }

  /**
   * Обновить кастомное поле
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateCustomFieldDto,
  ): Promise<CustomField> {
    const field = await this.findOne(tenantId, id);

    // Нельзя менять key и entityType
    if (dto.key !== undefined && dto.key !== field.key) {
      throw new BadRequestException('Cannot change field key');
    }
    if (dto.entityType !== undefined && dto.entityType !== field.entityType) {
      throw new BadRequestException('Cannot change entity type');
    }

    // Валидация options для select/multiselect
    if (
      (field.type === FieldType.SELECT || field.type === FieldType.MULTISELECT) &&
      dto.options !== undefined &&
      dto.options.length === 0
    ) {
      throw new BadRequestException(
        'Options are required for select/multiselect fields',
      );
    }

    if (dto.label !== undefined) field.label = dto.label;
    if (dto.type !== undefined) field.type = dto.type;
    if (dto.required !== undefined) field.required = dto.required;
    if (dto.placeholder !== undefined) field.placeholder = dto.placeholder || null;
    if (dto.helpText !== undefined) field.helpText = dto.helpText || null;
    if (dto.options !== undefined) field.options = dto.options || null;
    if (dto.defaultValue !== undefined) field.defaultValue = dto.defaultValue || null;
    if (dto.order !== undefined) field.order = dto.order;
    if (dto.isActive !== undefined) field.isActive = dto.isActive;

    return this.repo.save(field);
  }

  /**
   * Удалить кастомное поле
   */
  async delete(tenantId: string, id: string): Promise<void> {
    const field = await this.findOne(tenantId, id);
    await this.repo.remove(field);
  }

  /**
   * Валидировать значение поля по схеме
   */
  validateFieldValue(field: CustomField, value: any): boolean {
    if (field.required && (value === null || value === undefined || value === '')) {
      return false;
    }

    if (value === null || value === undefined || value === '') {
      return true; // Пустое значение допустимо для необязательных полей
    }

    switch (field.type) {
      case FieldType.EMAIL:
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
      case FieldType.URL:
        try {
          new URL(String(value));
          return true;
        } catch {
          return false;
        }
      case FieldType.NUMBER:
        return !isNaN(Number(value));
      case FieldType.DATE:
      case FieldType.DATETIME:
        return !isNaN(Date.parse(String(value)));
      case FieldType.BOOLEAN:
        return typeof value === 'boolean' || value === 'true' || value === 'false';
      case FieldType.SELECT:
        if (!field.options) return false;
        return field.options.some((opt) => opt.value === String(value));
      case FieldType.MULTISELECT:
        if (!field.options || !Array.isArray(value)) return false;
        return value.every((v) =>
          field.options!.some((opt) => opt.value === String(v)),
        );
      default:
        return true; // TEXT, TEXTAREA, PHONE - любое значение
    }
  }
}













