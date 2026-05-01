// backend/src/api-tokens/api-tokens.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTokensService } from './api-tokens.service';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import { PasswordConfirmDto } from './dto/password-confirm.dto';

@UseGuards(JwtAuthGuard)           // <-- ДОБАВИЛИ
@Controller('api-tokens')
export class ApiTokensController {
  constructor(
    private readonly apiTokens: ApiTokensService,
    private readonly auth: AuthService,
  ) {}

  private resolveUserId(user: CurrentUserPayload): string {
    const id = user?.userId || user?.sub || user?.id;
    if (!id || typeof id !== 'string') {
      throw new BadRequestException('Invalid session');
    }
    return id;
  }

  private async requirePassword(user: CurrentUserPayload, dto: PasswordConfirmDto) {
    const uid = this.resolveUserId(user);
    const ok = await this.auth.verifyUserPassword(uid, dto.password);
    if (!ok) {
      throw new ForbiddenException('invalid_password');
    }
  }

  // ===== маркетинговый токен – СТАВИМ ВВЕРХ =====

  @Get('marketing')
  async getMarketingToken(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ preview: string; suffix: string }> {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }

    const token = await this.apiTokens.getOrCreateMarketingToken(user.tenantId);
    const value = token.token || '';
    return this.apiTokens.maskMarketingTokenDisplay(value);
  }

  @Post('marketing/reveal')
  async revealMarketingToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: PasswordConfirmDto,
  ): Promise<{ token: string }> {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }
    await this.requirePassword(user, dto);

    const token = await this.apiTokens.getOrCreateMarketingToken(user.tenantId);
    const value = token.token || '';
    return { token: value };
  }

  @Post('marketing/regenerate')
  async regenerateMarketingToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: PasswordConfirmDto,
  ): Promise<{ token: string }> {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }
    await this.requirePassword(user, dto);

    const token = await this.apiTokens.rotateMarketingToken(user.tenantId);
    const value = token.token || '';
    return { token: value };
  }

  // ===== обычные CRUD токенов =====

  @Get()
  async list(@CurrentUser() user: CurrentUserPayload) {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }
    return this.apiTokens.listForTenant(user.tenantId);
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }
    return this.apiTokens.getForTenant(user.tenantId, id);
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      name: string;
      description?: string | null;
      token: string;
      expiresAt?: string | null;
    },
  ) {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }

    const expiresAt =
      body.expiresAt != null ? new Date(body.expiresAt) : null;

    return this.apiTokens.createForTenant({
      tenantId: user.tenantId,
      name: body.name,
      description: body.description ?? null,
      token: body.token,
      expiresAt,
    });
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body()
    body: {
      name?: string;
      description?: string | null;
      isActive?: boolean;
      expiresAt?: string | null;
    },
  ) {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }

    const patch: any = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.description !== undefined)
      patch.description = body.description ?? null;
    if (body.isActive !== undefined) patch.isActive = body.isActive;
    if (body.expiresAt !== undefined) {
      patch.expiresAt =
        body.expiresAt != null ? new Date(body.expiresAt) : null;
    }

    return this.apiTokens.updateForTenant(user.tenantId, id, patch);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }
    return this.apiTokens.deleteForTenant(user.tenantId, id);
  }
}