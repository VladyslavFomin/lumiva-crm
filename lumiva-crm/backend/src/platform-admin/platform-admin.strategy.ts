// src/platform-admin/platform-admin.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface PlatformAdminJwtPayload {
  sub: string;
  email: string;
  role: string;
  kind: 'platform-admin';
}

@Injectable()
export class PlatformAdminStrategy extends PassportStrategy(
  Strategy,
  'platform-admin-jwt',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: PlatformAdminJwtPayload) {
    if (payload?.kind !== 'platform-admin') {
      throw new UnauthorizedException();
    }
    // То, что попадёт в req.user
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      kind: payload.kind,
    };
  }
}