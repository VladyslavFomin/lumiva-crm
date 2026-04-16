/**
 * RFC 4180–style CSV splitting (quoted fields, escaped quotes).
 * + delimiter detection with counts outside quotes
 * + duplicate header disambiguation for stable row objects
 */

export function countDelimitersOutsideQuotes(line: string, delim: string): number {
  let n = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') i++;
        else inQuotes = false;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delim) n++;
    }
  }
  return n;
}

export function detectDelimiter(headerLine: string): ',' | ';' | '\t' {
  const comma = countDelimitersOutsideQuotes(headerLine, ',');
  const semi = countDelimitersOutsideQuotes(headerLine, ';');
  const tab = countDelimitersOutsideQuotes(headerLine, '\t');
  if (tab > comma && tab > semi) return '\t';
  if (semi > comma) return ';';
  return ',';
}

export function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur.trim());
  return out;
}

/** Strip BOM, lowercase, collapse spaces/underscores for comparison */
export function normHeaderKey(s: string): string {
  return s
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '_');
}

/**
 * When the same header appears twice, Excel/Sheets often export duplicate names;
 * object keys would overwrite — suffix with " (2)", " (3)", ...
 */
export function makeUniqueHeaders(raw: string[]): {
  columns: string[];
  duplicateCount: number;
} {
  const seen = new Map<string, number>();
  let duplicateCount = 0;
  const columns: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    let base = raw[i].trim();
    if (!base) base = `Column ${i + 1}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    if (n === 0) {
      columns.push(base);
    } else {
      duplicateCount += 1;
      columns.push(`${base} (${n + 1})`);
    }
  }
  return { columns, duplicateCount };
}

export interface ParsedCsvTable {
  columns: string[];
  rows: Record<string, string>[];
  headerRowNumber: number;
  duplicateHeaderCount: number;
}

export function parseCsvRobust(content: string): ParsedCsvTable {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (!lines.length) {
    return { columns: [], rows: [], headerRowNumber: 1, duplicateHeaderCount: 0 };
  }

  const headerLine = lines[0];
  const delimiter = detectDelimiter(headerLine);
  const headerCells = splitCsvLine(headerLine, delimiter).map((c) =>
    c.replace(/^"|"$/g, '').trim(),
  );
  const { columns, duplicateCount } = makeUniqueHeaders(headerCells);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delimiter).map((c) =>
      c.replace(/^"|"$/g, '').trim(),
    );
    const row: Record<string, string> = {};
    for (let idx = 0; idx < columns.length; idx++) {
      row[columns[idx]] = cells[idx] ?? '';
    }
    rows.push(row);
  }

  return {
    columns,
    rows,
    headerRowNumber: 1,
    duplicateHeaderCount: duplicateCount,
  };
}

export type CustomObjectFieldLike = { key: string; label: string };

/**
 * Strict mapping: normalized key/label equality only (no greedy substring includes).
 */
export function buildSuggestedCustomObjectFieldMapping(
  columns: string[],
  fields: CustomObjectFieldLike[],
): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  const cols = columns.map((raw) => ({
    raw,
    nk: normHeaderKey(raw),
  }));

  for (const field of fields) {
    const keyK = normHeaderKey(field.key);
    const labelK = normHeaderKey(field.label);
    const hit = cols.find((c) => c.nk === keyK || c.nk === labelK);
    map[field.key] = hit ? hit.raw : null;
  }
  return map;
}
