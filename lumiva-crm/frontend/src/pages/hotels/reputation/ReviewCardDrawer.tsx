import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { Ic, HTL_ICON } from '../HotelIcons';
import {
  draftRepReply,
  fetchRepReview,
  markRepReplied,
  reanalyzeRepReview,
  translateRepReview,
  retryRepReply,
  sendRepReply,
  type RepReviewCard,
} from '../../../api/hotelReputation';
import { PlatformBadge, Score, fmtDate, topicLabel, useRepT } from './ReputationShared';

const TONES = ['short', 'warm', 'formal'] as const;

export const ReviewCardDrawer: React.FC<{
  id: string;
  negBelow: number;
  canWrite: boolean;
  onClose: () => void;
  onChanged: () => void;
}> = ({ id, negBelow, canWrite, onClose, onChanged }) => {
  const { r, lang } = useRepT();
  const { showAlert } = useAlertModal();
  const [card, setCard] = useState<RepReviewCard | null>(null);
  const [showOriginal, setShowOriginal] = useState(true);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);

  const load = () =>
    fetchRepReview(id)
      .then((c) => {
        setCard(c);
        setDraft(c.aiDraft || '');
      })
      .catch((e) => showAlert(e.message, { variant: 'error' }));

  useEffect(() => {
    setCard(null);
    setReplyOpen(false);
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

  const genDraft = (tone?: string) =>
    run('draft', async () => {
      const d = await draftRepReply(id, tone);
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

  return (
    <>
      <div className="bk-drawer-back lv-backdrop" onClick={onClose} />
      <aside className="bk-drawer rp-drawer lv-sheet-right" role="dialog" aria-modal="true">
        <div className="bk-drawer-head">
          <div>
            <div className="kicker"><span className="dot" />{c?.hotel?.name || r('card.review')}</div>
            <h3>{c ? c.author || r('card.anonymous') : r('card.loading')}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label={r('card.close')}><Ic d={HTL_ICON.x} size={18} /></button>
        </div>
        {c && (
          <div className="bk-drawer-body">
            <div className="rp-card-top">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <PlatformBadge platform={c.platform} />
                <Score rating10={c.rating10} raw={c.ratingRaw} scale={c.ratingScale} negBelow={negBelow} />
                {c.lang && <span className="rp-lang">{c.lang}</span>}
                {c.status === 'edited' && <span className="rp-pill edited">{r('status.edited')}</span>}
                {c.status === 'deleted' && <span className="rp-pill deleted">{r('status.deleted')}</span>}
                {c.replyMode === 'none' ? (
                  <span className="rp-pill muted">{r('reply.notPublished')}</span>
                ) : c.hasReply ? (
                  <span className="rp-pill replied">{r('reply.replied')}</span>
                ) : (
                  <span className="rp-pill noreply">{r('reply.none')}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', textAlign: 'right' }}>
                {fmtDate(c.publishedAt, lang)}
                {c.travelDate && <div>{r('card.travel')}: {fmtDate(c.travelDate, lang)}</div>}
              </div>
            </div>

            <div className="rp-card-sec">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                <h4 style={{ margin: 0 }}>{r('card.text')}</h4>
                {hasTranslation && (
                  <div className="rp-switch">
                    <button type="button" className={showOriginal ? 'on' : ''} onClick={() => setShowOriginal(true)}>{r('card.original')}</button>
                    <button type="button" className={!showOriginal ? 'on' : ''} onClick={() => setShowOriginal(false)}>
                      {r('card.translation')} {c.translatedLang ? `(${c.translatedLang.toUpperCase()})` : ''}
                    </button>
                  </div>
                )}
              </div>
              {c.title && <div style={{ fontWeight: 600, marginBottom: 6 }}>{c.title}</div>}
              <div className="rp-card-text">{text || <span style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>{r('card.noText')}</span>}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {viewUrl && (
                  <a className="btn btn-sm" href={viewUrl} target="_blank" rel="noopener noreferrer">{r('card.viewOnPlatform')} ↗</a>
                )}
                {!hasTranslation && c.text && (!c.lang || !c.translateTo || c.lang !== c.translateTo) && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy === 'translate'}
                    title={r('card.translateHint')}
                    onClick={() => run('translate', async () => { setCard(await translateRepReview(id)); setShowOriginal(false); })}
                  >
                    {busy === 'translate' ? r('card.translating') : r('card.translate')}
                  </button>
                )}
                {canWrite && c.text && (
                  <button type="button" className="btn btn-sm" disabled={busy === 'reanalyze'} onClick={() => run('reanalyze', async () => setCard(await reanalyzeRepReview(id)))}>
                    {busy === 'reanalyze' ? r('card.analyzing') : r('card.reanalyze')}
                  </button>
                )}
              </div>
              {c.analysisError && <div className="rp-note warn" style={{ marginTop: 10 }}>{r('card.analysisError')}: {c.analysisError}</div>}
            </div>

            {c.subRatings && Object.keys(c.subRatings).length > 0 && (
              <div className="rp-card-sec">
                <h4>{r('card.subRatings')}</h4>
                <div className="rp-subratings">
                  {Object.entries(c.subRatings).map(([k, v]) => (
                    <div key={k} className="rp-subrating"><span>{k.replace(/_/g, ' ').toLowerCase()}</span><b>{v}</b></div>
                  ))}
                </div>
              </div>
            )}

            <div className="rp-card-sec">
              <h4>{r('card.topics')}</h4>
              {c.topics.length ? (
                <div>
                  <div className="rp-topics" style={{ marginTop: 0 }}>
                    {c.topics.map((tp, i) => (
                      <span key={i} className={`rp-topic ${tp.sentiment}`}>{topicLabel(tp, r)}</span>
                    ))}
                  </div>
                  {c.topics.filter((tp) => tp.quote).map((tp, i) => (
                    <div key={i} className={`rp-quote ${tp.sentiment}`}>«{tp.quote}»</div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--fg-4)' }}>{c.text ? (c.sentiment ? r('card.noTopics') : r('card.notAnalyzed')) : r('card.noTextNoTopics')}</div>
              )}
              {c.sentiment && (
                <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 10 }}>
                  {r('card.sentiment')}: <b style={{ color: 'var(--ink)' }}>{r(`sentiment.${c.sentiment}`)}</b>
                </div>
              )}
            </div>

            {c.versions.length > 1 && (
              <div className="rp-card-sec">
                <h4>{r('card.history')}</h4>
                <div className="rp-versions">
                  {c.versions.map((v, i) => (
                    <div key={i} className="rp-version">
                      <span className="d">{fmtDate(v.capturedAt, lang, true)}</span>
                      <Score rating10={v.rating10} negBelow={negBelow} />
                      <span className="t">{(v.text || r('card.noText')).slice(0, 400)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(c.replies.length > 0 || c.replyText) && (
              <div className="rp-card-sec">
                <h4>{r('card.hotelReplies')}</h4>
                {c.replies.map((x) => (
                  <div key={x.id} className="rp-reply-item">
                    <div className="h">
                      <span>{r(`replySource.${x.source}`)}{x.author ? ` · ${x.author}` : ''}</span>
                      <span>
                        {r(`replyStatus.${x.status}`)} · {fmtDate(x.postedAt || x.createdAt, lang, true)}
                      </span>
                    </div>
                    {x.text}
                    {x.status === 'failed' && (
                      <div style={{ marginTop: 8 }}>
                        <div className="rp-note err">{x.error}</div>
                        {canWrite && (
                          <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => run('retry', async () => setCard(await retryRepReply(x.id)))}>
                            {r('card.retry')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {c.replyMode !== 'none' && canWrite && c.status !== 'deleted' && (
              <div className="rp-card-sec rp-reply-box">
                <h4>{c.hasReply ? r('card.replyAgain') : r('card.reply')}</h4>
                {!c.reviewsAgent && (
                  <div className="rp-note" style={{ marginBottom: 10 }}>
                    {r('card.noAgent')} <Link to="/ai-employees">{r('card.hireAgent')}</Link>
                  </div>
                )}
                {!replyOpen && !draft ? (
                  <div className="rp-reply-actions" style={{ marginTop: 0 }}>
                    <button type="button" className="btn btn-primary" disabled={busy === 'draft' || !c.reviewsAgent} onClick={() => genDraft()}>
                      {busy === 'draft' ? r('card.draftingBy', { name: c.reviewsAgent?.name || '' }) : c.reviewsAgent ? r('card.aiDraftBy', { name: c.reviewsAgent.name }) : r('card.aiDraft')}
                    </button>
                    <button type="button" className="btn" onClick={() => setReplyOpen(true)}>{r('card.writeManually')}</button>
                  </div>
                ) : (
                  <>
                    {c.aiDraftBy && draft === (c.aiDraft || '') && (
                      <div className="rp-draft-by">
                        <span className="av">{c.aiDraftBy.avatarUrl ? <img src={c.aiDraftBy.avatarUrl} alt="" /> : c.aiDraftBy.name.slice(0, 1)}</span>
                        {r('card.draftPreparedBy', { name: c.aiDraftBy.name })}
                      </div>
                    )}
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={r('card.replyPlaceholder')} />
                    {c.reviewsAgent && (
                      <div className="rp-reply-actions">
                        <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{r('card.rewriteBy', { name: c.reviewsAgent.name })}:</span>
                        <div className="rp-tone">
                          {TONES.map((tone) => (
                            <button key={tone} type="button" className="btn btn-sm" disabled={!!busy} onClick={() => genDraft(r(`tone.${tone}.prompt`))}>
                              {r(`tone.${tone}.label`)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {mode === 'api' ? (
                      <div className="rp-reply-actions">
                        <button type="button" className="btn btn-primary" disabled={!draft.trim() || busy === 'send'} onClick={send}>
                          {busy === 'send' ? r('card.sending') : r('card.send', { platform: c.platform === 'google' ? 'Google' : 'HolidayCheck' })}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="rp-note" style={{ marginTop: 10 }}>{r(c.replyMode === 'api' ? (c.platform === 'google' ? 'card.googleManualHint' : 'card.hcManualHint') : 'card.externalHint')}</div>
                        <div className="rp-reply-actions">
                          <button type="button" className="btn btn-primary" disabled={!draft.trim()} onClick={copyAndOpen}>{r('card.copyOpen')}</button>
                          {!c.hasReply && (
                            <button type="button" className="btn" disabled={busy === 'mark'} onClick={() => mark(true)}>{r('card.markReplied')}</button>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
                {c.hasReply && c.replyMarkedManually && (
                  <button type="button" className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => mark(false)}>{r('card.unmarkReplied')}</button>
                )}
              </div>
            )}
            {c.replyMode === 'none' && (
              <div className="rp-card-sec"><div className="rp-note">{r('card.check24Hint')}</div></div>
            )}
          </div>
        )}
      </aside>
    </>
  );
};
