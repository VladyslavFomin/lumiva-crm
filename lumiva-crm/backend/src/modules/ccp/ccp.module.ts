import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CcpService } from './ccp.service';
import { CcpController } from './ccp.controller';
import { CcpIngestController } from './ccp.ingest.controller';
import { CcpPublicController } from './ccp.public.controller';

import { CcpSiteEntity } from './entities/ccp-site.entity';
import { CcpClientEntity } from './entities/ccp-client.entity';
import { CcpTxnEntity } from './entities/ccp-txn.entity';
import { CcpTransferEntity } from './entities/ccp-transfer.entity';

// ✅ токены (tenant token из CRM)
import { ApiTokensModule } from '../../api-tokens/api-tokens.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CcpSiteEntity,
      CcpClientEntity,
      CcpTxnEntity,
      CcpTransferEntity,
    ]),
    ApiTokensModule,
  ],
  controllers: [CcpController, CcpIngestController, CcpPublicController],
  providers: [CcpService],
  exports: [CcpService],
})
export class CcpModule {}