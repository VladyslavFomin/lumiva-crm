// «Решения · Бронирования» — шаблон Claude Design solution-v2.html (lh-pages.jsx SolutionPage, ключ booking).
// Тексты — только проверенное по backend/src/bookings (bookingSolutionText.ts); выдуманные цифры и
// «авто-предложение листу ожидания» / «напоминание за день» из макета убраны.
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../landing/LandingSections';
import { BOOKING_T, type BookingText } from './bookingSolutionText';
import { AiSection, CardsSection, CtaBox, FaqSection, SolutionHero, SolutionShell, useInView } from './solutionKit';
import { SolFeed, SolHow, SolMore, SolProb, SolTabs, SolTbl } from './solutionExtras';

const HOURS = ['10', '11', '12', '13', '14', '15', '16'];
/* [сотрудник, начало (ч от 10), длительность (ч), услуга] */
const BLOCKS: Array<[number, number, number, number]> = [
  [0, 0, 1, 0],
  [0, 1.5, 2, 2],
  [1, 0, 1, 1],
  [1, 2, 1, 4],
  [1, 4, 1, 0],
  [2, 0.5, 1, 3],
  [2, 3, 1, 3],
  [0, 5, 1, 5],
  [2, 5.5, 1, 3],
];

/* день по сотрудникам: входит запрос из WhatsApp → проверка → слот 14:00 занят → встаёт в 15:00 */
function DayVis({ tx }: { tx: BookingText }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref, 0.3);
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setS((x) => (x + 1) % 6), 1500);
    return () => clearInterval(t);
  }, [on]);
  const v = tx.vis;
  return (
    <div className="bk-day" ref={ref}>
      <div className="bk-day-h">
        <b>{v.day}</b>
        <span className="fv-demo">{v.demo}</span>
      </div>
      <div className="bk-day-g">
        <div className="bk-day-hrs">
          <span />
          {HOURS.map((h) => (
            <span key={h}>{h}:00</span>
          ))}
        </div>
        {v.staff.map((name, si) => (
          <div key={name} className="bk-day-col">
            <span className="bk-day-n">{name}</span>
            <div className="bk-day-c">
              {BLOCKS.filter((b) => b[0] === si).map(([, st, len, svc], i) => (
                <i key={i} className={'bk-blk c' + (svc % 4)} style={{ top: (st / 7) * 100 + '%', height: (len / 7) * 100 + '%' }}>
                  {tx.vis.svc[svc]}
                </i>
              ))}
              {si === 1 && (
                <>
                  <i className={'bk-blk ghost' + (s >= 2 && s < 3 ? ' on' : '')} style={{ top: (4 / 7) * 100 + '%', height: (1 / 7) * 100 + '%' }}>
                    14:00
                  </i>
                  <i className={'bk-blk new' + (s >= 3 ? ' on' : '')} style={{ top: (5 / 7) * 100 + '%', height: (1 / 7) * 100 + '%' }}>
                    {tx.vis.svc[1]}
                  </i>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="bk-day-log">
        <span className={'bk-msg' + (s >= 1 ? ' on' : '')}>
          <Icon name="chat" size={13} />
          {v.incoming}
        </span>
        <span className={'bk-msg chk' + (s >= 2 ? ' on' : '')}>
          <Icon name="shield" size={13} />
          {s >= 2 && s < 3 ? v.busy : v.check}
        </span>
        <span className={'bk-msg ok' + (s >= 3 ? ' on' : '')}>
          <Icon name="check" size={13} stroke={2.4} />
          {v.ok}
        </span>
      </div>
    </div>
  );
}

export default function BookingSolutionsPage() {
  const { t, i18n } = useTranslation();
  const code = (i18n.language || 'ru').slice(0, 2);
  const tx = BOOKING_T[code === 'en' || code === 'tr' ? code : 'ru'];
  return (
    <SolutionShell activeKey="booking">
      <SolutionHero
        crumbs={tx.crumbs}
        kicker={tx.kicker}
        t1={tx.t1}
        t2={tx.t2}
        sub={tx.sub}
        tryFree={tx.tryFree}
        demo={tx.demo}
        demoNote={tx.demoNote}
        url="crm.lumiva.agency/bookings"
        tplIndex={4}
        dashTitle={t('crm.aura.tpl.booking.name')}
        stats={tx.stats}
      />
      <SolTabs active="booking" />
      <SolHow {...tx.how} role="chat_operator">
        <DayVis tx={tx} />
      </SolHow>
      <SolProb {...tx.prob} />
      <CardsSection {...tx.feats} />
      <SolTbl T={tx.tbl} />
      <CardsSection {...tx.rules} />
      <SolFeed F={tx.feed} />
      <CardsSection {...tx.anal} />
      <AiSection role="chat_operator" {...tx.ai} />
      <FaqSection {...tx.faq} />
      <SolMore active="booking" {...tx.more} />
      <CtaBox k={tx.cta.k} t={tx.cta.t} demo={tx.demo} tryFree={tx.tryFree} />
    </SolutionShell>
  );
}
