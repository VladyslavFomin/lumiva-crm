// src/pages/media/MediaFilesTab.tsx — вкладка «Файлы» (порт components/media-crm-files.jsx на реальные данные)
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createMediaCollection,
  createMediaFolder,
  deleteMediaCollection,
  deleteMediaFiles,
  deleteMediaFolder,
  duplicateMediaFolder,
  fetchMediaFiles,
  mediaDownloadTicket,
  mediaUrl,
  moveMediaFiles,
  renameMediaCollection,
  renameMediaFile,
  startBrowserDownload,
  updateMediaFolder,
  uploadMediaFile,
  type MediaFile,
  type MediaFolder,
  type MediaLink,
  type MediaOverview,
  type MediaPlace,
} from '../../api/media';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { FolderGlyph, Ic, MIC, Thumb, cx, dims, fmtBytes, fmtDate, fmtDur } from './mediaUi';

export interface ShareInit {
  folderIds: string[];
  fileIds?: string[];
  scope: 'hotel' | 'multi' | 'agency';
  hotelId?: string | null;
  collectionId?: string | null;
}

interface UploadItem {
  key: string;
  name: string;
  size: number;
  folderId: string;
  progress: number;
  error?: string;
  local?: string | null;
  file: File;
}

const ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.svg,.heic,.tif,.tiff,.mp4,.m4v,.mov,.webm,.pdf,image/*,video/*,application/pdf';
const OK_EXT = /\.(jpe?g|png|webp|gif|svg|heic|tiff?|mp4|m4v|mov|webm|pdf)$/i;
const DRAG_FILES = 'application/x-lumiva-media-files';
const DRAG_FOLDER = 'application/x-lumiva-media-folder';

/** scope: 'all' | 'none' | <hotelId> | 'c:<collectionId>' */
const placeOf = (s: string): MediaPlace =>
  s.startsWith('c:') ? { hotelId: null, collectionId: s.slice(2) } : s === 'none' || s === 'all' ? { hotelId: null, collectionId: null } : { hotelId: s, collectionId: null };
const scopeOf = (f: Pick<MediaFolder, 'hotelId' | 'collectionId'>) => (f.hotelId ? f.hotelId : f.collectionId ? `c:${f.collectionId}` : 'none');

/** Файл из перетащенной/выбранной папки: path — цепочка папок относительно места загрузки. */
type Picked = { path: string[]; file: File };
const JUNK = /^(\.|thumbs\.db$|desktop\.ini$|__macosx$)/i;

/** Читает перетащенное (файлы и целые папки с подпапками). Записи берём синхронно — после await dataTransfer пуст. */
function readDropped(dt: DataTransfer): Promise<Picked[]> {
  const items = Array.from(dt.items || []);
  const entries = items.map((i) => (i.kind === 'file' && typeof i.webkitGetAsEntry === 'function' ? i.webkitGetAsEntry() : null));
  if (!entries.some(Boolean)) return Promise.resolve(Array.from(dt.files || []).map((file) => ({ path: [], file })));
  const walk = async (entry: any, path: string[]): Promise<Picked[]> => {
    if (!entry || JUNK.test(entry.name)) return [];
    if (entry.isFile) {
      return new Promise((res) => entry.file((file: File) => res([{ path, file }]), () => res([])));
    }
    if (entry.isDirectory) {
      const reader = entry.createReader();
      const all: any[] = [];
      // readEntries отдаёт порциями (по 100 в Chrome) — читаем до пустого ответа
      for (;;) {
        const batch: any[] = await new Promise((res) => reader.readEntries(res, () => res([])));
        if (!batch.length) break;
        all.push(...batch);
      }
      const nested = await Promise.all(all.map((c) => walk(c, [...path, entry.name])));
      return nested.flat();
    }
    return [];
  };
  return Promise.all(entries.map((e) => walk(e, []))).then((x) => x.flat());
}

type MoveTarget = { kind: 'files'; ids: string[] } | { kind: 'folder'; folder: MediaFolder };

export const MediaFilesTab: React.FC<{
  overview: MediaOverview;
  links: MediaLink[];
  reload: () => Promise<void>;
  onShare: (init: ShareInit) => void;
}> = ({ overview, links, reload, onShare }) => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'ru').slice(0, 2);
  const { showAlert, showConfirm, showPrompt } = useAlertModal();
  const hasHotels = overview.hotels.length > 0;
  const collections = overview.collections || [];
  const folders = overview.folders;

  const [scope, setScope] = useState<string>(() => (hasHotels || collections.length ? 'all' : 'none'));
  // ?folder=<id> — открыть папку сразу (ссылка из карточек папок на главной)
  const [cur, setCur] = useState<string | null>(() => {
    const id = new URLSearchParams(window.location.search).get('folder');
    return id && folders.some((f) => f.id === id) ? id : null;
  });
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try { return (localStorage.getItem('lumiva-media-view') as 'grid' | 'list') || 'grid'; } catch { return 'grid'; }
  });
  const [showEmptyHotels, setShowEmptyHotels] = useState(false);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [drag, setDrag] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [ups, setUps] = useState<UploadItem[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [lb, setLb] = useState<number | null>(null);
  const [newF, setNewF] = useState<string | null>(null);
  const [moveT, setMoveT] = useState<MoveTarget | null>(null);
  const [menu, setMenu] = useState<{ key: string; x: number; y: number; items: Array<{ label: string; icon: React.ReactNode; run: () => void; danger?: boolean }> } | null>(null);
  const inp = useRef<HTMLInputElement>(null);
  const dirInp = useRef<HTMLInputElement>(null);
  const queueRef = useRef<UploadItem[]>([]);
  const activeRef = useRef(0);
  const curRef = useRef<string | null>(null);
  curRef.current = cur;

  useEffect(() => { try { localStorage.setItem('lumiva-media-view', view); } catch { /* ignore */ } }, [view]);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', close);
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); window.removeEventListener('keydown', close); };
  }, [menu]);

  const byId = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const kids = useCallback((id: string | null) => folders.filter((f) => f.parentId === id), [folders]);
  const tops = useCallback(
    (s: string) =>
      folders.filter((f) => {
        if (f.parentId) return false;
        if (s === 'all') return true;
        if (s === 'none') return !f.hotelId && !f.collectionId;
        if (s.startsWith('c:')) return f.collectionId === s.slice(2);
        return f.hotelId === s;
      }),
    [folders],
  );
  const deepCount = useCallback((id: string): number => {
    const f = byId.get(id);
    return (f?.filesCount ?? 0) + kids(id).reduce((s, k) => s + deepCount(k.id), 0);
  }, [byId, kids]);
  const deepBytes = useCallback((id: string): number => {
    const f = byId.get(id);
    return (f?.bytes ?? 0) + kids(id).reduce((s, k) => s + deepBytes(k.id), 0);
  }, [byId, kids]);
  const pathOf = useCallback((id: string | null): MediaFolder[] => {
    const out: MediaFolder[] = [];
    let f = id ? byId.get(id) : undefined;
    while (f) { out.unshift(f); f = f.parentId ? byId.get(f.parentId) : undefined; }
    return out;
  }, [byId]);
  const placeName = useCallback((p: Pick<MediaFolder, 'hotelId' | 'collectionId'>) => {
    if (p.hotelId) return overview.hotels.find((h) => h.id === p.hotelId)?.name ?? '—';
    if (p.collectionId) return collections.find((c) => c.id === p.collectionId)?.name ?? '—';
    return t('crm.media.noHotel');
  }, [overview.hotels, collections, t]);

  useEffect(() => { if (cur && !byId.has(cur)) setCur(null); }, [byId, cur]);
  useEffect(() => {
    if (scope.startsWith('c:') && !collections.some((c) => `c:${c.id}` === scope)) setScope('all');
  }, [collections, scope]);

  const loadFiles = useCallback(async (folderId: string, query: string) => {
    setFilesLoading(true);
    try {
      const list = await fetchMediaFiles(folderId, query || undefined);
      if (curRef.current === folderId) setFiles(list);
    } catch (e: any) {
      showAlert(e?.message || String(e), { variant: 'error' });
    } finally {
      setFilesLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    setSel(new Set());
    setOpen(null);
    if (!cur) { setFiles([]); return; }
    const h = setTimeout(() => void loadFiles(cur, q), q ? 250 : 0);
    return () => clearTimeout(h);
  }, [cur, q, loadFiles]);

  const go = (s: string, f: string | null) => { setScope(s); setCur(f); setQ(''); setNewF(null); };
  const err = (e: any) => showAlert(e?.message || String(e), { variant: 'error' });

  // отели с папками — наверху; пустые свёрнуты, чтобы 20 отелей не забивали дерево
  const hotelsWith = overview.hotels.filter((h) => tops(h.id).length > 0);
  const hotelsEmpty = overview.hotels.filter((h) => tops(h.id).length === 0);
  const scopeLabel = (s: string) =>
    s === 'all' ? t('crm.media.scopeAll') : s === 'none' ? (hasHotels || collections.length ? t('crm.media.noHotel') : t('crm.media.library')) : s.startsWith('c:') ? collections.find((c) => `c:${c.id}` === s)?.name ?? '' : overview.hotels.find((h) => h.id === s)?.name ?? '';

  const linksFor = (fid: string) => {
    const p = pathOf(fid).map((x) => x.id);
    return links.filter((l) => l.enabled && l.folderIds.some((id) => p.includes(id)));
  };

  // ───── загрузка ─────
  const pump = useCallback(() => {
    while (activeRef.current < 3 && queueRef.current.length) {
      const it = queueRef.current.shift()!;
      activeRef.current++;
      uploadMediaFile(it.folderId, it.file, (p) => setUps((u) => u.map((x) => (x.key === it.key ? { ...x, progress: p } : x))))
        .then((saved) => {
          setUps((u) => u.filter((x) => x.key !== it.key));
          if (it.local) URL.revokeObjectURL(it.local);
          if (curRef.current === it.folderId && !(saved as { duplicate?: boolean }).duplicate) setFiles((fs) => [...fs, saved].sort((a, b) => a.name.localeCompare(b.name)));
        })
        .catch((e: any) => setUps((u) => u.map((x) => (x.key === it.key ? { ...x, error: e?.message || String(e) } : x))))
        .finally(() => {
          activeRef.current--;
          if (!queueRef.current.length && activeRef.current === 0) void reload();
          pump();
        });
    }
  }, [reload]);

  /** Ставит файлы в очередь загрузки; target — папка назначения для каждого файла. Возвращает отбракованные. */
  const enqueue = (list: Array<{ file: File; folderId: string }>, silent = false) => {
    const bad = list.filter((x) => !OK_EXT.test(x.file.name)).map((x) => x.file);
    const big = list.filter((x) => OK_EXT.test(x.file.name) && x.file.size > overview.limits.maxFileBytes).map((x) => x.file);
    const good = list.filter((x) => OK_EXT.test(x.file.name) && x.file.size <= overview.limits.maxFileBytes);
    if (!silent && (bad.length || big.length)) {
      const parts: string[] = [];
      if (bad.length) parts.push(t('crm.media.badFormat', { names: bad.slice(0, 5).map((f) => f.name).join(', ') + (bad.length > 5 ? ` +${bad.length - 5}` : '') }));
      if (big.length) parts.push(t('crm.media.tooBig', { names: big.slice(0, 5).map((f) => f.name).join(', ') }));
      showAlert(parts.join('\n'), { variant: 'error' });
    }
    const stamp = Date.now();
    const items: UploadItem[] = good.map(({ file, folderId }, i) => ({
      key: `${stamp}-${i}-${file.name}`,
      name: file.name,
      size: file.size,
      folderId,
      progress: 0,
      file,
      local: /^image\/(jpeg|png|webp|gif)/.test(file.type) ? URL.createObjectURL(file) : null,
    }));
    if (items.length) {
      setUps((u) => [...u, ...items]);
      queueRef.current.push(...items);
      pump();
    }
    return { bad: bad.length + big.length, queued: items.length };
  };

  const addFiles = (list: FileList | File[] | null) => {
    if (!cur || !list) return;
    enqueue(Array.from(list).map((file) => ({ file, folderId: cur })));
  };

  /**
   * Загрузка папок целиком: создаём структуру (совпадающие по имени папки — переиспользуем),
   * затем файлы — каждый в свою папку. Внутри открытой папки — подпапками, на уровне
   * отеля/раздела/«Без отеля» — папками верхнего уровня.
   */
  const importPicked = async (picked: Picked[]) => {
    const list = picked.filter((p) => !JUNK.test(p.file.name) && !p.path.some((x) => JUNK.test(x)));
    if (!list.length) return;
    const loose = list.filter((p) => !p.path.length);
    if (!cur && loose.length) {
      showAlert(t('crm.media.looseNeedFolder', { n: loose.length }), { variant: 'error' });
    }
    const withDirs = cur ? list : list.filter((p) => p.path.length);
    if (!withDirs.length) return;
    const place = cur ? {} : placeOf(scope === 'all' ? 'none' : scope);
    if (!cur && scope === 'all') setScope('none');
    const known = new Map<string, string>(); // 'a/b' → folderId
    const dirs = [...new Set(withDirs.filter((p) => p.path.length).flatMap((p) => p.path.map((_, i) => p.path.slice(0, i + 1).join('/'))))].sort(
      (a, b) => a.split('/').length - b.split('/').length,
    );
    let created = 0;
    try {
      for (const d of dirs) {
        const parts = d.split('/');
        const name = parts[parts.length - 1];
        const parentId = parts.length === 1 ? cur : known.get(parts.slice(0, -1).join('/'))!;
        const existing = folders.find(
          (f) => f.parentId === parentId && f.name.toLowerCase() === name.toLowerCase() && (parentId || (f.hotelId ?? null) === ((place as MediaPlace).hotelId ?? null) && (f.collectionId ?? null) === ((place as MediaPlace).collectionId ?? null)),
        );
        if (existing) { known.set(d, existing.id); continue; }
        const nf = await createMediaFolder({ name: name.slice(0, 200), parentId, ...(parentId ? {} : place) });
        known.set(d, nf.id);
        created++;
      }
    } catch (e: any) {
      err(e);
      return;
    }
    const r = enqueue(withDirs.map((p) => ({ file: p.file, folderId: p.path.length ? known.get(p.path.join('/'))! : cur! })), true);
    await reload();
    const top = [...new Set(withDirs.filter((p) => p.path.length).map((p) => p.path[0]))];
    const msg = top.length ? t('crm.media.folderImported', { name: top.slice(0, 3).join(', '), folders: created, n: r.queued }) : t('crm.media.uploadingN', { n: r.queued });
    showAlert(r.bad ? `${msg}. ${t('crm.media.skippedN', { n: r.bad })}` : msg, { variant: 'success' });
  };

  const onPickDir = (fl: FileList | null) => {
    if (!fl?.length) return;
    void importPicked(Array.from(fl).map((file) => {
      const rel = ((file as any).webkitRelativePath as string) || file.name;
      return { file, path: rel.split('/').slice(0, -1) };
    }));
  };

  const retry = (it: UploadItem) => {
    setUps((u) => u.map((x) => (x.key === it.key ? { ...x, error: undefined, progress: 0 } : x)));
    queueRef.current.push({ ...it, error: undefined, progress: 0 });
    pump();
  };

  // ───── папки ─────
  const startNewFolder = () => {
    // из «Вся медиатека» — папка без отеля (свой архив)
    if (!cur && scope === 'all') setScope('none');
    setNewF('');
  };
  const createFolder = async () => {
    const name = (newF || '').trim();
    setNewF(null);
    if (!name) return;
    try {
      await createMediaFolder({ name, parentId: cur, ...(cur ? {} : placeOf(scope)) });
      await reload();
    } catch (e: any) { err(e); }
  };

  const curFolder = cur ? byId.get(cur) ?? null : null;

  const renameFolder = async (f: MediaFolder) => {
    const name = await showPrompt({ title: t('crm.media.renameFolder'), defaultValue: f.name, confirmLabel: t('crm.media.save') });
    if (!name || !name.trim() || name.trim() === f.name) return;
    try { await updateMediaFolder(f.id, { name: name.trim() }); await reload(); } catch (e: any) { err(e); }
  };
  const duplicateFolder = async (f: MediaFolder) => {
    try {
      const r = await duplicateMediaFolder(f.id);
      await reload();
      showAlert(t('crm.media.duplicated', { name: f.name, n: r.files }), { variant: 'success' });
    } catch (e: any) { err(e); }
  };
  const removeFolder = async (f: MediaFolder) => {
    const n = deepCount(f.id);
    const ok = await showConfirm(t('crm.media.deleteFolderConfirm', { name: f.name, n }), { danger: true, confirmLabel: t('crm.media.delete') });
    if (!ok) return;
    try {
      await deleteMediaFolder(f.id);
      if (cur && pathOf(cur).some((p) => p.id === f.id)) setCur(f.parentId);
      await reload();
    } catch (e: any) { err(e); }
  };
  const moveFolder = async (f: MediaFolder, to: { parentId: string } | MediaPlace) => {
    if ('parentId' in to && (to.parentId === f.id || to.parentId === f.parentId)) return;
    try {
      await updateMediaFolder(f.id, 'parentId' in to ? { parentId: to.parentId } : { parentId: null, hotelId: to.hotelId ?? null, collectionId: to.collectionId ?? null });
      setMoveT(null);
      await reload();
      showAlert(t('crm.media.folderMoved', { name: f.name }), { variant: 'success' });
    } catch (e: any) { err(e); }
  };

  const download = async (b: { fileIds?: string[]; folderIds?: string[] }) => {
    try {
      const { url } = await mediaDownloadTicket(b);
      startBrowserDownload(url);
    } catch (e: any) { err(e); }
  };

  const shareFolder = (f: MediaFolder) => {
    const top = pathOf(f.id)[0] || f;
    onShare({ folderIds: [f.id], scope: top.hotelId ? 'hotel' : 'agency', hotelId: top.hotelId, collectionId: top.collectionId });
  };

  const folderMenu = (f: MediaFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({
      key: f.id,
      x: Math.min(window.innerWidth - 230, r.left),
      y: r.bottom + 4,
      items: [
        { label: t('crm.media.open'), icon: MIC.folder, run: () => go(scopeOf(pathOf(f.id)[0] || f), f.id) },
        { label: t('crm.media.rename'), icon: MIC.edit, run: () => void renameFolder(f) },
        { label: t('crm.media.duplicate'), icon: MIC.copy, run: () => void duplicateFolder(f) },
        { label: t('crm.media.moveTo'), icon: MIC.move, run: () => setMoveT({ kind: 'folder', folder: f }) },
        { label: t('crm.media.downloadFolder'), icon: MIC.zip, run: () => void download({ folderIds: [f.id] }) },
        { label: t('crm.media.shareFolder'), icon: MIC.link, run: () => shareFolder(f) },
        { label: t('crm.media.delete'), icon: MIC.trash, run: () => void removeFolder(f), danger: true },
      ],
    });
  };

  // ───── разделы ─────
  const addCollection = async () => {
    const name = await showPrompt({ title: t('crm.media.newCollection'), label: t('crm.media.collectionHint'), placeholder: 'Selectum Hotels', confirmLabel: t('crm.media.create') });
    if (!name || !name.trim()) return;
    try {
      const c = await createMediaCollection(name.trim());
      await reload();
      go(`c:${c.id}`, null);
    } catch (e: any) { err(e); }
  };
  const collectionMenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const c = collections.find((x) => x.id === id);
    if (!c) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({
      key: `c:${id}`,
      x: Math.min(window.innerWidth - 230, r.left),
      y: r.bottom + 4,
      items: [
        {
          label: t('crm.media.rename'),
          icon: MIC.edit,
          run: async () => {
            const name = await showPrompt({ title: t('crm.media.renameCollection'), defaultValue: c.name, confirmLabel: t('crm.media.save') });
            if (!name || !name.trim() || name.trim() === c.name) return;
            try { await renameMediaCollection(c.id, name.trim()); await reload(); } catch (ex: any) { err(ex); }
          },
        },
        {
          label: t('crm.media.deleteCollection'),
          icon: MIC.trash,
          danger: true,
          run: async () => {
            const n = tops(`c:${c.id}`).length;
            let mode: 'keep' | 'delete' = 'keep';
            if (n > 0) {
              const keep = await showConfirm(t('crm.media.deleteCollectionKeep', { name: c.name, n }), { confirmLabel: t('crm.media.keepFolders'), cancelLabel: t('crm.media.moreOptions') });
              if (!keep) {
                const del = await showConfirm(t('crm.media.deleteCollectionAll', { name: c.name }), { danger: true, confirmLabel: t('crm.media.deleteWithFolders') });
                if (!del) return;
                mode = 'delete';
              }
            } else if (!(await showConfirm(t('crm.media.deleteCollectionEmpty', { name: c.name }), { danger: true, confirmLabel: t('crm.media.delete') }))) return;
            try { await deleteMediaCollection(c.id, mode); if (scope === `c:${c.id}`) go('all', null); await reload(); } catch (ex: any) { err(ex); }
          },
        },
      ],
    });
  };

  // ───── файлы ─────
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const removeFiles = async (ids: string[]) => {
    const ok = await showConfirm(t('crm.media.deleteFilesConfirm', { n: ids.length }), { danger: true, confirmLabel: t('crm.media.delete') });
    if (!ok) return;
    try {
      await deleteMediaFiles(ids);
      setFiles((fs) => fs.filter((f) => !ids.includes(f.id)));
      setSel(new Set());
      if (open && ids.includes(open)) setOpen(null);
      await reload();
    } catch (e: any) { err(e); }
  };
  const moveFilesTo = async (ids: string[], folderId: string) => {
    if (!ids.length || folderId === cur) return;
    try {
      await moveMediaFiles(ids, folderId);
      setFiles((fs) => fs.filter((f) => !ids.includes(f.id)));
      setSel(new Set());
      setMoveT(null);
      await reload();
      showAlert(t('crm.media.moved', { n: ids.length, name: byId.get(folderId)?.name ?? '' }), { variant: 'success' });
    } catch (e: any) { err(e); }
  };
  const renameFile = async (f: MediaFile) => {
    const name = await showPrompt({ title: t('crm.media.renameFile'), defaultValue: f.name, confirmLabel: t('crm.media.save') });
    if (!name || !name.trim() || name.trim() === f.name) return;
    try {
      const saved = await renameMediaFile(f.id, name.trim());
      setFiles((fs) => fs.map((x) => (x.id === f.id ? saved : x)));
    } catch (e: any) { err(e); }
  };

  // перетаскивание: файлы и папки → папка (внутрь) или корень отеля/раздела в дереве
  const dragIds = (f: MediaFile) => (sel.has(f.id) ? [...sel] : [f.id]);
  const dropProps = (key: string, onDropTo: { folderId: string } | { scope: string }) => ({
    onDragOver: (e: React.DragEvent) => {
      const tps = e.dataTransfer.types;
      const isFiles = tps.includes(DRAG_FILES);
      const isFolder = tps.includes(DRAG_FOLDER);
      if (!isFolder && !(isFiles && 'folderId' in onDropTo)) return;
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(key);
    },
    onDragLeave: () => setDropTarget((d) => (d === key ? null : d)),
    onDrop: (e: React.DragEvent) => {
      const fileRaw = e.dataTransfer.getData(DRAG_FILES);
      const folderRaw = e.dataTransfer.getData(DRAG_FOLDER);
      if (!fileRaw && !folderRaw) return;
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);
      if (fileRaw && 'folderId' in onDropTo) void moveFilesTo(JSON.parse(fileRaw) as string[], onDropTo.folderId);
      if (folderRaw) {
        const f = byId.get(folderRaw);
        if (!f) return;
        if ('folderId' in onDropTo) {
          if (pathOf(onDropTo.folderId).some((p) => p.id === f.id)) return;
          void moveFolder(f, { parentId: onDropTo.folderId });
        } else if (onDropTo.scope !== 'all') {
          if (!f.parentId && scopeOf(f) === onDropTo.scope) return;
          void moveFolder(f, placeOf(onDropTo.scope));
        }
      }
    },
  });
  const folderDrag = (f: MediaFolder) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData(DRAG_FOLDER, f.id); e.dataTransfer.effectAllowed = 'move'; },
  });

  const openFile = open ? files.find((f) => f.id === open) ?? null : null;
  const subs = cur ? kids(cur) : tops(scope);
  const visibleUps = ups.filter((u) => u.folderId === cur);
  const pathList = pathOf(cur);
  const usedPct = overview.storage.quotaBytes ? Math.min(100, (overview.storage.usedBytes / overview.storage.quotaBytes) * 100) : 0;
  const top0 = pathList[0];

  const shareCurrent = () => {
    if (curFolder) shareFolder(curFolder);
    else if (scope === 'all') onShare({ folderIds: tops('all').map((f) => f.id), scope: 'multi' });
    else onShare({ folderIds: tops(scope).map((f) => f.id), scope: placeOf(scope).hotelId ? 'hotel' : 'agency', ...placeOf(scope) });
  };

  const renderTreeFolder = (f: MediaFolder, depth: number, s: string): React.ReactNode => {
    const onPath = pathList.some((p) => p.id === f.id);
    return (
      <div key={f.id}>
        <div
          className={cx('mf-ti', depth === 1 && 'kid', depth >= 2 && 'kid2', cur === f.id && 'on', dropTarget === f.id && 'drop')}
          onClick={() => go(s, f.id)}
          {...folderDrag(f)}
          {...dropProps(f.id, { folderId: f.id })}
        >
          <Ic d={MIC.folder} size={depth ? 12 : 13} />
          <span>{f.name}</span>
          {f.shared && <Ic d={MIC.link} size={11} />}
        </div>
        {onPath && depth < 2 && kids(f.id).map((k) => renderTreeFolder(k, depth + 1, s))}
      </div>
    );
  };

  const renderRoot = (s: string, icon: React.ReactNode, collectionId?: string) => (
    <div key={s}>
      <div className={cx('mf-ti', 'root', scope === s && !cur && 'on', dropTarget === `root:${s}` && 'drop')} onClick={() => go(s, null)} {...(s !== 'all' ? dropProps(`root:${s}`, { scope: s }) : {})}>
        <Ic d={icon} size={14} />
        <span>{scopeLabel(s)}</span>
        {collectionId ? (
          <button type="button" className="mf-dots" aria-label={t('crm.media.actions')} onClick={(e) => collectionMenu(collectionId, e)}><Ic d={MIC.dots} size={13} /></button>
        ) : null}
        <em>{tops(s).length}</em>
      </div>
      {scope === s && s !== 'all' && tops(s).map((f) => renderTreeFolder(f, 0, s))}
    </div>
  );

  const folderCard = (f: MediaFolder, s: string) => (
    <div key={f.id} className={cx('mf-fold', dropTarget === f.id && 'drop', menu?.key === f.id && 'menu')} onClick={() => go(s, f.id)} {...folderDrag(f)} {...dropProps(f.id, { folderId: f.id })}>
      <button type="button" className="mf-dots fx" aria-label={t('crm.media.actions')} onClick={(e) => folderMenu(f, e)}><Ic d={MIC.dots} size={14} /></button>
      <FolderGlyph n={deepCount(f.id)} shared={f.shared} />
      <div className="nm">{f.name}</div>
      <div className="dt">{fmtDate(f.createdAt, lang)}</div>
    </div>
  );

  const folderRows = (list: MediaFolder[], s: string) => (
    <div style={{ overflowX: 'auto' }}>
      <table className="md-tbl mf-tbl mf-ftbl">
        <tbody>
          {list.map((f) => (
            <tr key={f.id} className={cx(dropTarget === f.id && 'sel')} onClick={() => go(s, f.id)} {...folderDrag(f)} {...dropProps(f.id, { folderId: f.id })}>
              <td><span className="mf-fico"><Ic d={MIC.folder} size={15} /></span></td>
              <td><div className="fn">{f.name}</div>{kids(f.id).length > 0 && <div className="mf-sub">{t('crm.media.foldersN', { count: kids(f.id).length })}</div>}</td>
              <td className="num">{t('crm.media.filesN', { count: deepCount(f.id) })}</td>
              <td className="num">{fmtBytes(deepBytes(f.id), lang)}</td>
              <td className="num">{fmtDate(f.createdAt, lang)}</td>
              <td>{f.shared ? <span className="md-st ok"><Ic d={MIC.link} size={11} />{t('crm.media.sharedShort')}</span> : null}</td>
              <td><button type="button" className="md-ib" aria-label={t('crm.media.actions')} onClick={(e) => folderMenu(f, e)}><Ic d={MIC.dots} size={13} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const folderBlock = (list: MediaFolder[], s: string, withNew: boolean) => {
    if (!list.length && !withNew) return null;
    if (view === 'list' && !withNew) return folderRows(list, s);
    return (
      <div className="mf-folders">
        {list.map((f) => folderCard(f, s))}
        {withNew && (
          <div className="mf-fold new">
            <FolderGlyph n={0} />
            <input
              autoFocus
              className="md-in"
              value={newF ?? ''}
              placeholder={t('crm.media.folderName')}
              onChange={(e) => setNewF(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void createFolder(); if (e.key === 'Escape') setNewF(null); }}
              onBlur={() => void createFolder()}
            />
          </div>
        )}
      </div>
    );
  };

  const fileCard = (f: MediaFile) => (
    <div
      key={f.id}
      className={cx('mf-file', sel.has(f.id) && 'sel', open === f.id && 'open')}
      onClick={() => setOpen(f.id)}
      onDoubleClick={() => setLb(files.findIndex((x) => x.id === f.id))}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData(DRAG_FILES, JSON.stringify(dragIds(f))); e.dataTransfer.effectAllowed = 'move'; }}
    >
      <Thumb f={f} />
      <button type="button" className={cx('mf-ck', sel.has(f.id) && 'on')} aria-label={t('crm.media.select')} onClick={(e) => { e.stopPropagation(); toggle(f.id); }}>
        <Ic d={MIC.check} size={11} sw={2.2} />
      </button>
      <div className="nm" title={f.name}>{f.name}</div>
      <div className="mt"><span>{fmtBytes(f.sizeBytes, lang)}</span><span><Ic d={MIC.dl} size={10} />{f.downloads}</span></div>
    </div>
  );

  const allGroups: Array<{ s: string; icon: React.ReactNode; label: string }> = [
    ...collections.map((c) => ({ s: `c:${c.id}`, icon: MIC.layers, label: c.name })),
    ...hotelsWith.map((h) => ({ s: h.id, icon: MIC.hotel, label: h.name })),
    { s: 'none', icon: MIC.building, label: hasHotels || collections.length ? t('crm.media.noHotelGroup') : t('crm.media.library') },
  ];

  return (
    <div className="mf-split">
      <div className="md-card mf-tree">
        {(hasHotels || collections.length > 0) && renderRoot('all', MIC.grid)}
        {collections.length > 0 && <div className="mf-tree-h">{t('crm.media.collections')}</div>}
        {collections.map((c) => renderRoot(`c:${c.id}`, MIC.layers, c.id))}
        {hasHotels && <div className="mf-tree-h">{t('crm.media.hotels')}</div>}
        {hotelsWith.map((h) => renderRoot(h.id, MIC.hotel))}
        {(showEmptyHotels || !hotelsWith.length || hotelsEmpty.some((h) => h.id === scope)) && hotelsEmpty.map((h) => renderRoot(h.id, MIC.hotel))}
        {hotelsEmpty.length > 0 && hotelsWith.length > 0 && (
          <button type="button" className="mf-tree-more" onClick={() => setShowEmptyHotels((v) => !v)}>
            {showEmptyHotels ? t('crm.media.hideEmptyHotels') : t('crm.media.showEmptyHotels', { count: hotelsEmpty.length })}
          </button>
        )}
        {(hasHotels || collections.length > 0) && <div className="mf-tree-h" />}
        {renderRoot('none', MIC.building)}
        <button type="button" className="mf-tree-add" onClick={() => void addCollection()}><Ic d={MIC.plus} size={12} />{t('crm.media.newCollection')}</button>
        <div className="mf-quota">
          <div className="t">
            <span>{t('crm.media.storage')}</span>
            <span className="mono">
              {fmtBytes(overview.storage.usedBytes, lang)}
              {overview.storage.quotaBytes ? ` / ${fmtBytes(overview.storage.quotaBytes, lang)}` : ''}
            </span>
          </div>
          <div className="bar"><i style={{ width: `${usedPct}%` }} /></div>
        </div>
      </div>

      <div
        className={cx('md-card', 'mf-main', drag && 'drag')}
        onDragOver={(e) => { if (!e.dataTransfer.types.includes('Files')) return; e.preventDefault(); setDrag(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }}
        onDrop={(e) => {
          if (!e.dataTransfer.files?.length) return;
          e.preventDefault();
          setDrag(false);
          void readDropped(e.dataTransfer).then(importPicked);
        }}
      >
        <div className="mf-head">
          <div className="mf-crumbs">
            <span onClick={() => go(scope, null)}>{scopeLabel(scope)}</span>
            {pathList.map((p) => (
              <React.Fragment key={p.id}>
                <Ic d={MIC.chevR} size={11} />
                <span onClick={() => go(scope, p.id)}>{p.name}</span>
              </React.Fragment>
            ))}
          </div>
          <div className="mf-acts">
            {cur && (
              <div className="md-search mf-q">
                <Ic d={MIC.search} size={13} />
                <input placeholder={t('crm.media.findFile')} value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            )}
            <div className="md-seg">
              <button type="button" className={cx(view === 'grid' && 'on')} onClick={() => setView('grid')} title={t('crm.media.viewGrid')}><Ic d={MIC.grid} size={13} /></button>
              <button type="button" className={cx(view === 'list' && 'on')} onClick={() => setView('list')} title={t('crm.media.viewList')}><Ic d={MIC.list} size={13} /></button>
            </div>
            <button type="button" className="btn btn-sm" onClick={startNewFolder} title={!cur && scope === 'all' ? t('crm.media.folderInNone') : undefined}><Ic d={MIC.folderPlus} size={13} />{t('crm.media.folder')}</button>
            {cur && <button type="button" className="btn btn-sm" onClick={() => inp.current?.click()}><Ic d={MIC.upload} size={13} />{t('crm.media.upload')}</button>}
            <button type="button" className="btn btn-sm" onClick={() => dirInp.current?.click()} title={t('crm.media.uploadFolderHint')}><Ic d={MIC.folderUp} size={13} />{t('crm.media.uploadFolder')}</button>
            {(cur || tops(scope).length > 0) && (
              <button type="button" className="btn btn-sm btn-primary" onClick={shareCurrent}>
                <Ic d={MIC.link} size={13} />
                {cur ? t('crm.media.shareFolder') : scope === 'all' ? t('crm.media.shareAllHotels') : t('crm.media.shareAll')}
              </button>
            )}
            <input ref={inp} type="file" multiple hidden accept={ACCEPT} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            <input ref={dirInp} type="file" multiple hidden {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} onChange={(e) => { onPickDir(e.target.files); e.target.value = ''; }} />
          </div>
        </div>

        {ups.length > 0 && (
          <div className="mf-upbar">
            <Ic d={MIC.upload} size={13} />
            <span>{t('crm.media.uploadingN', { n: ups.filter((u) => !u.error).length })}</span>
            <span className="bar"><i style={{ width: `${Math.round((ups.filter((u) => !u.error).reduce((a, u) => a + u.progress, 0) / Math.max(1, ups.filter((u) => !u.error).length)) * 100)}%` }} /></span>
            {ups.some((u) => u.error) && (
              <button type="button" onClick={() => ups.filter((u) => u.error).forEach(retry)}>{t('crm.media.uploadErrors', { n: ups.filter((u) => u.error).length })}</button>
            )}
          </div>
        )}

        {curFolder && (
          <div className="mf-meta">
            <span><Ic d={top0?.hotelId ? MIC.hotel : top0?.collectionId ? MIC.layers : MIC.building} size={12} />{placeName(top0 || curFolder)}</span>
            <span>{t('crm.media.filesN', { count: deepCount(curFolder.id) })}</span>
            <span>{t('crm.media.createdAt', { date: fmtDate(curFolder.createdAt, lang) })}</span>
            {linksFor(curFolder.id).length > 0 ? (
              <span className="ok"><Ic d={MIC.link} size={12} />{t('crm.media.inLinks', { count: linksFor(curFolder.id).length })}</span>
            ) : <span>{t('crm.media.notPublished')}</span>}
            <span style={{ flex: 1 }} />
            <button type="button" onClick={() => void download({ folderIds: [curFolder.id] })}><Ic d={MIC.zip} size={12} />{t('crm.media.downloadFolder')}</button>
            <button type="button" onClick={() => void renameFolder(curFolder)}><Ic d={MIC.edit} size={12} />{t('crm.media.rename')}</button>
            <button type="button" onClick={() => void duplicateFolder(curFolder)}><Ic d={MIC.copy} size={12} />{t('crm.media.duplicate')}</button>
            <button type="button" onClick={() => setMoveT({ kind: 'folder', folder: curFolder })}><Ic d={MIC.move} size={12} />{t('crm.media.moveTo')}</button>
            <button type="button" onClick={() => void removeFolder(curFolder)}><Ic d={MIC.trash} size={12} />{t('crm.media.delete')}</button>
          </div>
        )}

        {scope === 'all' && !cur ? (
          <div className="mf-body">
            {allGroups.map((g) => (
              <div key={g.s} className={cx('mf-group', dropTarget === `grp:${g.s}` && 'drop')} {...dropProps(`grp:${g.s}`, { scope: g.s })}>
                <div className="mf-gh" onClick={() => go(g.s, null)}>
                  <Ic d={g.icon} size={13} />
                  {g.label}
                  <em>{t('crm.media.foldersN', { count: tops(g.s).length })}</em>
                  <Ic d={MIC.chevR} size={12} />
                </div>
                {tops(g.s).length ? folderBlock(tops(g.s), g.s, false) : <div className="mf-slug" style={{ padding: '8px 4px' }}>{t('crm.media.noFoldersShort')}</div>}
              </div>
            ))}
            {hotelsEmpty.length > 0 && (
              <div className="mf-slug" style={{ marginTop: 16 }}>
                {t('crm.media.emptyHotelsNote', { count: hotelsEmpty.length })}
              </div>
            )}
            <div className="mf-drop" onClick={() => dirInp.current?.click()}>
              <Ic d={MIC.folderUp} size={18} />
              <div><b>{t('crm.media.dropFolderTitle')}</b> {t('crm.media.dropFolderTextAll')}</div>
            </div>
          </div>
        ) : (
          <div className="mf-body">
            {folderBlock(subs, scope, newF !== null)}
            {!cur && subs.length === 0 && newF === null && (
              <div className="md-empty">
                <div className="t">{t('crm.media.emptyFoldersTitle')}</div>
                {t('crm.media.emptyFoldersText')}
                <div style={{ marginTop: 14 }}>
                  <button type="button" className="btn btn-sm btn-primary" onClick={startNewFolder}><Ic d={MIC.folderPlus} size={13} />{t('crm.media.createFolder')}</button>
                </div>
              </div>
            )}
            {cur && filesLoading && files.length === 0 && (
              <div className="mf-files">{Array.from({ length: 6 }, (_, i) => <div key={i} className="md-skel" style={{ aspectRatio: '4/3' }} />)}</div>
            )}
            {cur && (files.length > 0 || visibleUps.length > 0) && (view === 'grid' ? (
              <div className={cx('mf-files', sel.size > 0 && 'selecting')}>
                {files.map(fileCard)}
                {visibleUps.map((u) => (
                  <div key={u.key} className={cx('mf-file', 'up', u.error && 'err')} onClick={() => u.error && retry(u)} title={u.error || undefined}>
                    <div className="mf-th">
                      {u.local && <img src={u.local} alt="" style={{ opacity: 0.45 }} />}
                      {!u.error && <div className="prog"><i style={{ width: `${Math.round(u.progress * 100)}%` }} /></div>}
                    </div>
                    <div className="nm">{u.name}</div>
                    <div className="mt">
                      <span>{u.error ? t('crm.media.uploadFailed') : t('crm.media.uploading', { p: Math.round(u.progress * 100) })}</span>
                      {u.error && <span>{t('crm.media.retry')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="md-tbl mf-tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 30 }}>
                        <button type="button" className={cx('mf-ck', 'inl', sel.size > 0 && sel.size === files.length && 'on')} aria-label={t('crm.media.selectAll')} onClick={() => setSel(sel.size === files.length ? new Set() : new Set(files.map((f) => f.id)))}>
                          <Ic d={MIC.check} size={11} sw={2.2} />
                        </button>
                      </th>
                      <th>{t('crm.media.colFile')}</th>
                      <th>{t('crm.media.colSize')}</th>
                      <th>{t('crm.media.colFormat')}</th>
                      <th>{t('crm.media.colAdded')}</th>
                      <th className="r">{t('crm.media.colDownloads')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f) => (
                      <tr key={f.id} className={cx(sel.has(f.id) && 'sel')} onClick={() => setOpen(f.id)} draggable onDragStart={(e) => { e.dataTransfer.setData(DRAG_FILES, JSON.stringify(dragIds(f))); }}>
                        <td>
                          <button type="button" className={cx('mf-ck', 'inl', sel.has(f.id) && 'on')} aria-label={t('crm.media.select')} onClick={(e) => { e.stopPropagation(); toggle(f.id); }}>
                            <Ic d={MIC.check} size={11} sw={2.2} />
                          </button>
                        </td>
                        <td>
                          <div className="md-file">
                            <div className="mf-mini"><Thumb f={f} /></div>
                            <div style={{ minWidth: 0 }}><div className="fn">{f.name}</div><div className="fm">{dims(f)}{fmtDur(f.durationSec) ? ` · ${fmtDur(f.durationSec)}` : ''}</div></div>
                          </div>
                        </td>
                        <td className="num">{fmtBytes(f.sizeBytes, lang)}</td>
                        <td><span className="md-st">{f.ext.toUpperCase()}</span></td>
                        <td className="num">{fmtDate(f.createdAt, lang)}</td>
                        <td className="sum">{f.downloads}</td>
                      </tr>
                    ))}
                    {visibleUps.map((u) => (
                      <tr key={u.key} onClick={() => u.error && retry(u)}>
                        <td />
                        <td><div className="md-file"><div style={{ minWidth: 0 }}><div className="fn">{u.name}</div></div></div></td>
                        <td className="num">{fmtBytes(u.size, lang)}</td>
                        <td colSpan={3} className="num">{u.error ? `${t('crm.media.uploadFailed')} · ${t('crm.media.retry')}` : t('crm.media.uploading', { p: Math.round(u.progress * 100) })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {cur && !filesLoading && files.length === 0 && visibleUps.length === 0 && q && (
              <div className="md-empty"><div className="t">{t('crm.media.nothingFound')}</div></div>
            )}
            {cur ? (
              <div className="mf-drop" onClick={() => inp.current?.click()}>
                <Ic d={MIC.upload} size={18} />
                <div><b>{t('crm.media.dropTitle')}</b> {t('crm.media.dropText')}</div>
              </div>
            ) : (
              <div className="mf-drop" onClick={() => dirInp.current?.click()}>
                <Ic d={MIC.folderUp} size={18} />
                <div><b>{t('crm.media.dropFolderTitle')}</b> {t('crm.media.dropFolderText')}</div>
              </div>
            )}
          </div>
        )}

        {sel.size > 0 && (
          <div className="mf-selbar">
            <span><b>{sel.size}</b> {t('crm.media.selected')}</span>
            <button type="button" className="btn btn-sm" onClick={() => setSel(new Set())}><Ic d={MIC.x} size={12} />{t('crm.media.clear')}</button>
            <button type="button" className="btn btn-sm" onClick={() => setSel(new Set(files.map((f) => f.id)))}>{t('crm.media.selectAll')}</button>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-sm" onClick={() => setMoveT({ kind: 'files', ids: [...sel] })}><Ic d={MIC.move} size={12} />{t('crm.media.move')}</button>
            <button type="button" className="btn btn-sm" onClick={() => void download({ fileIds: [...sel] })}><Ic d={MIC.dl} size={12} />{t('crm.media.download')}</button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => void removeFiles([...sel])}><Ic d={MIC.trash} size={12} />{t('crm.media.delete')}</button>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => onShare({ folderIds: [], fileIds: [...sel], scope: top0?.hotelId ? 'hotel' : 'agency', hotelId: top0?.hotelId ?? null, collectionId: top0?.collectionId ?? null })}>
              <Ic d={MIC.link} size={12} />{t('crm.media.linkToSelected')}
            </button>
          </div>
        )}
      </div>

      {openFile && (
        <div className="md-card mf-detail">
          <div className="mf-dh"><b>{t('crm.media.file')}</b><button type="button" className="md-ib" onClick={() => setOpen(null)} aria-label={t('crm.media.close')}><Ic d={MIC.x} size={12} /></button></div>
          <div className={cx('mf-dprev', !!openFile.height && !!openFile.width && openFile.height > openFile.width && 'tall')}>
            {openFile.kind === 'video' ? (
              <video src={mediaUrl(openFile.viewUrl) || undefined} poster={mediaUrl(openFile.thumbUrl) || undefined} controls preload="none" />
            ) : (
              <div onClick={() => setLb(files.findIndex((x) => x.id === openFile.id))}><Thumb f={openFile} /></div>
            )}
          </div>
          <div className="md-body">
            <div className="mf-dn">{openFile.name}</div>
            <div className="md-kv"><span className="k">{t('crm.media.colSize')}</span><span className="v mono">{fmtBytes(openFile.sizeBytes, lang)}</span></div>
            <div className="md-kv"><span className="k">{t('crm.media.resolution')}</span><span className="v mono">{dims(openFile)}</span></div>
            {openFile.durationSec ? <div className="md-kv"><span className="k">{t('crm.media.duration')}</span><span className="v mono">{fmtDur(openFile.durationSec)}</span></div> : null}
            {(hasHotels || collections.length > 0) && <div className="md-kv"><span className="k">{t('crm.media.where')}</span><span className="v">{top0 ? placeName(top0) : '—'}</span></div>}
            <div className="md-kv"><span className="k">{t('crm.media.colAdded')}</span><span className="v mono">{fmtDate(openFile.createdAt, lang)}</span></div>
            <div className="md-kv"><span className="k">{t('crm.media.colDownloads')}</span><span className="v mono">{openFile.downloads}</span></div>
            <div className="md-kv"><span className="k">{t('crm.media.lastDownload')}</span><span className="v">{openFile.lastDownloadAt ? `${openFile.lastDownloadBy || t('crm.media.anonymous')} · ${fmtDate(openFile.lastDownloadAt, lang, true)}` : '—'}</span></div>
            <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-sm" onClick={() => void download({ fileIds: [openFile.id] })}><Ic d={MIC.dl} size={12} />{t('crm.media.download')}</button>
              <button type="button" className="btn btn-sm" onClick={() => onShare({ folderIds: [], fileIds: [openFile.id], scope: top0?.hotelId ? 'hotel' : 'agency', hotelId: top0?.hotelId ?? null, collectionId: top0?.collectionId ?? null })}><Ic d={MIC.link} size={12} />{t('crm.media.linkToFile')}</button>
              <button type="button" className="btn btn-sm" onClick={() => void renameFile(openFile)} title={t('crm.media.rename')}><Ic d={MIC.edit} size={12} /></button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => void removeFiles([openFile.id])} title={t('crm.media.delete')}><Ic d={MIC.trash} size={12} /></button>
            </div>
          </div>
        </div>
      )}

      {lb !== null && lb >= 0 && files[lb] && <Lightbox files={files} idx={lb} setIdx={setLb} />}

      {menu && (
        <div className="mf-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()} role="menu">
          {menu.items.map((it) => (
            <button key={it.label} type="button" role="menuitem" className={cx(it.danger && 'danger')} onClick={() => { setMenu(null); it.run(); }}>
              <Ic d={it.icon} size={13} />{it.label}
            </button>
          ))}
        </div>
      )}

      {moveT && (
        <MoveDialog
          target={moveT}
          overview={overview}
          kids={kids}
          tops={tops}
          pathOf={pathOf}
          cur={cur}
          scopeLabel={scopeLabel}
          onClose={() => setMoveT(null)}
          onFiles={(folderId) => moveT.kind === 'files' && void moveFilesTo(moveT.ids, folderId)}
          onFolder={(to) => moveT.kind === 'folder' && void moveFolder(moveT.folder, to)}
        />
      )}
    </div>
  );
};

/* ─── Перенос файлов / папки ─── */
const MoveDialog: React.FC<{
  target: MoveTarget;
  overview: MediaOverview;
  kids: (id: string | null) => MediaFolder[];
  tops: (s: string) => MediaFolder[];
  pathOf: (id: string | null) => MediaFolder[];
  cur: string | null;
  scopeLabel: (s: string) => string;
  onClose: () => void;
  onFiles: (folderId: string) => void;
  onFolder: (to: { parentId: string } | MediaPlace) => void;
}> = ({ target, overview, kids, tops, pathOf, cur, scopeLabel, onClose, onFiles, onFolder }) => {
  const { t } = useTranslation();
  const moving = target.kind === 'folder' ? target.folder : null;
  // папку нельзя положить в саму себя или в её подпапки
  const blocked = (id: string) => (moving ? pathOf(id).some((p) => p.id === moving.id) : id === cur);
  const roots: Array<{ s: string; icon: React.ReactNode }> = [
    ...(overview.collections || []).map((c) => ({ s: `c:${c.id}`, icon: MIC.layers })),
    ...overview.hotels.map((h) => ({ s: h.id, icon: MIC.hotel })),
    { s: 'none', icon: MIC.building },
  ];
  const curScope = moving && !moving.parentId ? (moving.hotelId ? moving.hotelId : moving.collectionId ? `c:${moving.collectionId}` : 'none') : null;
  const [q, setQ] = useState('');
  const match = (s: string) => !q || scopeLabel(s).toLowerCase().includes(q.toLowerCase());

  const Tree: React.FC<{ list: MediaFolder[]; depth: number }> = ({ list, depth }) => (
    <>
      {list.map((f) => (
        <div key={f.id}>
          <div
            className={cx('mf-ti', depth === 0 ? '' : depth === 1 ? 'kid' : 'kid2')}
            style={blocked(f.id) ? { opacity: 0.4, cursor: 'default' } : undefined}
            onClick={() => { if (blocked(f.id)) return; if (moving) onFolder({ parentId: f.id }); else onFiles(f.id); }}
          >
            <Ic d={MIC.folder} size={13} /><span>{f.name}</span>
          </div>
          {!blocked(f.id) && <Tree list={kids(f.id)} depth={depth + 1} />}
        </div>
      ))}
    </>
  );

  return (
    <div className="mf-ov" onClick={onClose}>
      <div className="mf-modal sm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="md-card-head">
          <div>
            <h3><Ic d={MIC.move} size={15} />{moving ? t('crm.media.moveFolderTitle', { name: moving.name }) : t('crm.media.moveTitle', { n: target.kind === 'files' ? target.ids.length : 0 })}</h3>
            <div className="sub">{moving ? t('crm.media.moveFolderHint') : t('crm.media.moveHint')}</div>
          </div>
          <button type="button" className="md-ib" onClick={onClose}><Ic d={MIC.x} size={12} /></button>
        </div>
        <div className="md-body" style={{ paddingBottom: 6 }}>
          <div className="md-search"><Ic d={MIC.search} size={13} /><input placeholder={t('crm.media.findPlace')} value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
        </div>
        <div className="md-body" style={{ maxHeight: 440, overflow: 'auto', paddingTop: 6 }}>
          {roots.filter((r) => match(r.s) || tops(r.s).length > 0).map((r) => (
            <div key={r.s}>
              <div
                className={cx('mf-ti', 'root', curScope === r.s && 'on')}
                style={moving ? undefined : { cursor: 'default' }}
                onClick={() => { if (moving && curScope !== r.s) onFolder(r.s === 'none' ? { hotelId: null, collectionId: null } : r.s.startsWith('c:') ? { collectionId: r.s.slice(2) } : { hotelId: r.s }); }}
                title={moving ? t('crm.media.moveToRoot') : undefined}
              >
                <Ic d={r.icon} size={14} /><span>{scopeLabel(r.s)}</span>
                {moving && curScope !== r.s && <em>{t('crm.media.toRoot')}</em>}
              </div>
              <Tree list={tops(r.s)} depth={0} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Lightbox: React.FC<{ files: MediaFile[]; idx: number; setIdx: (i: number | null) => void }> = ({ files, idx, setIdx }) => {
  const f = files[idx];
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIdx(null);
      if (e.key === 'ArrowRight') setIdx((idx + 1) % files.length);
      if (e.key === 'ArrowLeft') setIdx((idx - 1 + files.length) % files.length);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [idx, files.length, setIdx]);
  const src = mediaUrl(f.viewUrl) || undefined;
  return (
    <div className="mf-lb" onClick={() => setIdx(null)}>
      <div className="cap">{idx + 1} / {files.length} · {f.name}</div>
      <button type="button" className="md-ib x" onClick={() => setIdx(null)}><Ic d={MIC.x} size={14} /></button>
      {files.length > 1 && <button type="button" className="md-ib nav l" onClick={(e) => { e.stopPropagation(); setIdx((idx - 1 + files.length) % files.length); }}><Ic d={MIC.chevL} size={16} /></button>}
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        {f.kind === 'video' ? <video key={f.id} src={src} controls autoPlay /> : f.kind === 'pdf' ? <iframe key={f.id} src={src} title={f.name} /> : <img key={f.id} src={src} alt={f.name} />}
      </div>
      {files.length > 1 && <button type="button" className="md-ib nav r" onClick={(e) => { e.stopPropagation(); setIdx((idx + 1) % files.length); }}><Ic d={MIC.chevR} size={16} /></button>}
    </div>
  );
};
