import { Module, forwardRef } from '@nestjs/common';
import { SmmModule } from '../smm/smm.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { AiModule } from '../ai/ai.module';
import { StorageQuotaModule } from '../storage-quota/storage-quota.module';
import { RbacModule } from '../rbac/rbac.module';
import { ContentService } from './content.service';
import { ContentPublisherService } from './content-publisher.service';
import { ContentCanvaService } from './content-canva.service';
import { ContentVideoAccountsService } from './content-video-accounts.service';
import { ContentController, ContentLinkedinCallbackController, ContentVkCallbackController, ContentCanvaCallbackController, ContentThreadsCallbackController, ContentVideoCallbackController } from './content.controller';

/** Контент и публикации: единый движок + адаптеры сетей (md/content_engine_plan.md). */
@Module({
  imports: [SmmModule, PlatformSettingsModule, forwardRef(() => AiModule), StorageQuotaModule, RbacModule],
  controllers: [ContentController, ContentLinkedinCallbackController, ContentVkCallbackController, ContentCanvaCallbackController, ContentThreadsCallbackController, ContentVideoCallbackController],
  providers: [ContentService, ContentPublisherService, ContentCanvaService, ContentVideoAccountsService],
  exports: [ContentService],
})
export class ContentModule {}
