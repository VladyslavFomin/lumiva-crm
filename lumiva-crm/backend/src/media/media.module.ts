// src/media/media.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaCollection, MediaEvent, MediaFile, MediaFolder, MediaLink, MediaSettings, MediaUpload, MediaVisitor } from './media.entities';
import { Hotel } from '../hotels/hotel.entity';
import { Tenant } from '../tenants/tenant.entity';
import { Lead } from '../leads/lead.entity';
import { Contact } from '../contacts/contact.entity';
import { Company } from '../companies/company.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { RbacModule } from '../rbac/rbac.module';
import { LeadsModule } from '../leads/leads.module';
import { StorageQuotaModule } from '../storage-quota/storage-quota.module';
import { MediaService } from './media.service';
import { MediaPublicService } from './media-public.service';
import { MediaController, MediaPublicController } from './media.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaCollection, MediaFolder, MediaFile, MediaLink, MediaEvent, MediaVisitor, MediaSettings, MediaUpload, Hotel, Tenant, Lead, Contact, Company, StaffUser]),
    RbacModule,
    forwardRef(() => LeadsModule),
    StorageQuotaModule,
  ],
  providers: [MediaService, MediaPublicService],
  controllers: [MediaController, MediaPublicController],
  exports: [MediaService],
})
export class MediaModule {}
