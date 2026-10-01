import {
  BadRequestException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { Tenant } from '../tenants/tenant.entity';
import { isTenantActive } from '../tenants/tenant-status.util';
import { CustomObject } from './custom-object.entity';
import { CustomObjectsService } from './custom-objects.service';
import { getWorkspaceTableKind } from './workspace-table-kind';

/** Публичная ссылка «только аналитика» на таблицу рабочей области:
 * /workspace/:clientKey/:objectId/analytics. Одна ссылка на таблицу; показывается раскладка
 * аналитики того пользователя, кто последним сохранил настройки доступа (sharedBy). */
type ShareRow = {
  id: string;
  tenant_id: string;
  object_id: string;
  enabled: boolean;
  password_hash: string | null;
  expires_at: Date | null;
  shared_by: string | null;
  token_version: number;
  created_at: Date;
  updated_at: Date;
};

const SHARE_TOKEN_TTL = '12h';
const MAX_SHARED_RECORDS = 5000;

@Injectable()
export class WorkspaceSharesService implements OnModuleInit {
  private readonly log = new Logger(WorkspaceSharesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly objects: CustomObjectsService,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(CustomObject) private readonly objectRepo: Repository<CustomObject>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "workspace_shares" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
          "object_id" uuid NOT NULL UNIQUE REFERENCES "custom_objects"("id") ON DELETE CASCADE,
          "enabled" boolean NOT NULL DEFAULT true,
          "password_hash" varchar(255),
          "expires_at" timestamptz,
          "shared_by" uuid,
          "token_version" int NOT NULL DEFAULT 1,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now()
        )
      `);
      this.log.log('Workspace shares schema is ready');
    } catch (e) {
      this.log.error(`workspace_shares schema init failed: ${(e as Error).message}`);
    }
  }

  private secret() {
    const base = process.env.JWT_SECRET;
    if (!base) throw new Error('JWT_SECRET is not configured');
    return `${base}:workspace-share`;
  }

  private async findRow(objectId: string): Promise<ShareRow | null> {
    const rows: ShareRow[] = await this.dataSource.query(
      `SELECT * FROM "workspace_shares" WHERE "object_id" = $1 LIMIT 1`,
      [objectId],
    );
    return rows[0] ?? null;
  }

  private toSettings(row: ShareRow | null, clientKey: string) {
    return {
      enabled: Boolean(row?.enabled),
      hasPassword: Boolean(row?.password_hash),
      expiresAt: row?.expires_at ? new Date(row.expires_at).toISOString() : null,
      clientKey,
      updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
  }

  // ---------- управление (из CRM, под JWT) ----------

  async getSettings(tenantId: string, objectId: string) {
    await this.objects.getObject(tenantId, objectId);
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const row = await this.findRow(objectId);
    return this.toSettings(row && row.tenant_id === tenantId ? row : null, tenant?.clientKey || '');
  }

  async saveSettings(
    tenantId: string,
    userId: string,
    objectId: string,
    dto: { enabled?: boolean; password?: string | null; expiresAt?: string | null },
  ) {
    await this.objects.getObject(tenantId, objectId);
    let expiresAt: Date | null | undefined;
    if (dto.expiresAt === null || dto.expiresAt === '') expiresAt = null;
    else if (dto.expiresAt !== undefined) {
      const d = new Date(dto.expiresAt);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Некорректная дата окончания доступа');
      expiresAt = d;
    }
    let passwordHash: string | null | undefined;
    if (dto.password === null || dto.password === '') passwordHash = null;
    else if (typeof dto.password === 'string') {
      if (dto.password.length < 4) throw new BadRequestException('Пароль должен быть не короче 4 символов');
      if (dto.password.length > 128) throw new BadRequestException('Слишком длинный пароль');
      passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const existing = await this.findRow(objectId);
    if (existing && existing.tenant_id !== tenantId) throw new NotFoundException('Таблица не найдена');
    if (!existing) {
      await this.dataSource.query(
        `INSERT INTO "workspace_shares" ("tenant_id","object_id","enabled","password_hash","expires_at","shared_by")
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [tenantId, objectId, dto.enabled ?? true, passwordHash ?? null, expiresAt ?? null, userId],
      );
    } else {
      // Смена пароля или выключение ссылки инвалидирует уже выданные зрителям токены.
      const bumpVersion = passwordHash !== undefined || dto.enabled === false;
      await this.dataSource.query(
        `UPDATE "workspace_shares" SET
           "enabled" = $2,
           "password_hash" = $3,
           "expires_at" = $4,
           "shared_by" = $5,
           "token_version" = "token_version" + $6,
           "updated_at" = now()
         WHERE "id" = $1`,
        [
          existing.id,
          dto.enabled ?? existing.enabled,
          passwordHash !== undefined ? passwordHash : existing.password_hash,
          expiresAt !== undefined ? expiresAt : existing.expires_at,
          userId,
          bumpVersion ? 1 : 0,
        ],
      );
    }
    return this.getSettings(tenantId, objectId);
  }

  // ---------- публичный доступ ----------

  private async resolvePublic(clientKey: string, objectId: string) {
    const tenant = await this.tenantRepo.findOne({ where: { clientKey } });
    if (!tenant || !isTenantActive(tenant)) throw new NotFoundException('Ссылка недоступна');
    const row = await this.findRow(objectId);
    if (!row || row.tenant_id !== tenant.id || !row.enabled) throw new NotFoundException('Ссылка недоступна');
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      throw new GoneException('Срок действия ссылки истёк');
    }
    const object = await this.objectRepo.findOne({ where: { id: objectId, tenantId: tenant.id } });
    if (!object || !object.isActive) throw new NotFoundException('Ссылка недоступна');
    return { tenant, row, object };
  }

  async publicInfo(clientKey: string, objectId: string) {
    const { tenant, row, object } = await this.resolvePublic(clientKey, objectId);
    return {
      name: object.name,
      companyName: tenant.name,
      requiresPassword: Boolean(row.password_hash),
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    };
  }

  async unlock(clientKey: string, objectId: string, password: string) {
    const { row } = await this.resolvePublic(clientKey, objectId);
    if (!row.password_hash) return { token: null };
    const ok = typeof password === 'string' && password.length > 0 && (await bcrypt.compare(password, row.password_hash));
    if (!ok) throw new UnauthorizedException('Неверный пароль');
    const token = jwt.sign({ sid: row.id, v: row.token_version, typ: 'ws-share' }, this.secret(), {
      expiresIn: SHARE_TOKEN_TTL,
    });
    return { token };
  }

  /** Для доп. публичных запросов (геокодинг): ссылка жива и, если есть пароль, токен верный. */
  async assertViewer(clientKey: string, objectId: string, token?: string) {
    const { row } = await this.resolvePublic(clientKey, objectId);
    this.checkToken(row, token);
  }

  private checkToken(row: ShareRow, token?: string) {
    if (!row.password_hash) return;
    try {
      const payload = jwt.verify(token || '', this.secret()) as { sid?: string; v?: number; typ?: string };
      if (payload.typ !== 'ws-share' || payload.sid !== row.id || payload.v !== row.token_version) {
        throw new Error('stale');
      }
    } catch {
      throw new UnauthorizedException('Нужен пароль');
    }
  }

  async publicData(clientKey: string, objectId: string, token?: string) {
    const { tenant, row, object } = await this.resolvePublic(clientKey, objectId);
    this.checkToken(row, token);

    const fields = await this.objects.listFields(tenant.id, objectId);
    const enrich = getWorkspaceTableKind(object.meta as Record<string, unknown> | null) === 'board';
    const records = await this.objects.listRecords(tenant.id, objectId, {
      limit: MAX_SHARED_RECORDS,
      offset: 0,
      enrichColumnBindings: enrich,
    });

    // Раскладка аналитики — та же, что видит в CRM пользователь, открывший доступ.
    const ns = `workspace_analytics_${objectId}`;
    let layouts: Record<string, unknown> = {};
    if (row.shared_by) {
      const users: Array<{ preferences: Record<string, any> | null }> = await this.dataSource.query(
        `SELECT "preferences" FROM "users" WHERE "id" = $1 LIMIT 1`,
        [row.shared_by],
      );
      const all = (users[0]?.preferences?.analyticsLayouts || {}) as Record<string, unknown>;
      layouts = Object.fromEntries(Object.entries(all).filter(([key]) => key === ns || key.startsWith(`${ns}__`)));
    }

    return {
      object: { id: object.id, name: object.name },
      companyName: tenant.name,
      primaryCurrency: tenant.primaryCurrency || null,
      storageNamespace: ns,
      layouts,
      fields: (fields as any[])
        .filter((f) => f.isActive !== false)
        .map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options ?? null, order: f.order })),
      records: ((records as any).items || []).map((r: any) => ({
        id: r.id,
        values: r.values || {},
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    };
  }
}
