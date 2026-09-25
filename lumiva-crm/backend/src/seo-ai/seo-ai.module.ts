import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeoAiAgent } from './seo-ai-agent.entity';
import { SeoAiReport } from './seo-ai-report.entity';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { AiAgent } from '../ai-employees/ai-agent.entity';
import { MarketingModule } from '../marketing/marketing.module';
import { AiModule } from '../ai/ai.module';
import { MailModule } from '../mail/mail.module';
import { EmailModule } from '../email/email.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { SeoAiService } from './seo-ai.service';
import { SeoAiScheduler } from './seo-ai.scheduler';
import { SeoAiSignalsService } from './seo-ai-signals.service';
import { Project } from '../projects/project.entity';
import { ProjectsModule } from '../projects/projects.module';
import { AiEmployeesModule } from '../ai-employees/ai-employees.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SeoAiController } from './seo-ai.controller';

/** ИИ-SEO-ассистент: еженедельный разбор сайта (GSC + PageSpeed + on-page) с отчётом на почту. */
@Module({
  imports: [
    TypeOrmModule.forFeature([SeoAiAgent, SeoAiReport, Tenant, User, AiAgent, Project]),
    MarketingModule,
    AiModule,
    MailModule,
    EmailModule, // дизайн писем компании (шаблон-обёртка из настроек)
    PlatformSettingsModule,
    ProjectsModule, // проект «SEO · сайт» для задач
    AiEmployeesModule, // задачи = действия ИИ SEO-менеджера (права/согласования)
    NotificationsModule,
  ],
  controllers: [SeoAiController],
  providers: [SeoAiService, SeoAiScheduler, SeoAiSignalsService],
})
export class SeoAiModule {}
