import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  extractRelativePathFromPublicUrl,
  unlinkUploadsRelative,
} from '../common/uploads-root.util';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceArea } from './workspace-area.entity';
import { CustomObject } from '../custom-objects/custom-object.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { CreateWorkspaceAreaDto } from './dto/create-workspace-area.dto';
import { UpdateWorkspaceAreaDto } from './dto/update-workspace-area.dto';

@Injectable()
export class WorkspaceAreasService {
  constructor(
    @InjectRepository(WorkspaceArea)
    private readonly areaRepo: Repository<WorkspaceArea>,
    @InjectRepository(CustomObject)
    private readonly objectRepo: Repository<CustomObject>,
  ) {}

  private slugify(input: string) {
    return (
      String(input || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 180) || 'workspace'
    );
  }

  private async uniqueSlug(tenantId: string, base: string, excludeId?: string) {
    let candidate = this.slugify(base);
    let i = 1;
    for (;;) {
      const found = await this.areaRepo.findOne({
        where: { tenantId, slug: candidate },
      });
      if (!found || found.id === excludeId) return candidate;
      candidate = `${this.slugify(base)}-${i++}`;
    }
  }

  /** Первая загрузка: создаём основную область и привязываем все таблицы без области. */
  private async ensureDefaultArea(tenantId: string): Promise<void> {
    const count = await this.areaRepo.count({ where: { tenantId } });
    if (count > 0) return;

    const main = this.areaRepo.create({
      tenantId,
      name: 'Основная рабочая область',
      slug: 'main',
      iconKey: 'home',
      iconColor: '#3b82f6',
      description: null,
      coverImageUrl: null,
      meta: null,
      sortOrder: 0,
    });
    const saved = await this.areaRepo.save(main);

    await this.objectRepo
      .createQueryBuilder()
      .update(CustomObject)
      .set({ workspaceAreaId: saved.id })
      .where('tenantId = :tid', { tid: tenantId })
      .andWhere('workspaceAreaId IS NULL')
      .execute();
  }

  async list(tenantId: string): Promise<WorkspaceArea[]> {
    await this.ensureDefaultArea(tenantId);
    return this.areaRepo.find({
      where: { tenantId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async getOne(tenantId: string, id: string): Promise<WorkspaceArea> {
    await this.ensureDefaultArea(tenantId);
    const row = await this.areaRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Workspace area not found');
    return row;
  }

  /**
   * Подключение считается привязанным к области, если:
   * — в binding указан тот же connectionId, или
   * — в binding только catalogKey (без выбранного инстанса), и сущность подключения
   *   соответствует этому каталогу (Woo / third_party_link + catalogId в config).
   */
  isIntegrationBoundToArea(
    meta: Record<string, any> | null | undefined,
    entity: IntegrationConnection,
  ): boolean {
    const raw = meta?.integrationBindings;
    if (!Array.isArray(raw)) return false;
    const eid = String(entity.id).trim();
    for (const b of raw) {
      const bid =
        b?.connectionId != null && String(b.connectionId).trim().length > 0
          ? String(b.connectionId).trim()
          : '';
      if (bid && bid === eid) return true;
    }
    for (const b of raw) {
      const bid =
        b?.connectionId != null && String(b.connectionId).trim().length > 0
          ? String(b.connectionId).trim()
          : '';
      if (bid) continue;
      const key = String((b as { catalogKey?: string }).catalogKey || '').trim();
      if (!key) continue;
      if (this.integrationMatchesWorkspaceCatalogKey(entity, key)) return true;
    }
    return false;
  }

  /**
   * Маркетинговая интеграция (Meta Ads и т.п.) привязана к области, если:
   * — в binding указан тот же marketingIntegrationId и совпадает catalogKey;
   * — или выбран только тип (catalogKey) без конкретного инстанса — тогда подходит
   *   любая активная интеграция этого типа (как для hub-подключений).
   */
  isMarketingIntegrationBoundToArea(
    meta: Record<string, any> | null | undefined,
    marketingIntegrationId: string,
    catalogKey: string,
  ): boolean {
    const raw = meta?.integrationBindings;
    if (!Array.isArray(raw)) return false;
    const mid = String(marketingIntegrationId || '').trim();
    const want = this.canonicalWorkspaceCatalogKey(catalogKey);
    if (!mid) return false;

    for (const b of raw) {
      const mk =
        b?.marketingIntegrationId != null
          ? String(b.marketingIntegrationId).trim()
          : '';
      if (mk && mk === mid) {
        const key = this.canonicalWorkspaceCatalogKey(
          String((b as { catalogKey?: string }).catalogKey || ''),
        );
        return key === want;
      }
    }
    for (const b of raw) {
      const conn =
        b?.connectionId != null && String(b.connectionId).trim().length > 0
          ? String(b.connectionId).trim()
          : '';
      if (conn) continue;
      const mk =
        b?.marketingIntegrationId != null
          ? String(b.marketingIntegrationId).trim()
          : '';
      if (mk) continue;
      const key = this.canonicalWorkspaceCatalogKey(
        String((b as { catalogKey?: string }).catalogKey || ''),
      );
      if (key === want) return true;
    }
    return false;
  }

  private canonicalWorkspaceCatalogKey(raw: string): string {
    const k = String(raw || '')
      .trim()
      .toLowerCase();
    if (k === 'google_analytics_4' || k === 'google_analytics_ga4') return 'google_analytics';
    return k;
  }

  private integrationMatchesWorkspaceCatalogKey(
    entity: IntegrationConnection,
    catalogKey: string,
  ): boolean {
    const want = this.canonicalWorkspaceCatalogKey(catalogKey);
    if (want === 'woocommerce' && entity.kind === 'woocommerce') return true;
    if (entity.kind === 'third_party_link' && entity.configJson) {
      try {
        const cfg = JSON.parse(entity.configJson) as { catalogId?: string };
        const cid = this.canonicalWorkspaceCatalogKey(String(cfg.catalogId || ''));
        return cid === want;
      } catch {
        return false;
      }
    }
    return false;
  }

  async create(tenantId: string, dto: CreateWorkspaceAreaDto): Promise<WorkspaceArea> {
    await this.ensureDefaultArea(tenantId);
    const slug = await this.uniqueSlug(tenantId, dto.slug || dto.name);
    return this.areaRepo.save(
      this.areaRepo.create({
        tenantId,
        name: dto.name.trim(),
        slug,
        iconKey: dto.iconKey?.trim() || 'folder',
        iconColor: dto.iconColor?.trim() || '#6366f1',
        coverImageUrl: dto.coverImageUrl?.trim() || null,
        description: dto.description?.trim() || null,
        meta: dto.meta ?? null,
        sortOrder: dto.sortOrder ?? 0,
      }),
    );
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateWorkspaceAreaDto,
  ): Promise<WorkspaceArea> {
    const row = await this.getOne(tenantId, id);
    if (dto.name != null) row.name = dto.name.trim();
    if (dto.slug != null) {
      row.slug = await this.uniqueSlug(tenantId, dto.slug, id);
    }
    if (dto.iconKey != null) row.iconKey = dto.iconKey.trim();
    if (dto.iconColor != null) row.iconColor = dto.iconColor.trim();
    if (dto.coverImageUrl !== undefined) {
      row.coverImageUrl = dto.coverImageUrl?.trim() || null;
    }
    if (dto.description !== undefined) {
      row.description = dto.description?.trim() || null;
    }
    if (dto.meta !== undefined) {
      if (dto.meta === null) {
        row.meta = null;
      } else {
        const prev =
          row.meta && typeof row.meta === 'object' && !Array.isArray(row.meta)
            ? row.meta
            : {};
        row.meta = { ...prev, ...dto.meta };
      }
    }
    if (dto.sortOrder != null) row.sortOrder = dto.sortOrder;
    return this.areaRepo.save(row);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const row = await this.getOne(tenantId, id);
    if (row.slug === 'main') {
      throw new BadRequestException('Нельзя удалить основную рабочую область');
    }

    const main = await this.areaRepo.findOne({
      where: { tenantId, slug: 'main' },
    });
    if (!main) {
      throw new BadRequestException('Не найдена основная рабочая область');
    }

    await this.objectRepo
      .createQueryBuilder()
      .update(CustomObject)
      .set({ workspaceAreaId: main.id })
      .where('tenantId = :tid', { tid: tenantId })
      .andWhere('workspaceAreaId = :wid', { wid: id })
      .execute();

    await this.areaRepo.delete({ id, tenantId });
  }

  /** После multipart: файл уже лежит под `tenants/{tenantId}/workspace-areas/{areaId}/...`. */
  async setCoverFromUpload(
    tenantId: string,
    areaId: string,
    file: { filename: string },
  ): Promise<WorkspaceArea> {
    const row = await this.getOne(tenantId, areaId);
    const newRelPath = `tenants/${tenantId}/workspace-areas/${areaId}/${file.filename}`;
    const oldRel = row.coverImageUrl
      ? extractRelativePathFromPublicUrl(row.coverImageUrl)
      : null;
    if (oldRel && oldRel !== newRelPath) {
      await unlinkUploadsRelative(oldRel).catch(() => {});
    }
    row.coverImageUrl = `/v1/uploads/${newRelPath}`;
    return this.areaRepo.save(row);
  }
}
