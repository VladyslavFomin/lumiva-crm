/**
 * «Отзывы» (Маркетинг → Отзывы): ИИ-менеджер отзывов следит за Google-отзывами объекта, пишет
 * черновик ответа на языке отзыва и сигналит о негативе. Доступно только при активном ИИ-сотруднике
 * «Менеджер отзывов». Публикация ответа — вручную в Google (Business Profile API — следующий шаг).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import {
  addReviewPlace,
  fetchReviewItems,
  fetchReviewPlaces,
  fetchReviewStats,
  fetchReviewsAccess,
  regenerateReviewReply,
  removeReviewPlace,
  searchReviewPlaces,
  syncReviewPlace,
  updateReviewItem,
  updateReviewPlace,
  type ReviewItem,
  type ReviewPlace,
  type ReviewPlaceCandidate,
  type ReviewStats,
  type ReviewsAccess,
} from '../../api/reviews';
import { ApiError } from '../../api/client';
import { getLocale } from '../../i18n/utils';
import { cl, Ic } from '../contacts/CrmListShared';
import '../contacts/crm-lists-design.css';
import './seo-design.css';
import './reviews-ai.css';

type Filter = 'open' | 'negative' | 'all' | 'replied';

const I = {
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 012-2h10" />
    </>
  ),
  ext: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-8 8" />
      <path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 11-3-6.7" />
      <path d="M21 4v5h-5" />
    </>
  ),
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  check: <path d="M5 12l4 4 10-10" />,
};

const Stars: React.FC<{ n: number; size?: number }> = ({ n, size = 13 }) => (
  <span className="rv-stars" aria-label={`${n}/5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <svg key={i} width={size} height={size} viewBox="0 0 24 24" className={i <= n ? 'on' : ''} aria-hidden="true">
        {I.star}
      </svg>
    ))}
  </span>
);

export const ReviewsPage: React.FC = () => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.reviewsAi.${key}`, o) as string;
  const [access, setAccess] = useState<ReviewsAccess | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchReviewsAccess()
      .then(setAccess)
      .catch(() => setFailed(true));
  }, []);

  return (
    <MainLayout>
      <div className="px-scope seo-scope rv-scope">
        <div className="seo-wrap">
          <div className="seo-head">
            <div>
              <div className="kicker">
                <span className="dot" />
                {k('kicker')}
              </div>
              <h1>{k('title')}</h1>
              <div className="sub">{k('subtitle')}</div>
            </div>
          </div>
          {failed ? (
            <div className="seo-note err"><span className="sp">{k('errors.load')}</span></div>
          ) : !access ? (
            <div className="seo-skel" style={{ height: 220 }} />
          ) : access.allowed && access.employee ? (
            <ReviewsWorkspace employee={access.employee} placesKey={access.placesKey} />
          ) : (
            <HireGate access={access} />
          )}
        </div>
      </div>
    </MainLayout>
  );
};

const HireGate: React.FC<{ access: ReviewsAccess }> = ({ access }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.reviewsAi.gate.${key}`, o) as string;
  const emp = access.employee;
  const needsSlot = !emp || emp.status === 'disabled';
  const blocked = needsSlot && !access.canHire;
  const free = access.limit == null ? null : Math.max(0, access.limit - access.used);
  return (
    <div className="seo-card rv-gate">
      <div className="rv-gate-ico">
        <Ic d={I.star} size={26} sw={1.7} />
      </div>
      <h2>{k('title')}</h2>
      <p>{k('sub')}</p>
      <ul>
        {(t('crm.aiEmployees.roleCatalog.reviews_manager.functions', { returnObjects: true }) as unknown as string[]).map((f) => (
          <li key={f}>
            <Ic d={I.check} size={12} sw={2.2} /> {f}
          </li>
        ))}
      </ul>
      {emp ? <div className="seo-note warn"><span className="sp">{k('inactive', { name: emp.name })}</span></div> : null}
      {!access.planAllowed ? (
        <div className="seo-note warn"><span className="sp">{k('planLocked')}</span></div>
      ) : blocked ? (
        <div className="seo-note warn"><span className="sp">{k('noSlots', { used: access.used, limit: access.limit })}</span></div>
      ) : null}
      <div className="rv-gate-act">
        {emp ? (
          <Link className="btn btn-primary" to={`/ai-employees/${emp.id}`}>{k('open')}</Link>
        ) : access.planAllowed && !blocked ? (
          <Link className="btn btn-primary" to="/ai-employees/new?role=reviews_manager">{k('hire')}</Link>
        ) : null}
        <Link className="btn" to="/ai-employees">{k('allEmployees')}</Link>
        {!access.planAllowed || blocked ? <Link className="btn" to="/billing">{k('upgrade')}</Link> : null}
      </div>
      {access.planAllowed && needsSlot ? (
        <div className="rv-muted">{free == null ? k('slotsUnlimited') : k('slots', { free, limit: access.limit })}</div>
      ) : null}
    </div>
  );
};

const ReviewsWorkspace: React.FC<{ employee: NonNullable<ReviewsAccess['employee']>; placesKey: boolean }> = ({ employee, placesKey }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.reviewsAi.${key}`, o) as string;
  const locale = getLocale(i18n.language);
  const [sp, setSp] = useSearchParams();
  const [places, setPlaces] = useState<ReviewPlace[] | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(sp.get('place'));
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const errText = (e: unknown, fallback: string) => {
    const code = e instanceof ApiError ? e.code : undefined;
    if (code && i18n.exists(`crm.reviewsAi.errors.${code}`)) return k(`errors.${code}`);
    return e instanceof Error && e.message ? e.message : fallback;
  };

  const loadPlaces = useCallback(async () => {
    const list = await fetchReviewPlaces();
    setPlaces(list);
    setPlaceId((cur) => (cur && list.some((p) => p.id === cur) ? cur : list[0]?.id ?? null));
    if (!list.length) setAdding(true);
  }, []);

  useEffect(() => {
    loadPlaces().catch((e) => setError(errText(e, k('errors.load'))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadItems = useCallback(async () => {
    if (!placeId) return;
    const q = { placeId, status: filter === 'open' ? 'open' : filter === 'replied' ? 'replied' : undefined, sentiment: filter === 'negative' ? 'negative' : undefined };
    const [list, st] = await Promise.all([fetchReviewItems(q), fetchReviewStats(placeId)]);
    setItems(list);
    setStats(st);
  }, [placeId, filter]);

  useEffect(() => {
    loadItems().catch((e) => setError(errText(e, k('errors.load'))));
    if (placeId) {
      const next = new URLSearchParams(sp);
      next.set('place', placeId);
      setSp(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId, filter]);

  const place = places?.find((p) => p.id === placeId) || null;

  const patchItem = (it: ReviewItem) => setItems((list) => list.map((x) => (x.id === it.id ? it : x)));

  const sync = async () => {
    if (!place) return;
    setBusy('sync');
    setError(null);
    try {
      const r = await syncReviewPlace(place.id);
      setStatus(k('synced', { count: r.new }));
      await Promise.all([loadPlaces(), loadItems()]);
    } catch (e) {
      setError(errText(e, k('errors.sync')));
    } finally {
      setBusy('');
    }
  };

  if (!placesKey) return <div className="seo-note err"><span className="sp">{k('errors.REVIEWS_NO_PLACES_KEY')}</span></div>;
  if (!places) return <div className="seo-skel" style={{ height: 260 }} />;

  return (
    <div className="rv">
      {error && (
        <div className="seo-note err" role="alert">
          <span className="sp">{error}</span>
          <button type="button" className="x" onClick={() => setError(null)}>×</button>
        </div>
      )}
      {status && !error && (
        <div className="seo-note ok" role="status">
          <span className="sp">{status}</span>
          <button type="button" className="x" onClick={() => setStatus(null)}>×</button>
        </div>
      )}

      <div className="rv-places">
        {places.map((p) => (
          <button key={p.id} type="button" className={cl('rv-place', p.id === placeId && 'on')} onClick={() => { setPlaceId(p.id); setAdding(false); }}>
            <b>{p.name}</b>
            <span>
              {p.rating != null ? `${p.rating.toLocaleString(locale, { maximumFractionDigits: 1 })} ★` : '—'} · {k('reviewsCount', { count: p.totalReviews })}
            </span>
            {p.openNegative ? <em>{p.openNegative}</em> : null}
          </button>
        ))}
        <button type="button" className={cl('rv-place', 'add', adding && 'on')} onClick={() => setAdding(true)}>
          + {k('addPlace')}
        </button>
      </div>

      {adding ? (
        <AddPlace
          onAdded={async (p) => {
            setAdding(false);
            await loadPlaces();
            setPlaceId(p.id);
          }}
          onError={(e) => setError(errText(e, k('errors.add')))}
        />
      ) : place ? (
        <div className="rv-cols">
          <div className="rv-main">
            <div className="rv-kpis">
              <div>
                <div className="l">{k('kpi.rating')}</div>
                <div className="v">
                  {place.rating != null ? place.rating.toLocaleString(locale, { maximumFractionDigits: 1 }) : '—'} <Stars n={Math.round(place.rating || 0)} size={14} />
                </div>
                <div className="s">{k('reviewsCount', { count: place.totalReviews })}</div>
              </div>
              <div>
                <div className="l">{k('kpi.new30')}</div>
                <div className="v">{stats?.count ?? 0}</div>
                <div className="s">{stats?.avgRating != null ? k('kpi.avg', { v: stats.avgRating.toLocaleString(locale) }) : ''}</div>
              </div>
              <div>
                <div className="l">{k('kpi.negative')}</div>
                <div className={cl('v', (stats?.negative || 0) > 0 && 'bad')}>{stats?.negative ?? 0}</div>
                <div className="s">{k('kpi.openNegative', { count: place.openNegative || 0 })}</div>
              </div>
              <div>
                <div className="l">{k('kpi.replied')}</div>
                <div className="v">{stats?.replied ?? 0}</div>
                <div className="s">{k('kpi.of', { count: stats?.count ?? 0 })}</div>
              </div>
            </div>
            {stats && stats.topics.length > 0 && (
              <div className="rv-topics">
                <span className="l">{k('topics')}</span>
                {stats.topics.map((tp) => (
                  <span key={tp.topic} className={cl('rv-topic', tp.negative > tp.total / 2 && 'bad')}>
                    {tp.topic} <em>{tp.total}</em>
                  </span>
                ))}
              </div>
            )}
            <div className="rv-bar">
              <div className="seo-seg">
                {(['open', 'negative', 'replied', 'all'] as Filter[]).map((f) => (
                  <button key={f} type="button" className={cl(filter === f && 'active')} onClick={() => setFilter(f)}>
                    {k(`filters.${f}`)}
                  </button>
                ))}
              </div>
              <span className="rv-muted">
                {place.lastSyncAt ? k('lastSync', { date: new Date(place.lastSyncAt).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }) : ''}
              </span>
              <button type="button" className="btn btn-sm" onClick={() => void sync()} disabled={busy === 'sync'}>
                <Ic d={I.refresh} size={13} />
                {busy === 'sync' ? k('syncing') : k('syncNow')}
              </button>
            </div>
            {place.lastError ? <div className="seo-note warn"><span className="sp">{k('lastError', { msg: place.lastError })}</span></div> : null}
            <div className="rv-list">
              {items.length === 0 ? (
                <div className="seo-card seo-empty">{k(`empty.${filter}`)}</div>
              ) : (
                items.map((it) => <ReviewCard key={it.id} it={it} place={place} onChange={patchItem} onError={(e) => setError(errText(e, k('errors.save')))} />)
              )}
            </div>
            <p className="rv-muted rv-note">{k('manualNote')}</p>
          </div>
          <PlaceSettings
            place={place}
            employee={employee}
            onSaved={(p) => setPlaces((list) => (list || []).map((x) => (x.id === p.id ? { ...x, ...p } : x)))}
            onRemoved={async () => {
              await loadPlaces();
            }}
            onError={(e) => setError(errText(e, k('errors.save')))}
          />
        </div>
      ) : null}
    </div>
  );
};

const AddPlace: React.FC<{ onAdded: (p: ReviewPlace) => void; onError: (e: unknown) => void }> = ({ onAdded, onError }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.reviewsAi.${key}`, o) as string;
  const locale = getLocale(i18n.language);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<ReviewPlaceCandidate[] | null>(null);
  const [busy, setBusy] = useState('');
  const run = async () => {
    if (q.trim().length < 2) return;
    setBusy('search');
    try {
      setRes(await searchReviewPlaces(q.trim()));
    } catch (e) {
      onError(e);
    } finally {
      setBusy('');
    }
  };
  return (
    <div className="seo-card rv-add">
      <div className="seo-card-head">
        <h3>{k('add.title')}</h3>
      </div>
      <div className="seo-field">
        <div className="row">
          <input
            className="seo-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void run()}
            placeholder={k('add.placeholder')}
          />
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void run()} disabled={busy === 'search' || q.trim().length < 2}>
            <Ic d={I.search} size={13} />
            {busy === 'search' ? k('add.searching') : k('add.search')}
          </button>
        </div>
        <div className="seo-hint">{k('add.hint')}</div>
      </div>
      {res && (
        <div className="rv-cands">
          {res.length === 0 ? (
            <div className="seo-empty">{k('add.nothing')}</div>
          ) : (
            res.map((c) => (
              <div key={c.placeId} className="rv-cand">
                <div className="m">
                  <b>{c.name}</b>
                  <span>{c.address}</span>
                  <span>
                    {c.rating != null ? `${c.rating.toLocaleString(locale)} ★ · ` : ''}
                    {k('reviewsCount', { count: c.totalReviews })}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!!busy}
                  onClick={async () => {
                    setBusy(c.placeId);
                    try {
                      onAdded(await addReviewPlace(c.placeId));
                    } catch (e) {
                      onError(e);
                    } finally {
                      setBusy('');
                    }
                  }}
                >
                  {busy === c.placeId ? k('add.adding') : k('add.add')}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const ReviewCard: React.FC<{ it: ReviewItem; place: ReviewPlace; onChange: (it: ReviewItem) => void; onError: (e: unknown) => void }> = ({ it, place, onChange, onError }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.reviewsAi.${key}`, o) as string;
  const locale = getLocale(i18n.language);
  const [draft, setDraft] = useState(it.aiReply || '');
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => setDraft(it.aiReply || ''), [it.aiReply]);

  const save = async (patch: { status?: ReviewItem['status']; aiReply?: string }) => {
    setBusy(patch.status || 'save');
    try {
      const next = await updateReviewItem(it.id, patch);
      if (next) onChange(next);
    } catch (e) {
      onError(e);
    } finally {
      setBusy('');
    }
  };
  const regen = async (tone?: string) => {
    setBusy('regen');
    try {
      const next = await regenerateReviewReply(it.id, tone);
      if (next) onChange(next);
    } catch (e) {
      onError(e);
    } finally {
      setBusy('');
    }
  };
  const copyAndOpen = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* буфер недоступен — ответ всё равно виден в поле */
    }
    if (draft !== (it.aiReply || '')) void save({ aiReply: draft });
    window.open(place.mapsUrl || place.writeReviewUrl, '_blank', 'noopener');
  };

  return (
    <div className={cl('seo-card', 'rv-card', it.sentiment === 'negative' && 'neg', it.status === 'replied' && 'done', it.status === 'ignored' && 'ign')}>
      <div className="rv-card-h">
        {it.authorPhoto ? <img src={it.authorPhoto} alt="" referrerPolicy="no-referrer" /> : <span className="ava">{(it.authorName || '?').slice(0, 1)}</span>}
        <div className="who">
          <b>{it.authorName || k('guest')}</b>
          <span>
            {new Date(it.publishedAt).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}
            {it.language ? ` · ${it.language.toUpperCase()}` : ''}
          </span>
        </div>
        <Stars n={it.rating} />
        {it.sentiment ? <span className={cl('rv-sent', it.sentiment)}>{k(`sentiment.${it.sentiment}`)}</span> : null}
        {it.status === 'replied' ? <span className="rv-sent done">{k('status.replied')}</span> : null}
      </div>
      {it.text ? <p className="rv-text">{it.text}</p> : <p className="rv-text rv-muted">{k('noText')}</p>}
      {(it.summary || it.topics.length > 0) && (
        <div className="rv-ai">
          {it.summary ? <span>{it.summary}</span> : null}
          {it.topics.map((tp) => (
            <span key={tp} className="rv-topic">{tp}</span>
          ))}
        </div>
      )}
      {it.status !== 'ignored' && (
        <div className="rv-reply">
          <div className="l">
            <Ic d={I.spark} size={12} /> {k('draft')}
          </div>
          {it.aiReply == null && !draft ? (
            <div className="rv-muted">{k('noDraft')}</div>
          ) : (
            <textarea
              className="seo-input rv-ta"
              value={draft}
              rows={Math.min(8, Math.max(3, Math.ceil(draft.length / 90)))}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => draft !== (it.aiReply || '') && void save({ aiReply: draft })}
            />
          )}
          <div className="rv-act">
            <button type="button" className="btn btn-sm btn-primary" onClick={() => void copyAndOpen()} disabled={!draft}>
              <Ic d={I.copy} size={13} />
              {copied ? k('copied') : k('copyOpen')}
            </button>
            {it.status !== 'replied' ? (
              <button type="button" className="btn btn-sm" onClick={() => void save({ status: 'replied', aiReply: draft })} disabled={!!busy}>
                <Ic d={I.check} size={13} />
                {k('markReplied')}
              </button>
            ) : null}
            <select
              className="seo-input rv-tone"
              value=""
              disabled={busy === 'regen'}
              onChange={(e) => e.target.value && void regen(e.target.value === 'same' ? undefined : e.target.value)}
              aria-label={k('regenerate')}
            >
              <option value="">{busy === 'regen' ? k('regenerating') : k('regenerate')}</option>
              <option value="same">{k('tones.same')}</option>
              <option value="shorter, 2 sentences">{k('tones.shorter')}</option>
              <option value="warmer and more personal">{k('tones.warmer')}</option>
              <option value="formal and official">{k('tones.formal')}</option>
            </select>
            {it.status !== 'replied' ? (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => void save({ status: 'ignored' })} disabled={!!busy}>
                {k('ignore')}
              </button>
            ) : null}
          </div>
        </div>
      )}
      {it.status === 'ignored' ? (
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => void save({ status: 'drafted' })}>
          {k('restore')}
        </button>
      ) : null}
    </div>
  );
};

const PlaceSettings: React.FC<{
  place: ReviewPlace;
  employee: NonNullable<ReviewsAccess['employee']>;
  onSaved: (p: ReviewPlace) => void;
  onRemoved: () => void;
  onError: (e: unknown) => void;
}> = ({ place, employee, onSaved, onRemoved, onError }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.reviewsAi.settings.${key}`, o) as string;
  const init = () => ({
    enabled: place.enabled,
    syncHours: place.syncHours,
    alertThreshold: place.alertThreshold,
    recipients: place.recipients.join(', '),
    businessContext: place.businessContext || '',
    signature: place.signature || '',
  });
  const [d, setD] = useState(init);
  const [busy, setBusy] = useState(false);
  useEffect(() => setD(init()), [place.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(d) !== JSON.stringify(init());
  const save = async () => {
    setBusy(true);
    try {
      onSaved(
        await updateReviewPlace(place.id, {
          enabled: d.enabled,
          syncHours: d.syncHours,
          alertThreshold: d.alertThreshold,
          recipients: d.recipients.split(/[\s,;]+/).filter(Boolean),
          businessContext: d.businessContext || null,
          signature: d.signature || null,
        }),
      );
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rv-side">
      <div className="seo-card">
        <div className="seo-card-head">
          <h3>{k('title')}</h3>
          <Link to={`/ai-employees/${employee.id}`} className="rv-emp">{employee.name}</Link>
        </div>
        <div className="seo-field">
          <label className="rv-check">
            <input type="checkbox" checked={d.enabled} onChange={(e) => setD({ ...d, enabled: e.target.checked })} />
            {k('enabled')}
          </label>
          <div className="rv-grid">
            <label>
              <span className="l">{k('every')}</span>
              <select className="seo-input" value={d.syncHours} onChange={(e) => setD({ ...d, syncHours: Number(e.target.value) })}>
                {[1, 3, 6, 12, 24].map((h) => (
                  <option key={h} value={h}>{k('hours', { count: h })}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="l">{k('threshold')}</span>
              <select className="seo-input" value={d.alertThreshold} onChange={(e) => setD({ ...d, alertThreshold: Number(e.target.value) })}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{k('thresholdOpt', { n })}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="seo-field">
          <span className="l">{k('recipients')}</span>
          <input className="seo-input" value={d.recipients} onChange={(e) => setD({ ...d, recipients: e.target.value })} placeholder="owner@hotel.com" />
          <div className="seo-hint">{k('recipientsHint')}</div>
        </div>
        <div className="seo-field">
          <span className="l">{k('context')}</span>
          <textarea className="seo-input rv-ta" rows={4} value={d.businessContext} onChange={(e) => setD({ ...d, businessContext: e.target.value })} placeholder={k('contextPh')} />
        </div>
        <div className="seo-field">
          <span className="l">{k('signature')}</span>
          <input className="seo-input" value={d.signature} onChange={(e) => setD({ ...d, signature: e.target.value })} placeholder={place.name} />
        </div>
        <div className="seo-field">
          <div className="row">
            <button type="button" className="btn btn-sm btn-primary" disabled={!dirty || busy} onClick={() => void save()}>
              {busy ? k('saving') : k('save')}
            </button>
            {place.mapsUrl ? (
              <a className="btn btn-sm btn-ghost" href={place.mapsUrl} target="_blank" rel="noopener noreferrer">
                {k('openMaps')} <Ic d={I.ext} size={12} />
              </a>
            ) : null}
          </div>
          <button
            type="button"
            className="rv-remove"
            onClick={async () => {
              if (!window.confirm(k('removeConfirm', { name: place.name }))) return;
              try {
                await removeReviewPlace(place.id);
                onRemoved();
              } catch (e) {
                onError(e);
              }
            }}
          >
            {k('remove')}
          </button>
        </div>
      </div>
    </div>
  );
};
