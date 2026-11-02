import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacService } from '../rbac/rbac.service';
import { CrmMigrationService, FileTarget, RunInput, SourceInput } from './crm-migration.service';

const MAX_FILE_BYTES = 25 * 1024 * 1024;

type UploadedFileLike = { buffer: Buffer; originalname?: string; size?: number };

/** Мастер переезда: только тем, кому разрешён импорт лидов (как и обычный CSV-импорт). */
@Controller('crm-migration')
@UseGuards(JwtAuthGuard)
export class CrmMigrationController {
  constructor(
    private readonly svc: CrmMigrationService,
    private readonly rbac: RbacService,
  ) {}

  private async guard(user: CurrentUserPayload) {
    const ok = await this.rbac.canForUser(user.tenantId, user.staffUserId || '', (user.role as any) || 'viewer', 'leads_manage_import');
    if (!ok) throw new ForbiddenException('Недостаточно прав для импорта');
  }

  @Get('connections')
  async connections(@CurrentUser() user: CurrentUserPayload) {
    await this.guard(user);
    return this.svc.listConnections(user.tenantId);
  }

  @Get('runs')
  async runs(@CurrentUser() user: CurrentUserPayload) {
    await this.guard(user);
    return { runs: await this.svc.listRuns(user.tenantId), imported: await this.svc.importedCounts(user.tenantId) };
  }

  @Get('runs/:id')
  async run(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.guard(user);
    return this.svc.getRun(user.tenantId, id);
  }

  @Post('preview')
  async preview(@CurrentUser() user: CurrentUserPayload, @Body() body: SourceInput) {
    await this.guard(user);
    return this.svc.preview(user.tenantId, body || ({} as SourceInput));
  }

  @Post('start')
  async start(@CurrentUser() user: CurrentUserPayload, @Body() body: RunInput) {
    await this.guard(user);
    return this.svc.start(user.tenantId, user.userId || null, body || ({} as RunInput));
  }

  @Post('file/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  async filePreview(@CurrentUser() user: CurrentUserPayload, @UploadedFile() file?: UploadedFileLike) {
    await this.guard(user);
    if (!file?.buffer?.length) throw new BadRequestException('Файл не получен');
    return this.svc.filePreview(file.buffer, file.originalname || 'file.csv');
  }

  @Post('file/start')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  async fileStart(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body() body: { target?: string; mapping?: string; mergeExisting?: string },
  ) {
    await this.guard(user);
    if (!file?.buffer?.length) throw new BadRequestException('Файл не получен');
    let mapping: Record<string, string> = {};
    try {
      mapping = JSON.parse(body?.mapping || '{}');
    } catch {
      throw new BadRequestException('Некорректное сопоставление колонок');
    }
    return this.svc.fileStart(
      user.tenantId,
      user.userId || null,
      file.buffer,
      file.originalname || 'file.csv',
      String(body?.target || '') as FileTarget,
      mapping,
      body?.mergeExisting !== 'false',
    );
  }
}
