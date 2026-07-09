import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { randomBytes } from 'crypto';
import { promises as fsp } from 'fs';
import { join, extname, basename } from 'path';

import { EmbedForm } from './embed-form.entity';
import { EmbedFormUpload } from './embed-form-upload.entity';
import { Site } from '../sites/site.entity';
import { CreateEmbedFormDto } from './dto/create-embed-form.dto';
import { UpdateEmbedFormDto } from './dto/update-embed-form.dto';
import {
  EMBED_TEMPLATE_KEYS,
  getDefaultDesignClone,
  getTemplateFieldConfig,
  isTemplateKey,
  type EmbedFieldConfigItem,
} from './embed-form-templates';
import { isOriginAllowedForPublicEmbed } from './embed-origin.util';
import { signEmbedPreviewToken, verifyEmbedPreviewToken } from './embed-preview-token.util';
import { LeadsService } from '../leads/leads.service';
import { getUploadsRoot } from '../common/uploads-root.util';

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_EXT = new Set(['.pdf', '.doc', '.docx']);

function relaxedOriginCheck(): boolean {
  return process.env.EMBED_RELAXED_ORIGIN === '1' || process.env.NODE_ENV === 'test';
}

function safePlain(s: unknown, max: number): string {
  if (s === null || s === undefined) return '';
  const t = String(s).replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  return t.length > max ? t.slice(0, max) : t;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

@Injectable()
export class EmbedFormsService {
  private readonly jwtSecret: string;

  constructor(
    @InjectRepository(EmbedForm) private formsRepo: Repository<EmbedForm>,
    @InjectRepository(EmbedFormUpload) private uploadsRepo: Repository<EmbedFormUpload>,
    @InjectRepository(Site) private sitesRepo: Repository<Site>,
    private readonly leadsService: LeadsService,
    config: ConfigService,
  ) {
    this.jwtSecret = config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'unsafe';
  }

  private async genPublicId(): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const id = randomBytes(16).toString('base64url');
      const c = await this.formsRepo.count({ where: { publicId: id } });
      if (!c) return id;
    }
    throw new BadRequestException('publicId collision');
  }

  private honeypotName(): string {
    return `hq_${randomBytes(6).toString('hex')}`;
  }

  listTemplates() {
    return {
      items: EMBED_TEMPLATE_KEYS.map((key) => ({ key, defaults: { templateKey: key } })),
    };
  }

  async list(tenantId: string) {
    return this.formsRepo.find({
      where: { tenantId },
      order: { updatedAt: 'DESC' },
      relations: ['site'],
    });
  }

  async getForTenant(tenantId: string, id: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    );
    if (isUuid) {
      const f = await this.formsRepo.findOne({
        where: { id, tenantId },
        relations: ['site'],
      });
      if (f) return f;
    }
    const f = await this.formsRepo.findOne({
      where: { publicId: id, tenantId },
      relations: ['site'],
    });
    if (!f) throw new NotFoundException('Embed form not found');
    return f;
  }

  async create(tenantId: string, dto: CreateEmbedFormDto) {
    if (!isTemplateKey(dto.templateKey)) {
      throw new BadRequestException('Invalid templateKey');
    }
    const site = await this.sitesRepo.findOne({
      where: { id: dto.siteId, tenantId, status: 'active' } as any,
    });
    if (!site) throw new BadRequestException('Site not found for tenant');

    const fieldConfig = getTemplateFieldConfig(dto.templateKey);
    const design = getDefaultDesignClone();
    const publicId = await this.genPublicId();

    const row = this.formsRepo.create({
      tenantId,
      siteId: site.id,
      name: safePlain(dto.name, 200),
      publicId,
      templateKey: dto.templateKey,
      fieldConfig: fieldConfig as any,
      design,
      published: false,
      honeypotField: this.honeypotName(),
      privacyPolicyUrl: null,
      successMessage: null,
    });
    return this.formsRepo.save(row);
  }

  async update(tenantId: string, id: string, dto: UpdateEmbedFormDto) {
    const f = await this.getForTenant(tenantId, id);
    if (dto.name !== undefined) f.name = safePlain(dto.name, 200);
    if (dto.published !== undefined) f.published = dto.published;
    if (dto.privacyPolicyUrl !== undefined) {
      f.privacyPolicyUrl = dto.privacyPolicyUrl ? safePlain(dto.privacyPolicyUrl, 2000) : null;
    }
    if (dto.successMessage !== undefined) {
      f.successMessage = dto.successMessage ? safePlain(dto.successMessage, 2000) : null;
    }
    if (dto.fieldConfig != null) {
      this.assertFieldConfigShape(dto.fieldConfig);
      f.fieldConfig = dto.fieldConfig;
    }
    if (dto.design != null) {
      f.design = this.sanitizeDesign(dto.design);
    }
    if (dto.name !== undefined && !String(f.name).trim()) {
      throw new BadRequestException('name required');
    }
    return this.formsRepo.save(f);
  }

  private assertFieldConfigShape(cfg: Record<string, unknown>) {
    const fields = cfg?.['fields'] as unknown;
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new BadRequestException('fieldConfig.fields must be a non-empty array');
    }
    for (const row of fields) {
      if (!row || typeof row !== 'object') {
        throw new BadRequestException('Invalid field row');
      }
    }
  }

  private sanitizeDesign(d: Record<string, unknown>): Record<string, unknown> {
    const n: Record<string, unknown> = { ...d };
    const numKeys: { key: string; max: number }[] = [
      { key: 'fontSizePx', max: 200 },
      { key: 'headingSizePx', max: 200 },
      { key: 'borderRadiusPx', max: 200 },
      { key: 'fieldPaddingPx', max: 200 },
      { key: 'gapPx', max: 200 },
      { key: 'buttonPaddingXPx', max: 200 },
      { key: 'buttonPaddingYPx', max: 200 },
      { key: 'buttonBorderRadiusPx', max: 200 },
      { key: 'buttonFontWeight', max: 900 },
      { key: 'labelWeight', max: 900 },
      { key: 'formOuterPadXPx', max: 120 },
      { key: 'formOuterPadYPx', max: 120 },
      { key: 'formMaxWidthPx', max: 1920 },
    ];
    for (const { key, max } of numKeys) {
      const v = n[key];
      if (v !== undefined) {
        const x = Number(v);
        if (!Number.isFinite(x) || x < 0 || x > max) {
          delete n[key];
        } else {
          n[key] = x;
        }
      }
    }
    if (n['buttonWidth'] !== 'full' && n['buttonWidth'] !== 'auto') {
      n['buttonWidth'] = 'full';
    }
    const allowColor = (s: string): string | null => {
      const t = String(s).trim();
      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(t)) return t;
      if (/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(\s*,\s*[\d.]+\s*)?\s*\)$/.test(t))
        return t;
      return null;
    };
    for (const ck of [
      'textColor',
      'backgroundColor',
      'fieldBackground',
      'borderColor',
      'buttonBackground',
      'buttonTextColor',
      'accentColor',
    ]) {
      if (n[ck] !== undefined && typeof n[ck] === 'string') {
        const s = allowColor(n[ck] as string);
        if (s) n[ck] = s;
        else delete n[ck];
      }
    }
    if (n['fontFamily'] !== undefined && typeof n['fontFamily'] === 'string') {
      n['fontFamily'] = safePlain(n['fontFamily'], 400);
    }
    return n;
  }

  async remove(tenantId: string, id: string) {
    const f = await this.getForTenant(tenantId, id);
    await this.uploadsRepo.delete({ formId: f.id, tenantId });
    await this.formsRepo.remove(f);
    return { ok: true as const };
  }

  getPreviewToken(tenantId: string, id: string, userId: string) {
    return this.getForTenant(tenantId, id).then((f) => {
      return {
        token: signEmbedPreviewToken(f.publicId, userId, this.jwtSecret, 900),
        expiresIn: 900,
        publicId: f.publicId,
      };
    });
  }

  async getPublicConfig(publicId: string, previewToken?: string) {
    const f = await this.formsRepo.findOne({
      where: { publicId },
      relations: ['site'],
    });
    if (!f) {
      throw new NotFoundException('Form not found');
    }
    if (!f.published) {
      if (!previewToken) {
        throw new NotFoundException('Form not found');
      }
      const v = verifyEmbedPreviewToken(previewToken.trim(), this.jwtSecret);
      if (!v.valid || v.publicId !== f.publicId) {
        throw new NotFoundException('Form not found');
      }
    }
    return {
      publicId: f.publicId,
      name: f.name,
      templateKey: f.templateKey,
      fieldConfig: f.fieldConfig,
      design: f.design,
      honeypotField: f.honeypotField,
      successMessage: f.successMessage,
      privacyPolicyUrl: f.privacyPolicyUrl,
      siteLabel: f.site?.name || f.site?.domain,
    };
  }

  async submit(
    publicId: string,
    body: Record<string, unknown>,
    origin: string | undefined,
    referer: string | undefined,
    previewTokenHeader: string | undefined,
  ) {
    const f = await this.formsRepo.findOne({
      where: { publicId },
      relations: ['site'],
    });
    if (!f) {
      throw new NotFoundException('Form not found');
    }

    let preview = false;
    if (previewTokenHeader) {
      const v = verifyEmbedPreviewToken(previewTokenHeader.trim(), this.jwtSecret);
      if (v.valid && v.publicId === f.publicId) {
        preview = true;
      } else {
        throw new ForbiddenException('Invalid preview token');
      }
    }

    if (!f.published && !preview) {
      throw new NotFoundException('Form not found');
    }

    const site = f.site;
    if (!site || site.status !== 'active') {
      throw new ForbiddenException('Site inactive');
    }

    const hp = f.honeypotField;
    if (body[hp] != null && String(body[hp]).trim() !== '') {
      // Бот: «успех» без записи, чтобы не учить ботов
      return { ok: true, accepted: true, silent: true };
    }

    if (!preview) {
      const okO =
        relaxedOriginCheck() ||
        isOriginAllowedForPublicEmbed(site.domain, origin, referer);
      if (!okO) {
        throw new ForbiddenException({
          code: 'ORIGIN_NOT_ALLOWED',
          message: 'Request origin does not match registered site domain',
        });
      }
    }

    const fields = (f.fieldConfig as { fields: EmbedFieldConfigItem[] })?.fields || [];
    const parsed: Record<string, unknown> = {};
    const fileIds: string[] = Array.isArray(body['attachmentIds'])
      ? (body['attachmentIds'] as unknown[]).map((x) => String(x)).filter(Boolean)
      : [];

    for (const spec of fields) {
      if (spec.type === 'html' || spec.type === 'divider') {
        continue;
      }
      if (spec.type === 'file') {
        if (!fileIds.length && spec.required) {
          throw new BadRequestException(`Field ${spec.key} (file) required`);
        }
        continue;
      }
      const raw = body[spec.id];
      if (spec.type === 'multi_checkbox') {
        const arr = Array.isArray(raw)
          ? raw.map((x) => safePlain(x, 200)).filter(Boolean)
          : [];
        if (spec.required && !arr.length) {
          throw new BadRequestException(`Field ${spec.key} is required`);
        }
        const allowed = new Set((spec.options || []).map((o) => o.value));
        if (arr.some((value) => !allowed.has(value))) {
          throw new BadRequestException(`Invalid value for ${spec.key}`);
        }
        parsed[spec.key] = arr;
        continue;
      }
      if (spec.type === 'checkbox_consent') {
        const on = raw === true || raw === 'true' || raw === 1 || raw === '1';
        if (spec.required && !on) {
          throw new BadRequestException('Consent is required');
        }
        parsed[spec.key] = on;
        continue;
      }
      if (raw === null || raw === undefined) {
        if (spec.required) {
          throw new BadRequestException(`Field ${spec.key} is required`);
        }
        continue;
      }
      const s = safePlain(
        raw,
        spec.maxLength && spec.maxLength > 0 ? spec.maxLength : 12000,
      );
      if (spec.required && !s) {
        throw new BadRequestException(`Field ${spec.key} is required`);
      }
      if (spec.type === 'email' && s && !isValidEmail(s)) {
        throw new BadRequestException('Invalid e-mail');
      }
      if (spec.type === 'url' && s) {
        try {
          const u = new URL(s.startsWith('http') ? s : `https://${s}`);
          if (!u.hostname) throw new Error();
        } catch {
          throw new BadRequestException('Invalid URL');
        }
      }
      if ((spec.type === 'number' || spec.type === 'range' || spec.type === 'guests') && s) {
        if (!Number.isFinite(Number(s))) {
          throw new BadRequestException(`Invalid number for ${spec.key}`);
        }
      }
      if (spec.type === 'date' && s) {
        const d = Date.parse(String(s));
        if (Number.isNaN(d)) {
          throw new BadRequestException(`Invalid date for ${spec.key}`);
        }
      }
      if (spec.type === 'time' && s && !/^\d{2}:\d{2}$/.test(s)) {
        throw new BadRequestException(`Invalid time for ${spec.key}`);
      }
      if (spec.type === 'datetime' && s) {
        const d = Date.parse(String(s));
        if (Number.isNaN(d)) {
          throw new BadRequestException(`Invalid datetime for ${spec.key}`);
        }
      }
      if (['select', 'radio', 'service', 'specialist'].includes(spec.type) && s) {
        const ok = (spec.options || []).some((o) => o.value === s);
        if (!ok) {
          throw new BadRequestException(`Invalid value for ${spec.key}`);
        }
      }
      if (spec.type === 'messaging' && s) {
        if (!['whatsapp', 'telegram', 'email'].includes(s)) {
          throw new BadRequestException('Invalid messaging value');
        }
      }
      if ((spec.type === 'number' || spec.type === 'range' || spec.type === 'guests') && s) {
        parsed[spec.key] = Number(s);
      } else if (spec.type === 'checkbox') {
        parsed[spec.key] = raw === true || raw === 'true' || raw === 1 || raw === '1';
      } else {
        parsed[spec.key] = s;
      }
    }

    if (fileIds.length) {
      const uploads = await this.uploadsRepo.find({
        where: { id: In(fileIds), formId: f.id, tenantId: f.tenantId },
      });
      if (uploads.length !== fileIds.length) {
        throw new BadRequestException('Invalid attachment reference');
      }
      parsed['__files'] = uploads.map((u) => ({
        name: u.originalName,
        path: u.relativePath,
        id: u.id,
      }));
    }

    if (preview) {
      return { ok: true, accepted: true, preview: true };
    }

    const lead = await this.leadsService.createFromEmbedForm({
      tenantId: f.tenantId,
      siteId: site.id,
      formId: f.id,
      publicId: f.publicId,
      formName: f.name,
      templateKey: f.templateKey,
      referer: referer || null,
      fieldValues: parsed,
    });

    if (fileIds.length) {
      await this.uploadsRepo.delete({ id: In(fileIds) });
    }

    return { ok: true, accepted: true, leadId: lead.id };
  }

  /**
   * Загрузка файла с той же проверкой origin, что и submit (и preview в CRM).
   */
  async savePublicUpload(
    publicId: string,
    file: { path: string; mimetype: string; size: number; originalname: string },
    origin: string | undefined,
    referer: string | undefined,
    previewTokenHeader: string | undefined,
  ) {
    const f = await this.formsRepo.findOne({
      where: { publicId },
      relations: ['site'],
    });
    if (!f) throw new NotFoundException('Form not found');

    let preview = false;
    if (previewTokenHeader) {
      const v = verifyEmbedPreviewToken(previewTokenHeader.trim(), this.jwtSecret);
      if (v.valid && v.publicId === f.publicId) preview = true;
      else throw new ForbiddenException('Invalid preview token');
    }
    if (!f.published && !preview) throw new NotFoundException('Form not found');
    const site = f.site;
    if (!site) throw new ForbiddenException('Site missing');

    if (!preview) {
      const okO =
        relaxedOriginCheck() ||
        isOriginAllowedForPublicEmbed(site.domain, origin, referer);
      if (!okO) {
        try {
          await fsp.unlink(file.path);
        } catch {
          // ignore
        }
        throw new ForbiddenException({
          code: 'ORIGIN_NOT_ALLOWED',
          message: 'Request origin does not match registered site domain',
        });
      }
    }

    if (file.size > MAX_FILE_BYTES) {
      try {
        await fsp.unlink(file.path);
      } catch {
        // ignore
      }
      throw new BadRequestException('File too large');
    }
    const mt = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_MIME.has(mt)) {
      try {
        await fsp.unlink(file.path);
      } catch {
        // ignore
      }
      throw new BadRequestException('Invalid file type');
    }
    const ext = extname(file.originalname || '').toLowerCase();
    if (ext && !ALLOWED_EXT.has(ext)) {
      try {
        await fsp.unlink(file.path);
      } catch {
        // ignore
      }
      throw new BadRequestException('Invalid extension');
    }

    const root = getUploadsRoot();
    const id = randomBytes(16).toString('hex');
    const safeBase = safePlain(
      basename(file.originalname || 'file').replace(/[^\w.\-() ]+/g, '_'),
      200,
    );
    const rel = `tenants/${f.tenantId}/embed/${f.id}/${id}${ext || '.bin'}`;
    const abs = join(root, rel);
    await fsp.mkdir(join(root, `tenants/${f.tenantId}/embed/${f.id}`), {
      recursive: true,
    });
    await fsp.copyFile(file.path, abs);
    try {
      await fsp.unlink(file.path);
    } catch {
      // ignore
    }

    const row = this.uploadsRepo.create({
      tenantId: f.tenantId,
      formId: f.id,
      relativePath: rel,
      originalName: safeBase,
      mimetype: mt,
      sizeBytes: String(file.size),
    });
    const saved = await this.uploadsRepo.save(row);
    return { id: saved.id, name: saved.originalName };
  }
}
