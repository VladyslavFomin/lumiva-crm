// src/onboarding/onboarding.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Tenant } from '../tenants/tenant.entity';
import { Company } from '../companies/company.entity';
import { Contact } from '../contacts/contact.entity';
import { Lead } from '../leads/lead.entity';
import { Product } from '../products/product.entity';
import { Sale } from '../sales/sale.entity';
import { SalesChannel } from '../sales-channels/sales-channel.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { Project } from '../projects/project.entity';
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
    @InjectRepository(SalesChannel) private readonly salesChannelRepo: Repository<SalesChannel>,
    @InjectRepository(StaffUser) private readonly staffRepo: Repository<StaffUser>,
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
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

  /**
   * Тот же "прямой" канал, что и у витрины/embed-форм (`SalesService.resolveDirectSalesChannel`,
   * integrationId: 'storefront') — без него demo-продажа не проходит `applyListedSalesOnlyJoin`
   * (список/статистика продаж требуют активный канал) и выглядит как "пропавшая" сразу после
   * онбординга нового тенанта.
   */
  private async resolveDirectSalesChannel(
    manager: EntityManager,
    tenantId: string,
    currency: string,
  ): Promise<SalesChannel> {
    const existing = await manager.findOne(SalesChannel, {
      where: { tenantId, integrationId: 'storefront', isDeleted: false } as any,
    });
    if (existing) return existing;

    const channel = manager.create(SalesChannel, {
      tenantId,
      name: 'Витрина и формы на сайте',
      type: 'direct',
      integrationId: 'storefront',
      integrationName: 'Витрина и формы на сайте',
      currency: currency || 'EUR',
      isEnabled: true,
      isDeleted: false,
    } as any);
    return manager.save(channel) as unknown as Promise<SalesChannel>;
  }

  async seedSampleData(tenantId: string): Promise<OnboardingStateDto> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (tenant?.sampleDataSeededAt) {
      // Idempotent — a second click (double-submit, page refresh mid-request) is a no-op.
      return this.getState(tenantId);
    }

    // ~15 вставок в одном вызове, раньше без единой транзакции — сбой на середине (например,
    // между продуктами и проектом) оставлял тенанта с частично засеянными демо-данными и БЕЗ
    // `sampleDataSeededAt`, так что "Показать пример" на фронте предлагал бы засеять ещё раз
    // поверх уже частично созданного, а не по-настоящему пусто.
    await this.tenantRepo.manager.transaction(async (manager) => {
      const track = async (entityType: OnboardingSampleEntityType, entityId: string) => {
        await manager.save(manager.create(OnboardingSampleRecord, { tenantId, entityType, entityId }));
      };

      const company = await manager.save(
        manager.create(Company, {
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
        const contact = await manager.save(
          manager.create(Contact, {
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
        const lead = await manager.save(
          manager.create(Lead, {
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
        const product = await manager.save(
          manager.create(Product, {
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

      // Проект в работе — с парой задач, чтобы разделы «Проекты» и «Задачи» тоже не были пустыми.
      const inProgressProject = await manager.save(
        manager.create(Project, {
          tenantId,
          name: `${SAMPLE_TAG}Внедрение CRM для Atlas Trading`,
          status: 'В работе',
          companyId: company.id,
          contactId: contacts[0]?.id || null,
          amount: '1650',
          currency: 'EUR',
          tasks: [
            {
              id: randomUUID(),
              title: 'Собрать требования у клиента',
              assignees: [],
              status: 'Готово',
              priority: 'Обычный',
              deadline: null,
              checklist: [],
            },
            {
              id: randomUUID(),
              title: 'Настроить воронку продаж',
              assignees: [],
              status: 'В работе',
              priority: 'Высокий',
              deadline: null,
              checklist: [
                { id: randomUUID(), title: 'Статусы лидов', done: true },
                { id: randomUUID(), title: 'Автоматизации', done: false },
              ],
            },
          ],
        } as Partial<Project>),
      );
      await track('project', inProgressProject.id);

      const wonLead = leads.find((l) => l.status === 'won');
      let wonProjectId: string | null = null;
      if (wonLead) {
        // Проект, выигранный по этому лиду — показывает связку Лид → Проект → Продажа.
        const wonProject = await manager.save(
          manager.create(Project, {
            tenantId,
            name: `${SAMPLE_TAG}Пакет "Старт" — Marco Rossi`,
            status: 'Выиграно',
            leadId: wonLead.id,
            companyId: company.id,
            contactId: contacts[0]?.id || null,
            amount: '450',
            currency: 'EUR',
            tasks: [
              {
                id: randomUUID(),
                title: 'Выставить счёт',
                assignees: [],
                status: 'Готово',
                priority: 'Обычный',
                deadline: null,
                checklist: [],
              },
            ],
          } as Partial<Project>),
        );
        await track('project', wonProject.id);
        wonProjectId = wonProject.id;

        const demoChannel = await this.resolveDirectSalesChannel(manager, tenantId, 'EUR');
        const sale = await manager.save(
          manager.create(Sale, {
            tenantId,
            leadId: wonLead.id,
            projectId: wonProjectId,
            contactId: contacts[0]?.id || null,
            channelId: demoChannel.id,
            amount: 450,
            currency: 'EUR',
            status: 'confirmed',
            saleDate: new Date(),
            managerName: SAMPLE_TAG + 'Демо-менеджер',
          } as Partial<Sale>),
        );
        await track('sale', sale.id);
      }

      await manager.update(Tenant, { id: tenantId }, { sampleDataSeededAt: new Date() });
    });

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
      project: this.projectRepo,
      lead: this.leadRepo,
      contact: this.contactRepo,
      company: this.companyRepo,
      product: this.productRepo,
    };
    // Delete children before parents to avoid FK issues on entities without ON DELETE CASCADE
    // toward these particular columns: sales.project_id -> crm_projects and
    // crm_projects.lead_id -> leads both have no cascade, so sale must go before project, and
    // project before lead.
    const order: OnboardingSampleEntityType[] = ['sale', 'project', 'lead', 'contact', 'product', 'company'];
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
