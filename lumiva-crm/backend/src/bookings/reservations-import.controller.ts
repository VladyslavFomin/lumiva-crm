import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { ReservationsImportService } from './reservations-import.service';
import { ReservationsService } from './reservations.service';

@Controller('bookings/import')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('bookings', 'write')
export class ReservationsImportController {
  constructor(
    private readonly importService: ReservationsImportService,
    private readonly reservations: ReservationsService,
  ) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  previewImport(@CurrentUser() user: CurrentUserPayload, @UploadedFile() file: any) {
    return this.importService.previewImport(user.tenantId, file);
  }

  @Post('apply')
  async applyImport(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    dto: {
      importId: string;
      mapping: Record<string, string | null>;
      defaultLocationId?: string;
    },
  ) {
    const actingStaffUserId = await this.reservations.findActingStaffUserId(user.tenantId, user.email);
    return this.importService.applyImport(user.tenantId, dto, actingStaffUserId);
  }
}
