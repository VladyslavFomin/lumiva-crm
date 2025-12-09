// backend/src/api-tokens/api-tokens.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull } from 'typeorm';
import { randomBytes } from 'crypto';

import { ApiToken } from './api-token.entity';
import { Tenant } from '../tenants/tenant.entity';

interface CreateTokenDto {
  tenantId: string;
  name: string;
  description?: string | null;
  token: string;
  expiresAt?: Date | null;
}

interface UpdateTokenDto {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  expiresAt?: Date | null;
}

@Injectable()
export class ApiTokensService {
  constructor(
    @InjectRepository(ApiToken)
    private readonly repo: Repository<ApiToken>,

    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async listForTenant(tenantId: string) {
    return this.repo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async getForTenant(tenantId: string, id: string) {
    const token = await this.repo.findOne({
      where: { id, tenantId },
    });
    if (!token) {
      throw new NotFoundException('API token not found');
    }
    return token;
  }

  async createForTenant(input: CreateTokenDto) {
    // проверим, что тенант существует
    const tenant = await this.tenantRepo.findOne({
      where: { id: input.tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const entity = this.repo.create({
      tenantId: input.tenantId,
      name: input.name,
      description: input.description ?? null,
      token: input.token,
      isActive: true,
      expiresAt: input.expiresAt ?? null,
    });

    return this.repo.save(entity);
  }

  async updateForTenant(
    tenantId: string,
    id: string,
    patch: UpdateTokenDto,
  ) {
    const token = await this.getForTenant(tenantId, id);

    if (patch.name !== undefined) token.name = patch.name;
    if (patch.description !== undefined)
      token.description = patch.description;
    if (patch.isActive !== undefined) token.isActive = patch.isActive;
    if (patch.expiresAt !== undefined) token.expiresAt = patch.expiresAt;

    return this.repo.save(token);
  }

  async deleteForTenant(tenantId: string, id: string) {
    const token = await this.getForTenant(tenantId, id);
    await this.repo.remove(token);
    return { ok: true };
  }

  /**
   * Используется гардом: поиск активного токена по его строковому значению.
   */
  async findActiveByToken(rawToken: string): Promise<ApiToken | null> {
    const now = new Date();
    return this.repo.findOne({
      where: [
        // бессрочные токены
        {
          token: rawToken,
          isActive: true,
          expiresAt: IsNull(),
        },
        // с датой истечения в будущем
        {
          token: rawToken,
          isActive: true,
          expiresAt: MoreThan(now),
        },
      ],
    });
  }

  /**
   * ===== Маркетинговый токен для интеграций =====
   * Используется в marketing.controller → getOrCreateMarketingToken / rotateMarketingToken
   */
  async getOrCreateMarketingToken(tenantId: string): Promise<ApiToken> {
    const MARKETING_NAME = 'Marketing API token';

    let token = await this.repo.findOne({
      where: { tenantId, name: MARKETING_NAME },
    });

    if (!token) {
      // убеждаемся что тенант существует
      const tenant = await this.tenantRepo.findOne({
        where: { id: tenantId },
      });
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      token = this.repo.create({
        tenantId,
        name: MARKETING_NAME,
        description: 'Token for marketing integrations',
        token: randomBytes(32).toString('hex'),
        isActive: true,
        expiresAt: null,
      });

      token = await this.repo.save(token);
    }

    return token;
  }

  async rotateMarketingToken(tenantId: string): Promise<ApiToken> {
    const MARKETING_NAME = 'Marketing API token';

    let token = await this.repo.findOne({
      where: { tenantId, name: MARKETING_NAME },
    });

    if (!token) {
      // если вдруг не нашли — создаём новый
      return this.getOrCreateMarketingToken(tenantId);
    }

    token.token = randomBytes(32).toString('hex');
    token.isActive = true;
    // по желанию можно обновлять expiresAt, сейчас оставляем как есть
    token = await this.repo.save(token);

    return token;
  }
}