import { BadRequestException } from '@nestjs/common';
import { EmailAccount } from '../email/email-account.entity';
import { GmailSendAsAddress } from '../email/email-oauth.service';
import { TenantMailService } from './tenant-mail.service';

describe('TenantMailService notification sender', () => {
  const support: GmailSendAsAddress = {
    sendAsEmail: 'support@lumiva.agency',
    displayName: 'Lumiva Support',
    isPrimary: false,
    isDefault: false,
    treatAsAlias: true,
    verificationStatus: 'accepted',
    canSend: true,
  };
  const account = {
    id: 'gmail-account',
    tenantId: 'tenant-a',
    email: 'vlad@lumiva.agency',
    name: 'Lumiva Agency',
    userId: null,
    status: 'active',
    oauthProvider: 'gmail',
    oauthRefreshToken: 'refresh-token',
    smtpHost: null,
    smtpPort: null,
    useForNotifications: false,
    meta: {},
  } as EmailAccount;
  const repo = {
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
  };
  const oauth = {
    syncGmailSendAs: jest.fn(),
    ensureAccessToken: jest.fn(),
  };
  let service: TenantMailService;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(account, { useForNotifications: false, meta: {} });
    repo.find.mockResolvedValue([account]);
    repo.findOne.mockResolvedValue(account);
    repo.update.mockResolvedValue(undefined);
    repo.save.mockImplementation(async (value) => value);
    oauth.syncGmailSendAs.mockResolvedValue({
      addresses: [
        { ...support },
        { ...support, sendAsEmail: account.email, displayName: account.name, isPrimary: true, canSend: true },
      ],
      syncedAt: new Date().toISOString(),
    });
    service = new TenantMailService(repo as any, oauth as any, {} as any);
  });

  it('saves a verified Gmail alias as the CRM notification sender', async () => {
    await service.choose('tenant-a', account.id, support.sendAsEmail);

    expect(account.meta.notificationFromEmail).toBe(support.sendAsEmail);
    expect(account.useForNotifications).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(account);
  });

  it('rejects an unverified Gmail alias', async () => {
    oauth.syncGmailSendAs.mockResolvedValue({
      addresses: [{ ...support, canSend: false, verificationStatus: 'pending' }],
    });

    await expect(
      service.choose('tenant-a', account.id, support.sendAsEmail),
    ).rejects.toThrow(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('sends CRM mail from the selected Gmail alias', async () => {
    account.useForNotifications = true;
    account.meta = { notificationFromEmail: support.sendAsEmail };
    const deliver = jest.spyOn(service as any, 'deliver').mockResolvedValue(undefined);

    const result = await service.send('tenant-a', {
      to: 'employee@lumiva.agency',
      subject: 'CRM notification',
      html: '<p>Notification</p>',
    });

    expect(result).toEqual({ ok: true, via: 'tenant', from: support.sendAsEmail });
    expect(deliver).toHaveBeenCalledWith(
      account,
      ['employee@lumiva.agency'],
      expect.any(Object),
      { email: support.sendAsEmail, displayName: support.displayName },
    );
  });
});
