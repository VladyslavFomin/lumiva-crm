import { Body, Controller, Post } from '@nestjs/common';
import { TelegramService } from './telegram.service';

@Controller('telegram/webhook')
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  @Post()
  async handle(@Body() update: any) {
    await this.telegram.handleUpdate(update);
    return { ok: true };
  }
}
