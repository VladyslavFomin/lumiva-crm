// Общие правила для UTM-меток (конструктор и хранилище ссылок).

export type ChannelKey = 'google_search' | 'meta_ads' | 'yandex_direct' | 'email' | 'other';

/** Пресеты каналов: source / medium подставляются в форму. */
export const CHANNELS: Array<{ k: ChannelKey; source: string; medium: string }> = [
  { k: 'google_search', source: 'google', medium: 'cpc' },
  { k: 'meta_ads', source: 'facebook', medium: 'paid_social' },
  { k: 'yandex_direct', source: 'yandex', medium: 'cpc' },
  { k: 'email', source: 'email', medium: 'email' },
  { k: 'other', source: '', medium: '' },
];

/** Метка «грязная»: заглавные, пробелы или кириллица — такие значения расщепляют отчёты. */
export const dirty = (v: string) => !!v && (/[A-ZА-ЯЁ]/.test(v) || /\s/.test(v) || /[А-Яа-яЁё]/.test(v));

const TRANSLIT: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };

/** Приводит значение к безопасному виду: латиница в нижнем регистре, пробелы → «_». */
export const clean = (v: string) =>
  v
    .toLowerCase()
    .split('')
    .map((c) => (TRANSLIT[c] !== undefined ? TRANSLIT[c] : c))
    .join('')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\-.]/g, '');

/** Полный адрес со всеми заполненными метками (кодирование делает URL API). */
export function buildTaggedUrl(
  base: string,
  tags: { source?: string | null; medium?: string | null; campaign?: string | null; content?: string | null; term?: string | null },
): { url: string; parts: Array<[string, string]> } | null {
  const b = base.trim();
  if (!b) return null;
  let u: URL;
  try {
    u = new URL(b, b.startsWith('http') ? undefined : 'https://dummy.host');
  } catch {
    return null;
  }
  const parts = (
    [
      ['utm_source', tags.source],
      ['utm_medium', tags.medium],
      ['utm_campaign', tags.campaign],
      ['utm_content', tags.content],
      ['utm_term', tags.term],
    ] as Array<[string, string | null | undefined]>
  ).filter((p): p is [string, string] => !!p[1]);
  parts.forEach(([k, v]) => u.searchParams.set(k, v));
  return { url: u.toString().replace('https://dummy.host', ''), parts };
}
