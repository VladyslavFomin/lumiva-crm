import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../companies/company.entity';
import { Contact } from '../contacts/contact.entity';
import { AmocrmApiService } from '../integrations/amocrm/amocrm-api.service';
import { BitrixRestService } from '../integrations/bitrix/bitrix-rest.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { Lead } from '../leads/lead.entity';
import { parseCsvRobust, parseXlsxRobust } from '../lib/import-spreadsheet.util';
import { StaffUser } from '../staff/staff-user.entity';
import { Tenant } from '../tenants/tenant.entity';
import { CrmMigrationExternalId } from './crm-migration-external-id.entity';
import { CrmMigrationRun, MigrationCounter, MigrationSource } from './crm-migration-run.entity';
import {
  AmoSource,
  BitrixSource,
  LeadStatus,
  MigrationSourceAdapter,
  NormCompany,
  NormContact,
  NormLead,
  NormStage,
  NormUser,
} from './crm-migration-sources';

const LEAD_STATUSES: LeadStatus[] = ['new', 'in_progress', 'waiting', 'won', 'lost'];
const MAX_FILE_ROWS = 50_000;
const MAX_WARNINGS = 30;

export type SourceInput = {
  source: 'amocrm' | 'bitrix24';
  /** Существующее подключение из «Интеграций» */
  connectionId?: string;
  /** amoCRM: https://<поддомен>.amocrm.ru + долгосрочный токен */
  baseUrl?: string;
  token?: string;
  /** Битрикс24: входящий вебхук https://<портал>.bitrix24.ru/rest/1/<код>/ */
  webhookUrl?: string;
};

export type RunInput = SourceInput & {
  include?: { companies?: boolean; contacts?: boolean; deals?: boolean; leads?: boolean };
  /** ключ этапа → статус лида; не указанные — по предложению мастера */
  statusMap?: Record<string, string>;
  /** склеивать с уже существующими записями (компания — по названию, контакт — по email/телефону) */
  mergeExisting?: boolean;
};

export type FileTarget = 'contacts' | 'companies' | 'leads';

export const FILE_FIELDS: Record<FileTarget, string[]> = {
  contacts: ['name', 'firstName', 'lastName', 'email', 'phone', 'position', 'company', 'city', 'country', 'address', 'website', 'telegram', 'tags'],
  companies: ['name', 'email', 'phone', 'website', 'address', 'city', 'country', 'industry', 'taxId', 'description'],
  leads: ['name', 'email', 'phone', 'company', 'status', 'amount', 'currency', 'source', 'notes'],
};

/** Подсказка сопоставления колонок файла по названию (ru / en / tr). */
const HEADER_HINTS: Array<[RegExp, string]> = [
  [/^(e-?mail|почта|эл\.?\s*почта|e-?posta)/i, 'email'],
  [/(телефон|phone|tel\b|mobile|мобильн|telefon|gsm)/i, 'phone'],
  [/^(имя|first\s*name|ad\b|adı)/i, 'firstName'],
  [/^(фамилия|last\s*name|soyad)/i, 'lastName'],
  [/(фио|full\s*name|контакт|contact\s*name|^name$|^ad soyad|название сделки|deal name|сделка|^lead)/i, 'name'],
  [/(должность|position|job\s*title|title|unvan|görev)/i, 'position'],
  [/(компания|организация|company|organization|şirket|firma)/i, 'company'],
  [/(город|city|şehir)/i, 'city'],
  [/(страна|country|ülke)/i, 'country'],
  [/(адрес|address|adres)/i, 'address'],
  [/(сайт|website|web|url|site)/i, 'website'],
  [/telegram/i, 'telegram'],
  [/(тег|tags?|etiket)/i, 'tags'],
  [/(этап|стади|статус|stage|status|durum|aşama)/i, 'status'],
  [/(бюджет|сумма|amount|price|budget|tutar|fiyat)/i, 'amount'],
  [/(валюта|currency|para birimi)/i, 'currency'],
  [/(источник|source|kaynak)/i, 'source'],
  [/(примечани|коммент|заметк|notes?|comment|not\b|açıklama)/i, 'notes'],
  [/(отрасль|industry|sektör)/i, 'industry'],
  [/(инн|tax|vergi|vkn)/i, 'taxId'],
  [/(описани|description)/i, 'description'],
];

const zero = (): MigrationCounter => ({ created: 0, updated: 0, skipped: 0, failed: 0 });
const digits = (s: string | null | undefined) => String(s || '').replace(/\D/g, '');
const clip = (s: string | null | undefined, n: number) => (s == null ? null : String(s).slice(0, n) || null);

function statusFromText(v: string | null | undefined): LeadStatus | null {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return null;
  if ((LEAD_STATUSES as string[]).includes(s)) return s as LeadStatus;
  if (/(успеш|выигр|won|win|оплач|kazan|başarı|closed won|реализовано)/.test(s) && !/не\s*реализ/.test(s)) return 'won';
  if (/(проигр|отказ|lost|lose|не\s*реализ|закрыт.*не|kaybed|iptal|junk)/.test(s)) return 'lost';
  if (/(нов|new|yeni|неразобр)/.test(s)) return 'new';
  if (/(ожидан|wait|bekle|пауза)/.test(s)) return 'waiting';
  return 'in_progress';
}

@Injectable()
export class CrmMigrationService {
  private readonly log = new Logger(CrmMigrationService.name);

  constructor(
    @InjectRepository(CrmMigrationRun) private readonly runs: Repository<CrmMigrationRun>,
    @InjectRepository(CrmMigrationExternalId) private readonly extIds: Repository<CrmMigrationExternalId>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(Contact) private readonly contacts: Repository<Contact>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(StaffUser) private readonly staff: Repository<StaffUser>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly integrations: IntegrationsService,
    private readonly amo: AmocrmApiService,
    private readonly bitrix: BitrixRestService,
  ) {}

  // ───────────────────────── источники ─────────────────────────

  async listConnections(tenantId: string) {
    const all = await this.integrations.findAllForTenant(tenantId).catch(() => []);
    return (all as Array<{ id: string; name: string; kind: string; linkCatalogId?: string | null; isEnabled?: boolean }>)
      .filter((c) => c.kind === 'third_party_link' && (c.linkCatalogId === 'amocrm' || c.linkCatalogId === 'bitrix'))
      .map((c) => ({ id: c.id, name: c.name, source: c.linkCatalogId === 'amocrm' ? 'amocrm' : 'bitrix24' }));
  }

  private async adapter(tenantId: string, input: SourceInput): Promise<MigrationSourceAdapter> {
    if (input.source === 'amocrm') {
      if (input.connectionId) {
        const cred = await this.integrations.getAmocrmCredentialsForConnection(tenantId, input.connectionId);
        if (!cred) throw new BadRequestException('В подключении amoCRM нет адреса аккаунта или токена');
        return new AmoSource(this.amo, cred.baseUrl, cred.accessToken);
      }
      const base = String(input.baseUrl || '').trim();
      const token = String(input.token || '').trim();
      if (!base || !token) throw new BadRequestException('Укажите адрес аккаунта amoCRM и долгосрочный токен');
      return new AmoSource(this.amo, base.startsWith('http') ? base : `https://${base}`, token);
    }
    if (input.source === 'bitrix24') {
      if (input.connectionId) {
        const base = await this.integrations.getBitrixWebhookBaseForConnection(tenantId, input.connectionId);
        if (!base) throw new BadRequestException('В подключении Битрикс24 нет адреса вебхука');
        return new BitrixSource(this.bitrix, base);
      }
      const url = String(input.webhookUrl || '').trim();
      if (!url) throw new BadRequestException('Укажите адрес входящего вебхука Битрикс24');
      return new BitrixSource(this.bitrix, url);
    }
    throw new BadRequestException('Неизвестный источник');
  }

  private async staffByEmail(tenantId: string): Promise<Map<string, { id: string; name: string }>> {
    const rows = await this.staff.find({ where: { tenantId } });
    const m = new Map<string, { id: string; name: string }>();
    for (const s of rows) {
      const email = s.email?.trim().toLowerCase();
      if (email) m.set(email, { id: s.id, name: (s.fullName || s.email || '').trim() });
    }
    return m;
  }

  async preview(tenantId: string, input: SourceInput) {
    const src = await this.adapter(tenantId, input);
    let account: { name: string; currency: string | null };
    try {
      account = await src.account();
    } catch (e) {
      throw new BadRequestException(`Не удалось подключиться: ${(e as Error).message}`.slice(0, 500));
    }
    const [stages, counts, users, staff] = await Promise.all([
      src.stages().catch(() => []),
      src.counts().catch(() => ({})),
      src.users().catch(() => [] as NormUser[]),
      this.staffByEmail(tenantId),
    ]);
    const matched = users.filter((u) => u.email && staff.has(u.email));
    return {
      account,
      stages,
      counts,
      users: {
        total: users.length,
        matched: matched.length,
        unmatched: users.filter((u) => !u.email || !staff.has(u.email)).map((u) => u.name || u.email || u.extId).slice(0, 50),
      },
      hasLeadsEntity: typeof src.leads === 'function',
    };
  }

  // ───────────────────────── запуски ─────────────────────────

  listRuns(tenantId: string) {
    return this.runs.find({ where: { tenantId }, order: { startedAt: 'DESC' }, take: 20 });
  }

  async getRun(tenantId: string, id: string) {
    const r = await this.runs.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Run not found');
    return r;
  }

  private async assertNoRunning(tenantId: string) {
    const running = await this.runs.findOne({ where: { tenantId, status: 'running' } });
    // зависший запуск (рестарт сервера посреди переноса) не блокирует навсегда
    if (running && Date.now() - new Date(running.startedAt).getTime() < 6 * 3600e3) {
      throw new ConflictException('Перенос уже идёт — дождитесь его завершения');
    }
    if (running) await this.runs.update({ id: running.id }, { status: 'failed', error: 'Прервано (перезапуск сервера)', finishedAt: new Date() });
  }

  async start(tenantId: string, userId: string | null, input: RunInput) {
    await this.assertNoRunning(tenantId);
    const src = await this.adapter(tenantId, input);
    await src.account().catch((e) => {
      throw new BadRequestException(`Не удалось подключиться: ${(e as Error).message}`.slice(0, 500));
    });
    const include = {
      companies: input.include?.companies !== false,
      contacts: input.include?.contacts !== false,
      deals: input.include?.deals !== false,
      leads: typeof src.leads === 'function' && input.include?.leads !== false,
    };
    const statusMap: Record<string, LeadStatus> = {};
    for (const [k, v] of Object.entries(input.statusMap || {})) {
      if ((LEAD_STATUSES as string[]).includes(v)) statusMap[k] = v as LeadStatus;
    }
    const run = await this.runs.save(
      this.runs.create({
        tenantId,
        source: input.source,
        status: 'running',
        stage: null,
        options: { include, mergeExisting: input.mergeExisting !== false, connectionId: input.connectionId || null, statusMapSize: Object.keys(statusMap).length },
        counters: {},
        warnings: [],
        createdByUserId: userId,
      }),
    );
    void this.execute(run, src, include, statusMap, input.mergeExisting !== false).catch((e) =>
      this.log.error(`Migration ${run.id} crashed: ${(e as Error).stack || e}`),
    );
    return run;
  }

  /** Общий контекст переноса: карта внешних ID, сотрудники, счётчики. */
  private async context(run: CrmMigrationRun) {
    const rows = await this.extIds.find({ where: { tenantId: run.tenantId, source: run.source } });
    const map = new Map(rows.map((r) => [`${r.entityType}:${r.externalId}`, r.localId]));
    const tenant = await this.tenants.findOne({ where: { id: run.tenantId } });
    const counters: Record<string, MigrationCounter> = {};
    const warnings: string[] = [];
    const ctx = {
      map,
      counters,
      warnings,
      tenantCurrency: (tenant?.primaryCurrency || 'TRY').toUpperCase().slice(0, 3),
      bump: (stage: string, k: keyof MigrationCounter) => {
        (counters[stage] ||= zero())[k]++;
      },
      warn: (msg: string) => {
        if (warnings.length < MAX_WARNINGS) warnings.push(msg.slice(0, 300));
      },
      remember: async (entityType: string, externalId: string, localId: string) => {
        map.set(`${entityType}:${externalId}`, localId);
        await this.extIds
          .createQueryBuilder()
          .insert()
          .values({ tenantId: run.tenantId, source: run.source, entityType, externalId, localId })
          .orUpdate(['localId'], ['tenantId', 'source', 'entityType', 'externalId'])
          .execute();
      },
      flush: (stage: string | null) => this.runs.update({ id: run.id }, { stage, counters: { ...counters }, warnings: [...warnings] }),
    };
    return ctx;
  }

  private async execute(
    run: CrmMigrationRun,
    src: MigrationSourceAdapter,
    include: { companies: boolean; contacts: boolean; deals: boolean; leads: boolean },
    statusMap: Record<string, LeadStatus>,
    mergeExisting: boolean,
  ) {
    const ctx = await this.context(run);
    const tenantId = run.tenantId;
    try {
      const staff = await this.staffByEmail(tenantId);
      const users = await src.users().catch(() => [] as NormUser[]);
      const owner = new Map<string, { id: string; name: string }>();
      for (const u of users) {
        const s = u.email ? staff.get(u.email) : undefined;
        if (s) owner.set(u.extId, s);
      }
      const assign = (extId: string | null) => {
        const s = extId ? owner.get(extId) : undefined;
        return s
          ? { assignedUserIds: [s.id], assignedUserId: s.id, assignedTo: s.name || null }
          : null;
      };
      const stageList: NormStage[] = await src.stages().catch(() => [] as NormStage[]);
      const stages = new Map(stageList.map((s) => [s.key, s] as const));

      if (include.companies) {
        await ctx.flush('companies');
        await src.companies(async (items) => {
          for (const c of items) await this.upsertCompany(tenantId, run.source, c, assign(c.responsibleExtId), mergeExisting, ctx).catch((e) => {
            ctx.bump('companies', 'failed');
            ctx.warn(`Компания «${c.name}»: ${(e as Error).message}`);
          });
          await ctx.flush('companies');
        });
      }
      if (include.contacts) {
        await ctx.flush('contacts');
        await src.contacts(async (items) => {
          for (const c of items) await this.upsertContact(tenantId, run.source, c, assign(c.responsibleExtId), mergeExisting, ctx).catch((e) => {
            ctx.bump('contacts', 'failed');
            ctx.warn(`Контакт #${c.extId}: ${(e as Error).message}`);
          });
          await ctx.flush('contacts');
        });
      }
      const leadStage = async (stage: 'deals' | 'leads', items: NormLead[]) => {
        for (const l of items) {
          const status = (l.stageKey && (statusMap[l.stageKey] || stages.get(l.stageKey)?.suggested)) || 'in_progress';
          await this.upsertLead(tenantId, run.source, stage, l, status, assign(l.responsibleExtId), ctx).catch((e) => {
            ctx.bump(stage, 'failed');
            ctx.warn(`${stage === 'deals' ? 'Сделка' : 'Лид'} «${l.name}»: ${(e as Error).message}`);
          });
        }
        await ctx.flush(stage);
      };
      if (include.deals) {
        await ctx.flush('deals');
        await src.deals((items) => leadStage('deals', items));
      }
      if (include.leads && src.leads) {
        await ctx.flush('leads');
        await src.leads((items) => leadStage('leads', items));
      }
      await this.runs.update({ id: run.id }, { status: 'done', stage: null, counters: ctx.counters, warnings: ctx.warnings, finishedAt: new Date() });
    } catch (e) {
      this.log.warn(`Migration ${run.id} failed: ${(e as Error).message}`);
      await this.runs.update(
        { id: run.id },
        { status: 'failed', counters: ctx.counters, warnings: ctx.warnings, error: String((e as Error).message || e).slice(0, 1000), finishedAt: new Date() },
      );
    }
  }

  // ───────────────────────── запись ─────────────────────────

  private async findCompanyByName(tenantId: string, name: string) {
    return this.companies.createQueryBuilder('c').where('c.tenantId = :tenantId AND lower(c.name) = lower(:name)', { tenantId, name }).getOne();
  }

  private async findContactByEmailOrPhone(tenantId: string, email: string | null, phone: string | null) {
    if (email) {
      const byEmail = await this.contacts.createQueryBuilder('c').where('c.tenantId = :tenantId AND lower(c.email) = lower(:email)', { tenantId, email }).getOne();
      if (byEmail) return byEmail;
    }
    const d = digits(phone);
    if (d.length >= 7) {
      return this.contacts
        .createQueryBuilder('c')
        .where("c.tenantId = :tenantId AND right(regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g'), 10) = right(:d, 10)", { tenantId, d })
        .getOne();
    }
    return null;
  }

  /** Заполняем только пустые поля — правки, сделанные уже в Lumiva, не затираем. */
  private fillEmpty<T extends object>(target: T, patch: Partial<T>): boolean {
    let changed = false;
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') continue;
      const cur = (target as any)[k];
      if (cur == null || cur === '' || (Array.isArray(cur) && !cur.length)) {
        (target as any)[k] = v;
        changed = true;
      }
    }
    return changed;
  }

  private async upsertCompany(
    tenantId: string,
    source: string,
    c: NormCompany,
    owner: { assignedUserIds: string[]; assignedUserId: string; assignedTo: string | null } | null,
    merge: boolean,
    ctx: Awaited<ReturnType<CrmMigrationService['context']>>,
  ) {
    const fields: Partial<Company> = {
      name: clip(c.name, 255)!,
      phone: clip(c.phone, 64),
      email: clip(c.email, 255),
      website: clip(c.website, 255),
      address: c.address,
      ...(owner || {}),
    };
    const known = ctx.map.get(`company:${c.extId}`);
    let row = known ? await this.companies.findOne({ where: { id: known, tenantId } }) : null;
    if (!row && merge && c.name) row = await this.findCompanyByName(tenantId, c.name);
    if (row) {
      if (this.fillEmpty(row, fields)) {
        await this.companies.save(row);
        ctx.bump('companies', 'updated');
      } else ctx.bump('companies', 'skipped');
    } else {
      row = await this.companies.save(this.companies.create({ tenantId, ...fields, meta: { migration: { source, extId: c.extId } } } as Partial<Company>));
      ctx.bump('companies', 'created');
    }
    if (known !== row.id) await ctx.remember('company', c.extId, row.id);
  }

  private async upsertContact(
    tenantId: string,
    source: string,
    c: NormContact,
    owner: { assignedUserIds: string[]; assignedUserId: string; assignedTo: string | null } | null,
    merge: boolean,
    ctx: Awaited<ReturnType<CrmMigrationService['context']>>,
  ) {
    const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || null;
    if (!fullName && !c.phone) {
      ctx.bump('contacts', 'skipped');
      return;
    }
    const companyId = c.companyExtId ? ctx.map.get(`company:${c.companyExtId}`) ?? null : null;
    const fields: Partial<Contact> = {
      firstName: clip(c.firstName, 255),
      lastName: clip(c.lastName, 255),
      fullName: clip(fullName || c.phone, 255),
      email: clip(c.email, 255),
      phone: clip(c.phone, 64),
      position: clip(c.position, 255),
      companyId,
      ...(owner || {}),
    };
    const known = ctx.map.get(`contact:${c.extId}`);
    let row = known ? await this.contacts.findOne({ where: { id: known, tenantId } }) : null;
    if (!row && merge) row = await this.findContactByEmailOrPhone(tenantId, c.email, c.phone);
    if (row) {
      if (this.fillEmpty(row, fields)) {
        await this.contacts.save(row);
        ctx.bump('contacts', 'updated');
      } else ctx.bump('contacts', 'skipped');
    } else {
      row = await this.contacts.save(this.contacts.create({ tenantId, ...fields, meta: { migration: { source, extId: c.extId } } } as Partial<Contact>));
      ctx.bump('contacts', 'created');
    }
    if (known !== row.id) await ctx.remember('contact', c.extId, row.id);
  }

  private async upsertLead(
    tenantId: string,
    source: string,
    stage: 'deals' | 'leads',
    l: NormLead,
    status: LeadStatus,
    owner: { assignedUserIds: string[]; assignedUserId: string; assignedTo: string | null } | null,
    ctx: Awaited<ReturnType<CrmMigrationService['context']>>,
  ) {
    const key = `${l.kind}:${l.extId}`;
    const contactId = l.contactExtId ? ctx.map.get(`contact:${l.contactExtId}`) ?? null : null;
    const companyId = l.companyExtId ? ctx.map.get(`company:${l.companyExtId}`) ?? null : null;
    let phone = l.phone;
    let email = l.email;
    if (contactId && (!phone || !email)) {
      const c = await this.contacts.findOne({ where: { id: contactId, tenantId }, select: ['id', 'phone', 'email'] });
      phone = phone || c?.phone || null;
      email = email || c?.email || null;
    }
    const currency = /^[A-Za-z]{3}$/.test(l.currency || '') ? l.currency!.toUpperCase() : ctx.tenantCurrency;
    const meta = {
      migration: {
        source,
        kind: l.kind,
        extId: l.extId,
        pipeline: l.pipelineName,
        stage: l.stageName,
        createdAt: l.createdAt,
        closedAt: l.closedAt,
      },
    };

    const known = ctx.map.get(`lead:${key}`);
    const row = known ? await this.leads.findOne({ where: { id: known, tenantId } }) : null;
    if (row) {
      // повторный запуск: этап и сумма в старой CRM могли поменяться — обновляем их
      row.status = status;
      if (l.amount != null) row.amount = String(l.amount);
      row.currency = currency;
      this.fillEmpty(row, { contactId, companyId, phone: clip(phone, 64), email: clip(email, 255), ...(owner ? { assignedUserIds: owner.assignedUserIds, assignedUserId: owner.assignedUserId, assignedTo: owner.assignedTo } : {}) });
      row.meta = { ...(row.meta || {}), ...meta };
      await this.leads.save(row);
      ctx.bump(stage, 'updated');
      return;
    }
    // напрямую через репозиторий: LeadsService.createForTenant будит автоматизации и ИИ-сотрудников
    // на каждую запись — при переносе тысяч старых сделок это лавина писем и задач
    const saved = await this.leads.save(
      this.leads.create({
        tenantId,
        name: clip(l.name, 255),
        phone: clip(phone, 64),
        email: clip(email, 255),
        status,
        source,
        amount: l.amount != null ? String(l.amount) : '0',
        currency,
        contactId,
        companyId,
        assignedUserIds: owner?.assignedUserIds ?? null,
        assignedUserId: owner?.assignedUserId ?? null,
        assignedTo: owner?.assignedTo ?? null,
        assignedToList: owner?.assignedTo ? [owner.assignedTo] : null,
        meta,
      } as Partial<Lead>),
    );
    ctx.bump(stage, 'created');
    await ctx.remember('lead', key, saved.id);
  }

  // ───────────────────────── Excel / CSV ─────────────────────────

  private async parseFile(buffer: Buffer, filename: string) {
    const name = filename.toLowerCase();
    if (name.endsWith('.xls')) {
      throw new BadRequestException('Старый формат .xls не поддерживается — пересохраните файл как .xlsx или CSV');
    }
    const parsed = name.endsWith('.xlsx')
      ? await parseXlsxRobust(buffer)
      : (() => {
          const t = parseCsvRobust(buffer.toString('utf8').replace(/^﻿/, ''));
          return { columns: t.columns, rows: t.rows as Array<Record<string, any>> };
        })();
    if (!parsed.columns.length) throw new BadRequestException('В файле не нашли строку заголовков');
    // строки вида ";;;;" парсер CSV отдаёт как данные — в счётчиках и превью их быть не должно
    parsed.rows = parsed.rows.filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''));
    if (parsed.rows.length > MAX_FILE_ROWS) throw new BadRequestException(`В файле больше ${MAX_FILE_ROWS} строк — разделите его на части`);
    return parsed;
  }

  suggestMapping(columns: string[], target: FileTarget): Record<string, string> {
    const allowed = new Set(FILE_FIELDS[target]);
    const used = new Set<string>();
    const out: Record<string, string> = {};
    for (const col of columns) {
      const hit = HEADER_HINTS.find(([re, f]) => re.test(col.trim()) && allowed.has(f) && !used.has(f));
      // для компаний «Название» — это name
      const field = hit?.[1] ?? (target === 'companies' && /(назван|name|^ad$|unvan)/i.test(col) && !used.has('name') ? 'name' : null);
      if (field) {
        out[col] = field;
        used.add(field);
      } else out[col] = 'skip';
    }
    return out;
  }

  async filePreview(buffer: Buffer, filename: string) {
    const p = await this.parseFile(buffer, filename);
    return {
      columns: p.columns,
      sample: p.rows.slice(0, 5).map((r) => p.columns.map((c) => String(r[c] ?? ''))),
      totalRows: p.rows.length,
      fields: FILE_FIELDS,
      suggested: {
        contacts: this.suggestMapping(p.columns, 'contacts'),
        companies: this.suggestMapping(p.columns, 'companies'),
        leads: this.suggestMapping(p.columns, 'leads'),
      },
    };
  }

  async fileStart(
    tenantId: string,
    userId: string | null,
    buffer: Buffer,
    filename: string,
    target: FileTarget,
    mapping: Record<string, string>,
    mergeExisting: boolean,
  ) {
    if (!FILE_FIELDS[target]) throw new BadRequestException('Неизвестный тип записей');
    await this.assertNoRunning(tenantId);
    const p = await this.parseFile(buffer, filename);
    const allowed = new Set(FILE_FIELDS[target]);
    const colFor: Record<string, string> = {};
    for (const [col, field] of Object.entries(mapping || {})) {
      if (allowed.has(field) && p.columns.includes(col)) colFor[field] = col;
    }
    if (!Object.keys(colFor).length) throw new BadRequestException('Сопоставьте хотя бы одну колонку');
    const run = await this.runs.save(
      this.runs.create({
        tenantId,
        source: 'file' as MigrationSource,
        status: 'running',
        stage: target,
        options: { target, filename: filename.slice(0, 200), rows: p.rows.length, mergeExisting, fields: Object.keys(colFor) },
        counters: {},
        warnings: [],
        createdByUserId: userId,
      }),
    );
    void this.executeFile(run, p.rows, target, colFor, mergeExisting).catch((e) =>
      this.log.error(`File migration ${run.id} crashed: ${(e as Error).stack || e}`),
    );
    return run;
  }

  private async executeFile(run: CrmMigrationRun, rows: Array<Record<string, any>>, target: FileTarget, colFor: Record<string, string>, merge: boolean) {
    const ctx = await this.context(run);
    const tenantId = run.tenantId;
    const companyCache = new Map<string, string>();
    const companyId = async (name: string | null): Promise<string | null> => {
      if (!name) return null;
      const k = name.trim().toLowerCase();
      if (companyCache.has(k)) return companyCache.get(k)!;
      let c = await this.findCompanyByName(tenantId, name.trim());
      if (!c) {
        c = await this.companies.save(this.companies.create({ tenantId, name: clip(name.trim(), 255)!, meta: { migration: { source: 'file' } } } as Partial<Company>));
        ctx.bump('companies', 'created');
      }
      companyCache.set(k, c.id);
      return c.id;
    };
    try {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const get = (f: string): string | null => {
          const col = colFor[f];
          const v = col ? String(r[col] ?? '').trim() : '';
          return v || null;
        };
        try {
          if (target === 'companies') {
            const name = get('name');
            if (!name) {
              ctx.bump(target, 'skipped');
              continue;
            }
            const fields: Partial<Company> = {
              name: clip(name, 255)!,
              email: clip(get('email'), 255),
              phone: clip(get('phone'), 64),
              website: clip(get('website'), 255),
              address: get('address'),
              city: clip(get('city'), 128),
              country: clip(get('country'), 64),
              industry: clip(get('industry'), 128),
              taxId: clip(get('taxId'), 64),
              description: get('description'),
            };
            const existing = merge ? await this.findCompanyByName(tenantId, name) : null;
            if (existing) {
              if (this.fillEmpty(existing, fields)) {
                await this.companies.save(existing);
                ctx.bump(target, 'updated');
              } else ctx.bump(target, 'skipped');
            } else {
              await this.companies.save(this.companies.create({ tenantId, ...fields, meta: { migration: { source: 'file' } } } as Partial<Company>));
              ctx.bump(target, 'created');
            }
          } else if (target === 'contacts') {
            let first = get('firstName');
            let last = get('lastName');
            const name = get('name');
            if (!first && !last && name) {
              const parts = name.split(/\s+/);
              first = parts.shift() || null;
              last = parts.join(' ') || null;
            }
            const email = get('email');
            const phone = get('phone');
            const fullName = [first, last].filter(Boolean).join(' ') || email || phone;
            if (!fullName) {
              ctx.bump(target, 'skipped');
              continue;
            }
            const tags = (get('tags') || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean);
            const fields: Partial<Contact> = {
              firstName: clip(first, 255),
              lastName: clip(last, 255),
              fullName: clip(fullName, 255),
              email: clip(email, 255),
              phone: clip(phone, 64),
              position: clip(get('position'), 255),
              city: clip(get('city'), 128),
              country: clip(get('country'), 64),
              address: get('address'),
              website: clip(get('website'), 255),
              telegram: clip(get('telegram'), 128),
              companyId: await companyId(get('company')),
              ...(tags.length ? { tags } : {}),
            };
            const existing = merge ? await this.findContactByEmailOrPhone(tenantId, email, phone) : null;
            if (existing) {
              if (this.fillEmpty(existing, fields)) {
                await this.contacts.save(existing);
                ctx.bump(target, 'updated');
              } else ctx.bump(target, 'skipped');
            } else {
              await this.contacts.save(this.contacts.create({ tenantId, ...fields, meta: { migration: { source: 'file' } } } as Partial<Contact>));
              ctx.bump(target, 'created');
            }
          } else {
            const name = get('name');
            const email = get('email');
            const phone = get('phone');
            if (!name && !email && !phone) {
              ctx.bump(target, 'skipped');
              continue;
            }
            const amountRaw = get('amount');
            const amount = amountRaw ? Number(amountRaw.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '')) : NaN;
            const cur = get('currency');
            const company = get('company');
            await this.leads.save(
              this.leads.create({
                tenantId,
                name: clip(name || email || phone, 255),
                email: clip(email, 255),
                phone: clip(phone, 64),
                status: statusFromText(get('status')) || 'new',
                source: clip(get('source'), 64) || 'import',
                amount: Number.isFinite(amount) ? String(amount) : '0',
                currency: cur && /^[A-Za-z]{3}$/.test(cur) ? cur.toUpperCase() : ctx.tenantCurrency,
                companyId: await companyId(company),
                meta: { migration: { source: 'file', row: i + 2 }, ...(get('notes') ? { notes: get('notes') } : {}) },
              } as Partial<Lead>),
            );
            ctx.bump(target, 'created');
          }
        } catch (e) {
          ctx.bump(target, 'failed');
          ctx.warn(`Строка ${i + 2}: ${(e as Error).message}`);
        }
        if (i % 200 === 199) await ctx.flush(target);
      }
      await this.runs.update({ id: run.id }, { status: 'done', stage: null, counters: ctx.counters, warnings: ctx.warnings, finishedAt: new Date() });
    } catch (e) {
      await this.runs.update(
        { id: run.id },
        { status: 'failed', counters: ctx.counters, warnings: ctx.warnings, error: String((e as Error).message || e).slice(0, 1000), finishedAt: new Date() },
      );
    }
  }

  /** Сколько записей уже перенесено из источника (для подсказки «повторный запуск обновит»). */
  async importedCounts(tenantId: string) {
    const rows: Array<{ source: string; entityType: string; n: string }> = await this.extIds
      .createQueryBuilder('e')
      .select('e.source', 'source')
      .addSelect('e.entityType', 'entityType')
      .addSelect('COUNT(*)', 'n')
      .where('e.tenantId = :tenantId', { tenantId })
      .groupBy('e.source')
      .addGroupBy('e.entityType')
      .getRawMany();
    return rows.map((r) => ({ source: r.source, entityType: r.entityType, count: Number(r.n) }));
  }
}
