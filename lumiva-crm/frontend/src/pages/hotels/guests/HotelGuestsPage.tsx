import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import { CountrySelect, CountryTag } from '../CountrySelect';
import { fmtDate } from '../partners/partnerUtils';
import { hotelErrorText } from '../ReservationLifecycle';
import { GuestBadges, RevenueText, useLoc } from './GuestShared';
import {
  backfillGuestProfiles,
  createGuestProfile,
  fetchGuestDuplicates,
  fetchGuestProfiles,
  mergeGuestProfiles,
  type HotelGuestList,
} from '../../../api/hotels';
import '../hotels-design.css';

type Filter = 'all' | 'vip' | 'repeat' | 'upcoming' | 'inhouse' | 'blacklist' | 'duplicates';
const FILTERS: Filter[] = ['all', 'repeat', 'vip', 'upcoming', 'inhouse', 'blacklist', 'duplicates'];
type Dups = Awaited<ReturnType<typeof fetchGuestDuplicates>>;

/** Профили гостей: поиск, сегменты (постоянные, VIP, скоро заезд, живут, чёрный список), дубли со слиянием */
export const HotelGuestsPage: React.FC = () => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.guests.${key}`, o);
  const loc = useLoc();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();
  const [sp, setSp] = useSearchParams();
  const filter = (FILTERS.includes(sp.get('f') as Filter) ? sp.get('f') : 'all') as Filter;
  const [search, setSearch] = useState(sp.get('q') || '');
  const [country, setCountry] = useState<string | null>(null);
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HotelGuestList | null>(null);
  const [dups, setDups] = useState<Dups | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const load = () => {
    if (filter === 'duplicates') {
      fetchGuestDuplicates().then(setDups).catch((e) => showAlert(hotelErrorText(t, e, k('loadError')), { variant: 'error' }));
      return;
    }
    fetchGuestProfiles({ search: search.trim() || undefined, filter, country: country || undefined, sort, page })
      .then(setData)
      .catch((e) => showAlert(hotelErrorText(t, e, k('loadError')), { variant: 'error' }));
  };
  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(load, search ? 300 : 0);
    return () => window.clearTimeout(timer.current);
  }, [filter, search, country, sort, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), [filter, search, country, sort]);

  const setFilter = (f: Filter) => setSp((x) => { const n = new URLSearchParams(x); n.set('f', f); return n; });

  /** Собрать профили из старых броней — пачками, пока сервер не скажет «всё» */
  const backfill = async () => {
    setBusy(true);
    let linked = 0;
    try {
      for (let i = 0; i < 100; i++) {
        const r = await backfillGuestProfiles();
        linked += r.linked;
        if (!r.remaining || !r.processed) break;
      }
      showAlert(k('backfillDone', { count: linked }), { variant: 'success' });
      load();
    } catch (e) {
      showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const merge = async (targetId: string, ids: string[], name: string) => {
    if (!(await showConfirm(k('mergeBody', { name, count: ids.length }), { title: k('merge'), confirmLabel: k('merge') }))) return;
    setBusy(true);
    mergeGuestProfiles(targetId, ids)
      .then(() => { showAlert(k('merged'), { variant: 'success' }); load(); })
      .catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  const counts = data?.counts;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <MainLayout>
      <PageHelpButton topic="hotels" />
      <div className="px-scope">
        <HotelsSubnav active="guests" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{k('kicker', { count: counts?.total ?? 0 })}</div>
            <h1>{k('title')}</h1>
            <p className="sub">{k('subtitle')}</p>
          </div>
          <div className="htl-hero-r">
            <button className="btn btn-primary" onClick={() => setCreating(true)}><Ic d={HTL_ICON.plus} size={13} />{k('add')}</button>
          </div>
        </div>

        {!!data?.unlinked && filter !== 'duplicates' && (
          <div className="pe-box gp-banner">
            <span>{k('unlinked', { count: data.unlinked })}</span>
            <button className="btn btn-sm" disabled={busy} onClick={backfill}>{busy ? k('backfilling') : k('backfill')}</button>
          </div>
        )}

        {counts && (
          <div className="htl-kpis" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
            <div className="htl-kpi"><div className="l">{k('kpi.total')}</div><div className="v">{counts.total}</div></div>
            <div className="htl-kpi"><div className="l">{k('kpi.repeat')}</div><div className="v">{counts.repeat}</div><div className="d">{counts.total ? `${Math.round((counts.repeat / counts.total) * 100)}%` : ''}</div></div>
            <div className="htl-kpi"><div className="l">VIP</div><div className="v">{counts.vip}</div></div>
            <div className="htl-kpi"><div className="l">{k('kpi.upcoming')}</div><div className="v">{counts.upcoming}</div></div>
            <div className="htl-kpi"><div className="l">{k('kpi.blacklist')}</div><div className="v">{counts.blacklisted}</div></div>
          </div>
        )}

        <div className="htl-toolbar">
          <div className="bk-savedviews" style={{ flex: 'none' }}>
            {FILTERS.map((f) => (
              <div key={f} className={`bk-sv-tab${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{k(`filter.${f}`)}</div>
            ))}
          </div>
          {filter !== 'duplicates' && (
            <>
              <div className="bk-search" style={{ flex: 1, maxWidth: 320 }}>
                <Ic d={HTL_ICON.search} size={14} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={k('searchPh')} />
              </div>
              <div style={{ minWidth: 200 }}><CountrySelect value={country} onChange={setCountry} placeholder={k('anyCountry')} /></div>
              <select className="htl-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                {(['recent', 'stays', 'next', 'name'] as const).map((s) => <option key={s} value={s}>{k(`sort.${s}`)}</option>)}
              </select>
            </>
          )}
        </div>

        {filter === 'duplicates' ? (
          !dups ? null : !dups.length ? (
            <div className="htl-empty"><h4>{k('dupsEmpty')}</h4><p>{k('dupsEmptyHint')}</p></div>
          ) : (
            <div className="gp-dups">
              {dups.map((g, i) => <DupGroup key={i} group={g} busy={busy} onMerge={merge} onOpen={(id) => navigate(`/hotels/guests/${id}`)} />)}
            </div>
          )
        ) : !data ? null : !data.items.length ? (
          <div className="htl-empty"><h4>{search ? k('emptySearch') : k(`empty.${filter}`)}</h4><p>{k('emptyHint')}</p></div>
        ) : (
          <>
            <div className="bk-table-wrap">
              <table className="bk-table gp-table">
                <thead>
                  <tr>
                    <th>{k('col.guest')}</th>
                    <th>{k('col.contacts')}</th>
                    <th>{k('col.country')}</th>
                    <th className="num">{k('col.stays')}</th>
                    <th className="num">{k('col.nights')}</th>
                    <th className="num">{k('col.revenue')}</th>
                    <th>{k('col.last')}</th>
                    <th>{k('col.next')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((g) => (
                    <tr key={g.id} className="clickable" onClick={() => navigate(`/hotels/guests/${g.id}`)}>
                      <td>
                        <div className="gp-name"><b>{g.fullName}</b><GuestBadges g={g} compact /></div>
                        {g.documentNumber && <div className="htl-sub mono">{g.documentNumber}</div>}
                      </td>
                      <td>{g.email || '—'}<div className="htl-sub">{g.phone || ''}</div></td>
                      <td><CountryTag code={g.country} /></td>
                      <td className="num mono">{g.stats.stays}{g.stats.cancelled ? <div className="htl-sub">{k('cancelledShort', { count: g.stats.cancelled })}</div> : null}</td>
                      <td className="num mono">{g.stats.nights}</td>
                      <td className="num mono"><RevenueText revenue={g.stats.revenue} /></td>
                      <td>{g.stats.lastStay ? fmtDate(g.stats.lastStay, loc) : '—'}</td>
                      <td>{g.stats.nextStay ? <span className="gp-next">{fmtDate(g.stats.nextStay, loc)}</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="htl-toolbar gp-pager">
                <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
                <span className="htl-sub">{k('page', { page, pages, total: data.total })}</span>
                <button className="btn btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>›</button>
              </div>
            )}
          </>
        )}
      </div>
      {creating && (
        <NewGuestDialog
          onClose={() => setCreating(false)}
          onCreate={(dto) => createGuestProfile(dto).then((p) => { setCreating(false); navigate(`/hotels/guests/${p.id}`); }).catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }))}
        />
      )}
    </MainLayout>
  );
};

/** Группа вероятных дублей: выбрать основной профиль и объединить */
const DupGroup: React.FC<{ group: Dups[number]; busy: boolean; onMerge: (targetId: string, ids: string[], name: string) => void; onOpen: (id: string) => void }> = ({ group, busy, onMerge, onOpen }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.guests.${key}`, o);
  const loc = useLoc();
  // основной по умолчанию — с наибольшим числом проживаний, при равенстве — самый старый
  const best = [...group.profiles].sort((a, b) => b.stats.bookings - a.stats.bookings || a.createdAt.localeCompare(b.createdAt))[0];
  const [target, setTarget] = useState(best?.id);
  const [picked, setPicked] = useState<Set<string>>(new Set(group.profiles.map((p) => p.id)));
  const others = group.profiles.filter((p) => p.id !== target && picked.has(p.id)).map((p) => p.id);
  return (
    <div className={`gp-dup ${group.reason === 'name' ? 'weak' : ''}`}>
      <div className="gp-dup-head">
        <span className={`gp-reason r-${group.reason}`}>{k(`reason.${group.reason}`)}</span>
        {group.reason === 'name' && <span className="htl-sub">{k('weakHint')}</span>}
        <button className="btn btn-sm btn-primary" disabled={busy || !others.length} onClick={() => onMerge(target, others, group.profiles.find((p) => p.id === target)?.fullName || '')}>{k('mergeInto', { count: others.length + 1 })}</button>
      </div>
      <table className="bk-table">
        <thead><tr><th>{k('col.main')}</th><th>{k('col.include')}</th><th>{k('col.guest')}</th><th>{k('col.contacts')}</th><th>{k('col.document')}</th><th className="num">{k('col.bookings')}</th><th>{k('col.created')}</th></tr></thead>
        <tbody>
          {group.profiles.map((p) => (
            <tr key={p.id}>
              <td><input type="radio" checked={target === p.id} onChange={() => { setTarget(p.id); setPicked((s) => new Set(s).add(p.id)); }} /></td>
              <td><input type="checkbox" disabled={target === p.id} checked={picked.has(p.id)} onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} /></td>
              <td><button type="button" className="lnk" onClick={() => onOpen(p.id)}>{p.fullName}</button> <GuestBadges g={p} compact /></td>
              <td>{p.email || '—'}<div className="htl-sub">{p.phone || ''}</div></td>
              <td className="mono">{p.documentNumber || '—'}{p.birthDate && <div className="htl-sub">{fmtDate(p.birthDate, loc)}</div>}</td>
              <td className="num mono">{p.stats.bookings}</td>
              <td>{fmtDate(p.createdAt, loc)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const NewGuestDialog: React.FC<{ onClose: () => void; onCreate: (dto: { fullName: string; email: string | null; phone: string | null; country: string | null }) => void }> = ({ onClose, onCreate }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.guests.${key}`, o);
  const [d, setD] = useState({ fullName: '', email: '', phone: '', country: null as string | null });
  return createPortal(
    <div className="px-scope">
      <div className="lv-backdrop bk-modal-back" onClick={onClose} />
      <div className="bk-modal narrow lv-dialog" role="dialog" aria-modal="true">
        <div className="bk-modal-head"><h3>{k('newTitle')}</h3><button type="button" onClick={onClose} aria-label={k('cancel')}><Ic d={HTL_ICON.x} size={16} /></button></div>
        <div className="bk-modal-body">
          <label>{k('f.fullName')} *</label><input value={d.fullName} onChange={(e) => setD({ ...d, fullName: e.target.value })} autoFocus />
          <label>Email</label><input value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
          <label>{k('f.phone')}</label><input value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} />
          <label>{k('f.country')}</label><CountrySelect value={d.country} onChange={(c) => setD({ ...d, country: c })} />
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>{k('cancel')}</button>
          <button className="btn btn-primary" disabled={!d.fullName.trim()} onClick={() => onCreate({ fullName: d.fullName.trim(), email: d.email.trim() || null, phone: d.phone.trim() || null, country: d.country })}><Ic d={HTL_ICON.check} size={14} />{k('create')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
