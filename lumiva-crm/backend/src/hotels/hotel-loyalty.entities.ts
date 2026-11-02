import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Где действует программа: один/несколько отелей, бренды (сеть), весь аккаунт. Каждый отель — ровно в одной активной программе. */
export type LoyaltyScope = 'hotels' | 'brands' | 'account';

export interface LoyaltyTier {
  key: string;
  name: string;
  /** порог за период (tierPeriod): ночей / проживаний / сумма в валюте программы — достаточно любого */
  minNights?: number | null;
  minStays?: number | null;
  minSpend?: number | null;
  /** скидка на проживание по прямой брони, % */
  discountPct?: number;
  /** множитель баллов уровня (1 = как у всех) */
  pointsMultiplier?: number;
  /** привилегии текстом (ранний заезд, апгрейд…) — показываются на стойке и гостю */
  benefits?: string[];
}

export interface LoyaltySettings {
  points: {
    enabled: boolean;
    /** баллов за 1 единицу валюты программы */
    earnPerUnit: number;
    /** начислять и за доп. услуги / чеки точек продаж, не только за проживание */
    includeExtras: boolean;
    /** баллы «в ожидании» столько дней после выезда (отмена/возврат) */
    pendingDays: number;
    /** сгорают при отсутствии активности столько месяцев (0 — не сгорают) */
    expiryMonths: number;
    /** стоимость 1 балла в валюте программы при списании */
    pointValue: number;
    /** баллами — не больше этой доли счёта брони, % */
    maxRedeemPct: number;
  };
  tiers: LoyaltyTier[];
  /** за какой период считать уровень: 12 последних месяцев или всё время */
  tierPeriod: '12m' | 'lifetime';
  /** простой режим без баллов: с N-го проживания скидка X % */
  simpleDiscount: { enabled: boolean; fromStay: number; pct: number };
  /** кто становится участником: все гости / только с согласием на рассылки (KVKK) / только вручную */
  enrollment: 'auto_all' | 'auto_consent' | 'manual';
  /** брони агентств/OTA: баллы не начисляем (по умолчанию), ночи — в зачёт уровня */
  partnerEarnPoints: boolean;
  partnerCountsForTier: boolean;
  settlement: {
    /** отелю, принявшему баллы, возмещается эта доля их стоимости, % (стандарт сетей — ниже 100) */
    reimbursePct: number;
    /** переводы меньше этой суммы переносятся на следующий период */
    minTransfer: number;
    /** сколько баллов отель может принять за месяц (в валюте программы, 0 — без лимита) */
    monthlyRedeemCap: number;
    /** предупреждать, если принятые баллы отеля больше выданных в N раз */
    imbalanceRatio: number;
  };
  /** даты, когда баллы в отеле не принимаются (высокий сезон) */
  blackout: Array<{ hotelId: string | null; from: string; to: string }>;
}

@Entity('hotel_loyalty_programs')
@Index(['tenantId'])
export class HotelLoyaltyProgram {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'varchar', length: 10, default: 'hotels' }) scope: LoyaltyScope;
  @Column({ type: 'uuid', array: true, default: '{}' }) hotelIds: string[];
  @Column({ type: 'uuid', array: true, default: '{}' }) brandIds: string[];
  @Column({ type: 'varchar', length: 3, default: 'EUR' }) currency: string;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'jsonb' }) settings: LoyaltySettings;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

/** Участник программы — профиль гостя (профили общие на аккаунт, дубли сливаются вместе с участием) */
@Entity('hotel_loyalty_members')
@Index(['programId', 'profileId'], { unique: true })
export class HotelLoyaltyMember {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) programId: string;
  @Column({ type: 'uuid' }) profileId: string;
  /** номер карты участника */
  @Column({ type: 'varchar', length: 16 }) number: string;
  @Column({ type: 'varchar', length: 40, nullable: true }) tier: string | null;
  @Column({ type: 'timestamptz', nullable: true }) tierSince: Date | null;
  @Column({ type: 'integer', default: 0 }) points: number;
  @Column({ type: 'integer', default: 0 }) pendingPoints: number;
  @Column({ type: 'integer', default: 0 }) lifetimePoints: number;
  @Column({ type: 'varchar', length: 10, default: 'active' }) status: 'active' | 'blocked';
  @Column({ type: 'varchar', length: 48 }) token: string;
  @Column({ type: 'timestamptz', nullable: true }) lastActivityAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) expiryWarnedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) joinedAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

export type LoyaltyTxType = 'earn' | 'redeem' | 'expire' | 'adjust' | 'reverse';

/**
 * Движение баллов. value — стоимость в валюте программы (по pointValue): из неё считаются взаиморасчёты сети —
 * выдал отель баллы (earn) → он должен пулу программы; принял (redeem) → пул возмещает ему reimbursePct %.
 */
@Entity('hotel_loyalty_tx')
@Index(['tenantId', 'programId', 'createdAt'])
@Index(['memberId', 'createdAt'])
export class HotelLoyaltyTx {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) programId: string;
  @Column({ type: 'uuid' }) memberId: string;
  @Column({ type: 'uuid', nullable: true }) hotelId: string | null;
  @Column({ type: 'uuid', nullable: true }) reservationId: string | null;
  @Column({ type: 'varchar', length: 8 }) type: LoyaltyTxType;
  @Column({ type: 'integer' }) points: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) value: string;
  @Column({ type: 'varchar', length: 8, default: 'posted' }) status: 'pending' | 'posted' | 'cancelled';
  @Column({ type: 'timestamptz', nullable: true }) availableAt: Date | null;
  /** платёж брони (оплата баллами) — для отмены */
  @Column({ type: 'varchar', length: 64, nullable: true }) paymentId: string | null;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

/** Проживание, учтённое программой (раз на бронь): ночи/сумма для уровня, начисленные баллы */
@Entity('hotel_loyalty_stays')
@Index(['reservationId'], { unique: true })
export class HotelLoyaltyStay {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) programId: string;
  @Column({ type: 'uuid' }) memberId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'uuid' }) reservationId: string;
  @Column({ type: 'date' }) checkOut: string;
  @Column({ type: 'integer' }) nights: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) spend: string;
  @Column({ type: 'boolean', default: true }) countsForTier: boolean;
  @Column({ type: 'integer', default: 0 }) points: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
