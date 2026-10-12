/* Анимированные визуалы модулей страницы «Функции» — порт Claude Design lp-features.jsx.
 * Макетные визуалы переделаны под то, что реально есть в продукте: без SDK/GraphQL, моделей
 * атрибуции, RFM, сертификатов и «80+ коннекторов». Цифры — демо, подписаны как пример. */
import React, { useEffect, useState } from 'react';
import { AuraDash, AuScaled } from '../aura/AuraDash';
import { AU_TEMPLATES } from '../aura/auraModel';
import { AiCharacter, AI_ROLE_PALETTE } from '../ai-employees/AiCharacter';
import { landingDemoData, type LandingDemoText } from '../landing/landingDemo';
import { Icon } from '../landing/LandingSections';

export type FLang = 'ru' | 'en' | 'tr';

export const VT = {
  ru: {
    demo: 'Пример на демо-данных',
    src: { h: 'Источники лидов', on: 'подключено', top: 'Лиды по источникам · 7 дней', tiles: ['Сайт', 'Форма', 'WhatsApp', 'Telegram', 'Чат', 'Woo', 'Shopify', 'WordPress', 'Instagram', 'Facebook', 'CSV', 'API'], bars: [['Сайт', 38], ['WhatsApp', 26], ['Instagram', 21], ['Telegram', 15]] as [string, number][] },
    pipe: { h: 'Лиды · канбан', n: 'лидов', cols: ['Новый', 'В работе', 'Ожидание', 'Выигран', 'Проигран'], card: 'Ремонт офиса · €4 800', foot: 'Удалённые — в корзине 30 дней' },
    chan: { h: 'Каналы в карточке клиента', rows: [['WhatsApp', 'Business API, ответ из карточки', '2-way'], ['Telegram', 'Бот и переписка в CRM', '2-way'], ['Email', 'Подключённые ящики и шаблоны', 'IMAP'], ['SMS', 'Из карточки и автоматизаций', 'SMS'], ['Звонки', 'Звонок в клик, запись, расшифровка', 'Voice'], ['Чат на сайте', 'Виджет с AI-консультантом', 'Web']] },
    mk: { h: 'Каналы рекламы · 30 дней', tabs: ['Расход', 'Лиды', 'Выручка'] },
    auto: { h: 'Сценарий · «Новый лид из рекламы»', run: 'Активен', nodes: ['Триггер: новый лид', 'Условие: источник = реклама', 'Назначить ответственного', 'Отправить WhatsApp', 'Подождать 1 день', 'Согласование человеком', 'Задача: позвонить'], cond: 'нет → тег «органика»' },
    bi: 'Отдел продаж · обзор',
    api: { h: 'API · v1', done: '201 Created', foot: 'Токены — в настройках CRM · Zapier, Make, n8n' },
    sec: { h: 'Доступ и защита', foot: 'Данные каждой компании изолированы' },
    ws: { tabs: ['Таблица', 'Kanban', 'Календарь', 'Gantt'], cols: ['Задача', 'Статус', 'Срок'], rows: [['Запуск рекламы', 'В работе', '12.10'], ['Прайс-лист', 'Готово', '08.10'], ['Обучение команды', 'План', '20.10'], ['Импорт клиентов', 'Готово', '05.10']] as string[][], st: ['План', 'В работе', 'Готово'] },
    chat: { q1: 'Сколько лидов пришло из Instagram за неделю?', a1: 'За 7 дней — 21 лид из Instagram, 4 уже в работе.', q2: 'Подними цену «Стандартного номера» на 10% с ноября', act: 'Цена изменена: €80 → €88 с 1 ноября' },
    crew: { rows: [['lead_manager', 'Mila AI', 'Менеджер по лидам', ['Квалифицирует лида с сайта', 'Назначает менеджера']], ['sales_manager', 'Sofia AI', 'Менеджер продаж', ['Готовит follow-up письмо', 'Ищет зависшие сделки']], ['crm_analyst', 'Leo AI', 'Аналитик CRM', ['Собирает отчёт за вчера', 'Отправляет отчёт на почту']]] as [string, string, string, string[]][], appr: 'Ждёт согласования' },
    book: { h: 'Онлайн-запись · неделя', days: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'], free: 'свободно' },
  },
  en: {
    demo: 'Example with demo data',
    src: { h: 'Lead sources', on: 'connected', top: 'Leads by source · 7 days', tiles: ['Website', 'Form', 'WhatsApp', 'Telegram', 'Chat', 'Woo', 'Shopify', 'WordPress', 'Instagram', 'Facebook', 'CSV', 'API'], bars: [['Website', 38], ['WhatsApp', 26], ['Instagram', 21], ['Telegram', 15]] as [string, number][] },
    pipe: { h: 'Leads · Kanban', n: 'leads', cols: ['New', 'In progress', 'Waiting', 'Won', 'Lost'], card: 'Office renovation · €4,800', foot: 'Deleted leads stay in the trash for 30 days' },
    chan: { h: 'Channels inside the client card', rows: [['WhatsApp', 'Business API, reply from the card', '2-way'], ['Telegram', 'Bot and chats in the CRM', '2-way'], ['Email', 'Connected mailboxes and templates', 'IMAP'], ['SMS', 'From the card and automations', 'SMS'], ['Calls', 'Click-to-call, recording, transcription', 'Voice'], ['Website chat', 'Widget with an AI consultant', 'Web']] },
    mk: { h: 'Ad channels · 30 days', tabs: ['Spend', 'Leads', 'Revenue'] },
    auto: { h: 'Scenario · "New lead from ads"', run: 'Active', nodes: ['Trigger: new lead', 'Condition: source = ads', 'Assign an owner', 'Send WhatsApp', 'Wait 1 day', 'Human approval', 'Task: call back'], cond: 'no → tag "organic"' },
    bi: 'Sales team · overview',
    api: { h: 'API · v1', done: '201 Created', foot: 'Tokens live in CRM settings · Zapier, Make, n8n' },
    sec: { h: 'Access and protection', foot: "Each company's data is isolated" },
    ws: { tabs: ['Table', 'Kanban', 'Calendar', 'Gantt'], cols: ['Task', 'Status', 'Due'], rows: [['Ad launch', 'In progress', '12.10'], ['Price list', 'Done', '08.10'], ['Team training', 'Planned', '20.10'], ['Client import', 'Done', '05.10']] as string[][], st: ['Planned', 'In progress', 'Done'] },
    chat: { q1: 'How many leads came from Instagram this week?', a1: '21 leads from Instagram in the last 7 days, 4 already in progress.', q2: 'Raise the "Standard room" price by 10% from November', act: 'Price changed: €80 → €88 from November 1' },
    crew: { rows: [['lead_manager', 'Mila AI', 'Lead manager', ['Qualifies a website lead', 'Assigns a manager']], ['sales_manager', 'Sofia AI', 'Sales manager', ['Drafts a follow-up email', 'Finds stalled deals']], ['crm_analyst', 'Leo AI', 'CRM analyst', ["Builds yesterday's report", 'Emails the report']]] as [string, string, string, string[]][], appr: 'Awaiting approval' },
    book: { h: 'Online booking · week', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], free: 'free' },
  },
  tr: {
    demo: 'Demo verilerle örnek',
    src: { h: 'Talep kaynakları', on: 'bağlı', top: 'Kaynağa göre talepler · 7 gün', tiles: ['Site', 'Form', 'WhatsApp', 'Telegram', 'Sohbet', 'Woo', 'Shopify', 'WordPress', 'Instagram', 'Facebook', 'CSV', 'API'], bars: [['Site', 38], ['WhatsApp', 26], ['Instagram', 21], ['Telegram', 15]] as [string, number][] },
    pipe: { h: 'Talepler · Kanban', n: 'talep', cols: ['Yeni', 'İşlemde', 'Beklemede', 'Kazanıldı', 'Kaybedildi'], card: 'Ofis tadilatı · €4.800', foot: 'Silinenler 30 gün çöp kutusunda kalır' },
    chan: { h: 'Müşteri kartındaki kanallar', rows: [['WhatsApp', 'Business API, karttan yanıt', '2-way'], ['Telegram', "Bot ve CRM'de yazışma", '2-way'], ['E-posta', 'Bağlı kutular ve şablonlar', 'IMAP'], ['SMS', 'Karttan ve otomasyonlardan', 'SMS'], ['Aramalar', 'Tek tıkla arama, kayıt, döküm', 'Voice'], ['Site sohbeti', 'Yapay zekâ danışmanlı widget', 'Web']] },
    mk: { h: 'Reklam kanalları · 30 gün', tabs: ['Harcama', 'Talepler', 'Ciro'] },
    auto: { h: 'Senaryo · "Reklamdan yeni talep"', run: 'Aktif', nodes: ['Tetikleyici: yeni talep', 'Koşul: kaynak = reklam', 'Sorumlu ata', 'WhatsApp gönder', '1 gün bekle', 'İnsan onayı', 'Görev: ara'], cond: 'hayır → "organik" etiketi' },
    bi: 'Satış ekibi · genel bakış',
    api: { h: 'API · v1', done: '201 Created', foot: 'Anahtarlar CRM ayarlarında · Zapier, Make, n8n' },
    sec: { h: 'Erişim ve koruma', foot: 'Her şirketin verileri ayrı tutulur' },
    ws: { tabs: ['Tablo', 'Kanban', 'Takvim', 'Gantt'], cols: ['Görev', 'Durum', 'Tarih'], rows: [['Reklam başlatma', 'İşlemde', '12.10'], ['Fiyat listesi', 'Tamam', '08.10'], ['Ekip eğitimi', 'Plan', '20.10'], ['Müşteri aktarımı', 'Tamam', '05.10']] as string[][], st: ['Plan', 'İşlemde', 'Tamam'] },
    chat: { q1: "Bu hafta Instagram'dan kaç talep geldi?", a1: "Son 7 günde Instagram'dan 21 talep, 4'ü işlemde.", q2: '"Standart oda" fiyatını kasımdan itibaren %10 artır', act: 'Fiyat değişti: €80 → €88, 1 Kasım itibarıyla' },
    crew: { rows: [['lead_manager', 'Mila AI', 'Talep yöneticisi', ['Site talebini nitelendirir', 'Yönetici atar']], ['sales_manager', 'Sofia AI', 'Satış yöneticisi', ['Takip e-postası hazırlar', 'Bekleyen satışları bulur']], ['crm_analyst', 'Leo AI', 'CRM analisti', ['Dünün raporunu hazırlar', 'Raporu e-postayla gönderir']]] as [string, string, string, string[]][], appr: 'Onay bekliyor' },
    book: { h: 'Online randevu · hafta', days: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'], free: 'boş' },
  },
};
type V = (typeof VT)['ru'];

function useTick(on: boolean, ms: number, n: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), ms);
    return () => clearInterval(t);
  }, [on, ms, n]);
  return i;
}

const Demo = ({ v }: { v: V }) => <div className="fv-demo">{v.demo}</div>;

function VSrc({ on, v }: { on: boolean; v: V }) {
  const i = useTick(on, 320, v.src.tiles.length + 6);
  return (
    <div className="fv">
      <div className="fv-h">
        <span>{v.src.h}</span>
        <b>
          {Math.min(v.src.tiles.length, i + 1)} {v.src.on}
        </b>
      </div>
      <div className="fv-src">
        {v.src.tiles.map((s, k) => (
          <span key={s} className={k <= i ? 'on' : ''}>
            {s}
          </span>
        ))}
      </div>
      <div className="fv-h" style={{ marginTop: 18 }}>
        <span>{v.src.top}</span>
      </div>
      {v.src.bars.map(([n, p], k) => (
        <div key={n} className="fv-bar">
          <span>{n}</span>
          <div>
            <i style={{ width: on ? p * 2.2 + '%' : 0, transitionDelay: k * 0.1 + 's' }} />
          </div>
          <b>{p}%</b>
        </div>
      ))}
      <Demo v={v} />
    </div>
  );
}

function VPipe({ on, v }: { on: boolean; v: V }) {
  const counts = [14, 9, 6, 5, 3];
  const i = useTick(on, 1100, 4);
  return (
    <div className="fv">
      <div className="fv-h">
        <span>{v.pipe.h}</span>
        <b>
          37 {v.pipe.n}
        </b>
      </div>
      <div className="fv-kan">
        {v.pipe.cols.map((n, k) => (
          <div key={n}>
            <em>
              <span>{n}</span>
              <b>{counts[k]}</b>
            </em>
            <span />
            {k < 3 && <span />}
            {k === i && <span className="mv">{v.pipe.card}</span>}
          </div>
        ))}
      </div>
      <div className="fv-h" style={{ marginTop: 14, marginBottom: 0 }}>
        <span>{v.pipe.foot}</span>
      </div>
    </div>
  );
}

function VChan({ on, v }: { on: boolean; v: V }) {
  const i = useTick(on, 950, v.chan.rows.length);
  return (
    <div className="fv">
      <div className="fv-h">
        <span>{v.chan.h}</span>
      </div>
      {v.chan.rows.map(([t, s, k], j) => (
        <div key={t} className={'fv-ch' + (j === i ? ' on' : '')}>
          <span>
            <b>{t}</b>
            <em>{s}</em>
          </span>
          <code className="lp-code">{k}</code>
        </div>
      ))}
    </div>
  );
}

function VMk({ on, v }: { on: boolean; v: V }) {
  const names = ['Google Ads', 'Meta Ads', 'Yandex Direct', 'VK Ads'];
  const data = [
    [2480, 1920, 1150, 640],
    [148, 132, 71, 39],
    [18400, 15200, 6900, 2100],
  ];
  const [m, setM] = useState<number | null>(null);
  const auto = useTick(on && m === null, 2000, 3);
  const k = m ?? auto;
  const row = data[k];
  const mx = Math.max(...row);
  const fmt = (x: number) => (k === 1 ? String(x) : '€' + x.toLocaleString('en-US'));
  return (
    <div className="fv">
      <div className="fv-h">
        <span>{v.mk.h}</span>
      </div>
      <div className="fv-tabs">
        {v.mk.tabs.map((n, j) => (
          <button type="button" key={n} className={j === k ? 'on' : ''} onClick={() => setM(j)}>
            {n}
          </button>
        ))}
      </div>
      {names.map((n, j) => (
        <div key={n} className="fv-bar">
          <span>{n}</span>
          <div>
            <i style={{ width: on ? (row[j] / mx) * 100 + '%' : 0 }} />
          </div>
          <b>{fmt(row[j])}</b>
        </div>
      ))}
      <Demo v={v} />
    </div>
  );
}

function VAuto({ on, v }: { on: boolean; v: V }) {
  const N = v.auto.nodes;
  const i = useTick(on, 800, N.length + 1);
  return (
    <div className="fv">
      <div className="fv-h">
        <span>{v.auto.h}</span>
        <span className="lh-on">
          <i />
          {v.auto.run}
        </span>
      </div>
      <div className="fv-flow">
        {N.map((n, k) => (
          <div key={n} className={'fv-node' + (k < i ? ' done' : '') + (k === i ? ' cur' : '') + (k === 1 ? ' cond' : '')}>
            <i />
            {n}
            {k === 1 && <em>{v.auto.cond}</em>}
          </div>
        ))}
      </div>
    </div>
  );
}

function VBi({ v, demo }: { v: V; demo: LandingDemoText }) {
  const tpl = AU_TEMPLATES[0];
  const data = React.useMemo(() => landingDemoData(demo), [demo]);
  return (
    <div className="lp-shot">
      <div className="lh-chrome">
        <i />
        <i />
        <i />
        <span>crm.lumiva.agency/analytics</span>
        <em>{v.demo}</em>
      </div>
      <div className="lp-shot-d">
        <AuScaled width={1240}>
          <AuraDash title={v.bi} sources={tpl.sources} widgets={tpl.widgets} theme="lumiva" density="normal" data={data} period="30d" still />
        </AuScaled>
      </div>
    </div>
  );
}

const API_CODE = {
  cURL: `curl -X POST https://crm.lumiva.agency/v1/public/leads \\
  -H "Content-Type: application/json" \\
  -d '{
    "apiToken": "<site token>",
    "name": "Anna",
    "email": "anna@example.com",
    "phone": "+90 555 000 00 00",
    "source": "landing"
  }'`,
  JavaScript: `await fetch('https://crm.lumiva.agency/v1/public/leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    apiToken: SITE_TOKEN,
    name: 'Anna',
    email: 'anna@example.com',
    source: 'landing',
  }),
});`,
  Webhook: `POST https://your-site.com/hooks/crm
Content-Type: application/json

{
  "triggerData": {
    "leadId": "…",
    "status": "won"
  }
}`,
};

function VApi({ on, v }: { on: boolean; v: V }) {
  const ks = Object.keys(API_CODE) as (keyof typeof API_CODE)[];
  const [t, setT] = useState(0);
  const code = API_CODE[ks[t]];
  const [c, setC] = useState(0);
  const pick = (j: number) => {
    setT(j);
    setC(0);
  };
  useEffect(() => {
    if (!on || c >= code.length) return;
    const tm = setTimeout(() => setC((x) => x + 3), 14);
    return () => clearTimeout(tm);
  }, [on, c, code]);
  return (
    <div className="fv fv-dark">
      <div className="fv-h">
        <span>{v.api.h}</span>
        <b>{c >= code.length ? (ks[t] === 'Webhook' ? 'POST →' : v.api.done) : ks[t] === 'Webhook' ? '' : 'POST /v1/public/leads'}</b>
      </div>
      <div className="fv-tabs d">
        {ks.map((k, j) => (
          <button type="button" key={k} className={j === t ? 'on' : ''} onClick={() => pick(j)}>
            {k}
          </button>
        ))}
      </div>
      <pre>
        {code.slice(0, c)}
        <i className="lh-caret" />
      </pre>
      <div className="fv-h" style={{ marginBottom: 0 }}>
        <span>{v.api.foot}</span>
      </div>
    </div>
  );
}

function VSec({ on, v, bullets }: { on: boolean; v: V; bullets: Array<{ b: string; s: string }> }) {
  const i = useTick(on, 600, bullets.length + 6);
  return (
    <div className="fv">
      <div className="fv-h">
        <span>{v.sec.h}</span>
      </div>
      {bullets.map((x, k) => (
        <div key={x.b} className={'fv-sec' + (k <= i ? ' in' : '')}>
          <i>
            <Icon name="shield" size={14} />
          </i>
          <span>
            <b>{x.b}</b>
            <em>{x.s.replace(/^\s*—\s*/, '')}</em>
          </span>
        </div>
      ))}
      <div className="fv-res">
        <Icon name="check" size={14} stroke={2.2} />
        <span>{v.sec.foot}</span>
      </div>
    </div>
  );
}

function VWs({ on, v }: { on: boolean; v: V }) {
  const [m, setM] = useState<number | null>(null);
  const auto = useTick(on && m === null, 2200, 4);
  const k = m ?? auto;
  const rows = v.ws.rows;
  const stIdx = (s: string) => Math.max(0, v.ws.st.indexOf(s));
  return (
    <div className="fv">
      <div className="fv-tabs">
        {v.ws.tabs.map((n, j) => (
          <button type="button" key={n} className={j === k ? 'on' : ''} onClick={() => setM(j)}>
            {n}
          </button>
        ))}
      </div>
      <div className="fv-ws" key={k}>
        {k === 0 && (
          <>
            <div className="fv-ws-row">
              {v.ws.cols.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            {rows.map((r, j) => (
              <div className="fv-ws-row" key={r[0]} style={{ animationDelay: j * 0.06 + 's' }}>
                {r.map((c, ci) => (
                  <span key={ci}>{c}</span>
                ))}
              </div>
            ))}
          </>
        )}
        {k === 1 && (
          <div className="fv-ws-kan">
            {v.ws.st.map((s) => (
              <div key={s}>
                <em className="lp-code" style={{ alignSelf: 'flex-start' }}>
                  {s}
                </em>
                {rows
                  .filter((r) => r[1] === s)
                  .map((r, j) => (
                    <span key={r[0]} style={{ animationDelay: j * 0.08 + 's' }}>
                      {r[0]}
                    </span>
                  ))}
              </div>
            ))}
          </div>
        )}
        {k === 2 && (
          <div className="fv-ws-cal">
            {Array.from({ length: 28 }, (_, d) => {
              const ev = [4, 7, 11, 19].includes(d);
              return (
                <span key={d} className={ev ? 'ev' : ''} style={ev ? { animationDelay: d * 0.02 + 's' } : undefined}>
                  {d + 1}
                </span>
              );
            })}
          </div>
        )}
        {k === 3 && (
          <div className="fv-ws-gantt">
            {rows.map((r, j) => (
              <div key={r[0]}>
                <span>{r[0]}</span>
                <span>
                  <i style={{ width: [70, 40, 55, 30][j] + '%', marginLeft: [0, 10, 40, 4][j] + '%', animationDelay: j * 0.1 + 's', opacity: stIdx(r[1]) === 2 ? 0.45 : 1 }} />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VChat({ on, v }: { on: boolean; v: V }) {
  const s = useTick(on, 1300, 7);
  return (
    <div className="fv">
      <div className="fv-chat">
        {s >= 0 && <div className="fv-msg me">{v.chat.q1}</div>}
        {s >= 1 && (
          <div className="fv-msg ai">
            {s === 1 ? (
              <span className="lh-think">
                <i />
                <i />
                <i />
              </span>
            ) : (
              v.chat.a1
            )}
          </div>
        )}
        {s >= 3 && <div className="fv-msg me">{v.chat.q2}</div>}
        {s >= 4 && (
          <div className="fv-act">
            {s === 4 ? (
              <span className="lh-think">
                <i />
                <i />
                <i />
              </span>
            ) : (
              <>
                <Icon name="check" size={13} stroke={2.4} />
                {v.chat.act}
              </>
            )}
          </div>
        )}
      </div>
      <Demo v={v} />
    </div>
  );
}

function Doing({ list, ms }: { list: string[]; ms: number }) {
  const i = useTick(true, ms, list.length);
  return (
    <span key={i} className="lh-doing-t">
      {list[i]}
    </span>
  );
}

function VCrew({ on, v }: { on: boolean; v: V }) {
  const i = useTick(on, 1800, v.crew.rows.length);
  return (
    <div className="fv">
      {v.crew.rows.map(([role, name, job, list], j) => (
        <div key={role} className={'fv-crew' + (j === i ? ' on' : '')}>
          <span className="fv-crew-av" style={{ background: (AI_ROLE_PALETTE[role] || AI_ROLE_PALETTE.lead_manager).bg }}>
            <AiCharacter role={role} mood="on" />
          </span>
          <span>
            <b>{name}</b>
            <em>{job}</em>
            <div className="lh-doing">
              <span className="lh-think">
                <i />
                <i />
                <i />
              </span>
              <Doing list={list} ms={2400 + j * 500} />
            </div>
            {role === 'sales_manager' && <span className="fv-appr">{v.crew.appr}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function VBook({ on, v }: { on: boolean; v: V }) {
  const times = ['09:00', '10:00', '11:00', '12:00', '13:00'];
  const base = [1, 3, 6, 8, 12, 15, 17, 21];
  const extra = [4, 10, 19, 23];
  const i = useTick(on, 900, extra.length + 3);
  const booked = new Set([...base, ...extra.slice(0, i)]);
  const fresh = i > 0 && i <= extra.length ? extra[i - 1] : -1;
  return (
    <div className="fv">
      <div className="fv-h">
        <span>{v.book.h}</span>
        <b>
          {25 - booked.size} {v.book.free}
        </b>
      </div>
      <div className="fv-book">
        <em />
        {v.book.days.map((d) => (
          <b key={d}>{d}</b>
        ))}
        {times.map((tm, r) => (
          <React.Fragment key={tm}>
            <em>{tm}</em>
            {v.book.days.map((_, c) => {
              const idx = r * 5 + c;
              return <span key={c} className={idx === fresh ? 'new' : booked.has(idx) ? 'on' : ''} />;
            })}
          </React.Fragment>
        ))}
      </div>
      <Demo v={v} />
    </div>
  );
}

/** Визуал по номеру модуля (порядок модулей — как в T.modules). */
export function FeatureVisual({ idx, on, lang, bullets, demo }: { idx: number; on: boolean; lang: FLang; bullets: Array<{ b: string; s: string }>; demo: LandingDemoText }) {
  const v = VT[lang];
  switch (idx) {
    case 0:
      return <VSrc on={on} v={v} />;
    case 1:
      return <VPipe on={on} v={v} />;
    case 2:
      return <VChan on={on} v={v} />;
    case 3:
      return <VMk on={on} v={v} />;
    case 4:
      return <VAuto on={on} v={v} />;
    case 5:
      return <VBi v={v} demo={demo} />;
    case 6:
      return <VApi on={on} v={v} />;
    case 7:
      return <VSec on={on} v={v} bullets={bullets} />;
    case 8:
      return <VWs on={on} v={v} />;
    case 9:
      return <VChat on={on} v={v} />;
    case 10:
      return <VCrew on={on} v={v} />;
    default:
      return <VBook on={on} v={v} />;
  }
}
