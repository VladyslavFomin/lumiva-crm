const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Читает UUID лида/проекта из ячейки: одно значение или JSON-массив строк. */
export function parseCrmEntityIdsFromCell(raw: unknown): string[] {
  if (raw == null) return [];
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const p = JSON.parse(s);
      if (Array.isArray(p)) {
        return [
          ...new Set(
            p
              .map((x) => String(x).trim())
              .filter((x) => UUID_RE.test(x)),
          ),
        ];
      }
    } catch {
      return [];
    }
  }
  if (UUID_RE.test(s)) return [s];
  return [];
}

/** Сохраняем в запись: одна сущность — plain UUID; несколько — JSON-массив. */
export function serializeCrmEntityIds(ids: string[]): string {
  const uuids = [
    ...new Set(ids.map((x) => String(x).trim()).filter((x) => UUID_RE.test(x))),
  ];
  if (uuids.length === 0) return '';
  if (uuids.length === 1) return uuids[0];
  return JSON.stringify(uuids);
}
