import { api } from '../api/client';
import type { CustomObjectRecord } from '../api/customObjects';

/**
 * Строки таблицы рабочей области для аналитики — одним компактным ответом и с кэшем в браузере.
 *
 * Раньше аналитика тянула все строки страницами (20 000 строк ≈ 12,7 МБ JSON) при каждом открытии,
 * и каждый блок на главной — отдельно. Теперь:
 *  • в памяти и в IndexedDB лежит последняя версия строк таблицы;
 *  • каждый раз спрашиваем сервер `records/compact?v=<версия>`: сервер проверяет права и, если
 *    таблица не менялась, отвечает `unchanged` без строк — берём их из кэша (данные те же самые);
 *  • одновременные запросы одной таблицы (несколько блоков на главной) объединяются в один.
 * Кэш без подтверждения сервера не используется, поэтому права и свежесть данных не теряются.
 */

type CompactRow = [string, Record<string, unknown>, string, string];
type CompactResponse =
  | { version: string; total: number; unchanged: true }
  | { version: string; total: number; rows: CompactRow[] };

type CacheEntry = { key: string; version: string; rows: CompactRow[]; savedAt: number };

const DB_NAME = 'lumiva-workspace-records';
const STORE = 'records';
const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CustomObjectRecord[]>>();

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readEntry(key: string): Promise<CacheEntry | null> {
  const mem = memory.get(key);
  if (mem) return mem;
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as CacheEntry | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    } finally {
      db.close();
    }
  });
}

async function writeEntry(entry: CacheEntry): Promise<void> {
  memory.set(entry.key, entry);
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(entry);
  } catch {
    /* квота/приватный режим — работаем без постоянного кэша */
  } finally {
    db.close();
  }
}

function toRecords(objectId: string, rows: CompactRow[]): CustomObjectRecord[] {
  return rows.map(([id, values, createdAt, updatedAt]) => ({
    id,
    objectId,
    externalId: null,
    values: (values || {}) as Record<string, any>,
    meta: null,
    createdAt,
    updatedAt,
  }));
}

/** Все строки таблицы (для аналитики). Порядок и содержимое — как у постраничной загрузки. */
export function loadWorkspaceRecordsCached(objectId: string): Promise<CustomObjectRecord[]> {
  const pending = inflight.get(objectId);
  if (pending) return pending;
  const run = (async () => {
    const cached = await readEntry(objectId);
    const qs = cached?.version ? `?v=${encodeURIComponent(cached.version)}` : '';
    const res = await api.get<CompactResponse>(`/custom-objects/${objectId}/records/compact${qs}`);
    if ('unchanged' in res && res.unchanged && cached) {
      memory.set(objectId, cached);
      return toRecords(objectId, cached.rows);
    }
    const rows = 'rows' in res ? res.rows : [];
    void writeEntry({ key: objectId, version: res.version, rows, savedAt: Date.now() });
    return toRecords(objectId, rows);
  })();
  inflight.set(objectId, run);
  run.finally(() => inflight.delete(objectId)).catch(() => {});
  return run;
}

/** При выходе из аккаунта — стереть кэш строк (чужой аккаунт в том же браузере его не увидит). */
export function clearWorkspaceRecordsCache(): void {
  memory.clear();
  try {
    if (typeof indexedDB !== 'undefined') indexedDB.deleteDatabase(DB_NAME);
  } catch {
    /* ignore */
  }
}
