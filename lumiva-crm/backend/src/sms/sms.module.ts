import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsConfig } from './sms-config.entity';
import { SmsMessage } from './sms-message.entity';
import { SmsService } from './sms.service';
import { SmsController } from './sms.controller';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SmsConfig, SmsMessage]),
    RbacModule,
  ],
  controllers: [SmsController],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
