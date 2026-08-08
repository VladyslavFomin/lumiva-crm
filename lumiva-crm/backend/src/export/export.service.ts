// src/export/export.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class ExportService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Lead) private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Contact) private readonly contactRepo: Repository<Contact>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(Sale) private readonly saleRepo: Repository<Sale>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Reservation) private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(HotelReservation) private readonly hotelReservationRepo: Repository<HotelReservation>,
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(StaffUser) private readonly staffRepo: Repository<StaffUser>,
  ) {}

  async buildBackup(tenantId: string) {
    const [tenant, leads, contacts, companies, sales, products, reservations, hotelReservations, projects, staff] =
      await Promise.all([
        this.tenantRepo.findOne({ where: { id: tenantId } }),
        this.leadRepo.find({ where: { tenantId } }),
        this.contactRepo.find({ where: { tenantId } }),
        this.companyRepo.find({ where: { tenantId } }),
        this.saleRepo.find({ where: { tenantId } }),
        this.productRepo.find({ where: { tenantId } }),
        this.reservationRepo.find({ where: { tenantId } }),
        this.hotelReservationRepo.find({ where: { tenantId } }),
        this.projectRepo.find({ where: { tenantId } }),
        this.staffRepo.find({ where: { tenantId } }),
      ]);

    // Staff rows carry auth-adjacent fields that don't belong in a portable data export.
    const staffSafe = staff.map(({ passwordResetToken, passwordResetTokenExpiresAt, ...rest }) => rest);

    return {
      exportedAt: new Date().toISOString(),
      tenant: tenant
        ? { id: tenant.id, name: tenant.name, clientKey: tenant.clientKey, plan: tenant.plan, createdAt: tenant.createdAt }
        : null,
      counts: {
        leads: leads.length,
        contacts: contacts.length,
        companies: companies.length,
        sales: sales.length,
        products: products.length,
        bookings: reservations.length,
        hotelReservations: hotelReservations.length,
        projects: projects.length,
        staff: staffSafe.length,
      },
      leads,
      contacts,
      companies,
      sales,
      products,
      bookings: reservations,
      hotelReservations,
      projects,
      staff: staffSafe,
    };
  }
}
