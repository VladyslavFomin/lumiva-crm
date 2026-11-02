import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HotelReservationsService } from './hotel-reservations.service';
import { HotelNightAuditService } from './hotel-night-audit.service';
import { HotelPrecheckinService } from './hotel-precheckin.service';
import { HotelRevenueService } from './hotel-revenue.service';
import { HotelEInvoiceService } from './hotel-einvoice.service';
import { HotelPaymentLinksService } from './hotel-payment-links.service';

/** Жизненный цикл броней отеля: автоснятие просроченных опционов (PMS-024). */
@Injectable()
export class HotelLifecycleScheduler {
  private readonly log = new Logger(HotelLifecycleScheduler.name);
  private busy = false;
  private auditBusy = false;

  constructor(
    private readonly reservations: HotelReservationsService,
    private readonly nightAudit: HotelNightAuditService,
    private readonly precheckin: HotelPrecheckinService,
    private readonly revenue: HotelRevenueService,
    private readonly einvoice: HotelEInvoiceService,
    private readonly payLinks: HotelPaymentLinksService,
  ) {}

  private revenueBusy = false;
  private einvoiceBusy = false;

  private payLinksBusy = false;

  /** Онлайн-оплата брони: оплаченные платежи, чей хук не дошёл, и просроченные ссылки — раз в 2 минуты */
  @Cron('*/2 * * * *')
  async paymentLinksReconcile() {
    if (this.payLinksBusy) return;
    this.payLinksBusy = true;
    try {
      await this.payLinks.reconcile();
    } catch (e) {
      this.log.warn(`payment links reconcile: ${(e as Error).message}`);
    } finally {
      this.payLinksBusy = false;
    }
  }

  /** e-Fatura: документы в формировании у интегратора — опрос раз в минуту */
  @Cron('* * * * *')
  async einvoicePoll() {
    if (this.einvoiceBusy) return;
    this.einvoiceBusy = true;
    try {
      await this.einvoice.pollPending();
    } catch (e) {
      this.log.warn(`einvoice poll: ${(e as Error).message}`);
    } finally {
      this.einvoiceBusy = false;
    }
  }

  /** Рекомендации цены: автоприменение раз в сутки (ночью по UTC, до утренних продаж в Турции) */
  @Cron('20 1 * * *')
  async revenueAutoApply() {
    if (this.revenueBusy) return;
    this.revenueBusy = true;
    try {
      const n = await this.revenue.autoApplyAll();
      if (n) this.log.log(`revenue adjustments applied: ${n}`);
    } catch (e) {
      this.log.warn(`revenue auto-apply: ${(e as Error).message}`);
    } finally {
      this.revenueBusy = false;
    }
  }

  private precheckinBusy = false;

  /** Онлайн-регистрация: письма гостям за N дней до заезда (раз в час, повторно не отправляет) */
  @Cron('7 * * * *')
  async precheckinAutoSend() {
    if (this.precheckinBusy) return;
    this.precheckinBusy = true;
    try {
      const n = await this.precheckin.autoSend();
      if (n) this.log.log(`precheckin links sent: ${n}`);
    } catch (e) {
      this.log.warn(`precheckin auto-send: ${(e as Error).message}`);
    } finally {
      this.precheckinBusy = false;
    }
  }

  @Cron('*/10 * * * *')
  async expireOptions() {
    if (this.busy) return;
    this.busy = true;
    try {
      const n = await this.reservations.expireOptions();
      if (n) this.log.log(`hotel options expired: ${n}`);
    } catch (e) {
      this.log.warn(`expireOptions: ${(e as Error).message}`);
    } finally {
      this.busy = false;
    }
  }

  /** Автоматический ночной аудит (PMS-090): по времени отеля, если включён в настройках */
  @Cron('*/10 * * * *')
  async autoNightAudit() {
    if (this.auditBusy) return;
    this.auditBusy = true;
    try {
      const n = await this.nightAudit.runDue();
      if (n) this.log.log(`night audits completed: ${n}`);
    } catch (e) {
      this.log.warn(`night audit cron: ${(e as Error).message}`);
    } finally {
      this.auditBusy = false;
    }
  }
}
