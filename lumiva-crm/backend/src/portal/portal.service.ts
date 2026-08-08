// src/portal/portal.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Contact } from '../contacts/contact.entity';
import { Reservation } from '../bookings/reservation.entity';
import { Sale } from '../sales/sale.entity';
import { MailService } from '../mail/mail.service';
import {
  signPortalMagicLinkToken,
  signPortalSessionToken,
  verifyPortalMagicLinkToken,
} from './portal-token.util';

@Injectable()
export class PortalService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Contact) private readonly contactRepo: Repository<Contact>,
    @InjectRepository(Reservation) private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(Sale) private readonly saleRepo: Repository<Sale>,
    private readonly mail: MailService,
  ) {}

  private get secret(): string {
    const s = process.env.JWT_SECRET;
    if (!s) throw new UnauthorizedException('Portal auth misconfigured');
    return s;
  }

  /** Always returns the same generic response regardless of whether the email matched a Contact —
   * avoids leaking which emails exist in a tenant's contact list. */
  async requestMagicLink(clientKey: string, email: string): Promise<{ ok: true }> {
    const normalizedEmail = email.trim().toLowerCase();
    const tenant = await this.tenantRepo.findOne({ where: { clientKey: clientKey.trim().toLowerCase() } });
    if (!tenant) return { ok: true };

    const contact = await this.contactRepo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId: tenant.id })
      .andWhere('LOWER(c.email) = :email', { email: normalizedEmail })
      .getOne();
    if (!contact) return { ok: true };

    const token = signPortalMagicLinkToken(contact.id, tenant.id, this.secret);
    const loginUrl = `${(process.env.FRONTEND_URL || 'https://crm.lumiva.agency').replace(/\/$/, '')}/portal/${tenant.clientKey}/verify?token=${token}`;
    const displayName = contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'клиент';

    await this.mail.sendMail({
      to: contact.email!,
      subject: `Вход в личный кабинет — ${tenant.name}`,
      html: `<!doctype html><html><body style="font-family:sans-serif;color:#0f172a;padding:24px;">
        <p>Здравствуйте, ${displayName}!</p>
        <p>Вот ваша ссылка для входа в личный кабинет <strong>${tenant.name}</strong> (действует 15 минут):</p>
        <p><a href="${loginUrl}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;border-radius:8px;text-decoration:none;">Войти в личный кабинет</a></p>
        <p style="font-size:12px;color:#64748b;">Если вы не запрашивали вход, просто проигнорируйте это письмо.</p>
      </body></html>`,
    });

    return { ok: true };
  }

  async verifyMagicLink(token: string): Promise<{ sessionToken: string }> {
    const result = verifyPortalMagicLinkToken(token, this.secret);
    if (!result.valid) throw new UnauthorizedException('Ссылка недействительна или истекла');
    const contact = await this.contactRepo.findOne({ where: { id: result.contactId, tenantId: result.tenantId } });
    if (!contact) throw new UnauthorizedException('Контакт не найден');
    return { sessionToken: signPortalSessionToken(contact.id, contact.tenantId, this.secret) };
  }

  async getMe(contactId: string, tenantId: string) {
    const [contact, tenant] = await Promise.all([
      this.contactRepo.findOne({ where: { id: contactId, tenantId } }),
      this.tenantRepo.findOne({ where: { id: tenantId } }),
    ]);
    if (!contact) throw new UnauthorizedException('Контакт не найден');
    return {
      id: contact.id,
      name: contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' '),
      email: contact.email,
      phone: contact.phone,
      companyName: tenant?.name || null,
    };
  }

  async getBookings(contactId: string, tenantId: string) {
    const rows = await this.reservationRepo.find({
      where: { tenantId, contactId },
      order: { startAt: 'DESC' },
    });
    return rows.map((r) => ({
      id: r.id,
      startAt: r.startAt,
      endAt: r.endAt,
      status: r.status,
      participants: r.participants,
      price: r.price,
      currency: r.currency,
    }));
  }

  async getOrders(contactId: string, tenantId: string) {
    const rows = await this.saleRepo.find({
      where: { tenantId, contactId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((s) => ({
      id: s.id,
      date: s.saleDate || s.createdAt,
      amount: s.amount,
      currency: s.currency,
      status: s.status,
      externalOrderNo: s.externalOrderNo,
    }));
  }
}
