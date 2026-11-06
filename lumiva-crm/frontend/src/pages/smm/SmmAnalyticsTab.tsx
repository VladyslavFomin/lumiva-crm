/** Аналитика постов (метрики из сетей по опубликованным вариантам) + статистика профилей (прежняя SMM-страница). */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { contentApi, type Analytics } from '../../api/content';
import { SmmPage } from '../marketing/SmmPage';
import { fmtDateTime, IC, Ico, localeOf, NET_NAME, NetIcon } from './smmShared';

const nf = (n: number, locale: string) => new Intl.NumberFormat(locale).format(Math.round(n));

export function SmmAnalyticsTab({ onOpen }: { onOpen: (postId: string) => void }) {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.smm2.analytics.${key}`, o) as string;
  const locale = localeOf(i18n.language);
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  useEffect(() => {
    setData(null);
    contentApi.analytics(days).then(setData).catch(() => setData({ days, totals: { posts: 0, measured: 0, reach: 0, likes: 0, comments: 0, shares: 0, saved: 0 }, byNetwork: {}, bestTimes: {}, abTests: [], top: [], posts: [] }));
  }, [days]);
  const tot = data?.totals;
  const eng = tot ? tot.likes + tot.comments + tot.shares + tot.saved : 0;
  // метрик нет вовсе (Telegram, личный LinkedIn) — «—», а не ноль
  const measured = !!tot?.measured;
  return (
    <div className="sc-stack">
      <div className="sc-toolbar">
        <div className="sc-seg">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" className={days === d ? 'on' : ''} onClick={() => setDays(d)}>
              {k('days', { n: d })}
            </button>
          ))}
        </div>
        <span className="sc-mut">{k('metricsHint')}</span>
        {tot && tot.posts > tot.measured ? <span className="sc-mut">{k('noMetricsHint')}</span> : null}
      </div>
      <div className="sc-kpis">
        {([
          ['posts', tot?.posts],
          ['reach', measured ? tot?.reach : undefined],
          ['engagement', measured ? eng : undefined],
          ['er', measured && tot?.reach ? Math.round((eng / tot.reach) * 1000) / 10 : undefined],
        ] as Array<[string, number | undefined]>).map(([id, v]) => (
          <div key={id} className="sc-kpi static">
            <div className="l">{k(`kpi.${id}`)}</div>
            <div className="v">{v === undefined ? '—' : id === 'er' ? `${v}%` : nf(v, locale)}</div>
            <div className="s">{k(`kpiHint.${id}`)}</div>
          </div>
        ))}
      </div>
      <div className="sc-grid2">
        <section className="sc-card">
          <div className="sc-card-hd">
            <h3>{k('byNetwork')}</h3>
          </div>
          {data && Object.keys(data.byNetwork).length ? (
            <table className="sc-table plain">
              <thead>
                <tr>
                  <th>{k('network')}</th>
                  <th className="r">{k('posts')}</th>
                  <th className="r">{k('reach')}</th>
                  <th className="r">{k('engagement')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.byNetwork).map(([n, v]) => (
                  <tr key={n}>
                    <td>
                      <NetIcon network={n as any} size={13} /> {NET_NAME[n as keyof typeof NET_NAME] || n}
                    </td>
                    <td className="r mono">{v.posts}</td>
                    <td className="r mono">{v.measured ? nf(v.reach, locale) : '—'}</td>
                    <td className="r mono">{v.measured ? nf(v.engagement, locale) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="sc-hint">{k('noData')}</p>
          )}
        </section>
        <section className="sc-card">
          <div className="sc-card-hd">
            <h3>{k('top')}</h3>
          </div>
          {data?.top.length ? (
            data.top.map((r) => (
              <button key={r.id} type="button" className="sc-row" onClick={() => onOpen(r.postId)}>
                {r.thumb ? <img className="sc-row-img" src={r.thumb} alt="" /> : <span className="sc-row-img ph" />}
                <span className="sc-row-tx">
                  <b>{r.title || r.excerpt || '—'}</b>
                  <small>
                    <NetIcon network={r.network} size={11} /> {r.channelName} · {fmtDateTime(r.publishedAt, locale)}
                    {r.metrics ? ` · ${k('engShort', { n: r.engagement })}` : ''}
                    {r.metrics?.reach ? ` · ${k('reachShort', { n: nf(r.metrics.reach, locale) })}` : ''}
                  </small>
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  className="btn-ghost sm"
                  title={k('repeatHint')}
                  onClick={(e) => {
                    e.stopPropagation();
                    void contentApi.duplicate(r.postId).then((copy) => onOpen(copy.id)).catch(() => undefined);
                  }}
                >
                  {k('repeat')}
                </span>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="btn-icon" aria-label={k('open')}>
                    <Ico d={IC.link} size={13} />
                  </a>
                ) : null}
              </button>
            ))
          ) : (
            <p className="sc-hint">{k('noData')}</p>
          )}
        </section>
      </div>
      <section className="sc-card">
        <div className="sc-card-hd">
          <h3>{k('bestTimes')}</h3>
        </div>
        {data && Object.keys(data.bestTimes || {}).length ? (
          <div className="sc-best">
            {Object.entries(data.bestTimes).map(([n, xs]) => (
              <div key={n} className="sc-best-row">
                <span className="net">
                  <NetIcon network={n as any} size={13} /> {NET_NAME[n as keyof typeof NET_NAME] || n}
                </span>
                {xs.map((x) => (
                  <span key={`${x.dow}-${x.hour}`} className="sc-best-slot">
                    <b>
                      {t(`crm.smm2.analytics.dow.${x.dow}`)} {String(x.hour).padStart(2, '0')}:00
                    </b>
                    <small>
                      ER {x.er}% · {k('postsN', { count: x.n })}
                    </small>
                  </span>
                ))}
              </div>
            ))}
            <p className="sc-hint">{k('bestTimesHint')}</p>
          </div>
        ) : (
          <p className="sc-hint">{k('bestTimesEmpty')}</p>
        )}
      </section>
      <section className="sc-card">
        <div className="sc-card-hd">
          <h3>{k('abTitle')}</h3>
        </div>
        {data?.abTests?.length ? (
          <table className="sc-table plain">
            <thead>
              <tr>
                <th>{k('abVariant')}</th>
                <th className="r">{k('reach')}</th>
                <th className="r">{k('engagement')}</th>
                <th className="r">ER</th>
                <th>{k('abResult')}</th>
              </tr>
            </thead>
            <tbody>
              {data.abTests.flatMap((g) =>
                (['A', 'B'] as const).map((side) => {
                  const x = g[side];
                  return (
                    <tr key={`${g.group}-${side}`} className={side === 'B' ? 'sc-ab-b' : 'sc-ab-a'}>
                      <td>
                        <button type="button" className="sc-link" onClick={() => onOpen(x.postId)}>
                          <b>{side}</b> · {x.title || x.excerpt || '—'}
                        </button>
                      </td>
                      <td className="r mono">{x.measured ? nf(x.reach, locale) : '—'}</td>
                      <td className="r mono">{x.measured ? nf(x.engagement, locale) : '—'}</td>
                      <td className="r mono">{x.er !== null ? `${x.er}%` : '—'}</td>
                      <td>{side === 'A' ? (g.winner ? <b>{k('abWinner', { label: g.winner })}</b> : <span className="sc-mut">{k('abWaiting')}</span>) : null}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        ) : (
          <p className="sc-hint">{k('abEmpty')}</p>
        )}
      </section>
      <section className="sc-embedded">
        <SmmPage embedded />
      </section>
    </div>
  );
}
