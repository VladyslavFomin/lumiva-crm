// src/bi-dashboard/bi-dashboard.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BiDashboardController } from './bi-dashboard.controller';
import { BiDashboardService } from './bi-dashboard.service';
import { Lead } from '../leads/lead.entity';
import { Sale } from '../sales/sale.entity';
import { Product } from '../products/product.entity';
import { Reservation } from '../bookings/reservation.entity';
import { HotelReservation } from '../hotels/hotel-reservation.entity';
import { Hotel } from '../hotels/hotel.entity';
import { Call } from '../telephony/call.entity';
import { SmsMessage } from '../sms/sms-message.entity';
import { Tenant } from '../tenants/tenant.entity';
import { Contact } from '../contacts/contact.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { RbacModule } from '../rbac/rbac.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lead, Sale, Product, Reservation, HotelReservation, Hotel, Call, SmsMessage, Tenant, Contact, StaffUser]),
    RbacModule,
    CompaniesModule,
  ],
  controllers: [BiDashboardController],
  providers: [BiDashboardService],
})
export class BiDashboardModule {}
