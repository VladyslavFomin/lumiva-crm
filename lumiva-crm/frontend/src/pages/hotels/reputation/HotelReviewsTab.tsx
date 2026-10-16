import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchRepFeed, fetchRepHotelSummary, fetchRepHotelTasks, type RepFeed, type RepHotelSummary, type RepHotelTasks } from '../../../api/hotelReputation';
import { fmtDate, fmtHours, fmtRepIndex, topicLabel, useRepT } from './ReputationShared';
import { Btn, CardHead, CountUp, Delta, Frame, Ico, PlatformBadge, Score, cx, useNumFmt } from './rvui';
import './reputation.css';

/** Вкладка «Отзывы» в карточке отеля: репутация отеля за 90 дней, площадки, темы, задачи, последние отзывы. */
export const HotelReviewsTab: React.FC<{ hotelId: string }> = ({ hotelId }) => {
  const { r, lang } = useRepT();
  const fmt = useNumFmt();
  const navigate = useNavigate();
  const [sum, setSum] = useState<RepHotelSummary | null>(null);
  const [feed, setFeed] = useState<RepFeed | null>(null);
  const [error, setError] = useState('');
  const [tasks, setTasks] = useState<RepHotelTasks | null>(null);

  useEffect(() => {
    fetchRepHotelSummary(hotelId).then(setSum).catch((e) => setError(e?.message || 'error'));
    fetchRepFeed({ hotelId, limit: 8 }).then(setFeed).catch(() => undefined);
    fetchRepHotelTasks(hotelId).then(setTasks).catch(() => undefined);
  }, [hotelId]);

  if (error) return <div className="rv"><div className="rv-note err">{error}</div></div>;
  if (!sum) return <div className="rv"><div className="rv-empty">{r('card.loading')}</div></div>;
  const k = sum.kpis;
  const nb = sum.negBelow;

  if (!sum.platforms.length) {
    return (
      <div className="rv">
        <Frame className="rv-empty">
          <h4>{r('hotelTab.emptyTitle')}</h4>
          <p style={{ margin: '0 0 14px' }}>{r('hotelTab.emptyText')}</p>
          <Btn pri onClick={() => navigate('/hotels/reviews/settings')}>{r('feed.setup')}</Btn>
        </Frame>
      </div>
    );
  }

  const kpi = (l: string, v: number | null | undefined, d: number, suf: string, delta?: React.ReactNode, text?: string) => (
    <div className="rv-kpi">
      <div className="l">{l}</div>
      <div className="v">{text != null ? <span style={{ fontSize: 30 }}>{text}</span> : <CountUp v={v} d={d} />}{suf && v != null && text == null && <small>{suf}</small>}</div>
      <div className="d">{delta}</div>
    </div>
  );

  return (
    <div className="rv">
      <div className="rv-view">
        <div className="rv-cmpbar" style={{ marginTop: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--n7)' }}>{r('hotelTab.last90')}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => navigate(`/hotels/reviews/dashboard?hotel=${hotelId}`)}>{r('tabs.dashboard')}</Btn>
            <Btn pri onClick={() => navigate(`/hotels/reviews?hotelId=${hotelId}`)}>{r('hotelTab.openFeed')}</Btn>
          </div>
        </div>

        <Frame className="rv-kpis">
          {kpi(r('dash.kpi.avg'), k.avg10, 2, '/10', <Delta v={k.delta?.avg10} />)}
          {kpi(r('dash.kpi.index'), k.reputationIndex, 1, '/100', null, k.reputationIndex == null ? fmtRepIndex(null, lang) : undefined)}
          {kpi(r('hotelTab.reviews90'), k.count, 0, '')}
          {kpi(r('dash.kpi.neg'), k.negativeShare, 1, '%')}
          {kpi(r('dash.kpi.response'), k.responseRate, 1, '%')}
          {kpi(r('dash.kpi.replyTime'), k.medianReplyHours, 1, '', null, fmtHours(k.medianReplyHours, r))}
        </Frame>

        <Frame className="rv-card rv-st" style={{ '--i': 1, marginBottom: 22 } as React.CSSProperties}>
          <CardHead title={r('dash.platformsTitle')} sub={r('hotelTab.platformsSub')} />
          <div className="rv-tw">
            <table className="rv-tbl">
              <thead>
                <tr><th>{r('dash.col.platform')}</th><th>{r('dash.col.onPlatform')}</th><th>{r('dash.col.inCrm')}</th><th>{r('hotelTab.n90')}</th><th>{r('dash.col.avg')}</th><th>{r('dash.col.open')}</th></tr>
              </thead>
              <tbody>
                {sum.platforms.map((p) => (
                  <tr key={p.platform}>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <PlatformBadge p={p.platform} />
                        {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--n5)', display: 'inline-flex' }} aria-label={r('card.viewOnPlatform')}><Ico n="ext" s={12} /></a>}
                        {p.failing && <span className="rv-pill noreply">{r('dash.failing')}</span>}
                      </span>
                    </td>
                    <td>{p.platformCount != null ? <>{p.platformRating != null && <b className="num" style={{ marginRight: 6 }}>{fmt(p.platformRating, 1)}</b>}<span style={{ color: 'var(--n7)' }}>{fmt(p.platformCount)}</span></> : '—'}</td>
                    <td>{fmt(p.total)}</td>
                    <td>{p.n90}</td>
                    <td><Score v={p.avg90} nb={nb} /></td>
                    <td>
                      {p.unansweredNegative ? (
                        <button type="button" className="rv-pill urg" style={{ cursor: 'pointer' }} onClick={() => navigate(`/hotels/reviews?hotelId=${hotelId}&platform=${p.platform}&reply=none&ratingMax=${(nb - 0.01).toFixed(2)}`)}>
                          {p.unansweredNegative} · {r('rv.dash.open')}
                        </button>
                      ) : <span style={{ color: 'var(--n5)' }}>0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Frame>

        <div className="rv-grid2">
          <Frame className="rv-card rv-st" style={{ '--i': 2 } as React.CSSProperties}>
            <CardHead title={r('dash.complaints')} cls="neg" sub={r('hotelTab.last90')} />
            {sum.complaints.length ? (
              <div className="rv-topics" style={{ marginTop: 0 }}>
                {sum.complaints.map((t) => (
                  <span key={t.topic + t.label} className="rv-topic negative click" title={t.negQuotes.map((q) => `«${q}»`).join('\n')} onClick={() => navigate(`/hotels/reviews?hotelId=${hotelId}&topic=${t.topic}`)}>
                    {topicLabel(t, r, lang)} · {t.negative}
                  </span>
                ))}
              </div>
            ) : <div className="rv-empty-s">{r('dash.noTopics')}</div>}
          </Frame>
          <Frame className="rv-card rv-st" style={{ '--i': 3 } as React.CSSProperties}>
            <CardHead title={r('dash.praises')} cls="pos" sub={r('hotelTab.last90')} />
            {sum.praises.length ? (
              <div className="rv-topics" style={{ marginTop: 0 }}>
                {sum.praises.map((t) => (
                  <span key={t.topic + t.label} className="rv-topic positive" title={t.posQuotes.map((q) => `«${q}»`).join('\n')}>
                    {topicLabel(t, r, lang)} · {t.positive}
                  </span>
                ))}
              </div>
            ) : <div className="rv-empty-s">{r('dash.noTopics')}</div>}
          </Frame>
        </div>

        {tasks && (
          <Frame className="rv-card rv-st" style={{ '--i': 4, marginBottom: 22 } as React.CSSProperties}>
            <CardHead title={r('hotelTab.tasksTitle')} sub={tasks.projectId ? r('hotelTab.tasksSub', { open: tasks.open.length, done: tasks.done }) : r('hotelTab.tasksNone')}>
              {tasks.projectId && <Btn sm onClick={() => navigate(`/projects/${tasks.projectId}`)}>{r('hotelTab.openProject')}</Btn>}
            </CardHead>
            {tasks.pending.length > 0 && (
              <div className="rv-note warn" style={{ marginBottom: 10 }}>
                <span>{r('hotelTab.tasksPending', { n: tasks.pending.length })}</span>
                <span className="sp" />
                {tasks.agentId && <Btn sm onClick={() => navigate(`/ai-employees/${tasks.agentId}?tab=journal`)}>{r('hotelTab.reviewPending')}</Btn>}
              </div>
            )}
            {tasks.open.length > 0 && (
              <div className="rv-tasks">
                {tasks.open.slice(0, 8).map((x) => (
                  <div key={x.id} className="rv-task" onClick={() => navigate(`/projects/${tasks.projectId}`)}>
                    {x.byAi && <span className="ai">AI</span>}
                    <span>{x.title}</span>
                    <span className="m">{x.status}{x.deadline ? ` · ${fmtDate(x.deadline, lang)}` : ''}</span>
                  </div>
                ))}
                {tasks.open.length > 8 && <div style={{ fontSize: 12, color: 'var(--n7)', paddingTop: 8 }}>+{tasks.open.length - 8}</div>}
              </div>
            )}
          </Frame>
        )}

        <Frame className="rv-card rv-st" style={{ '--i': 5 } as React.CSSProperties}>
          <CardHead title={r('hotelTab.latest')} />
          <div className="rv-feed">
            {feed?.items.map((x, i) => (
              <div
                key={x.id}
                className={cx('rv-row', 'rv-st', x.urgent && 'urgent', x.status === 'deleted' && 'deleted')}
                style={{ '--i': Math.min(i, 12) } as React.CSSProperties}
                onClick={() => navigate(`/hotels/reviews?hotelId=${hotelId}&review=${x.id}`)}
              >
                <div className="rv-row-meta">
                  <PlatformBadge p={x.platform} />
                  <span>{fmtDate(x.publishedAt, lang)}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="rv-row-head">
                    <span className="rv-row-author">{x.author || r('card.anonymous')}</span>
                    {x.lang && <span className="rv-lang">{x.lang}</span>}
                  </div>
                  <div className={cx('rv-row-text', !x.text && 'empty')}>{x.text || r('card.noText')}</div>
                </div>
                <div className="rv-row-right">
                  <Score v={x.rating10} raw={x.ratingRaw} scale={x.ratingScale} nb={nb} />
                  {(x.replyEligible || x.hasReply) &&
                    (x.replyMode === 'none' ? (
                      <span className="rv-pill">{r('reply.notPublished')}</span>
                    ) : x.hasReply ? (
                      <span className="rv-pill replied"><Ico n="check" s={11} />{r('reply.replied')}</span>
                    ) : (
                      <span className="rv-pill noreply">{r('reply.none')}</span>
                    ))}
                  {x.draftReady && <span className="rv-pill draft">{r('feed.draftReady')}</span>}
                </div>
              </div>
            ))}
            {feed && !feed.items.length && <div className="rv-empty">{r('feed.emptyText')}</div>}
          </div>
        </Frame>
      </div>
    </div>
  );
};
