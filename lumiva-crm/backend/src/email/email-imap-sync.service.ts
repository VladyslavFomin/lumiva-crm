import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { ImapFlow, type FetchMessageObject } from 'imapflow';
import {
  simpleParser,
  type AddressObject,
  type HeaderValue,
  type ParsedMail,
} from 'mailparser';
import { IsNull, Not, Repository } from 'typeorm';
import { EmailAccount } from './email-account.entity';
import { EmailMessage } from './email-message.entity';
import { EmailFoldersService } from './email-folders.service';
import { EmailSyncService } from './email-sync.service';
import { parseCalendarInviteSources } from './calendar-invite.util';
import { Lead } from '../leads/lead.entity';
import { LeadsService } from '../leads/leads.service';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';
import { EmailNotificationsService } from './email-notifications.service';

type EmailAttachmentMeta = {
  filename: string;
  contentType: string;
  size: number;
};

const DEFAULT_IMAP_SYNC_LIMIT = 60;

function normalizeEmail(value: string | null | undefined): string {
  return String(value || '').trim().replace(/^<|>$/g, '').toLowerCase();
}

function bufferToUtf8(value: unknown): string {
  if (!value) return '';
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return Buffer.from(String(value)).toString('utf8');
}

@Injectable()
export class EmailImapSyncService {
  private readonly log = new Logger(EmailImapSyncService.name);
  private cronLock = false;
  private readonly accountLocks = new Set<string>();

  constructor(
    @InjectRepository(EmailAccount)
    private readonly accountRepo: Repository<EmailAccount>,
    @InjectRepository(EmailMessage)
    private readonly messageRepo: Repository<EmailMessage>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    private readonly emailFolders: EmailFoldersService,
    private readonly emailSync: EmailSyncService,
    private readonly emailNotifications: EmailNotificationsService,
    @Inject(forwardRef(() => LeadsService))
    private readonly leadsService: LeadsService,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
  ) {}

  @Cron('*/2 * * * *')
  async cronSyncImapAccounts(): Promise<void> {
    if (this.cronLock) return;
    this.cronLock = true;
    try {
      const accounts = await this.accountRepo.find({
        where: {
          status: 'active',
          syncIncoming: true,
          imapHost: Not(IsNull()),
        },
      });
      for (const account of accounts) {
        try {
          await this.syncAccount(account.id);
        } catch (e: any) {
          this.log.warn(`imap sync ${account.id}: ${e?.message || e}`);
        }
      }
    } finally {
      this.cronLock = false;
    }
  }

  async syncAccount(
    accountId: string,
    tenantId?: string,
  ): Promise<{ imported: number; scanned: number }> {
    if (this.accountLocks.has(accountId)) {
      return { imported: 0, scanned: 0 };
    }
    this.accountLocks.add(accountId);
    let account: EmailAccount | null = null;
    try {
      account = await this.accountRepo.findOne({
        where: tenantId ? { id: accountId, tenantId } : { id: accountId },
      });
      if (!account) throw new NotFoundException('Email account not found');
      if (!account.syncIncoming) return { imported: 0, scanned: 0 };
      this.assertImapConfigured(account);

      const result = await this.fetchMailbox(account);
      account.lastSyncAt = new Date();
      account.lastError = null;
      account.status = 'active';
      await this.accountRepo.save(account);
      return result;
    } catch (e: any) {
      if (account) {
        account.status = 'error';
        account.lastError = this.safeErrorMessage(e);
        await this.accountRepo.save(account);
      }
      if (e instanceof BadRequestException || e instanceof NotFoundException) {
        throw e;
      }
      throw new BadRequestException(this.safeErrorMessage(e));
    } finally {
      this.accountLocks.delete(accountId);
    }
  }

  private assertImapConfigured(account: EmailAccount): void {
    if (!account.imapHost?.trim()) {
      throw new BadRequestException('IMAP host is not configured');
    }
    if (!account.imapPassword?.trim()) {
      throw new BadRequestException('IMAP password is not configured');
    }
  }

  private async fetchMailbox(
    account: EmailAccount,
  ): Promise<{ imported: number; scanned: number }> {
    const { inbox, sent } = await this.emailFolders.ensureSystemFolders(
      account.tenantId,
      account.id,
    );
    const mailboxPath = (account.syncFolder || 'INBOX').trim() || 'INBOX';
    const port = account.imapPort || (account.imapSecure === false ? 143 : 993);
    const client = new ImapFlow({
      host: account.imapHost!,
      port,
      secure: account.imapSecure !== false,
      auth: {
        user: account.imapUsername || account.email,
        pass: account.imapPassword || '',
      },
      logger: false,
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 60_000,
      tls: {
        rejectUnauthorized: false,
      },
    });

    await client.connect();
    let lock: { release(): void } | null = null;
    try {
      lock = await client.getMailboxLock(mailboxPath, { maxLockHoldTime: 120_000 });
      const mailbox = client.mailbox || null;
      const exists = mailbox ? mailbox.exists : 0;
      if (!exists) return { imported: 0, scanned: 0 };
      const limit = this.syncLimit(account);
      const start = Math.max(1, exists - limit + 1);
      const range = `${start}:*`;
      const uidValidity = mailbox ? String(mailbox.uidValidity) : '';

      let imported = 0;
      let scanned = 0;
      for await (const imapMessage of client.fetch(range, {
        uid: true,
        flags: true,
        envelope: true,
        internalDate: true,
        source: true,
      })) {
        scanned += 1;
        const saved = await this.importImapMessage(account, imapMessage, {
          inbox,
          sent,
          mailboxPath,
          uidValidity,
        });
        if (saved) imported += 1;
      }
      return { imported, scanned };
    } finally {
      lock?.release();
      await client.logout().catch(() => client.close());
    }
  }

  private syncLimit(account: EmailAccount): number {
    const raw =
      account.meta && typeof account.meta === 'object'
        ? Number((account.meta as Record<string, any>)?.imapSync?.limit)
        : NaN;
    if (Number.isFinite(raw)) return Math.min(200, Math.max(1, raw));
    const fromEnv = Number(process.env.EMAIL_IMAP_SYNC_LIMIT || '');
    if (Number.isFinite(fromEnv)) return Math.min(200, Math.max(1, fromEnv));
    return DEFAULT_IMAP_SYNC_LIMIT;
  }

  private async importImapMessage(
    account: EmailAccount,
    imapMessage: FetchMessageObject,
    context: {
      inbox: string;
      sent: string;
      mailboxPath: string;
      uidValidity: string;
    },
  ): Promise<EmailMessage | null> {
    if (!imapMessage.source) return null;
    const parsed = await simpleParser(imapMessage.source, {
      skipImageLinks: true,
    });
    const messageId = this.buildMessageId(account, imapMessage, parsed, context);
    const exists = await this.messageRepo.findOne({
      where: { tenantId: account.tenantId, messageId },
    });
    const existingMeta =
      exists?.meta && typeof exists.meta === 'object' ? exists.meta : {};
    const calendarParts = this.calendarParts(parsed);
    const calendarInvite = parseCalendarInviteSources(calendarParts);
    const shouldBackfillCalendarInvite = Boolean(
      exists &&
        existingMeta.hasCalendarAttachment &&
        !existingMeta.calendarInvite &&
        !existingMeta.calendarInviteImportError,
    );
    if (exists) {
      if (shouldBackfillCalendarInvite) {
        if (calendarInvite) {
          await this.emailSync.attachCalendarInviteToMessage(
            account,
            exists,
            calendarInvite,
          );
        } else {
          exists.meta = {
            ...existingMeta,
            calendarInviteImportError: 'calendar_invite_parse_failed',
          };
          await this.messageRepo.save(exists);
        }
      }
      return null;
    }

    const from = this.firstAddress(parsed.from);
    const fromAddr = from.email || 'unknown';
    const selfEmail = normalizeEmail(account.email);
    const direction = fromAddr === selfEmail ? 'outgoing' : 'incoming';
    const leadId =
      direction === 'incoming' && fromAddr !== 'unknown'
        ? await this.resolveLeadForIncoming(account, fromAddr, from.name)
        : null;
    const attachments = this.attachmentMeta(parsed);
    const flags = [...(imapMessage.flags || new Set<string>())].map(String);
    const labels = [
      ...flags,
      ...(imapMessage.labels ? [...imapMessage.labels].map(String) : []),
    ];
    const date =
      parsed.date ||
      (imapMessage.envelope?.date instanceof Date
        ? imapMessage.envelope.date
        : null) ||
      (imapMessage.internalDate ? new Date(imapMessage.internalDate) : null) ||
      new Date();

    const msg = this.messageRepo.create({
      tenantId: account.tenantId,
      accountId: account.id,
      messageId,
      threadId: parsed.inReplyTo || imapMessage.envelope?.inReplyTo || null,
      direction,
      crmFolderId: direction === 'incoming' ? context.inbox : context.sent,
      from: fromAddr,
      fromName: from.name,
      to: this.addressList(parsed.to),
      cc: this.addressList(parsed.cc),
      bcc: this.addressList(parsed.bcc),
      subject: parsed.subject || imapMessage.envelope?.subject || null,
      textBody: parsed.text || null,
      htmlBody: parsed.html && typeof parsed.html === 'string' ? parsed.html : null,
      attachments: attachments.length ? attachments : null,
      contactId: null,
      companyId: null,
      leadId,
      saleId: null,
      date: Number.isNaN(date.getTime()) ? new Date() : date,
      isRead: flags.some((flag) => flag.toLowerCase() === '\\seen'),
      isStarred: flags.some((flag) => flag.toLowerCase() === '\\flagged'),
      labels,
      headers: this.headersObject(parsed),
      meta: {
        provider: 'imap',
        imapUid: imapMessage.uid,
        imapMailbox: context.mailboxPath,
        imapUidValidity: context.uidValidity,
        hasCalendarAttachment:
          calendarParts.length > 0 ||
          attachments.some((a) => /\.ics$/i.test(a.filename)),
      },
    });

    const saved = await this.messageRepo.save(msg);
    await this.emailSync.attachCalendarInviteToMessage(
      account,
      saved,
      calendarInvite,
      { notify: true },
    );
    if (direction === 'incoming') {
      await this.emailNotifications.notifyIncomingMessage(account, saved, leadId);
      await this.triggerEmailReceived(account, saved, leadId);
    }
    return saved;
  }

  private buildMessageId(
    account: EmailAccount,
    imapMessage: FetchMessageObject,
    parsed: ParsedMail,
    context: { mailboxPath: string; uidValidity: string },
  ): string {
    const providerId = String(
      parsed.messageId || imapMessage.envelope?.messageId || '',
    )
      .trim()
      .toLowerCase();
    const seed = providerId
      ? `message-id:${providerId}`
      : `uid:${context.mailboxPath}:${context.uidValidity}:${imapMessage.uid}`;
    const digest = createHash('sha256')
      .update(`${account.tenantId}:${account.id}:${seed}`)
      .digest('hex')
      .slice(0, 48);
    return `imap:${account.id}:${digest}`;
  }

  private firstAddress(
    input: AddressObject | AddressObject[] | undefined,
  ): { email: string; name: string | null } {
    const list = this.addressValues(input);
    const first = list[0];
    return {
      email: normalizeEmail(first?.address),
      name: first?.name?.trim() || null,
    };
  }

  private addressList(input: AddressObject | AddressObject[] | undefined): string[] {
    return this.addressValues(input)
      .map((item) => normalizeEmail(item.address))
      .filter(Boolean);
  }

  private addressValues(input: AddressObject | AddressObject[] | undefined) {
    const values = Array.isArray(input) ? input : input ? [input] : [];
    return values.flatMap((item) => item.value || []);
  }

  private attachmentMeta(parsed: ParsedMail): EmailAttachmentMeta[] {
    return parsed.attachments.map((attachment) => ({
      filename: attachment.filename || 'attachment',
      contentType: attachment.contentType || 'application/octet-stream',
      size: Number(attachment.size || 0),
    }));
  }

  private calendarParts(parsed: ParsedMail) {
    return parsed.attachments
      .filter((attachment) => {
        const filename = attachment.filename || '';
        const contentType = attachment.contentType || '';
        return (
          contentType.toLowerCase().startsWith('text/calendar') ||
          /\.ics$/i.test(filename)
        );
      })
      .map((attachment) => ({
        filename: attachment.filename || null,
        contentType: attachment.contentType || 'text/calendar',
        content: bufferToUtf8(attachment.content),
      }));
  }

  private headersObject(parsed: ParsedMail): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of parsed.headers.entries()) {
      out[key] = this.headerValue(value);
    }
    return out;
  }

  private headerValue(value: HeaderValue): unknown {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((item) => this.headerValue(item));
    if (value && typeof value === 'object') {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch {
        return String(value);
      }
    }
    return value;
  }

  private getIngestionConfig(account: EmailAccount): {
    autoCreateFromUnknown: boolean;
    skipDomains: string[];
  } {
    const meta = account.meta as Record<string, any> | null;
    const ingestion = meta?.leadIngestion;
    return {
      autoCreateFromUnknown: ingestion?.autoCreateFromUnknown !== false,
      skipDomains: Array.isArray(ingestion?.skipDomains)
        ? ingestion.skipDomains.map((x: string) => String(x).toLowerCase())
        : [],
    };
  }

  private shouldSkipDomain(email: string, skipDomains: string[]): boolean {
    const domain = email.split('@')[1]?.toLowerCase() || '';
    return skipDomains.some((item) => domain === item || domain.endsWith(`.${item}`));
  }

  private async findLeadIdByEmail(
    tenantId: string,
    email: string,
  ): Promise<string | null> {
    const normalized = email.trim().toLowerCase();
    const row = await this.leadRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere('LOWER(TRIM(l.email)) = :email', { email: normalized })
      .getOne();
    return row?.id || null;
  }

  private async resolveLeadForIncoming(
    account: EmailAccount,
    fromAddr: string,
    fromName: string | null,
  ): Promise<string | null> {
    const { autoCreateFromUnknown, skipDomains } = this.getIngestionConfig(account);
    if (this.shouldSkipDomain(fromAddr, skipDomains)) return null;
    const existing = await this.findLeadIdByEmail(account.tenantId, fromAddr);
    if (existing) return existing;
    if (!autoCreateFromUnknown) return null;
    const created = await this.leadsService.createForTenant(account.tenantId, {
      name: fromName || fromAddr.split('@')[0] || fromAddr,
      email: fromAddr,
      source: 'email',
      meta: {
        createdFromMailbox: true,
        emailAccountId: account.id,
        provider: 'imap',
      },
    });
    return created.id;
  }

  private async triggerEmailReceived(
    account: EmailAccount,
    msg: EmailMessage,
    leadId: string | null,
  ): Promise<void> {
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
      /* ignore automation errors during mailbox sync */
    }
  }

  private safeErrorMessage(e: any): string {
    return (
      e?.response?.data?.message ||
      e?.response?.data?.error_description ||
      e?.response?.data?.error ||
      e?.message ||
      'imap_sync_failed'
    );
  }
}
