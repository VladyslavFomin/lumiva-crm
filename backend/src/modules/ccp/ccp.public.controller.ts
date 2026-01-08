import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CcpService } from './ccp.service';
import { ApiTokenGuard } from '../../api-tokens/api-token.guard';
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

class ConnectByTokenDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  siteUrl!: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  wpRestBase!: string;

  @IsString()
  @IsNotEmpty()
  wpToken!: string;
}

@Controller('ccp') // globalPrefix('v1') уже есть → /v1/ccp/...
export class CcpPublicController {
  constructor(private readonly ccp: CcpService) {}

  /**
   * POST /v1/ccp/sites/connect-by-token
   * Headers: X-Api-Token: <tenant token from CRM>
   * Body: { siteUrl, wpRestBase, wpToken }
   */
  @UseGuards(ApiTokenGuard)
  @Post('sites/connect-by-token')
  async connectByToken(@Body() body: ConnectByTokenDto) {
    return await this.ccp.connectSiteWpByXApiToken(body);
  }
}