// backend/src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { LoginDto } from './dto/login.dto';
import { StaffUser } from '../staff/staff-user.entity';
import { SignupDto } from './dto/signup.dto';
import { getTenantBlockReason } from '../tenants/tenant-status.util';
import { TenantLogsService } from '../tenants/tenant-logs.service';
import { StaffUsersService } from '../staff/staff-users.service';
import { buildPlanEntitlements, normalizeTenantPlan } from '../tenants/plan-entitlements';
import { MailService } from '../mail/mail.service';
import { mailCodeBox, renderMailShell } from '../mail/mail-template.util';
import { UserSessionsService } from './user-sessions.service';
import { getClientIp } from '../common/client-ip.util';
import { verifyTotpCode, normalizeBackupCode } from './totp.util';
import type { AutomationsService as AutomationsServiceType } from '../automations/automations.service';
import type { EsignService as EsignServiceType } from '../esign/esign.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,

    private readonly jwtService: JwtService,
    private readonly tenantLogs: TenantLogsService,
    private readonly staffUsers: StaffUsersService,
    private readonly mailService: MailService,

    private readonly userSessions: UserSessionsService,

    private readonly moduleRef: ModuleRef,
  ) {}

  // ========= ЛОГИН =========
  async login(dto: LoginDto, req?: Request) {
    const { clientKey, email, password } = dto;

    // 1) Тенант
    const tenant = await this.tenantRepo.findOne({
      where: { clientKey },
    });

    if (!tenant) {
      throw new UnauthorizedException('Invalid client key or inactive tenant');
    }

    const tenantBlockReason = getTenantBlockReason(tenant);
    if (tenantBlockReason === 'blocked') {
      await this.tenantLogs.record({
        tenantId: tenant.id,
        type: 'login_denied',
        statusCode: 401,
        method: 'POST',
        path: '/auth/login',
        message: `Tenant login denied: ${tenantBlockReason}`,
        meta: {
          clientKey,
          reason: tenantBlockReason,
          activeUntil: tenant.activeUntil,
        },
      });
      throw new UnauthorizedException({
        code: 'TENANT_INACTIVE',
        reason: tenantBlockReason,
        message: 'Тенант заблокирован',
        activeUntil: tenant.activeUntil,
      });
    }

    // 2) Пользователь в users
    const user = await this.userRepo.findOne({
      where: {
        tenantId: tenant.id,
        email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3) Статус пользователя
    if (user.status && user.status !== 'active') {
      throw new UnauthorizedException('User is disabled');
    }

    // 4) Пароль уже должен быть установлен
    if (!user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.emailVerificationRequired) {
      throw new UnauthorizedException({
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Подтвердите email кодом из письма',
      });
    }

    const ok = await bcrypt.compare(password || '', user.password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 5) Проверяем сотрудника в staff_users (если есть)
    const staff = await this.staffRepo.findOne({
      where: {
        tenantId: tenant.id,
        email,
      },
    });

    if (staff && !staff.isActive) {
      throw new UnauthorizedException('User is disabled');
    }

    const clientIp = req ? getClientIp(req) : null;

    // Office-IP allowlist (data-visibility rule 'ip_mode', per role): 'block' rejects the login
    // outright, 'warn' logs to TenantLogsService but still lets the user in. Ленивый import —
    // тот же приём, что и с AutomationsService/EsignService выше, чтобы не тянуть
    // DataVisibilityModule статически в AuthModule.
    try {
      const { DataVisibilityService } = await import('../data-visibility/data-visibility.service.js');
      const dataVisibility = this.moduleRef.get(DataVisibilityService, { strict: false });
      const ipCheck = await dataVisibility.checkIp(tenant.id, user.role as any, clientIp);
      if (!ipCheck.allowed) {
        if (ipCheck.mode === 'block') {
          await this.tenantLogs.record({
            tenantId: tenant.id,
            type: 'login_denied',
            statusCode: 403,
            method: 'POST',
            path: '/auth/login',
            message: `Login blocked: IP ${clientIp ?? 'unknown'} not in office allowlist`,
            meta: { clientKey, email, ip: clientIp },
          });
          throw new UnauthorizedException({
            code: 'IP_NOT_ALLOWED',
            message: 'Вход разрешён только с рабочих IP-адресов',
          });
        }
        if (ipCheck.mode === 'warn') {
          await this.tenantLogs.record({
            tenantId: tenant.id,
            type: 'login_ip_warning',
            statusCode: 200,
            method: 'POST',
            path: '/auth/login',
            message: `Login from outside the office IP allowlist: ${clientIp ?? 'unknown'}`,
            meta: { clientKey, email, ip: clientIp },
          });
        }
      }
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      // best-effort — не блокируем вход, если сам сервис недоступен
    }

    // 6) Двухфакторная защита: пароль верный, но полноценную сессию/JWT не выдаём, пока не
    // подтверждён код — вместо этого выдаём короткоживущий challenge-токен без sid (JwtStrategy
    // отклоняет любой токен без sid, так что challenge-токен физически не может быть использован
    // как рабочий access-токен, даже если утечёт).
    if (user.twoFactorEnabled) {
      const challengeToken = await this.jwtService.signAsync(
        { type: 'twofactor_challenge', sub: user.id, tenantId: tenant.id },
        { expiresIn: '5m' },
      );
      return { twoFactorRequired: true, challengeToken };
    }

    const userAgent =
      req && typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent'].slice(0, 512)
        : null;

    return this.issueAuthResult(user, tenant, staff, tenantBlockReason, clientIp, userAgent);
  }

  /**
   * POST /auth/verify-2fa — второй шаг логина при включённой 2FA. Принимает challenge-токен из
   * login() и либо 6-значный TOTP-код, либо один из резервных кодов (использованный удаляется).
   */
  async verifyTwoFactorLogin(challengeToken: string, code: string, req?: Request) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(challengeToken);
    } catch {
      throw new UnauthorizedException('Код подтверждения истёк, войдите заново');
    }
    if (payload?.type !== 'twofactor_challenge' || !payload?.sub || !payload?.tenantId) {
      throw new UnauthorizedException('Недействительный токен подтверждения');
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub, tenantId: payload.tenantId } });
    const tenant = await this.tenantRepo.findOne({ where: { id: payload.tenantId } });
    if (!user || !tenant || !user.twoFactorEnabled) {
      throw new UnauthorizedException('Недействительный токен подтверждения');
    }

    let usedBackupCode = false;
    const totpOk = user.twoFactorSecret ? verifyTotpCode(user.twoFactorSecret, code) : false;
    if (!totpOk) {
      const normalized = normalizeBackupCode(code);
      const codes = user.twoFactorBackupCodes || [];
      let matchedIndex = -1;
      for (let i = 0; i < codes.length; i++) {
        if (await bcrypt.compare(normalized, codes[i])) {
          matchedIndex = i;
          break;
        }
      }
      if (matchedIndex === -1) {
        throw new UnauthorizedException('Неверный код подтверждения');
      }
      usedBackupCode = true;
      user.twoFactorBackupCodes = codes.filter((_, i) => i !== matchedIndex);
      await this.userRepo.save(user);
    }

    const tenantBlockReason = getTenantBlockReason(tenant);
    const staff = await this.staffRepo.findOne({ where: { tenantId: tenant.id, email: user.email } });
    const clientIp = req ? getClientIp(req) : null;
    const userAgent =
      req && typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent'].slice(0, 512)
        : null;

    const result = await this.issueAuthResult(user, tenant, staff, tenantBlockReason, clientIp, userAgent);
    return { ...result, usedBackupCode };
  }

  /** Создаёт сессию + JWT + формирует ответ логина — общий хвост login()/verifySignupCode()/
   * verifyTwoFactorLogin(), раньше дублировавшийся дважды один-в-один. */
  private async issueAuthResult(
    user: User,
    tenant: Tenant,
    staff: StaffUser | null,
    tenantBlockReason: ReturnType<typeof getTenantBlockReason>,
    clientIp: string | null,
    userAgent: string | null,
  ) {
    const priorSessions = await this.userSessions.listActiveForUser(tenant.id, user.id);
    const isNewDevice =
      priorSessions.length > 0 && !priorSessions.some((s) => (s.userAgent || '') === (userAgent || ''));

    const session = await this.userSessions.createSession(user.id, tenant.id, clientIp, userAgent);

    if (isNewDevice) {
      const prefsAllow = user.preferences?.notifications?.newDeviceLogin !== false;
      if (prefsAllow && user.email) {
        void this.sendNewDeviceLoginEmail(user.email, tenant.name, clientIp, userAgent);
      }
    }

    user.lastActiveAt = new Date();
    await this.userRepo.save(user);

    if (staff) {
      staff.lastLoginAt = new Date();
      await this.staffRepo.save(staff);
    }

    const payload = {
      sub: user.id,
      tenantId: tenant.id,
      role: user.role,
      email: user.email,
      sid: session.id,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    const billingLocked =
      normalizeTenantPlan(tenant.plan) === 'free_locked' ||
      tenantBlockReason === 'expired';

    return {
      accessToken,
      clientKey: tenant.clientKey,
      tenantId: tenant.id,
      tenantPlan: normalizeTenantPlan(tenant.plan),
      billingLocked,
      tenantActiveUntil: tenant.activeUntil,
      tenantTrialEndsAt: tenant.trialEndsAt,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        clientKey: tenant.clientKey,
        plan: normalizeTenantPlan(tenant.plan),
      },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name ?? null,
        phone: user.phone ?? null,
        avatarUrl: user.avatarUrl ?? null,
      },
    };
  }

  /**
   * Проверка пароля пользователя (настройки API, чувствительные действия в UI).
   */
  async verifyUserPassword(userId: string, plainPassword: string): Promise<boolean> {
    const uid = String(userId || '').trim();
    if (!uid) return false;
    const user = await this.userRepo.findOne({ where: { id: uid } });
    if (!user?.password) return false;
    return bcrypt.compare(String(plainPassword ?? ''), user.password);
  }

  async signup(dto: SignupDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedClientKey = dto.clientKey
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!normalizedClientKey || normalizedClientKey.length < 3) {
      throw new BadRequestException(
        'clientKey must be 3-64 chars, lowercase latin, numbers, hyphen',
      );
    }

    const existingTenant = await this.tenantRepo.findOne({
      where: { clientKey: normalizedClientKey },
    });
    if (existingTenant) {
      throw new BadRequestException('clientKey already exists');
    }

    // 14-дневный бесплатный Enterprise-триал: сразу открываем полный тариф вместо free_locked,
    // чтобы новый тенант не встречал "пустой" CRM до участия pl1-админа. activeUntil — тот же
    // механизм, что уже блокирует доступ по истечении оплаченного периода (getTenantBlockReason /
    // billingLocked); trialEndsAt — отдельная метка именно триала для tenant-trial.scheduler.ts
    // (billing.service.ts обнуляет её при настоящей оплате, чтобы шедулер не откатил плательщика).
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const tenant = this.tenantRepo.create({
      clientKey: normalizedClientKey,
      name: dto.companyName.trim(),
      status: 'active',
      plan: 'enterprise',
      ownerEmail: normalizedEmail,
      ownerName: dto.companyName.trim(),
      uiLanguage: 'ru',
      apiEnabled: true,
      activeUntil: trialEndsAt,
      trialEndsAt,
    });
    const entitlements = buildPlanEntitlements({
      plan: tenant.plan,
      enabledModules: tenant.enabledModules,
      enabledComponents: tenant.enabledComponents,
    });
    tenant.plan = entitlements.normalizedPlan;
    tenant.enabledModules = entitlements.enabledModules;
    tenant.enabledComponents = entitlements.enabledComponents;
    await this.tenantRepo.save(tenant);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      tenantId: tenant.id,
      email: normalizedEmail,
      password: passwordHash,
      name: dto.companyName.trim(),
      phone: dto.phone?.trim() || null,
      role: 'owner',
      status: 'active',
      avatarUrl: null,
      lastActiveAt: null,
    });
    await this.userRepo.save(user);

    const staff = this.staffRepo.create({
      tenantId: tenant.id,
      email: normalizedEmail,
      fullName: dto.companyName.trim(),
      department: 'Management',
      departmentId: null,
      role: 'owner',
      phone: dto.phone?.trim() || null,
      avatarUrl: null,
      isActive: true,
      inviteStatus: 'active',
      externalId: user.id,
      passwordResetToken: null,
      passwordResetTokenExpiresAt: null,
      lastLoginAt: null,
    });
    await this.staffRepo.save(staff);

    try {
      // Ленивый import — избегаем статического цикла через automations.service -> integrations.service.
      const { AutomationsService } = await import('../automations/automations.service.js');
      const automationsService = this.moduleRef.get<AutomationsServiceType>(AutomationsService, { strict: false });
      await automationsService.seedDefaultBookingAutomation(tenant.id);
    } catch (error) {
      console.error('Failed to seed default booking automation:', error);
    }

    try {
      const { EsignService } = await import('../esign/esign.service.js');
      const esignService = this.moduleRef.get<EsignServiceType>(EsignService, { strict: false });
      await esignService.seedDefaultTemplates(tenant.id);
    } catch (error) {
      console.error('Failed to seed default esign templates:', error);
    }

    const verificationCode = this.generateVerificationCode();
    user.emailVerificationRequired = true;
    user.emailVerificationCodeHash = await bcrypt.hash(verificationCode, 10);
    user.emailVerificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.userRepo.save(user);

    await this.sendSignupVerificationEmail({
      to: normalizedEmail,
      companyName: dto.companyName.trim(),
      code: verificationCode,
    });

    return {
      verificationRequired: true,
      clientKey: tenant.clientKey,
      email: normalizedEmail,
      expiresAt: user.emailVerificationExpiresAt,
      message: 'На вашу почту отправлен код подтверждения',
    };
  }

  async verifySignupCode(
    params: {
      clientKey: string;
      email: string;
      code: string;
    },
    req?: Request,
  ) {
    const clientKey = params.clientKey.trim().toLowerCase();
    const email = params.email.trim().toLowerCase();
    const code = (params.code || '').trim();

    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('Код должен состоять из 6 цифр');
    }

    const tenant = await this.tenantRepo.findOne({
      where: { clientKey },
    });
    if (!tenant) {
      throw new BadRequestException('Тенант не найден');
    }

    const user = await this.userRepo.findOne({
      where: {
        tenantId: tenant.id,
        email,
      },
    });
    if (!user) {
      throw new BadRequestException('Пользователь не найден');
    }

    if (!user.emailVerificationRequired) {
      throw new BadRequestException('Email уже подтвержден');
    }

    if (!user.emailVerificationCodeHash || !user.emailVerificationExpiresAt) {
      throw new BadRequestException('Код подтверждения не найден');
    }

    if (user.emailVerificationExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Срок действия кода истек');
    }

    const ok = await bcrypt.compare(code, user.emailVerificationCodeHash);
    if (!ok) {
      throw new BadRequestException('Неверный код подтверждения');
    }

    user.emailVerificationRequired = false;
    user.emailVerificationCodeHash = null;
    user.emailVerificationExpiresAt = null;
    user.lastActiveAt = new Date();
    await this.userRepo.save(user);

    const staffRow = await this.staffRepo.findOne({
      where: { tenantId: tenant.id, email: user.email },
    });
    if (staffRow) {
      staffRow.lastLoginAt = new Date();
      await this.staffRepo.save(staffRow);
    }

    // Раньше здесь всегда стоял billingLocked: true — тенант шёл сразу на free_locked, поэтому
    // это было верно. Теперь signup() выдаёт 14-дневный Enterprise-триал, так что нужно считать
    // это так же, как login(), иначе только что подтвердивший email клиент увидит заблюренный
    // CRM и экран оплаты вместо триала.
    const tenantBlockReason = getTenantBlockReason(tenant);
    const clientIp = req ? getClientIp(req) : null;
    const userAgent =
      req && typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent'].slice(0, 512)
        : null;

    return this.issueAuthResult(user, tenant, staffRow, tenantBlockReason, clientIp, userAgent);
  }

  async resendSignupCode(params: { clientKey: string; email: string }) {
    const clientKey = params.clientKey.trim().toLowerCase();
    const email = params.email.trim().toLowerCase();

    const tenant = await this.tenantRepo.findOne({
      where: { clientKey },
    });
    if (!tenant) {
      throw new BadRequestException('Тенант не найден');
    }

    const user = await this.userRepo.findOne({
      where: {
        tenantId: tenant.id,
        email,
      },
    });
    if (!user) {
      throw new BadRequestException('Пользователь не найден');
    }

    if (!user.emailVerificationRequired) {
      throw new BadRequestException('Email уже подтвержден');
    }

    const verificationCode = this.generateVerificationCode();
    user.emailVerificationCodeHash = await bcrypt.hash(verificationCode, 10);
    user.emailVerificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.userRepo.save(user);

    await this.sendSignupVerificationEmail({
      to: email,
      companyName: tenant.name || 'Lumiva CRM',
      code: verificationCode,
    });

    return {
      ok: true,
      message: 'Новый код отправлен на почту',
      expiresAt: user.emailVerificationExpiresAt,
    };
  }

  /**
   * ========= УСТАНОВКА ПАРОЛЯ ПО email + clientKey =========
   * Больше не используется напрямую (оставлено для совместимости)
   */
  async setPasswordForEmailAndClient(
    email: string,
    clientKey: string,
    password: string,
  ) {
    // 1) Находим тенант
    const tenant = await this.tenantRepo.findOne({
      where: { clientKey, status: 'active' },
    });

    if (!tenant) {
      throw new BadRequestException('Тенант не найден или не активен');
    }

    // 2) Ищем пользователя в users
    const existingUser = await this.userRepo.findOne({
      where: {
        tenantId: tenant.id,
        email,
      },
    });

    // --- ВЕТКА 1: пользователь уже есть → просто обновляем пароль ---
    if (existingUser) {
      const hash = await bcrypt.hash(password, 10);
      (existingUser as any).password = hash;
      await this.userRepo.save(existingUser);
      return;
    }

    // --- ВЕТКА 2: пользователя нет → пробуем взять данные из staff_users ---
    const staff = await this.staffRepo.findOne({
      where: {
        tenantId: tenant.id,
        email,
      },
    });

    const hash = await bcrypt.hash(password, 10);

    // базовые поля для нового пользователя
    const baseUser: any = {
      tenantId: tenant.id,
      email,
      fullName: email,
      role: 'owner',
      status: 'active',
      password: hash,
    };

    if (staff) {
      baseUser.email = staff.email;
      baseUser.fullName = staff.fullName;
      baseUser.role = (staff.role as any) || 'owner';
    }

    const newUser = this.userRepo.create(baseUser);
    await this.userRepo.save(newUser);
  }

  /**
   * Публичный запрос на письмо для сброса пароля по clientKey + email.
   * Используем staffUsers.issuePasswordResetToken для отправки.
   */
  async requestPasswordReset(clientKey: string, email: string) {
    const tenant = await this.tenantRepo.findOne({
      where: { clientKey },
    });
    if (!tenant) {
      throw new BadRequestException('Тенант не найден');
    }
    await this.staffUsers.issuePasswordResetToken({
      tenantId: tenant.id,
      email,
      fullName: email,
      tenantName: tenant.name,
      sendEmail: true,
      sendTo: email,
      emailTemplate: 'reset',
      actor: { source: 'public-request', email },
    });
  }

  private async sendNewDeviceLoginEmail(
    to: string,
    tenantName: string,
    ip: string | null,
    userAgent: string | null,
  ): Promise<void> {
    const ua = (userAgent || '').toLowerCase();
    const os = ua.includes('windows')
      ? 'Windows'
      : ua.includes('mac os') || ua.includes('macintosh')
        ? 'macOS'
        : ua.includes('android')
          ? 'Android'
          : ua.includes('iphone') || ua.includes('ipad')
            ? 'iOS'
            : ua.includes('linux')
              ? 'Linux'
              : 'Неизвестное устройство';
    const browser = ua.includes('edg/')
      ? 'Edge'
      : ua.includes('chrome/')
        ? 'Chrome'
        : ua.includes('firefox/')
          ? 'Firefox'
          : ua.includes('safari/')
            ? 'Safari'
            : 'Браузер';
    const when = new Date().toLocaleString('ru-RU');

    const html = renderMailShell({
      headline: 'Вход с нового устройства',
      bodyHtml: `<p style="margin:0 0 16px;">В аккаунт <strong>${tenantName}</strong> выполнен вход с устройства, которое мы раньше не видели.</p>
<p style="margin:0 0 16px;color:#71717a;font-size:13px;">${os} · ${browser}${ip ? ` · IP ${ip}` : ''}<br/>${when}</p>
<p style="margin:0;font-size:13px;color:#71717a;">Если это были не вы — смените пароль и завершите все сессии в разделе «Аккаунт → Безопасность».</p>`,
    });

    await this.mailService.sendMail({ to, subject: 'Вход с нового устройства — Lumiva CRM', html });
  }

  private generateVerificationCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private async sendSignupVerificationEmail(params: {
    to: string;
    companyName: string;
    code: string;
  }) {
    const { to, companyName, code } = params;
    const subject = 'Код подтверждения регистрации Lumiva CRM';
    const html = renderMailShell({
      headline: 'Подтверждение регистрации',
      bodyHtml: `<p style="margin:0 0 16px;">Компания <strong>${companyName}</strong> почти готова к запуску. Введите код ниже, чтобы подтвердить email и перейти к оплате доступа.</p>
${mailCodeBox(code)}
<p style="margin:0;font-size:13px;color:#71717a;">Код действует <strong>15 минут</strong>. Если вы не создавали аккаунт в Lumiva CRM, просто проигнорируйте это письмо.</p>`,
    });

    await this.mailService.sendMail({ to, subject, html });
  }
}
