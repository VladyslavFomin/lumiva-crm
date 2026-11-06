import axios from 'axios';
import { BadGatewayException } from '@nestjs/common';
import { EmailOAuthService } from './email-oauth.service';
import { EmailAccount } from './email-account.entity';

describe('EmailOAuthService Gmail Send As', () => {
  const accountRepo = {
    save: jest.fn(async (account: EmailAccount) => account),
  };
  const platformSettings = {
    getGoogleOAuthConfig: jest.fn().mockResolvedValue({
      clientId: 'google-client',
      clientSecret: 'google-secret',
    }),
  };
  let service: EmailOAuthService;

  beforeEach(() => {
    jest.restoreAllMocks();
    accountRepo.save.mockClear();
    service = new EmailOAuthService(accountRepo as any, platformSettings as any);
  });

  it('refreshes an expired token and syncs verified and pending addresses', async () => {
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: { access_token: 'fresh-access-token', expires_in: 3600 },
    } as any);
    const get = jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        sendAs: [
          {
            sendAsEmail: 'vlad@lumiva.agency',
            displayName: 'Vladyslav Fomin',
            isPrimary: true,
            isDefault: true,
            treatAsAlias: false,
          },
          {
            sendAsEmail: 'info@lumiva.agency',
            displayName: 'Info Channel Lumiva Agency',
            isPrimary: false,
            isDefault: false,
            treatAsAlias: true,
            verificationStatus: 'accepted',
          },
          {
            sendAsEmail: 'pending@lumiva.agency',
            verificationStatus: 'pending',
          },
        ],
      },
    } as any);
    const account = {
      id: 'gmail-account',
      tenantId: 'tenant-a',
      email: 'vlad@lumiva.agency',
      oauthProvider: 'gmail',
      oauthAccessToken: 'expired-token',
      oauthRefreshToken: 'refresh-token',
      oauthExpiresAt: new Date(Date.now() - 60_000),
      meta: {},
    } as EmailAccount;

    const result = await service.syncGmailSendAs(account);

    expect(axios.post).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.stringContaining('refresh_token=refresh-token'),
      expect.any(Object),
    );
    expect(get).toHaveBeenCalledWith(
      'https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs',
      { headers: { Authorization: 'Bearer fresh-access-token' } },
    );
    expect(result.addresses.map((address) => address.sendAsEmail)).toEqual([
      'vlad@lumiva.agency',
      'info@lumiva.agency',
      'pending@lumiva.agency',
    ]);
    expect(result.addresses.map((address) => address.canSend)).toEqual([
      true,
      true,
      false,
    ]);
    expect(account.meta.gmailSendAs.addresses).toEqual(result.addresses);
    expect(account.meta.gmailSendAs.syncedAt).toBe(result.syncedAt);
    expect(accountRepo.save).toHaveBeenCalledWith(account);
  });

  it('replaces its stored list when Google adds an address', async () => {
    const get = jest.spyOn(axios, 'get');
    get
      .mockResolvedValueOnce({
        data: { sendAs: [{ sendAsEmail: 'vlad@lumiva.agency', verificationStatus: 'accepted' }] },
      } as any)
      .mockResolvedValueOnce({
        data: {
          sendAs: [
            { sendAsEmail: 'vlad@lumiva.agency', verificationStatus: 'accepted' },
            { sendAsEmail: 'sales@lumiva.agency', verificationStatus: 'accepted' },
          ],
        },
      } as any);
    const account = {
      id: 'gmail-account',
      tenantId: 'tenant-a',
      email: 'vlad@lumiva.agency',
      oauthProvider: 'gmail',
      oauthAccessToken: 'valid-token',
      oauthRefreshToken: 'refresh-token',
      oauthExpiresAt: new Date(Date.now() + 60 * 60_000),
      meta: {},
    } as EmailAccount;

    await service.syncGmailSendAs(account);
    const updated = await service.syncGmailSendAs(account);

    expect(updated.addresses.map((address) => address.sendAsEmail)).toContain(
      'sales@lumiva.agency',
    );
  });

  it('stores the synchronization error and surfaces Google API failures', async () => {
    jest.spyOn(axios, 'get').mockRejectedValue({
      message: 'Request failed',
      response: { data: { error: { message: 'Insufficient Permission' } } },
    });
    const account = {
      id: 'gmail-account',
      tenantId: 'tenant-a',
      email: 'vlad@lumiva.agency',
      oauthProvider: 'gmail',
      oauthAccessToken: 'valid-token',
      oauthRefreshToken: 'refresh-token',
      oauthExpiresAt: new Date(Date.now() + 60 * 60_000),
      meta: {},
    } as EmailAccount;

    await expect(service.syncGmailSendAs(account)).rejects.toThrow(
      BadGatewayException,
    );
    expect(account.meta.gmailSendAs.error).toBe('Insufficient Permission');
  });
});
