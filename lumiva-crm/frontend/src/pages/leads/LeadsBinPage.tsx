// src/pages/leads/LeadsBinPage.tsx
// Корзина и архив лидов (редизайн 2026-10-01, макет claude.ai/design leads-trash.html).
// Одна страница с вкладками; /leads/trash и /leads/archive открывают нужную вкладку.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { fetchLeads, updateLead, deleteLead, type Lead, type LeadStatus } from '../../api/leads';
import './leadsBin.css';

type Tab = 'trash' | 'archive';
type SortKey = 'name' | 'created' | 'at';

/** Совпадает с LEADS_TRASH_TTL_DAYS в backend/src/leads/leads-trash-purge.service.ts. Архив не чистится. */
const TRASH_TTL_DAYS = 30;
const PER_PAGE = 10;
const DAY_MS = 864e5;

const STATUS_KEYS: Record<LeadStatus, { key: string; cls: string }> = {
  'Новый клиент': { key: 'new', cls: '' },
  'Ожидает ответа': { key: 'waiting', cls: 'wait' },
  'В работе': { key: 'inProgress', cls: 'work' },
  'Закрыт (успех)': { key: 'won', cls: 'won' },
  'Закрыт (проигран)': { key: 'lost', cls: 'lost' },
};

const Ic: React.FC<{ d: React.ReactNode; size?: number; sw?: number }> = ({ d, size = 16, sw = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);
const I = {
  srch: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></>,
  rest: <><path d="M4 12a8 8 0 108-8 8 8 0 00-5.7 2.3L4 8.6" /><path d="M4 4v4.6h4.6" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></>,
  box: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8" /><path d="M10 13h4" /></>,
  chk: <path d="M5 12l4 4 10-10" />,
  dash: <path d="M6 12h12" />,
  sort: <path d="M8 10l4-4 4 4M8 14l4 4 4-4" />,
  up: <path d="M8 14l4-4 4 4" />,
  dn: <path d="M8 10l4 4 4-4" />,
  l: <path d="M15 6l-6 6 6 6" />,
  r: <path d="M9 6l6 6-6 6" />,
};

const px = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

const parseDate = (v: unknown): Date | null => {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

interface Row {
  lead: Lead;
  id: string;
  name: string;
  contact: string;
  created: Date;
  at: Date | null;
  by: string | null;
}

const Cb: React.FC<{ v: boolean | 'mix'; onClick: () => void; label: string }> = ({ v, onClick, label }) => (
  <button type="button" className={px('lb-cb', v === true && 'on', v === 'mix' && 'mix')} onClick={onClick} aria-label={label} aria-pressed={v === true}>
    {v === true && <Ic d={I.chk} size={11} sw={2.4} />}
    {v === 'mix' && <Ic d={I.dash} size={11} sw={2.4} />}
  </button>
);

export const LeadsBinPage: React.FC<{ tab: Tab }> = ({ tab }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language?.startsWith('en') ? 'en-US' : i18n.language?.startsWith('tr') ? 'tr-TR' : 'ru-RU';
  const isT = tab === 'trash';

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [st, setSt] = useState<string>('all');
  const [sort, setSort] = useState<{ k: SortKey; d: 1 | -1 }>({ k: 'at', d: -1 });
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [cf, setCf] = useState<{ ids: string[]; all?: boolean; name?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void; err?: boolean } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchLeads()
      .then((items) => alive && setLeads(items))
      .catch((e) => alive && setError(e?.message || t('crm.leads.bin.errors.loadFailed')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [t]);

  useEffect(() => {
    setSel(new Set());
    setPage(0);
    setQ('');
    setSt('all');
  }, [tab]);
  useEffect(() => setPage(0), [q, st]);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const toRow = (lead: Lead, trash: boolean): Row => {
    const m = (lead.meta ?? {}) as Record<string, unknown>;
    return {
      lead,
      id: lead.id,
      name: lead.name || lead.email || lead.phone || '—',
      contact: lead.email || lead.phone || '',
      created: new Date(lead.createdAt),
      at: parseDate(trash ? m.deletedAt : m.archivedAt),
      by: (typeof (trash ? m.deletedBy : m.archivedBy) === 'string' ? (trash ? m.deletedBy : m.archivedBy) : null) as string | null,
    };
  };

  const trashRows = useMemo(() => leads.filter((l) => l.meta?.deleted).map((l) => toRow(l, true)), [leads]);
  const archiveRows = useMemo(
    () => leads.filter((l) => l.meta?.archived && !l.meta?.deleted).map((l) => toRow(l, false)),
    [leads],
  );
  const rows = isT ? trashRows : archiveRows;

  const daysLeft = (r: Row): number | null =>
    r.at ? Math.max(0, TRASH_TTL_DAYS - Math.floor((Date.now() - r.at.getTime()) / DAY_MS)) : null;
  const soon = trashRows.filter((r) => {
    const d = daysLeft(r);
    return d !== null && d <= 3;
  }).length;

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const f = rows.filter(
      (r) =>
        (st === 'all' || r.lead.status === st) &&
        (!needle || `${r.name} ${r.lead.email ?? ''} ${r.lead.phone ?? ''}`.toLowerCase().includes(needle)),
    );
    const { k, d } = sort;
    return f.sort((a, b) => {
      if (k === 'name') return a.name.localeCompare(b.name, locale) * d;
      const av = k === 'created' ? a.created.getTime() : a.at?.getTime() ?? 0;
      const bv = k === 'created' ? b.created.getTime() : b.at?.getTime() ?? 0;
      return (av - bv) * d;
    });
  }, [rows, q, st, sort, locale]);

  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const safePage = Math.min(page, pages - 1);
  const view = list.slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE);

  const fmtD = (d: Date) => d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtT = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const statusLabel = (s: LeadStatus) => (STATUS_KEYS[s] ? t(`crm.leads.statuses.${STATUS_KEYS[s].key}`) : s);

  const flash = (msg: string, undo?: () => void, err?: boolean) => {
    window.clearTimeout(toastTimer.current);
    setToast({ msg, undo, err });
    toastTimer.current = window.setTimeout(() => setToast(null), err ? 7000 : 5000);
  };

  /**
   * Меняет флаги meta у выбранных лидов. PATCH заменяет meta целиком, поэтому всегда
   * отправляем полный объект. Возвращает функцию отката (вернуть прежний meta).
   */
  const patchMeta = async (ids: string[], change: (meta: Record<string, unknown>) => Record<string, unknown>) => {
    const prev = new Map(leads.filter((l) => ids.includes(l.id)).map((l) => [l.id, (l.meta ?? {}) as Record<string, unknown>]));
    const next = new Map([...prev].map(([id, m]) => [id, change({ ...m })]));
    setLeads((ls) => ls.map((l) => (next.has(l.id) ? { ...l, meta: next.get(l.id) } : l)));
    setSel(new Set());
    const results = await Promise.all(
      ids.map((id) =>
        updateLead(id, { meta: next.get(id) })
          .then((saved) => saved)
          .catch(() => null),
      ),
    );
    // Подхватываем meta с сервера (там проставляются deletedBy/archivedBy).
    setLeads((ls) =>
      ls.map((l) => {
        const saved = results.find((s) => s?.id === l.id);
        return saved ? { ...l, meta: saved.meta } : l;
      }),
    );
    const failed = results.filter((r) => !r).length;
    if (failed) flash(t('crm.leads.bin.toast.failed', { count: failed }), undefined, true);
    return async () => {
      setLeads((ls) => ls.map((l) => (prev.has(l.id) ? { ...l, meta: prev.get(l.id) } : l)));
      await Promise.all(ids.map((id) => updateLead(id, { meta: prev.get(id) }).catch(() => null)));
    };
  };

  const restore = async (ids: string[]) => {
    const undo = await patchMeta(ids, (m) =>
      isT ? { ...m, deleted: false, deletedAt: null, deletedBy: null } : { ...m, archived: false, archivedAt: null, archivedBy: null },
    );
    flash(t(isT ? 'crm.leads.bin.toast.restored' : 'crm.leads.bin.toast.returned', { count: ids.length }), undo);
  };
  const toArchive = async (ids: string[]) => {
    const undo = await patchMeta(ids, (m) => ({ ...m, deleted: false, deletedAt: null, deletedBy: null, archived: true, archivedAt: null, archivedBy: null }));
    flash(t('crm.leads.bin.toast.archived', { count: ids.length }), undo);
  };
  const toTrash = async (ids: string[]) => {
    const undo = await patchMeta(ids, (m) => ({ ...m, deleted: true, deletedAt: null, deletedBy: null }));
    flash(t('crm.leads.bin.toast.trashed', { count: ids.length }), undo);
  };
  const purge = async (ids: string[]) => {
    setBusy(true);
    const results = await Promise.all(
      ids.map((id) =>
        deleteLead(id)
          .then(() => ({ id, ok: true as const }))
          .catch((e) => ({ id, ok: false as const, msg: String(e?.message || '') })),
      ),
    );
    setBusy(false);
    setCf(null);
    const okIds = new Set(results.filter((r) => r.ok).map((r) => r.id));
    setLeads((ls) => ls.filter((l) => !okIds.has(l.id)));
    setSel(new Set());
    const fail = results.filter((r) => !r.ok);
    if (fail.length) {
      // Чаще всего — к лиду привязаны продажи или проекты (бэкенд не даёт удалить).
      const firstMsg = 'msg' in fail[0] ? fail[0].msg : '';
      flash(t('crm.leads.bin.toast.purgeFailed', { count: fail.length }) + (firstMsg ? ` ${firstMsg}` : ''), undefined, true);
    } else {
      flash(t('crm.leads.bin.toast.purged', { count: okIds.size }));
    }
  };

  const allOn = view.length > 0 && view.every((r) => sel.has(r.id));
  const someOn = view.some((r) => sel.has(r.id));
  const tog = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const togAll = () =>
    setSel((s) => {
      const n = new Set(s);
      view.forEach((r) => (allOn ? n.delete(r.id) : n.add(r.id)));
      return n;
    });
  const ids = [...sel].filter((id) => rows.some((r) => r.id === id));

  const SortH: React.FC<{ k: SortKey; children: React.ReactNode }> = ({ k, children }) => (
    <button type="button" className={px(sort.k === k && 'on')} onClick={() => setSort((s) => ({ k, d: s.k === k ? (-s.d as 1 | -1) : -1 }))}>
      {children}
      <Ic d={sort.k === k ? (sort.d > 0 ? I.up : I.dn) : I.sort} size={11} />
    </button>
  );

  const presentStatuses = (Object.keys(STATUS_KEYS) as LeadStatus[]).filter((s) => rows.some((r) => r.lead.status === s));

  return (
    <MainLayout>
      <PageHelpButton topic={isT ? 'leadsTrash' : 'leadsArchive'} />
      <div className="lb">
        <div className="lb-head">
          <div>
            <div className="kick">{t('crm.leads.bin.kicker')}</div>
            <h1>{t(isT ? 'crm.leads.trash.title' : 'crm.leads.archive.title')}</h1>
            <p>{isT ? t('crm.leads.bin.trashLead', { count: TRASH_TTL_DAYS }) : t('crm.leads.bin.archiveLead')}</p>
          </div>
          <div className="lb-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={isT} className={px(isT && 'on')} onClick={() => navigate('/leads/trash')}>
              <Ic d={I.trash} size={14} />
              {t('crm.leads.bin.tabTrash')}
              <em>{trashRows.length}</em>
            </button>
            <button type="button" role="tab" aria-selected={!isT} className={px(!isT && 'on')} onClick={() => navigate('/leads/archive')}>
              <Ic d={I.box} size={14} />
              {t('crm.leads.bin.tabArchive')}
              <em>{archiveRows.length}</em>
            </button>
          </div>
        </div>

        {error && <div className="lb-err">{error}</div>}

        {isT && trashRows.length > 0 && (
          <div className="lb-note">
            <p>
              {soon > 0 ? (
                <>
                  <b>{t('crm.leads.bin.soonCount', { count: soon })}</b> {t('crm.leads.bin.soonTail')}
                </>
              ) : (
                t('crm.leads.bin.soonNone')
              )}
            </p>
            <button type="button" className="lb-btn dng" onClick={() => setCf({ ids: trashRows.map((r) => r.id), all: true })}>
              <Ic d={I.trash} size={14} />
              {t('crm.leads.bin.emptyTrash')}
            </button>
          </div>
        )}

        <div className="lb-card">
          {ids.length > 0 ? (
            <div className="lb-bar sel">
              <span className="cnt">{t('crm.leads.bin.selected', { count: ids.length })}</span>
              <button type="button" className="lb-btn" onClick={() => restore(ids)}>
                <Ic d={I.rest} size={14} />
                {t(isT ? 'crm.leads.bin.restore' : 'crm.leads.bin.returnToWork')}
              </button>
              {isT ? (
                <button type="button" className="lb-btn" onClick={() => toArchive(ids)}>
                  <Ic d={I.box} size={14} />
                  {t('crm.leads.bin.toArchive')}
                </button>
              ) : (
                <button type="button" className="lb-btn" onClick={() => toTrash(ids)}>
                  <Ic d={I.trash} size={14} />
                  {t('crm.leads.bin.toTrash')}
                </button>
              )}
              {isT && (
                <button type="button" className="lb-btn dng" onClick={() => setCf({ ids })}>
                  <Ic d={I.trash} size={14} />
                  {t('crm.leads.bin.deleteForever')}
                </button>
              )}
              <span className="lb-sp" />
              <button type="button" className="lb-btn" onClick={() => setSel(new Set())}>
                {t('crm.leads.bin.clearSelection')}
              </button>
            </div>
          ) : (
            <div className="lb-bar">
              <label className="lb-search">
                <Ic d={I.srch} size={14} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('crm.leads.bin.searchPlaceholder')} />
              </label>
              <select className="lb-sel" value={st} onChange={(e) => setSt(e.target.value)} aria-label={t('crm.leads.trash.columns.status')}>
                <option value="all">{t('crm.leads.bin.allStatuses')}</option>
                {presentStatuses.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
              <span className="lb-sp" />
              <span className="meta">{t('crm.leads.bin.count', { count: list.length })}</span>
            </div>
          )}

          {loading ? (
            <div className="lb-empty">
              <span>{t(isT ? 'crm.leads.trash.loading' : 'crm.leads.archive.loading')}</span>
            </div>
          ) : list.length ? (
            <div className="lb-tw">
              <table className="lb-t">
                <thead>
                  <tr>
                    <th className="ck">
                      <Cb v={allOn ? true : someOn ? 'mix' : false} onClick={togAll} label={t('crm.leads.bin.selectAll')} />
                    </th>
                    <th>
                      <SortH k="name">{t('crm.leads.trash.columns.name')}</SortH>
                    </th>
                    <th>{t('crm.leads.trash.columns.status')}</th>
                    <th>
                      <SortH k="created">{t('crm.leads.trash.columns.created')}</SortH>
                    </th>
                    <th>
                      <SortH k="at">{t(isT ? 'crm.leads.bin.colDeleted' : 'crm.leads.bin.colArchived')}</SortH>
                    </th>
                    {isT && <th>{t('crm.leads.bin.colTtl')}</th>}
                    <th className="r">{t('crm.leads.trash.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {view.map((r) => {
                    const dl = isT ? daysLeft(r) : null;
                    const sk = STATUS_KEYS[r.lead.status];
                    return (
                      <tr key={r.id} className={px(sel.has(r.id) && 'on')}>
                        <td className="ck">
                          <Cb v={sel.has(r.id)} onClick={() => tog(r.id)} label={t('crm.leads.bin.selectOne', { name: r.name })} />
                        </td>
                        <td>
                          <div className="lb-nm">
                            <span className="lb-ava">{r.name.charAt(0).toUpperCase()}</span>
                            <div>
                              <Link to={`/leads/${r.id}`}>
                                <b>{r.name}</b>
                              </Link>
                              {r.contact && <span>{r.contact}</span>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={px('lb-st', sk?.cls)}>
                            <i />
                            {statusLabel(r.lead.status)}
                          </span>
                        </td>
                        <td>
                          <div className="lb-dt">
                            <b>{fmtD(r.created)}</b>
                            <span>{fmtT(r.created)}</span>
                          </div>
                        </td>
                        <td>
                          <div className="lb-dt">
                            <b>{r.at ? fmtD(r.at) : '—'}</b>
                            {r.by && <span className="lb-who">{r.by}</span>}
                          </div>
                        </td>
                        {isT && (
                          <td>
                            {dl === null ? (
                              <span className="lb-ttl">—</span>
                            ) : (
                              <span className={px('lb-ttl', dl <= 3 && 'soon')}>
                                {t('crm.leads.bin.days', { count: dl })}
                                <span className="bar">
                                  <i style={{ width: `${(dl / TRASH_TTL_DAYS) * 100}%` }} />
                                </span>
                              </span>
                            )}
                          </td>
                        )}
                        <td className="r">
                          <div className="lb-acts">
                            <button type="button" className="lb-btn" onClick={() => restore([r.id])}>
                              <Ic d={I.rest} size={14} />
                              {t(isT ? 'crm.leads.bin.restore' : 'crm.leads.bin.returnToWork')}
                            </button>
                            {isT ? (
                              <button
                                type="button"
                                className="lb-ib dng"
                                title={t('crm.leads.bin.deleteForever')}
                                aria-label={t('crm.leads.bin.deleteForever')}
                                onClick={() => setCf({ ids: [r.id], name: r.name })}
                              >
                                <Ic d={I.trash} size={15} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="lb-ib dng"
                                title={t('crm.leads.bin.toTrash')}
                                aria-label={t('crm.leads.bin.toTrash')}
                                onClick={() => toTrash([r.id])}
                              >
                                <Ic d={I.trash} size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="lb-empty">
              <Ic d={isT ? I.trash : I.box} size={28} sw={1.2} />
              <b>{rows.length ? t('crm.leads.bin.notFound') : t(isT ? 'crm.leads.trash.empty' : 'crm.leads.archive.empty')}</b>
              <span>{rows.length ? t('crm.leads.bin.notFoundHint') : t(isT ? 'crm.leads.bin.trashEmptyHint' : 'crm.leads.bin.archiveEmptyHint')}</span>
            </div>
          )}

          {pages > 1 && (
            <div className="lb-foot">
              <span>{t('crm.leads.bin.range', { from: safePage * PER_PAGE + 1, to: Math.min(list.length, (safePage + 1) * PER_PAGE), total: list.length })}</span>
              <div className="lb-pg">
                <button type="button" disabled={!safePage} onClick={() => setPage(safePage - 1)} aria-label={t('crm.leads.bin.prev')}>
                  <Ic d={I.l} size={13} />
                </button>
                {Array.from({ length: pages }, (_, i) => (
                  <button type="button" key={i} className={px(i === safePage && 'on')} onClick={() => setPage(i)}>
                    {i + 1}
                  </button>
                ))}
                <button type="button" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)} aria-label={t('crm.leads.bin.next')}>
                  <Ic d={I.r} size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {cf && (
        <div className="lb-dlg-bd" onClick={() => !busy && setCf(null)}>
          <div className="lb-dlg" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{t(cf.all ? 'crm.leads.bin.confirmEmptyTitle' : 'crm.leads.bin.confirmDeleteTitle')}</h3>
            <p>{cf.name ? t('crm.leads.bin.confirmOne', { name: cf.name }) : t('crm.leads.bin.confirmMany', { count: cf.ids.length })}</p>
            <footer>
              <button type="button" className="lb-btn" disabled={busy} onClick={() => setCf(null)}>
                {t('crm.leads.bin.cancel')}
              </button>
              <button type="button" className="lb-btn dngf" disabled={busy} onClick={() => purge(cf.ids)}>
                {t('crm.leads.bin.deleteForever')}
              </button>
            </footer>
          </div>
        </div>
      )}
      {toast && (
        <div className={px('lb-toast', toast.err && 'err')} role="status">
          <span>{toast.msg}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                void toast.undo?.();
                setToast(null);
              }}
            >
              {t('crm.leads.bin.undo')}
            </button>
          )}
        </div>
      )}
    </MainLayout>
  );
};
