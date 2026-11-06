import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { joinUploadsAbsolute } from '../common/uploads-root.util';
import { AiEmployeeBrainService, type EmployeeBrainSettings } from './ai-employee-brain.service';

const uid = (user: CurrentUserPayload): string | null => user.userId ?? user.id ?? user.sub ?? null;

/** «Мозг» ИИ-сотрудника (вкладка в профиле). Живёт в модуле офиса — там движок файлов «Мозга». */
@Controller('ai-agents/:agentId/brain')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('ai_employees')
export class AiEmployeeBrainController {
  constructor(private readonly svc: AiEmployeeBrainService) {}

  @Get()
  overview(@CurrentUser() user: CurrentUserPayload, @Param('agentId') agentId: string) {
    return this.svc.overview(user.tenantId, agentId);
  }

  @Put('settings')
  settings(@CurrentUser() user: CurrentUserPayload, @Param('agentId') agentId: string, @Body() body: Partial<EmployeeBrainSettings>) {
    return this.svc.saveSettings(user.tenantId, agentId, body || {});
  }

  @Get('preview')
  preview(@CurrentUser() user: CurrentUserPayload, @Param('agentId') agentId: string, @Query('q') q?: string) {
    return this.svc.preview(user.tenantId, agentId, String(q || '').slice(0, 2000));
  }

  @Get('files/:id')
  file(@CurrentUser() user: CurrentUserPayload, @Param('agentId') agentId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getFile(user.tenantId, agentId, id);
  }

  @Get('files/:id/download')
  async download(
    @CurrentUser() user: CurrentUserPayload,
    @Param('agentId') agentId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const f = await this.svc.rawFile(user.tenantId, agentId, id);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`);
    if (f.storagePath) return res.sendFile(joinUploadsAbsolute(f.storagePath));
    if (f.bodyMd != null) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      return res.send(f.bodyMd);
    }
    throw new NotFoundException('File has no content');
  }

  @Post('docs')
  createDoc(@CurrentUser() user: CurrentUserPayload, @Param('agentId') agentId: string, @Body() body: { name?: string; bodyMd?: string }) {
    return this.svc.createDoc(user.tenantId, agentId, uid(user), body || {});
  }

  @Post('files')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  upload(
    @CurrentUser() user: CurrentUserPayload,
    @Param('agentId') agentId: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ) {
    return this.svc.upload(user.tenantId, agentId, uid(user), file);
  }

  @Patch('files/:id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('agentId') agentId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { name?: string; bodyMd?: string },
  ) {
    return this.svc.update(user.tenantId, agentId, id, body || {});
  }

  @Delete('files/:id')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('agentId') agentId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(user.tenantId, agentId, id);
  }
}
