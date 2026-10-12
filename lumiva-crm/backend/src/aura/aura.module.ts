import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from '../leads/lead.entity';
import { Sale } from '../sales/sale.entity';
import { Contact } from '../contacts/contact.entity';
import { Call } from '../telephony/call.entity';
import { Reservation } from '../bookings/reservation.entity';
import { BookingLocation } from '../bookings/booking-location.entity';
import { HotelReservation } from '../hotels/hotel-reservation.entity';
import { Hotel } from '../hotels/hotel.entity';
import { Product } from '../products/product.entity';
import { ProductStockMovement } from '../products/product-stock-movement.entity';
import { MarketingTraffic } from '../marketing/marketing-traffic.entity';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { CurrencyModule } from '../currency/currency.module';
import { RbacModule } from '../rbac/rbac.module';
import { DataVisibilityModule } from '../data-visibility/data-visibility.module';
import { LeadsModule } from '../leads/leads.module';
import { BookingsModule } from '../bookings/bookings.module';
import { AiModule } from '../ai/ai.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { AuraController } from './aura.controller';
import { AuraPublicController } from './aura-public.controller';
import { AuraService } from './aura.service';
import { AuraDataService } from './aura-data.service';
import { AuraAiService } from './aura-ai.service';

/** Aura: приложения-дашборды на живых данных CRM, с ИИ-конструктором и публичными ссылками. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lead, Sale, Contact, Call, Reservation, BookingLocation, HotelReservation, Hotel,
      Product, ProductStockMovement, MarketingTraffic, Tenant, User, StaffUser,
    ]),
    CurrencyModule,
    RbacModule,
    DataVisibilityModule,
    LeadsModule,
    BookingsModule,
    AiModule,
    PlatformSettingsModule,
  ],
  controllers: [AuraController, AuraPublicController],
  providers: [AuraService, AuraDataService, AuraAiService],
})
export class AuraModule {}
