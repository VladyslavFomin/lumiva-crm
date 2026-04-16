import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { UpdateMeDto } from './dto/update-me.dto';
import {
  extractRelativePathFromPublicUrl,
  unlinkUploadsRelative,
} from '../common/uploads-root.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  // ==============================
  // БАЗОВЫЕ МЕТОДЫ
  // ==============================

  async findAll(): Promise<User[]> {
    return this.usersRepo.find();
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  /** Ответ API без секретов. */
  toMePublic(user: User) {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      lastActiveAt: user.lastActiveAt
        ? user.lastActiveAt instanceof Date
          ? user.lastActiveAt.toISOString()
          : new Date(user.lastActiveAt as any).toISOString()
        : null,
      createdAt:
        user.createdAt instanceof Date
          ? user.createdAt.toISOString()
          : new Date((user as any).createdAt).toISOString(),
      updatedAt:
        user.updatedAt instanceof Date
          ? user.updatedAt.toISOString()
          : new Date((user as any).updatedAt).toISOString(),
    };
  }

  async getMePublic(userId: string) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.toMePublic(user);
  }

  async findByEmailInTenant(
    tenantId: string,
    email: string,
  ): Promise<User | null> {
    return this.usersRepo.findOne({
      where: { tenantId, email },
    });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.usersRepo.create({
      tenantId: data.tenantId!,
      email: data.email!,
      password: data.password ?? null,
      name: data.name ?? null,
      phone: data.phone ?? null,
      avatarUrl: data.avatarUrl ?? null,
      role: data.role ?? 'user',
      status: data.status ?? 'active',
      lastActiveAt: data.lastActiveAt ?? null,
    });

    return this.usersRepo.save(user);
  }

  async findAllByTenant(tenantId: string): Promise<User[]> {
    return this.usersRepo.find({ where: { tenantId } });
  }

  // ==============================
  // ПРОФИЛЬ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
  // ==============================

  async updateMe(userId: string, dto: UpdateMeDto) {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.name !== undefined) {
      user.name = dto.name;
    }

    if (dto.phone !== undefined) {
      user.phone = dto.phone;
    }

    if (dto.avatarUrl !== undefined) {
      user.avatarUrl = dto.avatarUrl;
    }

    const saved = await this.usersRepo.save(user);
    return this.toMePublic(saved);
  }

  async setAvatarFromFile(
    userId: string,
    tenantId: string,
    file: { path: string; filename: string },
  ) {
    const user = await this.usersRepo.findOne({ where: { id: userId, tenantId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const newRelPath = `users/${tenantId}/${userId}/${file.filename}`;
    const oldRel = user.avatarUrl
      ? extractRelativePathFromPublicUrl(user.avatarUrl)
      : null;
    if (oldRel && oldRel !== newRelPath) {
      await unlinkUploadsRelative(oldRel).catch(() => {});
    }
    user.avatarUrl = `/v1/uploads/${newRelPath}`;
    const saved = await this.usersRepo.save(user);
    return this.toMePublic(saved);
  }

  async updatePassword(
    userId: string,
    oldPass: string,
    newPass: string,
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException('У пользователя нет пароля');
    }

    const ok = await bcrypt.compare(oldPass, user.password);
    if (!ok) {
      throw new BadRequestException('Текущий пароль неверный');
    }

    user.password = await bcrypt.hash(newPass, 10);

    return this.usersRepo.save(user);
  }

  async touchLastActive(userId: string): Promise<void> {
    await this.usersRepo.update(
      { id: userId },
      { lastActiveAt: new Date() },
    );
  }

  // ==============================
  // АДМИН: ДЕЙСТВИЯ ВЛАДЕЛЬЦА (owner)
  // ==============================

  /**
   * Список сотрудников для tenant (для owner).
   */
  async adminListUsers(tenantId: string): Promise<User[]> {
    return this.usersRepo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Создать или обновить сотрудника, выдать/сбросить пароль.
   * Возвращаем email + новый пароль (plain) для передачи сотруднику.
   */
  async adminProvisionUser(params: {
    tenantId: string;
    email: string;
    name?: string;
    role?: string;
  }): Promise<{ user: User; passwordPlain: string }> {
    const { tenantId, email, name, role } = params;

    let user = await this.findByEmailInTenant(tenantId, email);

    // генерим простой пароль (можно усложнить)
    const passwordPlain =
      Math.random().toString(36).slice(-8) + '1a'; // типа "k3qp9s2a1a"
    const passwordHash = await bcrypt.hash(passwordPlain, 10);

    if (!user) {
      user = this.usersRepo.create({
        tenantId,
        email,
        name: name ?? null,
        role: role ?? 'manager',
        status: 'active',
        password: passwordHash,
      });
    } else {
      user.name = name ?? user.name;
      user.role = role ?? user.role;
      user.status = 'active';
      user.password = passwordHash;
    }

    const saved = await this.usersRepo.save(user);
    return { user: saved, passwordPlain };
  }

  /**
   * Обновить роль сотрудника (owner только в своём tenant).
   */
  async adminUpdateRole(params: {
    tenantId: string;
    targetUserId: string;
    newRole: string;
    actingUserId: string;
  }): Promise<User> {
    const { tenantId, targetUserId, newRole, actingUserId } = params;

    const user = await this.findById(targetUserId);
    if (!user || user.tenantId !== tenantId) {
      throw new NotFoundException('User not found');
    }

    if (user.id === actingUserId) {
      throw new ForbiddenException('Нельзя менять свою собственную роль');
    }

    user.role = newRole;
    return this.usersRepo.save(user);
  }

  /**
   * Активировать/деактивировать сотрудника.
   */
  async adminSetStatus(params: {
    tenantId: string;
    targetUserId: string;
    status: 'active' | 'inactive';
    actingUserId: string;
  }): Promise<User> {
    const { tenantId, targetUserId, status, actingUserId } = params;

    const user = await this.findById(targetUserId);
    if (!user || user.tenantId !== tenantId) {
      throw new NotFoundException('User not found');
    }

    if (user.id === actingUserId) {
      throw new ForbiddenException(
        'Нельзя деактивировать самого себя',
      );
    }

    user.status = status;
    return this.usersRepo.save(user);
  }

  /**
   * Удалить сотрудника (по желанию).
   */
  async adminDeleteUser(params: {
    tenantId: string;
    targetUserId: string;
    actingUserId: string;
  }): Promise<void> {
    const { tenantId, targetUserId, actingUserId } = params;

    const user = await this.findById(targetUserId);
    if (!user || user.tenantId !== tenantId) {
      throw new NotFoundException('User not found');
    }

    if (user.id === actingUserId) {
      throw new ForbiddenException(
        'Нельзя удалить своего текущего пользователя',
      );
    }

    await this.usersRepo.remove(user);
  }
}