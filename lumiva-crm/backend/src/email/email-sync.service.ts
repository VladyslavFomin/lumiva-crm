import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { EmailAccount } from './email-account.entity';
import { EmailMessage } from './email-message.entity';
import { EmailOAuthService } from './email-oauth.service';
import { EmailFoldersService } from './email-folders.service';
import { LeadsService } from '../leads/leads.service';
import { Lead } from '../leads/lead.entity';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';

function parseEmailAddress(raw: string): { email: string; name: string | null } {
  const s = (raw || '').trim();
  const m = s.match(/^(?:"([^"]*)"|([^<]+?))\s*<([^>]+)>$/);
  if (m) {
    const name = (m[1] || m[2] || '').trim() || null;
    return { email: m[3].trim().toLowerCase(), name };
  }
  return { email: s.replace(/^<|>$/g, '').trim().toLowerCase(), name: null };
}

function parseAddressList(raw: string | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const { email } = parseEmailAddress(part);
    if (email) out.push(email);
  }
  return out;
}

function decodeBase64Url(data: string | undefined): string {
  if (!data) return '';
  const pad = data.length % 4 === 0 ? '' : '='.repeat(4 - (data.length % 4));
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/') + pad;
  try {
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function walkGmailParts(
  part: any,
  acc: { text?: string; html?: string; attachments: Array<{ filename: string; contentType: string; size: number }> },
): void {
  if (!part) return;
  const mime = part.mimeType || '';
  if (mime === 'text/plain' && part.body?.data && !acc.text) {
    acc.text = decodeBase64Url(part.body.data);
  }
  if (mime === 'text/html' && part.body?.data && !acc.html) {
    acc.html = decodeBase64Url(part.body.data);
  }
  if (part.filename && part.body?.attachmentId) {
    acc.attachments.push({
      filename: part.filename,
      contentType: mime || 'application/octet-stream',
      size: Number(part.body.size || 0),
    });
  }
  if (Array.isArray(part.parts)) {
    for (const p of part.parts) walkGmailParts(p, acc);
  }
}

@Injectable()
export class EmailSyncService {
  private readonly log = new Logger(EmailSyncService.name);
  private runLock = false;

  constructor(
    @InjectRepository(EmailAccount)
    private readonly accountRepo: Repository<EmailAccount>,
    @InjectRepository(EmailMessage)
    private readonly messageRepo: Repository<EmailMessage>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    private readonly emailOAuth: EmailOAuthService,
    private readonly emailFolders: EmailFoldersService,
    @Inject(forwardRef(() => LeadsService))
    private readonly leadsService: LeadsService,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
  ) {}

  @Cron('*/2 * * * *')
  async cronSyncAllTenants(): Promise<void> {
    if (this.runLock) return;
    this.runLock = true;
    try {
      const accounts = await this.accountRepo.find({
        where: {
          status: 'active',
          syncIncoming: true,
          oauthRefreshToken: Not(IsNull()),
        },
      });
      for (const a of accounts) {
        try {
          await this.syncAccount(a.id);
        } catch (e: any) {
          this.log.warn(`sync ${a.id}: ${e?.message || e}`);
        }
      }
    } finally {
      this.runLock = false;
    }
  }

  async syncAccount(accountId: string): Promise<{ imported: number }> {
    const account = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!account || !account.oauthRefreshToken || !account.syncIncoming) {
      return { imported: 0 };
    }
    await this.emailOAuth.ensureAccessToken(account);
    const reloaded = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!reloaded) return { imported: 0 };
    if (reloaded.oauthProvider === 'gmail') {
      return this.syncGmailInbox(reloaded);
    }
    if (reloaded.oauthProvider === 'outlook') {
      return this.syncOutlookInbox(reloaded);
    }
    return { imported: 0 };
  }

  private getIngestionConfig(account: EmailAccount): {
    autoCreateFromUnknown: boolean;
    skipDomains: string[];
  } {
    const m = account.meta as Record<string, any> | null;
    const ing = m?.leadIngestion;
    return {
      autoCreateFromUnknown: ing?.autoCreateFromUnknown !== false,
      skipDomains: Array.isArray(ing?.skipDomains)
        ? ing.skipDomains.map((x: string) => String(x).toLowerCase())
        : [],
    };
  }

  private shouldSkipDomain(email: string, skipDomains: string[]): boolean {
    const dom = email.split('@')[1]?.toLowerCase() || '';
    return skipDomains.some((d) => dom === d || dom.endsWith(`.${d}`));
  }

  private async findLeadIdByEmail(
    tenantId: string,
    email: string,
  ): Promise<string | null> {
    const norm = email.trim().toLowerCase();
    const row = await this.leadRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tid', { tid: tenantId })
      .andWhere('LOWER(TRIM(l.email)) = :em', { em: norm })
      .getOne();
    return row?.id || null;
  }

  private async resolveLeadForIncomingFixed(
    tenantId: string,
    account: EmailAccount,
    fromAddr: string,
    fromName: string | null,
  ): Promise<string | null> {
    const selfEmail = account.email.trim().toLowerCase();
    if (fromAddr === selfEmail) return null;
    const { autoCreateFromUnknown, skipDomains } = this.getIngestionConfig(account);
    if (this.shouldSkipDomain(fromAddr, skipDomains)) return null;
    const existing = await this.findLeadIdByEmail(tenantId, fromAddr);
    if (existing) return existing;
    if (!autoCreateFromUnknown) return null;
    const created = await this.leadsService.createForTenant(tenantId, {
      name: fromName || fromAddr.split('@')[0] || fromAddr,
      email: fromAddr,
      source: 'email',
      meta: {
        createdFromMailbox: true,
        emailAccountId: account.id,
      },
    });
    return created.id;
  }

  private async syncGmailInbox(
    account: EmailAccount,
  ): Promise<{ imported: number }> {
    const { inbox, sent } = await this.emailFolders.ensureSystemFolders(
      account.tenantId,
      account.id,
    );
    const token = await this.emailOAuth.ensureAccessToken(account);
    const listRes = await axios.get<{
      messages?: Array<{ id: string }>;
    }>('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
      params: { maxResults: 45, q: 'in:inbox OR in:sent' },
      headers: { Authorization: `Bearer ${token}` },
    });
    const ids = listRes.data.messages?.map((m) => m.id) || [];
    let imported = 0;
    for (const gid of ids) {
      const mid = `gmail:${account.id}:${gid}`;
      const exists = await this.messageRepo.findOne({
        where: { tenantId: account.tenantId, messageId: mid },
      });
      if (exists) continue;
      const full = await axios.get<any>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gid}`,
        {
          params: { format: 'full' },
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const headers = full.data.payload?.headers || [];
      const getH = (n: string) =>
        headers.find(
          (h: any) => String(h.name || '').toLowerCase() === n.toLowerCase(),
        )?.value || '';
      const fromRaw = getH('From');
      const { email: fromAddr, name: fromName } = parseEmailAddress(fromRaw);
      const toRaw = getH('To');
      const ccRaw = getH('Cc');
      const subject = getH('Subject') || null;
      const dateHdr = getH('Date');
      const date = dateHdr ? new Date(dateHdr) : new Date();
      const acc = {
        text: undefined as string | undefined,
        html: undefined as string | undefined,
        attachments: [] as Array<{
          filename: string;
          contentType: string;
          size: number;
        }>,
      };
      walkGmailParts(full.data.payload, acc);
      const selfEmail = account.email.trim().toLowerCase();
      const direction =
        fromAddr === selfEmail ? 'outgoing' : 'incoming';
      let leadId: string | null = null;
      if (direction === 'incoming') {
        leadId = await this.resolveLeadForIncomingFixed(
          account.tenantId,
          account,
          fromAddr,
          fromName,
        );
      }
      const msg = this.messageRepo.create({
        tenantId: account.tenantId,
        accountId: account.id,
        messageId: mid,
        threadId: full.data.threadId || null,
        direction,
        crmFolderId: direction === 'incoming' ? inbox : sent,
        from: fromAddr || fromRaw,
        fromName,
        to: parseAddressList(toRaw),
        cc: parseAddressList(ccRaw),
        bcc: [],
        subject,
        textBody: acc.text || null,
        htmlBody: acc.html || null,
        attachments: acc.attachments.length ? acc.attachments : null,
        contactId: null,
        companyId: null,
        leadId,
        saleId: null,
        date: Number.isNaN(date.getTime()) ? new Date() : date,
        isRead: full.data.labelIds?.includes('UNREAD') === false,
        labels: full.data.labelIds || [],
        headers: Object.fromEntries(
          headers.map((h: any) => [h.name, h.value]),
        ),
        meta: {
          provider: 'gmail',
          gmailId: gid,
          hasCalendarAttachment: acc.attachments.some((a) =>
            /\.ics$/i.test(a.filename),
          ),
        },
      });
      await this.messageRepo.save(msg);
      imported += 1;
      try {
        await this.automationsService.triggerAutomation(
          account.tenantId,
          TriggerEvent.EMAIL_RECEIVED,
          {
            entityType: 'email',
            entityId: msg.id,
            email: msg,
            accountId: account.id,
            leadId,
          },
        );
      } catch {
        /* ignore */
      }
    }
    account.lastSyncAt = new Date();
    account.lastError = null;
    await this.accountRepo.save(account);
    return { imported };
  }

  private async syncOutlookInbox(
    account: EmailAccount,
  ): Promise<{ imported: number }> {
    const { inbox, sent } = await this.emailFolders.ensureSystemFolders(
      account.tenantId,
      account.id,
    );
    const token = await this.emailOAuth.ensureAccessToken(account);
    const folderUrls = [
      'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages',
      'https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages',
    ];
    const seen = new Set<string>();
    const items: any[] = [];
    for (const url of folderUrls) {
      const listRes = await axios.get<{ value?: any[] }>(url, {
        params: { $top: 30, $orderby: 'lastModifiedDateTime desc' },
        headers: { Authorization: `Bearer ${token}` },
      });
      for (const v of listRes.data.value || []) {
        if (v?.id && !seen.has(v.id)) {
          seen.add(v.id);
          items.push(v);
        }
      }
    }
    let imported = 0;
    for (const row of items) {
      const oid = row.id;
      if (!oid) continue;
      const mid = `outlook:${account.id}:${oid}`;
      const exists = await this.messageRepo.findOne({
        where: { tenantId: account.tenantId, messageId: mid },
      });
      if (exists) continue;
      const detail = await axios
        .get<any>(`https://graph.microsoft.com/v1.0/me/messages/${oid}`, {
          params: {
            $select:
              'id,subject,body,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,isRead,conversationId,hasAttachments',
          },
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch(() => null);
      const it = detail?.data || row;
      const fromAddr = (it.from?.emailAddress?.address || '').toLowerCase();
      const fromName = it.from?.emailAddress?.name || null;
      const toList: string[] = Array.isArray(it.toRecipients)
        ? it.toRecipients
            .map((r: any) => r.emailAddress?.address)
            .filter(Boolean)
        : [];
      const ccList: string[] = Array.isArray(it.ccRecipients)
        ? it.ccRecipients
            .map((r: any) => r.emailAddress?.address)
            .filter(Boolean)
        : [];
      const bccList: string[] = Array.isArray(it.bccRecipients)
        ? it.bccRecipients
            .map((r: any) => r.emailAddress?.address)
            .filter(Boolean)
        : [];
      const selfEmail = account.email.trim().toLowerCase();
      const direction =
        fromAddr === selfEmail ? 'outgoing' : 'incoming';
      let leadId: string | null = null;
      if (direction === 'incoming' && fromAddr) {
        leadId = await this.resolveLeadForIncomingFixed(
          account.tenantId,
          account,
          fromAddr,
          fromName,
        );
      }
      const att = it.hasAttachments
        ? await this.fetchOutlookAttachmentsMeta(token, oid)
        : [];
      const when = it.receivedDateTime || it.sentDateTime;
      const msg = this.messageRepo.create({
        tenantId: account.tenantId,
        accountId: account.id,
        messageId: mid,
        threadId: it.conversationId || null,
        direction,
        crmFolderId: direction === 'incoming' ? inbox : sent,
        from: fromAddr || 'unknown',
        fromName,
        to: toList,
        cc: ccList,
        bcc: bccList,
        subject: it.subject || null,
        textBody: it.body?.contentType === 'text' ? it.body.content : null,
        htmlBody: it.body?.contentType === 'html' ? it.body.content : null,
        attachments: att.length ? att : null,
        contactId: null,
        companyId: null,
        leadId,
        saleId: null,
        date: when ? new Date(when) : new Date(),
        isRead: Boolean(it.isRead),
        labels: [],
        headers: null,
        meta: {
          provider: 'outlook',
          outlookId: oid,
          hasCalendarAttachment: att.some((a) => /\.ics$/i.test(a.filename)),
        },
      });
      await this.messageRepo.save(msg);
      imported += 1;
      try {
        await this.automationsService.triggerAutomation(
          account.tenantId,
          TriggerEvent.EMAIL_RECEIVED,
          {
            entityType: 'email',
            entityId: msg.id,
            email: msg,
            accountId: account.id,
            leadId,
          },
        );
      } catch {
        /* ignore */
      }
    }
    account.lastSyncAt = new Date();
    account.lastError = null;
    await this.accountRepo.save(account);
    return { imported };
  }

  private async fetchOutlookAttachmentsMeta(
    token: string,
    messageId: string,
  ): Promise<Array<{ filename: string; contentType: string; size: number }>> {
    try {
      const res = await axios.get<{ value?: any[] }>(
        `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const out: Array<{ filename: string; contentType: string; size: number }> =
        [];
      for (const a of res.data.value || []) {
        if (a['@odata.type'] === '#microsoft.graph.fileAttachment') {
          out.push({
            filename: a.name || 'file',
            contentType: a.contentType || 'application/octet-stream',
            size: Number(a.size || 0),
          });
        }
      }
      return out;
    } catch {
      return [];
    }
  }
}
