// src/api/media.ts
import { api, API_BASE, ApiError } from './client';
import { getAccessToken } from '../auth/session';

export type MediaKind = 'image' | 'video' | 'pdf';
export type MediaLinkScope = 'hotel' | 'multi' | 'agency';

export interface MediaHotel { id: string; name: string; city: string | null }

export interface MediaCollection { id: string; name: string; createdAt: string }

export interface MediaFolder {
  id: string;
  name: string;
  hotelId: string | null;
  collectionId: string | null;
  parentId: string | null;
  createdAt: string;
  filesCount: number;
  bytes: number;
  shared: boolean;
}

export interface MediaFile {
  id: string;
  folderId: string;
  name: string;
  ext: string;
  mime: string;
  kind: MediaKind;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  downloads: number;
  lastDownloadAt: string | null;
  lastDownloadBy: string | null;
  createdAt: string;
  thumbUrl: string | null;
  viewUrl: string | null;
}

export interface MediaOverview {
  hotels: MediaHotel[];
  collections: MediaCollection[];
  folders: MediaFolder[];
  totals: { files: number; activeLinks: number };
  storage: { usedBytes: number; quotaBytes: number | null };
  limits: { maxFileBytes: number; chunkBytes: number };
}

export interface MediaLink {
  id: string;
  name: string;
  slug: string;
  url: string;
  scope: MediaLinkScope;
  hotelIds: string[];
  folderIds: string[];
  fileIds: string[];
  title: string | null;
  description: string | null;
  lang: string | null;
  gate: boolean;
  allowZip: boolean;
  hasPassword: boolean;
  expiresAt: string | null;
  expired: boolean;
  enabled: boolean;
  assigneeStaffId: string | null;
  createdAt: string;
  views: number;
  uniq: number;
  downloads: number;
  leads: number;
  lastActivityAt: string | null;
  spark: number[];
}

export interface MediaLinkInput {
  name?: string;
  slug?: string;
  scope?: MediaLinkScope;
  hotelIds?: string[];
  folderIds?: string[];
  fileIds?: string[];
  title?: string | null;
  description?: string | null;
  lang?: string | null;
  gate?: boolean;
  allowZip?: boolean;
  password?: string | null;
  expiresAt?: string | null;
  enabled?: boolean;
  assigneeStaffId?: string | null;
}

export type MediaFieldType = 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'check';
export interface MediaFormField {
  id: string;
  label: string;
  type: MediaFieldType;
  ph?: string;
  options?: string[];
  on: boolean;
  req: boolean;
  lock?: boolean;
  l10n?: Partial<Record<MediaLang, { label?: string; ph?: string; options?: string[] }>>;
}

export type MediaLang = 'ru' | 'en' | 'tr';

export interface MediaSettings {
  formTitle: string;
  formTitles: Partial<Record<MediaLang, string>>;
  baseLang: MediaLang;
  dict: Array<Record<MediaLang, string>>;
  formFields: MediaFormField[];
  defaults: { formTitle: string; formFields: MediaFormField[] };
  leadStatus: string;
  assigneeStaffId: string | null;
  contactTags: string[];
  reaskDays: number;
  dedupe: 'merge' | 'new';
}

export type MediaPeriod = '7' | '30' | '90' | 'all';

export interface MediaStats {
  period: MediaPeriod;
  bucket: 'day' | 'week';
  kpi: { views: number; uniq: number; files: number; downloads: number; leads: number; bytes: number };
  funnel: Array<{ key: 'visit' | 'open' | 'click' | 'lead'; n: number }>;
  series: Array<{ d: string; views: number; files: number }>;
  feed: Array<{
    id: string;
    type: 'download' | 'lead';
    at: string;
    filesCount: number;
    what: string | null;
    zip: boolean;
    linkId: string;
    linkName: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    role: string | null;
    leadId: string | null;
    leadStatus: string | null;
  }>;
  topFiles: Array<MediaFile & { periodDownloads: number }>;
}

/** Пути превью/скачивания приходят без префикса API (`/public/media/...`). */
export const mediaUrl = (p: string | null | undefined): string | null => (p ? `${API_BASE.replace(/\/$/, '')}${p}` : null);

export const fetchMediaOverview = () => api.get<MediaOverview>('/media/overview');
export type MediaPlace = { hotelId?: string | null; collectionId?: string | null };
export const createMediaFolder = (b: { name: string; parentId?: string | null } & MediaPlace) => api.post<MediaFolder>('/media/folders', b);
export const updateMediaFolder = (id: string, b: { name?: string; parentId?: string | null } & MediaPlace) => api.patch<{ ok: true }>(`/media/folders/${id}`, b);
export const duplicateMediaFolder = (id: string) => api.post<{ id: string; folders: number; files: number }>(`/media/folders/${id}/duplicate`, {});
export const createMediaCollection = (name: string) => api.post<MediaCollection>('/media/collections', { name });
export const renameMediaCollection = (id: string, name: string) => api.patch<{ ok: true }>(`/media/collections/${id}`, { name });
export const deleteMediaCollection = (id: string, mode: 'keep' | 'delete') => api.del<{ ok: true; deletedFiles: number }>(`/media/collections/${id}?mode=${mode}`);
export const deleteMediaFolder = (id: string) => api.del<{ ok: true; deletedFiles: number }>(`/media/folders/${id}`);
export const fetchMediaFiles = (folderId: string, q?: string) => api.get<MediaFile[]>(`/media/folders/${folderId}/files`, { params: q ? { q } : undefined });
export const renameMediaFile = (id: string, name: string) => api.patch<MediaFile>(`/media/files/${id}`, { name });
export const moveMediaFiles = (ids: string[], folderId: string) => api.post<{ moved: number }>('/media/files/move', { ids, folderId });
export const deleteMediaFiles = (ids: string[]) => api.post<{ deleted: number }>('/media/files/delete', { ids });
export const mediaDownloadTicket = (b: { fileIds?: string[]; folderIds?: string[] }) => api.post<{ url: string }>('/media/download', b);

export const fetchMediaLinks = () => api.get<MediaLink[]>('/media/links');
export const createMediaLink = (b: MediaLinkInput) => api.post<MediaLink>('/media/links', b);
export const updateMediaLink = (id: string, b: MediaLinkInput) => api.patch<MediaLink>(`/media/links/${id}`, b);
export const deleteMediaLink = (id: string) => api.del<{ ok: true }>(`/media/links/${id}`);

export const fetchMediaSettings = () => api.get<MediaSettings>('/media/settings');
export const updateMediaSettings = (b: Partial<Omit<MediaSettings, 'defaults' | 'baseLang' | 'dict'>>) => api.patch<MediaSettings>('/media/settings', b);

export const fetchMediaStats = (link: string, period: MediaPeriod) => api.get<MediaStats>('/media/stats', { params: { link, period } });

export async function downloadMediaStatsCsv(link: string, period: MediaPeriod) {
  const res = await fetch(`${API_BASE}/media/stats.csv?link=${encodeURIComponent(link)}&period=${period}`, {
    headers: { Authorization: `Bearer ${getAccessToken() || ''}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `media-stats-${period}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Браузерная загрузка по тикету — без blob в памяти (архивы бывают по несколько ГБ). */
export function startBrowserDownload(path: string) {
  const a = document.createElement('a');
  a.href = mediaUrl(path)!;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ───────────── загрузка файлов ─────────────

function xhr(method: string, path: string, body: FormData | string | null, onProgress?: (loaded: number) => void, signal?: AbortSignal): Promise<any> {
  return new Promise((resolve, reject) => {
    const r = new XMLHttpRequest();
    r.open(method, `${API_BASE}${path}`);
    const token = getAccessToken();
    if (token) r.setRequestHeader('Authorization', `Bearer ${token}`);
    if (typeof body === 'string') r.setRequestHeader('Content-Type', 'application/json');
    if (onProgress) r.upload.onprogress = (e) => onProgress(e.loaded);
    r.onload = () => {
      let data: any = null;
      try { data = r.responseText ? JSON.parse(r.responseText) : null; } catch { /* not json */ }
      if (r.status >= 200 && r.status < 300) resolve(data);
      else reject(new ApiError(data?.message || `HTTP ${r.status}`, r.status, data?.code, data));
    };
    r.onerror = () => reject(new ApiError('network', 0, 'NETWORK'));
    r.onabort = () => reject(new ApiError('aborted', 0, 'ABORTED'));
    signal?.addEventListener('abort', () => r.abort());
    r.send(body);
  });
}

/** Миниатюра и размеры в браузере: у сервера нет sharp/ffmpeg. PDF — без превью. */
async function probe(file: File): Promise<{ thumb: Blob | null; width?: number; height?: number; durationSec?: number }> {
  const toThumb = (src: CanvasImageSource, w: number, h: number): Promise<Blob | null> => {
    const max = 640;
    const k = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    const ctx = c.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', 0.82));
  };
  const url = URL.createObjectURL(file);
  try {
    if (/^image\//.test(file.type) || /\.(jpe?g|png|webp|gif|svg)$/i.test(file.name)) {
      const img = new Image();
      img.decoding = 'async';
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = url; });
      const w = img.naturalWidth || 1200;
      const h = img.naturalHeight || 800;
      return { thumb: await toThumb(img, w, h), width: img.naturalWidth || undefined, height: img.naturalHeight || undefined };
    }
    if (/^video\//.test(file.type) || /\.(mp4|m4v|mov|webm)$/i.test(file.name)) {
      const v = document.createElement('video');
      v.muted = true;
      v.preload = 'metadata';
      v.playsInline = true;
      v.src = url;
      await new Promise<void>((res, rej) => { v.onloadedmetadata = () => res(); v.onerror = () => rej(); setTimeout(rej, 8000); });
      const dur = Number.isFinite(v.duration) ? v.duration : undefined;
      v.currentTime = Math.min(1, (dur || 2) / 3);
      await new Promise<void>((res) => { v.onseeked = () => res(); setTimeout(res, 4000); });
      const thumb = v.videoWidth ? await toThumb(v, v.videoWidth, v.videoHeight) : null;
      return { thumb, width: v.videoWidth || undefined, height: v.videoHeight || undefined, durationSec: dur };
    }
  } catch {
    /* браузер не умеет этот формат (HEIC, некоторые MOV) — без превью */
  } finally {
    URL.revokeObjectURL(url);
  }
  return { thumb: null };
}

export async function uploadMediaFile(
  folderId: string,
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<MediaFile> {
  const meta = await probe(file);
  const init = await xhr('POST', '/media/uploads', JSON.stringify({ folderId, name: file.name, size: file.size }), undefined, signal);
  if (init.duplicateOf) {
    onProgress(1);
    return { ...(init.duplicateOf as MediaFile), duplicate: true } as MediaFile & { duplicate?: boolean };
  }
  const uploadId: string = init.uploadId;
  const chunk: number = init.chunkBytes || 16 * 1024 * 1024;
  try {
    let offset = 0;
    while (offset < file.size) {
      const part = file.slice(offset, Math.min(file.size, offset + chunk));
      const fd = new FormData();
      fd.append('chunk', part, 'chunk');
      let attempt = 0;
      for (;;) {
        try {
          const r = await xhr('POST', `/media/uploads/${uploadId}/chunk?offset=${offset}`, fd, (l) => onProgress(Math.min(0.99, (offset + l) / file.size)), signal);
          offset = Number(r.receivedBytes);
          break;
        } catch (e) {
          // обрыв сети — повторяем кусок; сервер подтвердит уже принятые байты
          if (e instanceof ApiError && e.code === 'NETWORK' && attempt < 3) { attempt++; await new Promise((r) => setTimeout(r, 1500 * attempt)); continue; }
          if (e instanceof ApiError && e.code === 'MEDIA_OFFSET' && typeof e.payload?.receivedBytes === 'number') { offset = e.payload.receivedBytes; break; }
          throw e;
        }
      }
    }
    const fd = new FormData();
    if (meta.width) fd.append('width', String(meta.width));
    if (meta.height) fd.append('height', String(meta.height));
    if (meta.durationSec) fd.append('durationSec', String(meta.durationSec));
    if (meta.thumb) fd.append('thumb', meta.thumb, 'thumb.jpg');
    const res = await xhr('POST', `/media/uploads/${uploadId}/complete`, fd, undefined, signal);
    onProgress(1);
    return res as MediaFile;
  } catch (e) {
    void api.del(`/media/uploads/${uploadId}`).catch(() => undefined);
    throw e;
  }
}

// ───────────── публичная страница ─────────────

export interface MediaShareFile {
  id: string;
  folderId: string;
  name: string;
  ext: string;
  kind: MediaKind;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  thumbUrl: string | null;
  viewUrl: string | null;
}

export interface MediaSharePage {
  needPassword: boolean;
  name?: string;
  brand: { name: string | null; logoUrl: string | null; lang: string | null };
  link?: { name: string | null; description: string | null; lang: string | null; scope: MediaLinkScope; gate: boolean; allowZip: boolean; updatedAt: string | null };
  hotels?: MediaHotel[];
  collections?: Array<{ id: string; name: string }>;
  folders?: Array<{ id: string; name: string; hotelId: string | null; collectionId?: string | null; parentId: string | null; createdAt: string }>;
  looseFolderId?: string | null;
  files?: MediaShareFile[];
  form?: { title: string; fields: MediaFormField[] } | null;
  needForm?: boolean;
  me?: { name: string | null } | null;
}

const VISITOR_KEY = 'lumiva-media-visitor';
export function mediaVisitorToken(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v || !/^[A-Za-z0-9_-]{16,64}$/.test(v)) {
      const a = new Uint8Array(18);
      crypto.getRandomValues(a);
      v = Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return 'anon' + Math.random().toString(16).slice(2).padEnd(16, '0');
  }
}

const accessKey = (slug: string) => `lumiva-media-access:${slug}`;
export const mediaAccess = {
  get: (slug: string) => { try { return sessionStorage.getItem(accessKey(slug)) || ''; } catch { return ''; } },
  set: (slug: string, v: string) => { try { sessionStorage.setItem(accessKey(slug), v); } catch { /* private mode */ } },
};

export async function mediaPublic<T>(slug: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/public/media/s/${encodeURIComponent(slug)}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Media-Visitor': mediaVisitorToken(),
      'X-Media-Access': mediaAccess.get(slug),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* html */ }
  if (!res.ok) throw new ApiError(data?.message || `HTTP ${res.status}`, res.status, data?.code, data);
  return data as T;
}
