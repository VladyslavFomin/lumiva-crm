import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parseCsvRobust, parseXlsxRobust, normHeaderKey } from '../lib/import-spreadsheet.util';
import { ReservationImportSession } from './reservation-import-session.entity';
import { BookingLocation } from './booking-location.entity';
import { BookingService } from './booking-service.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { ReservationsService } from './reservations.service';
import { ReservationStatus } from './reservation.entity';

/** Поля, на которые пользователь сопоставляет колонки файла — как IMPORT_STRUCTURAL_FIELDS у Products. */
export const RESERVATION_IMPORT_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'customerName', label: 'Клиент' },
  { key: 'customerPhone', label: 'Телефон' },
  { key: 'customerEmail', label: 'Email' },
  { key: 'locationName', label: 'Локация' },
  { key: 'serviceName', label: 'Услуга' },
  { key: 'staffName', label: 'Мастер' },
  { key: 'date', label: 'Дата' },
  { key: 'time', label: 'Время' },
  { key: 'durationMinutes', label: 'Длительность (мин)' },
  { key: 'participants', label: 'Участников' },
  { key: 'price', label: 'Цена' },
  { key: 'currency', label: 'Валюта' },
  { key: 'status', label: 'Статус' },
  { key: 'notes', label: 'Комментарий' },
];

/** Синонимы для авто-подсказки маппинга — шире, чем строгое совпадение key/label один-в-один. */
const FIELD_SYNONYMS: Record<string, string[]> = {
  customerName: ['клиент', 'имя клиента', 'имя', 'фио', 'client', 'name', 'customer', 'client name'],
  customerPhone: ['телефон', 'тел', 'phone', 'номер телефона', 'phone number'],
  customerEmail: ['email', 'почта', 'e-mail', 'e mail'],
  locationName: ['локация', 'филиал', 'студия', 'location', 'адрес'],
  serviceName: ['услуга', 'service', 'услуги'],
  staffName: ['мастер', 'сотрудник', 'специалист', 'staff', 'master', 'исполнитель'],
  date: ['дата', 'дата брони', 'date', 'дата записи'],
  time: ['время', 'время начала', 'time', 'время записи'],
  durationMinutes: ['длительность', 'длительность (мин)', 'продолжительность', 'duration'],
  participants: ['участников', 'гостей', 'кол-во участников', 'participants', 'guests', 'количество'],
  price: ['цена', 'стоимость', 'price', 'сумма'],
  currency: ['валюта', 'currency'],
  status: ['статус', 'status'],
  notes: ['комментарий', 'заметка', 'примечание', 'notes', 'comment'],
};

function suggestReservationMapping(columns: string[]): Record<string, string | null> {
  const cols = columns.map((raw) => ({ raw, nk: normHeaderKey(raw) }));
  const map: Record<string, string | null> = {};
  for (const field of RESERVATION_IMPORT_FIELDS) {
    const synonyms = (FIELD_SYNONYMS[field.key] || [field.label]).map((s) => normHeaderKey(s));
    const hit = cols.find((c) => synonyms.includes(c.nk));
    map[field.key] = hit ? hit.raw : null;
  }
  return map;
}

function parseImportDate(dateRaw: string): { y: number; m: number; d: number } | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateRaw);
  if (iso) return { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) };
  const eu = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/.exec(dateRaw);
  if (eu) return { y: Number(eu[3]), m: Number(eu[2]), d: Number(eu[1]) };
  const native = new Date(dateRaw);
  if (!Number.isNaN(native.getTime())) {
    return { y: native.getUTCFullYear(), m: native.getUTCMonth() + 1, d: native.getUTCDate() };
  }
  return null;
}

function parseImportTime(timeRaw: string): { h: number; min: number } {
  const m = /^(\d{1,2}):(\d{2})/.exec(timeRaw || '');
  if (m) return { h: Number(m[1]), min: Number(m[2]) };
  return { h: 0, min: 0 };
}

function combineDateTime(dateRaw: string, timeRaw: string): Date | null {
  const date = parseImportDate(dateRaw);
  if (!date) return null;
  const time = parseImportTime(timeRaw);
  const pad = (n: number) => String(n).padStart(2, '0');
  const composed = new Date(`${date.y}-${pad(date.m)}-${pad(date.d)}T${pad(time.h)}:${pad(time.min)}:00`);
  return Number.isNaN(composed.getTime()) ? null : composed;
}

const STATUS_SYNONYMS: Record<string, ReservationStatus> = {
  'подтверждена': 'confirmed',
  'подтверждено': 'confirmed',
  confirmed: 'confirmed',
  ожидает: 'pending',
  ожидание: 'pending',
  pending: 'pending',
  'завершена': 'completed',
  'выполнена': 'completed',
  completed: 'completed',
  'отменена': 'cancelled_by_business',
  'отменено': 'cancelled_by_business',
  cancelled: 'cancelled_by_business',
  canceled: 'cancelled_by_business',
  'неявка': 'no_show',
  no_show: 'no_show',
  'no-show': 'no_show',
  'черновик': 'draft',
  draft: 'draft',
};

function mapImportStatus(raw: string): ReservationStatus | null {
  if (!raw) return null;
  return STATUS_SYNONYMS[raw.trim().toLowerCase()] || null;
}

export interface ReservationImportApplyResult {
  created: number;
  errors: Array<{ row: number; message: string }>;
  total: number;
}

@Injectable()
export class ReservationsImportService {
  constructor(
    @InjectRepository(ReservationImportSession)
    private readonly sessions: Repository<ReservationImportSession>,
    @InjectRepository(BookingLocation)
    private readonly locationsRepo: Repository<BookingLocation>,
    @InjectRepository(BookingService)
    private readonly servicesRepo: Repository<BookingService>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
    private readonly reservationsService: ReservationsService,
  ) {}

  async previewImport(
    tenantId: string,
    file: { buffer: Buffer; originalname?: string; mimetype?: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Нужен файл');
    const filename = (file.originalname || '').toLowerCase();
    let parsed: { columns: string[]; rows: Array<Record<string, any>> };
    if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      parsed = await parseXlsxRobust(file.buffer);
    } else {
      parsed = parseCsvRobust(file.buffer.toString('utf-8'));
    }
    if (!parsed.columns.length) {
      throw new BadRequestException(
        'Не удалось найти колонки — проверьте, что в первой строке есть заголовки.',
      );
    }

    const suggestedMapping = suggestReservationMapping(parsed.columns);
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
      mappableFields: RESERVATION_IMPORT_FIELDS,
      unmatchedColumns,
    };
  }

  /**
   * Применение импорта: локация/услуга/мастер сопоставляются по имени (без создания новых
   * локаций/услуг "на лету" — их нужно завести заранее на своих страницах, иначе строка идёт в
   * errors). Клиент/лид — та же resolveLeadAndContact, что и у публичного intake-эндпоинта.
   * Бронь создаётся с source:'import' и skipValidation:true — иначе исторические даты и
   * пересечения с другими импортированными строками валили бы весь файл.
   */
  async applyImport(
    tenantId: string,
    dto: { importId: string; mapping: Record<string, string | null>; defaultLocationId?: string },
    actingStaffUserId: string | null,
  ): Promise<ReservationImportApplyResult> {
    const session = await this.sessions.findOne({ where: { id: dto.importId, tenantId } });
    if (!session) throw new NotFoundException('Сессия импорта не найдена');
    if (session.status === 'applied') {
      throw new BadRequestException('Этот файл уже был импортирован');
    }
    const mapping = dto.mapping || {};

    const [locations, services, staffUsers] = await Promise.all([
      this.locationsRepo.find({ where: { tenantId } }),
      this.servicesRepo.find({ where: { tenantId } }),
      this.staffRepo.find({ where: { tenantId } }),
    ]);
    const locationByName = new Map(locations.map((l) => [l.name.trim().toLowerCase(), l]));
    const serviceByName = new Map(services.map((s) => [s.name.trim().toLowerCase(), s]));
    const staffByName = new Map(staffUsers.map((s) => [s.fullName.trim().toLowerCase(), s]));
    const defaultLocation = dto.defaultLocationId
      ? locations.find((l) => l.id === dto.defaultLocationId) || null
      : locations.length === 1
        ? locations[0]
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
        const customerName = get('customerName');
        const customerPhone = get('customerPhone');
        const customerEmail = get('customerEmail');
        if (!customerName && !customerPhone) {
          errors.push({ row: i + 1, message: 'Не указано имя или телефон клиента' });
          continue;
        }

        const dateRaw = get('date');
        if (!dateRaw) {
          errors.push({ row: i + 1, message: 'Не указана дата' });
          continue;
        }
        const startAt = combineDateTime(dateRaw, get('time'));
        if (!startAt) {
          errors.push({ row: i + 1, message: `Не удалось распознать дату/время: "${dateRaw} ${get('time')}"` });
          continue;
        }

        const locationName = get('locationName');
        const location = locationName ? locationByName.get(locationName.toLowerCase()) : undefined;
        const resolvedLocation = location || defaultLocation;
        if (!resolvedLocation) {
          errors.push({
            row: i + 1,
            message: locationName
              ? `Локация не найдена: "${locationName}"`
              : 'Не указана локация (и в тенанте больше одной локации, авто-выбор невозможен)',
          });
          continue;
        }

        const serviceName = get('serviceName');
        const service = serviceName ? serviceByName.get(serviceName.toLowerCase()) : undefined;
        if (serviceName && !service) {
          errors.push({ row: i + 1, message: `Услуга не найдена: "${serviceName}"` });
          continue;
        }

        const staffName = get('staffName');
        const staffUser = staffName ? staffByName.get(staffName.toLowerCase()) : undefined;
        if (staffName && !staffUser) {
          errors.push({ row: i + 1, message: `Мастер не найден: "${staffName}"` });
          continue;
        }

        const durationRaw = get('durationMinutes');
        const durationMinutes = durationRaw ? Number(durationRaw) : service?.durationMinutes || 60;
        const endAt = new Date(startAt.getTime() + (Number.isFinite(durationMinutes) ? durationMinutes : 60) * 60_000);

        const participantsRaw = get('participants');
        const priceRaw = get('price').replace(',', '.');
        const currencyRaw = get('currency');
        const notes = get('notes');

        const reservation = await this.reservationsService.create(
          tenantId,
          {
            locationId: resolvedLocation.id,
            serviceId: service?.id,
            staffUserId: staffUser?.id,
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            participants: participantsRaw ? Number(participantsRaw) || 1 : 1,
            customerName: customerName || undefined,
            customerPhone: customerPhone || undefined,
            customerEmail: customerEmail || undefined,
            source: 'import',
            price: priceRaw || undefined,
            currency: currencyRaw || undefined,
            customFields: notes ? { notes } : undefined,
          },
          actingStaffUserId,
          { skipValidation: true },
        );

        const mappedStatus = mapImportStatus(get('status'));
        if (mappedStatus && mappedStatus !== reservation.status) {
          await this.reservationsService.update(
            tenantId,
            reservation.id,
            { status: mappedStatus },
            actingStaffUserId,
          );
        }

        created++;
      } catch (err: any) {
        errors.push({ row: i + 1, message: err?.message || 'Неизвестная ошибка' });
      }
    }

    session.status = 'applied';
    await this.sessions.save(session);

    return { created, errors, total: session.rows.length };
  }
}
