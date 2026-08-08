// src/portal/portal.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Contact } from '../contacts/contact.entity';
import { Reservation } from '../bookings/reservation.entity';
import { Sale } from '../sales/sale.entity';
import { MailModule } from '../mail/mail.module';
import { HelpdeskModule } from '../helpdesk/helpdesk.module';
import { PortalService } from './portal.service';
import { PortalController } from './portal.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Contact, Reservation, Sale]), MailModule, HelpdeskModule],
  providers: [PortalService],
  controllers: [PortalController],
})
export class PortalModule {}
