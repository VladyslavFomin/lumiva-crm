// src/export/export.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Lead } from '../leads/lead.entity';
import { Contact } from '../contacts/contact.entity';
import { Company } from '../companies/company.entity';
import { Sale } from '../sales/sale.entity';
import { Product } from '../products/product.entity';
import { Reservation } from '../bookings/reservation.entity';
import { HotelReservation } from '../hotels/hotel-reservation.entity';
import { Project } from '../projects/project.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { RbacModule } from '../rbac/rbac.module';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      Lead,
      Contact,
      Company,
      Sale,
      Product,
      Reservation,
      HotelReservation,
      Project,
      StaffUser,
    ]),
    RbacModule,
  ],
  providers: [ExportService],
  controllers: [ExportController],
})
export class ExportModule {}
