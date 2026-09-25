import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewPlace } from './review-place.entity';
import { ReviewItem } from './review-item.entity';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { AiAgent } from '../ai-employees/ai-agent.entity';
import { Project } from '../projects/project.entity';
import { AiEmployeesModule } from '../ai-employees/ai-employees.module';
import { ProjectsModule } from '../projects/projects.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { EmailModule } from '../email/email.module';
import { ReviewsAiService } from './reviews-ai.service';
import { ReviewsAiController } from './reviews-ai.controller';
import { ReviewsAiScheduler } from './reviews-ai.scheduler';

/** ИИ-менеджер отзывов: мониторинг Google-отзывов, черновики ответов на языке отзыва, сигналы о негативе. */
@Module({
  imports: [
    TypeOrmModule.forFeature([ReviewPlace, ReviewItem, Tenant, User, AiAgent, Project]),
    AiEmployeesModule,
    ProjectsModule,
    NotificationsModule,
    MailModule,
    EmailModule,
  ],
  controllers: [ReviewsAiController],
  providers: [ReviewsAiService, ReviewsAiScheduler],
})
export class ReviewsAiModule {}
