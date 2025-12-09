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
  ) {}

  // ========= ЛОГИН =========
  async login(dto: LoginDto) {
    const { clientKey, email, password } = dto;

    // 1) Тенант
    const tenant = await this.tenantRepo.findOne({
      where: { clientKey, status: 'active' },
    });

    if (!tenant) {
      throw new UnauthorizedException('Invalid client key or inactive tenant');
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

    return {
      accessToken,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        clientKey: tenant.clientKey,
        plan: tenant.plan,
      },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * ========= УСТАНОВКА ПАРОЛЯ ПО email + clientKey =========
   * Используется на /set-password?email=...&clientKey=...
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
}