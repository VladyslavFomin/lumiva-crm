// src/media/media-public.service.ts
import { BadRequestException, ForbiddenException, GoneException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Not, Repository } from 'typeorm';
import type { Request, Response } from 'express';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import * as bcrypt from 'bcryptjs';
// archiver — уже транзитивная зависимость exceljs, добавлен в package.json явно.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver = require('archiver');
import { Hotel } from '../hotels/hotel.entity';
import { Tenant } from '../tenants/tenant.entity';
import { Lead } from '../leads/lead.entity';
import { Contact } from '../contacts/contact.entity';
import { Company } from '../companies/company.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { LeadsService } from '../leads/leads.service';
import { LeadActivityService } from '../leads/lead-activity.service';
import { joinUploadsAbsolute } from '../common/uploads-root.util';
import { getClientIp } from '../common/client-ip.util';
import { MediaEvent, MediaEventType, MediaFile, MediaFolder, MediaLink, MediaVisitor } from './media.entities';
import { MediaService } from './media.service';
import { MEDIA_TICKET_TTL_SEC } from './media.constants';
import { signPayload, verifyPayload, verifyPreviewSig, type AccessToken, type DownloadTicket } from './media-token.util';

const visitorRe = /^[A-Za-z0-9_-]{16,64}$/;
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LinkContext {
  link: MediaLink;
  folders: MediaFolder[];
  files: MediaFile[];
}

@Injectable()
export class MediaPublicService {
  private readonly logger = new Logger(MediaPublicService.name);

  constructor(
    @InjectRepository(MediaLink) private readonly links: Repository<MediaLink>,
    @InjectRepository(MediaFolder) private readonly folders: Repository<MediaFolder>,
    @InjectRepository(MediaFile) private readonly files: Repository<MediaFile>,
    @InjectRepository(MediaEvent) private readonly events: Repository<MediaEvent>,
    @InjectRepository(MediaVisitor) private readonly visitors: Repository<MediaVisitor>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(Contact) private readonly contacts: Repository<Contact>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(StaffUser) private readonly staff: Repository<StaffUser>,
    private readonly media: MediaService,
    private readonly leadsService: LeadsService,
    private readonly leadActivity: LeadActivityService,
  ) {}

  // ───────────── доступ к ссылке ─────────────

  private async linkBySlug(slug: string): Promise<MediaLink> {
    const s = String(slug || '').toLowerCase().slice(0, 80);
    const link = await this.links
      .createQueryBuilder('l')
      .addSelect('l.passwordHash')
      .where('l.slug = :s', { s })
      .getOne();
    if (!link) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: 'Ссылка не найдена' });
    return link;
  }

  private assertOpen(link: MediaLink) {
    if (!link.enabled) throw new GoneException({ code: 'MEDIA_CLOSED', message: 'Доступ закрыт' });
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      throw new GoneException({ code: 'MEDIA_EXPIRED', message: 'Срок действия ссылки истёк' });
    }
  }

  private passOk(link: MediaLink, access: string | undefined): boolean {
    if (!link.passwordHash) return true;
    const p = verifyPayload<AccessToken>(String(access || ''));
    return !!p && p.l === link.id && p.h === link.passwordHash.slice(-10);
  }

  private async open(slug: string, access: string | undefined): Promise<MediaLink> {
    const link = await this.linkBySlug(slug);
    this.assertOpen(link);
    if (!this.passOk(link, access)) throw new ForbiddenException({ code: 'MEDIA_PASSWORD', message: 'Нужен пароль' });
    return link;
  }

  /** Всё, что видит клиент: выбранные папки с подпапками + отдельные файлы. */
  private async context(link: MediaLink): Promise<LinkContext> {
    await this.media.syncAutoLinks(link.tenantId, link);
    const folderIds = await this.media.subtreeIds(link.tenantId, link.folderIds || []);
    const [folders, inFolders, loose]: [MediaFolder[], MediaFile[], MediaFile[]] = await Promise.all([
      folderIds.length ? this.folders.find({ where: { tenantId: link.tenantId, id: In(folderIds) }, order: { name: 'ASC' } }) : [],
      folderIds.length ? this.files.find({ where: { tenantId: link.tenantId, folderId: In(folderIds) }, order: { name: 'ASC' } }) : [],
      link.fileIds?.length ? this.files.find({ where: { tenantId: link.tenantId, id: In(link.fileIds) }, order: { name: 'ASC' } }) : [],
    ]);
    const seen = new Set(inFolders.map((f) => f.id));
    return { link, folders, files: [...inFolders, ...loose.filter((f) => !seen.has(f.id))] };
  }

  private async visitor(tenantId: string, token: string | undefined, touch = true): Promise<MediaVisitor | null> {
    const t = String(token || '');
    if (!visitorRe.test(t)) return null;
    let v = await this.visitors.findOne({ where: { tenantId, token: t } });
    if (!v) {
      // первые запросы страницы идут параллельно — вставка без гонки по уникальному (tenantId, token)
      await this.visitors.createQueryBuilder().insert().into(MediaVisitor).values({ tenantId, token: t, lastSeenAt: new Date() }).orIgnore().execute();
      v = await this.visitors.findOne({ where: { tenantId, token: t } });
    } else if (touch) {
      await this.visitors.update({ id: v.id }, { lastSeenAt: new Date() });
    }
    return v;
  }

  private async formNeeded(link: MediaLink, v: MediaVisitor | null): Promise<boolean> {
    if (!link.gate) return false;
    if (!v?.formAt) return true;
    const s = await this.media.getSettings(link.tenantId);
    // «Спрашивать каждый раз»: форма перед каждым скачиванием (10 минут — на само скачивание после отправки)
    if (!s.reaskDays) return Date.now() - v.formAt.getTime() > 10 * 60 * 1000;
    return Date.now() - v.formAt.getTime() > s.reaskDays * 86400 * 1000;
  }

  private async log(link: MediaLink, v: MediaVisitor | null, type: MediaEventType, req: Request, extra: Partial<MediaEvent> = {}) {
    await this.events.save(
      this.events.create({
        tenantId: link.tenantId,
        linkId: link.id,
        visitorId: v?.id ?? null,
        type,
        ip: getClientIp(req)?.slice(0, 64) ?? null,
        userAgent: String(req.headers['user-agent'] || '').slice(0, 300) || null,
        ...extra,
      }),
    );
  }

  // ───────────── страница клиента ─────────────

  async getPage(slug: string, req: Request, lang?: string) {
    const link = await this.linkBySlug(slug);
    this.assertOpen(link);
    const tenant = await this.tenants.findOne({ where: { id: link.tenantId }, select: ['id', 'name', 'logoUrl', 'uiLanguage'] });
    const brand = { name: tenant?.name ?? null, logoUrl: tenant?.logoUrl ?? null, lang: tenant?.uiLanguage ?? null };
    if (!this.passOk(link, req.headers['x-media-access'] as string)) {
      return { needPassword: true, name: link.title || link.name, brand, theme: link.theme || 'dark' };
    }
    const v = await this.visitor(link.tenantId, req.headers['x-media-visitor'] as string);
    // Повторное открытие той же вкладки/обновление страницы в течение 30 минут — не новый переход.
    const recent = v
      ? await this.events.findOne({
          where: { linkId: link.id, visitorId: v.id, type: 'view', createdAt: MoreThan(new Date(Date.now() - 30 * 60 * 1000)) },
          select: ['id'],
        })
      : null;
    if (!recent) await this.log(link, v, 'view', req);

    const ctx = await this.context(link);
    const hotelIds = [...new Set([...ctx.folders.map((f) => f.hotelId), ...(link.hotelIds || [])].filter(Boolean))] as string[];
    const hotels = hotelIds.length
      ? await this.hotels.find({ where: { tenantId: link.tenantId, id: In(hotelIds) }, select: ['id', 'name', 'city'] })
      : [];
    const collIds = [...new Set(ctx.folders.map((f) => f.collectionId).filter(Boolean))] as string[];
    const collections: Array<{ id: string; name: string }> = collIds.length
      ? await this.folders.query(`SELECT id, name FROM media_collections WHERE "tenantId" = $1 AND id = ANY($2::uuid[]) ORDER BY name`, [link.tenantId, collIds])
      : [];
    const folderIdSet = new Set(ctx.folders.map((f) => f.id));
    const roots = new Set(link.folderIds || []);
    const form = link.gate ? await this.media.publicForm(link.tenantId, lang || link.lang || null) : null;
    const updatedAt = ctx.files.reduce<Date | null>((m, f) => (!m || f.createdAt > m ? f.createdAt : m), null);
    return {
      needPassword: false,
      brand,
      link: {
        name: link.title || null,
        description: link.description,
        lang: link.lang,
        scope: link.scope,
        gate: link.gate,
        allowZip: link.allowZip,
        theme: link.theme || 'dark',
        updatedAt,
      },
      hotels: hotels.map((h) => ({ id: h.id, name: h.name, city: h.city })),
      collections,
      folders: ctx.folders.map((f) => ({
        id: f.id,
        name: f.name,
        hotelId: f.hotelId,
        collectionId: f.collectionId,
        // корни ссылки показываем как верхний уровень, даже если в CRM они вложены глубже
        parentId: roots.has(f.id) || !f.parentId || !folderIdSet.has(f.parentId) ? null : f.parentId,
        createdAt: f.createdAt,
      })),
      looseFolderId: (link.fileIds || []).length ? '__selected' : null,
      files: ctx.files.map((f) => {
        const d = this.media.fileDto(f);
        const inLinkFolder = folderIdSet.has(f.folderId);
        return {
          id: d.id,
          folderId: inLinkFolder ? d.folderId : '__selected',
          name: d.name,
          ext: d.ext,
          kind: d.kind,
          sizeBytes: d.sizeBytes,
          width: d.width,
          height: d.height,
          durationSec: d.durationSec,
          thumbUrl: d.thumbUrl,
          viewUrl: d.viewUrl,
        };
      }),
      form,
      needForm: await this.formNeeded(link, v),
      me: v?.formAt ? { name: v.name } : null,
    };
  }

  async unlock(slug: string, password: string) {
    const link = await this.linkBySlug(slug);
    this.assertOpen(link);
    if (!link.passwordHash) return { access: null };
    const ok = await bcrypt.compare(String(password || ''), link.passwordHash);
    if (!ok) throw new ForbiddenException({ code: 'MEDIA_BAD_PASSWORD', message: 'Неверный пароль' });
    const t: AccessToken = { l: link.id, h: link.passwordHash.slice(-10), e: Math.floor(Date.now() / 1000) + 7 * 86400 };
    return { access: signPayload(t as unknown as Record<string, unknown>) };
  }

  async track(slug: string, req: Request, body: { type?: string; folderId?: string }) {
    const link = await this.open(slug, req.headers['x-media-access'] as string);
    const type = body.type === 'click' ? 'click' : body.type === 'open' ? 'open' : null;
    if (!type) return { ok: true };
    const v = await this.visitor(link.tenantId, req.headers['x-media-visitor'] as string, false);
    if (!v) return { ok: true };
    const folderId = body.folderId && uuidRe.test(body.folderId) ? body.folderId : null;
    // одно событие на посетителя/папку в час — иначе листание туда-обратно раздувает воронку
    const dup = await this.events.findOne({
      where: { linkId: link.id, visitorId: v.id, type, ...(folderId ? { folderId } : {}), createdAt: MoreThan(new Date(Date.now() - 3600 * 1000)) },
      select: ['id'],
    });
    if (!dup) await this.log(link, v, type, req, { folderId });
    return { ok: true };
  }

  // ───────────── форма → контакт + лид ─────────────

  async submitLead(slug: string, req: Request, body: { values?: Record<string, unknown>; lang?: string }) {
    const link = await this.open(slug, req.headers['x-media-access'] as string);
    const v = await this.visitor(link.tenantId, req.headers['x-media-visitor'] as string);
    if (!v) throw new BadRequestException('Обновите страницу и попробуйте снова');
    const settings = await this.media.getSettings(link.tenantId);
    // те же поля и варианты, что видел посетитель на своём языке
    const fields = (await this.media.publicForm(link.tenantId, body.lang || link.lang || null)).fields;
    const raw = body.values && typeof body.values === 'object' ? body.values : {};
    const values: Record<string, string | boolean> = {};
    const errors: Record<string, string> = {};
    for (const f of fields) {
      const val = raw[f.id];
      if (f.type === 'check') {
        values[f.id] = !!val;
        if (f.req && !val) errors[f.id] = 'required';
        continue;
      }
      const s = String(val ?? '').trim().slice(0, f.type === 'textarea' ? 2000 : 255);
      if (f.req && !s) errors[f.id] = 'required';
      else if (s && f.type === 'email' && !emailRe.test(s)) errors[f.id] = 'email';
      else if (s && f.type === 'select' && f.options?.length && !f.options.includes(s)) errors[f.id] = 'option';
      if (s) values[f.id] = s;
    }
    if (Object.keys(errors).length) throw new BadRequestException({ code: 'MEDIA_FORM_INVALID', errors, message: 'Проверьте поля формы' });

    const name = (values.name as string) || null;
    const email = ((values.email as string) || '').toLowerCase() || null;
    const phone = (values.phone as string) || null;
    const companyName = (values.company as string) || null;
    const role = (values.role as string) || null;

    const leadId = await this.upsertLead(link, settings, { name, email, phone, companyName, role, values }).catch((e) => {
      this.logger.error(`media lead failed for link ${link.id}: ${e?.message || e}`);
      return null;
    });

    await this.visitors.update(
      { id: v.id },
      {
        formData: values,
        name,
        email,
        phone,
        company: companyName,
        role,
        formAt: new Date(),
        ...(leadId ? { leadId: leadId.leadId, contactId: leadId.contactId } : {}),
      },
    );
    await this.log(link, v, 'lead', req, { what: name ? name.slice(0, 300) : null });
    return { ok: true, name };
  }

  private async upsertLead(
    link: MediaLink,
    settings: Awaited<ReturnType<MediaService['getSettings']>>,
    d: { name: string | null; email: string | null; phone: string | null; companyName: string | null; role: string | null; values: Record<string, unknown> },
  ): Promise<{ leadId: string; contactId: string | null }> {
    const tenantId = link.tenantId;
    const phoneDigits = (d.phone || '').replace(/\D/g, '');

    // Контакт: ищем по почте, затем по телефону.
    let contact: Contact | null = null;
    if (d.email) {
      contact = await this.contacts.createQueryBuilder('c').where('c.tenantId = :tenantId AND LOWER(c.email) = :e', { tenantId, e: d.email }).getOne();
    }
    if (!contact && phoneDigits.length >= 7) {
      contact = await this.contacts
        .createQueryBuilder('c')
        .where(`c.tenantId = :tenantId AND regexp_replace(coalesce(c.phone,''), '\\D', '', 'g') = :p`, { tenantId, p: phoneDigits })
        .getOne();
    }

    let companyId: string | null = contact?.companyId ?? null;
    if (d.companyName && !companyId) {
      const existing = await this.companies.createQueryBuilder('c').where('c.tenantId = :tenantId AND LOWER(c.name) = :n', { tenantId, n: d.companyName.toLowerCase() }).getOne();
      companyId = existing?.id ?? (await this.companies.save(this.companies.create({ tenantId, name: d.companyName } as Partial<Company>))).id;
    }

    const tags = settings.contactTags || [];
    if (!contact) {
      const [firstName, ...rest] = String(d.name || '').trim().split(/\s+/);
      contact = await this.contacts.save(
        this.contacts.create({
          tenantId,
          firstName: firstName || null,
          lastName: rest.join(' ') || null,
          fullName: d.name,
          email: d.email,
          phone: d.phone,
          companyId,
          position: d.role,
          tags,
          status: 'active',
        } as Partial<Contact>),
      );
    } else {
      const patch: Partial<Contact> = {};
      if (!contact.phone && d.phone) patch.phone = d.phone;
      if (!contact.email && d.email) patch.email = d.email;
      if (!contact.companyId && companyId) patch.companyId = companyId;
      const merged = [...new Set([...(contact.tags || []), ...tags])];
      if (merged.length !== (contact.tags || []).length) patch.tags = merged;
      if (Object.keys(patch).length) await this.contacts.update({ id: contact.id }, patch);
    }

    const hotelNames = link.hotelIds?.length
      ? (await this.hotels.find({ where: { tenantId, id: In(link.hotelIds) }, select: ['id', 'name'] })).map((h) => h.name)
      : [];
    const mediaMeta = { linkId: link.id, linkName: link.name, hotels: hotelNames, role: d.role, form: d.values };

    if (settings.dedupe === 'merge') {
      const open = await this.leads.findOne({
        where: { tenantId, contactId: contact.id, source: 'media', status: Not(In(['won', 'lost'])) },
        order: { createdAt: 'DESC' },
      });
      if (open && !(open.meta as { deleted?: boolean } | null)?.deleted) {
        await this.leadActivity
          .add({ tenantId, leadId: open.id, type: 'comment', userId: null, comment: `Медиа: повторно заполнил форму на ссылке «${link.name}»` })
          .catch(() => undefined);
        return { leadId: open.id, contactId: contact.id };
      }
    }

    const assigneeId = link.assigneeStaffId || settings.assigneeStaffId;
    const assignee = assigneeId ? await this.staff.findOne({ where: { tenantId, id: assigneeId }, select: ['id', 'fullName'] }) : null;
    const lead = await this.leadsService.createForTenant(tenantId, {
      name: d.name,
      email: d.email,
      phone: d.phone,
      status: settings.leadStatus || 'new',
      source: 'media',
      contactId: contact.id,
      companyId,
      assignedUserId: assignee?.id ?? null,
      assignedTo: assignee?.fullName ?? null,
      meta: { media: mediaMeta, message: (d.values.purpose as string) || undefined },
    } as any);
    return { leadId: lead.id, contactId: contact.id };
  }

  // ───────────── скачивание ─────────────

  async requestDownload(slug: string, req: Request, body: { fileIds?: string[]; folderIds?: string[]; all?: boolean }) {
    const link = await this.open(slug, req.headers['x-media-access'] as string);
    const v = await this.visitor(link.tenantId, req.headers['x-media-visitor'] as string);
    if (await this.formNeeded(link, v)) {
      if (v) await this.track(slug, req, { type: 'click' }).catch(() => undefined);
      throw new ForbiddenException({ code: 'MEDIA_FORM_REQUIRED', message: 'Заполните форму, чтобы скачать' });
    }
    const ctx = await this.context(link);
    const allowedFolders = new Set(ctx.folders.map((f) => f.id));
    let picked: MediaFile[];
    let folderIds: string[] = [];
    let fileIds: string[] = [];
    if (body.all) {
      picked = ctx.files;
      folderIds = (link.folderIds || []).filter((id) => allowedFolders.has(id));
      fileIds = ctx.files.filter((f) => !allowedFolders.has(f.folderId)).map((f) => f.id);
    } else {
      const reqFolders = (body.folderIds || []).filter((id) => allowedFolders.has(id));
      const reqFiles = new Set((body.fileIds || []).map(String));
      const sub = reqFolders.length ? new Set(await this.media.subtreeIds(link.tenantId, reqFolders)) : new Set<string>();
      picked = ctx.files.filter((f) => reqFiles.has(f.id) || sub.has(f.folderId));
      if (body.folderIds?.includes('__selected')) {
        const loose = ctx.files.filter((f) => !allowedFolders.has(f.folderId));
        picked = [...picked, ...loose.filter((f) => !picked.includes(f))];
      }
      folderIds = reqFolders;
      fileIds = picked.filter((f) => !sub.has(f.folderId)).map((f) => f.id);
    }
    if (!picked.length) throw new BadRequestException('Нечего скачивать');
    const zip = picked.length > 1;
    if (zip && !link.allowZip) throw new ForbiddenException({ code: 'MEDIA_ZIP_DISABLED', message: 'Файлы этой подборки скачиваются по одному' });

    const bytes = picked.reduce((s, f) => s + Number(f.sizeBytes), 0);
    const folderNames = ctx.folders.filter((f) => folderIds.includes(f.id)).map((f) => f.name);
    // без слов — подпись читается в CRM на любом языке интерфейса
    const what = !zip
      ? picked[0].name
      : body.all
        ? `${link.title || link.name} · ZIP (${picked.length})`
        : folderNames.length === 1 && fileIds.length === 0
          ? `${folderNames[0]} · ZIP (${picked.length})`
          : `${picked[0].name} +${picked.length - 1}`;

    await this.log(link, v, 'download', req, {
      fileIds: picked.map((f) => f.id),
      filesCount: picked.length,
      bytes: String(bytes),
      what: what.slice(0, 300),
      zip,
      folderId: folderIds.length === 1 ? folderIds[0] : null,
    });
    const who = v?.name ? `${v.name}${v.company ? ' · ' + v.company : ''}` : null;
    await this.files.increment({ tenantId: link.tenantId, id: In(picked.map((f) => f.id)) }, 'downloads', 1);
    await this.files.update({ tenantId: link.tenantId, id: In(picked.map((f) => f.id)) }, { lastDownloadAt: new Date(), lastDownloadBy: who });
    void this.afterDownload(link, v, what).catch((e) => this.logger.warn(`afterDownload: ${e?.message || e}`));

    const name = !zip
      ? picked[0].name
      : folderNames.length === 1 && !body.all
        ? folderNames[0]
        : link.title || link.name;
    const ticket: DownloadTicket = {
      t: link.tenantId,
      l: link.id,
      v: v?.id ?? null,
      f: zip ? fileIds : [picked[0].id],
      d: zip ? folderIds : [],
      n: name,
      e: Math.floor(Date.now() / 1000) + MEDIA_TICKET_TTL_SEC,
    };
    return { url: `/public/media/download/${signPayload(ticket as unknown as Record<string, unknown>)}`, files: picked.length, bytes, zip };
  }

  /** Отметка в карточке лида: скачивания видны в истории, уведомления — через автоматизации по лиду. */
  private async afterDownload(link: MediaLink, v: MediaVisitor | null, what: string) {
    if (!v?.leadId) return;
    await this.leadActivity.add({ tenantId: link.tenantId, leadId: v.leadId, type: 'comment', userId: null, comment: `Медиа: скачал ${what} (ссылка «${link.name}»)` });
  }

  /** Отдаёт файл или ZIP по подписанному тикету (тикеты выдают и CRM, и публичная страница). */
  async streamTicket(token: string, res: Response) {
    const t = verifyPayload<DownloadTicket>(token);
    if (!t) throw new ForbiddenException('Ссылка на скачивание устарела — нажмите «Скачать» ещё раз');
    if (t.l) {
      const link = await this.links.findOne({ where: { id: t.l }, select: ['id', 'enabled', 'expiresAt'] });
      if (!link) throw new NotFoundException();
      this.assertOpen(link as MediaLink);
    }
    const sub = t.d?.length ? await this.media.subtreeIds(t.t, t.d) : [];
    const [inFolders, loose, folders]: [MediaFile[], MediaFile[], MediaFolder[]] = await Promise.all([
      sub.length ? this.files.find({ where: { tenantId: t.t, folderId: In(sub) } }) : [],
      t.f?.length ? this.files.find({ where: { tenantId: t.t, id: In(t.f) } }) : [],
      sub.length ? this.folders.find({ where: { tenantId: t.t, id: In(sub) } }) : [],
    ]);
    const all = [...inFolders, ...loose.filter((f) => !inFolders.some((x) => x.id === f.id))];
    if (!all.length) throw new NotFoundException('Файлы удалены');

    const safe = (s: string) => s.replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').trim() || 'file';
    const disp = (name: string) => `attachment; filename="${safe(name).replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(safe(name))}`;
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (all.length === 1 && !t.d?.length) {
      const f = all[0];
      const abs = joinUploadsAbsolute(f.storagePath);
      const st = await stat(abs).catch(() => null);
      if (!st) throw new NotFoundException('Файл не найден на диске');
      res.setHeader('Content-Type', f.mime || 'application/octet-stream');
      res.setHeader('Content-Length', String(st.size));
      res.setHeader('Content-Disposition', disp(f.name));
      createReadStream(abs).pipe(res);
      return;
    }

    // Путь внутри архива повторяет дерево папок от выбранных корней.
    const byId = new Map(folders.map((f) => [f.id, f]));
    const roots = new Set(t.d || []);
    const pathOf = (folderId: string): string => {
      const parts: string[] = [];
      let cur = byId.get(folderId);
      while (cur) {
        parts.unshift(safe(cur.name));
        if (roots.has(cur.id) || !cur.parentId) break;
        cur = byId.get(cur.parentId);
      }
      return parts.join('/');
    };
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', disp(`${t.n}.zip`));
    // Фото/видео уже сжаты — store без компрессии: быстро и не грузит CPU.
    const archive = archiver('zip', { store: true });
    archive.on('error', (e: Error) => {
      this.logger.warn(`zip error: ${e.message}`);
      res.destroy(e);
    });
    archive.pipe(res);
    const used = new Set<string>();
    for (const f of all) {
      const dir = byId.has(f.folderId) ? pathOf(f.folderId) : '';
      let p = dir ? `${dir}/${safe(f.name)}` : safe(f.name);
      for (let i = 2; used.has(p); i++) p = p.replace(/(\.[^.]+)?$/, ` (${i})$1`);
      used.add(p);
      const abs = joinUploadsAbsolute(f.storagePath);
      if (await stat(abs).catch(() => null)) archive.file(abs, { name: p });
    }
    await archive.finalize();
  }

  /** Превью/просмотр inline по подписи (без авторизации — для <img>/<video>). */
  async streamPreview(fileId: string, q: { v?: string; e?: string; s?: string }, req: Request, res: Response) {
    const variant = q.v === 'thumb' ? 'thumb' : 'view';
    if (!uuidRe.test(fileId) || !verifyPreviewSig(fileId, variant, Number(q.e), String(q.s || ''))) {
      throw new ForbiddenException('Ссылка на превью устарела');
    }
    const f = await this.files.findOne({ where: { id: fileId } });
    if (!f) throw new NotFoundException();
    const rel = variant === 'thumb' ? f.thumbPath : f.storagePath;
    if (!rel) throw new NotFoundException();
    const abs = joinUploadsAbsolute(rel);
    if (!(await stat(abs).catch(() => null))) throw new NotFoundException();
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // SVG, открытый напрямую, исполнил бы скрипты на домене API. PDF не трогаем — sandbox ломает встроенный просмотрщик.
    if (variant === 'view' && f.ext === 'svg') {
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
    }
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`);
    // sendFile сам обрабатывает Range — видео перематывается без скачивания целиком.
    res.sendFile(abs, { headers: { 'Content-Type': variant === 'thumb' ? 'image/jpeg' : f.mime } });
    void req;
  }
}
