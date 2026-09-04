// src/esign/esign.service.ts
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as fs from 'fs/promises';
import { dirname } from 'path';
import { EsignDocument } from './esign-document.entity';
import { EsignTemplate } from './esign-template.entity';
import { EsignSequenceCounter } from './esign-sequence-counter.entity';
import { ESIGN_DEFAULT_TEMPLATES } from './esign-default-templates';
import { ESIGN_AUTO_KEYS, ESIGN_ITEM_KEYS, ESIGN_KEY_GROUPS, ESIGN_SEQUENCE_KEYS, extractKeys, renderKeys } from './esign-keys';
import { buildLegalRequisitesText } from '../common/legal-requisites';
import { computeItemValues, type EsignDocumentItem, type EsignItemPick } from './esign-items';
import { Contact } from '../contacts/contact.entity';
import { Tenant } from '../tenants/tenant.entity';
import { Lead } from '../leads/lead.entity';
import { Company } from '../companies/company.entity';
import { Project } from '../projects/project.entity';
import { Sale } from '../sales/sale.entity';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { BookingService } from '../bookings/booking-service.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { MailService } from '../mail/mail.service';
import { renderEsignPdf } from './esign-pdf.util';
import { signEsignToken, verifyEsignToken } from './esign-token.util';
import { joinUploadsAbsolute } from '../common/uploads-root.util';

export type EsignLinkType = 'lead' | 'company' | 'project';

function sanitizeFileName(s: string): string {
  const cleaned = s
    .replace(/[^\p{L}\p{N}\s.-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
  return cleaned.slice(0, 120) || 'document';
}

function parseAmount(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[\s ]/g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

@Injectable()
export class EsignService {
  constructor(
    @InjectRepository(EsignDocument) private readonly docRepo: Repository<EsignDocument>,
    @InjectRepository(EsignTemplate) private readonly templateRepo: Repository<EsignTemplate>,
    @InjectRepository(EsignSequenceCounter) private readonly sequenceRepo: Repository<EsignSequenceCounter>,
    @InjectRepository(Contact) private readonly contactRepo: Repository<Contact>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Lead) private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(Sale) private readonly saleRepo: Repository<Sale>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(BookingService) private readonly bookingServiceRepo: Repository<BookingService>,
    @InjectRepository(StaffUser) private readonly staffUserRepo: Repository<StaffUser>,
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

  // ========= {KEY} resolution =========

  getKeyCatalog() {
    return ESIGN_KEY_GROUPS;
  }

  private contactDisplayName(contact: Contact): string {
    return contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  }

  private async resolveAutoValues(tenantId: string, contactId: string | null, userId: string | null): Promise<Record<string, string>> {
    const [contact, tenant, user] = await Promise.all([
      contactId ? this.contactRepo.findOne({ where: { id: contactId, tenantId }, relations: ['company'] }) : Promise.resolve(null),
      this.tenantRepo.findOne({ where: { id: tenantId } }),
      userId ? this.userRepo.findOne({ where: { id: userId } }) : Promise.resolve(null),
    ]);

    const values: Record<string, string> = {};
    if (contact) {
      const name = this.contactDisplayName(contact);
      values.NAME = name || '';
      values.FIRST_NAME = contact.firstName || (name ? name.split(' ')[0] : '');
      values.PHONE = contact.phone || '';
      values.EMAIL = contact.email || '';
      values.ADDRESS = contact.address || '';
      values.PASSPORT = (contact.customFields?.passport as string) || '';
      values.COMPANY = contact.company?.name || '';
      values.TAX_ID = contact.company?.taxId || (contact.customFields?.taxId as string) || '';
      values.COMPANY_REQUISITES = buildLegalRequisitesText(contact.company?.legalRequisites) || '';
    }
    // {ORG_NAME}/{ORG_TAX}/{MANAGER} come straight from the tenant's real "Настройки компании"
    // page — filled in once there, not in a separate esign-only settings screen.
    values.ORG_NAME = tenant?.name || '';
    values.ORG_TAX = buildLegalRequisitesText(tenant?.legalRequisites) || tenant?.documentRequisites || '';
    values.MANAGER = tenant?.documentManagerName || user?.name || '';
    values.TODAY = new Date().toLocaleDateString('ru-RU');
    return values;
  }

  /** Read-only peek at the number the *next* document consuming {CONTRACT_NO} will get —
   * for UI display only, doesn't reserve it (concurrent issues can still race past a preview). */
  async previewNextContractNumber(tenantId: string): Promise<string> {
    const row = await this.sequenceRepo.findOne({ where: { tenantId } });
    return String(row?.nextContractSeq ?? 401).padStart(7, '0');
  }

  /** Atomically claims the next {CONTRACT_NO} for this tenant — single UPDATE...RETURNING (or
   * INSERT on first use), safe under concurrent issuance since Postgres serializes per-row. */
  private async consumeNextContractNumber(tenantId: string): Promise<string> {
    const rows: Array<{ nextContractSeq: number }> = await this.sequenceRepo.manager.query(
      `INSERT INTO "esign_sequence_counters" ("id", "tenantId", "nextContractSeq", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, 401, now(), now())
       ON CONFLICT ("tenantId") DO UPDATE SET "nextContractSeq" = "esign_sequence_counters"."nextContractSeq" + 1, "updatedAt" = now()
       RETURNING "nextContractSeq"`,
      [tenantId],
    );
    const used = rows[0]?.nextContractSeq ?? 401;
    return String(used).padStart(7, '0');
  }

  /** Candidate amounts for {AMOUNT} pulled from every place real money is tied to this contact
   * — Leads, Projects and Sales — so the issue wizard can offer a pick list instead of the user
   * having to remember which record has the right number. Most recent first, capped per source. */
  async getAmountSuggestions(tenantId: string, contactId: string) {
    const [leads, projects, sales] = await Promise.all([
      this.leadRepo.find({ where: { contactId, tenantId } as any, order: { createdAt: 'DESC' } as any, take: 5 }),
      this.projectRepo.find({ where: { contactId, tenantId } as any, order: { createdAt: 'DESC' } as any, take: 5 }),
      this.saleRepo.find({ where: { contactId, tenantId } as any, order: { createdAt: 'DESC' } as any, take: 5 }),
    ]);

    type Suggestion = { source: 'lead' | 'project' | 'sale'; refId: string; label: string; amount: string; currency: string; createdAt: Date };
    const suggestions: Suggestion[] = [
      ...leads
        .filter((l: any) => Number(l.amount) > 0)
        .map((l: any) => ({ source: 'lead' as const, refId: l.id, label: l.title || l.name || 'Лид', amount: String(l.amount), currency: l.currency || '', createdAt: l.createdAt })),
      ...projects
        .filter((p: any) => Number(p.amount) > 0)
        .map((p: any) => ({ source: 'project' as const, refId: p.id, label: p.name || 'Проект', amount: String(p.amount), currency: p.currency || '', createdAt: p.createdAt })),
      ...sales
        .filter((s: any) => Number(s.amount) > 0)
        .map((s: any) => ({
          source: 'sale' as const,
          refId: s.id,
          label: s.externalOrderNo || s.guestName || 'Продажа',
          amount: String(s.amount),
          currency: s.currency || '',
          createdAt: s.createdAt,
        })),
    ];
    suggestions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return suggestions.map(({ createdAt, ...rest }) => rest);
  }

  async getAutoValues(tenantId: string, contactId: string | null, userId: string | null) {
    if (contactId) {
      const exists = await this.contactRepo.count({ where: { id: contactId, tenantId } });
      if (!exists) throw new NotFoundException('Клиент не найден');
    }
    return this.resolveAutoValues(tenantId, contactId, userId);
  }

  /** Resolves picked products/booking-services against the real catalog and snapshots them —
   * prices in a contract must come from the tenant's own data, never trust the client payload. */
  private async resolveItems(tenantId: string, picks: EsignItemPick[] | undefined): Promise<EsignDocumentItem[]> {
    if (!picks?.length) return [];
    const items: EsignDocumentItem[] = [];
    for (const pick of picks) {
      if (pick.kind === 'product') {
        const p = await this.productRepo.findOne({ where: { id: pick.refId, tenantId } });
        if (!p) throw new BadRequestException('Товар не найден — возможно, он был удалён');
        items.push({ kind: 'product', refId: p.id, name: p.name, sku: p.sku, price: p.price, currency: p.currency });
      } else if (pick.kind === 'service') {
        const s = await this.bookingServiceRepo.findOne({ where: { id: pick.refId, tenantId } });
        if (!s) throw new BadRequestException('Услуга не найдена — возможно, она была удалена');
        let masterId = pick.masterId || null;
        if (!masterId && s.staffUserIds?.length === 1) masterId = s.staffUserIds[0];
        let masterName: string | null = null;
        if (masterId) {
          const su = await this.staffUserRepo.findOne({ where: { id: masterId, tenantId } });
          masterName = su?.fullName || null;
        }
        items.push({
          kind: 'service',
          refId: s.id,
          name: s.name,
          price: s.price,
          currency: s.currency,
          durationMinutes: s.durationMinutes,
          masterId,
          masterName,
        });
      } else {
        throw new BadRequestException('Неизвестный тип позиции');
      }
    }
    return items;
  }

  // ========= documents =========

  private decorateRow(d: EsignDocument, contactById: Map<string, Contact>) {
    const contact = d.contactId ? contactById.get(d.contactId) : null;
    return {
      id: d.id,
      kind: d.kind,
      status: d.status,
      contactId: d.contactId,
      contactName: contact ? this.contactDisplayName(contact) : null,
      contactCompany: contact?.company?.name || null,
      docNo: d.extraFields?.CONTRACT_NO || null,
      amount: d.amount,
      currency: d.currency,
      fileName: d.fileName,
      fileSizeBytes: d.fileSizeBytes,
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
    const contacts = contactIds.length ? await this.contactRepo.find({ where: { id: In(contactIds) }, relations: ['company'] }) : [];
    const contactById = new Map(contacts.map((c) => [c.id, c]));
    return docs.map((d) => this.decorateRow(d, contactById));
  }

  async getDocument(tenantId: string, id: string) {
    const doc = await this.docRepo.findOne({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('Документ не найден');
    const contact = doc.contactId ? await this.contactRepo.findOne({ where: { id: doc.contactId }, relations: ['company'] }) : null;
    return {
      ...doc,
      contactName: contact ? this.contactDisplayName(contact) : null,
      contactCompany: contact?.company?.name || null,
      entityLabel: await this.resolveEntityLabel(doc.tenantId, doc.entityType, doc.entityId),
    };
  }

  /** Issues a document from a template: resolves {KEY}s from the client's card + org profile,
   * merges in the manually entered contract fields (the keys a template uses that aren't on
   * the client's card, e.g. {CONTRACT_NO}/{AMOUNT}/{SERVICE}), renders the PDF and stores it. */
  async issueDocument(
    tenantId: string,
    userId: string,
    input: { templateId: string; contactId: string; extraFields?: Record<string, string>; items?: EsignItemPick[] },
  ) {
    const tpl = await this.templateRepo.findOne({ where: { id: input.templateId, tenantId } });
    if (!tpl) throw new NotFoundException('Шаблон не найден');
    if (!input.contactId) throw new BadRequestException('Выберите клиента');
    const contact = await this.contactRepo.findOne({ where: { id: input.contactId, tenantId }, relations: ['company'] });
    if (!contact) throw new BadRequestException('Клиент не найден');

    const needed = extractKeys(tpl.bodyTemplate);
    const [auto, resolvedItems] = await Promise.all([
      this.resolveAutoValues(tenantId, input.contactId, userId),
      this.resolveItems(tenantId, input.items),
    ]);
    if (needed.includes('CONTRACT_NO')) {
      auto.CONTRACT_NO = await this.consumeNextContractNumber(tenantId);
    }
    const itemValues = computeItemValues(resolvedItems);
    const manualKeys = needed.filter((k) => !ESIGN_AUTO_KEYS.has(k) && !ESIGN_ITEM_KEYS.has(k) && !ESIGN_SEQUENCE_KEYS.has(k));
    const extra: Record<string, string> = {};
    for (const k of manualKeys) {
      const v = input.extraFields?.[k];
      if (v && v.trim()) extra[k] = v.trim();
    }
    const values = { ...auto, ...itemValues, ...extra };
    // Auto-assigned, not a manual field, but still worth keeping in extraFields so the
    // documents list ("docNo") and duplicate/audit trail can show it without re-deriving it.
    if (values.CONTRACT_NO) extra.CONTRACT_NO = values.CONTRACT_NO;

    const bodyText = renderKeys(tpl.bodyTemplate, values);
    const fileNameBase = renderKeys(tpl.fileNamePattern || '{KIND}-{NAME}-{CONTRACT_DATE}', { ...values, KIND: tpl.kind });
    const fileName = `${sanitizeFileName(fileNameBase)}.pdf`;
    const title = `${tpl.kind} · ${values.NAME || this.contactDisplayName(contact) || 'документ'}`;

    const doc = await this.docRepo.save(
      this.docRepo.create({
        tenantId,
        contactId: input.contactId,
        createdByUserId: userId,
        templateId: tpl.id,
        title,
        kind: tpl.kind,
        bodyText,
        signerEmail: contact.email || null,
        extraFields: extra,
        items: resolvedItems.length ? resolvedItems : null,
        amount: parseAmount(extra.AMOUNT),
        currency: extra.CURRENCY || null,
        fileName,
      }),
    );

    const pdf = await renderEsignPdf(doc.title, doc.bodyText);
    doc.draftPdfUrl = await this.writePdf(tenantId, doc.id, 'draft', pdf.buffer);
    doc.pageCount = pdf.pageCount;
    doc.fileSizeBytes = pdf.buffer.length;
    await this.docRepo.save(doc);
    return this.getDocument(tenantId, doc.id);
  }

  /** Lets a draft's already-substituted text be hand-edited before it's sent — e.g. to fix a
   * leftover {KEY} mark or tweak wording the template didn't anticipate. Draft-only: once a
   * document has been sent, its text is part of the audit trail of what the signer saw. */
  async updateDocument(tenantId: string, id: string, input: { bodyText?: string }) {
    const doc = await this.docRepo.findOne({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('Документ не найден');
    if (doc.status !== 'draft') throw new BadRequestException('Редактировать можно только черновики');
    if (input.bodyText !== undefined) {
      if (!input.bodyText.trim()) throw new BadRequestException('Текст документа не может быть пустым');
      doc.bodyText = input.bodyText.trim();
    }

    const pdf = await renderEsignPdf(doc.title, doc.bodyText);
    doc.draftPdfUrl = await this.writePdf(tenantId, doc.id, 'draft', pdf.buffer);
    doc.pageCount = pdf.pageCount;
    doc.fileSizeBytes = pdf.buffer.length;
    await this.docRepo.save(doc);
    return this.getDocument(tenantId, doc.id);
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

  /** Re-issues a document from the same template/client/fields — a fresh draft with today's
   * date and a new number, ready to send again (e.g. a renewal). Documents created before
   * templateId was tracked fall back to a static copy of the rendered text. */
  async duplicateDocument(tenantId: string, id: string, userId: string) {
    const source = await this.docRepo.findOne({ where: { id, tenantId } });
    if (!source) throw new NotFoundException('Документ не найден');

    if (source.templateId && source.contactId) {
      const tplExists = await this.templateRepo.count({ where: { id: source.templateId, tenantId } });
      if (tplExists) {
        return this.issueDocument(tenantId, userId, {
          templateId: source.templateId,
          contactId: source.contactId,
          extraFields: source.extraFields || {},
          items: (source.items || []).map((i) => ({ kind: i.kind, refId: i.refId, masterId: i.masterId })),
        });
      }
    }

    const doc = await this.docRepo.save(
      this.docRepo.create({
        tenantId,
        contactId: source.contactId,
        createdByUserId: userId,
        templateId: source.templateId,
        title: `${source.title} (копия)`,
        kind: source.kind,
        bodyText: source.bodyText,
        signerEmail: source.signerEmail,
        extraFields: source.extraFields,
        items: source.items,
        amount: source.amount,
        currency: source.currency,
        fileName: source.fileName,
      }),
    );
    const pdf = await renderEsignPdf(doc.title, doc.bodyText);
    doc.draftPdfUrl = await this.writePdf(tenantId, doc.id, 'draft', pdf.buffer);
    doc.pageCount = pdf.pageCount;
    doc.fileSizeBytes = pdf.buffer.length;
    await this.docRepo.save(doc);
    return this.getDocument(tenantId, doc.id);
  }

  async getDocumentFile(tenantId: string, id: string, variant?: 'draft' | 'signed'): Promise<{ buffer: Buffer; fileName: string }> {
    const doc = await this.docRepo.findOne({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('Документ не найден');
    const url = variant === 'signed' ? doc.signedPdfUrl : variant === 'draft' ? doc.draftPdfUrl : doc.signedPdfUrl || doc.draftPdfUrl;
    if (!url) throw new NotFoundException('Файл ещё не сформирован');
    const relPath = url.replace(/^\/v1\/uploads\//, '');
    const buffer = await fs.readFile(joinUploadsAbsolute(relPath));
    return { buffer, fileName: doc.fileName || `${doc.kind}-${doc.id}.pdf` };
  }

  private async sendSignatureEmail(doc: EsignDocument, isReminder: boolean) {
    if (!doc.signerEmail) throw new BadRequestException('У документа нет email получателя — привяжите клиента с email');
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

  /** Single "Отправить клиенту" action used by the documents list row: sends for the first
   * time if still a draft, otherwise re-sends a reminder to whoever hasn't signed yet. */
  async sendOrRemind(tenantId: string, id: string) {
    const doc = await this.docRepo.findOne({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('Документ не найден');
    if (doc.status === 'signed') throw new BadRequestException('Документ уже подписан');
    if (doc.status === 'declined') throw new BadRequestException('Документ был отклонён');

    if (doc.status === 'draft') {
      await this.sendSignatureEmail(doc, false);
      doc.status = 'sent';
      doc.sentAt = new Date();
    } else {
      await this.sendSignatureEmail(doc, true);
      if (doc.status === 'expired') doc.status = 'sent';
    }
    await this.docRepo.save(doc);
    return this.getDocument(tenantId, doc.id);
  }

  // ========= templates =========

  /** Called once on tenant signup (see AuthService.signup) so a brand-new tenant's "Мои
   * документы" page never starts with an empty template gallery. Idempotent. */
  async seedDefaultTemplates(tenantId: string) {
    const existing = await this.templateRepo.count({ where: { tenantId } });
    if (existing > 0) return;
    await this.templateRepo.save(ESIGN_DEFAULT_TEMPLATES.map((tpl) => this.templateRepo.create({ tenantId, ...tpl })));
  }

  async listTemplates(tenantId: string) {
    return this.templateRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async createTemplate(
    tenantId: string,
    input: { name: string; description?: string; kind?: string; bodyTemplate: string; fileNamePattern?: string },
  ) {
    if (!input.name?.trim()) throw new BadRequestException('Укажите название шаблона');
    if (!input.bodyTemplate?.trim()) throw new BadRequestException('Текст шаблона не может быть пустым');
    return this.templateRepo.save(
      this.templateRepo.create({
        tenantId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        kind: input.kind?.trim() || 'Договор',
        bodyTemplate: input.bodyTemplate.trim(),
        fileNamePattern: input.fileNamePattern?.trim() || '{KIND}-{NAME}-{CONTRACT_DATE}',
      }),
    );
  }

  async updateTemplate(
    tenantId: string,
    id: string,
    input: { name?: string; description?: string; kind?: string; bodyTemplate?: string; fileNamePattern?: string },
  ) {
    const tpl = await this.templateRepo.findOne({ where: { id, tenantId } });
    if (!tpl) throw new NotFoundException('Шаблон не найден');
    if (input.name !== undefined) tpl.name = input.name.trim();
    if (input.description !== undefined) tpl.description = input.description?.trim() || null;
    if (input.kind !== undefined) tpl.kind = input.kind.trim();
    if (input.bodyTemplate !== undefined) tpl.bodyTemplate = input.bodyTemplate.trim();
    if (input.fileNamePattern !== undefined) tpl.fileNamePattern = input.fileNamePattern.trim() || '{KIND}-{NAME}-{CONTRACT_DATE}';
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
    doc.fileSizeBytes = pdf.buffer.length;

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
