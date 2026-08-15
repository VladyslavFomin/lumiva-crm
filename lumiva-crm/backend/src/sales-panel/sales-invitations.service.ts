import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { SalesInvitation, type SalesInvitationLanguage } from './sales-invitation.entity';
import { SalesProspect } from './sales-prospect.entity';
import { SalesEmailTemplate } from './sales-email-template.entity';
import { MailService } from '../mail/mail.service';
import { SALES_EMAIL_TEMPLATES } from './sales-email-templates';
import { SalesAttachmentsService, type SalesAttachmentRef } from './sales-attachments.service';

function mailIdDomain(): string {
  const from = process.env.MAIL_FROM || process.env.MAIL_USER || 'lumiva.agency';
  const match = from.match(/@([^\s">]+)/);
  return match ? match[1] : 'lumiva.agency';
}

const LANGUAGES: SalesInvitationLanguage[] = ['en', 'ru', 'tr'];

@Injectable()
export class SalesInvitationsService {
  private readonly logger = new Logger(SalesInvitationsService.name);

  constructor(
    @InjectRepository(SalesInvitation)
    private readonly invitationRepo: Repository<SalesInvitation>,
    @InjectRepository(SalesProspect)
    private readonly prospectRepo: Repository<SalesProspect>,
    @InjectRepository(SalesEmailTemplate)
    private readonly templateRepo: Repository<SalesEmailTemplate>,
    private readonly mail: MailService,
    private readonly attachmentsService: SalesAttachmentsService,
  ) {}

  /** DB is authoritative once a language has been read/edited; first read seeds it
   * from the code defaults in sales-email-templates.ts so nothing regresses. */
  private async getTemplateRow(language: SalesInvitationLanguage): Promise<SalesEmailTemplate> {
    let row = await this.templateRepo.findOne({ where: { language } });
    if (!row) {
      const fallback = SALES_EMAIL_TEMPLATES[language];
      row = this.templateRepo.create({
        language,
        subject: fallback.subject,
        bodyHtml: fallback.bodyHtml('{{businessName}}'),
      });
      row = await this.templateRepo.save(row);
    }
    return row;
  }

  async listTemplates(): Promise<Record<SalesInvitationLanguage, { subject: string; bodyHtml: string }>> {
    const out = {} as Record<SalesInvitationLanguage, { subject: string; bodyHtml: string }>;
    for (const lang of LANGUAGES) {
      const row = await this.getTemplateRow(lang);
      out[lang] = { subject: row.subject, bodyHtml: row.bodyHtml };
    }
    return out;
  }

  async updateTemplate(
    language: SalesInvitationLanguage,
    dto: { subject: string; bodyHtml: string },
  ): Promise<SalesEmailTemplate> {
    const row = await this.getTemplateRow(language);
    row.subject = dto.subject;
    row.bodyHtml = dto.bodyHtml;
    return this.templateRepo.save(row);
  }

  async listForProspect(prospectId: string): Promise<SalesInvitation[]> {
    return this.invitationRepo.find({
      where: { prospectId },
      order: { createdAt: 'DESC' },
    });
  }

  private async sendAndRecord(params: {
    to: string;
    businessName: string;
    language: SalesInvitationLanguage;
    prospectId: string | null;
    subjectOverride?: string;
    bodyHtmlOverride?: string;
    attachmentRefs?: SalesAttachmentRef[];
  }): Promise<SalesInvitation> {
    const { to, businessName, language, prospectId, subjectOverride, bodyHtmlOverride, attachmentRefs } =
      params;

    let baseSubject: string;
    let baseBodyHtml: string;
    if (subjectOverride && bodyHtmlOverride) {
      baseSubject = subjectOverride;
      baseBodyHtml = bodyHtmlOverride;
    } else {
      const row = await this.getTemplateRow(language);
      baseSubject = subjectOverride ?? row.subject;
      baseBodyHtml = bodyHtmlOverride ?? row.bodyHtml;
    }

    const substitute = (s: string) => s.split('{{businessName}}').join(businessName);
    const trackingToken = crypto.randomBytes(6).toString('hex').toUpperCase();
    const subject = `${substitute(baseSubject)} [SP-${trackingToken}]`;
    const bodyHtml = substitute(baseBodyHtml);
    const messageId = `<sp-${trackingToken}@${mailIdDomain()}>`;

    let mailAttachments: Array<{ filename: string; content: string }> | undefined;
    let attachmentsMeta: Array<{ filename: string }> | null = null;
    if (attachmentRefs && attachmentRefs.length > 0) {
      const read = await Promise.all(
        attachmentRefs.map((ref) => this.attachmentsService.readForSend(ref)),
      );
      mailAttachments = read;
      attachmentsMeta = read.map((r) => ({ filename: r.filename }));
    }

    const invitation = this.invitationRepo.create({
      prospectId,
      language,
      subject,
      bodyHtml,
      toEmail: to,
      trackingToken,
      outboundMessageId: messageId,
      status: 'sent',
      attachments: attachmentsMeta,
    });

    const result = await this.mail.sendMailNow({
      to,
      subject,
      html: bodyHtml,
      replyTo: process.env.SALES_PANEL_REPLY_TO_EMAIL || process.env.MAIL_USER,
      messageId,
      attachments: mailAttachments,
    });

    if (result.ok) {
      invitation.status = 'sent';
      invitation.sentAt = new Date();
      invitation.outboundMessageId = result.messageId || messageId;
    } else {
      invitation.status = 'failed';
      invitation.failedReason = result.error;
      this.logger.warn(`Invitation send failed to ${to}: ${result.error}`);
    }

    return this.invitationRepo.save(invitation);
  }

  async sendToProspect(
    prospectId: string,
    language: SalesInvitationLanguage,
    admin: { id?: string; email?: string },
    overrides?: {
      subject?: string;
      bodyHtml?: string;
      attachments?: SalesAttachmentRef[];
    },
  ): Promise<SalesInvitation> {
    const prospect = await this.prospectRepo.findOne({ where: { id: prospectId } });
    if (!prospect) throw new NotFoundException('Prospect not found');
    if (!prospect.email) {
      throw new BadRequestException('This business has no known email address');
    }

    const invitation = await this.sendAndRecord({
      to: prospect.email,
      businessName: prospect.name,
      language,
      prospectId,
      subjectOverride: overrides?.subject,
      bodyHtmlOverride: overrides?.bodyHtml,
      attachmentRefs: overrides?.attachments,
    });
    invitation.sentByAdminId = admin.id ?? null;
    invitation.sentByAdminEmail = admin.email ?? null;
    await this.invitationRepo.save(invitation);

    if (invitation.status === 'sent') {
      prospect.outreachStatus = 'sent';
      prospect.lastContactedAt = new Date();
      await this.prospectRepo.save(prospect);
    }

    return invitation;
  }

  async sendTest(
    to: string,
    language: SalesInvitationLanguage,
    overrides?: {
      subject?: string;
      bodyHtml?: string;
      attachments?: SalesAttachmentRef[];
    },
  ): Promise<SalesInvitation> {
    return this.sendAndRecord({
      to,
      businessName: 'Test Business',
      language,
      prospectId: null,
      subjectOverride: overrides?.subject,
      bodyHtmlOverride: overrides?.bodyHtml,
      attachmentRefs: overrides?.attachments,
    });
  }

  async markReplied(invitationId: string): Promise<SalesInvitation | null> {
    const invitation = await this.invitationRepo.findOne({ where: { id: invitationId } });
    if (!invitation) return null;
    invitation.status = 'replied';
    invitation.repliedAt = new Date();
    invitation.replyMatchedBy = 'manual';
    await this.invitationRepo.save(invitation);

    if (invitation.prospectId) {
      const prospect = await this.prospectRepo.findOne({ where: { id: invitation.prospectId } });
      if (prospect) {
        prospect.outreachStatus = 'replied';
        prospect.lastRepliedAt = invitation.repliedAt;
        await this.prospectRepo.save(prospect);
      }
    }

    return invitation;
  }
}
