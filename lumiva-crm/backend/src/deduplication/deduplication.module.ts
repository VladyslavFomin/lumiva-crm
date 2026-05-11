import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DuplicatePair } from './duplicate-pair.entity';
import { DeduplicationService } from './deduplication.service';
import { DeduplicationController } from './deduplication.controller';
import { Contact } from '../contacts/contact.entity';
import { Lead } from '../leads/lead.entity';
import { Company } from '../companies/company.entity';
import { Sale } from '../sales/sale.entity';
import { MarketingSegment } from '../marketing/marketing-segment.entity';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DuplicatePair, Contact, Lead, Company, Sale, MarketingSegment]),
    RbacModule,
  ],
  controllers: [DeduplicationController],
  providers: [DeduplicationService],
  exports: [DeduplicationService],
})
export class DeduplicationModule {}
