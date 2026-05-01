import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AuthService } from './auth.service';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { TenantLogsService } from '../tenants/tenant-logs.service';
import { StaffUsersService } from '../staff/staff-users.service';
import { MailService } from '../mail/mail.service';
import { UserSessionsService } from './user-sessions.service';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('../tenants/plan-entitlements', () => ({
  buildPlanEntitlements: jest.fn(() => ({
    normalizedPlan: 'basic',
    enabledModules: {},
    enabledComponents: {},
  })),
  normalizeTenantPlan: jest.fn((p: string) => p ?? 'basic'),
}));

import * as bcrypt from 'bcryptjs';
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const makeTenant = (overrides: Partial<Tenant> = {}): Tenant =>
  ({
    id: 'tenant-1',
    clientKey: 'test-co',
    name: 'Test Co',
    status: 'active',
    plan: 'basic',
    activeUntil: null,
    enabledModules: {},
    enabledComponents: {},
    ...overrides,
  } as Tenant);

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'admin@test.com',
    password: 'hashed-pw',
    role: 'owner',
    status: 'active',
    emailVerificationRequired: false,
    lastActiveAt: null,
    ...overrides,
  } as User);

describe('AuthService', () => {
  let service: AuthService;

  const tenantRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const userRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const staffRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const jwtService = { signAsync: jest.fn() };
  const tenantLogs = { record: jest.fn() };
  const staffUsers = { issuePasswordResetToken: jest.fn() };
  const mailService = { sendMail: jest.fn() };
  const userSessions = { createSession: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mailService.sendMail.mockResolvedValue(undefined);
    tenantLogs.record.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Tenant), useValue: tenantRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(StaffUser), useValue: staffRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: TenantLogsService, useValue: tenantLogs },
        { provide: StaffUsersService, useValue: staffUsers },
        { provide: MailService, useValue: mailService },
        { provide: UserSessionsService, useValue: userSessions },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─── login ───────────────────────────────────────────────────────────────

  describe('login()', () => {
    const dto = { clientKey: 'test-co', email: 'admin@test.com', password: 'secret123' };

    it('throws when tenant not found', async () => {
      tenantRepo.findOne.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws TENANT_INACTIVE when tenant status is blocked', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant({ status: 'blocked' }));
      const err = await service.login(dto).catch((e) => e);
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.response?.code).toBe('TENANT_INACTIVE');
    });

    it('throws when user not found in tenant (tenant isolation)', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('enforces tenant isolation: user from other tenant cannot login', async () => {
      // User only exists in tenant-2, but request targets tenant-1
      tenantRepo.findOne.mockResolvedValue(makeTenant({ id: 'tenant-2', clientKey: 'other-co' }));
      userRepo.findOne.mockResolvedValue(null); // not found in tenant-2
      await expect(service.login({ ...dto, clientKey: 'other-co' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when user status is not active', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      userRepo.findOne.mockResolvedValue(makeUser({ status: 'disabled' }));
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws EMAIL_VERIFICATION_REQUIRED when email not verified', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      userRepo.findOne.mockResolvedValue(makeUser({ emailVerificationRequired: true }));
      const err = await service.login(dto).catch((e) => e);
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.response?.code).toBe('EMAIL_VERIFICATION_REQUIRED');
    });

    it('throws when password is wrong', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      userRepo.findOne.mockResolvedValue(makeUser());
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('returns accessToken and user data on valid credentials', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      userRepo.findOne.mockResolvedValue(makeUser());
      staffRepo.findOne.mockResolvedValue(null);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);
      userSessions.createSession.mockResolvedValue({ id: 'session-1' });
      userRepo.save.mockResolvedValue(makeUser());
      jwtService.signAsync.mockResolvedValue('signed-jwt');

      const result = await service.login(dto);

      expect(result.accessToken).toBe('signed-jwt');
      expect(result.tenantId).toBe('tenant-1');
      expect(result.user.email).toBe('admin@test.com');
    });

    it('throws when staff user is deactivated', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      userRepo.findOne.mockResolvedValue(makeUser());
      staffRepo.findOne.mockResolvedValue({ isActive: false, tenantId: 'tenant-1', email: 'admin@test.com' });
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('creates a session on successful login', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      userRepo.findOne.mockResolvedValue(makeUser());
      staffRepo.findOne.mockResolvedValue(null);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);
      userSessions.createSession.mockResolvedValue({ id: 'session-abc' });
      userRepo.save.mockResolvedValue(makeUser());
      jwtService.signAsync.mockResolvedValue('token');

      await service.login(dto);

      expect(userSessions.createSession).toHaveBeenCalledWith(
        'user-1',
        'tenant-1',
        null,
        null,
      );
    });
  });

  // ─── signup ──────────────────────────────────────────────────────────────

  describe('signup()', () => {
    const dto = {
      clientKey: 'new-company',
      companyName: 'New Company LLC',
      email: 'owner@newco.com',
      password: 'StrongPass1!',
      phone: undefined as string | undefined,
    };

    beforeEach(() => {
      tenantRepo.findOne.mockResolvedValue(null);
      const mockTenant = makeTenant({ clientKey: 'new-company', id: 'new-tenant' });
      tenantRepo.create.mockReturnValue(mockTenant);
      tenantRepo.save.mockResolvedValue(mockTenant);
      const mockUser = makeUser({ tenantId: 'new-tenant', email: dto.email });
      userRepo.create.mockReturnValue(mockUser);
      userRepo.save.mockResolvedValue(mockUser);
      staffRepo.create.mockReturnValue({});
      staffRepo.save.mockResolvedValue({});
      (mockBcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');
    });

    it('throws BadRequestException when clientKey already taken', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      await expect(service.signup(dto)).rejects.toThrow(BadRequestException);
    });

    it('returns verificationRequired: true on success', async () => {
      const result = await service.signup(dto);
      expect(result.verificationRequired).toBe(true);
      expect(result.email).toBe(dto.email);
    });

    it('sends verification email on signup', async () => {
      await service.signup(dto);
      expect(mailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: dto.email }),
      );
    });

    it('normalizes clientKey to lowercase hyphenated', async () => {
      await service.signup({ ...dto, clientKey: 'My New Company' });
      expect(tenantRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ clientKey: 'my-new-company' }),
      );
    });

    it('throws BadRequestException when normalized clientKey is too short', async () => {
      await expect(service.signup({ ...dto, clientKey: 'AB' })).rejects.toThrow(BadRequestException);
    });
  });

  // ─── verifySignupCode ────────────────────────────────────────────────────

  describe('verifySignupCode()', () => {
    const validUser = makeUser({
      emailVerificationRequired: true,
      emailVerificationCodeHash: 'hashed-code',
      emailVerificationExpiresAt: new Date(Date.now() + 60_000),
    } as Partial<User>);

    beforeEach(() => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      userRepo.findOne.mockResolvedValue(validUser);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);
      userRepo.save.mockResolvedValue(validUser);
      staffRepo.findOne.mockResolvedValue(null);
      userSessions.createSession.mockResolvedValue({ id: 'session-2' });
      jwtService.signAsync.mockResolvedValue('verified-token');
    });

    it('throws BadRequestException for invalid code format', async () => {
      await expect(
        service.verifySignupCode({ clientKey: 'test-co', email: 'admin@test.com', code: '12345' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when code is expired', async () => {
      userRepo.findOne.mockResolvedValue(
        makeUser({
          emailVerificationRequired: true,
          emailVerificationCodeHash: 'hashed',
          emailVerificationExpiresAt: new Date(Date.now() - 1000),
        } as Partial<User>),
      );
      await expect(
        service.verifySignupCode({ clientKey: 'test-co', email: 'admin@test.com', code: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when code is wrong', async () => {
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.verifySignupCode({ clientKey: 'test-co', email: 'admin@test.com', code: '999999' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns accessToken on valid code', async () => {
      const result = await service.verifySignupCode({
        clientKey: 'test-co',
        email: 'admin@test.com',
        code: '123456',
      });
      expect(result.accessToken).toBe('verified-token');
    });
  });
});
