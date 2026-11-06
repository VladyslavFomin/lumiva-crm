import { BadRequestException } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailAccount } from './email-account.entity';
import { GmailSendAsAddress } from './email-oauth.service';
import { simpleParser } from 'mailparser';

describe('EmailService Gmail sender selection', () => {
  const account = {
    id: 'gmail-account',
    tenantId: 'tenant-a',
    email: 'vlad@lumiva.agency',
    name: 'Vladyslav Fomin',
    oauthProvider: 'gmail',
    oauthRefreshToken: 'refresh-token',
    meta: {},
  } as EmailAccount;
  const primary: GmailSendAsAddress = {
    sendAsEmail: 'vlad@lumiva.agency',
    displayName: 'Vladyslav Fomin',
    isPrimary: true,
    isDefault: true,
    treatAsAlias: false,
    verificationStatus: null,
    canSend: true,
  };
  const info: GmailSendAsAddress = {
    sendAsEmail: 'info@lumiva.agency',
    displayName: 'Info Channel Lumiva Agency',
    isPrimary: false,
    isDefault: false,
    treatAsAlias: true,
    verificationStatus: 'accepted',
    canSend: true,
  };
  const pending: GmailSendAsAddress = {
    ...info,
    sendAsEmail: 'pending@lumiva.agency',
    verificationStatus: 'pending',
    canSend: false,
  };
  let service: EmailService;
  let sendGmail: jest.SpyInstance;

  beforeEach(() => {
    const emailOAuth = {
      syncGmailSendAs: jest.fn().mockResolvedValue({
        addresses: [primary, info, pending],
      }),
    };
    service = new EmailService(
      { findOne: jest.fn().mockResolvedValue(account) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      emailOAuth as any,
      {} as any,
    );
    sendGmail = jest
      .spyOn(service as any, 'sendEmailViaGmail')
      .mockResolvedValue({ id: 'sent-message' });
  });

  it('sends from an explicitly selected verified alias', async () => {
    await service.sendEmail('tenant-a', {
      accountId: account.id,
      to: ['customer@example.com'],
      fromEmail: 'info@lumiva.agency',
      textBody: 'Hello',
    });

    expect(sendGmail).toHaveBeenCalledWith(
      'tenant-a',
      account,
      expect.objectContaining({ fromEmail: 'info@lumiva.agency' }),
      undefined,
      'Hello',
      undefined,
      undefined,
      info,
    );
  });

  it('rejects a pending alias instead of sending from it', async () => {
    await expect(
      service.sendEmail('tenant-a', {
        accountId: account.id,
        to: ['customer@example.com'],
        fromEmail: 'pending@lumiva.agency',
        textBody: 'Hello',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(sendGmail).not.toHaveBeenCalled();
  });

  it('encodes the selected display name and address in the MIME From header', async () => {
    const unicodeSender = { ...info, displayName: 'Канал поддержки' };
    const mime = await (service as any).compileOutboundMime(
      account,
      unicodeSender,
      {
        accountId: account.id,
        to: ['customer@example.com'],
      },
      'Subject',
      'Hello',
      undefined,
      undefined,
    );
    const parsed = await simpleParser(mime);

    expect(parsed.from?.value).toEqual([
      { name: unicodeSender.displayName, address: unicodeSender.sendAsEmail },
    ]);
  });

  it('uses the verified primary address when no sender is selected', async () => {
    await service.sendEmail('tenant-a', {
      accountId: account.id,
      to: ['customer@example.com'],
      textBody: 'Hello',
    });

    expect(sendGmail.mock.calls[0][7]).toEqual(primary);
  });

  it('rejects a sender override for SMTP accounts', async () => {
    const smtpService = new EmailService(
      { findOne: jest.fn().mockResolvedValue({ ...account, oauthProvider: null }) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { syncGmailSendAs: jest.fn() } as any,
      {} as any,
    );

    await expect(
      smtpService.sendEmail('tenant-a', {
        accountId: account.id,
        to: ['customer@example.com'],
        fromEmail: 'info@lumiva.agency',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
