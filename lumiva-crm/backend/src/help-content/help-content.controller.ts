import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import { HelpContentService } from './help-content.service';

/** CRM: тур страницы (шаги + видео/gif). */
@Controller('help-content')
@UseGuards(JwtAuthGuard)
export class HelpContentController {
  constructor(private readonly help: HelpContentService) {}

  @Get('tours/:topic')
  getTour(@Param('topic') topic: string, @Query('lang') lang?: string) {
    return this.help.getTour(topic, lang);
  }
}

/** pl1 → «Контент»: ссылки на видео/gif к страницам и шагам туров. */
@Controller('platform/help-content')
@UseGuards(PlatformAdminGuard)
export class PlatformHelpContentController {
  constructor(private readonly help: HelpContentService) {}

  @Get()
  getCatalog() {
    return this.help.getCatalog();
  }

  @Put('media')
  setMedia(@Body() body: { topic?: string; stepId?: string; kind?: string; url?: string | null }) {
    return this.help.setMedia(body);
  }
}
