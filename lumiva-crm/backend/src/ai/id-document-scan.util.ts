import { BadRequestException, Logger } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { resolveTenantAiOverrideFromRepo } from './tenant-ai-override.util';
import { normalizeCountry } from '../common/countries';

type AiOpenAiService = import('./ai-openai.service').AiOpenAiService;
type AiQuotaService = import('./ai-quota.service').AiQuotaService;

const log = new Logger('IdDocumentScan');

/** Цифры документа читает gpt-4o (mini путает 0/O, 1/I), цены — за 1M токенов. */
const MODEL = 'gpt-4o';
const IN_PRICE = 2.5;
const OUT_PRICE = 10;
const MAX_BYTES = 8 * 1024 * 1024;
const MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type IdDocumentScan = {
  documentType: 'passport' | 'id_card' | 'other';
  surname: string;
  givenNames: string;
  fullName: string;
  /** ISO 3166-1 alpha-3, как в MRZ (TUR, RUS, DEU, GBR…) */
  nationalityIso3: string | null;
  /** Название страны на языке интерфейса */
  nationalityName: string | null;
  /** ISO 3166-1 alpha-2 (для справочника стран CRM) */
  nationalityCode: string | null;
  documentNumber: string;
  birthDate: string | null;
  expiryDate: string | null;
  sex: 'M' | 'F' | null;
  /** Номер, даты и пол сверены по контрольным цифрам MRZ */
  mrzVerified: boolean;
  warnings: Array<'no_mrz' | 'mrz_checksum_failed' | 'expired'>;
};

/* ───────────── MRZ (ICAO 9303) ───────────── */

const mrzValue = (c: string) => (c >= '0' && c <= '9' ? c.charCodeAt(0) - 48 : c >= 'A' && c <= 'Z' ? c.charCodeAt(0) - 55 : 0);

export function mrzCheck(field: string): number {
  const w = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < field.length; i++) sum += mrzValue(field[i]) * w[i % 3];
  return sum % 10;
}

const checkOk = (field: string, digit: string) => /^\d$/.test(digit) && mrzCheck(field) === Number(digit);

/** YYMMDD → YYYY-MM-DD; дата рождения не может быть в будущем, срок действия — всегда 20xx. */
function mrzDate(s: string, kind: 'birth' | 'expiry'): string | null {
  if (!/^\d{6}$/.test(s)) return null;
  const yy = Number(s.slice(0, 2));
  const mm = s.slice(2, 4);
  const dd = s.slice(4, 6);
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  const nowYy = new Date().getUTCFullYear() % 100;
  const year = kind === 'expiry' ? 2000 + yy : yy > nowYy ? 1900 + yy : 2000 + yy;
  return `${year}-${mm}-${dd}`;
}

const mrzNames = (s: string) => {
  const [sur, given = ''] = s.split('<<');
  const clean = (x: string) => x.replace(/<+/g, ' ').trim();
  return { surname: clean(sur), givenNames: clean(given) };
};

type MrzParsed = {
  documentType: 'passport' | 'id_card';
  documentNumber: string;
  nationalityIso3: string;
  birthDate: string | null;
  expiryDate: string | null;
  sex: 'M' | 'F' | null;
  surname: string;
  givenNames: string;
  valid: boolean;
};

/** Разбор TD3 (паспорт, 2×44) и TD1 (ID-карта, 3×30). null — строки не похожи на MRZ. */
export function parseMrz(rawLines: string[]): MrzParsed | null {
  const lines = rawLines.map((l) => String(l || '').toUpperCase().replace(/\s+/g, '').replace(/[«‹]/g, '<')).filter(Boolean);
  const sexOf = (c: string) => (c === 'M' || c === 'F' ? c : null);
  if (lines.length >= 2 && lines[lines.length - 2].length === 44 && lines[lines.length - 1].length === 44) {
    const [l1, l2] = lines.slice(-2);
    const num = l2.slice(0, 9);
    const valid = checkOk(num, l2[9]) && checkOk(l2.slice(13, 19), l2[19]) && checkOk(l2.slice(21, 27), l2[27]);
    return {
      documentType: 'passport',
      documentNumber: num.replace(/<+$/g, ''),
      nationalityIso3: l2.slice(10, 13).replace(/</g, ''),
      birthDate: mrzDate(l2.slice(13, 19), 'birth'),
      expiryDate: mrzDate(l2.slice(21, 27), 'expiry'),
      sex: sexOf(l2[20]),
      ...mrzNames(l1.slice(5)),
      valid,
    };
  }
  if (lines.length >= 3 && lines.slice(-3).every((l) => l.length === 30)) {
    const [l1, l2, l3] = lines.slice(-3);
    const num = l1.slice(5, 14);
    const valid = checkOk(num, l1[14]) && checkOk(l2.slice(0, 6), l2[6]) && checkOk(l2.slice(8, 14), l2[14]);
    return {
      documentType: 'id_card',
      documentNumber: num.replace(/<+$/g, ''),
      nationalityIso3: l2.slice(15, 18).replace(/</g, ''),
      birthDate: mrzDate(l2.slice(0, 6), 'birth'),
      expiryDate: mrzDate(l2.slice(8, 14), 'expiry'),
      sex: sexOf(l2[7]),
      ...mrzNames(l3),
      valid,
    };
  }
  return null;
}

/* ───────────── распознавание ───────────── */

const LANG_NAME: Record<string, string> = { ru: 'Russian', en: 'English', tr: 'Turkish' };

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const isoDate = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : null);

/**
 * Фото паспорта / ID-карты → поля гостя. Свой ключ OpenAI тенанта (BYOK), иначе платформенный
 * со списанием квоты. Фото никуда не сохраняется — только уходит в модель. MRZ, если читается,
 * разбирается кодом: при верных контрольных цифрах номер/даты/пол берутся из неё, а не из ответа модели.
 */
export async function scanIdDocument(
  moduleRef: ModuleRef,
  tenantId: string,
  userId: string | null,
  file: { buffer: Buffer; mimetype: string; size?: number },
  lang: string,
): Promise<IdDocumentScan> {
  if (!file?.buffer?.length) throw new BadRequestException({ code: 'NO_FILE', message: 'No image' });
  if (file.buffer.length > MAX_BYTES) throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: 'Image is larger than 8 MB' });
  if (!MIME.has(file.mimetype)) throw new BadRequestException({ code: 'BAD_FORMAT', message: 'Only JPEG, PNG or WebP' });

  const ds = moduleRef.get(DataSource, { strict: false });
  const override = await resolveTenantAiOverrideFromRepo(ds.getRepository(IntegrationConnection), tenantId);
  // У Anthropic-ключа нет пути для картинок в нашем клиенте — тогда платформенный OpenAI с квотой
  const byok = !!override && override.provider !== 'anthropic';
  const quota: AiQuotaService = moduleRef.get(require('./ai-quota.service').AiQuotaService, { strict: false });
  if (!byok && (await quota.getQuotaSnapshot(tenantId)).totalAvailableCents <= 0) {
    throw new BadRequestException({ code: 'AI_QUOTA_EXCEEDED', message: 'AI quota is empty' });
  }

  const outLang = LANG_NAME[lang] || 'English';
  const prompt = [
    'You read identity documents for hotel guest registration. Look at the image and reply with JSON only:',
    '{"isDocument":bool,"documentType":"passport"|"id_card"|"other","surname":"","givenNames":"","nationalityIso3":"","nationalityName":"",',
    '"documentNumber":"","birthDate":"YYYY-MM-DD","expiryDate":"YYYY-MM-DD","sex":"M"|"F"|null,"mrz":["line1","line2"]}',
    'Rules: copy names in Latin letters exactly as printed in the visual zone (keep diacritics such as Ç, Ş, Ü). ',
    'nationalityIso3 — the ISO 3166-1 alpha-3 code printed on the document. ',
    `nationalityName — that country's name in ${outLang}. `,
    'mrz — the machine-readable lines at the bottom copied character by character, including every "<" (empty array if there is no MRZ). ',
    'Never guess: leave a field empty or null if it is not readable. isDocument=false if the image is not an identity document.',
  ].join('');

  const oai: AiOpenAiService = moduleRef.get(require('./ai-openai.service').AiOpenAiService, { strict: false });
  const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  const { message, usage } = await oai
    .chatCompletionWithConfig(
    {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ] as any,
        },
      ],
      modelOverride: MODEL,
      temperatureOverride: 0,
      jsonMode: true,
      timeoutMs: 60_000,
    },
    byok ? override : undefined,
    )
    .catch((e) => {
      // сбой платформенного ключа (биллинг/лимиты платформы) клиенту не показываем — только свой ключ
      if (byok) throw e;
      log.warn(`tenant ${tenantId}: id scan provider failed: ${(e as Error).message}`);
      throw new BadRequestException({ code: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable' });
    });
  if (!byok) {
    const cents = oai.estimateCostCents(usage.prompt_tokens || 0, usage.completion_tokens || 0, IN_PRICE, OUT_PRICE);
    await quota
      .chargeCents(tenantId, cents, {
        userId: userId || undefined,
        kind: 'chat',
        model: MODEL,
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
      })
      .catch((e) => log.warn(`tenant ${tenantId}: id scan quota charge failed: ${(e as Error).message}`));
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(String(message.content || '{}'));
  } catch {
    throw new BadRequestException({ code: 'AI_PROVIDER_ERROR', message: 'Unreadable model response' });
  }
  if (raw.isDocument === false) throw new BadRequestException({ code: 'NOT_A_DOCUMENT', message: 'No identity document in the image' });

  const docType = ['passport', 'id_card'].includes(str(raw.documentType)) ? (str(raw.documentType) as 'passport' | 'id_card') : 'other';
  const out: IdDocumentScan = {
    documentType: docType,
    surname: str(raw.surname),
    givenNames: str(raw.givenNames),
    fullName: '',
    nationalityIso3: str(raw.nationalityIso3).toUpperCase().slice(0, 3) || null,
    nationalityName: str(raw.nationalityName) || null,
    nationalityCode: null,
    documentNumber: str(raw.documentNumber).replace(/\s+/g, ''),
    birthDate: isoDate(raw.birthDate),
    expiryDate: isoDate(raw.expiryDate),
    sex: raw.sex === 'M' || raw.sex === 'F' ? raw.sex : null,
    mrzVerified: false,
    warnings: [],
  };

  const mrz = parseMrz(Array.isArray(raw.mrz) ? raw.mrz.map(String) : []);
  if (!mrz) {
    out.warnings.push('no_mrz');
  } else if (!mrz.valid) {
    out.warnings.push('mrz_checksum_failed');
  } else {
    out.mrzVerified = true;
    out.documentType = mrz.documentType;
    out.documentNumber = mrz.documentNumber;
    out.nationalityIso3 = mrz.nationalityIso3 || out.nationalityIso3;
    out.birthDate = mrz.birthDate || out.birthDate;
    out.expiryDate = mrz.expiryDate || out.expiryDate;
    out.sex = mrz.sex || out.sex;
    // имена из визуальной зоны точнее (в MRZ нет диакритики) — MRZ только если модель их не прочла
    if (!out.surname) out.surname = mrz.surname;
    if (!out.givenNames) out.givenNames = mrz.givenNames;
  }
  out.fullName = [out.givenNames, out.surname].filter(Boolean).join(' ');
  out.nationalityCode = normalizeCountry(out.nationalityIso3);
  if (out.expiryDate && out.expiryDate < new Date().toISOString().slice(0, 10)) out.warnings.push('expired');
  if (!out.fullName && !out.documentNumber) throw new BadRequestException({ code: 'NOT_A_DOCUMENT', message: 'Nothing readable' });
  return out;
}
