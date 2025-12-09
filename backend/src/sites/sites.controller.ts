import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('sites')
@UseGuards(JwtAuthGuard)
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Get()
  async list(@CurrentUser() user: any) {
    return this.sitesService.findAllForTenant(user.tenantId);
  }

  @Post()
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateSiteDto,
  ) {
    return this.sitesService.createForTenant(user.tenantId, dto);
  }

  @Delete(':id')
  async delete(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.sitesService.deleteForTenant(user.tenantId, id);
  }
}
