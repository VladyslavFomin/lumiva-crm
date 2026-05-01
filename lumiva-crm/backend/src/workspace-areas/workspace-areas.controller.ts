import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { getUploadsRoot } from '../common/uploads-root.util';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { WorkspaceAreasService } from './workspace-areas.service';
import { CreateWorkspaceAreaDto } from './dto/create-workspace-area.dto';
import { UpdateWorkspaceAreaDto } from './dto/update-workspace-area.dto';

@Controller('workspace-areas')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('custom_objects')
export class WorkspaceAreasController {
  constructor(private readonly service: WorkspaceAreasService) {}

  @Get()
  async list(@CurrentUser() user: CurrentUserPayload) {
    return this.service.list(user.tenantId);
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.getOne(user.tenantId, id);
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateWorkspaceAreaDto,
  ) {
    return this.service.create(user.tenantId, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateWorkspaceAreaDto,
  ) {
    return this.service.update(user.tenantId, id, dto);
  }

  @Post(':id/cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const tenantId = (req as any).user?.tenantId as string | undefined;
          const areaId = (req.params as any)?.id as string | undefined;
          if (!tenantId || !areaId) {
            cb(new BadRequestException('Missing tenant or area'), '');
            return;
          }
          const dir = join(
            getUploadsRoot(),
            'tenants',
            tenantId,
            'workspace-areas',
            areaId,
          );
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase() || '.jpg';
          const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
          const e = allowed.includes(ext) ? ext : '.jpg';
          cb(null, `cover-${Date.now()}${e}`);
        },
      }),
      limits: { fileSize: 4 * 1024 * 1024 },
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
  async uploadCover(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: { filename: string } | undefined,
  ) {
    if (!file?.filename) {
      throw new BadRequestException('file is required');
    }
    return this.service.setCoverFromUpload(user.tenantId, id, file);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.service.remove(user.tenantId, id);
    return { ok: true };
  }
}
