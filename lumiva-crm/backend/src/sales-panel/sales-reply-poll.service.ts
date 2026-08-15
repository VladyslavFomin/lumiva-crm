import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImapFlow, type SearchObject } from 'imapflow';
import { simpleParser } from 'mailparser';
import { SalesInvitation, type SalesReplyMatchedBy } from './sales-invitation.entity';
import { SalesProspect } from './sales-prospect.entity';
import { SalesReplyPollState } from './sales-reply-poll-state.entity';

const SUBJECT_TOKEN_REGEX = /\[SP-([A-F0-9]{12})\]/i;
const AUTO_REPLY_SUBJECT_REGEX =
  /out.?of.?office|automatic reply|автоответ|отсутствую|otomatik yan[ıi]t/i;

function normalizeMessageId(value: string | null | undefined): string {
  return String(value || '').trim().replace(/^<|>$/g, '').toLowerCase();
}

@Injectable()
export class SalesReplyPollService {
  private readonly logger = new Logger(SalesReplyPollService.name);
  private cronLock = false;

  constructor(
    @InjectRepository(SalesInvitation)
    private readonly invitationRepo: Repository<SalesInvitation>,
    @InjectRepository(SalesProspect)
    private readonly prospectRepo: Repository<SalesProspect>,
    @InjectRepository(SalesReplyPollState)
    private readonly stateRepo: Repository<SalesReplyPollState>,
  ) {}

  @Cron('*/5 * * * *')
  async cronPoll(): Promise<void> {
    if (this.cronLock) return;
    this.cronLock = true;
    try {
      await this.pollNow();
    } catch (e) {
      this.logger.warn(`reply poll failed: ${(e as Error).message}`);
    } finally {
      this.cronLock = false;
    }
  }

  async pollNow(): Promise<{ scanned: number; matched: number }> {
    const pending = await this.invitationRepo.find({ where: { status: 'sent' } });
    if (pending.length === 0) {
      await this.touchState(0);
      return { scanned: 0, matched: 0 };
    }

    if (!process.env.SALES_PANEL_IMAP_HOST || !process.env.SALES_PANEL_IMAP_USER) {
      this.logger.debug('SALES_PANEL_IMAP_* is not configured — skipping reply poll');
      return { scanned: 0, matched: 0 };
    }

    const byMessageId = new Map<string, SalesInvitation>();
    const byToken = new Map<string, SalesInvitation>();
    for (const inv of pending) {
      if (inv.outboundMessageId) {
        byMessageId.set(normalizeMessageId(inv.outboundMessageId), inv);
      }
      byToken.set(inv.trackingToken.toUpperCase(), inv);
    }

    const earliestSentAt = pending.reduce<Date | null>((min, inv) => {
      if (!inv.sentAt) return min;
      if (!min || inv.sentAt < min) return inv.sentAt;
      return min;
    }, null);

    const port = Number(process.env.SALES_PANEL_IMAP_PORT || 993);
    const secure =
      process.env.SALES_PANEL_IMAP_SECURE !== '0' &&
      process.env.SALES_PANEL_IMAP_SECURE !== 'false';
    const client = new ImapFlow({
      host: process.env.SALES_PANEL_IMAP_HOST!,
      port,
      secure,
      auth: {
        user: process.env.SALES_PANEL_IMAP_USER!,
        pass: process.env.SALES_PANEL_IMAP_PASS || '',
      },
      logger: false,
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 60_000,
      tls: { rejectUnauthorized: false },
    });

    let scanned = 0;
    let matched = 0;

    await client.connect();
    let lock: { release(): void } | null = null;
    try {
      const folder = process.env.SALES_PANEL_IMAP_FOLDER || 'INBOX';
      lock = await client.getMailboxLock(folder, { maxLockHoldTime: 120_000 });

      const searchCriteria: SearchObject = earliestSentAt
        ? { since: earliestSentAt }
        : { all: true };
      const uids = await client.search(searchCriteria, { uid: true });
      if (!uids || uids.length === 0) {
        return { scanned: 0, matched: 0 };
      }

      for await (const imapMessage of client.fetch(
        uids,
        { envelope: true, source: true },
        { uid: true },
      )) {
        scanned += 1;
        if (!imapMessage.source) continue;
        const parsed = await simpleParser(imapMessage.source, { skipImageLinks: true });

        const autoSubmitted = String(parsed.headers.get('auto-submitted') || '').toLowerCase();
        if (autoSubmitted && autoSubmitted !== 'no') continue;
        if (AUTO_REPLY_SUBJECT_REGEX.test(parsed.subject || '')) continue;

        let invitation: SalesInvitation | undefined;
        let matchedBy: SalesReplyMatchedBy = 'header';

        const inReplyTo = normalizeMessageId(String(parsed.inReplyTo || ''));
        const referencesRaw = parsed.references;
        const references = (
          Array.isArray(referencesRaw) ? referencesRaw : referencesRaw ? [referencesRaw] : []
        ).map((r) => normalizeMessageId(r));

        if (inReplyTo && byMessageId.has(inReplyTo)) {
          invitation = byMessageId.get(inReplyTo);
        } else {
          const refMatch = references.find((r) => byMessageId.has(r));
          if (refMatch) invitation = byMessageId.get(refMatch);
        }

        if (!invitation) {
          const subjectMatch = SUBJECT_TOKEN_REGEX.exec(parsed.subject || '');
          if (subjectMatch) {
            invitation = byToken.get(subjectMatch[1].toUpperCase());
            matchedBy = 'subject-token';
          }
        }

        if (!invitation) continue;

        matched += 1;
        const repliedAt = parsed.date || new Date();
        invitation.status = 'replied';
        invitation.repliedAt = repliedAt;
        invitation.replySnippet = (parsed.text || '').slice(0, 300) || null;
        invitation.replyMatchedBy = matchedBy;
        await this.invitationRepo.save(invitation);

        if (invitation.prospectId) {
          const prospect = await this.prospectRepo.findOne({
            where: { id: invitation.prospectId },
          });
          if (prospect) {
            prospect.outreachStatus = 'replied';
            prospect.lastRepliedAt = repliedAt;
            await this.prospectRepo.save(prospect);
          }
        }

        if (inReplyTo) byMessageId.delete(inReplyTo);
        byToken.delete(invitation.trackingToken.toUpperCase());
      }
    } finally {
      lock?.release();
      await client.logout().catch(() => client.close());
    }

    await this.touchState(matched);
    return { scanned, matched };
  }

  private async touchState(matchCount: number): Promise<void> {
    let state = await this.stateRepo.findOne({ where: { key: 'default' } });
    if (!state) {
      state = this.stateRepo.create({ key: 'default' });
    }
    state.lastPolledAt = new Date();
    state.lastMatchCount = matchCount;
    await this.stateRepo.save(state);
  }
}
