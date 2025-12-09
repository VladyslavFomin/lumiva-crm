// backend/src/staff/staff-users.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StaffUser, StaffRole } from './staff-user.entity';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';


interface CreateStaffInput {
  email: string;
  fullName: string;
  department?: string | null;
  role: StaffRole;
  avatarUrl?: string | null;
  externalId?: string | null; // связь с users.id (если нужно)
}

@Injectable()
export class StaffUsersService {
  constructor(
    @InjectRepository(StaffUser)
    private readonly repo: Repository<StaffUser>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly mail: MailService,
  ) {}

  listForTenant(tenantId: string) {
    return this.repo.find({
      where: { tenantId },
      order: { fullName: 'ASC' },
    });
  }

  async getOneForTenant(tenantId: string, id: string) {
    const user = await this.repo.findOne({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('Staff user not found');
    return user;
  }

  async createForTenant(tenantId: string, data: CreateStaffInput) {
    const entity = this.repo.create({
      tenantId,
      email: data.email,
      fullName: data.fullName,
      department: data.department ?? null,
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
    patch: Partial<StaffUser>,
  ) {
    const user = await this.getOneForTenant(tenantId, id);

    // нельзя поменять роль владельца на кого-то другого
    if (user.role === 'owner' && patch.role && patch.role !== 'owner') {
      throw new BadRequestException('Нельзя менять роль владельца');
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

    let staff = await this.repo.findOne({
      where: { tenantId, email },
    });

    if (!staff) {
      staff = this.repo.create({
        tenantId,
        email,
        fullName,
        department: null,
        role: 'owner',
        avatarUrl: null,
        inviteStatus: 'invited',
        externalId: null,
        isActive: true,
      });
    }

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 48); // 48 часов

    staff.passwordResetToken = token;
    staff.passwordResetTokenExpiresAt = expires;
    staff.inviteStatus = 'invited';
    staff.isActive = true;

    await this.repo.save(staff);

    const baseUrl =
      process.env.PASSWORD_RESET_URL ||
      'https://crm.lumiva.agency/set-password';
    const link = `${baseUrl}?token=${encodeURIComponent(token)}`;

    await this.mail.sendOwnerInviteEmail({
      to: email,
      fullName,
      tenantName,
      link,
    });

    return { ok: true };
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