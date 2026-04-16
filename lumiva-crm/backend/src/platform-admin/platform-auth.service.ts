// src/platform-admin/platform-auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';

import { PlatformAdminUser } from './admin-user.entity';

@Injectable()
export class PlatformAuthService {
  constructor(
    @InjectRepository(PlatformAdminUser)
    private readonly adminsRepo: Repository<PlatformAdminUser>,
    private readonly jwtService: JwtService,
  ) {}

  private async validateCredentials(email: string, password: string) {
    const admin = await this.adminsRepo.findOne({ where: { email } });
    if (!admin) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return admin;
  }

  async login(email: string, password: string) {
    const admin = await this.validateCredentials(email, password);

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      kind: 'platform-admin' as const,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '8h',
    });

    return {
      accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    };
  }
}