// src/payments/payments.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Payment } from './payment.entity';
import { Sale } from '../sales/sale.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { IyzicoApiService } from '../integrations/iyzico/iyzico-api.service';
import { PaytrApiService } from '../integrations/paytr/paytr-api.service';
import { YookassaApiService } from '../integrations/yookassa/yookassa-api.service';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Sale, IntegrationConnection]), RbacModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, IyzicoApiService, PaytrApiService, YookassaApiService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
