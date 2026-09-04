import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/user.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { Tenant } from '../tenants/tenant.entity';
import { InAppNotification } from '../notifications/in-app-notification.entity';
import { AuthService } from '../auth/auth.service';
import { UserSessionsService } from '../auth/user-sessions.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ApiTokensService } from '../api-tokens/api-tokens.service';
import { MailService } from '../mail/mail.service';
import { renderMailShell } from '../mail/mail-template.util';
import {
  buildOtpAuthQrDataUrl,
  buildOtpAuthUrl,
  generateBackupCodes,
  generateTotpSecret,
  normalizeBackupCode,
  verifyTotpCode,
} from '../auth/totp.util';

const DEFAULT_NOTIFICATION_PREFS: Record<string, boolean> = {
  newLead: true,
  telegramHandoff: true,
  mentions: true,
  dailyDigest: false,
  aiReports: true,
  newDeviceLogin: true,
};

function parseUserAgent(ua: string | null): { os: string; browser: string } {
  const s = (ua || '').toLowerCase();
  let os = 'Неизвестно';
  if (s.includes('windows')) os = 'Windows';
  else if (s.includes('mac os') || s.includes('macintosh')) os = 'macOS';
  else if (s.includes('android')) os = 'Android';
  else if (s.includes('iphone') || s.includes('ipad') || s.includes('ios')) os = 'iOS';
  else if (s.includes('linux')) os = 'Linux';

  let browser = 'Браузер';
  if (s.includes('edg/')) browser = 'Edge';
  else if (s.includes('opr/') || s.includes('opera')) browser = 'Opera';
  else if (s.includes('chrome/')) browser = 'Chrome';
  else if (s.includes('firefox/')) browser = 'Firefox';
  else if (s.includes('safari/')) browser = 'Safari';

  return { os, browser };
}

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(StaffUser) private readonly staffRepo: Repository<StaffUser>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(InAppNotification) private readonly notifRepo: Repository<InAppNotification>,
    private readonly authService: AuthService,
    private readonly userSessions: UserSessionsService,
    private readonly auditLog: AuditLogService,
    private readonly apiTokens: ApiTokensService,
    private readonly mail: MailService,
  ) {}

  private async requireUser(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private prefs(user: User): Record<string, any> {
    return { ...user.preferences };
  }

  notificationPrefsOf(user: User): Record<string, boolean> {
    return { ...DEFAULT_NOTIFICATION_PREFS, ...(user.preferences?.notifications || {}) };
  }

  private async log(tenantId: string, userId: string, userName: string | null, summary: string) {
    await this.auditLog.log({
      tenantId,
      entityType: 'user_security',
      entityId: userId,
      entityLabel: userName,
      action: 'update',
      summary,
      actorUserId: userId,
      actorName: userName,
    });
  }

  // ============== СЕССИИ ==============

  async listSessions(tenantId: string, userId: string, currentSessionId?: string) {
    const rows = await this.userSessions.listActiveForUser(tenantId, userId);
    return rows.map((r) => {
      const { os, browser } = parseUserAgent(r.userAgent);
      return {
        id: r.id,
        os,
        browser,
        ip: r.ip,
        createdAt: r.createdAt,
        lastSeenAt: r.lastSeenAt,
        isCurrent: r.id === currentSessionId,
      };
    });
  }

  async revokeSession(tenantId: string, userId: string, userName: string | null, sessionId: string) {
    await this.userSessions.revokeOwnSession(tenantId, userId, sessionId);
    await this.log(tenantId, userId, userName, 'Сессия завершена вручную');
    return { ok: true };
  }

  async revokeOtherSessions(tenantId: string, userId: string, userName: string | null, currentSessionId: string) {
    const count = await this.userSessions.revokeAllForUserExceptCurrent(tenantId, userId, currentSessionId);
    await this.log(tenantId, userId, userName, `Завершены все сессии, кроме текущей (${count})`);
    return { ok: true, count };
  }

  // ============== ЖУРНАЛ БЕЗОПАСНОСТИ ==============

  async getSecurityLog(tenantId: string, userId: string, limit = 30) {
    const { items, total } = await this.auditLog.findGlobal(tenantId, {
      entityType: 'user_security',
      entityId: userId,
      limit,
    });
    return {
      items: items.map((i) => ({ id: i.id, summary: i.summary, createdAt: i.createdAt })),
      total,
    };
  }

  // ============== API-КЛЮЧИ (безопасная сводка) ==============

  async getApiTokensSummary(tenantId: string) {
    const tokens = await this.apiTokens.listForTenant(tenantId);
    return tokens.map((t) => ({
      id: t.id,
      name: t.name,
      isActive: t.isActive,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
      lastUsedAt: t.lastUsedAt,
    }));
  }

  // ============== ПРЕДПОЧТЕНИЯ ==============

  async updatePreferences(userId: string, patch: Record<string, any>) {
    const user = await this.requireUser(userId);
    const current = this.prefs(user);
    const merged = { ...current, ...patch };
    if (patch.notifications) {
      merged.notifications = { ...current.notifications, ...patch.notifications };
    }
    user.preferences = merged;
    if (patch.timezone !== undefined) {
      user.timezone = patch.timezone || null;
    }
    await this.userRepo.save(user);
    return { preferences: user.preferences, timezone: user.timezone };
  }

  // ============== 2FA ==============

  async setup2FA(userId: string, email: string) {
    const user = await this.requireUser(userId);
    if (user.twoFactorEnabled) {
      throw new BadRequestException('2FA уже включена');
    }
    const secret = generateTotpSecret();
    user.twoFactorSecret = secret;
    await this.userRepo.save(user);
    const otpAuthUrl = buildOtpAuthUrl(secret, email);
    const qrDataUrl = await buildOtpAuthQrDataUrl(otpAuthUrl);
    return { secret, otpAuthUrl, qrDataUrl };
  }

  async verify2FASetup(tenantId: string, userId: string, userName: string | null, code: string) {
    const user = await this.requireUser(userId);
    if (!user.twoFactorSecret) {
      throw new BadRequestException('Сначала запросите QR-код');
    }
    if (!verifyTotpCode(user.twoFactorSecret, code)) {
      throw new BadRequestException('Неверный код из приложения');
    }
    const backupCodes = generateBackupCodes(10);
    const hashed = await Promise.all(
      backupCodes.map((c) => bcrypt.hash(normalizeBackupCode(c), 10)),
    );
    user.twoFactorEnabled = true;
    user.twoFactorBackupCodes = hashed;
    await this.userRepo.save(user);
    await this.log(tenantId, userId, userName, 'Двухфакторная защита включена');
    return { enabled: true, backupCodes };
  }

  async disable2FA(tenantId: string, userId: string, userName: string | null, password: string) {
    const ok = await this.authService.verifyUserPassword(userId, password);
    if (!ok) throw new BadRequestException('Неверный пароль');
    const user = await this.requireUser(userId);
    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorBackupCodes = null;
    await this.userRepo.save(user);
    await this.log(tenantId, userId, userName, 'Двухфакторная защита выключена');
    return { enabled: false };
  }

  async regenerateBackupCodes(tenantId: string, userId: string, userName: string | null, password: string) {
    const ok = await this.authService.verifyUserPassword(userId, password);
    if (!ok) throw new BadRequestException('Неверный пароль');
    const user = await this.requireUser(userId);
    if (!user.twoFactorEnabled) throw new BadRequestException('2FA не включена');
    const backupCodes = generateBackupCodes(10);
    user.twoFactorBackupCodes = await Promise.all(
      backupCodes.map((c) => bcrypt.hash(normalizeBackupCode(c), 10)),
    );
    await this.userRepo.save(user);
    await this.log(tenantId, userId, userName, 'Резервные коды пересозданы');
    return { backupCodes };
  }

  // ============== ЭКСПОРТ МОИХ ДАННЫХ ==============

  async exportMyData(tenantId: string, userId: string) {
    const user = await this.requireUser(userId);
    const sessions = await this.listSessions(tenantId, userId);
    const tokens = await this.getApiTokensSummary(tenantId);
    const { items: securityLog } = await this.getSecurityLog(tenantId, userId, 100);
    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        timezone: user.timezone,
        createdAt: user.createdAt,
      },
      preferences: user.preferences || {},
      sessions,
      apiTokens: tokens,
      securityLog,
    };
  }

  // ============== ОПАСНАЯ ЗОНА ==============

  async transferOwnership(
    tenantId: string,
    currentUserId: string,
    currentUserName: string | null,
    targetStaffUserId: string,
    password: string,
  ) {
    const ok = await this.authService.verifyUserPassword(currentUserId, password);
    if (!ok) throw new BadRequestException('Неверный пароль');

    const currentUser = await this.requireUser(currentUserId);
    if (currentUser.role !== 'owner') {
      throw new ForbiddenException('Передавать владение может только владелец');
    }

    const targetStaff = await this.staffRepo.findOne({ where: { id: targetStaffUserId, tenantId } });
    if (!targetStaff) throw new NotFoundException('Сотрудник не найден');
    if (targetStaff.role === 'owner') throw new BadRequestException('Этот сотрудник уже владелец');
    if (!targetStaff.isActive) throw new BadRequestException('Нельзя передать владение неактивному сотруднику');

    const targetUser = await this.userRepo.findOne({ where: { tenantId, email: targetStaff.email } });
    if (!targetUser) throw new NotFoundException('У сотрудника нет учётной записи для входа');

    const currentStaff = await this.staffRepo.findOne({ where: { tenantId, email: currentUser.email } });

    // 'manager' — ближайшая валидная роль StaffRole для «был владельцем, теперь не владелец»;
    // отдельного 'admin' в этой ролевой модели нет (owner/manager/viewer/finance/sales/developer/support).
    currentUser.role = 'manager';
    targetUser.role = 'owner';
    await this.userRepo.save([currentUser, targetUser]);

    if (currentStaff) {
      (currentStaff as any).role = 'manager';
      await this.staffRepo.save(currentStaff);
    }
    (targetStaff as any).role = 'owner';
    await this.staffRepo.save(targetStaff);

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (tenant) {
      tenant.ownerEmail = targetUser.email;
      tenant.ownerName = targetUser.name || targetUser.email;
      await this.tenantRepo.save(tenant);
    }

    await this.userSessions.revokeAllForUser(tenantId, currentUserId);

    await this.log(tenantId, currentUserId, currentUserName, `Владение передано пользователю ${targetUser.email}`);
    await this.log(tenantId, targetUser.id, targetUser.name, `Стал(а) владельцем аккаунта (передано от ${currentUser.email})`);

    return { ok: true, newOwnerId: targetUser.id };
  }

  async deleteMyAccount(tenantId: string, userId: string, userName: string | null, password: string) {
    const ok = await this.authService.verifyUserPassword(userId, password);
    if (!ok) throw new BadRequestException('Неверный пароль');

    const user = await this.requireUser(userId);
    if (user.role === 'owner') {
      throw new BadRequestException(
        'Владелец не может удалить свой аккаунт напрямую — сначала передайте владение другому сотруднику в разделе «Опасная зона».',
      );
    }

    user.status = 'disabled';
    await this.userRepo.save(user);

    const staff = await this.staffRepo.findOne({ where: { tenantId, email: user.email } });
    if (staff) {
      staff.isActive = false;
      await this.staffRepo.save(staff);
    }

    await this.userSessions.revokeAllForUser(tenantId, userId);
    await this.log(tenantId, userId, userName, 'Аккаунт удалён (самостоятельно)');

    return { ok: true };
  }

  // ============== УВЕДОМЛЕНИЕ О ВХОДЕ С НОВОГО УСТРОЙСТВА ==============

  async notifyNewDeviceLoginIfNeeded(
    user: User,
    tenantName: string,
    ip: string | null,
    userAgent: string | null,
    isTrulyNewDevice: boolean,
  ) {
    if (!isTrulyNewDevice) return;
    const prefs = this.notificationPrefsOf(user);
    if (!prefs.newDeviceLogin) return;
    if (!user.email) return;

    const { os, browser } = parseUserAgent(userAgent);
    const when = new Date().toLocaleString('ru-RU');
    const html = renderMailShell({
      headline: 'Вход с нового устройства',
      bodyHtml: `<p style="margin:0 0 16px;">В аккаунт <strong>${tenantName}</strong> выполнен вход с устройства, которое мы раньше не видели.</p>
<p style="margin:0 0 16px;color:#71717a;font-size:13px;">${os} · ${browser}${ip ? ` · IP ${ip}` : ''}<br/>${when}</p>
<p style="margin:0;font-size:13px;color:#71717a;">Если это были не вы — смените пароль и завершите все сессии в разделе «Аккаунт → Безопасность».</p>`,
    });
    await this.mail.sendMail({ to: user.email, subject: 'Вход с нового устройства — Lumiva CRM', html });
  }
}
