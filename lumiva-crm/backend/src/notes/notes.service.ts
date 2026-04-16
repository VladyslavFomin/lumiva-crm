// src/notes/notes.service.ts
import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Note } from './note.entity';
import { CreateNoteDto, EntityType } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note)
    private readonly repo: Repository<Note>,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
  ) {}

  /**
   * Получить все заметки для сущности
   */
  async findByEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
    options?: {
      type?: string;
      isPrivate?: boolean;
      createdById?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ items: Note[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('note')
      .where('note.tenantId = :tenantId', { tenantId })
      .andWhere('note.entityType = :entityType', { entityType })
      .andWhere('note.entityId = :entityId', { entityId });

    // Фильтр по приватности: если указан createdById, показываем приватные только этого пользователя
    if (options?.createdById) {
      qb.andWhere(
        '(note.isPrivate = false OR (note.isPrivate = true AND note.createdById = :createdById))',
        { createdById: options.createdById },
      );
    } else if (options?.isPrivate !== undefined) {
      qb.andWhere('note.isPrivate = :isPrivate', { isPrivate: options.isPrivate });
    } else {
      // По умолчанию показываем только публичные
      qb.andWhere('note.isPrivate = false');
    }

    if (options?.type) {
      qb.andWhere('note.type = :type', { type: options.type });
    }

    const total = await qb.getCount();

    if (options?.limit) {
      qb.limit(options.limit);
    }
    if (options?.offset) {
      qb.offset(options.offset);
    }

    qb.orderBy('note.createdAt', 'DESC');

    const items = await qb.getMany();

    return { items, total };
  }

  /**
   * Получить все заметки тенанта (с фильтрами)
   */
  async findAll(
    tenantId: string,
    options?: {
      entityType?: string;
      entityId?: string;
      type?: string;
      search?: string;
      createdById?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ items: Note[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('note')
      .where('note.tenantId = :tenantId', { tenantId });

    if (options?.entityType) {
      qb.andWhere('note.entityType = :entityType', { entityType: options.entityType });
    }

    if (options?.entityId) {
      qb.andWhere('note.entityId = :entityId', { entityId: options.entityId });
    }

    if (options?.type) {
      qb.andWhere('note.type = :type', { type: options.type });
    }

    if (options?.search) {
      const search = `%${options.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(note.content) LIKE :search OR LOWER(note.title) LIKE :search)',
        { search },
      );
    }

    if (options?.createdById) {
      qb.andWhere(
        '(note.isPrivate = false OR (note.isPrivate = true AND note.createdById = :createdById))',
        { createdById: options.createdById },
      );
    } else {
      // По умолчанию только публичные
      qb.andWhere('note.isPrivate = false');
    }

    const total = await qb.getCount();

    if (options?.limit) {
      qb.limit(options.limit);
    }
    if (options?.offset) {
      qb.offset(options.offset);
    }

    qb.orderBy('note.createdAt', 'DESC');

    const items = await qb.getMany();

    return { items, total };
  }

  /**
   * Получить одну заметку
   */
  async findOne(tenantId: string, id: string, userId?: string): Promise<Note> {
    const note = await this.repo.findOne({
      where: { id, tenantId },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    // Проверка доступа к приватной заметке
    if (note.isPrivate && note.createdById !== userId) {
      throw new NotFoundException('Note not found');
    }

    return note;
  }

  /**
   * Создать заметку
   */
  async create(
    tenantId: string,
    dto: CreateNoteDto,
    createdById?: string,
    createdBy?: string,
  ): Promise<Note> {
    // Валидация entityType
    const validTypes = Object.values(EntityType);
    if (!validTypes.includes(dto.entityType as EntityType)) {
      throw new BadRequestException(`Invalid entityType: ${dto.entityType}`);
    }

    const note = this.repo.create({
      tenantId,
      entityType: dto.entityType,
      entityId: dto.entityId,
      content: dto.content,
      title: dto.title || null,
      type: dto.type || 'note',
      metadata: dto.metadata || null,
      createdById: createdById || null,
      createdBy: createdBy || null,
      isPrivate: dto.isPrivate || false,
      tags: dto.tags || [],
    });

    const saved = await this.repo.save(note);

    // Триггерим автоматизацию
    try {
      await this.automationsService.triggerAutomation(
        tenantId,
        TriggerEvent.NOTE_CREATED,
        {
          entityType: 'note',
          entityId: saved.id,
          note: saved,
          linkedEntityType: dto.entityType,
          linkedEntityId: dto.entityId,
        },
      );
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }

    return saved;
  }

  /**
   * Обновить заметку
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateNoteDto,
    userId?: string,
  ): Promise<Note> {
    const note = await this.findOne(tenantId, id, userId);

    // Только автор может редактировать приватную заметку
    if (note.isPrivate && note.createdById !== userId) {
      throw new BadRequestException('You can only edit your own private notes');
    }

    if (dto.content !== undefined) note.content = dto.content;
    if (dto.title !== undefined) note.title = dto.title || null;
    if (dto.type !== undefined) note.type = dto.type;
    if (dto.metadata !== undefined) note.metadata = dto.metadata;
    if (dto.isPrivate !== undefined) note.isPrivate = dto.isPrivate;
    if (dto.tags !== undefined) note.tags = dto.tags;

    return this.repo.save(note);
  }

  /**
   * Удалить заметку
   */
  async delete(tenantId: string, id: string, userId?: string): Promise<void> {
    const note = await this.findOne(tenantId, id, userId);

    // Только автор может удалить приватную заметку
    if (note.isPrivate && note.createdById !== userId) {
      throw new BadRequestException('You can only delete your own private notes');
    }

    await this.repo.remove(note);
  }
}

