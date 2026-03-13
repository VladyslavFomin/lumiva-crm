// backend/src/staff/staff-users.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StaffUser, StaffRole } from './staff-user.entity';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { TenantLogsService } from '../tenants/tenant-logs.service';

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

    private readonly mail: MailService,
    private readonly tenantLogs: TenantLogsService,
  ) {}

  listForTenant(tenantId: string) {
    return this.repo.find({
      where: { tenantId },
      relations: ['departmentEntity'],
      order: { fullName: 'ASC' },
    });
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

    return this.repo.save(entity);
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

    // Обновляем departmentId отдельно, если он передан
    if ('departmentId' in patch) {
      user.departmentId = patch.departmentId ?? null;
    }

    Object.assign(user, patch);
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

    return saved;
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
    }

    return staff;
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

    return staff;
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
      // при желании можно удалить:
      // await this.userRepo.remove(user);
    }

    await this.repo.remove(staff);
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
