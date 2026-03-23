// backend/src/tenants/tenants.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';

import { getUploadsRoot } from '../common/uploads-root.util';
import { randomUUID } from 'crypto';
import { TenantsService } from './tenants.service';
import { CompanyFilesService } from './company-files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload, // <-- ВАЖНО: type-импорт
} from '../common/decorators/current-user.decorator';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { UserSessionsService } from '../auth/user-sessions.service';

@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly userSessions: UserSessionsService,
    private readonly companyFiles: CompanyFilesService,
  ) {}

  @Get()
  async getTenants() {
    return this.tenantsService.findAll();
  }

  // ---- Получить настройки компании ----
  @UseGuards(JwtAuthGuard)
  @Get('settings')
  async getSettings(@CurrentUser() user: CurrentUserPayload) {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }

    const uid = user.userId ?? user.sub;
    if (!uid) {
      throw new BadRequestException('No user in auth payload');
    }

    const base = await this.tenantsService.getCompanySettings(user.tenantId);
    const canDeleteTenantStorage =
      await this.companyFiles.canUserDeleteStorage(user.tenantId, uid);
    return { ...base, canDeleteTenantStorage };
  }

  // ---- Получить компоненты текущего тенанта ----
  @UseGuards(JwtAuthGuard)
  @Get('components')
  async getComponents(@CurrentUser() user: CurrentUserPayload) {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }

    return this.tenantsService.getTenantComponents(user.tenantId);
  }

  // ---- Обновить настройки компании (только owner) ----
  @UseGuards(JwtAuthGuard)
  @Patch('settings')
  async updateSettings(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: UpdateTenantSettingsDto,
  ) {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }

    const role = (user.role || '').toLowerCase();
    if (role !== 'owner') {
      throw new ForbiddenException('Only owner can update settings');
    }

    return this.tenantsService.updateCompanySettings(user.tenantId, body);
  }

  /** Загрузка логотипа (multipart field "file"), только owner */
  @UseGuards(JwtAuthGuard)
  @Post('settings/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const tenantId = (req as any).user?.tenantId as string | undefined;
          if (!tenantId) {
            cb(new BadRequestException('No tenant'), '');
            return;
          }
          const dir = join(getUploadsRoot(), 'tenants', tenantId);
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase() || '.png';
          const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
          const e = allowed.includes(ext) ? ext : '.png';
          cb(null, `logo${e}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (/^image\/(png|jpeg|gif|webp)$/.test(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Only PNG, JPEG, GIF or WebP images are allowed'),
            false,
          );
        }
      },
    }),
  )
  async uploadLogo(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: { path: string; filename: string; mimetype: string },
  ) {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }
    const role = (user.role || '').toLowerCase();
    if (role !== 'owner') {
      throw new ForbiddenException('Only owner can upload company logo');
    }
    if (!file) {
      throw new BadRequestException('file is required');
    }
    return this.tenantsService.setLogoFromFile(user.tenantId, file);
  }

  /** Агрегированный список файлов тенанта (хранилище, логотип, вложения и т.д.) */
  @UseGuards(JwtAuthGuard)
  @Get('storage/files')
  async listStorageFiles(@CurrentUser() user: CurrentUserPayload) {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }
    return this.companyFiles.listAggregated(user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('storage/files/:fileId')
  async deleteStorageFile(
    @CurrentUser() user: CurrentUserPayload,
    @Param('fileId') fileId: string,
  ) {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }
    await this.companyFiles.deleteAggregated(user, fileId);
    return { ok: true };
  }

  /** Активные входы (JWT-сессии), только owner */
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async listSessions(@CurrentUser() user: CurrentUserPayload) {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }
    const role = (user.role || '').toLowerCase();
    if (role !== 'owner') {
      throw new ForbiddenException('Only owner can view sessions');
    }
    return this.userSessions.listActiveForTenant(user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:sessionId')
  async revokeSession(
    @CurrentUser() user: CurrentUserPayload,
    @Param('sessionId') sessionId: string,
  ) {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }
    const role = (user.role || '').toLowerCase();
    if (role !== 'owner') {
      throw new ForbiddenException('Only owner can revoke sessions');
    }
    await this.userSessions.revokeSessionForTenant(user.tenantId, sessionId);
    return { ok: true };
  }

  /** Завершить все сессии пользователя (по users.id) */
  @UseGuards(JwtAuthGuard)
  @Delete('users/:userId/sessions')
  async revokeAllUserSessions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('userId') userId: string,
  ) {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }
    const role = (user.role || '').toLowerCase();
    if (role !== 'owner') {
      throw new ForbiddenException('Only owner can revoke sessions');
    }
    const revoked = await this.userSessions.revokeAllForUser(
      user.tenantId,
      userId,
    );
    return { ok: true, revoked };
  }
}