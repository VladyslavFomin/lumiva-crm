import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { HotelFolioKind } from './hotel-folio.entities';

/** Интеграторы e-Fatura / e-Arşiv. Общий слой одинаков, различается только адаптер. */
export const HOTEL_EINVOICE_PROVIDERS = ['parasut'] as const;
export type HotelEInvoiceProvider = (typeof HOTEL_EINVOICE_PROVIDERS)[number];

/** Как передавать налог на проживание: доп. налогом строки (код 0059 в UBL-TR) или отдельной строкой без KDV */
export type HotelAccTaxMode = 'line_tax' | 'separate_line';

export interface HotelEInvoiceSettings {
  /** серия номера счёта в кабинете интегратора (необязательно) */
  invoiceSeries?: string | null;
  /** KDV на доп. услуги по умолчанию, % (у услуги может быть своя ставка) */
  extrasVatPct?: number;
  accTaxMode?: HotelAccTaxMode;
  /** id услуги «Konaklama» в кабинете Paraşüt — нужен для кода налога на проживание; создаётся сам */
  parasutAccProductId?: string | null;
}

/**
 * Подключение отеля к интегратору e-Fatura. Пароль, секрет клиента и токены — только в зашифрованном виде.
 * Номер фирмы (company_id у Paraşüt) — в externalCompanyId.
 */
@Entity('hotel_einvoice_connections')
@Index(['tenantId', 'hotelId'], { unique: true })
export class HotelEInvoiceConnection {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'varchar', length: 24 }) provider: HotelEInvoiceProvider;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'varchar', length: 160, nullable: true }) clientId: string | null;
  @Column({ type: 'text', nullable: true }) clientSecretEnc: string | null;
  @Column({ type: 'varchar', length: 190, nullable: true }) username: string | null;
  @Column({ type: 'text', nullable: true }) passwordEnc: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) externalCompanyId: string | null;
  @Column({ type: 'text', nullable: true }) accessTokenEnc: string | null;
  @Column({ type: 'text', nullable: true }) refreshTokenEnc: string | null;
  @Column({ type: 'timestamptz', nullable: true }) tokenExpiresAt: Date | null;
  @Column({ type: 'jsonb', default: {} }) settings: HotelEInvoiceSettings;
  @Column({ type: 'timestamptz', nullable: true }) lastCheckedAt: Date | null;
  @Column({ type: 'text', nullable: true }) lastError: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

export type HotelEInvoiceStatus = 'sending' | 'issued' | 'error' | 'cancelled';
export type HotelEInvoiceDocType = 'e_archive' | 'e_invoice';

export interface HotelEInvoiceRecipient {
  kind: 'person' | 'company';
  name: string;
  /** VKN (10 цифр, компания) или TCKN (11 цифр); у иностранца без номера — 11111111111 */
  taxNumber: string;
  taxOffice?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  abroad?: boolean;
}

export interface HotelEInvoiceLine {
  description: string;
  quantity: number;
  /** цена за единицу без KDV и без налога на проживание */
  unitPrice: number;
  vatPct: number;
  /** налог на проживание строки, % (только проживание) */
  accTaxPct: number;
  /** скидка строки, сумма без налогов */
  discount: number;
  /** итог строки с налогами — для сверки с фолио */
  gross: number;
  kind: 'accommodation' | 'cancel_fee' | 'extra' | 'acc_tax';
}

export interface HotelEInvoiceTotals {
  net: number;
  accTax: number;
  vat: number;
  gross: number;
}

/** Выставленный (или выставляемый) электронный счёт по фолио брони. Строки и получатель — снимок на момент выставления. */
@Entity('hotel_einvoices')
@Index(['tenantId', 'hotelId', 'createdAt'])
@Index(['tenantId', 'reservationId'])
export class HotelEInvoice {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'uuid' }) reservationId: string;
  @Column({ type: 'varchar', length: 16, default: 'guest' }) folio: HotelFolioKind;
  @Column({ type: 'varchar', length: 24 }) provider: HotelEInvoiceProvider;
  @Column({ type: 'varchar', length: 12, default: 'sending' }) status: HotelEInvoiceStatus;
  @Column({ type: 'varchar', length: 12, nullable: true }) docType: HotelEInvoiceDocType | null;
  @Column({ type: 'date' }) issueDate: string;
  @Column({ type: 'varchar', length: 3 }) currency: string;
  @Column({ type: 'numeric', precision: 14, scale: 6, nullable: true }) exchangeRate: string | null;
  @Column({ type: 'jsonb' }) recipient: HotelEInvoiceRecipient;
  @Column({ type: 'jsonb' }) lines: HotelEInvoiceLine[];
  @Column({ type: 'jsonb' }) totals: HotelEInvoiceTotals;
  @Column({ type: 'text', nullable: true }) note: string | null;
  /** id у интегратора: счёт, электронный документ, задача формирования */
  @Column({ type: 'varchar', length: 64, nullable: true }) externalInvoiceId: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) externalDocId: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) externalJobId: string | null;
  /** номер документа GİB (например ABC2026000000123) */
  @Column({ type: 'varchar', length: 40, nullable: true }) invoiceNo: string | null;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @Column({ type: 'integer', default: 0 }) pollCount: number;
  @Column({ type: 'timestamptz', nullable: true }) issuedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) cancelledAt: Date | null;
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
