import {
  BadRequestException,
  ForbiddenException,
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
import { randomBytes } from 'crypto';
import { Tenant } from '../tenants/tenant.entity';
import { isTenantActive } from '../tenants/tenant-status.util';
import { StaffUser } from '../staff/staff-user.entity';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import {
  AURA_DENSITIES,
  AURA_FILTERS,
  AURA_PERIODS,
  AURA_REFRESH_SEC,
  AURA_THEMES,
  sanitizeAuraConfig,
  type AuraConfig,
  type AuraFilterKey,
  type AuraPeriod,
} from './aura-catalog';
import { AuraDataService, type AuraFilters, type AuraViewerInput } from './aura-data.service';

export type AuraAccess = 'private' | 'department' | 'company';
const ACCESS: AuraAccess[] = ['private', 'department', 'company'];
const SHARE_TOKEN_TTL = '12h';

type AppRow = {
  id: string;
  tenant_id: string;
  owner_user_id: string;
  owner_name: string | null;
  name: string;
  theme: string;
  density: string;
  kiosk: boolean;
  config: AuraConfig;
  access: AuraAccess;
  department_id: string | null;
  show_in_menu: boolean;
  refresh_sec: number;
  share_enabled: boolean;
  share_key: string;
  share_password_hash: string | null;
  share_expires_at: Date | null;
  share_token_version: number;
  shared_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type AuraAppInput = {
  name?: string;
  theme?: string;
  density?: string;
  kiosk?: boolean;
  config?: unknown;
  access?: string;
  showInMenu?: boolean;
  refreshSec?: number;
};

/** TypeORM (postgres): UPDATE … RETURNING отдаёт [rows, affected], INSERT … RETURNING — просто rows. */
function firstRow<T>(res: unknown): T {
  const r = res as unknown[];
  return (Array.isArray(r[0]) ? (r[0] as T[])[0] : (r[0] as T)) as T;
}

type Viewer = { tenantId: string; userId: string; role: string; staff: StaffUser | null; headOf: string[] };

@Injectable()
export class AuraService implements OnModuleInit {
  private readonly log = new Logger(AuraService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly data: AuraDataService,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(StaffUser) private readonly staffRepo: Repository<StaffUser>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "aura_apps" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
          "owner_user_id" uuid NOT NULL,
          "owner_name" varchar(255),
          "name" varchar(160) NOT NULL,
          "theme" varchar(24) NOT NULL DEFAULT 'lumiva',
          "density" varchar(16) NOT NULL DEFAULT 'normal',
          "kiosk" boolean NOT NULL DEFAULT false,
          "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
          "access" varchar(16) NOT NULL DEFAULT 'private',
          "department_id" uuid,
          "show_in_menu" boolean NOT NULL DEFAULT false,
          "refresh_sec" int NOT NULL DEFAULT 300,
          "share_enabled" boolean NOT NULL DEFAULT false,
          "share_key" varchar(32) NOT NULL UNIQUE,
          "share_password_hash" varchar(255),
          "share_expires_at" timestamptz,
          "share_token_version" int NOT NULL DEFAULT 1,
          "shared_by" uuid,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(`CREATE INDEX IF NOT EXISTS "aura_apps_tenant_idx" ON "aura_apps" ("tenant_id")`);
      this.log.log('Aura schema is ready');
    } catch (e) {
      this.log.error(`aura_apps schema init failed: ${(e as Error).message}`);
    }
  }

  /* ---------- кто смотрит ---------- */

  static userIdOf(user: CurrentUserPayload): string {
    return String(user.userId || user.id || user.sub || '');
  }

  private async viewer(user: CurrentUserPayload): Promise<Viewer> {
    const userId = AuraService.userIdOf(user);
    let staff: StaffUser | null = null;
    if (user.staffUserId) staff = await this.staffRepo.findOne({ where: { id: user.staffUserId, tenantId: user.tenantId } });
    if (!staff && user.email) staff = await this.staffRepo.findOne({ where: { tenantId: user.tenantId, email: user.email } });
    const heads: Array<{ id: string }> = staff
      ? await this.dataSource.query(`SELECT "id" FROM "departments" WHERE "tenant_id" = $1 AND "manager_id" = $2`, [user.tenantId, staff.id]).catch(() => [])
      : [];
    return { tenantId: user.tenantId, userId, role: user.role, staff, headOf: heads.map((h) => h.id) };
  }

  private canView(v: Viewer, row: AppRow) {
    if (row.owner_user_id === v.userId) return true;
    if (row.access === 'company') return true;
    if (row.access === 'department' && row.department_id) {
      return v.staff?.departmentId === row.department_id || v.headOf.includes(row.department_id);
    }
    return false;
  }

  /** Править может автор; владелец аккаунта — любое не-личное приложение. */
  private canEdit(v: Viewer, row: AppRow) {
    if (row.owner_user_id === v.userId) return true;
    return v.role === 'owner' && row.access !== 'private';
  }

  private dto(row: AppRow, v: Viewer | null) {
    return {
      id: row.id,
      name: row.name,
      theme: row.theme,
      density: row.density,
      kiosk: row.kiosk,
      config: sanitizeAuraConfig(row.config),
      access: row.access,
      showInMenu: row.show_in_menu,
      refreshSec: row.refresh_sec,
      ownerName: row.owner_name,
      isMine: v ? row.owner_user_id === v.userId : false,
      canEdit: v ? this.canEdit(v, row) : false,
      share: { enabled: row.share_enabled, hasPassword: !!row.share_password_hash, expiresAt: row.share_expires_at ? new Date(row.share_expires_at).toISOString() : null, shareKey: row.share_key },
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  private async findRow(tenantId: string, id: string): Promise<AppRow> {
    const rows: AppRow[] = await this.dataSource.query(`SELECT * FROM "aura_apps" WHERE "id" = $1 AND "tenant_id" = $2 LIMIT 1`, [id, tenantId]);
    if (!rows[0]) throw new NotFoundException('Приложение не найдено');
    return rows[0];
  }

  private async rowFor(user: CurrentUserPayload, id: string, need: 'view' | 'edit') {
    const v = await this.viewer(user);
    const row = await this.findRow(user.tenantId, id);
    if (!this.canView(v, row)) throw new NotFoundException('Приложение не найдено');
    if (need === 'edit' && !this.canEdit(v, row)) throw new ForbiddenException('Нет прав на изменение приложения');
    return { v, row };
  }

  /* ---------- CRUD ---------- */

  async list(user: CurrentUserPayload) {
    const v = await this.viewer(user);
    const rows: AppRow[] = await this.dataSource.query(`SELECT * FROM "aura_apps" WHERE "tenant_id" = $1 ORDER BY "updated_at" DESC`, [user.tenantId]);
    return rows.filter((r) => this.canView(v, r)).map((r) => this.dto(r, v));
  }

  async menu(user: CurrentUserPayload) {
    const apps = await this.list(user);
    return apps.filter((a) => a.showInMenu).map((a) => ({ id: a.id, name: a.name, kiosk: a.kiosk }));
  }

  async get(user: CurrentUserPayload, id: string) {
    const { v, row } = await this.rowFor(user, id, 'view');
    return this.dto(row, v);
  }

  private normalize(input: AuraAppInput, base?: AppRow) {
    const name = (input.name ?? base?.name ?? '').toString().trim().slice(0, 160);
    if (!name) throw new BadRequestException('Укажите название приложения');
    const theme = (AURA_THEMES as string[]).includes(String(input.theme)) ? String(input.theme) : base?.theme || 'lumiva';
    const density = (AURA_DENSITIES as string[]).includes(String(input.density)) ? String(input.density) : base?.density || 'normal';
    const access = (ACCESS as string[]).includes(String(input.access)) ? (input.access as AuraAccess) : base?.access || 'private';
    const refreshSec = AURA_REFRESH_SEC.includes(Number(input.refreshSec)) ? Number(input.refreshSec) : base?.refresh_sec || 300;
    const config = input.config !== undefined ? sanitizeAuraConfig(input.config) : sanitizeAuraConfig(base?.config);
    if (!config.widgets.length) throw new BadRequestException('В приложении нет ни одного виджета');
    return {
      name,
      theme,
      density,
      access,
      refreshSec,
      config,
      kiosk: input.kiosk !== undefined ? !!input.kiosk : !!base?.kiosk,
      showInMenu: input.showInMenu !== undefined ? !!input.showInMenu : !!base?.show_in_menu,
    };
  }

  async create(user: CurrentUserPayload, input: AuraAppInput) {
    const v = await this.viewer(user);
    const n = this.normalize(input);
    const ownerName = v.staff?.fullName || user.name || user.email || null;
    const res = await this.dataSource.query(
      `INSERT INTO "aura_apps" ("tenant_id","owner_user_id","owner_name","name","theme","density","kiosk","config","access","department_id","show_in_menu","refresh_sec","share_key")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [user.tenantId, v.userId, ownerName, n.name, n.theme, n.density, n.kiosk, JSON.stringify(n.config), n.access, v.staff?.departmentId ?? null, n.showInMenu, n.refreshSec, this.newShareKey()],
    );
    return this.dto(firstRow<AppRow>(res), v);
  }

  async update(user: CurrentUserPayload, id: string, input: AuraAppInput) {
    const { v, row } = await this.rowFor(user, id, 'edit');
    const n = this.normalize(input, row);
    // «Мой отдел» — отдел автора на момент сохранения
    const department = n.access === 'department' ? row.department_id || v.staff?.departmentId || null : row.department_id;
    const res = await this.dataSource.query(
      `UPDATE "aura_apps" SET "name"=$3,"theme"=$4,"density"=$5,"kiosk"=$6,"config"=$7,"access"=$8,"department_id"=$9,"show_in_menu"=$10,"refresh_sec"=$11,"updated_at"=now()
       WHERE "id"=$1 AND "tenant_id"=$2 RETURNING *`,
      [id, user.tenantId, n.name, n.theme, n.density, n.kiosk, JSON.stringify(n.config), n.access, department, n.showInMenu, n.refreshSec],
    );
    return this.dto(firstRow<AppRow>(res), v);
  }

  async remove(user: CurrentUserPayload, id: string) {
    await this.rowFor(user, id, 'edit');
    await this.dataSource.query(`DELETE FROM "aura_apps" WHERE "id"=$1 AND "tenant_id"=$2`, [id, user.tenantId]);
    return { ok: true };
  }

  async duplicate(user: CurrentUserPayload, id: string, name?: string) {
    const { row } = await this.rowFor(user, id, 'view');
    return this.create(user, {
      name: (name || `${row.name} (2)`).slice(0, 160),
      theme: row.theme,
      density: row.density,
      kiosk: row.kiosk,
      config: row.config,
      access: 'private',
      showInMenu: false,
      refreshSec: row.refresh_sec,
    });
  }

  /* ---------- данные ---------- */

  private viewerInput(user: CurrentUserPayload): AuraViewerInput {
    return { userId: AuraService.userIdOf(user), role: user.role, email: user.email, staffUserId: user.staffUserId ?? null };
  }

  static parseQuery(q: { period?: string; filters?: string | Record<string, string>; tz?: string }) {
    const period = (AURA_PERIODS as string[]).includes(String(q.period)) ? (q.period as AuraPeriod) : undefined;
    let raw: Record<string, unknown> = {};
    if (typeof q.filters === 'string' && q.filters) {
      try {
        raw = JSON.parse(q.filters);
      } catch {
        raw = {};
      }
    } else if (q.filters && typeof q.filters === 'object') raw = q.filters;
    const filters: AuraFilters = {};
    for (const f of AURA_FILTERS) {
      const val = raw[f];
      if (typeof val === 'string' && val && val.length <= 200) filters[f as AuraFilterKey] = val;
    }
    return { period, filters, tz: typeof q.tz === 'string' ? q.tz.slice(0, 64) : undefined };
  }

  /** Превью черновика (ещё не сохранённое приложение) — с правами текущего пользователя. */
  async previewData(user: CurrentUserPayload, body: { config?: unknown; widgets?: string[]; period?: string; filters?: unknown; tz?: string }) {
    const cfg = sanitizeAuraConfig(body.config ?? { widgets: body.widgets });
    const q = AuraService.parseQuery({ period: body.period, filters: body.filters as any, tz: body.tz });
    const scope = await this.data.buildScope(user.tenantId, this.viewerInput(user));
    return this.data.compute(scope, {
      widgets: cfg.widgets,
      period: q.period || cfg.period,
      filters: q.filters,
      breakdown: cfg.breakdown,
      goals: cfg.goals,
      tz: q.tz,
      custom: cfg.custom,
    });
  }

  async appData(user: CurrentUserPayload, id: string, query: { period?: string; filters?: string; tz?: string }) {
    const { row } = await this.rowFor(user, id, 'view');
    const cfg = sanitizeAuraConfig(row.config);
    const q = AuraService.parseQuery(query);
    const scope = await this.data.buildScope(user.tenantId, this.viewerInput(user));
    return this.data.compute(scope, { widgets: cfg.widgets, period: q.period || cfg.period, filters: q.filters, breakdown: cfg.breakdown, goals: cfg.goals, tz: q.tz, custom: cfg.custom });
  }

  /* ---------- публичная ссылка ---------- */

  private newShareKey() {
    return randomBytes(9).toString('base64url').replace(/[-_]/g, 'x').slice(0, 12);
  }

  private secret() {
    const base = process.env.JWT_SECRET;
    if (!base) throw new Error('JWT_SECRET is not configured');
    return `${base}:aura-share`;
  }

  async getShare(user: CurrentUserPayload, id: string) {
    const { row } = await this.rowFor(user, id, 'view');
    return this.shareDto(row);
  }

  private shareDto(row: AppRow) {
    return {
      enabled: row.share_enabled,
      hasPassword: !!row.share_password_hash,
      expiresAt: row.share_expires_at ? new Date(row.share_expires_at).toISOString() : null,
      shareKey: row.share_key,
    };
  }

  async saveShare(
    user: CurrentUserPayload,
    id: string,
    dto: { enabled?: boolean; password?: string | null; expiresAt?: string | null; regenerate?: boolean },
  ) {
    const { v, row } = await this.rowFor(user, id, 'edit');
    let expiresAt: Date | null = row.share_expires_at;
    if (dto.expiresAt === null || dto.expiresAt === '') expiresAt = null;
    else if (dto.expiresAt !== undefined) {
      const d = new Date(dto.expiresAt);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Некорректная дата окончания доступа');
      expiresAt = d;
    }
    let hash = row.share_password_hash;
    let passwordChanged = false;
    if (dto.password === null || dto.password === '') {
      passwordChanged = hash !== null;
      hash = null;
    } else if (typeof dto.password === 'string') {
      if (dto.password.length < 4) throw new BadRequestException('Пароль должен быть не короче 4 символов');
      if (dto.password.length > 128) throw new BadRequestException('Слишком длинный пароль');
      hash = await bcrypt.hash(dto.password, 10);
      passwordChanged = true;
    }
    const enabled = dto.enabled ?? row.share_enabled;
    // смена пароля/выключение/новая ссылка отзывает уже выданные зрителям токены
    const bump = passwordChanged || (row.share_enabled && !enabled) || !!dto.regenerate;
    const res = await this.dataSource.query(
      `UPDATE "aura_apps" SET "share_enabled"=$3,"share_password_hash"=$4,"share_expires_at"=$5,"shared_by"=$6,
         "share_token_version"="share_token_version"+$7,"share_key"=$8,"updated_at"=now()
       WHERE "id"=$1 AND "tenant_id"=$2 RETURNING *`,
      [id, user.tenantId, enabled, hash, expiresAt, v.userId, bump ? 1 : 0, dto.regenerate ? this.newShareKey() : row.share_key],
    );
    return this.shareDto(firstRow<AppRow>(res));
  }

  private async resolvePublic(shareKey: string) {
    const rows: AppRow[] = await this.dataSource.query(`SELECT * FROM "aura_apps" WHERE "share_key" = $1 LIMIT 1`, [shareKey]);
    const row = rows[0];
    if (!row || !row.share_enabled) throw new NotFoundException('Ссылка недоступна');
    const tenant = await this.tenantRepo.findOne({ where: { id: row.tenant_id } });
    if (!tenant || !isTenantActive(tenant)) throw new NotFoundException('Ссылка недоступна');
    if (row.share_expires_at && new Date(row.share_expires_at).getTime() < Date.now()) throw new GoneException('Срок действия ссылки истёк');
    return { row, tenant };
  }

  private checkToken(row: AppRow, token?: string) {
    if (!row.share_password_hash) return;
    try {
      const p = jwt.verify(token || '', this.secret()) as { aid?: string; v?: number; typ?: string };
      if (p.typ !== 'aura-share' || p.aid !== row.id || p.v !== row.share_token_version) throw new Error('stale');
    } catch {
      throw new UnauthorizedException('Нужен пароль');
    }
  }

  async publicInfo(shareKey: string) {
    const { row, tenant } = await this.resolvePublic(shareKey);
    return { name: row.name, companyName: tenant.name, requiresPassword: !!row.share_password_hash, theme: row.theme };
  }

  async publicUnlock(shareKey: string, password: string) {
    const { row } = await this.resolvePublic(shareKey);
    if (!row.share_password_hash) return { token: null };
    const ok = typeof password === 'string' && password.length > 0 && (await bcrypt.compare(password, row.share_password_hash));
    if (!ok) throw new UnauthorizedException('Неверный пароль');
    return { token: jwt.sign({ aid: row.id, v: row.share_token_version, typ: 'aura-share' }, this.secret(), { expiresIn: SHARE_TOKEN_TTL }) };
  }

  /** Данные считаются с правами того, кто включил ссылку — зритель видит ровно то, что видел он. */
  async publicData(shareKey: string, token: string | undefined, query: { period?: string; filters?: string; tz?: string }) {
    const { row, tenant } = await this.resolvePublic(shareKey);
    this.checkToken(row, token);
    const sharer = row.shared_by || row.owner_user_id;
    const users: Array<{ id: string; role: string; email: string }> = await this.dataSource.query(
      `SELECT "id","role","email" FROM "users" WHERE "id" = $1 AND "tenantId" = $2 LIMIT 1`,
      [sharer, row.tenant_id],
    );
    if (!users[0]) throw new NotFoundException('Ссылка недоступна');
    const cfg = sanitizeAuraConfig(row.config);
    const q = AuraService.parseQuery(query);
    const scope = await this.data.buildScope(row.tenant_id, { userId: users[0].id, role: users[0].role, email: users[0].email });
    const data = await this.data.compute(scope, { widgets: cfg.widgets, period: q.period || cfg.period, filters: q.filters, breakdown: cfg.breakdown, goals: cfg.goals, tz: q.tz, custom: cfg.custom });
    return {
      app: { name: row.name, theme: row.theme, density: row.density, refreshSec: row.refresh_sec, config: { ...cfg, prompt: '' }, companyName: tenant.name },
      data,
    };
  }
}
