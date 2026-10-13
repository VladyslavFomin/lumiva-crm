import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchRepFeed, fetchRepHotelSummary, fetchRepHotelTasks, type RepFeed, type RepHotelSummary, type RepHotelTasks } from '../../../api/hotelReputation';
import { Delta, PlatformBadge, Score, fmtDate, fmtHours, topicLabel, useRepT } from './ReputationShared';
import './reputation.css';

/** Вкладка «Отзывы» в карточке отеля: репутация отеля за 90 дней, площадки, темы, последние отзывы. */
export const HotelReviewsTab: React.FC<{ hotelId: string }> = ({ hotelId }) => {
  const { r, lang } = useRepT();
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

  if (error) return <div className="rp-note err">{error}</div>;
  if (!sum) return <div className="rp-empty">{r('card.loading')}</div>;
  const k = sum.kpis;
  const nb = sum.negBelow;

  if (!sum.platforms.length) {
    return (
      <div className="rp-feed">
        <div className="rp-empty">
          <h4>{r('hotelTab.emptyTitle')}</h4>
          <p style={{ margin: '0 0 12px' }}>{r('hotelTab.emptyText')}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/hotels/reviews/settings')}>{r('feed.setup')}</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="rp-kpis">
        <div className="ha-kpi"><div className="l">{r('dash.kpi.avg')}</div><div className="v">{k.avg10 ?? '—'}<small>/10</small></div><div className="d"><Delta v={k.delta?.avg10} /></div></div>
        <div className="ha-kpi"><div className="l">{r('dash.kpi.index')}</div><div className="v">{k.reputationIndex ?? '—'}<small>/10</small></div></div>
        <div className="ha-kpi"><div className="l">{r('hotelTab.reviews90')}</div><div className="v">{k.count}</div></div>
        <div className="ha-kpi"><div className="l">{r('dash.kpi.neg')}</div><div className="v">{k.negativeShare ?? '—'}<small>%</small></div></div>
        <div className="ha-kpi"><div className="l">{r('dash.kpi.response')}</div><div className="v">{k.responseRate ?? '—'}<small>%</small></div></div>
        <div className="ha-kpi"><div className="l">{r('dash.kpi.replyTime')}</div><div className="v" style={{ fontSize: 20 }}>{fmtHours(k.medianReplyHours, r)}</div></div>
      </div>

      <div className="ha-section">
        <div className="ha-section-head">
          <div><h3>{r('dash.platformsTitle')}</h3><div className="sub">{r('hotelTab.platformsSub')}</div></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-sm" onClick={() => navigate(`/hotels/reviews/dashboard?hotel=${hotelId}`)}>{r('tabs.dashboard')}</button>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => navigate(`/hotels/reviews?hotelId=${hotelId}`)}>{r('hotelTab.openFeed')}</button>
          </div>
        </div>
        <div className="pace-table-wrap">
          <table className="pace-table">
            <thead>
              <tr><th>{r('dash.col.platform')}</th><th>{r('dash.col.onPlatform')}</th><th>{r('dash.col.inCrm')}</th><th>{r('hotelTab.n90')}</th><th>{r('dash.col.avg')}</th><th>{r('dash.col.open')}</th></tr>
            </thead>
            <tbody>
              {sum.platforms.map((p) => (
                <tr key={p.platform}>
                  <td>
                    <PlatformBadge platform={p.platform} />
                    {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8, fontSize: 11 }}>↗</a>}
                    {p.failing && <span className="ha-risk-pill bad" style={{ marginLeft: 6 }}>{r('dash.failing')}</span>}
                  </td>
                  <td>{p.platformCount != null ? `${p.platformCount}${p.platformRating != null ? ` · ★ ${p.platformRating}` : ''}` : '—'}</td>
                  <td>{p.total}</td>
                  <td>{p.n90}</td>
                  <td><Score rating10={p.avg90} negBelow={nb} /></td>
                  <td>
                    {p.unansweredNegative ? (
                      <span className="ha-risk-pill bad" style={{ cursor: 'pointer' }} onClick={() => navigate(`/hotels/reviews?hotelId=${hotelId}&platform=${p.platform}&reply=none&ratingMax=${(nb - 0.01).toFixed(2)}`)}>{p.unansweredNegative}</span>
                    ) : '0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rp-grid2">
        <div className="ha-section">
          <div className="ha-section-head"><div><h3 style={{ color: '#cc2f47' }}>{r('dash.complaints')}</h3><div className="sub">{r('hotelTab.last90')}</div></div></div>
          {sum.complaints.length ? (
            <div className="rp-topics" style={{ marginTop: 0 }}>
              {sum.complaints.map((t) => (
                <span key={t.topic + t.label} className="rp-topic negative" title={t.negQuotes.map((q) => `«${q}»`).join('\n')} style={{ cursor: 'pointer' }} onClick={() => navigate(`/hotels/reviews?hotelId=${hotelId}&topic=${t.topic}`)}>
                  {topicLabel({ topic: t.topic, label: t.label }, r)} · {t.negative}
                </span>
              ))}
            </div>
          ) : <div style={{ color: 'var(--fg-4)', fontSize: 12.5 }}>{r('dash.noTopics')}</div>}
        </div>
        <div className="ha-section">
          <div className="ha-section-head"><div><h3 style={{ color: '#1f8a5e' }}>{r('dash.praises')}</h3><div className="sub">{r('hotelTab.last90')}</div></div></div>
          {sum.praises.length ? (
            <div className="rp-topics" style={{ marginTop: 0 }}>
              {sum.praises.map((t) => (
                <span key={t.topic + t.label} className="rp-topic positive" title={t.posQuotes.map((q) => `«${q}»`).join('\n')}>
                  {topicLabel({ topic: t.topic, label: t.label }, r)} · {t.positive}
                </span>
              ))}
            </div>
          ) : <div style={{ color: 'var(--fg-4)', fontSize: 12.5 }}>{r('dash.noTopics')}</div>}
        </div>
      </div>

      {tasks && (
        <div className="ha-section">
          <div className="ha-section-head">
            <div>
              <h3>{r('hotelTab.tasksTitle')}</h3>
              <div className="sub">{tasks.projectId ? r('hotelTab.tasksSub', { open: tasks.open.length, done: tasks.done }) : r('hotelTab.tasksNone')}</div>
            </div>
            {tasks.projectId && (
              <button type="button" className="btn btn-sm" onClick={() => navigate(`/projects/${tasks.projectId}`)}>{r('hotelTab.openProject')}</button>
            )}
          </div>
          {tasks.pending.length > 0 && (
            <div className="rp-note warn" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>{r('hotelTab.tasksPending', { n: tasks.pending.length })}</span>
              {tasks.agentId && (
                <button type="button" className="btn btn-sm" onClick={() => navigate(`/ai-employees/${tasks.agentId}?tab=journal`)}>{r('hotelTab.reviewPending')}</button>
              )}
            </div>
          )}
          {tasks.open.length > 0 && (
            <div className="rp-task-list">
              {tasks.open.slice(0, 8).map((x) => (
                <div key={x.id} className="rp-task" onClick={() => navigate(`/projects/${tasks.projectId}`)}>
                  <span className="rp-task-title">{x.byAi && <span className="rp-task-ai">AI</span>}{x.title}</span>
                  <span className="rp-task-meta">{x.status}{x.deadline ? ` · ${fmtDate(x.deadline, lang)}` : ''}</span>
                </div>
              ))}
              {tasks.open.length > 8 && <div className="rp-task-more">+{tasks.open.length - 8}</div>}
            </div>
          )}
        </div>
      )}

      <div className="ha-section">
        <div className="ha-section-head"><div><h3>{r('hotelTab.latest')}</h3></div></div>
        <div className="rp-feed">
          {feed?.items.map((x) => (
            <div key={x.id} className={`rp-row${x.urgent ? ' urgent' : ''}`} onClick={() => navigate(`/hotels/reviews?hotelId=${hotelId}&review=${x.id}`)}>
              <div className="rp-row-meta">
                <PlatformBadge platform={x.platform} />
                <span className="rp-row-date">{fmtDate(x.publishedAt, lang)}</span>
              </div>
              <div className="rp-row-body">
                <div className="rp-row-head"><span className="rp-row-author">{x.author || r('card.anonymous')}</span>{x.lang && <span className="rp-lang">{x.lang}</span>}</div>
                <div className={`rp-row-text${x.text ? '' : ' empty'}`}>{x.text || r('card.noText')}</div>
              </div>
              <div className="rp-row-right">
                <Score rating10={x.rating10} raw={x.ratingRaw} scale={x.ratingScale} negBelow={nb} />
                {x.replyMode === 'none' ? <span className="rp-pill muted">{r('reply.notPublished')}</span> : x.hasReply ? <span className="rp-pill replied">{r('reply.replied')}</span> : <span className="rp-pill noreply">{r('reply.none')}</span>}
                {x.draftReady && <span className="rp-pill draft">✎ {r('feed.draftReady')}</span>}
              </div>
            </div>
          ))}
          {feed && !feed.items.length && <div className="rp-empty">{r('feed.emptyText')}</div>}
        </div>
      </div>
    </div>
  );
};
