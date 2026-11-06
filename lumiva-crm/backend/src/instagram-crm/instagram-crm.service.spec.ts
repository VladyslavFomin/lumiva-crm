import { InstagramCrmService } from './instagram-crm.service';

describe('InstagramCrmService OAuth', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const tenant = {
    id: 'tenant-123',
    customDomain: 'atgdesk.com',
    customDomainStatus: 'active' as const,
  };
  let accounts: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let tenants: { findOne: jest.Mock };
  let graph: {
    exchangeCode: jest.Mock;
    listPagesWithInstagram: jest.Mock;
    subscribePage: jest.Mock;
  };
  let platformSettings: { getMetaOAuthConfig: jest.Mock };
  let service: InstagramCrmService;

  beforeEach(() => {
    process.env.JWT_SECRET = 'instagram-oauth-test-secret';
    accounts = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value: unknown) => value),
      save: jest.fn((value: unknown) => value),
    };
    tenants = { findOne: jest.fn().mockResolvedValue(tenant) };
    graph = {
      exchangeCode: jest.fn().mockResolvedValue('user-token'),
      listPagesWithInstagram: jest.fn().mockResolvedValue([
        {
          pageId: 'page-1',
          pageName: 'Test Page',
          pageAccessToken: 'page-token',
          igUserId: 'instagram-1',
          igUsername: 'test',
          profilePictureUrl: null,
        },
      ]),
      subscribePage: jest.fn().mockResolvedValue(undefined),
    };
    platformSettings = {
      getMetaOAuthConfig: jest
        .fn()
        .mockResolvedValue({ appId: 'app-id', appSecret: 'app-secret' }),
    };
    service = new InstagramCrmService(
      accounts as never,
      {} as never,
      {} as never,
      {} as never,
      tenants as never,
      graph as never,
      platformSettings as never,
      {} as never,
      {} as never,
    );
  });

  afterAll(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });

  it('saves the account for the JWT tenant and returns to its active custom domain', async () => {
    const { url } = await service.getAuthUrl(tenant.id);
    const state = new URL(url).searchParams.get('state');
    expect(state).toBeTruthy();

    const redirect = await service.handleOAuthCallback(
      'authorization-code',
      state!,
    );

    expect(redirect).toBe('https://atgdesk.com/app/instagram?ig=connected');
    expect(accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: tenant.id, igUserId: 'instagram-1' }),
    );
    expect(accounts.save).toHaveBeenCalled();
  });

  it('falls back to the CRM domain if the tenant domain changes during authorization', async () => {
    const { url } = await service.getAuthUrl(tenant.id);
    const state = new URL(url).searchParams.get('state');
    tenants.findOne.mockResolvedValue({
      ...tenant,
      customDomain: 'new-domain.com',
    });

    const redirect = await service.handleOAuthCallback(undefined, state!);

    expect(redirect).toBe('https://crm.lumiva.agency/app/instagram?ig=denied');
  });
});
