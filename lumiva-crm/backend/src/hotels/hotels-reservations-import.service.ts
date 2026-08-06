import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parseCsvRobust, parseXlsxRobust, normHeaderKey } from '../lib/import-spreadsheet.util';
import { HotelReservationImportSession } from './hotel-reservation-import-session.entity';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelAgency } from './hotel-agency.entity';
import { HotelReservationsService } from './hotel-reservations.service';
import { HotelReservationStatus } from './hotel-reservation.entity';

export const HOTEL_RESERVATION_IMPORT_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'guestName', label: 'Гость' },
  { key: 'hotelName', label: 'Отель' },
  { key: 'roomTypeName', label: 'Тип номера' },
  { key: 'agencyName', label: 'Агентство' },
  { key: 'market', label: 'Рынок' },
  { key: 'checkIn', label: 'Заезд' },
  { key: 'checkOut', label: 'Выезд' },
  { key: 'pax', label: 'Гостей (PAX)' },
  { key: 'costPerNight', label: 'Себестоимость/ночь' },
  { key: 'ppPerNight', label: 'PP/ночь' },
  { key: 'grossPerNight', label: 'Brutto/ночь' },
  { key: 'discountPct', label: 'Скидка, %' },
  { key: 'status', label: 'Статус' },
];

const FIELD_SYNONYMS: Record<string, string[]> = {
  guestName: ['гость', 'клиент', 'имя гостя', 'guest', 'name', 'customer'],
  hotelName: ['отель', 'объект', 'hotel'],
  roomTypeName: ['тип номера', 'номер', 'room', 'room type'],
  agencyName: ['агентство', 'туроператор', 'agency', 'канал'],
  market: ['рынок', 'рынок продаж', 'market'],
  checkIn: ['заезд', 'дата заезда', 'check in', 'checkin'],
  checkOut: ['выезд', 'дата выезда', 'check out', 'checkout'],
  pax: ['pax', 'гостей', 'кол-во гостей', 'guests'],
  costPerNight: ['себестоимость', 'себестоимость/ночь', 'cost'],
  ppPerNight: ['pp/ночь', 'pp night', 'pp'],
  grossPerNight: ['brutto/ночь', 'brutto', 'ночь', 'night rate', 'gross'],
  discountPct: ['скидка', 'скидка, %', 'discount'],
  status: ['статус', 'status'],
};

function suggestMapping(columns: string[]): Record<string, string | null> {
  const cols = columns.map((raw) => ({ raw, nk: normHeaderKey(raw) }));
  const map: Record<string, string | null> = {};
  for (const field of HOTEL_RESERVATION_IMPORT_FIELDS) {
    const synonyms = (FIELD_SYNONYMS[field.key] || [field.label]).map((s) => normHeaderKey(s));
    const hit = cols.find((c) => synonyms.includes(c.nk));
    map[field.key] = hit ? hit.raw : null;
  }
  return map;
}

function parseImportDate(raw: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const eu = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/.exec(raw);
  if (eu) return `${eu[3]}-${eu[2].padStart(2, '0')}-${eu[1].padStart(2, '0')}`;
  const native = new Date(raw);
  if (!Number.isNaN(native.getTime())) return native.toISOString().slice(0, 10);
  return null;
}

const STATUS_SYNONYMS: Record<string, HotelReservationStatus> = {
  'подтверждена': 'confirmed',
  confirmed: 'confirmed',
  ожидает: 'pending',
  pending: 'pending',
  'заселён': 'checked_in',
  checked_in: 'checked_in',
  'выехал': 'checked_out',
  checked_out: 'checked_out',
  'отменена': 'cancelled',
  cancelled: 'cancelled',
};

export interface HotelReservationImportApplyResult {
  created: number;
  errors: Array<{ row: number; message: string }>;
  total: number;
}

@Injectable()
export class HotelsReservationsImportService {
  constructor(
    @InjectRepository(HotelReservationImportSession)
    private readonly sessions: Repository<HotelReservationImportSession>,
    @InjectRepository(Hotel)
    private readonly hotelsRepo: Repository<Hotel>,
    @InjectRepository(HotelRoomType)
    private readonly roomTypesRepo: Repository<HotelRoomType>,
    @InjectRepository(HotelAgency)
    private readonly agenciesRepo: Repository<HotelAgency>,
    private readonly reservations: HotelReservationsService,
  ) {}

  async previewImport(
    tenantId: string,
    file: { buffer: Buffer; originalname?: string; mimetype?: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Нужен файл');
    const filename = (file.originalname || '').toLowerCase();
    const parsed =
      filename.endsWith('.xlsx') || filename.endsWith('.xls')
        ? await parseXlsxRobust(file.buffer)
        : parseCsvRobust(file.buffer.toString('utf-8'));
    if (!parsed.columns.length) {
      throw new BadRequestException(
        'Не удалось найти колонки — проверьте, что в первой строке есть заголовки.',
      );
    }

    const suggestedMapping = suggestMapping(parsed.columns);
    const mappedColumns = new Set(Object.values(suggestedMapping).filter((v): v is string => !!v));
    const unmatchedColumns = parsed.columns.filter((c) => !mappedColumns.has(c));

    const session = await this.sessions.save(
      this.sessions.create({
        tenantId,
        originalFileName: file.originalname || null,
        columns: parsed.columns,
        rows: parsed.rows,
        sample: parsed.rows.slice(0, 20),
        totalRows: parsed.rows.length,
        suggestedMapping,
        status: 'preview',
      }),
    );

    return {
      importId: session.id,
      columns: session.columns,
      sample: session.sample,
      totalRows: session.totalRows,
      suggestedMapping,
      mappableFields: HOTEL_RESERVATION_IMPORT_FIELDS,
      unmatchedColumns,
    };
  }

  async applyImport(
    tenantId: string,
    dto: { importId: string; mapping: Record<string, string | null>; defaultHotelId?: string },
  ): Promise<HotelReservationImportApplyResult> {
    const session = await this.sessions.findOne({ where: { id: dto.importId, tenantId } });
    if (!session) throw new NotFoundException('Сессия импорта не найдена');
    if (session.status === 'applied') {
      throw new BadRequestException('Этот файл уже был импортирован');
    }
    const mapping = dto.mapping || {};

    const [hotels, roomTypes, agencies] = await Promise.all([
      this.hotelsRepo.find({ where: { tenantId } }),
      this.roomTypesRepo.find({ where: { tenantId } }),
      this.agenciesRepo.find({ where: { tenantId } }),
    ]);
    const hotelByName = new Map(hotels.map((h) => [h.name.trim().toLowerCase(), h]));
    const roomTypeByName = new Map(roomTypes.map((r) => [r.name.trim().toLowerCase(), r]));
    const agencyByName = new Map(agencies.map((a) => [a.name.trim().toLowerCase(), a]));
    const defaultHotel = dto.defaultHotelId
      ? hotels.find((h) => h.id === dto.defaultHotelId) || null
      : hotels.length === 1
        ? hotels[0]
        : null;

    let created = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < session.rows.length; i++) {
      const row = session.rows[i];
      const get = (key: string): string => {
        const col = mapping[key];
        if (!col) return '';
        return String(row[col] ?? '').trim();
      };
      try {
        const guestName = get('guestName');
        if (!guestName) {
          errors.push({ row: i + 1, message: 'Не указано имя гостя' });
          continue;
        }

        const hotelName = get('hotelName');
        const hotel = hotelName ? hotelByName.get(hotelName.toLowerCase()) : undefined;
        const resolvedHotel = hotel || defaultHotel;
        if (!resolvedHotel) {
          errors.push({
            row: i + 1,
            message: hotelName ? `Отель не найден: "${hotelName}"` : 'Не указан отель',
          });
          continue;
        }

        const roomTypeName = get('roomTypeName');
        const roomType = roomTypeName ? roomTypeByName.get(roomTypeName.toLowerCase()) : undefined;
        if (!roomType) {
          errors.push({ row: i + 1, message: `Тип номера не найден: "${roomTypeName}"` });
          continue;
        }

        const checkInRaw = get('checkIn');
        const checkOutRaw = get('checkOut');
        const checkIn = parseImportDate(checkInRaw);
        const checkOut = parseImportDate(checkOutRaw);
        if (!checkIn || !checkOut) {
          errors.push({ row: i + 1, message: `Не удалось распознать даты заезда/выезда` });
          continue;
        }

        const agencyName = get('agencyName');
        const agency = agencyName ? agencyByName.get(agencyName.toLowerCase()) : undefined;

        const paxRaw = get('pax');
        const statusRaw = get('status');
        const mappedStatus = STATUS_SYNONYMS[statusRaw.trim().toLowerCase()];

        const reservation = await this.reservations.create(tenantId, {
          hotelId: resolvedHotel.id,
          roomTypeId: roomType.id,
          agencyId: agency?.id ?? null,
          guestName,
          pax: paxRaw ? Number(paxRaw) || 1 : 1,
          market: get('market') || null,
          checkIn,
          checkOut,
          costPerNight: get('costPerNight').replace(',', '.') || '0',
          ppPerNight: get('ppPerNight').replace(',', '.') || '0',
          grossPerNight: get('grossPerNight').replace(',', '.') || '0',
          discountPct: get('discountPct').replace(',', '.') || '0',
          status: mappedStatus,
          source: 'import',
        }, undefined, { skipValidation: true });
        created++;
        void reservation;
      } catch (err: any) {
        errors.push({ row: i + 1, message: err?.message || 'Неизвестная ошибка' });
      }
    }

    session.status = 'applied';
    await this.sessions.save(session);

    return { created, errors, total: session.rows.length };
  }
}
