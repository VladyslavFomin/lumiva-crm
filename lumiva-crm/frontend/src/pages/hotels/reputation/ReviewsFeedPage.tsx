import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
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
import { AiStatusBanner, ApifyPauseBanner, PLATFORM_META, TOPIC_KEYS, fmtDate, topicLabel, useRepT } from './ReputationShared';
import { AgentStrip, Btn, Ico, PlatformBadge, RvHead, RvTabs, Score, Sel, cx } from './rvui';
import { ReviewCardDrawer } from './ReviewCardDrawer';
import { DateRangePicker, fromIsoDate, lastDays, toIsoDate } from '../../../components/ui/DateRangePicker';
import { joinParam, splitParam } from './RepMultiSelect';
import type { RepReviewRow } from '../../../api/hotelReputation';
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

  const set1 = (k: string, v: string[]) => setFilter(k, v[0] || null);
  const ratingValue = filters.ratingMin || filters.ratingMax ? `${filters.ratingMin || ''}-${filters.ratingMax || ''}` : '';
  const negMax = (negBelow - 0.01).toFixed(2);
  const ratingOpts = [
    { value: `-${negMax}`, label: r('filters.negative', { n: negBelow }) },
    { value: `${negBelow}-7.99`, label: r('filters.middle', { a: negBelow, b: 8 }) },
    { value: '8-', label: r('filters.positive') },
  ];
  const setRating = (v: string[]) => {
    const [mn, mx] = (v[0] || '-').split('-');
    const p = new URLSearchParams(params);
    mn ? p.set('ratingMin', mn) : p.delete('ratingMin');
    mx ? p.set('ratingMax', mx) : p.delete('ratingMax');
    p.delete('review');
    setParams(p, { replace: true });
  };
  const quickUrgent = filters.reply === 'none' && !!filters.ratingMax;
  const toggleQuick = (k: 'urgent' | 'noreply' | 'deleted' | 'dup') => {
    const p = new URLSearchParams(params);
    p.delete('review');
    if (k === 'urgent') {
      if (quickUrgent) { p.delete('reply'); p.delete('ratingMax'); p.delete('ratingMin'); }
      else { p.set('reply', 'none'); p.set('ratingMax', negMax); p.delete('ratingMin'); }
    } else if (k === 'noreply') {
      if (filters.reply === 'none' && !filters.ratingMax) p.delete('reply');
      else { p.set('reply', 'none'); p.delete('ratingMax'); p.delete('ratingMin'); }
    } else if (k === 'deleted') {
      filters.status === 'deleted' ? p.delete('status') : p.set('status', 'deleted');
    } else filters.dup === 'suggested' ? p.delete('dup') : p.set('dup', 'suggested');
    setParams(p, { replace: true });
  };
  const Q = (k: 'urgent' | 'noreply' | 'deleted' | 'dup', label: string, on: boolean, n?: number | null, hot?: boolean) => (
    <button type="button" className={cx('rv-chip', on && 'on', hot && 'hot')} onClick={() => toggleQuick(k)}>
      {label}
      {n != null && <span className="n">· {n}</span>}
    </button>
  );
  const replyPills = (x: RepReviewRow) => (
    <>
      {(x.replyEligible || x.hasReply) &&
        (x.replyMode === 'none' ? (
          <span className="rv-pill">{r('reply.notPublished')}</span>
        ) : x.hasReply ? (
          <span className="rv-pill replied"><Ico n="check" s={11} />{r('reply.replied')}</span>
        ) : (
          <span className="rv-pill noreply">{r('reply.none')}</span>
        ))}
      {x.draftReady && <span className="rv-pill draft" title={x.draftByAgent ? r('feed.draftByAgentHint') : ''}><Ico n="pen" s={11} />{r('feed.draftReady')}</span>}
    </>
  );

  return (
    <MainLayout>
      <PageHelpButton topic="hotelReviews" />
      <div className="px-scope">
        <HotelsSubnav active="reviews" />
        <div className="rv">
          <RvHead title={r('feed.title')} sub={r('feed.subtitle')}>
            <Btn icon="settings" data-tour="rv-setup" onClick={() => navigate('/hotels/reviews/settings')}>{r('feed.setup')}</Btn>
          </RvHead>
          <RvTabs active="feed" urgent={feed?.unansweredNegative} />

          {noSources ? (
            <div className="rv-view">
              <div className="rv-empty">
                <h4>{r('feed.emptySetupTitle')}</h4>
                <p style={{ margin: '0 0 14px' }}>{r('feed.emptySetupText')}</p>
                <Btn pri onClick={() => navigate('/hotels/reviews/settings')}>{r('feed.setup')}</Btn>
              </div>
            </div>
          ) : (
            <div className="rv-view">
              <div data-tour="rv-filters" className="rv-filters">
                <label className="rv-search">
                  <Ico n="search" s={14} />
                  <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder={r('feed.search')} />
                </label>
                {(setup?.brands.length || 0) > 0 && (
                  <Sel allLabel={r('filters.allBrands')} value={selBrands} onChange={setBrands} options={(setup?.brands || []).map((b) => ({ value: b.id, label: b.name }))} />
                )}
                <Sel allLabel={r('filters.allHotels')} value={selHotels} onChange={(v) => setFilter('hotelId', joinParam(v))} options={hotelsInBrand.map((h) => ({ value: h.id, label: h.name }))} />
                <Sel
                  allLabel={r('filters.allPlatforms')}
                  value={splitParam(filters.platform)}
                  onChange={(v) => setFilter('platform', joinParam(v))}
                  options={REP_PLATFORMS.map((p) => ({ value: p, label: PLATFORM_META[p].label, icon: <PlatformBadge p={p} compact /> }))}
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
                <Sel single allLabel={r('filters.anyRating')} value={ratingValue ? [ratingValue] : []} onChange={setRating} options={ratingOpts} />
                <Sel allLabel={r('filters.allTopics')} value={splitParam(filters.topic)} onChange={(v) => setFilter('topic', joinParam(v))} options={topicOptions} />
                {langs.length > 0 && (
                  <Sel single allLabel={r('filters.allLanguages')} value={filters.lang ? [filters.lang] : []} onChange={(v) => set1('lang', v)} options={langs.map((l) => ({ value: l.lang, label: `${l.lang.toUpperCase()} · ${l.n}` }))} />
                )}
                <Sel single allLabel={r('filters.anyReply')} value={filters.reply ? [filters.reply] : []} onChange={(v) => set1('reply', v)} options={[{ value: 'none', label: r('filters.noReply') }, { value: 'replied', label: r('filters.replied') }]} />
                <Sel single allLabel={r('filters.statusActive')} value={filters.status ? [filters.status] : []} onChange={(v) => set1('status', v)} options={[{ value: 'deleted', label: r('filters.statusDeleted') }, { value: 'all', label: r('filters.statusAll') }]} />
                <Sel single allLabel={r('sort.new')} value={filters.sort ? [filters.sort] : []} onChange={(v) => set1('sort', v)} options={[{ value: 'priority', label: r('sort.priority') }, { value: 'rating_asc', label: r('sort.ratingAsc') }, { value: 'rating_desc', label: r('sort.ratingDesc') }]} />
                {activeCount > 0 && (
                  <Btn sm gh icon="x" onClick={() => { setQInput(''); setParams(new URLSearchParams(), { replace: true }); }}>{r('filters.reset', { n: activeCount })}</Btn>
                )}
              </div>

              <AgentStrip />
              <ApifyPauseBanner pause={apifyPause} />
              <AiStatusBanner status={feed?.ai} />

              <div data-tour="rv-quick" className="rv-chips">
                {Q('urgent', r('feed.quickUrgent'), quickUrgent, feed?.unansweredNegative ?? null, true)}
                {Q('noreply', r('feed.quickNoReply'), filters.reply === 'none' && !filters.ratingMax)}
                {(!!feed?.duplicatesSuggested || filters.dup) && Q('dup', r('dup.chip'), filters.dup === 'suggested', feed?.duplicatesSuggested ?? null)}
                {Q('deleted', r('feed.quickDeleted'), filters.status === 'deleted')}
                <span className="rv-count">{feed ? r('feed.count', { n: feed.total }) : ''}</span>
              </div>

              {filters.dup === 'suggested' && !!feed?.duplicatesExact && (
                <div className="rv-note acc" style={{ marginBottom: 12 }}>
                  <span>{r('dup.exactNote', { n: feed.duplicatesExact })}</span>
                  <span className="sp" />
                  <Btn
                    sm
                    pri
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
                  </Btn>
                </div>
              )}

              <div data-tour="rv-feed" className="rv-feed">
                {feed?.items.map((x, i) => (
                  <div
                    key={x.id}
                    className={cx('rv-row', 'rv-st', x.urgent && 'urgent', x.status === 'deleted' && 'deleted', params.get('review') === x.id && 'sel')}
                    style={{ '--i': Math.min(i, 12) } as React.CSSProperties}
                    onClick={() => openReview(x.id)}
                  >
                    <div className="rv-row-meta">
                      <PlatformBadge p={x.platform} />
                      <span className="ho">{hotelName(x.hotelId)}</span>
                      <span>{fmtDate(x.publishedAt, lang)}</span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="rv-row-head">
                        <span className="rv-row-author">{x.author || r('card.anonymous')}</span>
                        {x.lang && <span className="rv-lang">{x.lang}</span>}
                        {x.status === 'edited' && <span className="rv-pill">{r('status.edited')}</span>}
                        {x.status === 'deleted' && <span className="rv-pill del">{r('status.deleted')}</span>}
                        {x.duplicateOfId ? (
                          <span className="rv-pill dupok" title={r('dup.pillHint')}>{r('dup.pill')}</span>
                        ) : x.duplicateSuggested ? (
                          <span className="rv-pill dup" title={r('dup.maybeHint')}>{r('dup.maybe')}</span>
                        ) : null}
                      </div>
                      <div className={cx('rv-row-text', !x.text && 'empty')}>
                        {x.title ? <b>{x.title}. </b> : null}
                        {x.text || r('card.noText')}
                      </div>
                      {x.topics.length > 0 && (
                        <div className="rv-topics">
                          {x.topics.slice(0, 6).map((tp, k) => <span key={k} className={`rv-topic ${tp.sentiment}`}>{topicLabel(tp, r, lang)}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="rv-row-right">
                      <Score v={x.rating10} raw={x.ratingRaw} scale={x.ratingScale} nb={negBelow} />
                      {replyPills(x)}
                    </div>
                  </div>
                ))}
                {feed && feed.items.length === 0 && !loading && (
                  <div className="rv-empty">
                    <h4>{r('feed.emptyTitle')}</h4>
                    {activeCount > 0 ? r('feed.emptyFiltered') : r('feed.emptyText')}
                  </div>
                )}
                {!feed && loading && <div className="rv-empty">{r('card.loading')}</div>}
                {feed && feed.items.length < feed.total && (
                  <div className="rv-more">
                    <Btn disabled={loading} onClick={() => load(true)}>
                      {loading ? r('card.loading') : r('feed.more', { n: Math.min(PAGE, feed.total - feed.items.length) })}
                    </Btn>
                  </div>
                )}
              </div>
            </div>
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
      </div>
    </MainLayout>
  );
};

export default ReviewsFeedPage;
