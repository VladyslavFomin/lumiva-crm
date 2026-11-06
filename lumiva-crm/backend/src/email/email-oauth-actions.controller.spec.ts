import { EmailOAuthActionsController } from './email-oauth-actions.controller';

describe('EmailOAuthActionsController Send As tenant scope', () => {
  it('loads the account with the active tenant and actor before syncing', async () => {
    const account = { id: 'account-a', tenantId: 'tenant-a' };
    const emailService = {
      requireAccountEntity: jest.fn().mockResolvedValue(account),
    };
    const oauth = {
      syncGmailSendAs: jest.fn().mockResolvedValue({
        addresses: [],
        syncedAt: '2026-11-03T00:00:00.000Z',
      }),
    };
    const controller = new EmailOAuthActionsController(
      oauth as any,
      {} as any,
      emailService as any,
    );

    await controller.syncGmailSendAs(
      { tenantId: 'tenant-a', sub: 'user-a', role: 'owner' } as any,
      'account-a',
    );

    expect(emailService.requireAccountEntity).toHaveBeenCalledWith(
      'tenant-a',
      'account-a',
      'user-a',
      'owner',
    );
    expect(oauth.syncGmailSendAs).toHaveBeenCalledWith(account);
  });
});
