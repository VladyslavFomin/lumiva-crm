/**
 * «ИИ-офис: знания и медиа» для ИИ-консультантов (сайт и мессенджеры): из «Мозга» каких отделов
 * консультант берёт ответы и на что из «Медиа» может давать клиенту ссылки (файл, папка, отель целиком).
 * Работает только при подключённом ИИ-офисе (тариф + модуль); сам поиск и отправка — бэкенд
 * ConsultantOfficeService.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  fetchConsultantOffice,
  updateConsultantOffice,
  type ConsultantOfficeConfig,
  type ConsultantOfficeSettings,
} from '../../api/aiEmployees';

type Folder = NonNullable<ConsultantOfficeSettings['status']['media']>['folders'][number];

export function AiOfficeLinkPanel({ agentId }: { agentId: string }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.aiEmployees.officeLink.${key}`, o) as string;
  const [data, setData] = useState<ConsultantOfficeSettings | null>(null);
  const [cfg, setCfg] = useState<ConsultantOfficeConfig | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const apply = (d: ConsultantOfficeSettings) => {
    setData(d);
    setCfg(d.config);
    setSaved(JSON.stringify(d.config));
  };

  useEffect(() => {
    fetchConsultantOffice(agentId)
      .then(apply)
      .catch((e) => setMsg({ ok: false, text: e?.message || k('loadError') }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const media = data?.status.media || null;
  const children = useMemo(() => {
    const m = new Map<string | null, Folder[]>();
    for (const f of media?.folders || []) m.set(f.parentId, [...(m.get(f.parentId) || []), f]);
    return m;
  }, [media]);
  /** Корневые папки по местам: отели, свои разделы, «Без отеля». */
  const groups = useMemo(() => {
    const roots = children.get(null) || [];
    const out: Array<{ key: string; kind: 'hotel' | 'collection' | null; id: string; name: string; folders: Folder[] }> = [];
    for (const h of media?.hotels || []) {
      const f = roots.filter((r) => r.hotelId === h.id);
      if (f.length) out.push({ key: `h:${h.id}`, kind: 'hotel', id: h.id, name: h.name, folders: f });
    }
    for (const c of media?.collections || []) {
      const f = roots.filter((r) => !r.hotelId && r.collectionId === c.id);
      if (f.length) out.push({ key: `c:${c.id}`, kind: 'collection', id: c.id, name: c.name, folders: f });
    }
    const loose = roots.filter((r) => !r.hotelId && !r.collectionId);
    if (loose.length) out.push({ key: 'none', kind: null, id: '', name: k('noPlace'), folders: loose });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, media]);

  if (!data || !cfg) return <div className="e2-panel" style={{ padding: 18 }}>{msg?.text || '…'}</div>;

  const st = data.status;
  const dirty = JSON.stringify(cfg) !== saved;
  const picked = new Set(cfg.media.folderIds);
  const parentOf = new Map((media?.folders || []).map((f) => [f.id, f.parentId]));
  const folderById = new Map((media?.folders || []).map((f) => [f.id, f]));
  /** Отель/раздел отмечен целиком — в него входят все папки, в том числе будущие. */
  const placePicked = (f: Folder | undefined) =>
    !!f && (f.hotelId ? cfg.media.hotelIds.includes(f.hotelId) : !!f.collectionId && cfg.media.collectionIds.includes(f.collectionId));
  /** Папка уже входит в выбор через родителя или через отель — её галочка включена и заблокирована. */
  const viaParent = (id: string) => {
    if (placePicked(folderById.get(id))) return true;
    for (let p = parentOf.get(id) ?? null, i = 0; p && i < 20; p = parentOf.get(p) ?? null, i++) if (picked.has(p)) return true;
    return false;
  };
  const togglePlace = (kind: 'hotel' | 'collection', id: string) => {
    const key = kind === 'hotel' ? 'hotelIds' : 'collectionIds';
    const list = cfg.media[key];
    const on = !list.includes(id);
    // отель целиком — отдельные папки внутри него хранить незачем
    const inPlace = (fid: string) => {
      const f = folderById.get(fid);
      return !!f && (kind === 'hotel' ? f.hotelId === id : !f.hotelId && f.collectionId === id);
    };
    setCfg({
      ...cfg,
      media: {
        ...cfg.media,
        [key]: on ? [...list, id] : list.filter((x) => x !== id),
        folderIds: on ? cfg.media.folderIds.filter((fid) => !inPlace(fid)) : cfg.media.folderIds,
      },
    });
  };
  const filesIn = (f: Folder): number => f.files + (children.get(f.id) || []).reduce((s, c) => s + filesIn(c), 0);

  const toggleDept = (id: string) =>
    setCfg({
      ...cfg,
      brain: {
        ...cfg.brain,
        departmentIds: cfg.brain.departmentIds.includes(id) ? cfg.brain.departmentIds.filter((x) => x !== id) : [...cfg.brain.departmentIds, id],
      },
    });
  const toggleFolder = (id: string) => {
    const next = picked.has(id) ? cfg.media.folderIds.filter((x) => x !== id) : [...cfg.media.folderIds, id];
    // выбрали папку — вложенные отдельно хранить незачем
    const inside = (fid: string) => {
      for (let p = parentOf.get(fid) ?? null, i = 0; p && i < 20; p = parentOf.get(p) ?? null, i++) if (p === id) return true;
      return false;
    };
    setCfg({ ...cfg, media: { ...cfg.media, folderIds: picked.has(id) ? next : next.filter((x) => x === id || !inside(x)) } });
  };

  const save = async () => {
    if (cfg.media.enabled && !cfg.media.folderIds.length && !cfg.media.hotelIds.length && !cfg.media.collectionIds.length) {
      setMsg({ ok: false, text: k('pickFolder') });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      apply(await updateConsultantOffice(agentId, cfg));
      setMsg({ ok: true, text: k('saved') });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error)?.message || k('saveError') });
    } finally {
      setBusy(false);
    }
  };

  const renderFolder = (f: Folder, depth: number): React.ReactNode => {
    const sub = children.get(f.id) || [];
    const inherited = viaParent(f.id);
    const isOpen = open[f.id];
    return (
      <div key={f.id}>
        <div className="ai-olink-row" style={{ paddingLeft: depth * 18 }}>
          {sub.length ? (
            <button type="button" className="tw" onClick={() => setOpen((o) => ({ ...o, [f.id]: !o[f.id] }))} aria-expanded={!!isOpen}>
              {isOpen ? '−' : '+'}
            </button>
          ) : (
            <span className="tw" />
          )}
          <label>
            <input type="checkbox" checked={inherited || picked.has(f.id)} disabled={inherited} onChange={() => toggleFolder(f.id)} />
            <span>{f.name}</span>
            <span className="n">{k('files', { count: filesIn(f) })}</span>
          </label>
        </div>
        {isOpen ? sub.map((c) => renderFolder(c, depth + 1)) : null}
      </div>
    );
  };

  return (
    <div className="e2-panel">
      <div className="e2-panel-hd">
        <div className="h">{k('title')}</div>
      </div>
      <div className="ai-analyst-form">
        <p className="e2-hint" style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-3)' }}>{k('hint')}</p>

        {!st.officeAvailable ? (
          <div className="ai-chatop-mode">
            <b>{k('noOffice.t')}</b>
            <span>{k('noOffice.d')}</span>
          </div>
        ) : (
          <>
            <div>
              <div className="lbl">{k('brainTitle')}</div>
              <p className="e2-hint" style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--fg-3)' }}>{k('brainHint')}</p>
              {st.departments.length ? (
                <div style={{ display: 'grid', gap: 4 }}>
                  {st.departments.map((d) => (
                    <label key={d.id} className="ai-analyst-row">
                      <input type="checkbox" checked={cfg.brain.departmentIds.includes(d.id)} onChange={() => toggleDept(d.id)} />
                      <span className="ai-olink-dot" style={{ background: d.color }} />
                      {d.name}
                      <span style={{ color: 'var(--fg-3)', fontSize: 12 }}> · {k('files', { count: d.files })}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="e2-hint" style={{ margin: 0, fontSize: 12.5 }}>
                  {k('noDepartments')} <Link to="/ai-office">{k('openOffice')}</Link>
                </p>
              )}
              <label className="ai-analyst-row" style={{ marginTop: 6 }}>
                <input
                  type="checkbox"
                  checked={cfg.brain.includeShared}
                  onChange={(e) => setCfg({ ...cfg, brain: { ...cfg.brain, includeShared: e.target.checked } })}
                />
                {k('shared', { count: st.sharedFiles })}
              </label>
              <p className="e2-hint" style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>
                {k('brainNote')} <Link to="/ai-office/brain">{k('openBrain')}</Link>
              </p>
            </div>

            <div>
              <div className="lbl">{k('mediaTitle')}</div>
              {!st.mediaAvailable || !media ? (
                <p className="e2-hint" style={{ margin: 0, fontSize: 12.5 }}>{k('noMedia')}</p>
              ) : (
                <>
                  <label className="ai-analyst-row">
                    <input
                      type="checkbox"
                      checked={cfg.media.enabled}
                      onChange={(e) => setCfg({ ...cfg, media: { ...cfg.media, enabled: e.target.checked } })}
                    />
                    {k('mediaEnable')}
                  </label>
                  {cfg.media.enabled ? (
                    groups.length ? (
                      <div className="ai-olink-tree">
                        {groups.map((g) => (
                          <div key={g.key} className="grp">
                            {g.kind ? (
                              <label className="gh pick">
                                <input
                                  type="checkbox"
                                  checked={(g.kind === 'hotel' ? cfg.media.hotelIds : cfg.media.collectionIds).includes(g.id)}
                                  onChange={() => togglePlace(g.kind as 'hotel' | 'collection', g.id)}
                                />
                                <span>{g.name}</span>
                                <span className="all">{k(g.kind === 'hotel' ? 'wholeHotel' : 'wholeSection')}</span>
                              </label>
                            ) : (
                              <div className="gh">{g.name}</div>
                            )}
                            {g.folders.map((f) => renderFolder(f, 0))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="e2-hint" style={{ margin: 0, fontSize: 12.5 }}>
                        {k('mediaEmpty')} <Link to="/media">{k('openMedia')}</Link>
                      </p>
                    )
                  ) : null}
                  <p className="e2-hint" style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>{k('mediaNote')}</p>
                </>
              )}
            </div>
          </>
        )}

        {msg ? <div className={msg.ok ? 'ai-analyst-ok' : 'ai-analyst-err'}>{msg.text}</div> : null}
        {st.officeAvailable ? (
          <div className="ai-analyst-actions">
            <button className="e2b sm" disabled={!dirty || busy} onClick={() => void save()}>
              {busy ? k('saving') : k('save')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Под ответом «Проверить ответ»: какие документы «Мозга» прочитаны и что ИИ сделал в медиатеке. */
export function AiOfficeTrace({ brainFiles, mediaTrace }: { brainFiles?: string[]; mediaTrace?: string[] }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.aiEmployees.officeLink.trace.${key}`, o) as string;
  if (!brainFiles?.length && !mediaTrace?.length) return null;
  const label = (line: string) => {
    const name = /"name"\s*:\s*"(\w+)"/.exec(line)?.[1] || '';
    const ok = /=>\s*\{"ok":true/.test(line);
    const url = /"url"\s*:\s*"([^"]+)"/.exec(line)?.[1];
    const key = name === 'send_file' ? 'file_link' : ['media_list', 'media_find', 'file_link', 'folder_link'].includes(name) ? name : 'other';
    return `${ok ? '✓' : '✕'} ${k(key)}${url ? ` · ${url}` : ''}`;
  };
  return (
    <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 6, display: 'grid', gap: 2 }}>
      {brainFiles?.length ? <span>{k('brain', { files: brainFiles.join(', ') })}</span> : null}
      {(mediaTrace || []).map((l, i) => (
        <span key={i}>{label(l)}</span>
      ))}
    </div>
  );
}
