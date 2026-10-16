import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import {
  decideRepStay,
  fetchRepStayCandidates,
  dismissRepDuplicate,
  draftRepReply,
  fetchRepDuplicateCandidates,
  fetchRepReview,
  markRepDuplicate,
  markRepReplied,
  reanalyzeRepReview,
  translateRepReview,
  retryRepReply,
  sendRepReply,
  type RepDupBrief,
  type RepStay,
  type RepReviewCard,
  type RepTranslationLang,
} from '../../../api/hotelReputation';
import { fmtDate, topicLabel, useRepT, PLATFORM_META } from './ReputationShared';
import { AiCharacterMono } from '../../ai-employees/AiCharacter';
import { useNumFmt, Btn, Frame, Ico, PlatformBadge, Seg, Track, cx, scoreClass } from './rvui';

const TONES = ['short', 'warm', 'formal'] as const;
const REVIEW_TRANSLATION_LANGS = [
  ['ru', 'Русский'], ['en', 'English'], ['tr', 'Türkçe'], ['de', 'Deutsch'],
  ['fr', 'Français'], ['es', 'Español'], ['it', 'Italiano'], ['uk', 'Українська'],
  ['ar', 'العربية'], ['zh', '中文'],
] as const;
const normalizeTranslationLang = (value?: string | null): RepTranslationLang => {
  const code = value?.trim().toLowerCase();
  return REVIEW_TRANSLATION_LANGS.some(([lang]) => lang === code)
    ? (code as RepTranslationLang)
    : 'en';
};

/** Короткая строка о другом отзыве (дубликат / кандидат). */
const DupLine: React.FC<{ d: RepDupBrief; negBelow: number; onOpen?: (id: string) => void }> = ({ d, negBelow, onOpen }) => {
  const { r, lang } = useRepT();
  const num = useNumFmt();
  return (
    <div>
      <div className="meta">
        <PlatformBadge p={d.platform} />
        <span>{d.author || r('card.anonymous')}</span>
        <span>{fmtDate(d.publishedAt, lang)}</span>
        <b className={`num rv-score`} style={{ fontSize: 15 }}><span className={scoreClass(d.rating10, negBelow)}>{num(d.rating10, 1)}</span></b>
        {onOpen && <a href="#" onClick={(e) => { e.preventDefault(); onOpen(d.id); }}>{r('dup.open')} →</a>}
      </div>
      <div className="ex">{d.excerpt || r('card.noText')}</div>
    </div>
  );
};

/**
 * Дубликаты: система нашла похожий отзыв на другой площадке → человек подтверждает или отклоняет.
 * Дубликат не считается в аналитике повторно, ответ на своей площадке ему всё равно нужен.
 */
const DuplicatesSection: React.FC<{ card: RepReviewCard; canWrite: boolean; negBelow: number; onCard: (c: RepReviewCard) => void; onOpen?: (id: string) => void }> = ({ card, canWrite, negBelow, onCard, onOpen }) => {
  const { r } = useRepT();
  const { showAlert } = useAlertModal();
  const [busy, setBusy] = useState<string | null>(null);
  const [manual, setManual] = useState<Array<{ score: number; reason: string; review: RepDupBrief }> | null>(null);
  const info = card.duplicates;
  useEffect(() => setManual(null), [card.id]);
  if (!info) return null;
  const act = async (key: string, fn: () => Promise<RepReviewCard>, ok?: string) => {
    setBusy(key);
    try {
      onCard(await fn());
      if (ok) showAlert(ok, { variant: 'success' });
    } catch (e: any) {
      showAlert(e?.message || r('card.error'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };
  const nothing = !info.of && !info.duplicates.length && !info.suggestions.length;
  if (nothing && !canWrite) return null;
  return (
    <div className="rv-sec">
      <div className="rv-sec-h"><h4>{r('dup.title')}</h4></div>
      {info.of && (
        <div className="rv-dup">
          <div>
            <div className="why">{r('dup.isDuplicateOf')}</div>
            <DupLine d={info.of} negBelow={negBelow} onOpen={onOpen} />
          </div>
          {canWrite && (
            <div className="acts">
              <button type="button" className="rb sm" disabled={!!busy} onClick={() => act('unmark', () => markRepDuplicate(card.id, null), r('dup.unmarked'))}>{r('dup.unmark')}</button>
            </div>
          )}
        </div>
      )}
      {info.duplicates.map((d) => (
        <div key={d.id} className="rv-dup">
          <div>
            <div className="why">{r('dup.hasDuplicate')}</div>
            <DupLine d={d} negBelow={negBelow} onOpen={onOpen} />
          </div>
        </div>
      ))}
      {!info.of && info.suggestions.map((sg) => (
        <div key={sg.pairId} className="rv-dup">
          <div>
            <div className="why">{r(`dup.reason.${sg.reason}`)} · {r('dup.similarity', { p: Math.round(sg.score * 100) })}</div>
            <DupLine d={sg.review} negBelow={negBelow} onOpen={onOpen} />
          </div>
          {canWrite && (
            <div className="acts">
              <button type="button" className="rb sm pri" disabled={!!busy} onClick={() => act(`m${sg.pairId}`, () => markRepDuplicate(card.id, sg.review.id), r('dup.marked'))}>{r('dup.confirm')}</button>
              <button type="button" className="rb sm" disabled={!!busy} onClick={() => act(`d${sg.pairId}`, () => dismissRepDuplicate(sg.pairId, card.id))}>{r('dup.dismiss')}</button>
            </div>
          )}
        </div>
      ))}
      {nothing && <div style={{ fontSize: 12.5, color: 'var(--n5)' }}>{r('dup.none')}</div>}
      {canWrite && !info.of && (
        <>
          {manual == null ? (
            <button
              type="button"
              className="rb sm"
              style={{ marginTop: 8 }}
              disabled={busy === 'find'}
              onClick={async () => {
                setBusy('find');
                try {
                  setManual(await fetchRepDuplicateCandidates(card.id));
                } catch (e: any) {
                  showAlert(e?.message || r('card.error'), { variant: 'error' });
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === 'find' ? r('card.loading') : r('dup.findManual')}
            </button>
          ) : (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--n7)' }}>{r('dup.manualHint')}</div>
              {!manual.length && <div style={{ fontSize: 12.5, color: 'var(--n5)', marginTop: 6 }}>{r('dup.manualNone')}</div>}
              {manual.filter((m) => !info.suggestions.some((sg) => sg.review.id === m.review.id)).map((m) => (
                <div key={m.review.id} className="rv-dup">
                  <DupLine d={m.review} negBelow={negBelow} onOpen={onOpen} />
                  <div className="acts">
                    <button type="button" className="rb sm" disabled={!!busy} onClick={() => act(`x${m.review.id}`, () => markRepDuplicate(card.id, m.review.id), r('dup.marked'))}>{r('dup.confirm')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

/**
 * Бронь гостя (модуль «Отели»): номер и даты проживания. Уверенные совпадения система связывает сама,
 * «Maria K.» — предлагает, остальное — ручной выбор. Блок есть только если у клиента включены брони.
 */
const StaySection: React.FC<{ card: RepReviewCard; canWrite: boolean; onCard: (c: RepReviewCard) => void }> = ({ card, canWrite, onCard }) => {
  const { r, lang } = useRepT();
  const { showAlert } = useAlertModal();
  const [busy, setBusy] = useState<string | null>(null);
  const [cands, setCands] = useState<RepStay[] | null>(null);
  useEffect(() => setCands(null), [card.id]);
  const info = card.stay;
  if (!info) return null;
  const res = info.reservation;
  const act = async (key: string, fn: () => Promise<RepReviewCard>) => {
    setBusy(key);
    try {
      onCard(await fn());
      setCands(null);
    } catch (e: any) {
      showAlert(e?.message || r('card.error'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };
  const line = (x: RepStay) => (
    <>
      <b>{x.room ? `№ ${x.room}` : x.roomType || r('stay.noRoom')}</b>
      {x.room && x.roomType ? <span style={{ color: 'var(--fg-3)' }}> · {x.roomType}</span> : null}
      <span> · {fmtDate(x.checkIn, lang)} — {fmtDate(x.checkOut, lang)}</span>
      <span style={{ color: 'var(--fg-3)' }}> · {x.guestName}{x.bookingCode ? ` · ${x.bookingCode}` : ''}</span>
    </>
  );
  return (
    <div className="rv-sec">
      <div className="rv-sec-h"><h4>{r('stay.title')}</h4><span className="sp" />{res && <span className={cx('rv-pill', info.match === 'suggested' ? 'draft' : 'replied')}>{r(`stay.match.${info.match || 'auto'}`)}</span>}</div>
      {res ? (
        <>
          <div className="rv-stay">
            <div><span className="l">{r('rv.card.booking')}</span><Link to={`/hotels/reservations?reservation=${res.id}`}>{res.bookingCode || res.guestName}</Link></div>
            <div><span className="l">{r('rv.card.room')}</span>{res.room ? `№ ${res.room}` : r('stay.noRoom')}{res.roomType ? ` · ${res.roomType}` : ''}</div>
            <div><span className="l">{r('rv.card.dates')}</span>{fmtDate(res.checkIn, lang)} – {fmtDate(res.checkOut, lang)}</div>
          </div>
          {canWrite && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {info.match === 'suggested' && <button type="button" className="rb sm pri" disabled={!!busy} onClick={() => act('c', () => decideRepStay(card.id, 'confirm'))}>{r('stay.confirm')}</button>}
              <button type="button" className="rb sm" disabled={!!busy} onClick={() => act('u', () => decideRepStay(card.id, info.match === 'suggested' ? 'reject' : 'unlink'))}>
                {info.match === 'suggested' ? r('stay.reject') : r('stay.unlink')}
              </button>
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 12.5, color: 'var(--n5)' }}>{info.match === 'rejected' ? r('stay.rejected') : r('stay.none')}</div>
      )}
      {canWrite && !res && (
        cands == null ? (
          <button
            type="button"
            className="rb sm"
            style={{ marginTop: 8 }}
            disabled={busy === 'find'}
            onClick={async () => {
              setBusy('find');
              try {
                setCands(await fetchRepStayCandidates(card.id));
              } catch (e: any) {
                showAlert(e?.message || r('card.error'), { variant: 'error' });
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === 'find' ? r('card.loading') : r('stay.find')}
          </button>
        ) : (
          <div style={{ marginTop: 8 }}>
            {!cands.length && <div style={{ fontSize: 12.5, color: 'var(--n5)' }}>{r('stay.noCandidates')}</div>}
            {cands.map((x) => (
              <div key={x.id} className="rv-dup">
                <div style={{ fontSize: 12.5 }}>
                  <div className="why">{r(`stay.strength.${x.match || 'initial'}`)}</div>
                  {line(x)}
                </div>
                <div className="acts">
                  <button type="button" className="rb sm" disabled={!!busy} onClick={() => act(`l${x.id}`, () => decideRepStay(card.id, 'link', x.id))}>{r('stay.link')}</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export const ReviewCardDrawer: React.FC<{
  id: string;
  negBelow: number;
  canWrite: boolean;
  onClose: () => void;
  onChanged: () => void;
  /** Открыть другой отзыв в этой же карточке (дубликат на другой площадке). */
  onOpen?: (id: string) => void;
}> = ({ id, negBelow, canWrite, onClose, onChanged, onOpen }) => {
  const { r, lang } = useRepT();
  const num = useNumFmt();
  const { showAlert } = useAlertModal();
  const [card, setCard] = useState<RepReviewCard | null>(null);
  const [showOriginal, setShowOriginal] = useState(true);
  const [translationLang, setTranslationLang] = useState<RepTranslationLang>('en');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [tone, setTone] = useState<(typeof TONES)[number] | ''>('');

  const load = () =>
    fetchRepReview(id)
      .then((c) => {
        setCard(c);
        setDraft(c.aiDraft || '');
        setReplyOpen(!!c.aiDraft);
        const currentLang = c.translatedLang || (c.lang?.slice(0, 2).toLowerCase() === 'ru' ? 'en' : 'ru');
        setTranslationLang(normalizeTranslationLang(currentLang));
      })
      .catch((e) => showAlert(e.message, { variant: 'error' }));

  useEffect(() => {
    setCard(null);
    setReplyOpen(false);
    setTone('');
    setShowOriginal(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (name: string, fn: () => Promise<unknown>, okMsg?: string) => {
    setBusy(name);
    try {
      await fn();
      if (okMsg) showAlert(okMsg, { variant: 'success' });
    } catch (e: any) {
      showAlert(e?.message || r('card.error'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const genDraft = (prompt?: string) =>
    run('draft', async () => {
      const d = await draftRepReply(id, prompt);
      setDraft(d.aiDraft);
      setReplyOpen(true);
      setCard(await fetchRepReview(id));
    });

  const send = () =>
    run(
      'send',
      async () => {
        const c = await sendRepReply(id, draft);
        setCard(c);
        onChanged();
      },
      r('card.replyQueued'),
    );

  const copyAndOpen = () =>
    run('copy', async () => {
      try {
        await navigator.clipboard.writeText(draft);
      } catch {
        /* буфер недоступен — пользователь скопирует сам */
      }
      const url = card?.reviewUrl || card?.sourceUrl || card?.replyHome;
      if (url) window.open(url, '_blank', 'noopener');
      showAlert(r('card.copied'), { variant: 'success' });
    });

  const mark = (replied: boolean) =>
    run('mark', async () => {
      const c = await markRepReplied(id, replied, replied ? draft : undefined);
      setCard(c);
      onChanged();
    });

  const c = card;
  const hasTranslation = !!c?.textTranslated;
  const text = c ? (showOriginal || !hasTranslation ? c.text : c.textTranslated) : null;
  const viewUrl = c?.reviewUrl || c?.sourceUrl;
  /** Без подключённого API (Google, HolidayCheck) отвечаем как на остальных площадках: черновик → площадка → отметка. */
  const mode = c ? (c.replyMode === 'api' && !c.replyApiReady ? 'external' : c.replyMode) : 'none';
  const subScale = c?.ratingScale && c.ratingScale > 0 ? c.ratingScale : 10;
  const country = (() => {
    if (!c?.authorCountry) return null;
    try {
      return new Intl.DisplayNames([lang.slice(0, 2)], { type: 'region' }).of(c.authorCountry) || c.authorCountry;
    } catch {
      return c.authorCountry;
    }
  })();
  const agentName = c?.reviewsAgent?.name;

  return (
    <>
      <div className="rv-scrim" onClick={onClose} />
      <aside className="rv-drawer" role="dialog" aria-modal="true" aria-label={r('card.review')}>
        <div className="rv-dr-head">
          <div>
            <div className="kick rv-kick"><span className="dot" />{c?.hotel?.name || r('card.review')}</div>
            <h3>{c ? c.author || r('card.anonymous') : r('card.loading')}</h3>
          </div>
          <span className="x"><Btn gh sm icon="x" onClick={onClose} aria-label={r('card.close')} /></span>
        </div>
        {c && (
          <div className="rv-dr-body">
            <div className="rv-dr-top">
              <Frame className="rv-dr-big">
                <span className="num rv-score"><b className={scoreClass(c.rating10, negBelow)} style={{ fontSize: 44 }}>{num(c.rating10, 1)}</b></span>
                {c.ratingRaw != null && c.ratingScale ? <small>{r('rv.card.onPlatform', { v: `${c.ratingRaw}/${c.ratingScale}` })}</small> : null}
              </Frame>
              <div>
                <div className="rv-dr-facts">
                  <div><span className="l">{r('rv.card.platform')}</span><PlatformBadge p={c.platform} /></div>
                  <div><span className="l">{r('rv.card.published')}</span>{fmtDate(c.publishedAt, lang)}{c.travelDate ? <span style={{ color: 'var(--n7)' }}> · {r('card.travel')} {fmtDate(c.travelDate, lang)}</span> : null}</div>
                  <div><span className="l">{r('rv.card.countryLang')}</span>{[country, (c.lang || '').toUpperCase()].filter(Boolean).join(' · ') || '—'}</div>
                  <div><span className="l">{r('card.sentiment')}</span>{c.sentiment ? r(`sentiment.${c.sentiment}`) : r('rv.card.notAnalyzed')}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {c.status === 'edited' && <span className="rv-pill">{r('status.edited')}</span>}
                  {c.status === 'deleted' && <span className="rv-pill del">{r('status.deleted')}</span>}
                  {(c.replyEligible || c.hasReply) &&
                    (c.replyMode === 'none' ? (
                      <span className="rv-pill">{r('reply.notPublished')}</span>
                    ) : c.hasReply ? (
                      <span className="rv-pill replied"><Ico n="check" s={11} />{r('reply.replied')}</span>
                    ) : (
                      <span className="rv-pill noreply">{r('reply.none')}</span>
                    ))}
                </div>
              </div>
            </div>

            <div className="rv-sec">
              <div className="rv-sec-h">
                <h4>{r('card.text')}</h4>
                <span className="sp" />
                {hasTranslation && (
                  <Seg
                    value={showOriginal ? 'o' : 't'}
                    onChange={(v) => setShowOriginal(v === 'o')}
                    opts={[['o', r('card.original')], ['t', `${r('card.translation')}${c.translatedLang ? ` (${c.translatedLang.toUpperCase()})` : ''}`]]}
                  />
                )}
              </div>
              <div className="rv-text" key={showOriginal ? 'o' : 't'} style={{ animation: 'rvFade .3s' }}>
                {c.title && <b>{c.title}. </b>}
                {text || <span style={{ color: 'var(--n5)', fontStyle: 'italic' }}>{r('card.noText')}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                {viewUrl && (
                  <a className="rb sm" href={viewUrl} target="_blank" rel="noopener noreferrer"><Ico n="ext" s={13} />{r('card.viewOnPlatform')}</a>
                )}
                {c.text && (
                  <>
                    <select
                      className="rv-in"
                      style={{ width: 'auto', height: 28, fontSize: 12 }}
                      aria-label={r('card.translateLanguage')}
                      value={translationLang}
                      disabled={busy === 'translate'}
                      onChange={(e) => {
                        const nextLang = normalizeTranslationLang(e.target.value);
                        setTranslationLang(nextLang);
                        if (nextLang !== c.translatedLang) setShowOriginal(true);
                      }}
                    >
                      {REVIEW_TRANSLATION_LANGS.map(([code, label]) => (
                        <option key={code} value={code} disabled={c.lang?.slice(0, 2).toLowerCase() === code}>{label}</option>
                      ))}
                    </select>
                    <Btn
                      sm
                      icon="translate"
                      disabled={busy === 'translate' || c.lang?.slice(0, 2).toLowerCase() === translationLang}
                      title={r('card.translateHint')}
                      onClick={() => run('translate', async () => { setCard(await translateRepReview(id, translationLang)); setShowOriginal(false); })}
                    >
                      {busy === 'translate' ? r('card.translating') : r('card.translate')}
                    </Btn>
                  </>
                )}
                {canWrite && c.text && (
                  <Btn sm gh icon="refresh" disabled={busy === 'reanalyze'} onClick={() => run('reanalyze', async () => setCard(await reanalyzeRepReview(id)))}>
                    {busy === 'reanalyze' ? r('card.analyzing') : r('card.reanalyze')}
                  </Btn>
                )}
              </div>
              {c.analysisError && <div className="rv-note warn" style={{ marginTop: 10 }}>{r('card.analysisError')}: {c.analysisError}</div>}
            </div>

            {c.subRatings && Object.keys(c.subRatings).length > 0 && (
              <div className="rv-sec">
                <div className="rv-sec-h"><h4>{r('card.subRatings')}</h4></div>
                <div className="rv-subr">
                  {Object.entries(c.subRatings).map(([k, v]) => {
                    const v10 = (Number(v) / subScale) * 10;
                    return (
                      <div key={k}>
                        <span style={{ textTransform: 'capitalize' }}>{k.replace(/_/g, ' ').toLowerCase()}</span>
                        <Track pct={(Number(v) / subScale) * 100} color={v10 < negBelow ? 'var(--neg)' : v10 < 8 ? 'var(--mid)' : 'var(--pos)'} />
                        <b className="num" style={{ textAlign: 'right' }}>{v}</b>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rv-sec">
              <div className="rv-sec-h"><h4>{r('card.topics')}</h4><span className="sp" />{c.sentiment && <span style={{ fontSize: 11.5, color: 'var(--n7)' }}>{r('rv.card.byAi')}</span>}</div>
              {c.topics.length ? (
                <>
                  <div className="rv-topics" style={{ marginTop: 0 }}>
                    {c.topics.map((tp, i) => <span key={i} className={`rv-topic ${tp.sentiment}`}>{topicLabel(tp, r, lang)}</span>)}
                  </div>
                  {c.topics.filter((tp) => tp.quote).map((tp, i) => (
                    <div key={i} style={{ fontSize: 12.5, color: tp.sentiment === 'negative' ? 'var(--neg)' : tp.sentiment === 'positive' ? 'var(--pos)' : 'var(--n7)', marginTop: 8, paddingLeft: 10, borderLeft: '2px solid currentColor' }}>«{tp.quote}»</div>
                  ))}
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--n5)' }}>{c.text ? (c.sentiment ? r('card.noTopics') : r('card.notAnalyzed')) : r('card.noTextNoTopics')}</div>
              )}
            </div>

            <StaySection card={c} canWrite={canWrite} onCard={(next) => { setCard(next); onChanged(); }} />

            <DuplicatesSection card={c} canWrite={canWrite} negBelow={negBelow} onCard={(next) => { setCard(next); onChanged(); }} onOpen={onOpen} />

            {c.versions.length > 1 && (
              <div className="rv-sec">
                <div className="rv-sec-h"><h4>{r('card.history')}</h4></div>
                <div className="rv-hist">
                  {c.versions.map((v, i) => (
                    <div key={i}>
                      <span className="d">{fmtDate(v.capturedAt, lang, true)}</span>
                      <span>{(v.text || r('card.noText')).slice(0, 400)}</span>
                      <b className={`num ${scoreClass(v.rating10, negBelow)}`} style={{ color: v.rating10 == null ? 'var(--n5)' : v.rating10 < negBelow ? 'var(--neg)' : v.rating10 < 8 ? 'var(--mid)' : 'var(--pos)' }}>{num(v.rating10, 1)}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(c.replies.length > 0 || c.replyText) && (
              <div className="rv-sec">
                <div className="rv-sec-h"><h4>{r('card.hotelReplies')}</h4></div>
                {c.replies.map((x) => (
                  <div key={x.id} className="rv-reply">
                    <div className="m">
                      <span className={cx('rv-pill', x.status === 'failed' ? 'noreply' : x.status === 'published' || x.status === 'sent' ? 'replied' : 'draft')}>{r(`replyStatus.${x.status}`)}</span>
                      <span>{r(`replySource.${x.source}`)}{x.author ? ` · ${x.author}` : ''}</span>
                      <span>{fmtDate(x.postedAt || x.createdAt, lang, true)}</span>
                    </div>
                    {x.text}
                    {x.status === 'failed' && (
                      <div style={{ marginTop: 8 }}>
                        <div className="rv-note err">{x.error}</div>
                        {canWrite && <Btn sm style={{ marginTop: 8 }} onClick={() => run('retry', async () => setCard(await retryRepReply(x.id)))}>{r('card.retry')}</Btn>}
                      </div>
                    )}
                  </div>
                ))}
                {!c.replies.length && c.replyText && <div className="rv-reply">{c.replyText}</div>}
              </div>
            )}

            {c.replyEligible && c.replyMode !== 'none' && canWrite && c.status !== 'deleted' && (
              <div className="rv-sec">
                <div className="rv-sec-h">
                  <h4>{c.hasReply ? r('card.replyAgain') : r('card.reply')}</h4>
                  <span className="sp" />
                  {replyOpen && c.reviewsAgent && (
                    <Seg
                      value={tone}
                      onChange={(k) => {
                        setTone(k as (typeof TONES)[number]);
                        genDraft(r(`tone.${k}.prompt`));
                      }}
                      opts={TONES.map((k) => [k, r(`tone.${k}.label`)])}
                    />
                  )}
                </div>
                {!c.reviewsAgent && (
                  <div className="rv-note" style={{ marginBottom: 10 }}>
                    {r('card.noAgent')} <Link to="/ai-employees">{r('card.hireAgent')}</Link>
                  </div>
                )}
                {!replyOpen && !draft ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn pri icon="sparkle" disabled={busy === 'draft' || !c.reviewsAgent} onClick={() => genDraft()}>
                      {busy === 'draft' ? r('card.draftingBy', { name: agentName || '' }) : agentName ? r('card.aiDraftBy', { name: agentName }) : r('card.aiDraft')}
                    </Btn>
                    <Btn onClick={() => setReplyOpen(true)}>{r('card.writeManually')}</Btn>
                  </div>
                ) : (
                  <div className="rv-compose">
                    {(c.reviewsAgent || c.aiDraftBy) && (
                      <div className="rv-compose-by">
                        <AiCharacterMono role="reviews_manager" size={22} />
                        {busy === 'draft'
                          ? r('card.draftingBy', { name: agentName || '' })
                          : c.aiDraftBy && draft === (c.aiDraft || '')
                            ? r('card.draftPreparedBy', { name: c.aiDraftBy.name })
                            : agentName ? r('rv.card.editable', { name: agentName }) : r('card.writeManually')}
                      </div>
                    )}
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={r('card.replyPlaceholder')} disabled={busy === 'draft'} />
                    <div className="rv-compose-f">
                      <span style={{ fontSize: 11.5, color: 'var(--n7)' }}>{r('rv.card.chars', { n: draft.length, lang: (c.lang || '—').toUpperCase() })}</span>
                      <span className="sp" />
                      {mode === 'api' ? (
                        <Btn pri icon="send" disabled={!draft.trim() || busy === 'send' || busy === 'draft'} onClick={send}>
                          {busy === 'send' ? r('card.sending') : r('card.send', { platform: PLATFORM_META[c.platform]?.label || c.platform })}
                        </Btn>
                      ) : (
                        <>
                          <Btn icon="copy" disabled={!draft.trim() || busy === 'draft'} onClick={copyAndOpen}>{r('card.copyOpen')}</Btn>
                          {!c.hasReply && <Btn pri disabled={busy === 'mark' || busy === 'draft'} onClick={() => mark(true)}>{r('card.markReplied')}</Btn>}
                        </>
                      )}
                    </div>
                  </div>
                )}
                {replyOpen && mode !== 'api' && (
                  <div className="rv-note" style={{ marginTop: 10 }}>{r(c.replyMode === 'api' ? (c.platform === 'google' ? 'card.googleManualHint' : 'card.hcManualHint') : 'card.externalHint')}</div>
                )}
                {c.hasReply && c.replyMarkedManually && (
                  <div className="rv-note" style={{ marginTop: 10 }}>
                    <span className="rv-pill replied"><Ico n="check" s={11} />{r('reply.replied')}</span>
                    <span className="sp" />
                    <Btn sm gh onClick={() => mark(false)}>{r('card.unmarkReplied')}</Btn>
                  </div>
                )}
              </div>
            )}
            {c.replyMode === 'none' && (
              <div className="rv-sec"><div className="rv-note">{r('card.check24Hint')}</div></div>
            )}
          </div>
        )}
      </aside>
    </>
  );
};
