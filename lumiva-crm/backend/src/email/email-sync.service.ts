import {
  Injectable,
  Logger,
  forwardRef,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { createHash } from 'crypto';
import { EmailAccount } from './email-account.entity';
import { EmailMessage } from './email-message.entity';
import { EmailOAuthService } from './email-oauth.service';
import { EmailFoldersService } from './email-folders.service';
import { CustomObject } from '../custom-objects/custom-object.entity';
import { CustomObjectField } from '../custom-objects/custom-object-field.entity';
import { CustomObjectRecord } from '../custom-objects/custom-object-record.entity';
import { CustomObjectView } from '../custom-objects/custom-object-view.entity';
import { WorkspaceArea } from '../workspace-areas/workspace-area.entity';
import { LeadsService } from '../leads/leads.service';
import { Lead } from '../leads/lead.entity';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';
import { EmailNotificationsService } from './email-notifications.service';
import {
  parseCalendarInviteSources,
  type CalendarInviteSource,
  type ParsedCalendarInvite,
} from './calendar-invite.util';

type EmailAttachmentMeta = { filename: string; contentType: string; size: number };
type CalendarPart = CalendarInviteSource & {
  attachmentId?: string;
  size?: number;
};

const EMAIL_MEETINGS_SYSTEM_KEY = 'email_meetings';
const EMAIL_WORKSPACE_AREA_SYSTEM_KEY = 'email_mailbox';
const EMAIL_MEETINGS_FIELD_DEFS: Array<{
  key: string;
  label: string;
  type: CustomObjectField['type'];
  options?: Array<{ value: string; label: string }>;
}> = [
  { key: 'title', label: 'Тема', type: 'text' },
  { key: 'start_at', label: 'Начало', type: 'datetime' },
  { key: 'end_at', label: 'Окончание', type: 'datetime' },
  { key: 'location', label: 'Место', type: 'text' },
  { key: 'attendees_count', label: 'Кол-во участников', type: 'number' },
  { key: 'attendees', label: 'Участники', type: 'text' },
  { key: 'organizer_email', label: 'Организатор email', type: 'text' },
  { key: 'organizer_name', label: 'Организатор', type: 'text' },
  { key: 'source_email', label: 'Письмо от', type: 'text' },
  { key: 'source_message_id', label: 'ID письма', type: 'text' },
  { key: 'email_message_id', label: 'ID письма CRM', type: 'text' },
  { key: 'account_id', label: 'ID ящика', type: 'text' },
  {
    key: 'status',
    label: 'Статус',
    type: 'status',
    options: [
      { value: 'requested', label: 'Запрошена' },
      { value: 'confirmed', label: 'Подтверждена' },
      { value: 'tentative', label: 'Предварительно' },
      { value: 'cancelled', label: 'Отменена' },
    ],
  },
  { key: 'provider', label: 'Провайдер', type: 'text' },
  { key: 'method', label: 'Метод invite', type: 'text' },
  { key: 'timezone', label: 'Часовой пояс', type: 'text' },
  { key: 'description', label: 'Описание', type: 'text' },
  { key: 'ics_uid', label: 'ICS UID', type: 'text' },
];

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
  acc: {
    text?: string;
    html?: string;
    attachments: EmailAttachmentMeta[];
    calendarParts: CalendarPart[];
  },
): void {
  if (!part) return;
  const mime = part.mimeType || '';
  if (mime === 'text/plain' && part.body?.data && !acc.text) {
    acc.text = decodeBase64Url(part.body.data);
  }
  if (mime === 'text/html' && part.body?.data && !acc.html) {
    acc.html = decodeBase64Url(part.body.data);
  }
  const filename = String(part.filename || '').trim();
  const isCalendarPart = mime.toLowerCase().startsWith('text/calendar') || /\.ics$/i.test(filename);
  if (isCalendarPart) {
    acc.calendarParts.push({
      filename: filename || null,
      contentType: mime || 'text/calendar',
      content: part.body?.data ? decodeBase64Url(part.body.data) : '',
      attachmentId: part.body?.attachmentId || undefined,
      size: Number(part.body?.size || 0),
    });
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
    @InjectRepository(CustomObject)
    private readonly customObjectRepo: Repository<CustomObject>,
    @InjectRepository(CustomObjectField)
    private readonly customObjectFieldRepo: Repository<CustomObjectField>,
    @InjectRepository(CustomObjectRecord)
    private readonly customObjectRecordRepo: Repository<CustomObjectRecord>,
    @InjectRepository(CustomObjectView)
    private readonly customObjectViewRepo: Repository<CustomObjectView>,
    @InjectRepository(WorkspaceArea)
    private readonly workspaceAreaRepo: Repository<WorkspaceArea>,
    private readonly emailOAuth: EmailOAuthService,
    private readonly emailFolders: EmailFoldersService,
    private readonly emailNotifications: EmailNotificationsService,
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
    try {
      await this.emailOAuth.ensureAccessToken(account);
      const reloaded = await this.accountRepo.findOne({ where: { id: accountId } });
      if (!reloaded) return { imported: 0 };
      if (reloaded.oauthProvider === 'gmail') {
        return this.syncGmailInbox(reloaded);
      }
      if (reloaded.oauthProvider === 'outlook') {
        return this.syncOutlookInbox(reloaded);
      }
    } catch (e: any) {
      account.status = 'error';
      account.lastError =
        e?.response?.data?.error_description ||
        e?.response?.data?.error ||
        e?.message ||
        'email_sync_failed';
      await this.accountRepo.save(account);
      throw new BadRequestException(account.lastError);
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

  private async fetchGmailAttachmentText(
    token: string,
    gmailMessageId: string,
    attachmentId: string,
  ): Promise<string> {
    try {
      const res = await axios.get<{ data?: string }>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}/attachments/${attachmentId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return decodeBase64Url(res.data.data);
    } catch {
      return '';
    }
  }

  private async hydrateGmailCalendarParts(
    token: string,
    gmailMessageId: string,
    parts: CalendarPart[],
  ): Promise<CalendarPart[]> {
    for (const part of parts) {
      if (part.content?.trim() || !part.attachmentId) continue;
      part.content = await this.fetchGmailAttachmentText(
        token,
        gmailMessageId,
        part.attachmentId,
      );
    }
    return parts;
  }

  private calendarInviteMeta(invite: ParsedCalendarInvite) {
    return {
      title: invite.title,
      startAt: invite.startAt,
      endAt: invite.endAt,
      location: invite.location,
      timezone: invite.timezone,
      organizerEmail: invite.organizerEmail,
      organizerName: invite.organizerName,
      attendees: invite.attendees.map((a) => a.email),
      attendeesCount: invite.attendeesCount,
      status: invite.status,
      method: invite.method,
      uid: invite.uid,
      sequence: invite.sequence,
      sourceFilename: invite.sourceFilename,
    };
  }

  private async uniqueMeetingObjectSlug(tenantId: string): Promise<string> {
    const base = 'email-meetings';
    let candidate = base;
    let suffix = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const found = await this.customObjectRepo.findOne({
        where: { tenantId, slug: candidate },
      });
      if (!found) return candidate;
      candidate = `${base}-${suffix++}`;
    }
  }

  private async uniqueWorkspaceAreaSlug(
    tenantId: string,
    base: string,
  ): Promise<string> {
    let candidate = base;
    let suffix = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const found = await this.workspaceAreaRepo.findOne({
        where: { tenantId, slug: candidate },
      });
      if (!found) return candidate;
      candidate = `${base}-${suffix++}`;
    }
  }

  private async ensureEmailWorkspaceArea(tenantId: string): Promise<WorkspaceArea> {
    let area = await this.workspaceAreaRepo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere("a.meta ->> 'systemKey' = :systemKey", {
        systemKey: EMAIL_WORKSPACE_AREA_SYSTEM_KEY,
      })
      .getOne();
    if (area) return area;

    area = this.workspaceAreaRepo.create({
      tenantId,
      name: 'Почта',
      slug: await this.uniqueWorkspaceAreaSlug(tenantId, 'email'),
      iconKey: 'mail',
      iconColor: '#222222',
      description: 'Письма и встречи, автоматически связанные с почтовыми аккаунтами.',
      coverImageUrl: null,
      sortOrder: 0,
      meta: {
        systemKey: EMAIL_WORKSPACE_AREA_SYSTEM_KEY,
        source: 'email',
      },
    });
    return this.workspaceAreaRepo.save(area);
  }

  private async ensureMeetingsObject(tenantId: string): Promise<CustomObject> {
    const emailArea = await this.ensureEmailWorkspaceArea(tenantId);
    let object = await this.customObjectRepo
      .createQueryBuilder('o')
      .where('o.tenantId = :tenantId', { tenantId })
      .andWhere("o.meta ->> 'systemKey' = :systemKey", {
        systemKey: EMAIL_MEETINGS_SYSTEM_KEY,
      })
      .getOne();

    if (!object) {
      object = await this.customObjectRepo.save(
        this.customObjectRepo.create({
          tenantId,
          workspaceAreaId: emailArea.id,
          name: 'Встречи',
          slug: await this.uniqueMeetingObjectSlug(tenantId),
          description: 'Встречи, автоматически распознанные из приглашений в подключённой почте.',
          isActive: true,
          meta: {
            systemKey: EMAIL_MEETINGS_SYSTEM_KEY,
            source: 'email_calendar_invites',
            enabledViews: ['table', 'calendar'],
            kanban: { cardTitleField: 'title' },
            workspaceNavIcon: 'mail',
          },
        }),
      );
    } else {
      const meta = object.meta && typeof object.meta === 'object' ? object.meta : {};
      const enabledViews = Array.isArray(meta.enabledViews)
        ? meta.enabledViews.map((x: any) => String(x))
        : ['table'];
      const nextEnabledViews = [...new Set([...enabledViews, 'table', 'calendar'])];
      if (
        meta.systemKey !== EMAIL_MEETINGS_SYSTEM_KEY ||
        nextEnabledViews.length !== enabledViews.length ||
        meta.workspaceNavIcon !== 'mail'
      ) {
        object.meta = {
          ...meta,
          systemKey: EMAIL_MEETINGS_SYSTEM_KEY,
          enabledViews: nextEnabledViews,
          workspaceNavIcon: 'mail',
          kanban: {
            ...(meta.kanban && typeof meta.kanban === 'object' ? meta.kanban : {}),
            cardTitleField: 'title',
          },
        };
        object = await this.customObjectRepo.save(object);
      }
      if (object.workspaceAreaId !== emailArea.id) {
        object.workspaceAreaId = emailArea.id;
        object = await this.customObjectRepo.save(object);
      }
    }

    await this.ensureMeetingsFields(tenantId, object.id);
    await this.ensureMeetingsViews(tenantId, object.id);
    return object;
  }

  private async ensureMeetingsFields(
    tenantId: string,
    objectId: string,
  ): Promise<void> {
    const fields = await this.customObjectFieldRepo.find({
      where: { tenantId, objectId },
    });
    const existingKeys = new Set(fields.map((field) => field.key));
    const missing = EMAIL_MEETINGS_FIELD_DEFS.filter(
      (field) => !existingKeys.has(field.key),
    );
    if (!missing.length) return;
    await this.customObjectFieldRepo.save(
      this.customObjectFieldRepo.create(
        missing.map((field) => ({
          tenantId,
          objectId,
          key: field.key,
          label: field.label,
          type: field.type,
          required: false,
          options: field.options || null,
          order: EMAIL_MEETINGS_FIELD_DEFS.findIndex((def) => def.key === field.key),
          isActive: true,
          meta: null,
        })),
      ),
    );
  }

  private async ensureMeetingsViews(
    tenantId: string,
    objectId: string,
  ): Promise<void> {
    const views = await this.customObjectViewRepo.find({
      where: { tenantId, objectId },
    });
    const hasTable = views.some((view) => view.type === 'table');
    const hasCalendar = views.some((view) => view.type === 'calendar');
    const toCreate: Partial<CustomObjectView>[] = [];
    if (!hasTable) {
      toCreate.push({
        tenantId,
        objectId,
        type: 'table',
        name: 'Table',
        isDefault: true,
        order: 0,
        config: {},
      });
    }
    if (!hasCalendar) {
      toCreate.push({
        tenantId,
        objectId,
        type: 'calendar',
        name: 'Calendar',
        isDefault: false,
        order: 1,
        config: { startField: 'start_at', endField: 'end_at' },
      });
    }
    if (toCreate.length) {
      await this.customObjectViewRepo.save(
        this.customObjectViewRepo.create(toCreate),
      );
    }
  }

  private buildMeetingExternalId(
    account: EmailAccount,
    msg: EmailMessage,
    invite: ParsedCalendarInvite,
  ): string {
    const seed = invite.uid
      ? `ics:${invite.uid}`
      : `message:${account.id}:${msg.messageId}`;
    const digest = createHash('sha256')
      .update(`${account.tenantId}:${seed}`)
      .digest('hex')
      .slice(0, 40);
    return `email-meeting:${digest}`;
  }

  private async upsertMeetingRecord(
    account: EmailAccount,
    msg: EmailMessage,
    invite: ParsedCalendarInvite,
  ): Promise<{ objectId: string; recordId: string }> {
    const object = await this.ensureMeetingsObject(account.tenantId);
    const externalId = this.buildMeetingExternalId(account, msg, invite);
    const attendees = invite.attendees
      .map((attendee) =>
        attendee.name ? `${attendee.name} <${attendee.email}>` : attendee.email,
      )
      .join(', ');
    const values = {
      title: invite.title || msg.subject || 'Встреча',
      start_at: invite.startAt,
      end_at: invite.endAt,
      location: invite.location,
      attendees_count: invite.attendeesCount,
      attendees,
      organizer_email: invite.organizerEmail,
      organizer_name: invite.organizerName,
      source_email: msg.from,
      source_message_id: msg.messageId,
      email_message_id: msg.id,
      account_id: account.id,
      status: invite.status,
      provider:
        msg.meta && typeof msg.meta === 'object'
          ? String(msg.meta.provider || account.oauthProvider || 'email')
          : account.oauthProvider || 'email',
      method: invite.method,
      timezone: invite.timezone,
      description: invite.description,
      ics_uid: invite.uid,
    };
    const meta = {
      source: 'email_calendar_invite',
      emailMessageId: msg.id,
      emailAccountId: account.id,
      providerMessageId: msg.messageId,
      icsUid: invite.uid,
      importedAt: new Date().toISOString(),
    };
    let record = await this.customObjectRecordRepo.findOne({
      where: { tenantId: account.tenantId, objectId: object.id, externalId },
    });
    if (record) {
      record.values = { ...(record.values || {}), ...values };
      record.meta = { ...(record.meta || {}), ...meta };
    } else {
      record = this.customObjectRecordRepo.create({
        tenantId: account.tenantId,
        objectId: object.id,
        externalId,
        values,
        meta,
      });
    }
    const saved = await this.customObjectRecordRepo.save(record);
    return { objectId: object.id, recordId: saved.id };
  }

  async attachCalendarInviteToMessage(
    account: EmailAccount,
    msg: EmailMessage,
    invite: ParsedCalendarInvite | null,
    options?: { notify?: boolean },
  ): Promise<void> {
    if (!invite) return;
    const meta = msg.meta && typeof msg.meta === 'object' ? msg.meta : {};
    const { calendarInviteImportError: _previousImportError, ...baseMeta } = meta;
    const calendarInvite = this.calendarInviteMeta(invite);
    if (msg.direction !== 'incoming') {
      msg.meta = { ...baseMeta, calendarInvite };
      await this.messageRepo.save(msg);
      return;
    }
    let notificationCalendarInvite: Record<string, unknown> | null = null;
    try {
      const meeting = await this.upsertMeetingRecord(account, msg, invite);
      notificationCalendarInvite = {
        ...calendarInvite,
        workspaceObjectId: meeting.objectId,
        workspaceRecordId: meeting.recordId,
        workspaceCalendarPath: `/workspace/${meeting.objectId}/calendar`,
        workspaceTablePath: `/workspace/${meeting.objectId}/table`,
      };
      msg.meta = {
        ...baseMeta,
        calendarInvite: notificationCalendarInvite,
      };
    } catch (e: any) {
      msg.meta = {
        ...baseMeta,
        calendarInvite,
        calendarInviteImportError: e?.message || 'meeting_import_failed',
      };
      this.log.warn(`meeting import ${msg.id}: ${e?.message || e}`);
    }
    await this.messageRepo.save(msg);
    if (options?.notify && notificationCalendarInvite) {
      await this.emailNotifications.notifyCalendarInvite(
        account,
        msg,
        notificationCalendarInvite,
      );
    }
  }

  private providerFromMessage(account: EmailAccount, msg: EmailMessage): string {
    const metaProvider =
      msg.meta && typeof msg.meta === 'object'
        ? String(msg.meta.provider || '').trim()
        : '';
    return metaProvider || account.oauthProvider || '';
  }

  private storedProviderId(msg: EmailMessage, provider: string): string | null {
    const meta = msg.meta && typeof msg.meta === 'object' ? msg.meta : {};
    if (provider === 'gmail') {
      const fromMeta = String(meta.gmailId || '').trim();
      if (fromMeta) return fromMeta;
      const match = msg.messageId.match(/^gmail:[^:]+:(.+)$/);
      return match?.[1] || null;
    }
    if (provider === 'outlook') {
      const fromMeta = String(meta.outlookId || '').trim();
      if (fromMeta) return fromMeta;
      const match = msg.messageId.match(/^outlook:[^:]+:(.+)$/);
      return match?.[1] || null;
    }
    return null;
  }

  private async parseCalendarInviteForStoredMessage(
    account: EmailAccount,
    msg: EmailMessage,
  ): Promise<ParsedCalendarInvite | null> {
    const token = await this.emailOAuth.ensureAccessToken(account);
    const provider = this.providerFromMessage(account, msg);
    const providerId = this.storedProviderId(msg, provider);
    if (!providerId) return null;

    if (provider === 'gmail') {
      const full = await axios.get<any>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${providerId}`,
        {
          params: { format: 'full' },
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const acc = {
        text: undefined as string | undefined,
        html: undefined as string | undefined,
        attachments: [] as EmailAttachmentMeta[],
        calendarParts: [] as CalendarPart[],
      };
      walkGmailParts(full.data.payload, acc);
      await this.hydrateGmailCalendarParts(token, providerId, acc.calendarParts);
      return parseCalendarInviteSources(acc.calendarParts);
    }

    if (provider === 'outlook') {
      const fetchedAttachments = await this.fetchOutlookAttachments(
        token,
        providerId,
      );
      return parseCalendarInviteSources(fetchedAttachments.calendarParts);
    }

    return null;
  }

  async importCalendarInviteForMessage(
    tenantId: string,
    messageId: string,
  ): Promise<EmailMessage> {
    const msg = await this.messageRepo.findOne({
      where: { id: messageId, tenantId },
    });
    if (!msg) throw new NotFoundException('Message not found');
    const account = await this.accountRepo.findOne({
      where: { id: msg.accountId, tenantId },
    });
    if (!account) throw new NotFoundException('Email account not found');

    const invite = await this.parseCalendarInviteForStoredMessage(account, msg);
    if (!invite) {
      const meta = msg.meta && typeof msg.meta === 'object' ? msg.meta : {};
      msg.meta = {
        ...meta,
        calendarInviteImportError: 'calendar_invite_parse_failed',
      };
      return this.messageRepo.save(msg);
    }
    await this.attachCalendarInviteToMessage(account, msg, invite);
    const updated = await this.messageRepo.findOne({
      where: { id: messageId, tenantId },
    });
    return updated || msg;
  }

  async backfillCalendarInvites(
    tenantId: string,
    options?: { accountId?: string; limit?: number },
  ): Promise<{
    processed: number;
    imported: number;
    failed: number;
    skipped: number;
  }> {
    const limit = Math.min(200, Math.max(1, Number(options?.limit || 100)));
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere("m.meta ->> 'hasCalendarAttachment' = 'true'")
      .andWhere("m.meta -> 'calendarInvite' IS NULL")
      .orderBy('m.date', 'DESC')
      .limit(limit);
    if (options?.accountId) {
      qb.andWhere('m.accountId = :accountId', { accountId: options.accountId });
    }
    const rows = await qb.getMany();
    let imported = 0;
    let failed = 0;
    let skipped = 0;
    for (const row of rows) {
      try {
        const before = row.meta && typeof row.meta === 'object' ? row.meta : {};
        const updated = await this.importCalendarInviteForMessage(tenantId, row.id);
        const after =
          updated.meta && typeof updated.meta === 'object' ? updated.meta : {};
        if (after.calendarInvite && !before.calendarInvite) imported += 1;
        else skipped += 1;
      } catch (e: any) {
        failed += 1;
        this.log.warn(`calendar invite backfill ${row.id}: ${e?.message || e}`);
      }
    }
    return {
      processed: rows.length,
      imported,
      failed,
      skipped,
    };
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
      const existingMeta =
        exists?.meta && typeof exists.meta === 'object' ? exists.meta : {};
      const shouldBackfillCalendarInvite = Boolean(
        exists &&
          existingMeta.hasCalendarAttachment &&
          !existingMeta.calendarInvite &&
          !existingMeta.calendarInviteImportError,
      );
      if (exists && !shouldBackfillCalendarInvite) continue;
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
        attachments: [] as EmailAttachmentMeta[],
        calendarParts: [] as CalendarPart[],
      };
      walkGmailParts(full.data.payload, acc);
      await this.hydrateGmailCalendarParts(token, gid, acc.calendarParts);
      const calendarInvite = parseCalendarInviteSources(acc.calendarParts);
      if (exists) {
        if (calendarInvite) {
          await this.attachCalendarInviteToMessage(account, exists, calendarInvite);
        } else {
          exists.meta = {
            ...existingMeta,
            calendarInviteImportError: 'calendar_invite_parse_failed',
          };
          await this.messageRepo.save(exists);
        }
        continue;
      }
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
          hasCalendarAttachment:
            acc.calendarParts.length > 0 ||
            acc.attachments.some((a) => /\.ics$/i.test(a.filename)),
        },
      });
      await this.messageRepo.save(msg);
      await this.attachCalendarInviteToMessage(account, msg, calendarInvite, {
        notify: true,
      });
      imported += 1;
      await this.emailNotifications.notifyIncomingMessage(account, msg, leadId);
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
      const existingMeta =
        exists?.meta && typeof exists.meta === 'object' ? exists.meta : {};
      const shouldBackfillCalendarInvite = Boolean(
        exists &&
          existingMeta.hasCalendarAttachment &&
          !existingMeta.calendarInvite &&
          !existingMeta.calendarInviteImportError,
      );
      if (exists && !shouldBackfillCalendarInvite) continue;
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
      const fetchedAttachments = it.hasAttachments
        ? await this.fetchOutlookAttachments(token, oid)
        : { attachments: [] as EmailAttachmentMeta[], calendarParts: [] as CalendarPart[] };
      const calendarInvite = parseCalendarInviteSources(
        fetchedAttachments.calendarParts,
      );
      if (exists) {
        if (calendarInvite) {
          await this.attachCalendarInviteToMessage(account, exists, calendarInvite);
        } else {
          exists.meta = {
            ...existingMeta,
            calendarInviteImportError: 'calendar_invite_parse_failed',
          };
          await this.messageRepo.save(exists);
        }
        continue;
      }
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
        attachments: fetchedAttachments.attachments.length
          ? fetchedAttachments.attachments
          : null,
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
          hasCalendarAttachment:
            fetchedAttachments.calendarParts.length > 0 ||
            fetchedAttachments.attachments.some((a) =>
              /\.ics$/i.test(a.filename),
            ),
        },
      });
      await this.messageRepo.save(msg);
      await this.attachCalendarInviteToMessage(account, msg, calendarInvite, {
        notify: true,
      });
      imported += 1;
      await this.emailNotifications.notifyIncomingMessage(account, msg, leadId);
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

  private async fetchOutlookAttachments(
    token: string,
    messageId: string,
  ): Promise<{ attachments: EmailAttachmentMeta[]; calendarParts: CalendarPart[] }> {
    try {
      const res = await axios.get<{ value?: any[] }>(
        `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const attachments: EmailAttachmentMeta[] = [];
      const calendarParts: CalendarPart[] = [];
      for (const a of res.data.value || []) {
        if (a['@odata.type'] === '#microsoft.graph.fileAttachment') {
          const filename = a.name || 'file';
          const contentType = a.contentType || 'application/octet-stream';
          const size = Number(a.size || 0);
          attachments.push({ filename, contentType, size });
          if (
            contentType.toLowerCase().startsWith('text/calendar') ||
            /\.ics$/i.test(filename)
          ) {
            calendarParts.push({
              filename,
              contentType,
              size,
              content: a.contentBytes
                ? Buffer.from(String(a.contentBytes), 'base64').toString('utf8')
                : '',
            });
          }
        }
      }
      return { attachments, calendarParts };
    } catch {
      return { attachments: [], calendarParts: [] };
    }
  }
}
