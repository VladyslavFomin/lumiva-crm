// src/pages/media/MediaLinkModal.tsx — создание/правка ссылки (порт LinkModal из media-crm-files.jsx)
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createMediaLink, deleteMediaLink, updateMediaLink, type MediaLink, type MediaLinkInput, type MediaOverview } from '../../api/media';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { Ic, MIC, Sw, copyText, cx, fmtDate } from './mediaUi';
import type { ShareInit } from './MediaFilesTab';

type Exp = 'none' | '7' | '30' | '90' | 'date';

const slugify = (s: string) => {
  const tr: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya', ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
  return s.toLowerCase().split('').map((c) => tr[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
};

const Tg: React.FC<{ on: boolean; set: (v: boolean) => void; tt: string; d: string; children?: React.ReactNode }> = ({ on, set, tt, d, children }) => (
  <div className="mf-tg" onClick={() => set(!on)}>
    <Sw on={on} set={set} label={tt} />
    <div style={{ minWidth: 0, flex: 1 }}>
      <div className="t">{tt}</div>
      <div className="d">{d}</div>
      {children}
    </div>
  </div>
);

export const MediaLinkModal: React.FC<{
  overview: MediaOverview;
  init?: ShareInit;
  edit?: MediaLink;
  publicBase: string;
  onClose: () => void;
  onSaved: (l: MediaLink) => void;
  onDeleted?: (id: string) => void;
}> = ({ overview, init, edit, publicBase, onClose, onSaved, onDeleted }) => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'ru').slice(0, 2);
  const { showAlert, showConfirm } = useAlertModal();
  const hasHotels = overview.hotels.length > 0;
  const collections = overview.collections || [];
  const hotelName = (id: string | null) => (id ? overview.hotels.find((h) => h.id === id)?.name ?? '' : '');
  const targetName = (v: string) => (v.startsWith('c:') ? collections.find((c) => `c:${c.id}` === v)?.name ?? '' : hotelName(v));
  const firstFolder = overview.folders.find((f) => (edit?.folderIds ?? init?.folderIds ?? []).includes(f.id));
  const initColl = init?.collectionId ?? (edit && edit.scope === 'agency' ? firstFolder?.collectionId : null);

  const initScope = edit?.scope ?? init?.scope ?? (hasHotels ? 'hotel' : 'agency');
  const initHotel = edit ? edit.hotelIds[0] ?? '' : init?.hotelId ?? overview.hotels[0]?.id ?? '';
  // select: id отеля | 'multi' | 'agency'
  const [target, setTarget] = useState<string>(initColl ? `c:${initColl}` : initScope === 'multi' ? 'multi' : initScope === 'agency' || !hasHotels ? 'agency' : initHotel || 'multi');
  const defaultName = () => {
    if (target === 'multi') return t('crm.media.defaultNameAll');
    if (target === 'agency') return t('crm.media.defaultNameAgency');
    return `${targetName(target)} · ${t('crm.media.mediakit')}`;
  };
  const [name, setName] = useState(edit?.name ?? defaultName());
  const [nameTouched, setNameTouched] = useState(!!edit);
  const [folders, setFolders] = useState<Set<string>>(new Set(edit?.folderIds ?? init?.folderIds ?? []));
  const fileIds = edit?.fileIds ?? init?.fileIds ?? [];
  const [title, setTitle] = useState(edit?.title ?? '');
  const [description, setDescription] = useState(edit?.description ?? '');
  const [pageLang, setPageLang] = useState<string>(edit?.lang ?? '');
  const [gate, setGate] = useState(edit?.gate ?? true);
  const [zip, setZip] = useState(edit?.allowZip ?? true);
  const [passOn, setPassOn] = useState(edit?.hasPassword ?? false);
  const [password, setPassword] = useState('');
  const [exp, setExp] = useState<Exp>(edit?.expiresAt ? 'date' : 'none');
  const [expDate, setExpDate] = useState(edit?.expiresAt ? edit.expiresAt.slice(0, 10) : '');
  const [slug, setSlug] = useState(edit?.slug ?? '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<MediaLink | null>(null);
  const [copied, setCopied] = useState(false);

  const byId = useMemo(() => new Map(overview.folders.map((f) => [f.id, f])), [overview.folders]);
  const deepCount = (id: string): number =>
    (byId.get(id)?.filesCount ?? 0) + overview.folders.filter((f) => f.parentId === id).reduce((s, k) => s + deepCount(k.id), 0);

  // Пул: верхние папки выбранного отеля / всех отелей / без отеля + уже выбранные вложенные (из «Поделиться папкой»)
  const groups = useMemo(() => {
    const tops = overview.folders.filter((f) => !f.parentId);
    const pre = [...folders].map((id) => byId.get(id)).filter((f): f is NonNullable<typeof f> => !!f && !!f.parentId);
    if (target === 'multi') {
      const g = [
        ...collections.map((c) => ({ id: `c:${c.id}`, label: c.name, list: tops.filter((f) => f.collectionId === c.id) })),
        ...overview.hotels.map((h) => ({ id: h.id, label: h.name, list: tops.filter((f) => f.hotelId === h.id) })),
      ];
      g.push({ id: 'none', label: t('crm.media.noHotel'), list: tops.filter((f) => !f.hotelId && !f.collectionId) });
      if (pre.length) g.unshift({ id: 'pre', label: t('crm.media.pickedSubfolders'), list: pre });
      return g.filter((x) => x.list.length);
    }
    const inTarget = (f: { hotelId: string | null; collectionId: string | null }) =>
      target === 'agency' ? !f.hotelId && !f.collectionId : target.startsWith('c:') ? f.collectionId === target.slice(2) : f.hotelId === target;
    const list = [...pre.filter(inTarget), ...tops.filter(inTarget)];
    return [{ id: 'one', label: '', list }];
  }, [overview.folders, overview.hotels, collections, target, folders, byId, t]);

  const pickable = new Set(groups.flatMap((g) => g.list.map((f) => f.id)));
  const pickedCount = [...folders].filter((id) => pickable.has(id)).length;

  const changeTarget = (v: string) => {
    setTarget(v);
    setFolders(new Set());
    if (!nameTouched) {
      setName(v === 'multi' ? t('crm.media.defaultNameAll') : v === 'agency' ? t('crm.media.defaultNameAgency') : `${targetName(v)} · ${t('crm.media.mediakit')}`);
    }
  };
  const tf = (id: string) => setFolders((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const tg = (ids: string[]) => setFolders((s) => { const all = ids.every((id) => s.has(id)); const n = new Set(s); ids.forEach((id) => (all ? n.delete(id) : n.add(id))); return n; });

  const expiresAt = (): string | null => {
    if (exp === 'none') return null;
    if (exp === 'date') return expDate ? new Date(`${expDate}T23:59:59`).toISOString() : null;
    return new Date(Date.now() + Number(exp) * 86400000).toISOString();
  };

  const submit = async () => {
    const chosen = [...folders].filter((id) => pickable.has(id));
    if (!chosen.length && !fileIds.length) return;
    if (passOn && !edit?.hasPassword && password.length < 4) {
      showAlert(t('crm.media.passwordShort'), { variant: 'error' });
      return;
    }
    const scope = target === 'multi' ? 'multi' : target === 'agency' || target.startsWith('c:') ? 'agency' : 'hotel';
    const hotelIds = scope === 'hotel' ? [target] : scope === 'multi' ? [...new Set(chosen.map((id) => byId.get(id)?.hotelId).filter(Boolean) as string[])] : [];
    const body: MediaLinkInput = {
      name: name.trim() || defaultName(),
      scope,
      hotelIds,
      folderIds: chosen,
      fileIds,
      title: title.trim() || null,
      description: description.trim() || null,
      lang: pageLang || null,
      gate,
      allowZip: zip,
      expiresAt: expiresAt(),
      ...(passOn ? (password ? { password } : {}) : { password: null }),
      ...(slug && slug !== edit?.slug ? { slug } : {}),
    };
    setBusy(true);
    try {
      const saved = edit ? await updateMediaLink(edit.id, body) : await createMediaLink(body);
      onSaved(saved);
      if (edit) onClose();
      else setDone(saved);
    } catch (e: any) {
      showAlert(e?.message || String(e), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!edit) return;
    const ok = await showConfirm(t('crm.media.deleteLinkConfirm', { name: edit.name }), { danger: true, confirmLabel: t('crm.media.delete') });
    if (!ok) return;
    try {
      await deleteMediaLink(edit.id);
      onDeleted?.(edit.id);
      onClose();
    } catch (e: any) { showAlert(e?.message || String(e), { variant: 'error' }); }
  };

  const previewSlug = slug || (edit?.slug ?? `${slugify(name) || 'media'}-····`);

  return (
    <div className="mf-ov" onClick={onClose}>
      <div className="mf-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="md-card-head">
          <div>
            <h3><Ic d={MIC.link} size={15} />{done ? t('crm.media.linkReady') : edit ? t('crm.media.editLink') : t('crm.media.newLinkTitle')}</h3>
            <div className="sub">{done ? t('crm.media.linkReadyHint') : t('crm.media.newLinkHint')}</div>
          </div>
          <button type="button" className="md-ib" onClick={onClose} aria-label={t('crm.media.close')}><Ic d={MIC.x} size={12} /></button>
        </div>
        {done ? (
          <div className="md-body">
            <div className="mf-url">
              <span className="mono">{done.url.replace(/^https?:\/\//, '')}</span>
              <button type="button" className="btn btn-sm" onClick={() => void copyText(done.url).then(() => setCopied(true))}>
                <Ic d={copied ? MIC.check : MIC.copy} size={12} />{copied ? t('crm.media.copied') : t('crm.media.copy')}
              </button>
            </div>
            <div className="md-kv"><span className="k">{t('crm.media.contents')}</span><span className="v">{t('crm.media.contentsValue', { folders: done.folderIds.length, files: done.fileIds.length })}</span></div>
            <div className="md-kv"><span className="k">{t('crm.media.beforeDownload')}</span><span className="v">{done.gate ? t('crm.media.gateOnValue') : t('crm.media.gateOffValue')}</span></div>
            <div className="md-kv"><span className="k">{t('crm.media.password')}</span><span className="v">{done.hasPassword ? t('crm.media.yes') : t('crm.media.no')}</span></div>
            <div className="md-kv"><span className="k">{t('crm.media.expires')}</span><span className="v">{done.expiresAt ? fmtDate(done.expiresAt, lang) : t('crm.media.noExpiry')}</span></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <a className="btn btn-sm btn-primary" href={done.url} target="_blank" rel="noreferrer"><Ic d={MIC.ext} size={12} />{t('crm.media.openAsClient')}</a>
              <button type="button" className="btn btn-sm" onClick={onClose}>{t('crm.media.done')}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="md-body">
              <div className="md-fields2">
                <div className="md-f">
                  <label>{t('crm.media.linkNameLabel')}</label>
                  <input className="md-in" value={name} onChange={(e) => { setName(e.target.value); setNameTouched(true); }} />
                </div>
                {(hasHotels || collections.length > 0) && (
                  <div className="md-f">
                    <label>{t('crm.media.whatToShare')}</label>
                    <select className="md-sel" value={target} onChange={(e) => changeTarget(e.target.value)}>
                      {collections.length > 0 && (
                        <optgroup label={t('crm.media.collections')}>
                          {collections.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}
                        </optgroup>
                      )}
                      {overview.hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                      <option value="multi">{t('crm.media.targetAll')}</option>
                      <option value="agency">{t('crm.media.targetAgency')}</option>
                    </select>
                  </div>
                )}
              </div>

              {fileIds.length > 0 && (
                <div className="md-note plain" style={{ marginBottom: 12 }}>
                  <Ic d={MIC.check} size={14} />
                  <span>{t('crm.media.pickedFilesNote', { count: fileIds.length })}</span>
                </div>
              )}

              <div className="md-f">
                <label>{t('crm.media.clientSees', { n: pickedCount, total: pickable.size })}</label>
                <div className="mf-pick">
                  {groups.map((g) => (
                    <React.Fragment key={g.id}>
                      {g.label && (
                        <div className="mf-pick-h">
                          <Ic d={g.id === 'none' ? MIC.building : g.id === 'pre' ? MIC.folder : g.id.startsWith('c:') ? MIC.layers : MIC.hotel} size={12} />{g.label}
                          <button type="button" onClick={() => tg(g.list.map((f) => f.id))}>
                            {g.list.every((f) => folders.has(f.id)) ? t('crm.media.unpickAll') : t('crm.media.pickAll')}
                          </button>
                        </div>
                      )}
                      {g.list.map((f) => (
                        <div key={f.id} className={cx('mf-pk', folders.has(f.id) && 'on')} onClick={() => tf(f.id)}>
                          <span className="cb">{folders.has(f.id) && <Ic d={MIC.check} size={10} sw={2.4} />}</span>
                          <Ic d={MIC.folder} size={13} />
                          <span className="nm">{f.name}</span>
                          <em>{deepCount(f.id)}</em>
                        </div>
                      ))}
                    </React.Fragment>
                  ))}
                  {pickable.size === 0 && <div className="mf-slug">{t('crm.media.noFoldersForTarget')}</div>}
                </div>
              </div>

              <div className="md-fields2">
                <div className="md-f">
                  <label>{t('crm.media.pageTitle')}</label>
                  <input className="md-in" value={title} placeholder={target !== 'multi' && target !== 'agency' ? targetName(target) : t('crm.media.pageTitlePh')} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="md-f">
                  <label>{t('crm.media.address')}</label>
                  <div className="mf-slugin">
                    <span>{publicBase.replace(/^https?:\/\//, '')}</span>
                    <input value={slug} placeholder={previewSlug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
                  </div>
                </div>
              </div>
              <div className="md-f">
                <label>{t('crm.media.pageLang')}</label>
                <select className="md-sel" value={pageLang} onChange={(e) => setPageLang(e.target.value)}>
                  <option value="">{t('crm.media.langAuto')}</option>
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                  <option value="tr">Türkçe</option>
                </select>
                <div className="hint">{t('crm.media.langHint')}</div>
              </div>
              <div className="md-f">
                <label>{t('crm.media.pageDescription')}</label>
                <textarea className="md-in" rows={2} value={description} placeholder={t('crm.media.pageDescriptionPh')} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div className="mf-tgs">
                <Tg on={gate} set={setGate} tt={t('crm.media.tgGate')} d={t('crm.media.tgGateD')} />
                <Tg on={zip} set={setZip} tt={t('crm.media.tgZip')} d={t('crm.media.tgZipD')} />
                <Tg on={passOn} set={setPassOn} tt={t('crm.media.tgPass')} d={edit?.hasPassword ? t('crm.media.tgPassSet') : t('crm.media.tgPassD')}>
                  {passOn && (
                    <input
                      className="md-in"
                      type="text"
                      autoComplete="new-password"
                      placeholder={edit?.hasPassword ? t('crm.media.passwordKeep') : t('crm.media.passwordPh')}
                      value={password}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  )}
                </Tg>
              </div>

              <div className="md-f" style={{ marginTop: 12 }}>
                <label>{t('crm.media.expires')}</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div className="md-seg">
                    {([['none', t('crm.media.noExpiry')], ['7', t('crm.media.days', { count: 7 })], ['30', t('crm.media.days', { count: 30 })], ['90', t('crm.media.days', { count: 90 })], ['date', t('crm.media.untilDate')]] as Array<[Exp, string]>).map(([k, l]) => (
                      <button type="button" key={k} className={cx(exp === k && 'on')} onClick={() => setExp(k)}>{l}</button>
                    ))}
                  </div>
                  {exp === 'date' && <input type="date" className="md-in" style={{ width: 170 }} value={expDate} onChange={(e) => setExpDate(e.target.value)} />}
                </div>
              </div>
            </div>
            <div className="md-foot">
              <span className="mono">{publicBase.replace(/^https?:\/\//, '')}{previewSlug}</span>
              <span style={{ display: 'flex', gap: 8 }}>
                {edit && <button type="button" className="btn btn-sm btn-danger" onClick={() => void remove()}><Ic d={MIC.trash} size={12} />{t('crm.media.delete')}</button>}
                <button type="button" className="btn btn-sm btn-primary" disabled={busy || (!pickedCount && !fileIds.length) || (exp === 'date' && !expDate)} onClick={() => void submit()}>
                  <Ic d={edit ? MIC.check : MIC.link} size={12} />{edit ? t('crm.media.save') : t('crm.media.createLink')}
                </button>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
