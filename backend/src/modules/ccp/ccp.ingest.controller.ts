import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';

import { CcpService } from './ccp.service';
import { CcpIngestDto } from './dto/ingest.dto';
import { ApiTokensService } from '../../api-tokens/api-tokens.service';

@Controller('ccp') // ✅ БЕЗ /v1, потому что main.ts уже setGlobalPrefix('v1')
export class CcpIngestController {
  constructor(
    private readonly ccp: CcpService,
    private readonly apiTokens: ApiTokensService,
  ) {}

  /**
   * POST /v1/ccp/ingest
   *
   * Headers:
   *  X-Api-Token: <tenant api token>
   *
   * Body:
   *  CcpIngestDto
   */
  @Post('ingest')
  async ingest(
    @Headers('x-api-token') xApiToken: string | undefined,
    @Body() dto: CcpIngestDto,
  ) {
    const rawToken = String(xApiToken || '').trim();
    if (!rawToken) {
      throw new UnauthorizedException('Missing X-Api-Token');
    }

    const tokenRow = await this.apiTokens.findActiveByToken(rawToken);
    if (!tokenRow?.tenantId) {
      throw new UnauthorizedException('Invalid or expired API token');
    }

    if (!dto?.type || !dto?.data) {
      throw new BadRequestException('Invalid payload: type + data are required');
    }

    const tenantId = tokenRow.tenantId;
    const result = await this.ccp.ingest(tenantId, dto);

    return { ok: true, result };
  }
}