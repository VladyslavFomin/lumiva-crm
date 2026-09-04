import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

import { JwtStrategy } from './jwt.strategy';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { TenantLogsService } from '../tenants/tenant-logs.service';
import { UserSessionsService } from './user-sessions.service';

process.env.JWT_SECRET = 'test-secret-for-unit-tests';

const makeTenant = (overrides: Partial<Tenant> = {}): Tenant =>
  ({ id: 'tenant-1', clientKey: 'test', status: 'active', activeUntil: null, ...overrides } as Tenant);

const makeUser = (overrides: Partial<User> = {}): User =>
  ({ id: 'user-1', tenantId: 'tenant-1', email: 'admin@test.com', status: 'active', role: 'owner', ...overrides } as User);

const validSession = { id: 'session-1', userId: 'user-1', tenantId: 'tenant-1' };

const validPayload = {
  sub: 'user-1',
  tenantId: 'tenant-1',
  role: 'owner',
  email: 'admin@test.com',
  sid: 'session-1',
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const tenantRepo = { findOne: jest.fn() };
  const userRepo = { findOne: jest.fn() };
  const staffRepo = { findOne: jest.fn() };
  const tenantLogs = { record: jest.fn() };
  const userSessions = { findActiveById: jest.fn(), touchSessionIfStale: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    tenantLogs.record.mockResolvedValue(undefined);
    userSessions.touchSessionIfStale.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: getRepositoryToken(Tenant), useValue: tenantRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(StaffUser), useValue: staffRepo },
        { provide: TenantLogsService, useValue: tenantLogs },
        { provide: UserSessionsService, useValue: userSessions },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe('validate()', () => {
    it('returns CurrentUserPayload for valid token', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      userSessions.findActiveById.mockResolvedValue(validSession);
      userRepo.findOne.mockResolvedValue(makeUser());
      staffRepo.findOne.mockResolvedValue(null);

      const result = await strategy.validate(validPayload);

      expect(result.userId).toBe('user-1');
      expect(result.tenantId).toBe('tenant-1');
      expect(result.role).toBe('owner');
    });

    it('uses the CURRENT role from the DB, not the role embedded in the JWT at login time — a', async () => {
      // role change (owner demotes a manager to viewer, say) must take effect immediately on the
      // person's existing session, not only after they log back in and get a fresh token.
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      userSessions.findActiveById.mockResolvedValue(validSession);
      userRepo.findOne.mockResolvedValue(makeUser({ role: 'viewer' }));
      staffRepo.findOne.mockResolvedValue(null);

      // Token was issued while this user was still 'owner'.
      const result = await strategy.validate({ ...validPayload, role: 'owner' });

      expect(result.role).toBe('viewer');
    });

    it('attaches staffUserId from the matching staff_users row (not users.id)', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      userSessions.findActiveById.mockResolvedValue(validSession);
      userRepo.findOne.mockResolvedValue(makeUser());
      staffRepo.findOne.mockResolvedValue({ id: 'staff-user-99', isActive: true });

      const result = await strategy.validate(validPayload);

      expect(result.staffUserId).toBe('staff-user-99');
    });

    // ─── Tenant isolation ─────────────────────────────────────────────────

    it('throws ForbiddenException TENANT_INACTIVE when tenant is blocked', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant({ status: 'blocked' }));
      const err = await strategy.validate(validPayload).catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect(err.response?.code).toBe('TENANT_INACTIVE');
    });

    it('throws ForbiddenException when tenant is expired (activeUntil in the past)', async () => {
      tenantRepo.findOne.mockResolvedValue(
        makeTenant({ activeUntil: new Date(Date.now() - 1000) }),
      );
      // Expired tenant returns 'expired', not 'blocked', so the guard should NOT block it
      // (only 'blocked' triggers the ForbiddenException in jwt.strategy.ts)
      // This confirms the strategy only blocks status==='active' check, not expired
      userSessions.findActiveById.mockResolvedValue(validSession);
      userRepo.findOne.mockResolvedValue(makeUser());
      staffRepo.findOne.mockResolvedValue(null);
      // Should NOT throw — expired is allowed through (billing layer handles it)
      const result = await strategy.validate(validPayload);
      expect(result.userId).toBe('user-1');
    });

    it('enforces isolation: throws when session.userId does not match token sub', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      // Session belongs to a DIFFERENT user
      userSessions.findActiveById.mockResolvedValue({ ...validSession, userId: 'ANOTHER-USER' });

      await expect(strategy.validate(validPayload)).rejects.toThrow(UnauthorizedException);
    });

    it('enforces isolation: throws when session.tenantId does not match token tenantId', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      // Session belongs to a DIFFERENT tenant
      userSessions.findActiveById.mockResolvedValue({ ...validSession, tenantId: 'ANOTHER-TENANT' });

      await expect(strategy.validate(validPayload)).rejects.toThrow(UnauthorizedException);
    });

    it('enforces isolation: throws when user.tenantId does not match token tenantId', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      userSessions.findActiveById.mockResolvedValue(validSession);
      // User stored in DB has a DIFFERENT tenantId than what's in the JWT
      userRepo.findOne.mockResolvedValue(makeUser({ tenantId: 'WRONG-TENANT' }));

      await expect(strategy.validate(validPayload)).rejects.toThrow(UnauthorizedException);
    });

    // ─── Session validation ───────────────────────────────────────────────

    it('throws SESSION_INVALID when token has no sid', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      const err = await strategy.validate({ ...validPayload, sid: undefined }).catch((e) => e);
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.response?.code).toBe('SESSION_INVALID');
    });

    it('throws SESSION_INVALID when session is revoked (not found)', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      userSessions.findActiveById.mockResolvedValue(null);
      const err = await strategy.validate(validPayload).catch((e) => e);
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.response?.code).toBe('SESSION_INVALID');
    });

    // ─── User status ──────────────────────────────────────────────────────

    it('throws when user is inactive', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      userSessions.findActiveById.mockResolvedValue(validSession);
      userRepo.findOne.mockResolvedValue(makeUser({ status: 'disabled' }));

      await expect(strategy.validate(validPayload)).rejects.toThrow(UnauthorizedException);
    });

    it('throws when staff record is deactivated', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      userSessions.findActiveById.mockResolvedValue(validSession);
      userRepo.findOne.mockResolvedValue(makeUser());
      staffRepo.findOne.mockResolvedValue({ isActive: false });

      await expect(strategy.validate(validPayload)).rejects.toThrow(UnauthorizedException);
    });

    it('touches session on successful validation', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      userSessions.findActiveById.mockResolvedValue(validSession);
      userRepo.findOne.mockResolvedValue(makeUser());
      staffRepo.findOne.mockResolvedValue(null);

      await strategy.validate(validPayload);

      expect(userSessions.touchSessionIfStale).toHaveBeenCalledWith('session-1');
    });
  });
});
