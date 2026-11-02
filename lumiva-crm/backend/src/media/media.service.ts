// src/media/media.service.ts
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { In, IsNull, LessThan, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { createWriteStream } from 'fs';
import { copyFile, mkdir, rename, stat, unlink, writeFile } from 'fs/promises';
import { dirname } from 'path';
import * as bcrypt from 'bcryptjs';
import { Hotel } from '../hotels/hotel.entity';
import { Tenant } from '../tenants/tenant.entity';
import { StorageQuotaService } from '../storage-quota/storage-quota.service';
import { getTotalStorageQuotaBytes } from '../tenants/storage-quota.util';
import { joinUploadsAbsolute, sumTenantUploadsBytesOnDisk } from '../common/uploads-root.util';
import { tenantFrontend } from '../common/tenant-branding.util';
import {
  MediaCollection,
  MediaEvent,
  MediaFile,
  MediaFolder,
  MediaFormField,
  MediaLang,
  MediaLink,
  MediaLinkScope,
  MediaSettings,
  MediaUpload,
  MediaVisitor,
} from './media.entities';
import {
  MEDIA_CHUNK_BYTES,
  MEDIA_MAX_FILE_BYTES,
  MEDIA_PREVIEW_TTL_SEC,
  MEDIA_TICKET_TTL_SEC,
  MEDIA_DICT,
  classifyMediaFile,
  localizeMediaField,
  localizeMediaTitle,
  mediaFormDefault,
  mediaFormTitleDefault,
} from './media.constants';
import { previewSig, signPayload, type DownloadTicket } from './media-token.util';

export interface LinkInput {
  name?: string;
  slug?: string;
  scope?: MediaLinkScope;
  hotelIds?: string[];
  folderIds?: string[];
  fileIds?: string[];
  title?: string | null;
  description?: string | null;
  lang?: string | null;
  gate?: boolean;
  allowZip?: boolean;
  password?: string | null; // '' / null — снять пароль, undefined — не трогать
  expiresAt?: string | null;
  enabled?: boolean;
  assigneeStaffId?: string | null;
}

export type StatsPeriod = '7' | '30' | '90' | 'all';
/** Доступные сотруднику отели (hotel_user_access, как в отзывах): null — все. Папки без отеля видны всем. */
export type HotelAcc = string[] | null;

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanIds = (a: unknown): string[] =>
  Array.isArray(a) ? [...new Set(a.map((x) => String(x || '').trim()).filter((x) => uuidRe.test(x)))] : [];

export function slugify(s: string): string {
  const tr: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
    н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
    ы: 'y', э: 'e', ю: 'yu', я: 'ya', ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
  };
  return String(s || '')
    .toLowerCase()
    .split('')
    .map((c) => tr[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectRepository(MediaFolder) private readonly folders: Repository<MediaFolder>,
    @InjectRepository(MediaFile) private readonly files: Repository<MediaFile>,
    @InjectRepository(MediaLink) private readonly links: Repository<MediaLink>,
    @InjectRepository(MediaEvent) private readonly events: Repository<MediaEvent>,
    @InjectRepository(MediaVisitor) private readonly visitors: Repository<MediaVisitor>,
    @InjectRepository(MediaSettings) private readonly settingsRepo: Repository<MediaSettings>,
    @InjectRepository(MediaUpload) private readonly uploads: Repository<MediaUpload>,
    @InjectRepository(MediaCollection) private readonly collections: Repository<MediaCollection>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly quota: StorageQuotaService,
  ) {}

  // ───────────── helpers ─────────────

  previewUrl(f: Pick<MediaFile, 'id' | 'thumbPath'>, variant: 'thumb' | 'view'): string | null {
    if (variant === 'thumb' && !f.thumbPath) return null;
    // Округляем срок до часа — URL стабилен в пределах часа, браузер кеширует картинки.
    const exp = Math.ceil((Date.now() / 1000 + MEDIA_PREVIEW_TTL_SEC) / 3600) * 3600;
    return `/public/media/raw/${f.id}?v=${variant}&e=${exp}&s=${previewSig(f.id, variant, exp)}`;
  }

  fileDto(f: MediaFile) {
    return {
      id: f.id,
      folderId: f.folderId,
      name: f.name,
      ext: f.ext,
      mime: f.mime,
      kind: f.kind,
      sizeBytes: Number(f.sizeBytes),
      width: f.width,
      height: f.height,
      durationSec: f.durationSec,
      downloads: f.downloads,
      lastDownloadAt: f.lastDownloadAt,
      lastDownloadBy: f.lastDownloadBy,
      createdAt: f.createdAt,
      thumbUrl: this.previewUrl(f, 'thumb'),
      viewUrl: this.previewUrl(f, 'view'),
    };
  }

  private can(acc: HotelAcc, hotelId: string | null | undefined): boolean {
    return !acc || !hotelId || acc.includes(hotelId);
  }

  /** Директор отеля (запись в hotel_user_access) видит медиа только своих отелей; владелец — всё. */
  async allowedHotels(tenantId: string, userId: string | null, role: string | undefined): Promise<HotelAcc> {
    if (role === 'owner' || !userId) return role === 'owner' ? null : [];
    const [row] = await this.hotels.query(`SELECT "hotelIds", "brandIds" FROM hotel_user_access WHERE "tenantId" = $1 AND "userId" = $2`, [tenantId, userId]);
    if (!row) return null;
    const found: Array<{ id: string }> = await this.hotels.query(
      `SELECT id FROM hotels WHERE "tenantId" = $1 AND (id = ANY($2::uuid[]) OR "brandId" = ANY($3::uuid[]))`,
      [tenantId, row.hotelIds || [], row.brandIds || []],
    );
    return found.map((x) => x.id);
  }

  private async folderOr404(tenantId: string, id: string, acc: HotelAcc = null): Promise<MediaFolder> {
    if (!uuidRe.test(String(id || ''))) throw new NotFoundException('Папка не найдена');
    const f = await this.folders.findOne({ where: { tenantId, id } });
    if (!f || !this.can(acc, f.hotelId)) throw new NotFoundException('Папка не найдена');
    return f;
  }

  /** id файлов, которые сотрудник видит (по отелю их папки). */
  private async visibleFileIds(tenantId: string, ids: string[], acc: HotelAcc): Promise<string[]> {
    const list = cleanIds(ids);
    if (!list.length) return [];
    const rows: Array<{ id: string; hotelId: string | null }> = await this.files.query(
      `SELECT f.id, d."hotelId" FROM media_files f JOIN media_folders d ON d.id = f."folderId" WHERE f."tenantId" = $1 AND f.id = ANY($2::uuid[])`,
      [tenantId, list],
    );
    return rows.filter((r) => this.can(acc, r.hotelId)).map((r) => r.id);
  }

  /** id папки и всех вложенных. */
  async subtreeIds(tenantId: string, rootIds: string[]): Promise<string[]> {
    const ids = cleanIds(rootIds);
    if (!ids.length) return [];
    const rows: Array<{ id: string }> = await this.folders.query(
      `WITH RECURSIVE t AS (
         SELECT id FROM media_folders WHERE "tenantId" = $1 AND id = ANY($2::uuid[])
         UNION SELECT f.id FROM media_folders f JOIN t ON f."parentId" = t.id WHERE f."tenantId" = $1
       ) SELECT id FROM t`,
      [tenantId, ids],
    );
    return rows.map((r) => r.id);
  }

  private async removeFromDisk(files: Array<Pick<MediaFile, 'storagePath' | 'thumbPath'>>) {
    for (const f of files) {
      for (const p of [f.storagePath, f.thumbPath]) {
        if (p) await unlink(joinUploadsAbsolute(p)).catch(() => undefined);
      }
    }
  }

  private async tenantLang(tenantId: string): Promise<string | null> {
    const t = await this.tenants.findOne({ where: { id: tenantId }, select: ['id', 'uiLanguage'] });
    return t?.uiLanguage ?? null;
  }

  // ───────────── обзор / папки ─────────────

  async overview(tenantId: string, acc: HotelAcc = null) {
    const [allHotels, allFolders, counts, tenant, used] = await Promise.all([
      this.hotels.find({ where: { tenantId }, select: ['id', 'name', 'city'], order: { name: 'ASC' } }),
      this.folders.find({ where: { tenantId }, order: { name: 'ASC' } }),
      this.files.query(
        `SELECT "folderId", count(*)::int AS n, coalesce(sum("sizeBytes"),0)::bigint AS bytes,
                coalesce(sum(downloads),0)::int AS dl
           FROM media_files WHERE "tenantId" = $1 GROUP BY "folderId"`,
        [tenantId],
      ) as Promise<Array<{ folderId: string; n: number; bytes: string; dl: number }>>,
      this.tenants.findOne({ where: { id: tenantId }, select: ['id', 'plan', 'storageExtraBytes'] }),
      sumTenantUploadsBytesOnDisk(tenantId),
    ]);
    const hotels = allHotels.filter((h) => this.can(acc, h.id));
    const collections = await this.collections.find({ where: { tenantId }, order: { name: 'ASC' } });
    const folders = allFolders.filter((f) => this.can(acc, f.hotelId));
    const byFolder = new Map(counts.map((c) => [c.folderId, c]));
    const sharedRows: Array<{ fid: string }> = await this.links.query(
      `SELECT DISTINCT jsonb_array_elements_text("folderIds") AS fid FROM media_links WHERE "tenantId" = $1 AND enabled = true`,
      [tenantId],
    );
    const shared = new Set(sharedRows.map((r) => r.fid));
    const totalFiles = folders.reduce((s, f) => s + (byFolder.get(f.id)?.n ?? 0), 0);
    const activeLinks = (await this.listLinks(tenantId, acc)).filter((l) => l.enabled && !l.expired).length;
    return {
      hotels: hotels.map((h) => ({ id: h.id, name: h.name, city: h.city })),
      collections: collections.map((c) => ({ id: c.id, name: c.name, createdAt: c.createdAt })),
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        hotelId: f.hotelId,
        collectionId: f.collectionId,
        parentId: f.parentId,
        createdAt: f.createdAt,
        filesCount: byFolder.get(f.id)?.n ?? 0,
        bytes: Number(byFolder.get(f.id)?.bytes ?? 0),
        shared: shared.has(f.id),
      })),
      totals: { files: totalFiles, activeLinks },
      storage: {
        usedBytes: used,
        quotaBytes: tenant ? getTotalStorageQuotaBytes(tenant.plan, Number(tenant.storageExtraBytes || 0)) : null,
      },
      limits: { maxFileBytes: MEDIA_MAX_FILE_BYTES, chunkBytes: MEDIA_CHUNK_BYTES },
    };
  }

  /** Куда кладём папку верхнего уровня: отель, свой раздел или «без отеля». Сотрудник с доступом к части отелей — только в свои отели. */
  private async resolvePlace(
    tenantId: string,
    body: { hotelId?: string | null; collectionId?: string | null },
    acc: HotelAcc,
  ): Promise<{ hotelId: string | null; collectionId: string | null }> {
    if (body.hotelId) {
      const h = await this.hotels.findOne({ where: { tenantId, id: body.hotelId }, select: ['id'] });
      if (!h || !this.can(acc, h.id)) throw new BadRequestException('Отель не найден');
      return { hotelId: h.id, collectionId: null };
    }
    if (acc) throw new BadRequestException('Папку можно положить только в ваш отель');
    if (body.collectionId) {
      const c = await this.collections.findOne({ where: { tenantId, id: body.collectionId }, select: ['id'] });
      if (!c) throw new BadRequestException('Раздел не найден');
      return { hotelId: null, collectionId: c.id };
    }
    return { hotelId: null, collectionId: null };
  }

  private folderDto(f: MediaFolder, filesCount = 0, bytes = 0) {
    return { id: f.id, name: f.name, hotelId: f.hotelId, collectionId: f.collectionId, parentId: f.parentId, createdAt: f.createdAt, filesCount, bytes, shared: false };
  }

  async createFolder(
    tenantId: string,
    userId: string | null,
    body: { name?: string; hotelId?: string | null; collectionId?: string | null; parentId?: string | null },
    acc: HotelAcc = null,
  ) {
    const name = String(body.name || '').trim().slice(0, 200);
    if (!name) throw new BadRequestException('Укажите название папки');
    let place = { hotelId: null as string | null, collectionId: null as string | null };
    let parentId: string | null = null;
    if (body.parentId) {
      const parent = await this.folderOr404(tenantId, body.parentId, acc);
      parentId = parent.id;
      place = { hotelId: parent.hotelId, collectionId: parent.collectionId };
    } else {
      place = await this.resolvePlace(tenantId, body, acc);
    }
    const f = await this.folders.save(this.folders.create({ tenantId, name, ...place, parentId, createdByUserId: userId }));
    return this.folderDto(f);
  }

  /** Переименование и перенос: в другую папку (parentId) или на верхний уровень отеля/раздела/«без отеля». */
  async updateFolder(
    tenantId: string,
    id: string,
    body: { name?: string; parentId?: string | null; hotelId?: string | null; collectionId?: string | null },
    acc: HotelAcc = null,
  ) {
    const f = await this.folderOr404(tenantId, id, acc);
    if (body.name !== undefined) {
      const name = String(body.name || '').trim().slice(0, 200);
      if (!name) throw new BadRequestException('Укажите название папки');
      f.name = name;
    }
    let place: { hotelId: string | null; collectionId: string | null } | undefined;
    if (body.parentId) {
      const parent = await this.folderOr404(tenantId, body.parentId, acc);
      const sub = await this.subtreeIds(tenantId, [f.id]);
      if (sub.includes(parent.id)) throw new BadRequestException('Нельзя переместить папку внутрь самой себя');
      f.parentId = parent.id;
      place = { hotelId: parent.hotelId, collectionId: parent.collectionId };
    } else if (body.parentId === null || body.hotelId !== undefined || body.collectionId !== undefined) {
      f.parentId = null;
      place = await this.resolvePlace(tenantId, body, acc);
    }
    await this.folders.save(f);
    if (place) {
      const sub = await this.subtreeIds(tenantId, [f.id]);
      await this.folders.update({ tenantId, id: In(sub) }, place);
    }
    return { ok: true };
  }

  /** Копия папки со всеми подпапками и файлами (файлы копируются на диске — копия независима). */
  async duplicateFolder(tenantId: string, userId: string | null, id: string, acc: HotelAcc = null) {
    const root = await this.folderOr404(tenantId, id, acc);
    const sub = await this.subtreeIds(tenantId, [root.id]);
    const folders = await this.folders.find({ where: { tenantId, id: In(sub) } });
    const files = await this.files.find({ where: { tenantId, folderId: In(sub) } });
    await this.quota.assertCanAdd(tenantId, files.reduce((s, f) => s + Number(f.sizeBytes), 0));
    const map = new Map<string, string>();
    // родители раньше детей
    const order: MediaFolder[] = [];
    const walk = (pid: string) => folders.filter((x) => x.parentId === pid).forEach((x) => { order.push(x); walk(x.id); });
    order.push(root);
    walk(root.id);
    for (const src of order) {
      const copy = await this.folders.save(
        this.folders.create({
          tenantId,
          name: src.id === root.id ? `${src.name} (копия)`.slice(0, 200) : src.name,
          hotelId: src.hotelId,
          collectionId: src.collectionId,
          parentId: src.id === root.id ? src.parentId : map.get(src.parentId!) ?? null,
          createdByUserId: userId,
        }),
      );
      map.set(src.id, copy.id);
    }
    for (const f of files) {
      const nf = await this.files.save(
        this.files.create({ ...f, id: undefined, createdAt: undefined, folderId: map.get(f.folderId)!, downloads: 0, lastDownloadAt: null, lastDownloadBy: null, storagePath: '', thumbPath: null, createdByUserId: userId }),
      );
      nf.storagePath = `media/${tenantId}/${nf.id}${f.ext ? '.' + f.ext : ''}`;
      await copyFile(joinUploadsAbsolute(f.storagePath), joinUploadsAbsolute(nf.storagePath));
      if (f.thumbPath) {
        nf.thumbPath = `media/${tenantId}/${nf.id}.thumb.jpg`;
        await copyFile(joinUploadsAbsolute(f.thumbPath), joinUploadsAbsolute(nf.thumbPath)).catch(() => { nf.thumbPath = null; });
      }
      await this.files.save(nf);
    }
    return { id: map.get(root.id), folders: order.length, files: files.length };
  }

  // ───────────── разделы ─────────────

  async createCollection(tenantId: string, name: string, acc: HotelAcc = null) {
    if (acc) throw new BadRequestException('Разделы создаёт владелец или сотрудник с доступом ко всем отелям');
    const n = String(name || '').trim().slice(0, 200);
    if (!n) throw new BadRequestException('Укажите название раздела');
    const c = await this.collections.save(this.collections.create({ tenantId, name: n }));
    return { id: c.id, name: c.name, createdAt: c.createdAt };
  }

  async renameCollection(tenantId: string, id: string, name: string, acc: HotelAcc = null) {
    if (acc) throw new BadRequestException('Нет доступа');
    const c = await this.collections.findOne({ where: { tenantId, id } });
    if (!c) throw new NotFoundException('Раздел не найден');
    const n = String(name || '').trim().slice(0, 200);
    if (!n) throw new BadRequestException('Укажите название раздела');
    c.name = n;
    await this.collections.save(c);
    return { ok: true };
  }

  /** keep — папки раздела остаются в «Без отеля», delete — удаляются вместе с файлами. */
  async deleteCollection(tenantId: string, id: string, mode: 'keep' | 'delete', acc: HotelAcc = null) {
    if (acc) throw new BadRequestException('Нет доступа');
    const c = await this.collections.findOne({ where: { tenantId, id } });
    if (!c) throw new NotFoundException('Раздел не найден');
    let deletedFiles = 0;
    if (mode === 'delete') {
      const tops = await this.folders.find({ where: { tenantId, collectionId: c.id, parentId: IsNull() }, select: ['id'] });
      for (const t of tops) deletedFiles += (await this.deleteFolder(tenantId, t.id)).deletedFiles;
    } else {
      await this.folders.update({ tenantId, collectionId: c.id }, { collectionId: null });
    }
    await this.collections.delete({ tenantId, id: c.id });
    return { ok: true, deletedFiles };
  }

  async deleteFolder(tenantId: string, id: string, acc: HotelAcc = null) {
    const f = await this.folderOr404(tenantId, id, acc);
    const sub = await this.subtreeIds(tenantId, [f.id]);
    const files = await this.files.find({ where: { tenantId, folderId: In(sub) }, select: ['id', 'storagePath', 'thumbPath'] });
    await this.folders.delete({ tenantId, id: f.id }); // подпапки и файлы — ON DELETE CASCADE
    await this.removeFromDisk(files);
    await this.pruneLinkRefs(tenantId, sub, files.map((x) => x.id));
    return { ok: true, deletedFiles: files.length };
  }

  /** Убираем удалённые папки/файлы из ссылок, чтобы клиент не видел «пустых» пунктов. */
  private async pruneLinkRefs(tenantId: string, folderIds: string[], fileIds: string[]) {
    if (!folderIds.length && !fileIds.length) return;
    const fo = new Set(folderIds);
    const fi = new Set(fileIds);
    const links = await this.links.find({ where: { tenantId } });
    for (const l of links) {
      const nf = (l.folderIds || []).filter((x) => !fo.has(x));
      const nfi = (l.fileIds || []).filter((x) => !fi.has(x));
      if (nf.length !== (l.folderIds || []).length || nfi.length !== (l.fileIds || []).length) {
        await this.links.update({ id: l.id }, { folderIds: nf, fileIds: nfi });
      }
    }
  }

  // ───────────── файлы ─────────────

  async listFiles(tenantId: string, folderId: string, q?: string, acc: HotelAcc = null) {
    await this.folderOr404(tenantId, folderId, acc);
    const qb = this.files
      .createQueryBuilder('f')
      .where('f.tenantId = :tenantId AND f.folderId = :folderId', { tenantId, folderId })
      .orderBy('f.name', 'ASC');
    if (q && q.trim()) qb.andWhere('f.name ILIKE :q', { q: `%${q.trim().replace(/[%_]/g, '\\$&')}%` });
    const rows = await qb.getMany();
    return rows.map((f) => this.fileDto(f));
  }

  async renameFile(tenantId: string, id: string, name: string, acc: HotelAcc = null) {
    const f = await this.files.findOne({ where: { tenantId, id } });
    if (!f) throw new NotFoundException('Файл не найден');
    await this.folderOr404(tenantId, f.folderId, acc);
    const n = String(name || '').trim().slice(0, 255);
    if (!n) throw new BadRequestException('Укажите имя файла');
    f.name = n.toLowerCase().endsWith(`.${f.ext}`) || !f.ext ? n : `${n}.${f.ext}`;
    await this.files.save(f);
    return this.fileDto(f);
  }

  async moveFiles(tenantId: string, ids: string[], folderId: string, acc: HotelAcc = null) {
    const target = await this.folderOr404(tenantId, folderId, acc);
    const list = await this.visibleFileIds(tenantId, ids, acc);
    if (!list.length) return { moved: 0 };
    const r = await this.files.update({ tenantId, id: In(list) }, { folderId: target.id });
    return { moved: r.affected ?? 0 };
  }

  async deleteFiles(tenantId: string, ids: string[], acc: HotelAcc = null) {
    const list = await this.visibleFileIds(tenantId, ids, acc);
    if (!list.length) return { deleted: 0 };
    const rows = await this.files.find({ where: { tenantId, id: In(list) }, select: ['id', 'storagePath', 'thumbPath'] });
    if (!rows.length) return { deleted: 0 };
    await this.files.delete({ tenantId, id: In(rows.map((r) => r.id)) });
    await this.removeFromDisk(rows);
    await this.pruneLinkRefs(tenantId, [], rows.map((r) => r.id));
    return { deleted: rows.length };
  }

  // ───────────── загрузка по частям ─────────────
  // Видео до 2 ГБ не пролезают через client_max_body_size (32m) — клиент режет файл на куски.

  async initUpload(tenantId: string, userId: string | null, body: { folderId?: string; name?: string; size?: number }, acc: HotelAcc = null) {
    const folder = await this.folderOr404(tenantId, String(body.folderId || ''), acc);
    const name = String(body.name || '').trim().slice(0, 255);
    const size = Number(body.size || 0);
    const cls = classifyMediaFile(name);
    if (!cls) throw new BadRequestException(`Формат не поддерживается: ${name}. Можно фото, видео и PDF.`);
    if (!size || size < 0) throw new BadRequestException('Пустой файл');
    if (size > MEDIA_MAX_FILE_BYTES) throw new BadRequestException('Файл больше 2 ГБ');
    // тот же файл (имя + размер) уже лежит в этой папке — повторную загрузку пропускаем (догрузка папки целиком)
    const same = await this.files.findOne({ where: { tenantId, folderId: folder.id, name, sizeBytes: String(size) } });
    if (same) return { duplicateOf: this.fileDto(same) };
    await this.quota.assertCanAdd(tenantId, size);
    const up = this.uploads.create({
      tenantId,
      folderId: folder.id,
      name,
      mime: cls.mime,
      sizeBytes: String(size),
      receivedBytes: '0',
      tmpPath: '',
      createdByUserId: userId,
    });
    await this.uploads.save(up);
    up.tmpPath = `media/${tenantId}/.tmp/${up.id}.part`;
    await this.uploads.save(up);
    const abs = joinUploadsAbsolute(up.tmpPath);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, Buffer.alloc(0));
    return { uploadId: up.id, chunkBytes: MEDIA_CHUNK_BYTES };
  }

  private async uploadOr404(tenantId: string, id: string): Promise<MediaUpload> {
    if (!uuidRe.test(String(id || ''))) throw new NotFoundException('Загрузка не найдена');
    const up = await this.uploads.findOne({ where: { tenantId, id } });
    if (!up) throw new NotFoundException('Загрузка не найдена или устарела');
    return up;
  }

  async appendChunk(tenantId: string, id: string, offset: number, chunk: Buffer | undefined) {
    const up = await this.uploadOr404(tenantId, id);
    if (!chunk?.length) throw new BadRequestException('Пустой кусок файла');
    const received = Number(up.receivedBytes);
    // Повтор того же куска после обрыва сети — просто подтверждаем.
    if (offset + chunk.length <= received) return { receivedBytes: received };
    if (offset !== received) throw new ConflictException({ code: 'MEDIA_OFFSET', receivedBytes: received, message: 'Неверный порядок частей' });
    if (received + chunk.length > Number(up.sizeBytes)) throw new BadRequestException('Файл больше заявленного размера');
    const abs = joinUploadsAbsolute(up.tmpPath);
    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(abs, { flags: 'a' });
      ws.on('error', reject);
      ws.end(chunk, () => resolve());
    });
    up.receivedBytes = String(received + chunk.length);
    await this.uploads.save(up);
    return { receivedBytes: received + chunk.length };
  }

  async completeUpload(
    tenantId: string,
    id: string,
    meta: { width?: number; height?: number; durationSec?: number },
    thumb: Buffer | undefined,
  ) {
    const up = await this.uploadOr404(tenantId, id);
    const abs = joinUploadsAbsolute(up.tmpPath);
    const st = await stat(abs).catch(() => null);
    if (!st || st.size !== Number(up.sizeBytes)) {
      throw new BadRequestException('Файл загружен не полностью — повторите загрузку');
    }
    const folder = await this.folders.findOne({ where: { tenantId, id: up.folderId } });
    if (!folder) {
      await unlink(abs).catch(() => undefined);
      await this.uploads.delete({ id: up.id });
      throw new NotFoundException('Папка удалена во время загрузки');
    }
    const cls = classifyMediaFile(up.name)!;
    const file = this.files.create({
      tenantId,
      folderId: folder.id,
      name: up.name,
      ext: cls.ext,
      mime: cls.mime,
      kind: cls.kind,
      sizeBytes: up.sizeBytes,
      width: Number.isFinite(Number(meta.width)) && Number(meta.width) > 0 ? Math.round(Number(meta.width)) : null,
      height: Number.isFinite(Number(meta.height)) && Number(meta.height) > 0 ? Math.round(Number(meta.height)) : null,
      durationSec: Number.isFinite(Number(meta.durationSec)) && Number(meta.durationSec) > 0 ? Math.round(Number(meta.durationSec)) : null,
      storagePath: '',
      thumbPath: null,
      createdByUserId: up.createdByUserId,
    });
    await this.files.save(file);
    file.storagePath = `media/${tenantId}/${file.id}${cls.ext ? '.' + cls.ext : ''}`;
    const finalAbs = joinUploadsAbsolute(file.storagePath);
    await rename(abs, finalAbs);
    if (thumb?.length && thumb.length < 2 * 1024 * 1024 && thumb[0] === 0xff && thumb[1] === 0xd8) {
      file.thumbPath = `media/${tenantId}/${file.id}.thumb.jpg`;
      await writeFile(joinUploadsAbsolute(file.thumbPath), thumb);
    }
    await this.files.save(file);
    await this.uploads.delete({ id: up.id });
    try {
      await this.quota.assertAfterWrite(tenantId, finalAbs);
    } catch (e) {
      if (file.thumbPath) await unlink(joinUploadsAbsolute(file.thumbPath)).catch(() => undefined);
      await this.files.delete({ id: file.id });
      throw e;
    }
    return this.fileDto(file);
  }

  async abortUpload(tenantId: string, id: string) {
    const up = await this.uploads.findOne({ where: { tenantId, id } });
    if (!up) return { ok: true };
    await unlink(joinUploadsAbsolute(up.tmpPath)).catch(() => undefined);
    await this.uploads.delete({ id: up.id });
    return { ok: true };
  }

  /** Брошенные загрузки (закрыли вкладку) — чистим через сутки. */
  @Cron('17 * * * *')
  async purgeStaleUploads() {
    const old = await this.uploads.find({ where: { createdAt: LessThan(new Date(Date.now() - 24 * 3600 * 1000)) } });
    for (const up of old) {
      await unlink(joinUploadsAbsolute(up.tmpPath)).catch(() => undefined);
      await this.uploads.delete({ id: up.id });
    }
    if (old.length) this.logger.log(`purged ${old.length} stale media uploads`);
  }

  // ───────────── скачивание из CRM ─────────────

  async crmDownloadTicket(tenantId: string, body: { fileIds?: string[]; folderIds?: string[] }, acc: HotelAcc = null) {
    const f = await this.visibleFileIds(tenantId, body.fileIds || [], acc);
    const d = cleanIds(body.folderIds);
    for (const id of d) await this.folderOr404(tenantId, id, acc);
    if (!f.length && !d.length) throw new BadRequestException('Нечего скачивать');
    let name = 'media';
    if (d.length === 1 && !f.length) {
      const folder = await this.folderOr404(tenantId, d[0], acc);
      name = folder.name;
    } else if (f.length === 1 && !d.length) {
      const file = await this.files.findOne({ where: { tenantId, id: f[0] }, select: ['id', 'name'] });
      if (!file) throw new NotFoundException('Файл не найден');
      name = file.name;
    }
    const ticket: DownloadTicket = { t: tenantId, l: null, v: null, f, d, n: name, e: Math.floor(Date.now() / 1000) + MEDIA_TICKET_TTL_SEC };
    return { url: `/public/media/download/${signPayload(ticket as unknown as Record<string, unknown>)}` };
  }

  // ───────────── ссылки ─────────────

  async publicBase(tenantId: string): Promise<string> {
    return `${await tenantFrontend((sql, p) => this.tenants.query(sql, p), tenantId)}/m/`;
  }

  private async uniqueSlug(base: string, exceptId?: string): Promise<string> {
    const b = slugify(base) || 'media';
    for (let i = 0; i < 6; i++) {
      const s = `${b}-${randomBytes(3).toString('hex').slice(0, 4)}`;
      const hit = await this.links.findOne({ where: { slug: s }, select: ['id'] });
      if (!hit || hit.id === exceptId) return s;
    }
    return `${b}-${randomBytes(6).toString('hex')}`;
  }

  private async applyLinkInput(tenantId: string, l: MediaLink, b: LinkInput, acc: HotelAcc = null) {
    if (b.name !== undefined) {
      const n = String(b.name || '').trim().slice(0, 200);
      if (!n) throw new BadRequestException('Укажите название ссылки');
      l.name = n;
    }
    if (b.scope !== undefined) l.scope = (['hotel', 'multi', 'agency'] as const).includes(b.scope) ? b.scope : 'hotel';
    if (b.hotelIds !== undefined) {
      const ids = cleanIds(b.hotelIds);
      const ok = ids.length ? await this.hotels.find({ where: { tenantId, id: In(ids) }, select: ['id'] }) : [];
      l.hotelIds = ok.map((h) => h.id);
    }
    if (b.folderIds !== undefined) {
      const ids = cleanIds(b.folderIds);
      const ok = ids.length ? await this.folders.find({ where: { tenantId, id: In(ids) }, select: ['id', 'hotelId'] }) : [];
      l.folderIds = ids.filter((id) => ok.some((o) => o.id === id && this.can(acc, o.hotelId)));
    }
    if (b.fileIds !== undefined) {
      const ids = cleanIds(b.fileIds);
      const ok = await this.visibleFileIds(tenantId, ids, acc);
      l.fileIds = ids.filter((id) => ok.includes(id));
    }
    if (b.title !== undefined) l.title = b.title ? String(b.title).trim().slice(0, 200) || null : null;
    if (b.description !== undefined) l.description = b.description ? String(b.description).trim().slice(0, 2000) || null : null;
    if (b.lang !== undefined) l.lang = b.lang === 'ru' || b.lang === 'en' || b.lang === 'tr' ? b.lang : null;
    if (b.gate !== undefined) l.gate = !!b.gate;
    if (b.allowZip !== undefined) l.allowZip = !!b.allowZip;
    if (b.enabled !== undefined) l.enabled = !!b.enabled;
    if (b.expiresAt !== undefined) {
      if (!b.expiresAt) l.expiresAt = null;
      else {
        const d = new Date(b.expiresAt);
        if (Number.isNaN(d.getTime())) throw new BadRequestException('Неверная дата окончания');
        l.expiresAt = d;
      }
    }
    if (b.assigneeStaffId !== undefined) l.assigneeStaffId = b.assigneeStaffId && uuidRe.test(b.assigneeStaffId) ? b.assigneeStaffId : null;
    if (b.password !== undefined) {
      const p = b.password ? String(b.password) : '';
      if (p && p.length < 4) throw new BadRequestException('Пароль — минимум 4 символа');
      l.passwordHash = p ? await bcrypt.hash(p, 10) : null;
    }
    if (b.slug !== undefined && b.slug) {
      const s = slugify(b.slug);
      if (s.length < 3) throw new BadRequestException('Адрес ссылки — минимум 3 латинских символа');
      const hit = await this.links.findOne({ where: { slug: s }, select: ['id'] });
      if (hit && hit.id !== l.id) throw new ConflictException('Такой адрес уже занят');
      l.slug = s;
    }
    if (!l.folderIds.length && !l.fileIds.length) throw new BadRequestException('Выберите хотя бы одну папку или файл');
    // отели ссылки считаем по содержимому (а не по тому, что прислал клиент) — по ним же фильтруется доступ
    const hotelRows: Array<{ h: string | null }> = await this.folders.query(
      `SELECT DISTINCT d."hotelId" AS h FROM media_folders d WHERE d."tenantId" = $1 AND d.id = ANY($2::uuid[])
       UNION SELECT DISTINCT d."hotelId" FROM media_files f JOIN media_folders d ON d.id = f."folderId" WHERE f."tenantId" = $1 AND f.id = ANY($3::uuid[])`,
      [tenantId, l.folderIds, l.fileIds],
    );
    const derived = hotelRows.map((r) => r.h).filter((h): h is string => !!h);
    l.hotelIds = derived.length ? derived : l.scope === 'agency' ? [] : l.hotelIds.filter((h) => this.can(acc, h));
  }

  async createLink(tenantId: string, userId: string | null, b: LinkInput, acc: HotelAcc = null) {
    const l = this.links.create({ tenantId, createdByUserId: userId, folderIds: [], fileIds: [], hotelIds: [], scope: 'hotel', slug: '' });
    if (!b.name) b.name = 'Медиакит';
    await this.applyLinkInput(tenantId, l, b, acc);
    if (!l.slug) l.slug = await this.uniqueSlug(l.name);
    const saved = await this.links.save(l);
    return (await this.listLinks(tenantId, acc)).find((x) => x.id === saved.id);
  }

  private linkVisible(acc: HotelAcc, l: Pick<MediaLink, 'hotelIds'>): boolean {
    return !acc || (l.hotelIds || []).every((h) => acc.includes(h));
  }

  async updateLink(tenantId: string, id: string, b: LinkInput, acc: HotelAcc = null) {
    const l = await this.links.findOne({ where: { tenantId, id }, select: this.linkSelect() });
    if (!l || !this.linkVisible(acc, l)) throw new NotFoundException('Ссылка не найдена');
    await this.applyLinkInput(tenantId, l, b, acc);
    await this.links.save(l);
    return (await this.listLinks(tenantId, acc)).find((x) => x.id === id);
  }

  async deleteLink(tenantId: string, id: string, acc: HotelAcc = null) {
    const l = await this.links.findOne({ where: { tenantId, id }, select: ['id', 'hotelIds'] });
    if (!l || !this.linkVisible(acc, l)) throw new NotFoundException('Ссылка не найдена');
    await this.links.delete({ tenantId, id });
    return { ok: true };
  }

  private linkSelect(): (keyof MediaLink)[] {
    return [
      'id', 'tenantId', 'name', 'slug', 'scope', 'hotelIds', 'folderIds', 'fileIds', 'title', 'description', 'lang', 'gate',
      'allowZip', 'passwordHash', 'expiresAt', 'enabled', 'assigneeStaffId', 'createdByUserId', 'createdAt', 'updatedAt',
    ];
  }

  async listLinks(tenantId: string, acc: HotelAcc = null) {
    const [allRows, agg, spark, base] = await Promise.all([
      this.links.find({ where: { tenantId }, select: this.linkSelect(), order: { createdAt: 'DESC' } }),
      this.events.query(
        `SELECT "linkId",
                count(*) FILTER (WHERE type = 'view')::int AS views,
                count(DISTINCT "visitorId") FILTER (WHERE type = 'view')::int AS uniq,
                coalesce(sum("filesCount") FILTER (WHERE type = 'download'), 0)::int AS dl,
                count(*) FILTER (WHERE type = 'lead')::int AS leads,
                max("createdAt") AS "lastAt"
           FROM media_events WHERE "tenantId" = $1 GROUP BY "linkId"`,
        [tenantId],
      ) as Promise<Array<{ linkId: string; views: number; uniq: number; dl: number; leads: number; lastAt: Date | null }>>,
      this.events.query(
        `SELECT "linkId", (now()::date - "createdAt"::date) AS ago, count(*)::int AS n
           FROM media_events WHERE "tenantId" = $1 AND type = 'view' AND "createdAt" > now() - interval '14 days'
          GROUP BY 1, 2`,
        [tenantId],
      ) as Promise<Array<{ linkId: string; ago: number; n: number }>>,
      this.publicBase(tenantId),
    ]);
    const rows = allRows.filter((l) => this.linkVisible(acc, l));
    const a = new Map(agg.map((x) => [x.linkId, x]));
    const now = Date.now();
    return rows.map((l) => {
      const s = new Array(14).fill(0);
      spark.filter((x) => x.linkId === l.id).forEach((x) => {
        const i = 13 - Number(x.ago);
        if (i >= 0 && i < 14) s[i] = x.n;
      });
      const st = a.get(l.id);
      const expired = !!l.expiresAt && l.expiresAt.getTime() < now;
      return {
        id: l.id,
        name: l.name,
        slug: l.slug,
        url: base + l.slug,
        scope: l.scope,
        hotelIds: l.hotelIds || [],
        folderIds: l.folderIds || [],
        fileIds: l.fileIds || [],
        title: l.title,
        description: l.description,
        lang: l.lang,
        gate: l.gate,
        allowZip: l.allowZip,
        hasPassword: !!l.passwordHash,
        expiresAt: l.expiresAt,
        expired,
        enabled: l.enabled,
        assigneeStaffId: l.assigneeStaffId,
        createdAt: l.createdAt,
        views: st?.views ?? 0,
        uniq: st?.uniq ?? 0,
        downloads: st?.dl ?? 0,
        leads: st?.leads ?? 0,
        lastActivityAt: st?.lastAt ?? null,
        spark: s,
      };
    });
  }

  // ───────────── настройки формы ─────────────

  async getSettings(tenantId: string) {
    const s = await this.settingsRepo.findOne({ where: { tenantId } });
    const lang = await this.tenantLang(tenantId);
    return {
      formTitle: s?.formTitle || mediaFormTitleDefault(lang),
      formTitles: s?.formTitles ?? {},
      formFields: s?.formFields?.length ? s.formFields : mediaFormDefault(lang),
      baseLang: lang === 'en' || lang === 'tr' ? lang : 'ru',
      dict: MEDIA_DICT,
      defaults: { formTitle: mediaFormTitleDefault(lang), formFields: mediaFormDefault(lang) },
      leadStatus: s?.leadStatus || 'new',
      assigneeStaffId: s?.assigneeStaffId ?? null,
      contactTags: s?.contactTags ?? ['media'],
      reaskDays: s?.reaskDays ?? 30,
      dedupe: s?.dedupe ?? 'merge',
    };
  }

  /** Форма для посетителя: свои поля — как есть; стандартные (не менялись) — на языке посетителя. */
  async publicForm(tenantId: string, lang: string | null) {
    const s = await this.settingsRepo.findOne({ where: { tenantId } });
    const l = lang === 'ru' || lang === 'en' || lang === 'tr' ? lang : await this.tenantLang(tenantId);
    return {
      title: localizeMediaTitle(s?.formTitle, s?.formTitles, l),
      fields: (s?.formFields?.length ? s.formFields : mediaFormDefault(l)).filter((f) => f.on).map((f) => localizeMediaField(f, l)),
    };
  }

  async updateSettings(
    tenantId: string,
    b: Partial<{ formTitle: string; formTitles: Record<string, string>; formFields: MediaFormField[]; leadStatus: string; assigneeStaffId: string | null; contactTags: string[]; reaskDays: number; dedupe: 'merge' | 'new' }>,
  ) {
    const s = (await this.settingsRepo.findOne({ where: { tenantId } })) || this.settingsRepo.create({ tenantId, contactTags: ['media'] });
    if (b.formTitle !== undefined) s.formTitle = String(b.formTitle || '').trim().slice(0, 200) || null;
    if (b.formFields !== undefined) s.formFields = this.sanitizeFields(b.formFields);
    if (b.formTitles !== undefined) {
      const t: Partial<Record<MediaLang, string>> = {};
      for (const l of ['ru', 'en', 'tr'] as MediaLang[]) {
        const v = String((b.formTitles || {})[l] || '').trim().slice(0, 200);
        if (v) t[l] = v;
      }
      s.formTitles = Object.keys(t).length ? t : null;
    }
    if (b.leadStatus !== undefined) s.leadStatus = ['new', 'in_progress', 'waiting'].includes(b.leadStatus) ? b.leadStatus : 'new';
    if (b.assigneeStaffId !== undefined) s.assigneeStaffId = b.assigneeStaffId && uuidRe.test(b.assigneeStaffId) ? b.assigneeStaffId : null;
    if (b.contactTags !== undefined) {
      s.contactTags = Array.isArray(b.contactTags)
        ? [...new Set(b.contactTags.map((t) => String(t || '').trim().slice(0, 40)).filter(Boolean))].slice(0, 10)
        : [];
    }
    if (b.reaskDays !== undefined) s.reaskDays = Math.max(0, Math.min(365, Math.round(Number(b.reaskDays) || 0)));
    if (b.dedupe !== undefined) s.dedupe = b.dedupe === 'new' ? 'new' : 'merge';
    await this.settingsRepo.save(s);
    return this.getSettings(tenantId);
  }

  private sanitizeL10n(raw: any): MediaFormField['l10n'] {
    if (!raw || typeof raw !== 'object') return undefined;
    const out: NonNullable<MediaFormField['l10n']> = {};
    for (const l of ['ru', 'en', 'tr'] as MediaLang[]) {
      const x = raw[l];
      if (!x || typeof x !== 'object') continue;
      const label = String(x.label || '').trim().slice(0, 200);
      const ph = String(x.ph || '').slice(0, 200);
      const options = Array.isArray(x.options) ? x.options.map((o: unknown) => String(o).trim().slice(0, 100)).filter(Boolean).slice(0, 30) : [];
      if (label || ph || options.length) out[l] = { ...(label ? { label } : {}), ...(ph ? { ph } : {}), ...(options.length ? { options } : {}) };
    }
    return Object.keys(out).length ? out : undefined;
  }

  private sanitizeFields(raw: unknown): MediaFormField[] | null {
    if (!Array.isArray(raw)) return null;
    const types = ['text', 'email', 'tel', 'select', 'textarea', 'check'];
    const seen = new Set<string>();
    const out: MediaFormField[] = [];
    for (const r of raw.slice(0, 20) as any[]) {
      const id = String(r?.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const type = types.includes(r?.type) ? r.type : 'text';
      const lock = id === 'name';
      out.push({
        id,
        label: String(r?.label || '').trim().slice(0, 200) || id,
        type: lock ? 'text' : type,
        ph: r?.ph ? String(r.ph).slice(0, 200) : '',
        options: type === 'select' && Array.isArray(r?.options) ? r.options.map((o: unknown) => String(o).slice(0, 100)).filter(Boolean).slice(0, 30) : undefined,
        on: lock ? true : !!r?.on,
        req: lock ? true : !!r?.on && !!r?.req,
        lock: lock || undefined,
        l10n: this.sanitizeL10n(r?.l10n),
      });
    }
    if (!seen.has('name')) out.unshift({ id: 'name', label: 'Name', type: 'text', on: true, req: true, lock: true });
    return out;
  }

  // ───────────── аналитика ─────────────

  private periodSince(p: StatsPeriod): Date | null {
    const days = p === '7' ? 7 : p === '30' ? 30 : p === '90' ? 90 : 0;
    return days ? new Date(Date.now() - days * 86400 * 1000) : null;
  }

  async stats(tenantId: string, linkId: string | 'all', period: StatsPeriod, acc: HotelAcc = null) {
    const since = this.periodSince(period);
    const params: unknown[] = [tenantId];
    let where = `e."tenantId" = $1`;
    if (linkId !== 'all') {
      if (!uuidRe.test(linkId)) throw new BadRequestException('Неверная ссылка');
      params.push(linkId);
      where += ` AND e."linkId" = $${params.length}`;
    }
    if (acc) {
      const visible = (await this.listLinks(tenantId, acc)).map((l) => l.id);
      params.push(visible);
      where += ` AND e."linkId" = ANY($${params.length}::uuid[])`;
    }
    if (since) {
      params.push(since);
      where += ` AND e."createdAt" >= $${params.length}`;
    }

    const [kpi] = (await this.events.query(
      `SELECT count(*) FILTER (WHERE type = 'view')::int AS views,
              count(DISTINCT "visitorId") FILTER (WHERE type = 'view')::int AS uniq,
              coalesce(sum("filesCount") FILTER (WHERE type = 'download'), 0)::int AS files,
              count(*) FILTER (WHERE type = 'download')::int AS downloads,
              count(*) FILTER (WHERE type = 'lead')::int AS leads,
              coalesce(sum(bytes) FILTER (WHERE type = 'download'), 0)::bigint AS bytes,
              count(DISTINCT "visitorId") FILTER (WHERE type = 'open')::int AS "fOpen",
              count(DISTINCT "visitorId") FILTER (WHERE type = 'click')::int AS "fClick",
              count(DISTINCT "visitorId") FILTER (WHERE type IN ('lead', 'download'))::int AS "fLead"
         FROM media_events e WHERE ${where}`,
      params,
    )) as Array<Record<string, number | string>>;

    // Ряд по дням (для «Всё время» длиннее 90 дней — по неделям).
    const [{ first }] = (await this.events.query(`SELECT min(e."createdAt") AS first FROM media_events e WHERE ${where}`, params)) as Array<{ first: Date | null }>;
    const spanDays = first ? Math.ceil((Date.now() - new Date(first).getTime()) / 86400000) : 0;
    const bucket = !since && spanDays > 90 ? 'week' : 'day';
    const series = (await this.events.query(
      `SELECT date_trunc('${bucket}', e."createdAt")::date AS d,
              count(*) FILTER (WHERE type = 'view')::int AS views,
              coalesce(sum("filesCount") FILTER (WHERE type = 'download'), 0)::int AS files
         FROM media_events e WHERE ${where} GROUP BY 1 ORDER BY 1`,
      params,
    )) as Array<{ d: string; views: number; files: number }>;

    const feed = (await this.events.query(
      `SELECT e.id, e.type, e."createdAt", e."filesCount", e.what, e.zip, e."linkId", l.name AS "linkName",
              v.name, v.email, v.phone, v.company, v.role, v."leadId", ld.status AS "leadStatus"
         FROM media_events e
         JOIN media_links l ON l.id = e."linkId"
         LEFT JOIN media_visitors v ON v.id = e."visitorId"
         LEFT JOIN leads ld ON ld.id = v."leadId"
        WHERE ${where} AND e.type IN ('download', 'lead')
        ORDER BY e."createdAt" DESC LIMIT 200`,
      params,
    )) as Array<Record<string, unknown>>;

    const top = (await this.events.query(
      `SELECT x.fid AS id, count(*)::int AS n
         FROM media_events e, jsonb_array_elements_text(e."fileIds") AS x(fid)
        WHERE ${where} AND e.type = 'download'
        GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
      params,
    )) as Array<{ id: string; n: number }>;
    const topFiles = top.length ? await this.files.find({ where: { tenantId, id: In(top.map((t) => t.id)) } }) : [];

    return {
      period,
      bucket,
      kpi: {
        views: Number(kpi.views),
        uniq: Number(kpi.uniq),
        files: Number(kpi.files),
        downloads: Number(kpi.downloads),
        leads: Number(kpi.leads),
        bytes: Number(kpi.bytes),
      },
      funnel: [
        { key: 'visit', n: Number(kpi.uniq) },
        { key: 'open', n: Number(kpi.fOpen) },
        { key: 'click', n: Number(kpi.fClick) },
        { key: 'lead', n: Number(kpi.fLead) },
      ],
      series,
      feed: feed.map((r) => ({
        id: r.id,
        type: r.type,
        at: r.createdAt,
        filesCount: r.filesCount,
        what: r.what,
        zip: r.zip,
        linkId: r.linkId,
        linkName: r.linkName,
        name: r.name,
        email: r.email,
        phone: r.phone,
        company: r.company,
        role: r.role,
        leadId: r.leadId,
        leadStatus: r.leadStatus,
      })),
      topFiles: top
        .map((t) => {
          const f = topFiles.find((x) => x.id === t.id);
          return f ? { ...this.fileDto(f), periodDownloads: t.n } : null;
        })
        .filter(Boolean),
    };
  }

  async statsCsv(tenantId: string, linkId: string | 'all', period: StatsPeriod, acc: HotelAcc = null): Promise<string> {
    const s = await this.stats(tenantId, linkId, period, acc);
    const esc = (v: unknown) => {
      const x = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
      return /[",\n;]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
    };
    const head = ['date', 'type', 'link', 'name', 'email', 'phone', 'company', 'role', 'files', 'what', 'lead_status'];
    const lines = s.feed.map((r) =>
      [r.at, r.type, r.linkName, r.name, r.email, r.phone, r.company, r.role, r.filesCount, r.what, r.leadStatus].map(esc).join(','),
    );
    return '﻿' + [head.join(','), ...lines].join('\n');
  }
}
