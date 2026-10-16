import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import {
  REP_PLATFORMS,
  confirmRepExactDuplicates,
  fetchRepFeed,
  fetchRepLanguages,
  fetchRepSettings,
  fetchRepSetup,
  type RepFeed,
  type RepFeedQuery,
  type RepSetup,
} from '../../../api/hotelReputation';
import { AiStatusBanner, ApifyPauseBanner, ReviewsAgentStrip, PLATFORM_META, PlatformBadge, ReputationTabs, Score, TOPIC_KEYS, fmtDate, topicLabel, useRepT } from './ReputationShared';
import { ReviewCardDrawer } from './ReviewCardDrawer';
import { DateRangePicker, fromIsoDate, lastDays, toIsoDate } from '../../../components/ui/DateRangePicker';
import { RepMultiSelect, joinParam, splitParam } from './RepMultiSelect';
import '../hotels-design.css';
import './reputation.css';

const PAGE = 50;
const FILTER_KEYS = ['brandId', 'hotelId', 'platform', 'from', 'to', 'ratingMin', 'ratingMax', 'lang', 'topic', 'reply', 'sentiment', 'status', 'dup', 'q', 'sort'] as const;

/** Отели → Отзывы → Лента: все площадки в одной ленте, сначала новые, негатив без ответа подсвечен. */
export const ReviewsFeedPage: React.FC = () => {
  const { r, t, lang } = useRepT();
  const { showAlert, showConfirm } = useAlertModal();
  const [bulkBusy, setBulkBusy] = useState(false);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [setup, setSetup] = useState<RepSetup | null>(null);
  const [langs, setLangs] = useState<Array<{ lang: string; n: number }>>([]);
  const [negBelow, setNegBelow] = useState(6);
  const [apifyPause, setApifyPause] = useState<{ reason: string | null; at: string | null } | null>(null);
  const [disabledTopics, setDisabledTopics] = useState<string[]>([]);
  const [extraTopics, setExtraTopics] = useState<Array<{ key: string; label: string; translations?: Partial<Record<'ru' | 'tr' | 'en', string>> }>>([]);
  const [feed, setFeed] = useState<RepFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [qInput, setQInput] = useState(params.get('q') || '');

  const filters: RepFeedQuery = useMemo(() => {
    const f: any = {};
    for (const k of FILTER_KEYS) {
      const v = params.get(k);
      if (v) f[k] = v;
    }
    // «hotel» / «topic» в ссылках из алертов и дашборда
    if (params.get('hotel')) f.hotelId = params.get('hotel');
    return f;
  }, [params]);

  const setFilter = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (k === 'hotelId') p.delete('hotel');
    if (v) p.set(k, v);
    else p.delete(k);
    p.delete('review');
    setParams(p, { replace: true });
  };
  const openReview = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set('review', id);
    else p.delete('review');
    setParams(p, { replace: !id });
  };

  useEffect(() => {
    fetchRepSetup().then(setSetup).catch(() => setSetup({ brands: [], hotels: [] }));
    fetchRepLanguages().then(setLangs).catch(() => undefined);
    fetchRepSettings().then((s) => {
      setNegBelow(s.config.thresholds.negativeBelow);
      setApifyPause(s.config.apifyPause);
      setDisabledTopics(s.config.topicsDisabled || []);
      setExtraTopics(s.config.topicsExtra || []);
    }).catch(() => undefined);
  }, []);

  const load = useCallback(
    (append = false) => {
      setLoading(true);
      return fetchRepFeed({ ...filters, offset: append && feed ? feed.items.length : 0, limit: PAGE })
        .then((d) => setFeed((prev) => (append && prev ? { ...d, items: [...prev.items, ...d.items] } : d)))
        .catch((e) => showAlert(e.message, { variant: 'error' }))
        .finally(() => setLoading(false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  // поиск — с задержкой, чтобы не дёргать API на каждую букву
  useEffect(() => {
    const id = setTimeout(() => {
      if ((params.get('q') || '') !== qInput) setFilter('q', qInput.trim() || null);
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  const hotels = setup?.hotels || [];
  const selBrands = splitParam(filters.brandId);
  const selHotels = splitParam(filters.hotelId);
  const hotelsInBrand = selBrands.length ? hotels.filter((h) => h.brandId && selBrands.includes(h.brandId)) : hotels;
  const setBrands = (v: string[]) => {
    const p = new URLSearchParams(params);
    p.delete('hotel');
    p.delete('review');
    const j = joinParam(v);
    j ? p.set('brandId', j) : p.delete('brandId');
    if (v.length) {
      const keep = selHotels.filter((id) => v.includes(hotels.find((h) => h.id === id)?.brandId || ''));
      const jh = joinParam(keep);
      jh ? p.set('hotelId', jh) : p.delete('hotelId');
    }
    setParams(p, { replace: true });
  };
  const topicOptions = [
    ...TOPIC_KEYS.filter((key) => !disabledTopics.includes(key)).map((key) => ({ topic: key } as { topic: string; label?: string; translations?: Partial<Record<'ru' | 'tr' | 'en', string>> })),
    ...extraTopics.map((topic) => ({ topic: topic.key, label: topic.label, translations: topic.translations })),
    { topic: 'other' },
  ].map((tp) => ({ value: tp.topic, label: topicLabel(tp, r, lang) }));
  const hotelName = (id: string) => hotels.find((h) => h.id === id)?.name || '—';
  const activeCount = FILTER_KEYS.filter((k) => k !== 'sort' && (filters as any)[k]).length;
  const noSources = setup && !hotels.some((h) => h.sources.length);

  return (
    <MainLayout>
      <PageHelpButton topic="hotelReviews" />
      <div className="px-scope">
        <HotelsSubnav active="reviews" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{r('kicker')}</div>
            <h1>{r('feed.title')}</h1>
            <p className="sub">{r('feed.subtitle')}</p>
          </div>
          <div className="htl-hero-r">
            <button data-tour="rv-setup" type="button" className="btn" onClick={() => navigate('/hotels/reviews/settings')}>
              <Ic d={HTL_ICON.settings} />{r('feed.setup')}
            </button>
          </div>
        </div>
        <ReputationTabs active="feed" urgent={feed?.unansweredNegative} />

        {noSources ? (
          <div className="rp-feed">
            <div className="rp-empty">
              <h4>{r('feed.emptySetupTitle')}</h4>
              <p style={{ margin: '0 0 14px' }}>{r('feed.emptySetupText')}</p>
              <button type="button" className="btn btn-primary" onClick={() => navigate('/hotels/reviews/settings')}>{r('feed.setup')}</button>
            </div>
          </div>
        ) : (
          <>
            <div data-tour="rv-filters" className="rp-filters">
              <div className="bk-search">
                <Ic d={HTL_ICON.search} />
                <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder={r('feed.search')} />
              </div>
              <RepMultiSelect allLabel={r('filters.allBrands')} value={selBrands} onChange={setBrands} options={(setup?.brands || []).map((b) => ({ value: b.id, label: b.name }))} />
              <RepMultiSelect allLabel={r('filters.allHotels')} value={selHotels} onChange={(v) => setFilter('hotelId', joinParam(v))} options={hotelsInBrand.map((h) => ({ value: h.id, label: h.name }))} />
              <RepMultiSelect
                allLabel={r('filters.allPlatforms')}
                value={splitParam(filters.platform)}
                onChange={(v) => setFilter('platform', joinParam(v))}
                options={REP_PLATFORMS.map((p) => ({ value: p, label: PLATFORM_META[p].label, icon: <PlatformBadge platform={p} compact /> }))}
              />
              <DateRangePicker
                value={{ from: fromIsoDate(filters.from), to: fromIsoDate(filters.to) }}
                presets={[
                  ...([7, 14, 30, 90, 365] as const).map((n) => ({ id: String(n), label: t(`crm.dateRange.last${n}`), range: lastDays(n) })),
                  { id: 'all', label: t('crm.dateRange.allTime'), range: { from: null, to: null } },
                ]}
                maxDate={new Date()}
                onChange={(v) => {
                  const p = new URLSearchParams(params);
                  v.from ? p.set('from', toIsoDate(v.from)) : p.delete('from');
                  v.to ? p.set('to', toIsoDate(v.to)) : p.delete('to');
                  p.delete('review');
                  setParams(p, { replace: true });
                }}
              />
              <select
                value={filters.ratingMin || filters.ratingMax ? `${filters.ratingMin || ''}-${filters.ratingMax || ''}` : ''}
                onChange={(e) => {
                  const [mn, mx] = e.target.value.split('-');
                  const p = new URLSearchParams(params);
                  mn ? p.set('ratingMin', mn) : p.delete('ratingMin');
                  mx ? p.set('ratingMax', mx) : p.delete('ratingMax');
                  setParams(p, { replace: true });
                }}
              >
                <option value="">{r('filters.anyRating')}</option>
                <option value={`-${(negBelow - 0.01).toFixed(2)}`}>{r('filters.negative', { n: negBelow })}</option>
                <option value={`${negBelow}-7.99`}>{r('filters.middle', { a: negBelow, b: 8 })}</option>
                <option value="8-">{r('filters.positive')}</option>
              </select>
              <select value={filters.lang || ''} onChange={(e) => setFilter('lang', e.target.value || null)}>
                <option value="">{r('filters.allLanguages')}</option>
                {langs.map((l) => <option key={l.lang} value={l.lang}>{l.lang.toUpperCase()} · {l.n}</option>)}
              </select>
              <RepMultiSelect allLabel={r('filters.allTopics')} value={splitParam(filters.topic)} onChange={(v) => setFilter('topic', joinParam(v))} options={topicOptions} />
              <select value={filters.reply || ''} onChange={(e) => setFilter('reply', e.target.value || null)}>
                <option value="">{r('filters.anyReply')}</option>
                <option value="none">{r('filters.noReply')}</option>
                <option value="replied">{r('filters.replied')}</option>
              </select>
              <select value={filters.status || ''} onChange={(e) => setFilter('status', e.target.value || null)}>
                <option value="">{r('filters.statusActive')}</option>
                <option value="deleted">{r('filters.statusDeleted')}</option>
                <option value="all">{r('filters.statusAll')}</option>
              </select>
              <select value={filters.sort || ''} onChange={(e) => setFilter('sort', e.target.value || null)}>
                <option value="">{r('sort.new')}</option>
                <option value="priority">{r('sort.priority')}</option>
                <option value="rating_asc">{r('sort.ratingAsc')}</option>
                <option value="rating_desc">{r('sort.ratingDesc')}</option>
              </select>
              {activeCount > 0 && (
                <button type="button" className="btn btn-sm" onClick={() => { setQInput(''); setParams(new URLSearchParams(), { replace: true }); }}>
                  <Ic d={HTL_ICON.x} size={12} />{r('filters.reset', { n: activeCount })}
                </button>
              )}
            </div>

            <ReviewsAgentStrip />
            <ApifyPauseBanner pause={apifyPause} />
            <AiStatusBanner status={feed?.ai} />
            <div data-tour="rv-quick" className="rp-chipbar">
              <span className={`rp-chip${filters.reply === 'none' && filters.ratingMax ? ' on' : ''}`} onClick={() => {
                const p = new URLSearchParams(params);
                const on = filters.reply === 'none' && filters.ratingMax;
                if (on) { p.delete('reply'); p.delete('ratingMax'); p.delete('ratingMin'); }
                else { p.set('reply', 'none'); p.set('ratingMax', (negBelow - 0.01).toFixed(2)); p.delete('ratingMin'); }
                setParams(p, { replace: true });
              }}>
                {r('feed.quickUrgent')} {feed ? `· ${feed.unansweredNegative}` : ''}
              </span>
              <span className={`rp-chip${filters.reply === 'none' && !filters.ratingMax ? ' on' : ''}`} onClick={() => setFilter('reply', filters.reply === 'none' && !filters.ratingMax ? null : 'none')}>
                {r('feed.quickNoReply')}
              </span>
              <span className={`rp-chip${filters.status === 'deleted' ? ' on' : ''}`} onClick={() => setFilter('status', filters.status === 'deleted' ? null : 'deleted')}>
                {r('feed.quickDeleted')}
              </span>
              {(!!feed?.duplicatesSuggested || filters.dup) && (
                <span className={`rp-chip${filters.dup === 'suggested' ? ' on' : ''}`} title={r('dup.chipHint')} onClick={() => setFilter('dup', filters.dup === 'suggested' ? null : 'suggested')}>
                  {r('dup.chip')} {feed?.duplicatesSuggested ? `· ${feed.duplicatesSuggested}` : ''}
                </span>
              )}
              <span className="rp-count">{feed ? r('feed.count', { n: feed.total }) : ''}</span>
            </div>
            {filters.dup === 'suggested' && !!feed?.duplicatesExact && (
              <div className="rp-note" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span>{r('dup.exactNote', { n: feed.duplicatesExact })}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={bulkBusy}
                  onClick={async () => {
                    if (!(await showConfirm(r('dup.exactConfirm', { n: feed.duplicatesExact })))) return;
                    setBulkBusy(true);
                    try {
                      const res = await confirmRepExactDuplicates();
                      showAlert(r('dup.exactDone', { n: res.confirmed, left: res.left }), { variant: 'success' });
                      load(false);
                    } catch (e: any) {
                      showAlert(e?.message || r('card.error'), { variant: 'error' });
                    } finally {
                      setBulkBusy(false);
                    }
                  }}
                >
                  {bulkBusy ? r('dup.exactBusy') : r('dup.exactButton', { n: feed.duplicatesExact })}
                </button>
              </div>
            )}

            <div data-tour="rv-feed" className="rp-feed">
              {feed?.items.map((x) => (
                <div
                  key={x.id}
                  className={`rp-row${x.urgent ? ' urgent' : ''}${x.status === 'deleted' ? ' deleted' : ''}`}
                  onClick={() => openReview(x.id)}
                >
                  <div className="rp-row-meta">
                    <PlatformBadge platform={x.platform} />
                    <span className="rp-row-hotel">{hotelName(x.hotelId)}</span>
                    <span className="rp-row-date">{fmtDate(x.publishedAt, lang)}</span>
                  </div>
                  <div className="rp-row-body">
                    <div className="rp-row-head">
                      <span className="rp-row-author">{x.author || r('card.anonymous')}</span>
                      {x.lang && <span className="rp-lang">{x.lang}</span>}
                      {x.status === 'edited' && <span className="rp-pill edited">{r('status.edited')}</span>}
                      {x.status === 'deleted' && <span className="rp-pill deleted">{r('status.deleted')}</span>}
                      {x.duplicateOfId ? (
                        <span className="rp-pill dup" title={r('dup.pillHint')}>{r('dup.pill')}</span>
                      ) : x.duplicateSuggested ? (
                        <span className="rp-pill dup-maybe" title={r('dup.maybeHint')}>{r('dup.maybe')}</span>
                      ) : null}
                    </div>
                    <div className={`rp-row-text${x.text ? '' : ' empty'}`}>
                      {x.title ? <b>{x.title}. </b> : null}
                      {x.text || r('card.noText')}
                    </div>
                    {x.topics.length > 0 && (
                      <div className="rp-topics">
                        {x.topics.slice(0, 6).map((tp, i) => <span key={i} className={`rp-topic ${tp.sentiment}`}>{topicLabel(tp, r, lang)}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="rp-row-right">
                    <Score rating10={x.rating10} raw={x.ratingRaw} scale={x.ratingScale} negBelow={negBelow} />
                    {(x.replyEligible || x.hasReply) && (
                      x.replyMode === 'none' ? (
                        <span className="rp-pill muted">{r('reply.notPublished')}</span>
                      ) : x.hasReply ? (
                        <span className="rp-pill replied">{r('reply.replied')}</span>
                      ) : (
                        <span className="rp-pill noreply">{r('reply.none')}</span>
                      )
                    )}
                    {x.draftReady && <span className="rp-pill draft" title={x.draftByAgent ? r('feed.draftByAgentHint') : ''}>✎ {r('feed.draftReady')}</span>}
                  </div>
                </div>
              ))}
              {feed && feed.items.length === 0 && !loading && (
                <div className="rp-empty">
                  <h4>{r('feed.emptyTitle')}</h4>
                  {activeCount > 0 ? r('feed.emptyFiltered') : r('feed.emptyText')}
                </div>
              )}
              {!feed && loading && <div className="rp-empty">{r('card.loading')}</div>}
              {feed && feed.items.length < feed.total && (
                <div className="rp-more">
                  <button type="button" className="btn" disabled={loading} onClick={() => load(true)}>
                    {loading ? r('card.loading') : r('feed.more', { n: Math.min(PAGE, feed.total - feed.items.length) })}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {params.get('review') && (
          <ReviewCardDrawer
            id={params.get('review')!}
            negBelow={negBelow}
            canWrite
            onClose={() => openReview(null)}
            onChanged={() => load(false)}
            onOpen={(rid) => openReview(rid)}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default ReviewsFeedPage;
