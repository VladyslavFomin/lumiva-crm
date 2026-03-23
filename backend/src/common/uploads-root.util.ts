import { existsSync } from 'fs';
import { basename, dirname, join } from 'path';
import { readdir, stat, unlink } from 'fs/promises';

/**
 * Корень каталога uploads на диске. Должен совпадать с express.static в main.ts.
 * UPLOADS_ROOT — явный путь; иначе при наличии backend/uploads (запуск из корня монорепо) используем его.
 *
 * Частая ошибка в Docker: UPLOADS_ROOT=/app — тогда файлы пишутся в /app/tenants/...,
 * а статика смотрит в /app/uploads/... → 404. Нормализуем к /app/uploads.
 */
export function getUploadsRoot(): string {
  const env = process.env.UPLOADS_ROOT?.trim();
  if (env) {
    const e = env.replace(/[/\\]+$/, '');
    if (e === '/app') {
      return join(e, 'uploads');
    }
    return e;
  }
  const cwd = process.cwd();
  const nested = join(cwd, 'backend', 'uploads');
  if (existsSync(nested)) return nested;
  return join(cwd, 'uploads');
}

export function joinUploadsAbsolute(relativePath: string): string {
  const r = relativePath.replace(/^\/+/, '');
  return join(getUploadsRoot(), r);
}

/** Путь относительно uploads/ из публичного URL `/v1/uploads/...` или полного URL. */
export function extractRelativePathFromPublicUrl(url: string): string | null {
  const u = (url || '').trim();
  if (!u) return null;
  const marker = '/uploads/';
  const i = u.indexOf(marker);
  if (i === -1) return null;
  return u.slice(i + marker.length).replace(/^\/+/, '').split('?')[0] || null;
}

/**
 * Всегда `/v1/uploads/tenants/...` — без хоста (чтобы не ломались опечатки домена и смена домена).
 */
export function toRelativeUploadsUrl(
  urlOrPath: string | null | undefined,
): string | null {
  if (urlOrPath === undefined || urlOrPath === null) return null;
  const s = String(urlOrPath).trim();
  if (!s) return null;
  if (s.startsWith('/v1/uploads/')) {
    return s.split('?')[0] || null;
  }
  const rel = extractRelativePathFromPublicUrl(s);
  if (rel) {
    return `/v1/uploads/${rel.replace(/^\/+/, '')}`;
  }
  return null;
}

/**
 * Все возможные корни uploads (запись и чтение должны совпадать; при рассинхроне ищем файл по кандидатам).
 * Из dist/main.js: __dirname = .../dist → ../uploads = корень приложения/uploads (например /app/uploads).
 */
export function candidateUploadRoots(): string[] {
  const list: string[] = [];
  const add = (p: string) => {
    if (p && !list.includes(p)) list.push(p);
  };
  const gr = getUploadsRoot();
  add(gr);
  /** До нормализации UPLOADS_ROOT файлы могли лежать в /app/tenants/... вместо /app/uploads/tenants/... */
  const grNorm = gr.replace(/[/\\]+$/, '');
  if (basename(grNorm) === 'uploads') {
    add(dirname(grNorm));
  }
  add(join(process.cwd(), 'uploads'));
  add(join(process.cwd(), 'backend', 'uploads'));
  if (typeof __dirname !== 'undefined') {
    add(join(__dirname, '..', 'uploads'));
    add(join(__dirname, '..', '..', 'uploads'));
  }
  return list;
}

/** Размер файла по пути относительно uploads/, или null если файл не найден. */
export async function sizeBytesForRelativeUploadPath(
  relativePath: string | null | undefined,
): Promise<number | null> {
  if (!relativePath) return null;
  const rel = relativePath.replace(/^\/+/, '');
  for (const root of candidateUploadRoots()) {
    try {
      const st = await stat(join(root, rel));
      if (st.isFile()) return st.size;
    } catch {
      /* next */
    }
  }
  return null;
}

export async function unlinkUploadsRelative(
  relativePath: string,
): Promise<void> {
  const rel = relativePath.replace(/^\/+/, '');
  for (const root of candidateUploadRoots()) {
    try {
      await unlink(join(root, rel));
      return;
    } catch {
      /* try next root */
    }
  }
}

async function sumFilesInDirRecursive(absDir: string): Promise<number> {
  let total = 0;
  let entries;
  try {
    entries = await readdir(absDir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const p = join(absDir, e.name);
    if (e.isDirectory()) {
      total += await sumFilesInDirRecursive(p);
    } else if (e.isFile()) {
      try {
        const st = await stat(p);
        total += st.size;
      } catch {
        /* skip */
      }
    }
  }
  return total;
}

/** Сумма байт по каталогам тенанта на диске (учёт legacy-путей). */
export async function sumTenantUploadsBytesOnDisk(
  tenantId: string,
): Promise<number> {
  const roots = candidateUploadRoots();
  const bases = new Set<string>();
  for (const root of roots) {
    bases.add(join(root, 'tenants', tenantId));
    bases.add(join(root, 'workspace-files', tenantId));
    bases.add(join(root, 'tenant-files', tenantId));
  }
  let total = 0;
  for (const b of bases) {
    total += await sumFilesInDirRecursive(b);
  }
  return total;
}
