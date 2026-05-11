// backend/src/staff/staff-users.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StaffUser, StaffRole } from './staff-user.entity';
import { User } from '../users/user.entity';
import { Tenant } from '../tenants/tenant.entity';
import { MailService } from '../mail/mail.service';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { TenantLogsService } from '../tenants/tenant-logs.service';
import { UserSessionsService } from '../auth/user-sessions.service';

const RESET_TTL_MS = 1000 * 60 * 60 * 48; // 48h
const RESET_PRUNE_AFTER_DAYS = 7;


interface CreateStaffInput {
  email: string;
  fullName: string;
  department?: string | null;
  departmentId?: string | null;
  role: StaffRole;
  avatarUrl?: string | null;
  externalId?: string | null; // связь с users.id (если нужно)
}

@Injectable()
export class StaffUsersService implements OnModuleInit, OnModuleDestroy {
  private pruneTimer?: NodeJS.Timeout;
  constructor(
    @InjectRepository(StaffUser)
    private readonly repo: Repository<StaffUser>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    private readonly mail: MailService,
    private readonly tenantLogs: TenantLogsService,

    private readonly userSessions: UserSessionsService,
  ) {}

  /** Убираем чувствительные поля из ответов API. */
  toPublicStaff(row: StaffUser): StaffUser {
    const copy = { ...(row as unknown as Record<string, unknown>) };
    delete copy.passwordResetToken;
    delete copy.passwordResetTokenExpiresAt;
    return copy as unknown as StaffUser;
  }

  async listForTenant(tenantId: string) {
    const rows = await this.repo.find({
      where: { tenantId },
      relations: ['departmentEntity'],
      order: { fullName: 'ASC' },
    });
    return rows.map((r) => this.toPublicStaff(r));
  }

  async resolveNotificationUserIdsForTenant(
    tenantId: string,
    staffIds?: string[],
  ): Promise<string[]> {
    const selectedIds = Array.isArray(staffIds)
      ? [...new Set(staffIds.map((id) => String(id || '').trim()).filter(Boolean))]
      : [];
    const hasSelectedIds = selectedIds.length > 0;

    const staffQb = this.repo
      .createQueryBuilder('staff')
      .where('staff.tenantId = :tenantId', { tenantId })
      .andWhere('staff.isActive != false');

    if (hasSelectedIds) {
      staffQb.andWhere('staff.id IN (:...selectedIds)', { selectedIds });
    }

    const staffRows = await staffQb.getMany();
    const externalIds = staffRows
      .map((staff) => staff.externalId?.trim())
      .filter((id): id is string => Boolean(id));
    const emails = staffRows
      .map((staff) => staff.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email));
    const directUserIds = hasSelectedIds ? selectedIds : [];

    const conditions: string[] = [];
    const params: Record<string, unknown> = { tenantId, disabled: 'disabled' };
    const userIds = [...new Set([...externalIds, ...directUserIds])];

    if (userIds.length > 0) {
      conditions.push('appUser.id IN (:...userIds)');
      params.userIds = userIds;
    }
    if (emails.length > 0) {
      conditions.push('LOWER(appUser.email) IN (:...emails)');
      params.emails = [...new Set(emails)];
    }

    const userQb = this.userRepo
      .createQueryBuilder('appUser')
      .select(['appUser.id'])
      .where('appUser.tenantId = :tenantId', { tenantId })
      .andWhere('appUser.status != :disabled', { disabled: 'disabled' });

    if (conditions.length > 0) {
      userQb.andWhere(`(${conditions.join(' OR ')})`, params);
    } else if (hasSelectedIds) {
      return [];
    }

    const users = await userQb.getMany();
    return [...new Set(users.map((user) => user.id))];
  }

  onModuleInit() {
    // периодическая очистка токенов (раз в 12 часов)
    this.pruneTimer = setInterval(() => {
      this.pruneExpiredTokens().catch((err) =>
        console.error('pruneExpiredTokens error', err),
      );
    }, 1000 * 60 * 60 * 12);
  }

  onModuleDestroy() {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
    }
  }

  async getOneForTenant(tenantId: string, id: string) {
    const user = await this.repo.findOne({
      where: { id, tenantId },
      relations: ['departmentEntity'],
    });
    if (!user) throw new NotFoundException('Staff user not found');
    return user;
  }

  async createForTenant(tenantId: string, data: CreateStaffInput) {
    const entity = this.repo.create({
      tenantId,
      email: data.email,
      fullName: data.fullName,
      department: data.department ?? null,
      departmentId: data.departmentId ?? null,
      role: data.role,
      avatarUrl: data.avatarUrl ?? null,
      inviteStatus: 'active',
      externalId: data.externalId ?? null,
      isActive: true,
    });

    const saved = await this.repo.save(entity);
    return this.toPublicStaff(saved);
  }

  async updateForTenant(
    tenantId: string,
    id: string,
    patch: Partial<StaffUser & { departmentId?: string | null }>,
  ) {
    const user = await this.getOneForTenant(tenantId, id);

    // нельзя поменять роль владельца на кого-то другого
    if (user.role === 'owner' && patch.role && patch.role !== 'owner') {
      throw new BadRequestException('Нельзя менять роль владельца');
    }

    Object.assign(user, patch);
    // Сбрасываем связь, иначе при save() загруженный departmentEntity может
    // перезаписать department_id старым значением (500 при смене отдела).
    if ('departmentId' in patch) {
      user.departmentId = patch.departmentId ?? null;
      user.departmentEntity = null;
    }
    const saved = await this.repo.save(user);

    // если поменяли роль — синхронизируем с таблицей users
    if (patch.role) {
      const linkedUser = await this.userRepo.findOne({
        where: { tenantId, email: user.email },
      });
      if (linkedUser) {
        linkedUser.role = patch.role;
        await this.userRepo.save(linkedUser);
      }
    }

    return this.toPublicStaff(saved);
  }

  async updateRoleForTenant(tenantId: string, id: string, role: StaffRole) {
    return this.updateForTenant(tenantId, id, { role });
  }

  async updateDepartmentForTenant(
    tenantId: string,
    id: string,
    department: string | null,
  ) {
    return this.updateForTenant(tenantId, id, { department });
  }

  async updateDepartmentIdForTenant(
    tenantId: string,
    id: string,
    departmentId: string | null,
  ) {
    return this.updateForTenant(tenantId, id, { departmentId });
  }

  async deactivateForTenant(tenantId: string, id: string) {
    const staff = await this.getOneForTenant(tenantId, id);

    if (staff.role === 'owner') {
      throw new BadRequestException('Владельца нельзя отключить');
    }

    staff.isActive = false;
    staff.inviteStatus = 'disabled';
    await this.repo.save(staff);

    const user = await this.userRepo.findOne({
      where: { tenantId, email: staff.email },
    });

    if (user) {
      user.status = 'disabled';
      await this.userRepo.save(user);
      await this.userSessions.revokeAllForUser(tenantId, user.id);
    }

    return this.toPublicStaff(staff);
  }

  async activateForTenant(tenantId: string, id: string) {
    const staff = await this.getOneForTenant(tenantId, id);

    staff.isActive = true;
    staff.inviteStatus = 'active';
    await this.repo.save(staff);

    const user = await this.userRepo.findOne({
      where: { tenantId, email: staff.email },
    });

    if (user) {
      user.status = 'active';
      await this.userRepo.save(user);
    }

    return this.toPublicStaff(staff);
  }

  async deleteForTenant(tenantId: string, id: string) {
    const staff = await this.getOneForTenant(tenantId, id);

    if (staff.role === 'owner') {
      throw new BadRequestException('Владельца нельзя удалить');
    }

    const user = await this.userRepo.findOne({
      where: { tenantId, email: staff.email },
    });

    if (user) {
      user.status = 'disabled';
      await this.userRepo.save(user);
      await this.userSessions.revokeAllForUser(tenantId, user.id);
      // при желании можно удалить:
      // await this.userRepo.remove(user);
    }

    await this.repo.remove(staff);
  }

  private assertOwnerForInvites(actorRole: string | undefined) {
    if ((actorRole || '').toLowerCase() !== 'owner') {
      throw new ForbiddenException(
        'Отправлять приглашения может только владелец компании',
      );
    }
  }

  private buildSetPasswordLink(token: string): string {
    const baseUrl =
      process.env.PASSWORD_RESET_URL ||
      'https://crm.lumiva.agency/set-password';
    return `${baseUrl}?token=${encodeURIComponent(token)}`;
  }

  private loginPageUrl(): string {
    const frontendBase = (
      process.env.FRONTEND_URL || 'https://crm.lumiva.agency'
    ).replace(/\/$/, '');
    return `${frontendBase}/login`;
  }

  /**
   * Приглашение сотрудника: запись staff_users, токен, письмо со ссылкой на установку пароля.
   */
  async inviteStaffMember(
    tenantId: string,
    actorRole: string | undefined,
    dto: {
      email: string;
      fullName: string;
      role: StaffRole;
      departmentId?: string | null;
    },
  ): Promise<StaffUser> {
    this.assertOwnerForInvites(actorRole);

    const email = dto.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Укажите корректный email');
    }

    if (dto.role === 'owner') {
      throw new BadRequestException(
        'Через эту форму нельзя пригласить владельца компании',
      );
    }

    const fullName = (dto.fullName || email).trim().slice(0, 190);

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const tenantName = tenant?.name;

    const existingUser = await this.userRepo.findOne({
      where: { tenantId, email },
    });
    if (existingUser?.password) {
      throw new BadRequestException(
        'Этот email уже зарегистрирован в вашей компании',
      );
    }

    let staff = await this.repo.findOne({ where: { tenantId, email } });

    if (staff?.role === 'owner') {
      throw new BadRequestException('Нельзя отправить приглашение владельцу');
    }

    if (!staff) {
      staff = this.repo.create({
        tenantId,
        email,
        fullName,
        department: null,
        departmentId: dto.departmentId ?? null,
        role: dto.role,
        avatarUrl: null,
        phone: null,
        inviteStatus: 'invited',
        externalId: null,
        isActive: true,
      });
    } else {
      staff.fullName = fullName || staff.fullName;
      staff.role = dto.role;
      if (dto.departmentId !== undefined) {
        staff.departmentId = dto.departmentId;
      }
      staff.isActive = true;
    }

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + RESET_TTL_MS);
    staff.passwordResetToken = token;
    staff.passwordResetTokenExpiresAt = expires;
    staff.inviteStatus = 'invited';

    const saved = await this.repo.save(staff);

    await this.mail.sendTeamInviteEmail({
      to: email,
      fullName: saved.fullName || email,
      tenantName,
      link: this.buildSetPasswordLink(token),
      loginUrl: this.loginPageUrl(),
    });

    if (this.tenantLogs) {
      await this.tenantLogs.record({
        tenantId,
        type: 'staff_invite_sent',
        statusCode: 200,
        method: 'STAFF',
        path: '/staff-users/invite',
        message: `Invite sent to ${email}`,
        meta: { email, role: dto.role, staffId: saved.id },
      });
    }

    return this.toPublicStaff(saved);
  }

  async resendStaffInvite(
    tenantId: string,
    actorRole: string | undefined,
    staffId: string,
  ): Promise<StaffUser> {
    this.assertOwnerForInvites(actorRole);

    const staff = await this.getOneForTenant(tenantId, staffId);
    if (staff.role === 'owner') {
      throw new BadRequestException(
        'Нельзя переотправить приглашение владельцу',
      );
    }

    const existingUser = await this.userRepo.findOne({
      where: { tenantId, email: staff.email },
    });
    if (existingUser?.password) {
      throw new BadRequestException(
        'Пользователь уже принял приглашение и задал пароль',
      );
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + RESET_TTL_MS);
    staff.passwordResetToken = token;
    staff.passwordResetTokenExpiresAt = expires;
    staff.inviteStatus = 'invited';

    const saved = await this.repo.save(staff);

    await this.mail.sendTeamInviteEmail({
      to: staff.email,
      fullName: saved.fullName || staff.email,
      tenantName: tenant?.name,
      link: this.buildSetPasswordLink(token),
      loginUrl: this.loginPageUrl(),
    });

    if (this.tenantLogs) {
      await this.tenantLogs.record({
        tenantId,
        type: 'staff_invite_resent',
        statusCode: 200,
        method: 'STAFF',
        path: '/staff-users/resend-invite',
        message: `Invite resent to ${staff.email}`,
        meta: { staffId },
      });
    }

    return this.toPublicStaff(saved);
  }

  /**
   * ===== Инвайт владельца тенанта (owner) =====
   * Создаёт/обновляет токен и отправляет письмо со ссылкой "Задать пароль".
   */
  async sendOwnerInviteForTenant(params: {
    tenantId: string;
    email: string;
    fullName: string;
    tenantName?: string;
  }) {
    const { tenantId, email, fullName, tenantName } = params;
    const { link } = await this.issuePasswordResetToken({
      tenantId,
      email,
      fullName,
      sendEmail: true,
      tenantName,
    });
    return { ok: true, link };
  }

  /**
   * Завершение установки пароля по токену приглашения/сброса.
   * 1) находим staff_users по токену
   * 2) проверяем срок действия
   * 3) создаём/обновляем User
   * 4) пишем bcrypt-хеш пароля
   * 5) очищаем токен
   */
  async completePasswordResetWithToken(
    token: string,
    newPassword: string,
  ): Promise<void> {
    const staff = await this.repo.findOne({
      where: { passwordResetToken: token },
    });

    if (!staff) {
      throw new BadRequestException('Invalid or expired token');
    }

    if (
      !staff.passwordResetTokenExpiresAt ||
      staff.passwordResetTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Token expired');
    }

    // ищем пользователя в users по tenantId + email
    let user = await this.userRepo.findOne({
      where: {
        tenantId: staff.tenantId,
        email: staff.email,
      },
    });

    const passwordHash = await bcrypt.hash(newPassword, 10);

    if (!user) {
      // создаём нового User
      user = this.userRepo.create({
        tenantId: staff.tenantId,
        email: staff.email,
        name: staff.fullName,
        role: staff.role,
        status: 'active',
        password: passwordHash,
      });
    } else {
      // обновляем существующего
      user.password = passwordHash;
      user.status = 'active';
      // если вдруг роль пустая — можно подтянуть роль из staff
      if (!user.role && staff.role) {
        user.role = staff.role;
      }
    }

    await this.userRepo.save(user);

    // чистим токен и активируем инвайт
    staff.passwordResetToken = null;
    staff.passwordResetTokenExpiresAt = null;
    staff.inviteStatus = 'active';
    staff.isActive = true;

    await this.repo.save(staff);
  }

  /**
   * Создаёт/обновляет токен сброса пароля для указанного email и (опционально) отправляет письмо.
   */
  async issuePasswordResetToken(params: {
    tenantId: string;
    email: string;
    fullName?: string;
    tenantName?: string;
    sendEmail?: boolean;
    sendTo?: string;
    emailTemplate?: 'owner-invite' | 'reset';
    actor?: { source: string; userId?: string; email?: string };
  }): Promise<{ link: string; expiresAt: Date }> {
    const {
      tenantId,
      email,
      fullName,
      tenantName,
      sendEmail = false,
      sendTo,
      emailTemplate = 'owner-invite',
    } = params;

    let staff = await this.repo.findOne({
      where: { tenantId, email },
    });

    if (!staff) {
      staff = this.repo.create({
        tenantId,
        email,
        fullName: fullName ?? email,
        department: null,
        role: 'owner',
        avatarUrl: null,
        inviteStatus: 'invited',
        externalId: null,
        isActive: true,
      });
    } else if (fullName) {
      staff.fullName = fullName;
    }

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + RESET_TTL_MS); // 48 часов

    staff.passwordResetToken = token;
    staff.passwordResetTokenExpiresAt = expires;
    staff.inviteStatus = 'invited';
    staff.isActive = true;

    await this.repo.save(staff);

    const baseUrl =
      process.env.PASSWORD_RESET_URL ||
      'https://crm.lumiva.agency/set-password';
    const link = `${baseUrl}?token=${encodeURIComponent(token)}`;

    if (sendEmail) {
      await this.mail.sendOwnerInviteEmail({
        to: sendTo || email,
        fullName: staff.fullName || email,
        tenantName,
        link,
      });
    }

    // аудит лог
    if (this.tenantLogs) {
      await this.tenantLogs.record({
        tenantId: staff.tenantId,
        type: 'password_reset_token_issued',
        statusCode: 200,
        method: 'SYSTEM',
        path: `sendEmail=${sendEmail ? 'yes' : 'no'}`,
        message: `Token issued for ${email}`,
        meta: {
          sendEmail,
          to: sendTo || email,
          actor: params.actor,
          expiresAt: expires.toISOString(),
        },
      });
    }

    return { link, expiresAt: expires };
  }

  /**
   * Очистить просроченные токены.
   */
  async pruneExpiredTokens() {
    await this.repo
      .createQueryBuilder()
      .update(StaffUser)
      .set({ passwordResetToken: null, passwordResetTokenExpiresAt: null })
      .where('password_reset_token_expires_at < :now', { now: new Date() })
      .execute();
  }
    /**
   * Установка пароля по токену (инвайт/сброс).
   * Используется password.controller.ts
   */
  async setPasswordByToken(token: string, newPassword: string): Promise<void> {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Пароль должен быть не короче 8 символов');
    }

    const staff = await this.repo.findOne({
      where: { passwordResetToken: token },
    });

    if (!staff) {
      throw new BadRequestException('Invalid or expired token');
    }

    if (
      !staff.passwordResetTokenExpiresAt ||
      staff.passwordResetTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Token expired');
    }

    // ищем или создаём пользователя в таблице users
    let user = await this.userRepo.findOne({
      where: {
        tenantId: staff.tenantId,
        email: staff.email,
      },
    });

    if (!user) {
      user = this.userRepo.create({
        tenantId: staff.tenantId,
        email: staff.email,
        password: null,
        name: staff.fullName,
        role: staff.role,
        status: 'active',
        phone: staff.phone ?? null,
        avatarUrl: staff.avatarUrl ?? null,
      });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    user.password = hash;
    user.role = staff.role;
    user.status = 'active';

    await this.userRepo.save(user);

    staff.passwordResetToken = null;
    staff.passwordResetTokenExpiresAt = null;
    staff.inviteStatus = 'active';

    await this.repo.save(staff);
  }
}
