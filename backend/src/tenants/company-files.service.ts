import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tenant } from './tenant.entity';
import { TenantStorageFile } from './tenant-storage-file.entity';
import { User } from '../users/user.entity';
import { ChatMessage } from '../online-chat/chat-message.entity';
import { EmailMessage } from '../email/email-message.entity';
import { TelegramMessage } from '../telegram-crm/telegram-message.entity';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { TenantStorageService } from './tenant-storage.service';
import { readdir, stat } from 'fs/promises';
import { join, relative } from 'path';
import {
  candidateUploadRoots,
  extractRelativePathFromPublicUrl,
  sizeBytesForRelativeUploadPath,
  unlinkUploadsRelative,
} from '../common/uploads-root.util';
import { CustomObjectRecord } from '../custom-objects/custom-object-record.entity';

function numBytes(v: string | bigint | null | undefined): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'bigint' ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Сегмент пути должен совпадать с tenantId (без учёта регистра UUID в путях на диске). */
function pathBelongsToTenant(tenantId: string, rel: string): boolean {
  const tid = tenantId.trim();
  if (!tid) return false;
  const low = tid.toLowerCase();
  return rel
    .split('/')
    .filter(Boolean)
    .some((seg) => seg.toLowerCase() === low);
}

function isWorkspaceTenantPath(tenantId: string, rel: string): boolean {
  const segs = rel.split('/').filter(Boolean);
  if (segs.length < 3) return false;
  if (segs[0].toLowerCase() !== 'workspace-files') return false;
  return segs[1].toLowerCase() === tenantId.toLowerCase();
}

function isTenantDiskPath(tenantId: string, rel: string): boolean {
  const segs = rel.split('/').filter(Boolean);
  if (segs.length < 2) return false;
  const t = tenantId.toLowerCase();
  if (segs[0].toLowerCase() === 'tenants' && segs[1].toLowerCase() === t)
    return true;
  if (segs[0].toLowerCase() === 'tenant-files' && segs[1].toLowerCase() === t)
    return true;
  return false;
}

export type CompanyFileSource =
  | 'company_storage'
  | 'logo'
  | 'online_chat'
  | 'email'
  | 'telegram'
  | 'workspace'
  | 'tenant_disk';

export interface AggregatedCompanyFile {
  id: string;
  source: CompanyFileSource;
  originalName: string;
  sizeBytes: number | null;
  createdAt: string;
  relativePath: string | null;
  uploadedByEmail: string | null;
}

@Injectable()
export class CompanyFilesService {
  constructor(
    @InjectRepository(TenantStorageFile)
    private readonly fileRepo: Repository<TenantStorageFile>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ChatMessage)
    private readonly chatMsgRepo: Repository<ChatMessage>,
    @InjectRepository(EmailMessage)
    private readonly emailMsgRepo: Repository<EmailMessage>,
    @InjectRepository(TelegramMessage)
    private readonly tgMsgRepo: Repository<TelegramMessage>,
    @InjectRepository(CustomObjectRecord)
    private readonly customObjectRecordRepo: Repository<CustomObjectRecord>,
    private readonly tenantStorage: TenantStorageService,
  ) {}

  async canUserDeleteStorage(
    tenantId: string,
    userId: string,
  ): Promise<boolean> {
    return this.tenantStorage.canUserDeleteStorage(tenantId, userId);
  }

  /**
   * Файлы на диске uploads/, связанные с тенантом: общее хранилище, логотип,
   * вложения чата/почты/Telegram с локальным URL (/v1/uploads/...).
   */
  async listAggregated(tenantId: string): Promise<AggregatedCompanyFile[]> {
    const byPath = new Map<string, AggregatedCompanyFile>();
    const push = (row: AggregatedCompanyFile) => {
      if (!row.relativePath) return;
      if (!pathBelongsToTenant(tenantId, row.relativePath)) return;
      const prev = byPath.get(row.relativePath);
      if (!prev) {
        byPath.set(row.relativePath, row);
        return;
      }
      const email =
        row.uploadedByEmail?.trim() ||
        prev.uploadedByEmail?.trim() ||
        null;
      const pick =
        new Date(row.createdAt) > new Date(prev.createdAt) ? row : prev;
      byPath.set(row.relativePath, {
        ...pick,
        uploadedByEmail: email,
      });
    };

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const logoRel = tenant?.logoUrl
      ? extractRelativePathFromPublicUrl(tenant.logoUrl)
      : null;
    const isSameAsLogoRel = (rel: string): boolean =>
      Boolean(
        logoRel &&
          rel.replace(/\\/g, '/').toLowerCase() ===
            logoRel.replace(/\\/g, '/').toLowerCase(),
      );

    const rows = await this.fileRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
    const userIds = [...new Set(rows.map((f) => f.uploadedByUserId))];
    const users =
      userIds.length === 0
        ? []
        : await this.userRepo.find({ where: { id: In(userIds) } });
    const byUid = new Map(users.map((u) => [u.id, u.email]));
    for (const f of rows) {
      push({
        id: `company|${f.id}`,
        source: 'company_storage',
        originalName: f.originalName,
        sizeBytes: numBytes(f.sizeBytes as any),
        createdAt: f.createdAt.toISOString(),
        relativePath: f.relativePath,
        uploadedByEmail: byUid.get(f.uploadedByUserId) ?? null,
      });
    }

    if (tenant?.logoUrl) {
      const rel = extractRelativePathFromPublicUrl(tenant.logoUrl);
      if (rel && pathBelongsToTenant(tenantId, rel)) {
        const sz = await sizeBytesForRelativeUploadPath(rel);
        let logoUploader = tenant.ownerEmail?.trim() || null;
        if (!logoUploader) {
          const owner = await this.userRepo.findOne({
            where: { tenantId, role: 'owner' },
          });
          logoUploader = owner?.email?.trim() ?? null;
        }
        push({
          id: 'logo|tenant',
          source: 'logo',
          originalName: rel.split('/').pop() || 'logo',
          sizeBytes: sz,
          createdAt: tenant.updatedAt?.toISOString() || new Date().toISOString(),
          relativePath: rel,
          uploadedByEmail: logoUploader,
        });
      }
    }

    const chatMsgs = await this.chatMsgRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tid', { tid: tenantId })
      .andWhere('m.attachments IS NOT NULL')
      .orderBy('m.createdAt', 'DESC')
      .take(800)
      .getMany();

    const chatStaffIds = [
      ...new Set(
        chatMsgs
          .map((m) => m.staffUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const chatStaffUsers =
      chatStaffIds.length === 0
        ? []
        : await this.userRepo.find({ where: { id: In(chatStaffIds) } });
    const chatStaffEmailById = new Map(
      chatStaffUsers.map((u) => [u.id, u.email]),
    );

    for (const m of chatMsgs) {
      const arr = m.attachments || [];
      for (let idx = 0; idx < arr.length; idx++) {
        const a = arr[idx];
        const rel = extractRelativePathFromPublicUrl(a.url);
        if (!rel || !pathBelongsToTenant(tenantId, rel)) continue;
        const sz = await sizeBytesForRelativeUploadPath(rel);
        let uploadedByEmail: string | null = null;
        if (m.staffUserId) {
          uploadedByEmail = chatStaffEmailById.get(m.staffUserId) ?? null;
        }
        push({
          id: `chat|${m.id}|${idx}`,
          source: 'online_chat',
          originalName: a.name || rel.split('/').pop() || 'file',
          sizeBytes: sz,
          createdAt: m.createdAt.toISOString(),
          relativePath: rel,
          uploadedByEmail,
        });
      }
    }

    const emails = await this.emailMsgRepo
      .createQueryBuilder('e')
      .where('e.tenantId = :tid', { tid: tenantId })
      .andWhere('e.attachments IS NOT NULL')
      .orderBy('e.date', 'DESC')
      .take(500)
      .getMany();

    for (const e of emails) {
      const arr = e.attachments || [];
      for (let idx = 0; idx < arr.length; idx++) {
        const a = arr[idx] as { filename?: string; size?: number; url?: string };
        const rel = extractRelativePathFromPublicUrl(a.url || '');
        if (!rel || !pathBelongsToTenant(tenantId, rel)) continue;
        const sz =
          (await sizeBytesForRelativeUploadPath(rel)) ?? a.size ?? null;
        push({
          id: `email|${e.id}|${idx}`,
          source: 'email',
          originalName: a.filename || rel.split('/').pop() || 'file',
          sizeBytes: sz,
          createdAt: e.date?.toISOString?.() || e.createdAt.toISOString(),
          relativePath: rel,
          uploadedByEmail: this.emailAttachmentUploaderLabel(e),
        });
      }
    }

    const tgMsgs = await this.tgMsgRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.contact', 'c')
      .where('t.tenantId = :tid', { tid: tenantId })
      .andWhere('t.attachments IS NOT NULL')
      .orderBy('t.date', 'DESC')
      .take(500)
      .getMany();

    for (const t of tgMsgs) {
      const arr = t.attachments || [];
      for (let idx = 0; idx < arr.length; idx++) {
        const a = arr[idx] as {
          fileName?: string;
          fileSize?: number;
          url?: string;
        };
        const rel = extractRelativePathFromPublicUrl(a.url || '');
        if (!rel || !pathBelongsToTenant(tenantId, rel)) continue;
        const sz =
          (await sizeBytesForRelativeUploadPath(rel)) ?? a.fileSize ?? null;
        push({
          id: `telegram|${t.id}|${idx}`,
          source: 'telegram',
          originalName: a.fileName || rel.split('/').pop() || 'file',
          sizeBytes: sz,
          createdAt: t.date?.toISOString?.() || t.createdAt.toISOString(),
          relativePath: rel,
          uploadedByEmail: this.telegramAttachmentLabel(t),
        });
      }
    }

    const seenDiskRel = new Set<string>();
    const walkTenantUploadSubtree = async (
      uploadsRoot: string,
      subSegments: string[],
      source: 'workspace' | 'tenant_disk',
    ): Promise<void> => {
      const absBase = join(uploadsRoot, ...subSegments);
      const walk = async (absDir: string): Promise<void> => {
        let entries;
        try {
          entries = await readdir(absDir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of entries) {
          const abs = join(absDir, e.name);
          if (e.isDirectory()) {
            await walk(abs);
          } else if (e.isFile()) {
            const rel = relative(uploadsRoot, abs).replace(/\\/g, '/');
            if (!rel || rel.startsWith('..')) continue;
            if (seenDiskRel.has(rel)) continue;
            seenDiskRel.add(rel);
            if (source === 'tenant_disk' && isSameAsLogoRel(rel)) continue;
            const st = await stat(abs);
            const id =
              source === 'workspace'
                ? `workspace|${encodeURIComponent(rel)}`
                : `disk|${encodeURIComponent(rel)}`;
            push({
              id,
              source,
              originalName: e.name,
              sizeBytes: st.size,
              createdAt: st.mtime.toISOString(),
              relativePath: rel,
              uploadedByEmail: null,
            });
          }
        }
      };
      try {
        await walk(absBase);
      } catch {
        /* нет каталога */
      }
    };

    for (const uploadsRoot of candidateUploadRoots()) {
      await walkTenantUploadSubtree(uploadsRoot, ['workspace-files', tenantId], 'workspace');
      await walkTenantUploadSubtree(uploadsRoot, ['tenants', tenantId], 'tenant_disk');
      await walkTenantUploadSubtree(
        uploadsRoot,
        ['tenant-files', tenantId],
        'tenant_disk',
      );
    }

    const coRecords = await this.customObjectRecordRepo.find({
      where: { tenantId },
    });
    for (const r of coRecords) {
      const vals = r.values || {};
      for (const val of Object.values(vals)) {
        if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
        const rp = (val as { relativePath?: string; name?: string }).relativePath;
        if (typeof rp !== 'string' || !rp.trim()) continue;
        const rel = rp.trim().replace(/\\/g, '/');
        if (!rel.startsWith('workspace-files/')) continue;
        const sz = await sizeBytesForRelativeUploadPath(rel);
        const nm = (val as { name?: string }).name;
        const uploader = (val as { uploadedByEmail?: string | null }).uploadedByEmail;
        let uploadedByEmail: string | null = null;
        if (typeof uploader === 'string' && uploader.trim()) {
          uploadedByEmail = uploader.trim();
        }
        push({
          id: `workspace|${encodeURIComponent(rel)}`,
          source: 'workspace',
          originalName:
            typeof nm === 'string' && nm.trim()
              ? nm.trim()
              : rel.split('/').pop() || 'file',
          sizeBytes: sz,
          createdAt: r.updatedAt?.toISOString() || r.createdAt.toISOString(),
          relativePath: rel,
          uploadedByEmail,
        });
      }
    }

    return [...byPath.values()].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async deleteAggregated(
    actor: CurrentUserPayload,
    rawFileId: string,
  ): Promise<void> {
    const tenantId = actor.tenantId;
    const userId = actor.userId ?? actor.sub;
    if (!tenantId || !userId) {
      throw new BadRequestException('Invalid auth');
    }
    const ok = await this.canUserDeleteStorage(tenantId, userId);
    if (!ok) {
      throw new ForbiddenException('Only owner or IT department can delete files');
    }

    const fileId = decodeURIComponent(rawFileId || '');
    const parts = fileId.split('|');
    const kind = parts[0];
    if (!kind) throw new BadRequestException('Invalid file id');

    if (kind === 'company') {
      const uuid = parts[1];
      if (!uuid) throw new BadRequestException('Invalid file id');
      await this.tenantStorage.deleteCompanyFileUnsafe(tenantId, uuid);
      return;
    }

    if (kind === 'logo') {
      const t = await this.tenantRepo.findOne({ where: { id: tenantId } });
      if (!t?.logoUrl) throw new NotFoundException('File not found');
      const rel = extractRelativePathFromPublicUrl(t.logoUrl);
      if (!rel || !pathBelongsToTenant(tenantId, rel)) {
        throw new ForbiddenException('Invalid file');
      }
      await unlinkUploadsRelative(rel);
      t.logoUrl = null;
      await this.tenantRepo.save(t);
      return;
    }

    if (kind === 'chat') {
      const msgId = parts[1];
      const idx = Number(parts[2]);
      if (!msgId || !Number.isFinite(idx)) {
        throw new BadRequestException('Invalid file id');
      }
      const msg = await this.chatMsgRepo.findOne({
        where: { id: msgId, tenantId },
      });
      if (!msg) throw new NotFoundException('Message not found');
      const att = [...(msg.attachments || [])];
      const a = att[idx];
      if (!a) throw new NotFoundException('Attachment not found');
      const rel = extractRelativePathFromPublicUrl(a.url);
      if (rel && pathBelongsToTenant(tenantId, rel)) {
        await unlinkUploadsRelative(rel);
      }
      att.splice(idx, 1);
      msg.attachments = att.length ? att : null;
      await this.chatMsgRepo.save(msg);
      return;
    }

    if (kind === 'email') {
      const msgId = parts[1];
      const idx = Number(parts[2]);
      if (!msgId || !Number.isFinite(idx)) {
        throw new BadRequestException('Invalid file id');
      }
      const msg = await this.emailMsgRepo.findOne({
        where: { id: msgId, tenantId },
      });
      if (!msg) throw new NotFoundException('Message not found');
      const att = [...(msg.attachments || [])];
      const a = att[idx] as { url?: string } | undefined;
      if (!a) throw new NotFoundException('Attachment not found');
      const rel = extractRelativePathFromPublicUrl(a.url || '');
      if (rel && pathBelongsToTenant(tenantId, rel)) {
        await unlinkUploadsRelative(rel);
      }
      att.splice(idx, 1);
      msg.attachments = att.length ? att : null;
      await this.emailMsgRepo.save(msg);
      return;
    }

    if (kind === 'telegram') {
      const msgId = parts[1];
      const idx = Number(parts[2]);
      if (!msgId || !Number.isFinite(idx)) {
        throw new BadRequestException('Invalid file id');
      }
      const msg = await this.tgMsgRepo.findOne({
        where: { id: msgId, tenantId },
      });
      if (!msg) throw new NotFoundException('Message not found');
      const att = [...(msg.attachments || [])];
      const a = att[idx] as { url?: string } | undefined;
      if (!a) throw new NotFoundException('Attachment not found');
      const rel = extractRelativePathFromPublicUrl(a.url || '');
      if (rel && pathBelongsToTenant(tenantId, rel)) {
        await unlinkUploadsRelative(rel);
      }
      att.splice(idx, 1);
      msg.attachments = att.length ? att : null;
      await this.tgMsgRepo.save(msg);
      return;
    }

    if (kind === 'workspace') {
      const rel = decodeURIComponent(parts.slice(1).join('|'));
      if (rel.includes('..') || !isWorkspaceTenantPath(tenantId, rel)) {
        throw new ForbiddenException('Invalid file');
      }
      await unlinkUploadsRelative(rel);
      await this.clearWorkspaceFileRefs(tenantId, rel);
      return;
    }

    if (kind === 'disk') {
      const rel = decodeURIComponent(parts.slice(1).join('|'));
      if (rel.includes('..') || !isTenantDiskPath(tenantId, rel)) {
        throw new ForbiddenException('Invalid file');
      }
      const t = await this.tenantRepo.findOne({ where: { id: tenantId } });
      const lr = t?.logoUrl ? extractRelativePathFromPublicUrl(t.logoUrl) : null;
      if (
        lr &&
        rel.replace(/\\/g, '/').toLowerCase() ===
          lr.replace(/\\/g, '/').toLowerCase()
      ) {
        throw new ForbiddenException('Use logo entry to remove company logo');
      }
      await unlinkUploadsRelative(rel);
      await this.clearWorkspaceFileRefs(tenantId, rel);
      return;
    }

    throw new BadRequestException('Unknown file id');
  }

  /** Убираем ссылку на файл из полей типа file в записях рабочих областей. */
  private async clearWorkspaceFileRefs(
    tenantId: string,
    relativePath: string,
  ): Promise<void> {
    const records = await this.customObjectRecordRepo.find({
      where: { tenantId },
    });
    for (const r of records) {
      const v = { ...(r.values || {}) };
      let changed = false;
      for (const key of Object.keys(v)) {
        const val = v[key];
        if (val === null || val === undefined) continue;
        if (typeof val !== 'object' || Array.isArray(val)) continue;
        const vr = (val as { relativePath?: string }).relativePath;
        if (
          typeof vr === 'string' &&
          vr.replace(/\\/g, '/').toLowerCase() ===
            relativePath.replace(/\\/g, '/').toLowerCase()
        ) {
          v[key] = null;
          changed = true;
        }
      }
      if (changed) {
        r.values = v;
        await this.customObjectRecordRepo.save(r);
      }
    }
  }

  /** Кто «отправитель» вложения в контексте письма (для колонки «кто загрузил»). */
  private emailAttachmentUploaderLabel(e: EmailMessage): string | null {
    const dir = (e.direction || '').toLowerCase();
    if (dir === 'incoming') {
      return e.from?.trim() || null;
    }
    if (dir === 'outgoing') {
      const to = (e.to || []).find((x) => x?.trim());
      if (to) return to.trim();
      return e.from?.trim() || null;
    }
    return e.from?.trim() || null;
  }

  /** Контакт Telegram для входящих вложений. */
  private telegramAttachmentLabel(t: TelegramMessage): string | null {
    const dir = (t.direction || '').toLowerCase();
    const c = t.contact;
    if (!c) return null;
    if (dir === 'incoming') {
      const un = (c.telegramUsername || '').replace(/^@/, '').trim();
      if (un) return `@${un}`;
      const name = [c.telegramFirstName, c.telegramLastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (name) return name;
      return c.telegramPhone?.trim() || null;
    }
    return null;
  }
}
