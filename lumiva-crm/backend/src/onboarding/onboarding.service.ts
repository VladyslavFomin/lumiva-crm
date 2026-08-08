// src/onboarding/onboarding.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Company } from '../companies/company.entity';
import { Contact } from '../contacts/contact.entity';
import { Lead } from '../leads/lead.entity';
import { Product } from '../products/product.entity';
import { Sale } from '../sales/sale.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { OnboardingSampleRecord, OnboardingSampleEntityType } from './onboarding-sample-record.entity';

export interface OnboardingStateDto {
  onboardingCompletedAt: string | null;
  sampleDataSeededAt: string | null;
  teamInvited: boolean;
}

const SAMPLE_TAG = '[Пример] ';

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(Contact) private readonly contactRepo: Repository<Contact>,
    @InjectRepository(Lead) private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Sale) private readonly saleRepo: Repository<Sale>,
    @InjectRepository(StaffUser) private readonly staffRepo: Repository<StaffUser>,
    @InjectRepository(OnboardingSampleRecord) private readonly sampleRepo: Repository<OnboardingSampleRecord>,
  ) {}

  async getState(tenantId: string): Promise<OnboardingStateDto> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const staffCount = await this.staffRepo.count({ where: { tenantId } });
    return {
      onboardingCompletedAt: tenant?.onboardingCompletedAt?.toISOString() || null,
      sampleDataSeededAt: tenant?.sampleDataSeededAt?.toISOString() || null,
      teamInvited: staffCount >= 2,
    };
  }

  async complete(tenantId: string): Promise<OnboardingStateDto> {
    await this.tenantRepo.update({ id: tenantId }, { onboardingCompletedAt: new Date() });
    return this.getState(tenantId);
  }

  async seedSampleData(tenantId: string): Promise<OnboardingStateDto> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (tenant?.sampleDataSeededAt) {
      // Idempotent — a second click (double-submit, page refresh mid-request) is a no-op.
      return this.getState(tenantId);
    }

    const track = async (entityType: OnboardingSampleEntityType, entityId: string) => {
      await this.sampleRepo.save(this.sampleRepo.create({ tenantId, entityType, entityId }));
    };

    const company = await this.companyRepo.save(
      this.companyRepo.create({
        tenantId,
        name: SAMPLE_TAG + 'Atlas Trading LLC',
        email: 'contact@atlas-example.com',
        website: 'https://atlas-example.com',
        country: 'DE',
        city: 'Berlin',
      }),
    );
    await track('company', company.id);

    const contactsData = [
      { firstName: 'Anna', lastName: 'Keller', email: 'anna.keller@atlas-example.com', phone: '+49 30 1234567' },
      { firstName: 'Marco', lastName: 'Rossi', email: 'marco.rossi@atlas-example.com', phone: '+49 30 7654321' },
    ];
    const contacts: Contact[] = [];
    for (const c of contactsData) {
      const contact = await this.contactRepo.save(
        this.contactRepo.create({
          tenantId,
          firstName: SAMPLE_TAG.trim(),
          lastName: `${c.firstName} ${c.lastName}`,
          fullName: `${SAMPLE_TAG}${c.firstName} ${c.lastName}`,
          email: c.email,
          phone: c.phone,
          companyId: company.id,
        } as Partial<Contact>),
      );
      await track('contact', contact.id);
      contacts.push(contact);
    }

    const leadsData: Array<{ name: string; status: string; source: string }> = [
      { name: `${SAMPLE_TAG}Anna Keller — интерес к тарифу Pro`, status: 'new', source: 'web' },
      { name: `${SAMPLE_TAG}Marco Rossi — запрос демо`, status: 'in_progress', source: 'crm' },
      { name: `${SAMPLE_TAG}Заявка с сайта`, status: 'waiting', source: 'web' },
      { name: `${SAMPLE_TAG}Сделка закрыта`, status: 'won', source: 'crm' },
    ];
    const leads: Lead[] = [];
    for (let i = 0; i < leadsData.length; i++) {
      const d = leadsData[i];
      const lead = await this.leadRepo.save(
        this.leadRepo.create({
          tenantId,
          name: d.name,
          status: d.status,
          source: d.source,
          companyId: company.id,
          contactId: contacts[i % contacts.length]?.id || null,
          email: contacts[i % contacts.length]?.email || null,
          phone: contacts[i % contacts.length]?.phone || null,
        } as Partial<Lead>),
      );
      await track('lead', lead.id);
      leads.push(lead);
    }

    const productsData = [
      { name: `${SAMPLE_TAG}Консультация — 1 час`, price: 90, quantity: 40, lowStockThreshold: null as number | null },
      { name: `${SAMPLE_TAG}Пакет "Старт"`, price: 450, quantity: 12, lowStockThreshold: 5 },
      { name: `${SAMPLE_TAG}Пакет "Про" (мало на складе)`, price: 1200, quantity: 2, lowStockThreshold: 5 },
    ];
    for (const p of productsData) {
      const product = await this.productRepo.save(
        this.productRepo.create({
          tenantId,
          name: p.name,
          status: 'active',
          price: String(p.price),
          currency: 'EUR',
          quantity: p.quantity,
          lowStockThreshold: p.lowStockThreshold,
        } as Partial<Product>),
      );
      await track('product', product.id);
    }

    const wonLead = leads.find((l) => l.status === 'won');
    if (wonLead) {
      const sale = await this.saleRepo.save(
        this.saleRepo.create({
          tenantId,
          leadId: wonLead.id,
          contactId: contacts[0]?.id || null,
          amount: 450,
          currency: 'EUR',
          status: 'confirmed',
          saleDate: new Date(),
          managerName: SAMPLE_TAG + 'Демо-менеджер',
        } as Partial<Sale>),
      );
      await track('sale', sale.id);
    }

    await this.tenantRepo.update({ id: tenantId }, { sampleDataSeededAt: new Date() });
    return this.getState(tenantId);
  }

  async removeSampleData(tenantId: string): Promise<OnboardingStateDto> {
    const records = await this.sampleRepo.find({ where: { tenantId } });
    const idsByType = new Map<OnboardingSampleEntityType, string[]>();
    for (const r of records) {
      const list = idsByType.get(r.entityType) || [];
      list.push(r.entityId);
      idsByType.set(r.entityType, list);
    }

    const repoFor: Record<OnboardingSampleEntityType, Repository<any>> = {
      sale: this.saleRepo,
      lead: this.leadRepo,
      contact: this.contactRepo,
      company: this.companyRepo,
      product: this.productRepo,
    };
    // Delete children before parents (sale/lead before contact/company) to avoid FK issues on
    // entities without ON DELETE CASCADE toward these particular columns.
    const order: OnboardingSampleEntityType[] = ['sale', 'lead', 'contact', 'product', 'company'];
    for (const type of order) {
      const ids = idsByType.get(type);
      if (!ids?.length) continue;
      await repoFor[type].delete(ids);
    }

    await this.sampleRepo.delete({ tenantId });
    await this.tenantRepo.update({ id: tenantId }, { sampleDataSeededAt: null });
    return this.getState(tenantId);
  }
}
