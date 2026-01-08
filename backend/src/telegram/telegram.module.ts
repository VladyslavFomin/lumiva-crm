import { Module } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { DemoRequestsModule } from '../demo-requests/demo-requests.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [DemoRequestsModule, PlatformSettingsModule, TenantsModule],
  controllers: [TelegramController],
  providers: [TelegramService],
})
export class TelegramModule {}
