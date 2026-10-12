// Блоки шаблона solution-v2.html (lh-pages.jsx SolutionPage): вкладки решений, процесс по шагам,
// таблица со статусами/загрузкой, лента событий и «Другие решения». Стили — .sl-* в lp-kit.css.
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../landing/LandingSections';
import { AiCharacter, AI_ROLE_PALETTE } from '../ai-employees/AiCharacter';
import { Head, useInView, useTick } from './solutionKit';

export type SolKey = 'analytics' | 'marketing' | 'sales' | 'client-accounts' | 'products' | 'warehouse' | 'booking' | 'hotels';
const SOL_KEYS: SolKey[] = ['analytics', 'marketing', 'sales', 'client-accounts', 'products', 'warehouse', 'booking', 'hotels'];
const href = (k: SolKey) => '/solutions/' + k;

const MORE: Record<'ru' | 'en' | 'tr', Record<SolKey, string>> = {
  ru: {
    analytics: 'Дашборды из блоков, Aura по запросу словами и отчёты по расписанию.',
    marketing: 'Рекламные кабинеты, UTM, ROI по клиентам, SEO и рассылки.',
    sales: 'Заявки с ваших сайтов, статусы, одобрение и оплата по ссылке.',
    'client-accounts': 'Личные кабинеты клиентов, балансы и операции в синхроне с порталом.',
    products: 'Каталог с вариантами, ценами по валютам и публикацией на сайты.',
    warehouse: 'Остатки по складам, перемещения и дозаказ через ИИ-отдел.',
    booking: 'Записи, графики сотрудников, лист ожидания и аналитика загрузки.',
    hotels: 'Номерной фонд, тарифы по рынкам, пейсинг и стойка регистрации.',
  },
  en: {
    analytics: 'Block dashboards, Aura from a plain-language request and scheduled reports.',
    marketing: 'Ad accounts, UTM, ROI per client, SEO and email campaigns.',
    sales: 'Orders from your sites, statuses, approval and pay-by-link.',
    'client-accounts': 'Client portals, balances and operations synced with your portal.',
    products: 'A catalog with variants, per-currency prices and publishing to sites.',
    warehouse: 'Stock per location, transfers and reordering via an AI department.',
    booking: 'Appointments, staff schedules, a waitlist and occupancy analytics.',
    hotels: 'Room inventory, market rates, pacing and a front desk.',
  },
  tr: {
    analytics: 'Bloklardan panolar, sözlü istekle Aura ve zamanlanmış raporlar.',
    marketing: 'Reklam hesapları, UTM, müşteri bazında ROI, SEO ve bültenler.',
    sales: 'Sitelerinizden gelen siparişler, durumlar, onay ve bağlantıyla ödeme.',
    'client-accounts': 'Portalınızla senkronize müşteri hesapları, bakiyeler ve işlemler.',
    products: 'Varyantlı katalog, para birimine göre fiyatlar ve sitelerde yayın.',
    warehouse: 'Lokasyon bazında stok, transferler ve YZ departmanıyla yeniden sipariş.',
    booking: 'Randevular, personel takvimleri, bekleme listesi ve doluluk analitiği.',
    hotels: 'Oda envanteri, pazar fiyatları, pacing ve resepsiyon.',
  },
};

function useLang(): 'ru' | 'en' | 'tr' {
  const { i18n } = useTranslation();
  const c = (i18n.language || 'ru').slice(0, 2);
  return c === 'en' || c === 'tr' ? c : 'ru';
}

/** Липкие вкладки между решениями (как в макете). */
export function SolTabs({ active }: { active: SolKey }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    const on = box?.querySelector<HTMLElement>('a.on');
    if (box && on) box.scrollLeft = on.offsetLeft - (box.clientWidth - on.offsetWidth) / 2;
  }, [active]);
  return (
    <nav className="sl-tabs" aria-label={t('publicPages.nav.solutions')}>
      <div className="sl-tabs-in" ref={ref}>
        {SOL_KEYS.map((k) => (
          <Link key={k} to={href(k)} className={k === active ? 'on' : ''}>
            {t(`publicPages.nav.${k}`)}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** «Как это работает»: текст + ИИ-сотрудник с бегущей строкой + визуал справа, ниже — шаги процесса. */
export function SolHow(p: {
  k: string;
  t: string;
  d: string;
  role: string;
  ai: string;
  doing: string[];
  flow: Array<[string, string]>;
  children: React.ReactNode;
}) {
  const pal = AI_ROLE_PALETTE[p.role] || AI_ROLE_PALETTE.lead_manager;
  const i = useTick(true, 2200);
  return (
    <section className="lp-sec">
      <div className="sl-split">
        <div className="lh-rv">
          <div className="lp-kick">
            <span className="lp-dot" />
            {p.k}
          </div>
          <h2 className="sl-h2">{p.t}</h2>
          <p className="sl-p">{p.d}</p>
          <div className="sl-ai">
            <span className="lh-fl-av" style={{ background: pal.bg }}>
              <AiCharacter role={p.role} mood="on" />
            </span>
            <div>
              <b>{p.ai}</b>
              <span className="lh-live">
                <i />
                <span key={i % p.doing.length} className="lh-doing-t">
                  {p.doing[i % p.doing.length]}
                </span>
              </span>
            </div>
          </div>
        </div>
        <div className="sl-vis lh-rv">{p.children}</div>
      </div>
      <SolFlow flow={p.flow} />
    </section>
  );
}

function SolFlow({ flow }: { flow: Array<[string, string]> }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref, 0.3);
  const [s, setS] = useState(0);
  const n = flow.length;
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setS((x) => (x + 1) % (n + 1)), 1300);
    return () => clearInterval(t);
  }, [on, n]);
  return (
    <div className="sl-flow lh-rv" ref={ref} style={{ '--n': n } as React.CSSProperties}>
      <div className="sl-flow-line">
        <span style={{ width: (Math.min(s, n - 1) / (n - 1)) * 100 + '%' }} />
      </div>
      {flow.map(([t, d], i) => (
        <div key={t} className={'sl-fs' + (i < s ? ' done' : '') + (i === s ? ' cur' : '')}>
          <span className="sl-fs-c">{i < s ? <Icon name="check" size={14} stroke={2.4} /> : '0' + (i + 1)}</span>
          <b>{t}</b>
          <em>{d}</em>
        </div>
      ))}
    </div>
  );
}

/** Проблема по центру (sl-prob). */
export function SolProb({ k, t, d }: { k: string; t: string; d: string }) {
  return (
    <section className="lp-sec">
      <div className="sl-prob lh-rv">
        <div className="lp-kick">
          <span className="lp-dot" />
          {k}
        </div>
        <h2>{t}</h2>
        <p>{d}</p>
      </div>
    </section>
  );
}

export type SolTblT = { k: string; t: string; d: string; head: string[]; occ?: number; rows: string[][]; note?: string };

/** Таблица: «Имя|подпись» в первой колонке, «ok:Текст» — цветной статус, колонка occ — полоса загрузки. */
export function SolTbl({ T }: { T: SolTblT }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref, 0.2);
  const cell = (v: string, j: number) => {
    if (j === 0 && v.includes('|')) {
      const [a, b] = v.split('|');
      return (
        <>
          <b>{a}</b>
          <em>{b}</em>
        </>
      );
    }
    const m = /^(ok|warn|bad|info):(.*)$/.exec(v);
    if (m) return <span className={'sl-st ' + m[1]}>{m[2]}</span>;
    if (T.occ === j) {
      const n = Number(v);
      return (
        <span className="sl-occ">
          <span className="sl-occ-b">
            <i className={n < 65 ? 'low' : ''} style={{ width: on ? n + '%' : 0 }} />
          </span>
          <b className={n < 65 ? 'low' : ''}>{v}%</b>
        </span>
      );
    }
    return v;
  };
  return (
    <section className="lp-sec">
      <Head k={T.k} t={T.t} d={T.d} />
      {/* lh-rv — на обёртке: React перезаписывает className таблицы при смене on и стёр бы класс появления */}
      <div className="lh-rv">
      <div className={'sl-tbl' + (on ? ' on' : '')} ref={ref}>
        <table>
          <thead>
            <tr>
              {T.head.map((h, j) => (
                <th key={h} className={T.occ && j ? 'r' : ''}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {T.rows.map((r, i) => (
              <tr key={i} style={{ transitionDelay: i * 0.06 + 's' }} className={T.occ && Number(r[T.occ]) < 65 ? 'warn' : ''}>
                {r.map((v, j) => (
                  <td key={j} className={T.occ && j ? 'r' : ''}>
                    {cell(v, j)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
      {T.note && <p className="sl-note lh-rv">{T.note}</p>}
    </section>
  );
}

export type SolFeedT = { k: string; t: string; d: string; rows: Array<[string, string, string, boolean]>; note?: string };

/** Лента событий: время · точка · текст · метка. */
export function SolFeed({ F }: { F: SolFeedT }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref, 0.25);
  return (
    <section className="lp-sec">
      <div className="sl-split sl-feed-w">
        <div className="lh-rv">
          <div className="lp-kick">
            <span className="lp-dot" />
            {F.k}
          </div>
          <h2 className="sl-h2">{F.t}</h2>
          <p className="sl-p">{F.d}</p>
          {F.note && <p className="sl-note">{F.note}</p>}
        </div>
        <div className={'sl-feed' + (on ? ' on' : '')} ref={ref}>
          {F.rows.map(([t, d, q, up], i) => (
            <div key={i} className="sl-feed-r" style={{ transitionDelay: i * 0.08 + 's' }}>
              <span className="sl-feed-t">{t}</span>
              <span className={'sl-feed-dot' + (up ? '' : ' bad')} />
              <span className="sl-feed-d">{d}</span>
              <span className={'sl-st ' + (up ? 'ok' : 'bad')}>{q}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** «Другие решения» — карточки остальных решений. */
export function SolMore({ active, k, t }: { active: SolKey; k: string; t: string }) {
  const { t: tr } = useTranslation();
  const lang = useLang();
  return (
    <section className="lp-sec">
      <Head k={k} t={t} />
      <div className="sl-more">
        {SOL_KEYS.filter((x) => x !== active).map((x, i) => (
          <Link key={x} to={href(x)} className="sl-more-c lh-rv" style={{ transitionDelay: i * 0.04 + 's' }}>
            <span className="sl-more-n">{'0' + (SOL_KEYS.indexOf(x) + 1)}</span>
            <b>{tr(`publicPages.nav.${x}`)}</b>
            <p>{MORE[lang][x]}</p>
            <Icon name="arrow" size={15} />
          </Link>
        ))}
      </div>
    </section>
  );
}
