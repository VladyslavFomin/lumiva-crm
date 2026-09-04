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
  Query,
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
import { WorkspaceAreaMembersService } from './workspace-area-members.service';
import { WorkspaceAreaActivityLogService } from './workspace-area-activity-log.service';
import { CreateWorkspaceAreaDto } from './dto/create-workspace-area.dto';
import { UpdateWorkspaceAreaDto } from './dto/update-workspace-area.dto';
import { CreateWorkspaceAreaMemberDto } from './dto/create-workspace-area-member.dto';
import { UpdateWorkspaceAreaMemberDto } from './dto/update-workspace-area-member.dto';

@Controller('workspace-areas')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('custom_objects')
export class WorkspaceAreasController {
  constructor(
    private readonly service: WorkspaceAreasService,
    private readonly membersService: WorkspaceAreaMembersService,
    private readonly activityLogService: WorkspaceAreaActivityLogService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.service.list(user.tenantId, includeArchived === '1' || includeArchived === 'true');
  }

  @Get(':id/summary')
  async summary(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.getSummary(user.tenantId, id);
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
    const staffUserId = await this.membersService.resolveStaffUserId(user.tenantId, {
      loginUserId: user.userId ?? user.id ?? user.sub,
      email: user.email,
    });
    return this.service.create(user.tenantId, dto, staffUserId ?? undefined);
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

  @Get(':id/activity-log')
  async activityLog(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('limit') limit?: string,
  ) {
    return this.activityLogService.list(user.tenantId, id, limit ? parseInt(limit, 10) : undefined);
  }

  @Get(':id/members')
  async listMembers(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.membersService.listMembers(user.tenantId, id);
  }

  @Post(':id/members')
  async addMember(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateWorkspaceAreaMemberDto,
  ) {
    const staffUserId = await this.membersService.resolveStaffUserId(user.tenantId, {
      loginUserId: user.userId ?? user.id ?? user.sub,
      email: user.email,
    });
    return this.membersService.createMember(user.tenantId, id, dto, staffUserId);
  }

  @Patch(':id/members/:memberId')
  async updateMember(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Body() dto: UpdateWorkspaceAreaMemberDto,
  ) {
    return this.membersService.updateMemberRole(user.tenantId, id, memberId, dto.role);
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
  ) {
    await this.membersService.removeMember(user.tenantId, id, memberId);
    return { ok: true };
  }
}
