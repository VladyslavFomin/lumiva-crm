import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, MoreThanOrEqual, Repository } from 'typeorm';
import { randomUUID, randomBytes } from 'crypto';

import { Payment, PaymentProvider, PaymentSource } from './payment.entity';
import { Sale } from '../sales/sale.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import {
  IyzicoApiService,
  type IyzicoCredentials,
} from '../integrations/iyzico/iyzico-api.service';
import {
  PaytrApiService,
  type PaytrCredentials,
} from '../integrations/paytr/paytr-api.service';
import {
  YookassaApiService,
  type YookassaCredentials,
} from '../integrations/yookassa/yookassa-api.service';
import {
  toPaymentDto,
  type PaymentDto,
  type PaymentListItemDto,
  type PaymentsAnalyticsDto,
} from './payment.dto';

const CURRENCIES_BY_PROVIDER: Record<PaymentProvider, string[]> = {
  iyzico: ['TRY', 'EUR', 'USD', 'GBP'],
  paytr: ['TRY', 'EUR', 'USD', 'GBP'],
  yookassa: ['RUB'],
};

const PROVIDER_LABEL: Record<PaymentProvider, string> = {
  iyzico: 'iyzico',
  paytr: 'PayTR',
  yookassa: 'ЮKassa',
};

type BuyerInput = {
  name: string;
  email: string;
  phone?: string;
  city: string;
  address: string;
  ip: string;
};

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly repo: Repository<Payment>,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(IntegrationConnection)
    private readonly integrationRepo: Repository<IntegrationConnection>,
    private readonly iyzico: IyzicoApiService,
    private readonly paytr: PaytrApiService,
    private readonly yookassa: YookassaApiService,
  ) {}

  private callbackUrl(provider: PaymentProvider): string {
    const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    if (!base) {
      throw new BadRequestException(
        'PUBLIC_API_URL не задан на сервере — без него провайдер не сможет вернуть покупателя обратно',
      );
    }
    return `${base}/v1/payments/${provider}/callback`;
  }

  private async findConnectionConfig(
    tenantId: string,
    provider: PaymentProvider,
  ): Promise<Record<string, unknown>> {
    const rows = await this.integrationRepo.find({
      where: { tenantId, isDeleted: false, kind: 'third_party_link' } as any,
    });
    const row = rows.find((r) => {
      if (!r.isEnabled || !r.configJson) return false;
      try {
        const cfg = JSON.parse(r.configJson) as { catalogId?: string };
        return cfg.catalogId === provider;
      } catch {
        return false;
      }
    });
    if (!row?.configJson) {
      throw new BadRequestException(
        `Подключите ${PROVIDER_LABEL[provider]} в разделе «Интеграции», прежде чем выставлять счета`,
      );
    }
    return JSON.parse(row.configJson) as Record<string, unknown>;
  }

  private async getIyzicoCredentials(tenantId: string): Promise<IyzicoCredentials> {
    const cfg = await this.findConnectionConfig(tenantId, 'iyzico');
    const apiKey = String(cfg.apiKey || '').trim();
    const secretKey = String(cfg.apiToken || '').trim();
    if (!apiKey || !secretKey) {
      throw new BadRequestException('Подключение iyzico настроено не полностью — укажите API key и Secret key');
    }
    return { apiKey, secretKey, sandbox: cfg.sandbox !== false };
  }

  private async getPaytrCredentials(tenantId: string): Promise<PaytrCredentials> {
    const cfg = await this.findConnectionConfig(tenantId, 'paytr');
    const merchantId = String(cfg.apiKey || '').trim();
    const merchantKey = String(cfg.apiToken || '').trim();
    const merchantSalt = String(cfg.webhookInboundSecret || '').trim();
    if (!merchantId || !merchantKey || !merchantSalt) {
      throw new BadRequestException(
        'Подключение PayTR настроено не полностью — укажите Merchant ID, Merchant key и Merchant salt',
      );
    }
    return { merchantId, merchantKey, merchantSalt, testMode: cfg.sandbox !== false };
  }

  private async getYookassaCredentials(tenantId: string): Promise<YookassaCredentials> {
    const cfg = await this.findConnectionConfig(tenantId, 'yookassa');
    const shopId = String(cfg.apiKey || '').trim();
    const secretKey = String(cfg.apiToken || '').trim();
    if (!shopId || !secretKey) {
      throw new BadRequestException('Подключение ЮKassa настроено не полностью — укажите shopId и Secret key');
    }
    return { shopId, secretKey };
  }

  private validateCurrency(provider: PaymentProvider, currency: string): string {
    const c = (currency || '').toUpperCase();
    const allowed = CURRENCIES_BY_PROVIDER[provider];
    if (!allowed.includes(c)) {
      throw new BadRequestException(
        `${PROVIDER_LABEL[provider]} не поддерживает валюту ${currency} (доступны ${allowed.join(', ')})`,
      );
    }
    return c;
  }

  private async initCheckout(params: {
    tenantId: string;
    provider: PaymentProvider;
    source: PaymentSource;
    saleId: string | null;
    amount: number;
    currency: string;
    basketItems: { id: string; name: string; category1: string; price: string }[];
    buyer: BuyerInput;
    locale?: 'tr' | 'en';
  }): Promise<PaymentDto> {
    if (params.amount <= 0) {
      throw new BadRequestException('Сумма к оплате должна быть больше нуля');
    }
    if (params.saleId) {
      // Раньше ничего не мешало создать сколько угодно независимых чекаут-сессий на одну и ту
      // же продажу (повторная отправка ссылки, обновление страницы витрины) — каждая из них
      // реальная отдельная оплата у провайдера, без предупреждения в CRM. Превращаем прежние
      // незавершённые ссылки в 'cancelled', раз выпускается новая.
      await this.repo.update(
        { tenantId: params.tenantId, saleId: params.saleId, status: 'pending' } as any,
        { status: 'cancelled' },
      );
    }
    const currency = this.validateCurrency(params.provider, params.currency);

    if (params.provider === 'paytr') {
      return this.initCheckoutPaytr({ ...params, currency: currency as 'TRY' | 'EUR' | 'USD' | 'GBP' });
    }
    if (params.provider === 'yookassa') {
      return this.initCheckoutYookassa({ ...params, currency });
    }
    return this.initCheckoutIyzico({ ...params, currency: currency as 'TRY' | 'EUR' | 'USD' | 'GBP' });
  }

  private async initCheckoutIyzico(params: {
    tenantId: string;
    source: PaymentSource;
    saleId: string | null;
    amount: number;
    currency: 'TRY' | 'EUR' | 'USD' | 'GBP';
    basketItems: { id: string; name: string; category1: string; price: string }[];
    buyer: BuyerInput;
    locale?: 'tr' | 'en';
  }): Promise<PaymentDto> {
    const creds = await this.getIyzicoCredentials(params.tenantId);
    const conversationId = randomUUID();
    const basketId = params.saleId || conversationId;

    let result;
    try {
      result = await this.iyzico.initializeCheckoutForm(creds, {
        conversationId,
        price: params.amount,
        currency: params.currency,
        basketId,
        callbackUrl: this.callbackUrl('iyzico'),
        buyer: {
          id: params.saleId || conversationId,
          name: params.buyer.name.split(' ').slice(0, -1).join(' ') || params.buyer.name,
          surname: params.buyer.name.split(' ').slice(-1).join(' ') || params.buyer.name,
          email: params.buyer.email,
          gsmNumber: params.buyer.phone,
          registrationAddress: params.buyer.address,
          ip: params.buyer.ip,
          city: params.buyer.city,
          country: 'Turkey',
        },
        basketItems: params.basketItems,
        locale: params.locale,
      });
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'iyzico: не удалось создать форму оплаты');
    }

    const payment = this.repo.create({
      tenantId: params.tenantId,
      provider: 'iyzico',
      status: 'pending',
      amount: params.amount,
      currency: params.currency,
      saleId: params.saleId,
      source: params.source,
      token: result.token || null,
      conversationId,
      paymentPageUrl: result.paymentPageUrl || null,
      providerRaw: result as unknown as Record<string, unknown>,
    });
    const saved = await this.repo.save(payment);
    return toPaymentDto(saved);
  }

  private async initCheckoutPaytr(params: {
    tenantId: string;
    source: PaymentSource;
    saleId: string | null;
    amount: number;
    currency: 'TRY' | 'EUR' | 'USD' | 'GBP';
    basketItems: { id: string; name: string; category1: string; price: string }[];
    buyer: BuyerInput;
  }): Promise<PaymentDto> {
    const creds = await this.getPaytrCredentials(params.tenantId);
    const merchantOid = randomBytes(16).toString('hex');
    const frontend = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    if (!frontend) {
      throw new BadRequestException('FRONTEND_URL не задан на сервере');
    }

    let result;
    try {
      result = await this.paytr.getToken(creds, {
        userIp: params.buyer.ip,
        merchantOid,
        email: params.buyer.email,
        amount: params.amount,
        currency: params.currency,
        userName: params.buyer.name,
        userAddress: params.buyer.address,
        userPhone: params.buyer.phone || '00000000000',
        basket: params.basketItems.map((i) => ({ name: i.name, price: i.price, qty: 1 })),
        okUrl: `${frontend}/pay/result?status=paid`,
        failUrl: `${frontend}/pay/result?status=failed`,
      });
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'PayTR: не удалось создать сессию оплаты');
    }
    if (result.status !== 'success' || !result.token) {
      throw new BadRequestException(`PayTR: ${result.reason || 'не удалось создать сессию оплаты'}`);
    }

    const payment = this.repo.create({
      tenantId: params.tenantId,
      provider: 'paytr',
      status: 'pending',
      amount: params.amount,
      currency: params.currency,
      saleId: params.saleId,
      source: params.source,
      token: result.token,
      conversationId: merchantOid,
      paymentPageUrl: this.paytr.paymentPageUrl(result.token),
      providerRaw: result as unknown as Record<string, unknown>,
    });
    const saved = await this.repo.save(payment);
    return toPaymentDto(saved);
  }

  private async initCheckoutYookassa(params: {
    tenantId: string;
    source: PaymentSource;
    saleId: string | null;
    amount: number;
    currency: string;
    basketItems: { id: string; name: string; category1: string; price: string }[];
    buyer: BuyerInput;
  }): Promise<PaymentDto> {
    const creds = await this.getYookassaCredentials(params.tenantId);
    const frontend = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    if (!frontend) {
      throw new BadRequestException('FRONTEND_URL не задан на сервере');
    }

    let result;
    try {
      result = await this.yookassa.createPayment(creds, {
        amount: params.amount,
        currency: params.currency,
        description: params.basketItems.map((i) => i.name).join(', ') || 'Оплата заказа',
        returnUrl: `${frontend}/pay/result?status=paid`,
        metadata: params.saleId ? { saleId: params.saleId } : undefined,
      });
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'ЮKassa: не удалось создать платёж');
    }

    const payment = this.repo.create({
      tenantId: params.tenantId,
      provider: 'yookassa',
      status: 'pending',
      amount: params.amount,
      currency: params.currency,
      saleId: params.saleId,
      source: params.source,
      token: result.id,
      conversationId: result.id,
      paymentPageUrl: result.confirmation?.confirmation_url || null,
      providerRaw: result as unknown as Record<string, unknown>,
    });
    const saved = await this.repo.save(payment);
    return toPaymentDto(saved);
  }

  async createSalePaymentLink(
    tenantId: string,
    saleId: string,
    dto: {
      buyerName: string;
      buyerEmail: string;
      buyerPhone?: string;
      city: string;
      address: string;
      provider?: PaymentProvider;
    },
    ip: string,
  ): Promise<PaymentDto> {
    const sale = await this.saleRepo.findOne({
      where: { id: saleId, tenantId } as any,
    });
    if (!sale) throw new NotFoundException('Продажа не найдена');

    const provider = dto.provider || (await this.findEnabledProvider(tenantId)) || 'iyzico';

    return this.initCheckout({
      tenantId,
      provider,
      source: 'sale_link',
      saleId: sale.id,
      amount: sale.amount,
      currency: sale.currency,
      basketItems: [
        {
          id: sale.id,
          name: sale.externalOrderNo || `Sale ${sale.id.slice(0, 8)}`,
          category1: 'Services',
          price: sale.amount.toFixed(2),
        },
      ],
      buyer: {
        name: dto.buyerName,
        email: dto.buyerEmail,
        phone: dto.buyerPhone,
        city: dto.city,
        address: dto.address,
        ip,
      },
    });
  }

  async createStorefrontPayment(params: {
    tenantId: string;
    sale: Sale;
    provider: PaymentProvider;
    buyer: BuyerInput;
    basketItems: { id: string; name: string; category1: string; price: string }[];
  }): Promise<PaymentDto> {
    return this.initCheckout({
      tenantId: params.tenantId,
      provider: params.provider,
      source: 'storefront',
      saleId: params.sale.id,
      amount: params.sale.amount,
      currency: params.sale.currency,
      basketItems: params.basketItems,
      buyer: params.buyer,
    });
  }

  /** Есть ли у тенанта хотя бы один включённый провайдер оплаты. */
  async findEnabledProvider(tenantId: string): Promise<PaymentProvider | null> {
    const rows = await this.integrationRepo.find({
      where: { tenantId, isDeleted: false, isEnabled: true, kind: 'third_party_link' } as any,
    });
    for (const r of rows) {
      if (!r.configJson) continue;
      try {
        const cfg = JSON.parse(r.configJson) as { catalogId?: string };
        if (cfg.catalogId === 'iyzico' || cfg.catalogId === 'paytr' || cfg.catalogId === 'yookassa') {
          return cfg.catalogId;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  async getPayment(tenantId: string, id: string): Promise<PaymentDto> {
    const row = await this.repo.findOne({ where: { id, tenantId } as any });
    if (!row) throw new NotFoundException('Платёж не найден');
    return toPaymentDto(row);
  }

  async listPayments(
    tenantId: string,
    filters: {
      status?: string;
      provider?: string;
      source?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ items: PaymentListItemDto[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('p')
      .leftJoin(Sale, 's', 's.id = p.saleId')
      .addSelect(['s.externalOrderNo', 's.guestName'])
      .where('p.tenantId = :tenantId', { tenantId });

    if (filters.status) qb.andWhere('p.status = :status', { status: filters.status });
    if (filters.provider) qb.andWhere('p.provider = :provider', { provider: filters.provider });
    if (filters.source) qb.andWhere('p.source = :source', { source: filters.source });
    if (filters.search) {
      qb.andWhere(
        '(s.guestName ILIKE :s OR s.externalOrderNo ILIKE :s OR p.conversationId ILIKE :s)',
        { s: `%${filters.search}%` },
      );
    }

    const total = await qb.getCount();
    qb.orderBy('p.createdAt', 'DESC').take(filters.limit ?? 50).skip(filters.offset ?? 0);
    const rows = await qb.getRawAndEntities();

    const items: PaymentListItemDto[] = rows.entities.map((entity, i) => ({
      ...toPaymentDto(entity),
      saleOrderNo: rows.raw[i]?.s_externalOrderNo ?? null,
      buyerName: rows.raw[i]?.s_guestName ?? null,
    }));
    return { items, total };
  }

  async getPaymentsAnalytics(tenantId: string, days = 30): Promise<PaymentsAnalyticsDto> {
    const since = new Date(Date.now() - days * 86400000);
    const rows = await this.repo.find({
      where: { tenantId, createdAt: MoreThanOrEqual(since) } as any,
      order: { createdAt: 'ASC' },
      take: 5000,
    });

    const totalCount = rows.length;
    const paidRows = rows.filter((r) => r.status === 'paid');
    const failedRows = rows.filter((r) => r.status === 'failed' || r.status === 'cancelled');
    const pendingRows = rows.filter((r) => r.status === 'pending');
    const paidCount = paidRows.length;
    const failedCount = failedRows.length;
    const pendingCount = pendingRows.length;
    const decidedCount = paidCount + failedCount;
    const successRate = decidedCount ? Math.round((paidCount / decidedCount) * 1000) / 10 : 0;

    const providerMap = new Map<string, { provider: string; totalCount: number; paidCount: number; failedCount: number }>();
    for (const r of rows) {
      if (!providerMap.has(r.provider)) {
        providerMap.set(r.provider, { provider: r.provider, totalCount: 0, paidCount: 0, failedCount: 0 });
      }
      const bucket = providerMap.get(r.provider)!;
      bucket.totalCount++;
      if (r.status === 'paid') bucket.paidCount++;
      if (r.status === 'failed' || r.status === 'cancelled') bucket.failedCount++;
    }
    const byProvider = Array.from(providerMap.values()).map((b) => ({
      ...b,
      successRate: b.paidCount + b.failedCount ? Math.round((b.paidCount / (b.paidCount + b.failedCount)) * 1000) / 10 : 0,
    }));

    const currencyMap = new Map<string, { currency: string; paidAmount: number; paidCount: number }>();
    for (const r of paidRows) {
      if (!currencyMap.has(r.currency)) {
        currencyMap.set(r.currency, { currency: r.currency, paidAmount: 0, paidCount: 0 });
      }
      const bucket = currencyMap.get(r.currency)!;
      bucket.paidAmount += r.amount;
      bucket.paidCount++;
    }
    const byCurrency = Array.from(currencyMap.values());

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const dayMap = new Map<string, { date: string; created: number; paid: number; failed: number }>();
    for (let i = 0; i < days; i++) {
      const key = dayKey(new Date(since.getTime() + i * 86400000));
      dayMap.set(key, { date: key, created: 0, paid: 0, failed: 0 });
    }
    for (const r of rows) {
      const bucket = dayMap.get(dayKey(r.createdAt));
      if (!bucket) continue;
      bucket.created++;
      if (r.status === 'paid') bucket.paid++;
      if (r.status === 'failed' || r.status === 'cancelled') bucket.failed++;
    }
    const dailySeries = Array.from(dayMap.values());

    const recentFailures = failedRows
      .slice(-10)
      .reverse()
      .map((r) => ({
        id: r.id,
        provider: r.provider,
        amount: r.amount,
        currency: r.currency,
        failReason: r.failReason,
        createdAt: r.createdAt.toISOString(),
      }));

    return {
      totalCount,
      paidCount,
      failedCount,
      pendingCount,
      successRate,
      byProvider,
      byCurrency,
      dailySeries,
      recentFailures,
    };
  }

  /**
   * Callback iyzico (публичный, без авторизации): подтверждаем статус на сервере через
   * checkoutForm.retrieve (никогда не доверяем данным из тела редиректа) и обновляем Payment + Sale.
   */
  async handleIyzicoCallback(
    token: string,
  ): Promise<{ status: 'paid' | 'failed'; saleId: string | null; tenantId: string }> {
    const payment = await this.repo.findOne({ where: { token, provider: 'iyzico' } as any });
    if (!payment) throw new NotFoundException('Платёж не найден');

    const creds = await this.getIyzicoCredentials(payment.tenantId);
    const result = await this.iyzico.retrieveCheckoutForm(creds, {
      token,
      conversationId: payment.conversationId || randomUUID(),
    });

    const paid = result.status === 'success' && result.paymentStatus === 'SUCCESS';
    payment.status = paid ? 'paid' : 'failed';
    payment.providerRaw = result as unknown as Record<string, unknown>;
    if (!paid) {
      payment.failReason = result.errorMessage || result.paymentStatus || 'unknown';
    } else if (!payment.paidAt) {
      // Не перезаписываем при повторной доставке вебхука — иначе теряется реальное время
      // ПЕРВОЙ оплаты, которым пользуется аналитика.
      payment.paidAt = new Date();
    }
    await this.repo.manager.transaction(async (em) => {
      await em.save(Payment, payment);
      await this.markSalePaidIfNeeded(em, paid, payment.saleId, payment.tenantId);
    });

    return { status: paid ? 'paid' : 'failed', saleId: payment.saleId, tenantId: payment.tenantId };
  }

  /**
   * Notification (webhook) PayTR: подпись HMAC проверяется здесь и только здесь — тело запроса
   * само по себе не источник истины, пока хэш не совпал с посчитанным на наших secrets.
   * Отвечаем строго строкой "OK" (см. контроллер) — иначе PayTR будет бесконечно повторять запрос.
   */
  async handlePaytrNotification(body: {
    merchant_oid?: string;
    status?: string;
    total_amount?: string;
    hash?: string;
  }): Promise<{ ok: boolean }> {
    const merchantOid = (body.merchant_oid || '').trim();
    if (!merchantOid) return { ok: false };

    const payment = await this.repo.findOne({
      where: { conversationId: merchantOid, provider: 'paytr' } as any,
    });
    if (!payment) return { ok: false };

    const creds = await this.getPaytrCredentials(payment.tenantId);
    const valid = this.paytr.verifyNotificationHash(creds, {
      merchant_oid: merchantOid,
      status: body.status || '',
      total_amount: body.total_amount || '',
      hash: body.hash || '',
    });
    if (!valid) return { ok: false };

    const paid = body.status === 'success';
    payment.status = paid ? 'paid' : 'failed';
    payment.providerRaw = body as unknown as Record<string, unknown>;
    if (!paid) {
      payment.failReason = 'paytr_failed';
    } else if (!payment.paidAt) {
      payment.paidAt = new Date();
    }
    await this.repo.manager.transaction(async (em) => {
      await em.save(Payment, payment);
      await this.markSalePaidIfNeeded(em, paid, payment.saleId, payment.tenantId);
    });

    return { ok: true };
  }

  /**
   * Webhook ЮKassa: у ЮKassa нет встроенной подписи запроса, поэтому телу уведомления не
   * доверяем вообще — берём только id платежа из object.id и перезапрашиваем актуальный статус
   * через GET /payments/{id} (Basic Auth нашими же secrets), как рекомендует сама ЮKassa.
   */
  async handleYookassaNotification(body: {
    event?: string;
    object?: { id?: string };
  }): Promise<{ ok: boolean }> {
    const paymentId = (body.object?.id || '').trim();
    if (!paymentId) return { ok: false };

    const payment = await this.repo.findOne({
      where: { conversationId: paymentId, provider: 'yookassa' } as any,
    });
    if (!payment) return { ok: false };

    const creds = await this.getYookassaCredentials(payment.tenantId);
    let result;
    try {
      result = await this.yookassa.getPayment(creds, paymentId);
    } catch {
      return { ok: false };
    }

    const paid = result.status === 'succeeded' && result.paid;
    payment.status = paid ? 'paid' : result.status === 'canceled' ? 'failed' : payment.status;
    payment.providerRaw = result as unknown as Record<string, unknown>;
    if (paid && !payment.paidAt) payment.paidAt = new Date();
    await this.repo.manager.transaction(async (em) => {
      await em.save(Payment, payment);
      await this.markSalePaidIfNeeded(em, paid, payment.saleId, payment.tenantId);
    });

    return { ok: true };
  }

  // Обёрнуто в одну транзакцию с сохранением Payment на каждом из трёх колбэков выше — иначе
  // сбой между "платёж помечен оплаченным" и "продажа подтверждена" оставлял их разошедшимися
  // навсегда (webhook-контроллеры всегда отвечают 200, поэтому провайдер не повторит попытку).
  private async markSalePaidIfNeeded(
    em: EntityManager,
    paid: boolean,
    saleId: string | null,
    tenantId: string,
  ): Promise<void> {
    if (!paid || !saleId) return;
    await em.update(Sale, { id: saleId, tenantId } as any, { status: 'confirmed' });
  }
}
