import { BadRequestException } from '@nestjs/common';
import { readRawRows } from './hotel-pricing-sheet.util';
import { parseLooseDate } from './hotel-price-list-sheet.util';
import { COUNTRY_CODES, normalizeCountry } from '../common/countries';

/**
 * Rooming list туроператора (Excel / CSV): строка — гость. Номер — по колонке «Oda No / Room No» (пустая — тот же номер),
 * иначе новая строка с типом номера открывает новый номер, иначе каждый гость — свой номер.
 */

export interface RoomingGuest {
  fullName: string;
  birthDate: string | null;
  age: number | null;
  /** CHD / INF / возраст / дата рождения — ребёнок; итог решает сервис по возрасту ребёнка отеля */
  childHint: boolean;
  passportNumber: string | null;
  passportExpiry: string | null;
  nationality: string | null;
  gender: 'M' | 'F' | null;
}

export interface RoomingRoom {
  /** номер строки файла (с 1) — для отчёта */
  row: number;
  key: string | null;
  roomType: string | null;
  checkIn: string | null;
  checkOut: string | null;
  notes: string | null;
  guests: RoomingGuest[];
}

const norm = (s: string) =>
  s.toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

const COLS: Array<[keyof typeof EMPTY, RegExp]> = [
  ['room', /^(oda\s*(no|numarasi|#)?|room\s*(no|#|number|nr)?|№?\s*номер(а)?\s*(комнаты)?|№|komnata)$/],
  ['roomType', /oda\s*tip|room\s*type|тип\s*ном|категор|room\s*category|kategori/],
  ['lastName', /^(soyad[iı]?|surname|last\s*name|family\s*name|фамилия)$/],
  ['firstName', /^(ad[iı]?|first\s*name|given\s*name|name\s*\(first\)|имя)$/],
  ['fullName', /ad\s*soyad|name\s*surname|full\s*name|guest(\s*name)?|^name$|фио|^гость$|misafir|isim/],
  ['title', /^(title|unvan|tip|type|mr\/mrs|обращ)$/],
  ['birth', /dogum|birth|^dob$|дата\s*рожд|д\.р\./],
  ['age', /^(yas|age|возраст)$/],
  ['passport', /pasaport|passport|паспорт|document|belge|kimlik|^id$/],
  ['expiry', /gecerlilik|expir|valid|срок\s*дейст|действ/],
  ['nationality', /uyruk|national|гражд|citizen|country|ulke|страна/],
  ['gender', /cinsiyet|gender|^sex$|^пол$/],
  ['arrival', /giris|arrival|check\s*-?\s*in|заезд|^c\/i$/],
  ['departure', /cikis|departure|check\s*-?\s*out|выезд|^c\/o$/],
  ['notes', /^not(lar)?$|remark|note|примеч|коммент|comment|aciklama/],
];
const EMPTY = { room: -1, roomType: -1, lastName: -1, firstName: -1, fullName: -1, title: -1, birth: -1, age: -1, passport: -1, expiry: -1, nationality: -1, gender: -1, arrival: -1, departure: -1, notes: -1 };

let countryNames: Map<string, string> | null = null;
/** «Türkiye», «Russia», «Германия», «Almanya», «German», «Türk» → ISO alpha-2 */
export function countryFromText(v: string): string | null {
  const direct = normalizeCountry(v);
  if (direct) return direct;
  if (!countryNames) {
    countryNames = new Map();
    for (const lang of ['en', 'ru', 'tr', 'de', 'uk']) {
      try {
        const dn = new Intl.DisplayNames([lang], { type: 'region' });
        for (const c of COUNTRY_CODES) {
          const n = dn.of(c);
          if (n && n !== c) countryNames.set(norm(n), c);
        }
      } catch {
        /* нет ICU-данных — остаются коды и словарь ниже */
      }
    }
    const extra: Record<string, string> = {
      turk: 'TR', turkish: 'TR', turkey: 'TR', 'tc': 'TR', 't.c.': 'TR', russian: 'RU', rus: 'RU', rusya: 'RU', 'russian federation': 'RU',
      ukrainian: 'UA', ukrayna: 'UA', german: 'DE', alman: 'DE', almanya: 'DE', british: 'GB', english: 'GB', ingiltere: 'GB', 'united kingdom': 'GB',
      polish: 'PL', polonya: 'PL', kazakh: 'KZ', kazakistan: 'KZ', belarusian: 'BY', dutch: 'NL', hollanda: 'NL', french: 'FR', fransa: 'FR',
      israeli: 'IL', israil: 'IL', iranian: 'IR', iran: 'IR', azerbaijani: 'AZ', azerbaycan: 'AZ', georgian: 'GE', gurcistan: 'GE',
      'гражданин рф': 'RU', 'рф': 'RU', 'россия': 'RU', 'турция': 'TR', 'германия': 'DE',
    };
    for (const [k, c] of Object.entries(extra)) countryNames.set(norm(k), c);
  }
  return countryNames.get(norm(v)) || null;
}

function gender(v: string, title: string): 'M' | 'F' | null {
  const s = norm(`${v} ${title}`);
  if (/\b(f|female|k|kadin|bayan|mrs|ms|miss|жен|ж)\b/.test(s)) return 'F';
  if (/\b(m|male|e|erkek|bay|mr|муж|м)\b/.test(s)) return 'M';
  return null;
}

/** Колонки по строке заголовков: первая из первых 15 строк, где узнали имя и ещё хотя бы одно поле */
function findHeader(rows: string[][]): { idx: number; cols: typeof EMPTY } | null {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cols = { ...EMPTY };
    rows[i].forEach((cell, c) => {
      const s = norm(String(cell || ''));
      if (!s) return;
      for (const [k, re] of COLS) {
        if (cols[k] < 0 && re.test(s)) { cols[k] = c; break; }
      }
    });
    const hasName = cols.fullName >= 0 || cols.lastName >= 0 || cols.firstName >= 0;
    const others = Object.entries(cols).filter(([k, v]) => v >= 0 && !['fullName', 'lastName', 'firstName'].includes(k)).length;
    if (hasName && others >= 1) return { idx: i, cols };
  }
  return null;
}

export async function parseRoomingList(file: { buffer: Buffer; originalname?: string }): Promise<{ rooms: RoomingRoom[]; columns: string[]; skipped: number }> {
  if (!file?.buffer) throw new BadRequestException({ code: 'HOTEL_ROOMING_NO_FILE', message: 'Файл не передан' });
  const rows = await readRawRows(file);
  const head = findHeader(rows);
  if (!head) throw new BadRequestException({ code: 'HOTEL_ROOMING_NO_HEADER', message: 'Не нашли строку заголовков (Ad Soyad / Name, Oda No / Room…)' });
  const { idx, cols } = head;
  const cell = (r: string[], k: keyof typeof EMPTY) => (cols[k] >= 0 ? String(r[cols[k]] ?? '').trim() : '');
  const rooms: RoomingRoom[] = [];
  let cur: RoomingRoom | null = null;
  let skipped = 0;
  for (let i = idx + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = cell(r, 'fullName') || [cell(r, 'firstName'), cell(r, 'lastName')].filter(Boolean).join(' ');
    if (!name || /^(toplam|total|итого)\b/i.test(name)) {
      if (r.some((c) => String(c || '').trim())) skipped++;
      continue;
    }
    const key = cell(r, 'room') || null;
    const type = cell(r, 'roomType') || null;
    const startsRoom = !cur || (cols.room >= 0 ? !!key && key !== cur.key : cols.roomType >= 0 ? !!type : true);
    if (startsRoom) {
      cur = { row: i + 1, key, roomType: type, checkIn: parseLooseDate(cell(r, 'arrival')), checkOut: parseLooseDate(cell(r, 'departure')), notes: cell(r, 'notes') || null, guests: [] };
      rooms.push(cur);
    } else if (cur && cell(r, 'notes')) {
      cur.notes = [cur.notes, cell(r, 'notes')].filter(Boolean).join('; ');
    }
    const title = cell(r, 'title');
    const ageRaw = cell(r, 'age');
    const age = /^\d{1,2}([.,]\d+)?$/.test(ageRaw) ? Math.floor(Number(ageRaw.replace(',', '.'))) : null;
    cur!.guests.push({
      fullName: name.replace(/\s+/g, ' ').slice(0, 200),
      birthDate: parseLooseDate(cell(r, 'birth')),
      age,
      childHint: /\b(chd|child|inf|infant|bebek|cocuk|реб|млад)\b/i.test(norm(title)),
      passportNumber: cell(r, 'passport') || null,
      passportExpiry: parseLooseDate(cell(r, 'expiry')),
      nationality: cell(r, 'nationality') ? countryFromText(cell(r, 'nationality')) : null,
      gender: gender(cell(r, 'gender'), title),
    });
  }
  if (!rooms.length) throw new BadRequestException({ code: 'HOTEL_ROOMING_EMPTY', message: 'В файле нет гостей под заголовками' });
  return { rooms, columns: Object.entries(cols).filter(([, v]) => v >= 0).map(([k]) => k), skipped };
}
