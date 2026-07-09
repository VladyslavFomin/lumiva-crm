import { ZapierMakeInboundService } from './zapier-make-inbound.service';

// Minimal stubs — no DB needed for unit tests
const mockRepo = { findOne: jest.fn() };
const mockLeads = { createForTenant: jest.fn() };
const mockNotes = { create: jest.fn() };

function buildService() {
  return new ZapierMakeInboundService(
    mockRepo as any,
    mockLeads as any,
    mockNotes as any,
  );
}

const makeEntity = (overrides: object = {}) => ({
  id: 'conn-1',
  tenantId: 'tenant-1',
  kind: 'third_party_link',
  isDeleted: false,
  isEnabled: true,
  configJson: JSON.stringify({
    catalogId: 'zapier',
    inboundToken: 'lmv_secret123',
    defaultLeadSource: 'zapier',
  }),
  ...overrides,
});

describe('ZapierMakeInboundService', () => {
  let svc: ZapierMakeInboundService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = buildService();
    mockLeads.createForTenant.mockResolvedValue({ id: 'lead-1' });
    mockNotes.create.mockResolvedValue(undefined);
  });

  // ─── extractToken ────────────────────────────────────────────────
  describe('extractToken', () => {
    it('picks token from ?token= query param', () => {
      expect(svc.extractToken({}, { token: 'abc' })).toBe('abc');
    });

    it('picks token from Authorization: Bearer header', () => {
      expect(svc.extractToken({ authorization: 'Bearer my-token' }, {})).toBe('my-token');
    });

    it('is case-insensitive for bearer prefix', () => {
      expect(svc.extractToken({ authorization: 'BEARER tok' }, {})).toBe('tok');
    });

    it('picks token from x-lumiva-token header', () => {
      expect(svc.extractToken({ 'x-lumiva-token': 'tok2' }, {})).toBe('tok2');
    });

    it('query param takes priority over header', () => {
      expect(
        svc.extractToken({ authorization: 'Bearer header-tok' }, { token: 'query-tok' }),
      ).toBe('query-tok');
    });

    it('returns empty string when no token provided', () => {
      expect(svc.extractToken({}, {})).toBe('');
    });
  });

  // ─── handleInbound ───────────────────────────────────────────────
  describe('handleInbound', () => {
    it('creates lead from clean payload', async () => {
      mockRepo.findOne.mockResolvedValue(makeEntity());

      await svc.handleInbound(
        'conn-1',
        { authorization: 'Bearer lmv_secret123' },
        {},
        { name: 'John Doe', email: 'john@example.com', phone: '+1234567890', message: 'Hello' },
      );

      expect(mockLeads.createForTenant).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          source: 'zapier',
          status: 'new',
        }),
      );
      expect(mockNotes.create).toHaveBeenCalledTimes(1);
    });

    it('rejects mismatched token', async () => {
      mockRepo.findOne.mockResolvedValue(makeEntity());

      await svc.handleInbound('conn-1', {}, { token: 'wrong-token' }, { email: 'x@x.com' });

      expect(mockLeads.createForTenant).not.toHaveBeenCalled();
    });

    it('allows no-token connections (open webhook)', async () => {
      mockRepo.findOne.mockResolvedValue(
        makeEntity({ configJson: JSON.stringify({ catalogId: 'make', inboundToken: '' }) }),
      );

      await svc.handleInbound('conn-1', {}, {}, { email: 'open@example.com' });

      expect(mockLeads.createForTenant).toHaveBeenCalled();
    });

    it('returns without creating lead when connection not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await svc.handleInbound('conn-1', {}, {}, { email: 'x@x.com' });

      expect(mockLeads.createForTenant).not.toHaveBeenCalled();
    });

    it('returns without creating when body is empty', async () => {
      mockRepo.findOne.mockResolvedValue(
        makeEntity({ configJson: JSON.stringify({ catalogId: 'zapier', inboundToken: '' }) }),
      );

      await svc.handleInbound('conn-1', {}, {}, {});

      expect(mockLeads.createForTenant).not.toHaveBeenCalled();
    });

    it('uses status field from payload', async () => {
      mockRepo.findOne.mockResolvedValue(makeEntity());

      await svc.handleInbound(
        'conn-1',
        { authorization: 'Bearer lmv_secret123' },
        {},
        { email: 'a@b.com', status: 'won' },
      );

      expect(mockLeads.createForTenant).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ status: 'won' }),
      );
    });

    it('auto-detects name from full_name field', async () => {
      mockRepo.findOne.mockResolvedValue(makeEntity());

      await svc.handleInbound(
        'conn-1',
        { authorization: 'Bearer lmv_secret123' },
        {},
        { full_name: 'Jane Doe', email: 'jane@example.com' },
      );

      expect(mockLeads.createForTenant).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ name: 'Jane Doe' }),
      );
    });

    it('auto-detects email from your-email CF7-style field', async () => {
      mockRepo.findOne.mockResolvedValue(makeEntity());

      await svc.handleInbound(
        'conn-1',
        { authorization: 'Bearer lmv_secret123' },
        {},
        { 'your-name': 'Bob', 'your-email': 'bob@site.com' },
      );

      expect(mockLeads.createForTenant).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ email: 'bob@site.com' }),
      );
    });

    it('uses Make label for make catalogId connections', async () => {
      mockRepo.findOne.mockResolvedValue(
        makeEntity({
          configJson: JSON.stringify({ catalogId: 'make', inboundToken: '' }),
        }),
      );

      await svc.handleInbound('conn-1', {}, {}, { email: 'test@make.com' });

      expect(mockLeads.createForTenant).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ source: 'make' }),
      );
    });
  });
});
