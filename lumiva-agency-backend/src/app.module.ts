import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ThrottlerModule } from '@nestjs/throttler'
import { ServeStaticModule } from '@nestjs/serve-static'
import { join } from 'path'

import { AuthModule } from './auth/auth.module'
import { BlogModule } from './blog/blog.module'
import { CasesModule } from './cases/cases.module'
import { FormsModule } from './forms/forms.module'
import { MediaModule } from './media/media.module'
import { CrmModule } from './crm/crm.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { SettingsModule } from './settings/settings.module'
import { NewsletterModule } from './newsletter/newsletter.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get('DB_HOST', 'localhost'),
        port: +cfg.get('DB_PORT', '5432'),
        username: cfg.get('DB_USER', 'lumiva'),
        password: cfg.get('DB_PASS', 'supersecret'),
        database: cfg.get('DB_NAME', 'lumiva_agency'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true,
        logging: false,
      }),
    }),

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),

    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),

    AuthModule,
    BlogModule,
    CasesModule,
    FormsModule,
    MediaModule,
    CrmModule,
    DashboardModule,
    SettingsModule,
    NewsletterModule,
  ],
})
export class AppModule {}
