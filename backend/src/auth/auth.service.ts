// backend/src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
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
  ) {}

  // ========= ЛОГИН =========
  async login(dto: LoginDto) {
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

    // 6) JWT
    const payload = {
      sub: user.id,
      tenantId: tenant.id,
      role: user.role,
      email: user.email,
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
      },
    };
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

    const tenant = this.tenantRepo.create({
      clientKey: normalizedClientKey,
      name: dto.companyName.trim(),
      status: 'active',
      plan: 'free_locked',
      ownerEmail: normalizedEmail,
      ownerName: dto.companyName.trim(),
      uiLanguage: 'ru',
      apiEnabled: true,
      activeUntil: null,
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

  async verifySignupCode(params: {
    clientKey: string;
    email: string;
    code: string;
  }) {
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
    await this.userRepo.save(user);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      tenantId: tenant.id,
      role: user.role,
      email: user.email,
    });

    return {
      accessToken,
      clientKey: tenant.clientKey,
      tenantId: tenant.id,
      tenantPlan: normalizeTenantPlan(tenant.plan),
      billingLocked: true,
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
      },
    };
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
    const html = `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 10px;background:linear-gradient(180deg,#f8fafc 0%,#e2e8f0 100%);">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:26px;overflow:hidden;box-shadow:0 20px 60px rgba(15,23,42,0.18);">
            <tr>
              <td style="padding:0;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:radial-gradient(circle at top left,#22d3ee 0%,#0f172a 60%,#020617 100%);">
                  <tr>
                    <td style="padding:34px 28px 26px;">
                      <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.28);font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#e2e8f0;">
                        Lumiva CRM
                      </div>
                      <div style="font-size:28px;line-height:1.15;font-weight:700;color:#ffffff;padding-top:14px;">
                        Подтверждение регистрации
                      </div>
                      <div style="font-size:14px;line-height:1.65;color:#cbd5e1;padding-top:10px;max-width:460px;">
                        Компания <strong style="color:#ffffff;">${companyName}</strong> почти готова к запуску. Введите код ниже, чтобы подтвердить email и перейти к оплате доступа.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 22px 24px;background:#ffffff;">
                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:20px;background:linear-gradient(135deg,#ffffff 0%,#f8fafc 100%);">
                  <tr>
                    <td align="center" style="padding:22px 14px 18px;">
                      <div style="font-size:12px;color:#64748b;letter-spacing:0.12em;text-transform:uppercase;padding-bottom:10px;">
                        Ваш код входа
                      </div>
                      <div style="display:inline-block;padding:12px 16px;border-radius:14px;background:#0f172a;border:1px solid #1e293b;color:#67e8f9;font-size:32px;line-height:1;font-weight:800;letter-spacing:0.35em;">
                        ${code}
                      </div>
                      <div style="font-size:13px;line-height:1.6;color:#475569;padding-top:14px;">
                        Код действует <strong>15 минут</strong>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 26px 28px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
                  <tr>
                    <td style="font-size:12px;line-height:1.7;color:#64748b;">
                      Если вы не создавали аккаунт в Lumiva CRM, просто проигнорируйте это письмо.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;">
            <tr>
              <td align="center" style="padding-top:14px;font-size:11px;color:#64748b;">
                © ${new Date().getFullYear()} Lumiva CRM
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    await this.mailService.sendMail({ to, subject, html });
  }
}
