// «Решения · Система резервации» — шаблон Claude Design solution-v2.html (ключ hotels).
// Тексты — только проверенное по backend/src/hotels (hotelSolutionText.ts). Визуалы повторяют реальную аналитику:
// пейсинг к целям 90/60/30/14/7/0 дней и теплокарта заполняемости с порогами 45/65 %. Цифры — демо.
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HOTEL_T, type HotelText } from './hotelSolutionText';
import { AiSection, CardsSection, CtaBox, FaqSection, SolutionHero, SolutionShell, useInView } from './solutionKit';
import { SolFeed, SolHow, SolMore, SolProb, SolTabs, SolTbl } from './solutionExtras';

/* цели по умолчанию из hotel-analytics.service.ts; факт — демо с отставанием на 30 и 14 днях */
const PACE: Array<[number, number, number]> = [
  [90, 10, 12],
  [60, 40, 38],
  [30, 65, 51],
  [14, 80, 63],
  [7, 92, 0],
  [0, 100, 0],
];
const NOW = 3; // сколько точек уже наступило (до 14 дней включительно)

function PaceVis({ tx }: { tx: HotelText }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref, 0.2);
  const [hot, setHot] = useState(2);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setHot((h) => (h + 1) % (NOW + 1)), 1800);
    return () => clearInterval(t);
  }, [on]);
  const p = tx.pace;
  const [d, tg, ac] = PACE[hot];
  const gap = tg - ac;
  return (
    <div className="ht-pace" ref={ref}>
      <div className="ht-pace-h">
        <b>{p.t}</b>
        <span className="ht-lg">
          <i className="tg" />
          {p.target}
          <i className="ac" />
          {p.actual}
        </span>
      </div>
      <div className="ht-pace-g">
        {PACE.map(([days, target, actual], i) => {
          const past = i <= NOW;
          const behind = past && target - actual > 5;
          return (
            <div key={days} className={'ht-col' + (i === hot ? ' hot' : '') + (past ? '' : ' fut')}>
              <div className="ht-bars">
                <span className="ht-b tg" style={{ height: on ? target + '%' : 0, transitionDelay: i * 0.08 + 's' }} />
                {past && <span className={'ht-b ac' + (behind ? ' bad' : '')} style={{ height: on ? actual + '%' : 0, transitionDelay: 0.2 + i * 0.08 + 's' }} />}
              </div>
              <em>{days}</em>
            </div>
          );
        })}
      </div>
      <div className="ht-pace-f">
        <span>
          {d} {p.days}
        </span>
        <b className={gap > 5 ? 'bad' : ''}>
          {p.target} {tg}% · {p.actual} {ac}%{gap > 0 ? ` · −${gap} п.п. ${p.gap}` : ''}
        </b>
        {gap > 5 && <span className="sl-st warn">{p.behind}</span>}
      </div>
    </div>
  );
}

const HEAT = [
  [62, 81, 96, 98, 74, 41],
  [58, 77, 93, 97, 70, 38],
  [44, 69, 88, 91, 61, 30],
  [21, 33, 52, 60, 28, 12],
  [49, 72, 95, 99, 66, 35],
];

function HeatVis({ tx }: { tx: HotelText }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref, 0.25);
  const h = tx.heat;
  return (
    <div className={'ht-heat' + (on ? ' on' : '')} ref={ref}>
      <div className="ht-pace-h">
        <b>{h.t}</b>
        <span className="fv-demo">{tx.demoNote}</span>
      </div>
      <div className="ht-heat-g" style={{ '--m': h.months.length } as React.CSSProperties}>
        <span />
        {h.months.map((m) => (
          <em key={m}>{m}</em>
        ))}
        {h.rooms.map((r, ri) => (
          <React.Fragment key={r}>
            <span className="ht-heat-r">{r}</span>
            {HEAT[ri].map((v, mi) => (
              <i key={mi} className={v < 45 ? 'bad' : v < 65 ? 'warn' : 'ok'} style={{ transitionDelay: (ri * 6 + mi) * 0.025 + 's', '--o': 0.35 + v / 160 } as React.CSSProperties}>
                {v}
              </i>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="ht-heat-l">
        <span>
          <i className="bad" />
          {h.legend[0]}
        </span>
        <span>
          <i className="warn" />
          {h.legend[1]}
        </span>
        <span>
          <i className="ok" />
          {h.legend[2]}
        </span>
      </div>
    </div>
  );
}

export default function HotelSolutionsPage() {
  const { i18n } = useTranslation();
  const code = (i18n.language || 'ru').slice(0, 2);
  const tx = HOTEL_T[code === 'en' || code === 'tr' ? code : 'ru'];
  return (
    <SolutionShell activeKey="hotels">
      <SolutionHero
        crumbs={tx.crumbs}
        kicker={tx.kicker}
        t1={tx.t1}
        t2={tx.t2}
        sub={tx.sub}
        tryFree={tx.tryFree}
        demo={tx.demo}
        demoNote={tx.demoNote}
        url="crm.lumiva.agency/hotels/analytics"
        tplIndex={4}
        dashTitle=""
        stats={tx.stats}
        visual={<PaceVis tx={tx} />}
      />
      <SolTabs active="hotels" />
      <SolHow {...tx.how} role="reservation_assistant">
        <HeatVis tx={tx} />
      </SolHow>
      <SolProb {...tx.prob} />
      <CardsSection {...tx.feats} />
      <SolTbl T={tx.tbl} />
      <CardsSection {...tx.rates} />
      <CardsSection {...tx.desk} />
      <SolFeed F={tx.feed} />
      <AiSection role="reservation_assistant" {...tx.ai} />
      <FaqSection {...tx.faq} />
      <SolMore active="hotels" {...tx.more} />
      <CtaBox k={tx.cta.k} t={tx.cta.t} demo={tx.demo} tryFree={tx.tryFree} />
    </SolutionShell>
  );
}
