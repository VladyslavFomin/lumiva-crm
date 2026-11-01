import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Предпочтения гостя — фиксированный список (переводится в интерфейсе), свободный текст — в notes / allergies */
export const HOTEL_GUEST_PREFERENCES = [
  'high_floor', 'low_floor', 'quiet_room', 'sea_view', 'near_elevator', 'twin_beds', 'double_bed', 'extra_pillow',
  'baby_cot', 'accessible', 'non_smoking', 'late_arrival', 'early_breakfast', 'vegetarian', 'gluten_free', 'no_alcohol',
] as const;
export type HotelGuestPreference = (typeof HOTEL_GUEST_PREFERENCES)[number];

/**
 * Профиль гостя (единая карточка на сеть отелей тенанта): контакты, документ, предпочтения, VIP / чёрный список.
 * Брони ссылаются на профиль контакта (`hotel_reservations.guestProfileId`), гости из состава — `guests[].profileId`.
 * Статистика (проживания, ночи, выручка) считается по броням, а не хранится.
 */
@Entity('hotel_guest_profiles')
@Index(['tenantId'])
export class HotelGuestProfile {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'varchar', length: 200 }) fullName: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) email: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) phone: string | null;
  /** ISO alpha-2 */
  @Column({ type: 'varchar', length: 2, nullable: true }) country: string | null;
  @Column({ type: 'varchar', length: 5, nullable: true }) language: string | null;
  @Column({ type: 'date', nullable: true }) birthDate: string | null;
  @Column({ type: 'varchar', length: 1, nullable: true }) gender: 'M' | 'F' | null;
  @Column({ type: 'varchar', length: 12, nullable: true }) documentType: 'passport' | 'id_card' | 'other' | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) documentNumber: string | null;
  @Column({ type: 'date', nullable: true }) documentExpiry: string | null;
  /** ключи сопоставления: email в нижнем регистре, телефон — последние 9 цифр, документ — без пробелов в верхнем регистре */
  @Column({ type: 'varchar', length: 200, nullable: true }) emailKey: string | null;
  @Column({ type: 'varchar', length: 16, nullable: true }) phoneKey: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) documentKey: string | null;
  @Column({ type: 'varchar', length: 200 }) nameKey: string;

  @Column({ type: 'boolean', default: false }) vip: boolean;
  @Column({ type: 'boolean', default: false }) blacklisted: boolean;
  @Column({ type: 'text', nullable: true }) blacklistReason: string | null;
  @Column({ type: 'text', array: true, default: '{}' }) preferences: string[];
  @Column({ type: 'text', nullable: true }) allergies: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'boolean', default: false }) marketingConsent: boolean;
  /** KVKK / GDPR: персональные данные стёрты, профиль остался для статистики */
  @Column({ type: 'timestamptz', nullable: true }) anonymizedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
