// src/esign/esign.service.ts
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as fs from 'fs/promises';
import { dirname } from 'path';
import { EsignDocument } from './esign-document.entity';
import { EsignTemplate } from './esign-template.entity';
import { ESIGN_DEFAULT_TEMPLATES } from './esign-default-templates';
import { Contact } from '../contacts/contact.entity';
import { Tenant } from '../tenants/tenant.entity';
import { Lead } from '../leads/lead.entity';
import { Company } from '../companies/company.entity';
import { Project } from '../projects/project.entity';
import { MailService } from '../mail/mail.service';
import { renderEsignPdf } from './esign-pdf.util';
import { signEsignToken, verifyEsignToken } from './esign-token.util';
import { joinUploadsAbsolute } from '../common/uploads-root.util';

export type EsignLinkType = 'lead' | 'company' | 'project';

function interpolate(text: string, data: Record<string, any>): string {
  return text.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_m, path: string) => {
    const value = path.split('.').reduce((acc: any, key: string) => (acc == null ? acc : acc[key]), data);
    return value == null ? '' : String(value);
  });
}

@Injectable()
export class EsignService {
  constructor(
    @InjectRepository(EsignDocument) private readonly docRepo: Repository<EsignDocument>,
    @InjectRepository(EsignTemplate) private readonly templateRepo: Repository<EsignTemplate>,
    @InjectRepository(Contact) private readonly contactRepo: Repository<Contact>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Lead) private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    private readonly mail: MailService,
  ) {}

  private get secret(): string {
    const s = process.env.JWT_SECRET;
    if (!s) throw new UnauthorizedException('Esign auth misconfigured');
    return s;
  }

  private async writePdf(tenantId: string, documentId: string, suffix: 'draft' | 'signed', buffer: Buffer): Promise<string> {
    const relPath = `esign/${tenantId}/${documentId}-${suffix}.pdf`;
    const absPath = joinUploadsAbsolute(relPath);
    await fs.mkdir(dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, buffer);
    return `/v1/uploads/${relPath}`;
  }

  private repoForLinkType(type: EsignLinkType): Repository<{ id: string; name: string | null; tenantId: string | null }> {
    if (type === 'lead') return this.leadRepo as any;
    if (type === 'company') return this.companyRepo as any;
    return this.projectRepo as any;
  }

  private async resolveEntityLabel(tenantId: string, type: string | null, id: string | null): Promise<string | null> {
    if (!type || !id) return null;
    if (type !== 'lead' && type !== 'company' && type !== 'project') return null;
    const repo = this.repoForLinkType(type);
    const row = await repo.findOne({ where: { id, tenantId } as any });
    return row?.name || null;
  }

  async searchLinkEntities(tenantId: string, type: EsignLinkType, search?: string) {
    if (type !== 'lead' && type !== 'company' && type !== 'project') throw new BadRequestException('Неизвестный тип привязки');
    const repo = this.repoForLinkType(type);
    const qb = repo.createQueryBuilder('e').where('e.tenantId = :tenantId', { tenantId }).andWhere('e.name IS NOT NULL');
    if (search?.trim()) qb.andWhere('e.name ILIKE :s', { s: `%${search.trim()}%` });
    const rows = await qb.orderBy('e.name', 'ASC').limit(10).getMany();
    return rows.map((r: any) => ({ id: r.id, name: r.name }));
  }

  private async decorateRow(d: EsignDocument, contactById: Map<string, Contact>) {
    const contact = d.contactId ? contactById.get(d.contactId) : null;
    return {
      id: d.id,
      title: d.title,
      kind: d.kind,
      status: d.status,
      contactName: contact ? contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') : null,
      entityType: d.entityType,
      entityId: d.entityId,
      entityLabel: await this.resolveEntityLabel(d.tenantId, d.entityType, d.entityId),
      pageCount: d.pageCount,
      sentAt: d.sentAt,
      viewedAt: d.viewedAt,
      signedAt: d.signedAt,
      createdAt: d.createdAt,
    };
  }

  async listDocuments(tenantId: string) {
    const docs = await this.docRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
    const contactIds = [...new Set(docs.map((d) => d.contactId).filter((id): id is string => !!id))];
    const contacts = contactIds.length ? await this.contactRepo.find({ where: { id: In(contactIds) } }) : [];
    const contactById = new Map(contacts.map((c) => [c.id, c]));
    return Promise.all(docs.map((d) => this.decorateRow(d, contactById)));
  }

  async getDocument(tenantId: string, id: string) {
    const doc = await this.docRepo.findOne({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('Документ не найден');
    const contact = doc.contactId ? await this.contactRepo.findOne({ where: { id: doc.contactId } }) : null;
    return {
      ...doc,
      contactName: contact ? contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') : null,
      entityLabel: await this.resolveEntityLabel(doc.tenantId, doc.entityType, doc.entityId),
    };
  }

  async createDocument(tenantId: string, input: {
    contactId?: string | null;
    title: string;
    bodyTemplate: string;
    kind?: string;
    entityType?: EsignLinkType | null;
    entityId?: string | null;
    templateId?: string | null;
    createdByUserId: string;
  }) {
    let bodyTemplate = input.bodyTemplate;
    let kind = input.kind?.trim() || 'Договор';

    if (input.templateId) {
      const tpl = await this.templateRepo.findOne({ where: { id: input.templateId, tenantId } });
      if (!tpl) throw new NotFoundException('Шаблон не найден');
      if (!bodyTemplate?.trim()) bodyTemplate = tpl.bodyTemplate;
      if (!input.kind) kind = tpl.kind;
    }

    if (!input.title?.trim()) throw new BadRequestException('Укажите название документа');
    if (!bodyTemplate?.trim()) throw new BadRequestException('Текст документа не может быть пустым');

    if (input.entityType && !['lead', 'company', 'project'].includes(input.entityType)) {
      throw new BadRequestException('Неизвестный тип привязки');
    }
    if (input.entityType && input.entityId) {
      const label = await this.resolveEntityLabel(tenantId, input.entityType, input.entityId);
      if (!label) throw new BadRequestException('Связанная запись не найдена');
    }

    const [contact, tenant] = await Promise.all([
      input.contactId ? this.contactRepo.findOne({ where: { id: input.contactId, tenantId } }) : Promise.resolve(null),
      this.tenantRepo.findOne({ where: { id: tenantId } }),
    ]);

    const bodyText = interpolate(bodyTemplate, {
      contact: contact
        ? { name: contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' '), email: contact.email, phone: contact.phone }
        : {},
      tenant: { name: tenant?.name || '' },
      date: new Date().toLocaleDateString('ru-RU'),
    });

    const doc = await this.docRepo.save(
      this.docRepo.create({
        tenantId,
        contactId: input.contactId || null,
        createdByUserId: input.createdByUserId,
        title: input.title.trim(),
        kind,
        bodyText,
        signerEmail: contact?.email || null,
        entityType: (input.entityType as string) || null,
        entityId: input.entityId || null,
      }),
    );

    const pdf = await renderEsignPdf(doc.title, doc.bodyText);
    doc.draftPdfUrl = await this.writePdf(tenantId, doc.id, 'draft', pdf.buffer);
    doc.pageCount = pdf.pageCount;
    await this.docRepo.save(doc);
    return doc;
  }

  /** Editing is only allowed while the document is still a draft — once it's been sent the
   * text becomes part of the audit trail (what the signer saw/signed), so it can't change
   * under them. bodyText here is the already-interpolated final text, not a template. */
  async updateDocument(
    tenantId: string,
    id: string,
    input: {
      title?: string;
      kind?: string;
      bodyText?: string;
      contactId?: string | null;
      entityType?: EsignLinkType | null;
      entityId?: string | null;
    },
  ) {
    const doc = await this.docRepo.findOne({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('Документ не найден');
    if (doc.status !== 'draft') throw new BadRequestException('Редактировать можно только черновики');

    if (input.entityType !== undefined && input.entityType && !['lead', 'company', 'project'].includes(input.entityType)) {
      throw new BadRequestException('Неизвестный тип привязки');
    }
    if (input.entityType && input.entityId) {
      const label = await this.resolveEntityLabel(tenantId, input.entityType, input.entityId);
      if (!label) throw new BadRequestException('Связанная запись не найдена');
    }

    if (input.title !== undefined) {
      if (!input.title.trim()) throw new BadRequestException('Укажите название документа');
      doc.title = input.title.trim();
    }
    if (input.kind !== undefined) doc.kind = input.kind.trim() || 'Договор';
    if (input.bodyText !== undefined) {
      if (!input.bodyText.trim()) throw new BadRequestException('Текст документа не может быть пустым');
      doc.bodyText = input.bodyText.trim();
    }
    if (input.contactId !== undefined) {
      doc.contactId = input.contactId || null;
      const contact = doc.contactId ? await this.contactRepo.findOne({ where: { id: doc.contactId, tenantId } }) : null;
      doc.signerEmail = contact?.email || null;
    }
    if (input.entityType !== undefined) doc.entityType = (input.entityType as string) || null;
    if (input.entityId !== undefined) doc.entityId = input.entityId || null;

    const pdf = await renderEsignPdf(doc.title, doc.bodyText);
    doc.draftPdfUrl = await this.writePdf(tenantId, doc.id, 'draft', pdf.buffer);
    doc.pageCount = pdf.pageCount;

    return this.docRepo.save(doc);
  }

  async deleteDocument(tenantId: string, id: string) {
    const doc = await this.docRepo.findOne({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('Документ не найден');
    if (doc.status !== 'draft') throw new BadRequestException('Удалить можно только черновик — отправленные и подписанные документы хранятся как история');

    if (doc.draftPdfUrl) {
      const relPath = doc.draftPdfUrl.replace(/^\/v1\/uploads\//, '');
      try {
        await fs.unlink(joinUploadsAbsolute(relPath));
      } catch {
        /* file may already be gone — not fatal */
      }
    }
    await this.docRepo.remove(doc);
    return { ok: true };
  }

  async duplicateDocument(tenantId: string, id: string, createdByUserId: string) {
    const source = await this.getDocument(tenantId, id);
    return this.createDocument(tenantId, {
      contactId: source.contactId,
      title: `${source.title} (копия)`,
      bodyTemplate: source.bodyText,
      kind: source.kind,
      entityType: source.entityType as EsignLinkType | null,
      entityId: source.entityId,
      createdByUserId,
    });
  }

  private async sendSignatureEmail(doc: EsignDocument, isReminder: boolean) {
    if (!doc.signerEmail) throw new BadRequestException('У документа нет email получателя — привяжите контакт с email');
    const tenant = await this.tenantRepo.findOne({ where: { id: doc.tenantId } });

    const token = signEsignToken(doc.id, this.secret);
    const signUrl = `${(process.env.FRONTEND_URL || 'https://crm.lumiva.agency').replace(/\/$/, '')}/esign/${token}`;
    const subjectPrefix = isReminder ? 'Напоминание: документ на подпись' : 'Документ на подпись';

    await this.mail.sendMail({
      to: doc.signerEmail,
      subject: `${subjectPrefix}: ${doc.title} — ${tenant?.name || ''}`,
      html: `<!doctype html><html><body style="font-family:sans-serif;color:#0f172a;padding:24px;">
        <p>Здравствуйте!</p>
        <p>${isReminder ? 'Напоминаем, что ' : ''}<strong>${tenant?.name || 'Компания'}</strong> отправила вам документ на подписание: <strong>${doc.title}</strong>.</p>
        <p><a href="${signUrl}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;border-radius:8px;text-decoration:none;">Просмотреть и подписать</a></p>
        <p style="font-size:12px;color:#64748b;">Ссылка действует 30 дней.</p>
      </body></html>`,
    });
  }

  async sendForSignature(tenantId: string, id: string) {
    const doc = await this.docRepo.findOne({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('Документ не найден');
    await this.sendSignatureEmail(doc, false);
    doc.status = 'sent';
    doc.sentAt = new Date();
    return this.docRepo.save(doc);
  }

  async remindSignature(tenantId: string, id: string) {
    const doc = await this.docRepo.findOne({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('Документ не найден');
    if (doc.status !== 'sent' && doc.status !== 'viewed' && doc.status !== 'expired') {
      throw new BadRequestException('Напоминание доступно только для отправленных документов');
    }
    await this.sendSignatureEmail(doc, true);
    if (doc.status === 'expired') doc.status = 'sent';
    return this.docRepo.save(doc);
  }

  // ========= templates =========

  /** Called once on tenant signup (see AuthService.signup) so a brand-new tenant's "Подпись
   * документов" page never starts with an empty template gallery. Idempotent — a no-op if
   * the tenant somehow already has templates. */
  async seedDefaultTemplates(tenantId: string) {
    const existing = await this.templateRepo.count({ where: { tenantId } });
    if (existing > 0) return;
    await this.templateRepo.save(
      ESIGN_DEFAULT_TEMPLATES.map((tpl) => this.templateRepo.create({ tenantId, ...tpl })),
    );
  }

  async listTemplates(tenantId: string) {
    return this.templateRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async createTemplate(tenantId: string, input: { name: string; description?: string; kind?: string; bodyTemplate: string }) {
    if (!input.name?.trim()) throw new BadRequestException('Укажите название шаблона');
    if (!input.bodyTemplate?.trim()) throw new BadRequestException('Текст шаблона не может быть пустым');
    return this.templateRepo.save(
      this.templateRepo.create({
        tenantId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        kind: input.kind?.trim() || 'Договор',
        bodyTemplate: input.bodyTemplate.trim(),
      }),
    );
  }

  async updateTemplate(tenantId: string, id: string, input: { name?: string; description?: string; kind?: string; bodyTemplate?: string }) {
    const tpl = await this.templateRepo.findOne({ where: { id, tenantId } });
    if (!tpl) throw new NotFoundException('Шаблон не найден');
    if (input.name !== undefined) tpl.name = input.name.trim();
    if (input.description !== undefined) tpl.description = input.description?.trim() || null;
    if (input.kind !== undefined) tpl.kind = input.kind.trim();
    if (input.bodyTemplate !== undefined) tpl.bodyTemplate = input.bodyTemplate.trim();
    return this.templateRepo.save(tpl);
  }

  async deleteTemplate(tenantId: string, id: string) {
    const tpl = await this.templateRepo.findOne({ where: { id, tenantId } });
    if (!tpl) throw new NotFoundException('Шаблон не найден');
    await this.templateRepo.remove(tpl);
    return { ok: true };
  }

  // ========= public signing flow =========

  private async resolveByToken(token: string): Promise<EsignDocument> {
    const result = verifyEsignToken(token, this.secret);
    if (!result.valid) throw new UnauthorizedException('Ссылка недействительна или истекла');
    const doc = await this.docRepo.findOne({ where: { id: result.documentId } });
    if (!doc) throw new NotFoundException('Документ не найден');
    return doc;
  }

  async getPublicDocument(token: string) {
    const doc = await this.resolveByToken(token);
    if (doc.status === 'sent') {
      doc.status = 'viewed';
      doc.viewedAt = new Date();
      await this.docRepo.save(doc);
    }
    return {
      id: doc.id,
      title: doc.title,
      bodyText: doc.bodyText,
      status: doc.status,
      signerEmail: doc.signerEmail,
      signedAt: doc.signedAt,
      signerName: doc.signerName,
    };
  }

  async signDocument(token: string, input: { signerName: string; ip: string; userAgent: string }) {
    const doc = await this.resolveByToken(token);
    if (doc.status === 'signed') return doc;
    if (doc.status === 'declined') throw new BadRequestException('Документ был отклонён ранее');
    if (!input.signerName?.trim()) throw new BadRequestException('Укажите ваше имя');

    doc.status = 'signed';
    doc.signerName = input.signerName.trim();
    doc.signatureIp = input.ip;
    doc.signatureUserAgent = input.userAgent.slice(0, 500);
    doc.signedAt = new Date();

    const pdf = await renderEsignPdf(doc.title, doc.bodyText, {
      signerName: doc.signerName,
      signedAt: doc.signedAt,
      ip: doc.signatureIp,
      userAgent: doc.signatureUserAgent,
    });
    doc.signedPdfUrl = await this.writePdf(doc.tenantId, doc.id, 'signed', pdf.buffer);
    doc.pageCount = pdf.pageCount;

    return this.docRepo.save(doc);
  }

  async declineDocument(token: string) {
    const doc = await this.resolveByToken(token);
    if (doc.status === 'signed') throw new BadRequestException('Документ уже подписан');
    doc.status = 'declined';
    doc.declinedAt = new Date();
    return this.docRepo.save(doc);
  }
}
