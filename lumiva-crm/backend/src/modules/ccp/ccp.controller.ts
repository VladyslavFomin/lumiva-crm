// backend/src/modules/ccp/ccp.controller.ts

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';

import { CcpService } from './ccp.service';
import { UpdateCcpClientDto } from './dto/update-client.dto';
import { UpdateCcpTxnDto } from './dto/update-txn.dto';
import { UpdateCcpTransferDto } from './dto/update-transfer.dto';
import { CreateCcpTxnDto } from './dto/create-txn.dto';
import { CreateCcpTransferDto } from './dto/create-transfer.dto';
import { CreateCcpClientDto } from './dto/create-client.dto';

@UseGuards(JwtAuthGuard)
@Controller('ccp') // ✅ БЕЗ /v1, потому что setGlobalPrefix('v1') уже есть
export class CcpController {
  constructor(private readonly ccp: CcpService) {}

  private tenantId(user: CurrentUserPayload): string {
    const tid = user?.tenantId;
    if (!tid) throw new BadRequestException('Missing tenantId');
    return String(tid);
  }

  // =========================
  //          SITES
  // =========================

  /**
   * GET /v1/ccp/sites
   */
  @Get('sites')
  async listSites(@CurrentUser() user: CurrentUserPayload) {
    const tenantId = this.tenantId(user);
    return this.ccp.listSites(tenantId);
  }

  /**
   * POST /v1/ccp/sites
   * body: { siteUrl }
   */
  @Post('sites')
  async addSite(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { siteUrl: string },
  ) {
    const tenantId = this.tenantId(user);

    const siteUrl = String(body?.siteUrl || '').trim();
    if (!siteUrl) throw new BadRequestException('siteUrl is required');

    return this.ccp.upsertSiteByUrl(tenantId, siteUrl);
  }

  /**
   * PATCH /v1/ccp/sites/:id
   * body: { siteUrl?, wpRestBase?, wpToken?, isActive? }
   */
  @Patch('sites/:id')
  async updateSite(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body()
    body: {
      siteUrl?: string;
      wpRestBase?: string | null;
      wpToken?: string | null;
      isActive?: boolean;
    },
  ) {
    const tenantId = this.tenantId(user);
    const siteId = String(id || '').trim();
    if (!siteId) throw new BadRequestException('siteId is required');
    return this.ccp.updateSite(tenantId, siteId, body || {});
  }

  /**
   * DELETE /v1/ccp/sites/:id
   * Soft-delete: hides the site from account selectors but keeps synced data.
   */
  @Delete('sites/:id')
  async deleteSite(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    const tenantId = this.tenantId(user);
    const siteId = String(id || '').trim();
    if (!siteId) throw new BadRequestException('siteId is required');
    return this.ccp.deactivateSite(tenantId, siteId);
  }

  /**
   * POST /v1/ccp/sites/connect
   * body: { siteId, wpRestBase, wpToken }
   */
  @Post('sites/connect')
  async connectSiteWp(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      siteId: string;
      wpRestBase: string;
      wpToken: string;
    },
  ) {
    const tenantId = this.tenantId(user);

    const siteId = String(body?.siteId || '').trim();
    const wpRestBase = String(body?.wpRestBase || '').trim();
    const wpToken = String(body?.wpToken || '').trim();

    if (!siteId) throw new BadRequestException('siteId is required');
    if (!wpRestBase) throw new BadRequestException('wpRestBase is required');
    if (!wpToken) throw new BadRequestException('wpToken is required');

    return this.ccp.connectSiteWp(tenantId, siteId, wpRestBase, wpToken);
  }

  // =========================
  //          CLIENTS
  // =========================

  /**
   * GET /v1/ccp/clients?siteId=&search=&page=&per=
   */
  @Get('clients')
  async listClients(
    @CurrentUser() user: CurrentUserPayload,
    @Query('siteId') siteId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('per') per?: string,
    @Query('fresh') fresh?: string,
  ) {
    const tenantId = this.tenantId(user);

    return this.ccp.listClients(tenantId, {
      siteId: siteId ? String(siteId) : undefined,
      search: search ? String(search) : undefined,
      page: page ? Number(page) : undefined,
      per: per ? Number(per) : undefined,
      fresh: fresh === '1' || fresh === 'true',
    });
  }

  /**
   * GET /v1/ccp/clients/:id/analytics?fresh=1
   */
  @Get('clients/:id/analytics')
  async getClientAnalytics(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Query('fresh') fresh?: string,
  ) {
    const tenantId = this.tenantId(user);
    if (!id) throw new BadRequestException('id is required');
    return this.ccp.getClientAnalytics(tenantId, String(id), {
      fresh: fresh === '1' || fresh === 'true',
    });
  }

  /**
   * GET /v1/ccp/clients/:id
   */
  @Get('clients/:id')
  async getClient(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const tenantId = this.tenantId(user);
    if (!id) throw new BadRequestException('id is required');
    return this.ccp.getClient(tenantId, String(id));
  }

  /**
   * PATCH /v1/ccp/clients/:id
   */
  @Patch('clients/:id')
  async updateClient(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCcpClientDto,
  ) {
    const tenantId = this.tenantId(user);
    if (!id) throw new BadRequestException('id is required');
    return this.ccp.updateClientInWp(tenantId, String(id), dto);
  }

  /**
   * POST /v1/ccp/clients?siteId=
   */
  @Post('clients')
  async createClient(
    @CurrentUser() user: CurrentUserPayload,
    @Query('siteId') siteId: string,
    @Body() dto: CreateCcpClientDto,
  ) {
    const tenantId = this.tenantId(user);

    const sid = String(siteId || '').trim();
    if (!sid) throw new BadRequestException('siteId is required');

    return this.ccp.createClientInWp(tenantId, sid, dto);
  }

  // =========================
  //          TXNS
  // =========================

  /**
   * GET /v1/ccp/txns?siteId=&wpUserId=&page=&per=&fresh=
   */
  @Get('txns')
  async listTxns(
    @CurrentUser() user: CurrentUserPayload,
    @Query('siteId') siteId?: string,
    @Query('wpUserId') wpUserId?: string,
    @Query('page') page?: string,
    @Query('per') per?: string,
    @Query('fresh') fresh?: string,
  ) {
    const tenantId = this.tenantId(user);

    return this.ccp.listTxns(tenantId, {
      siteId: siteId ? String(siteId) : undefined,
      wpUserId: wpUserId ? Number(wpUserId) : undefined,
      page: page ? Number(page) : undefined,
      per: per ? Number(per) : undefined,
      fresh: fresh === '1' || fresh === 'true',
    });
  }

  /**
   * POST /v1/ccp/txns?siteId=
   */
  @Post('txns')
  async createTxn(
    @CurrentUser() user: CurrentUserPayload,
    @Query('siteId') siteId: string,
    @Body() dto: CreateCcpTxnDto,
  ) {
    const tenantId = this.tenantId(user);

    const sid = String(siteId || '').trim();
    if (!sid) throw new BadRequestException('siteId is required');

    return this.ccp.createTxnInWp(tenantId, sid, dto);
  }

  /**
   * PATCH /v1/ccp/txns/:siteId/:wpPostId
   */
  @Patch('txns/:siteId/:wpPostId')
  async updateTxn(
    @CurrentUser() user: CurrentUserPayload,
    @Param('siteId') siteId: string,
    @Param('wpPostId') wpPostId: string,
    @Body() dto: UpdateCcpTxnDto,
  ) {
    const tenantId = this.tenantId(user);

    const sid = String(siteId || '').trim();
    const pid = Number(wpPostId);

    if (!sid) throw new BadRequestException('siteId is required');
    if (!Number.isFinite(pid) || pid <= 0) throw new BadRequestException('wpPostId invalid');

    return this.ccp.updateTxnInWp(tenantId, sid, pid, dto);
  }

  // =========================
  //        TRANSFERS
  // =========================

  /**
   * GET /v1/ccp/transfers?siteId=&wpUserId=&page=&per=&fresh=
   */
  @Get('transfers')
  async listTransfers(
    @CurrentUser() user: CurrentUserPayload,
    @Query('siteId') siteId?: string,
    @Query('wpUserId') wpUserId?: string,
    @Query('page') page?: string,
    @Query('per') per?: string,
    @Query('fresh') fresh?: string,
  ) {
    const tenantId = this.tenantId(user);

    return this.ccp.listTransfers(tenantId, {
      siteId: siteId ? String(siteId) : undefined,
      wpUserId: wpUserId ? Number(wpUserId) : undefined,
      page: page ? Number(page) : undefined,
      per: per ? Number(per) : undefined,
      fresh: fresh === '1' || fresh === 'true',
    });
  }

  /**
   * POST /v1/ccp/transfers?siteId=
   */
  @Post('transfers')
  async createTransfer(
    @CurrentUser() user: CurrentUserPayload,
    @Query('siteId') siteId: string,
    @Body() dto: CreateCcpTransferDto,
  ) {
    const tenantId = this.tenantId(user);

    const sid = String(siteId || '').trim();
    if (!sid) throw new BadRequestException('siteId is required');

    return this.ccp.createTransferInWp(tenantId, sid, dto);
  }

  /**
   * PATCH /v1/ccp/transfers/:siteId/:wpPostId
   */
  @Patch('transfers/:siteId/:wpPostId')
  async updateTransfer(
    @CurrentUser() user: CurrentUserPayload,
    @Param('siteId') siteId: string,
    @Param('wpPostId') wpPostId: string,
    @Body() dto: UpdateCcpTransferDto,
  ) {
    const tenantId = this.tenantId(user);

    const sid = String(siteId || '').trim();
    const pid = Number(wpPostId);

    if (!sid) throw new BadRequestException('siteId is required');
    if (!Number.isFinite(pid) || pid <= 0) throw new BadRequestException('wpPostId invalid');

    return this.ccp.updateTransferInWp(tenantId, sid, pid, dto);
  }
}
