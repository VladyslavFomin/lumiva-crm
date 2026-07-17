import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PublicHeader } from '../../components/public/PublicHeader';
import { PublicFooter } from '../../components/public/PublicFooter';

type Lang = 'ru' | 'en' | 'tr';

const FEATURE_ICONS = ['globe', 'doc', 'lock', 'link', 'doc2', 'target'] as const;
type FeatureIcon = (typeof FEATURE_ICONS)[number];

const FeatureIconGlyph: React.FC<{ name: FeatureIcon }> = ({ name }) => {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'globe':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.8 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.8-3.8-9s1.3-6.4 3.8-9z" /></svg>;
    case 'doc':
    case 'doc2':
      return <svg {...common}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /><path d="M9.5 13h5M9.5 16.5h5" /></svg>;
    case 'lock':
      return <svg {...common}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>;
    case 'link':
      return <svg {...common}><path d="M9 15l6-6" /><path d="M8 17l-2.5 2.5a3.5 3.5 0 01-5-5L3 12" /><path d="M16 7l2.5-2.5a3.5 3.5 0 015 5L21 12" /></svg>;
    case 'target':
      return <svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.6" fill="currentColor" /></svg>;
  }
};

const ArrowRight: React.FC = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
);

const T = {
  ru: {
    kicker: 'РЕШЕНИЕ · СЧЕТА КЛИЕНТОВ',
    title1: 'Финансовый профиль каждого клиента',
    title2: '— в одной карточке.',
    sub: 'Мультивалютные балансы, полная история операций, лимиты и холды. Больше не нужно сверять три экспорта из банка, кассы и CRM — все деньги клиента видны в реальном времени, с привязкой к сделкам и менеджеру.',
    ctaPrimary: 'Попробовать бесплатно',
    ctaSecondary: 'Смотреть демо',
    heroLabel: 'ACME LOGISTICS LLC',
    heroTitle: 'Клиентский счёт · #20240803',
    heroTag: 'Активен',
    balances: [
      { cur: 'БАЛАНС · EUR', amt: '€36,900.00', delta: '+€4,200 за 30 дней' },
      { cur: 'БАЛАНС · USD', amt: '$205,930.13', delta: '+$18,120 за 30 дней' },
    ],
    txLabel: 'ПОСЛЕДНИЕ ОПЕРАЦИИ',
    tx: [
      { who: 'Пополнение · банковский перевод', meta: 'сегодня, 14:02 · IBAN TR33 0001…4521', amt: '+€12,000.00', dir: 'pos' },
      { who: 'Списание · счёт #INV-3391', meta: 'вчера, 09:40 · проект «Логистика Q3»', amt: '−€3,450.00', dir: 'neg' },
      { who: 'Возврат средств', meta: '12 июня · частичный возврат', amt: '+€890.00', dir: 'pos' },
    ],
    s1Kicker: '01 · ЗАДАЧА',
    s1Title: 'Деньги клиента живут в трёх системах одновременно.',
    s1Summary: 'Баланс — в 1С или банке, история операций — в Excel у бухгалтера, лимиты и договорённости — в переписке менеджера. Когда клиент звонит с вопросом «где мои деньги», ответ собирают по кусочкам 20 минут.',
    features: [
      { n: '01', ic: 'globe' as FeatureIcon, t: 'Мультивалютные балансы', d: 'EUR, USD, TRY и любые другие валюты — отдельные балансы на одном счёте клиента, с историей курса на дату операции.' },
      { n: '02', ic: 'doc' as FeatureIcon, t: 'Полная лента операций', d: 'Пополнения, списания, возвраты, корректировки — с привязкой к сделке, счёту и ответственному менеджеру.' },
      { n: '03', ic: 'lock' as FeatureIcon, t: 'Лимиты и холды', d: 'Кредитный лимит, резервирование под незакрытые сделки, автоблокировка при просрочке оплаты.' },
      { n: '04', ic: 'link' as FeatureIcon, t: 'Переводы между счетами', d: 'Внутренние переводы между клиентскими счетами и юрлицами группы — без выхода в банк-клиент.' },
      { n: '05', ic: 'doc2' as FeatureIcon, t: 'Выписки и акты сверки', d: 'PDF-выписка за период в один клик — с печатью и подписью, на языке клиента.' },
      { n: '06', ic: 'target' as FeatureIcon, t: 'Интеграция с продажами', d: 'Баланс клиента виден прямо в карточке сделки — менеджер не переключается между вкладками.' },
    ],
    s2Kicker: '02 · КАК ЭТО РАБОТАЕТ',
    s2Title: 'От создания счёта до сверки за секунды.',
    s2Summary: 'Четыре шага — и финансовый профиль клиента полностью прозрачен для команды и для него самого.',
    steps: [
      { t: 'Открытие счёта', d: 'Счёт создаётся автоматически при первой сделке или вручную из карточки компании. Валюта, лимит и ответственный назначаются сразу.' },
      { t: 'Операции', d: 'Пополнения из банка подтягиваются по API, списания создаются из счетов и актов. Ручная корректировка — с обязательным комментарием.' },
      { t: 'Контроль лимитов', d: 'При достижении лимита или холде система блокирует новые отгрузки и уведомляет менеджера и бухгалтерию.' },
      { t: 'Сверка и отчёт', d: 'В конце периода — автоматический акт сверки в PDF, с историей операций и итоговым балансом на дату.' },
    ],
    s3Kicker: '03 · ЖУРНАЛ ОПЕРАЦИЙ',
    s3Title: 'Каждая операция — с полным контекстом.',
    s3Summary: 'Кто провёл, по какому документу, в какой валюте и с каким статусом — без домыслов и звонков в бухгалтерию.',
    ledgerHead: { date: 'Дата', op: 'Операция', doc: 'Документ', cur: 'Валюта', status: 'Статус', amt: 'Сумма' },
    ledger: [
      { date: '16.07.2026', op: 'Пополнение · банк', doc: 'TR33 0001…4521', cur: 'EUR', status: 'ok', amt: '+12,000.00' },
      { date: '15.07.2026', op: 'Списание · счёт', doc: 'INV-3391', cur: 'EUR', status: 'ok', amt: '−3,450.00' },
      { date: '14.07.2026', op: 'Резерв под сделку', doc: 'DEAL-8842', cur: 'USD', status: 'hold', amt: '−18,000.00' },
      { date: '12.07.2026', op: 'Возврат средств', doc: 'RET-118', cur: 'EUR', status: 'ok', amt: '+890.00' },
      { date: '09.07.2026', op: 'Перевод между счетами', doc: 'TRF-552', cur: 'USD', status: 'ok', amt: '−5,000.00' },
    ],
    statusLabel: { ok: 'Проведено', hold: 'Холд' },
    s4Kicker: '04 · СЧЕТА С САЙТА',
    s4Title: 'Мультивалютный профиль в разрезе площадки.',
    s4Summary: 'Баланс CRM, операционный баланс, накопленное, кредитная линия, инвестировано, начислено — восемь показателей на каждый счёт, без единого ручного пересчёта.',
    siteAcctFields: { crm: 'Баланс CRM', op: 'Опер. баланс', accrued: 'Накоплено', credit: 'Кредитный баланс', invested: 'Инвестировано', charged: 'Начислено', pending: 'Ожидается', writeoff: 'Списание' },
    siteAccts: [
      { num: '20220502-000007-777', cur: 'USD', crm: '205 930.13', op: '91 439.96', accrued: '298 050.21', credit: '−183 560.04', invested: '1 023 000.00', charged: '918 994.00', pending: '0.00', writeoff: '−191 962.75' },
      { num: '20240803-444786-888', cur: 'EUR', crm: '36 900.00', op: '0.00', accrued: '36 900.00', credit: '0.00', invested: '0.00', charged: '0.00', pending: '0.00', writeoff: '0.00' },
    ],
    s5Kicker: '05 · ИНВЕСТИЦИИ КЛИЕНТА',
    s5Title: 'Не просто баланс — портфель клиента.',
    s5Summary: 'Если ваш бизнес управляет деньгами клиентов дальше простого счёта — видно, во что вложено, сколько ожидается профита и по какой категории актива.',
    investAmount: 'Сумма',
    investProfit: 'Ожид. профит',
    invest: [
      { name: 'BEAUTY HOUSE', cat: 'vip services · 50 000', badge: 'VIP', desc: 'Beauty salon — доля в сети салонов красоты', amount: '7 000.00' },
      { name: 'Network of bakeries & sweets', cat: 'bakery · 350 000', badge: 'BAKERY', desc: 'Инвестиции в кондитерский бизнес', amount: '5 000.00' },
      { name: 'FASHION HOUSE', cat: 'VIP · 100 000', badge: 'VIP', desc: 'Эксклюзивный личный бренд', amount: '10 000.00' },
      { name: 'Smart Logistics Hub', cat: 'logistics · 220 000', badge: 'GROWTH', desc: 'Региональная логистическая сеть', amount: '15 000.00' },
    ],
    s6Kicker: '06 · ПЕРЕВОДЫ МЕЖДУ СЧЕТАМИ',
    s6Title: 'Внутренние переводы — с курсом на дату операции.',
    s6Summary: '100 переводов у одного клиента — не редкость. Каждый — с отправителем, получателем, курсом конвертации и итоговой зачисленной суммой.',
    transferHead: { date: 'Дата', from: 'Отправитель', to: 'Получатель', cur: 'Валюта', amt: 'Сумма', rate: 'Курс', credited: 'Зачислено' },
    transfers: [
      { date: '24.01.2024', from: 'Клиент А. Демиров', to: 'Клиент А. Демиров', cur: 'USD', amt: '215.00', rate: '1.00', credited: '215.00' },
      { date: '26.01.2024', from: 'Клиент А. Демиров', to: 'Клиент А. Демиров', cur: 'USD', amt: '7,514.00', rate: '1.00', credited: '7,514.00' },
      { date: '31.01.2024', from: 'Клиент А. Демиров', to: 'Клиент А. Демиров', cur: 'USD', amt: '27,000.00', rate: '1.00', credited: '27,000.00' },
      { date: '18.02.2024', from: 'Клиент А. Демиров', to: 'Клиент А. Демиров', cur: 'USD', amt: '1,000.00', rate: '1.00', credited: '1,000.00' },
      { date: '02.03.2024', from: 'Vantage Trading LLC', to: 'Клиент А. Демиров', cur: 'EUR', amt: '500.00', rate: '1.07', credited: '535.00' },
    ],
    metrics: [
      { v: '12 мин', l: 'среднее время закрытия месяца вместо 3 часов' },
      { v: '100%', l: 'операций с привязкой к ответственному менеджеру' },
      { v: '0', l: 'расхождений при автосверке с банком' },
      { v: '6', l: 'валют поддерживается на одном клиентском счёте' },
    ],
    quote: '«Раньше сверка балансов с 40 контрагентами занимала у бухгалтерии два дня в конце месяца. Сейчас акт сверки формируется по клику, а менеджеры продаж видят лимит клиента прямо в сделке — это убрало половину звонков "а сколько у него осталось".»',
    quoteName: 'Ольга Крамер',
    quoteRole: 'Финансовый директор · Northwave Logistics',
    ctaKicker: 'Готовы навести порядок в счетах?',
    ctaTitle: '14 дней бесплатно. Импорт балансов из 1С и банка — за наш счёт.',
    ctaBtn1: 'Создать аккаунт',
    ctaBtn2: 'Связаться с командой',
  },
  en: {
    kicker: 'SOLUTION · CLIENT ACCOUNTS',
    title1: 'A financial profile for every client',
    title2: '— in one card.',
    sub: 'Multi-currency balances, a full operation history, limits and holds. No more reconciling three exports from the bank, the till and the CRM — every dollar of a client\'s money is visible in real time, tied to deals and to the owning manager.',
    ctaPrimary: 'Try for free',
    ctaSecondary: 'Watch demo',
    heroLabel: 'ACME LOGISTICS LLC',
    heroTitle: 'Client account · #20240803',
    heroTag: 'Active',
    balances: [
      { cur: 'BALANCE · EUR', amt: '€36,900.00', delta: '+€4,200 in 30 days' },
      { cur: 'BALANCE · USD', amt: '$205,930.13', delta: '+$18,120 in 30 days' },
    ],
    txLabel: 'RECENT TRANSACTIONS',
    tx: [
      { who: 'Deposit · bank transfer', meta: 'today, 14:02 · IBAN TR33 0001…4521', amt: '+€12,000.00', dir: 'pos' },
      { who: 'Charge · invoice #INV-3391', meta: 'yesterday, 09:40 · project "Logistics Q3"', amt: '−€3,450.00', dir: 'neg' },
      { who: 'Refund', meta: 'Jun 12 · partial refund', amt: '+€890.00', dir: 'pos' },
    ],
    s1Kicker: '01 · THE PROBLEM',
    s1Title: 'A client\'s money lives in three systems at once.',
    s1Summary: 'The balance sits in the accounting system or the bank, the operation history is in an accountant\'s spreadsheet, limits and agreements live in a manager\'s inbox. When a client calls asking "where is my money", the answer gets pieced together over 20 minutes.',
    features: [
      { n: '01', ic: 'globe' as FeatureIcon, t: 'Multi-currency balances', d: 'EUR, USD, TRY and any other currency — separate balances on one client account, with the exchange rate history for each operation date.' },
      { n: '02', ic: 'doc' as FeatureIcon, t: 'A full operation feed', d: 'Deposits, charges, refunds, adjustments — tied to a deal, an invoice and the responsible manager.' },
      { n: '03', ic: 'lock' as FeatureIcon, t: 'Limits and holds', d: 'A credit limit, reservations for open deals, automatic blocking on overdue payments.' },
      { n: '04', ic: 'link' as FeatureIcon, t: 'Transfers between accounts', d: 'Internal transfers between client accounts and legal entities in the group — no need to open the bank portal.' },
      { n: '05', ic: 'doc2' as FeatureIcon, t: 'Statements & reconciliation acts', d: 'A one-click PDF statement for the period — signed and stamped, in the client\'s language.' },
      { n: '06', ic: 'target' as FeatureIcon, t: 'Sales integration', d: 'The client balance is visible right inside the deal card — the manager never switches tabs.' },
    ],
    s2Kicker: '02 · HOW IT WORKS',
    s2Title: 'From opening an account to reconciliation, in seconds.',
    s2Summary: 'Four steps and the client\'s financial profile is fully transparent — to the team and to the client.',
    steps: [
      { t: 'Opening an account', d: 'The account is created automatically on the first deal, or manually from the company card. Currency, limit and owner are set right away.' },
      { t: 'Operations', d: 'Bank deposits are pulled in via API, charges are generated from invoices and acts. Manual adjustments require a comment.' },
      { t: 'Limit control', d: 'When a limit or hold is hit, the system blocks new shipments and notifies the manager and finance.' },
      { t: 'Reconciliation & report', d: 'At period close — an automatic PDF reconciliation act, with the full operation history and the closing balance.' },
    ],
    s3Kicker: '03 · OPERATION LEDGER',
    s3Title: 'Every operation with full context.',
    s3Summary: 'Who posted it, on what document, in what currency and with what status — no guessing, no calls to accounting.',
    ledgerHead: { date: 'Date', op: 'Operation', doc: 'Document', cur: 'Currency', status: 'Status', amt: 'Amount' },
    ledger: [
      { date: '2026-07-16', op: 'Deposit · bank', doc: 'TR33 0001…4521', cur: 'EUR', status: 'ok', amt: '+12,000.00' },
      { date: '2026-07-15', op: 'Charge · invoice', doc: 'INV-3391', cur: 'EUR', status: 'ok', amt: '−3,450.00' },
      { date: '2026-07-14', op: 'Deal reserve', doc: 'DEAL-8842', cur: 'USD', status: 'hold', amt: '−18,000.00' },
      { date: '2026-07-12', op: 'Refund', doc: 'RET-118', cur: 'EUR', status: 'ok', amt: '+890.00' },
      { date: '2026-07-09', op: 'Account transfer', doc: 'TRF-552', cur: 'USD', status: 'ok', amt: '−5,000.00' },
    ],
    statusLabel: { ok: 'Posted', hold: 'Hold' },
    s4Kicker: '04 · SITE ACCOUNTS',
    s4Title: 'A multi-currency profile broken down by site.',
    s4Summary: 'CRM balance, operating balance, accrued, credit line, invested, charged — eight figures per account, with zero manual recalculation.',
    siteAcctFields: { crm: 'CRM balance', op: 'Operating balance', accrued: 'Accrued', credit: 'Credit balance', invested: 'Invested', charged: 'Charged', pending: 'Pending', writeoff: 'Write-off' },
    siteAccts: [
      { num: '20220502-000007-777', cur: 'USD', crm: '205,930.13', op: '91,439.96', accrued: '298,050.21', credit: '−183,560.04', invested: '1,023,000.00', charged: '918,994.00', pending: '0.00', writeoff: '−191,962.75' },
      { num: '20240803-444786-888', cur: 'EUR', crm: '36,900.00', op: '0.00', accrued: '36,900.00', credit: '0.00', invested: '0.00', charged: '0.00', pending: '0.00', writeoff: '0.00' },
    ],
    s5Kicker: '05 · CLIENT INVESTMENTS',
    s5Title: 'Not just a balance — a client portfolio.',
    s5Summary: 'If your business manages client money beyond a plain account, you can see exactly what\'s invested, expected profit and the asset category.',
    investAmount: 'Amount',
    investProfit: 'Expected profit',
    invest: [
      { name: 'BEAUTY HOUSE', cat: 'vip services · 50,000', badge: 'VIP', desc: 'Beauty salon — a stake in a salon chain', amount: '7,000.00' },
      { name: 'Network of bakeries & sweets', cat: 'bakery · 350,000', badge: 'BAKERY', desc: 'Investment in a confectionery business', amount: '5,000.00' },
      { name: 'FASHION HOUSE', cat: 'VIP · 100,000', badge: 'VIP', desc: 'An exclusive personal brand', amount: '10,000.00' },
      { name: 'Smart Logistics Hub', cat: 'logistics · 220,000', badge: 'GROWTH', desc: 'A regional logistics network', amount: '15,000.00' },
    ],
    s6Kicker: '06 · ACCOUNT TRANSFERS',
    s6Title: 'Internal transfers — at the exchange rate of the day.',
    s6Summary: '100 transfers for a single client is not unusual. Every one has a sender, a recipient, a conversion rate and a final credited amount.',
    transferHead: { date: 'Date', from: 'Sender', to: 'Recipient', cur: 'Currency', amt: 'Amount', rate: 'Rate', credited: 'Credited' },
    transfers: [
      { date: '2024-01-24', from: 'Client A. Demirov', to: 'Client A. Demirov', cur: 'USD', amt: '215.00', rate: '1.00', credited: '215.00' },
      { date: '2024-01-26', from: 'Client A. Demirov', to: 'Client A. Demirov', cur: 'USD', amt: '7,514.00', rate: '1.00', credited: '7,514.00' },
      { date: '2024-01-31', from: 'Client A. Demirov', to: 'Client A. Demirov', cur: 'USD', amt: '27,000.00', rate: '1.00', credited: '27,000.00' },
      { date: '2024-02-18', from: 'Client A. Demirov', to: 'Client A. Demirov', cur: 'USD', amt: '1,000.00', rate: '1.00', credited: '1,000.00' },
      { date: '2024-03-02', from: 'Vantage Trading LLC', to: 'Client A. Demirov', cur: 'EUR', amt: '500.00', rate: '1.07', credited: '535.00' },
    ],
    metrics: [
      { v: '12 min', l: 'average month-close time, down from 3 hours' },
      { v: '100%', l: 'of operations tied to a responsible manager' },
      { v: '0', l: 'discrepancies on auto-reconciliation with the bank' },
      { v: '6', l: 'currencies supported on a single client account' },
    ],
    quote: '"Reconciling balances with 40 counterparties used to take our accounting team two days at month close. Now the reconciliation act is generated with one click, and sales reps see the client\'s limit right inside the deal — it cut \'how much does he have left\' calls in half."',
    quoteName: 'Olga Kramer',
    quoteRole: 'CFO · Northwave Logistics',
    ctaKicker: 'Ready to get your accounts in order?',
    ctaTitle: '14 days free. We import balances from your accounting system and bank at no cost.',
    ctaBtn1: 'Create account',
    ctaBtn2: 'Talk to the team',
  },
  tr: {
    kicker: 'ÇÖZÜM · MÜŞTERİ HESAPLARI',
    title1: 'Her müşterinin finansal profili',
    title2: '— tek bir kartta.',
    sub: 'Çoklu para birimi bakiyeleri, tam işlem geçmişi, limitler ve bloklar. Bankadan, kasadan ve CRM\'den üç ayrı dökümü karşılaştırmaya gerek yok — müşterinin tüm parası, anlaşmalara ve sorumlu temsilciye bağlı olarak gerçek zamanlı görünür.',
    ctaPrimary: 'Ücretsiz deneyin',
    ctaSecondary: 'Demo izleyin',
    heroLabel: 'ACME LOGISTICS LLC',
    heroTitle: 'Müşteri hesabı · #20240803',
    heroTag: 'Aktif',
    balances: [
      { cur: 'BAKİYE · EUR', amt: '€36,900.00', delta: '30 günde +€4,200' },
      { cur: 'BAKİYE · USD', amt: '$205,930.13', delta: '30 günde +$18,120' },
    ],
    txLabel: 'SON İŞLEMLER',
    tx: [
      { who: 'Yatırma · banka havalesi', meta: 'bugün, 14:02 · IBAN TR33 0001…4521', amt: '+€12,000.00', dir: 'pos' },
      { who: 'Tahsilat · fatura #INV-3391', meta: 'dün, 09:40 · "Lojistik Q3" projesi', amt: '−€3,450.00', dir: 'neg' },
      { who: 'İade', meta: '12 Haziran · kısmi iade', amt: '+€890.00', dir: 'pos' },
    ],
    s1Kicker: '01 · SORUN',
    s1Title: 'Müşteri parası aynı anda üç sistemde yaşar.',
    s1Summary: 'Bakiye muhasebe sisteminde veya bankada, işlem geçmişi muhasebecinin Excel dosyasında, limitler ve anlaşmalar temsilcinin yazışmalarında. Müşteri "param nerede" diye aradığında yanıt 20 dakikada parça parça toplanır.',
    features: [
      { n: '01', ic: 'globe' as FeatureIcon, t: 'Çoklu para birimi bakiyeleri', d: 'EUR, USD, TRY ve diğer tüm para birimleri — tek müşteri hesabında ayrı bakiyeler, işlem tarihine göre kur geçmişiyle birlikte.' },
      { n: '02', ic: 'doc' as FeatureIcon, t: 'Tam işlem akışı', d: 'Yatırmalar, tahsilatlar, iadeler, düzeltmeler — anlaşma, fatura ve sorumlu temsilciyle ilişkilendirilmiş.' },
      { n: '03', ic: 'lock' as FeatureIcon, t: 'Limitler ve bloklar', d: 'Kredi limiti, açık anlaşmalar için rezervasyon, ödeme gecikmesinde otomatik bloklama.' },
      { n: '04', ic: 'link' as FeatureIcon, t: 'Hesaplar arası transfer', d: 'Grup içindeki müşteri hesapları ve tüzel kişiler arasında iç transferler — banka ekranına gitmeden.' },
      { n: '05', ic: 'doc2' as FeatureIcon, t: 'Ekstreler ve mutabakat tutanakları', d: 'Tek tıkla dönem PDF ekstresi — imza ve kaşeyle, müşterinin dilinde.' },
      { n: '06', ic: 'target' as FeatureIcon, t: 'Satış entegrasyonu', d: 'Müşteri bakiyesi doğrudan anlaşma kartında görünür — temsilci sekmeler arasında geçiş yapmaz.' },
    ],
    s2Kicker: '02 · NASIL ÇALIŞIR',
    s2Title: 'Hesap açmadan mutabakata — saniyeler içinde.',
    s2Summary: 'Dört adım — ve müşterinin finansal profili hem ekip hem de müşteri için tamamen şeffaf olur.',
    steps: [
      { t: 'Hesap açma', d: 'Hesap ilk anlaşmada otomatik veya şirket kartından manuel oluşturulur. Para birimi, limit ve sorumlu hemen atanır.' },
      { t: 'İşlemler', d: 'Banka yatırmaları API ile çekilir, tahsilatlar faturalardan ve tutanaklardan oluşturulur. Manuel düzeltme yorum zorunludur.' },
      { t: 'Limit kontrolü', d: 'Limite ulaşıldığında veya blok konduğunda sistem yeni sevkiyatları durdurur, temsilciyi ve muhasebeyi bilgilendirir.' },
      { t: 'Mutabakat ve rapor', d: 'Dönem sonunda otomatik PDF mutabakat tutanağı — işlem geçmişi ve dönem sonu bakiyesiyle.' },
    ],
    s3Kicker: '03 · İŞLEM DEFTERİ',
    s3Title: 'Her işlem tam bağlamıyla.',
    s3Summary: 'Kim işledi, hangi belgeyle, hangi para biriminde ve hangi durumda — tahmin yok, muhasebeye telefon yok.',
    ledgerHead: { date: 'Tarih', op: 'İşlem', doc: 'Belge', cur: 'Para birimi', status: 'Durum', amt: 'Tutar' },
    ledger: [
      { date: '16.07.2026', op: 'Yatırma · banka', doc: 'TR33 0001…4521', cur: 'EUR', status: 'ok', amt: '+12,000.00' },
      { date: '15.07.2026', op: 'Tahsilat · fatura', doc: 'INV-3391', cur: 'EUR', status: 'ok', amt: '−3,450.00' },
      { date: '14.07.2026', op: 'Anlaşma rezervi', doc: 'DEAL-8842', cur: 'USD', status: 'hold', amt: '−18,000.00' },
      { date: '12.07.2026', op: 'İade', doc: 'RET-118', cur: 'EUR', status: 'ok', amt: '+890.00' },
      { date: '09.07.2026', op: 'Hesaplar arası transfer', doc: 'TRF-552', cur: 'USD', status: 'ok', amt: '−5,000.00' },
    ],
    statusLabel: { ok: 'İşlendi', hold: 'Blok' },
    s4Kicker: '04 · SİTE HESAPLARI',
    s4Title: 'Site bazında çoklu para birimi profili.',
    s4Summary: 'CRM bakiyesi, operasyonel bakiye, birikmiş, kredi limiti, yatırılan, tahakkuk eden — her hesap için manuel hesaplama olmadan sekiz gösterge.',
    siteAcctFields: { crm: 'CRM bakiyesi', op: 'Operasyonel bakiye', accrued: 'Birikmiş', credit: 'Kredi bakiyesi', invested: 'Yatırılan', charged: 'Tahakkuk eden', pending: 'Beklemede', writeoff: 'Düşülen' },
    siteAccts: [
      { num: '20220502-000007-777', cur: 'USD', crm: '205.930,13', op: '91.439,96', accrued: '298.050,21', credit: '−183.560,04', invested: '1.023.000,00', charged: '918.994,00', pending: '0,00', writeoff: '−191.962,75' },
      { num: '20240803-444786-888', cur: 'EUR', crm: '36.900,00', op: '0,00', accrued: '36.900,00', credit: '0,00', invested: '0,00', charged: '0,00', pending: '0,00', writeoff: '0,00' },
    ],
    s5Kicker: '05 · MÜŞTERİ YATIRIMLARI',
    s5Title: 'Sadece bakiye değil — müşteri portföyü.',
    s5Summary: 'İşiniz müşteri parasını basit bir hesabın ötesinde yönetiyorsa — neye yatırıldığı, beklenen kâr ve varlık kategorisi görünür.',
    investAmount: 'Tutar',
    investProfit: 'Beklenen kâr',
    invest: [
      { name: 'BEAUTY HOUSE', cat: 'vip hizmetler · 50.000', badge: 'VIP', desc: 'Güzellik salonu — salon zincirinde pay', amount: '7.000,00' },
      { name: 'Network of bakeries & sweets', cat: 'fırın · 350.000', badge: 'BAKERY', desc: 'Pastane işine yatırım', amount: '5.000,00' },
      { name: 'FASHION HOUSE', cat: 'VIP · 100.000', badge: 'VIP', desc: 'Özel bir kişisel marka', amount: '10.000,00' },
      { name: 'Smart Logistics Hub', cat: 'lojistik · 220.000', badge: 'GROWTH', desc: 'Bölgesel lojistik ağı', amount: '15.000,00' },
    ],
    s6Kicker: '06 · HESAPLAR ARASI TRANSFERLER',
    s6Title: 'İç transferler — işlem tarihindeki kurla.',
    s6Summary: 'Tek bir müşteride 100 transfer olması alışılmadık değildir. Her biri gönderen, alıcı, dönüşüm kuru ve nihai alacaklandırılan tutarla kayıtlıdır.',
    transferHead: { date: 'Tarih', from: 'Gönderen', to: 'Alıcı', cur: 'Para birimi', amt: 'Tutar', rate: 'Kur', credited: 'Alacaklandırılan' },
    transfers: [
      { date: '24.01.2024', from: 'Müşteri A. Demirov', to: 'Müşteri A. Demirov', cur: 'USD', amt: '215,00', rate: '1,00', credited: '215,00' },
      { date: '26.01.2024', from: 'Müşteri A. Demirov', to: 'Müşteri A. Demirov', cur: 'USD', amt: '7.514,00', rate: '1,00', credited: '7.514,00' },
      { date: '31.01.2024', from: 'Müşteri A. Demirov', to: 'Müşteri A. Demirov', cur: 'USD', amt: '27.000,00', rate: '1,00', credited: '27.000,00' },
      { date: '18.02.2024', from: 'Müşteri A. Demirov', to: 'Müşteri A. Demirov', cur: 'USD', amt: '1.000,00', rate: '1,00', credited: '1.000,00' },
      { date: '02.03.2024', from: 'Vantage Trading LLC', to: 'Müşteri A. Demirov', cur: 'EUR', amt: '500,00', rate: '1,07', credited: '535,00' },
    ],
    metrics: [
      { v: '12 dk', l: '3 saat yerine ortalama ay kapanış süresi' },
      { v: '%100', l: 'sorumlu temsilciyle ilişkilendirilmiş işlem' },
      { v: '0', l: 'banka ile otomatik mutabakatta fark' },
      { v: '6', l: 'tek müşteri hesabında desteklenen para birimi' },
    ],
    quote: '"Eskiden 40 iş ortağıyla bakiye mutabakatı, muhasebe ekibimizin ay sonunda iki gününü alıyordu. Şimdi mutabakat tutanağı tek tıkla oluşuyor, satış temsilcileri müşteri limitini doğrudan anlaşmada görüyor — bu, \'ne kadar kaldı\' aramalarını yarı yarıya azalttı."',
    quoteName: 'Olga Kramer',
    quoteRole: 'Finans Direktörü · Northwave Logistics',
    ctaKicker: 'Hesaplarınızı düzene sokmaya hazır mısınız?',
    ctaTitle: '14 gün ücretsiz. Muhasebe sisteminizden ve bankadan bakiye aktarımı bizden.',
    ctaBtn1: 'Hesap oluştur',
    ctaBtn2: 'Ekiple iletişime geçin',
  },
};

const INK = '#222';
const FG2 = '#555';
const FG3 = '#888';
const LINE = '#e7e7e7';
const LINE2 = 'rgba(34,34,34,0.1)';
const BG_MUTED = '#f7f7f6';
const OK_BG = '#eaf4ee';
const OK_FG = '#175c3d';
const HOLD_BG = '#fbf2dc';
const HOLD_FG = '#7a4a09';
const FF = "'Inter Tight', sans-serif";
const FM = "'JetBrains Mono', monospace";

const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FM, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: INK, display: 'inline-block' }} />
    {children}
  </div>
);

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '11px 14px', fontFamily: FM, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: FG3, background: BG_MUTED, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' };
const thStyleR: React.CSSProperties = { ...thStyle, textAlign: 'right' };
const tdStyle: React.CSSProperties = { padding: '10px 14px', borderBottom: `1px solid ${BG_MUTED}` };
const tdStyleR: React.CSSProperties = { ...tdStyle, textAlign: 'right', fontFamily: FM, fontSize: 12 };

export default function ClientAccountsSolutionsPage() {
  const { i18n } = useTranslation();
  const lang = ((i18n.language || 'ru').slice(0, 2) as Lang) in T ? (i18n.language || 'ru').slice(0, 2) as Lang : 'ru';
  const tx = T[lang];

  return (
    <div style={{ background: '#fff', color: INK, fontFamily: "'Inter', sans-serif", minHeight: '100vh' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />

      <PublicHeader activeKey="client-accounts" />

      <div className="mx-auto px-5 md:px-8" style={{ maxWidth: 1280 }}>

        {/* ── Hero ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-2"
          style={{ paddingTop: 72, paddingBottom: 40, gap: 48, alignItems: 'center' }}
        >
          <div>
            <Kicker>{tx.kicker}</Kicker>
            <h1 style={{ fontFamily: FF, fontSize: 'clamp(38px, 4.6vw, 62px)', lineHeight: 1.03, letterSpacing: '-0.04em', fontWeight: 500, marginTop: 24, maxWidth: 620, color: INK }}>
              {tx.title1}<br />
              <em style={{ color: FG3, fontStyle: 'normal', fontWeight: 400 }}>{tx.title2}</em>
            </h1>
            <p style={{ fontSize: 17, color: FG2, maxWidth: 520, marginTop: 20, lineHeight: 1.6 }}>{tx.sub}</p>
            <div className="flex flex-wrap items-center gap-3" style={{ marginTop: 28 }}>
              <Link to="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', fontSize: 13.5, fontWeight: 500, borderRadius: 999, background: INK, color: '#fff', border: `1px solid ${INK}`, textDecoration: 'none' }}>
                {tx.ctaPrimary}<ArrowRight />
              </Link>
              <Link to="/contact" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', fontSize: 13.5, fontWeight: 500, borderRadius: 999, background: '#fff', color: INK, border: `1px solid ${LINE}`, textDecoration: 'none' }}>
                {tx.ctaSecondary}
              </Link>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
            <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: 20, boxShadow: '0 20px 50px rgba(15,23,42,0.08)' }}>
              <div className="flex items-start justify-between" style={{ marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: FM, fontSize: 10, color: FG3 }}>{tx.heroLabel}</div>
                  <div style={{ fontFamily: FF, fontSize: 15, fontWeight: 600, marginTop: 4 }}>{tx.heroTitle}</div>
                </div>
                <span style={{ fontFamily: FM, fontSize: 10, padding: '3px 9px', border: `1px solid ${LINE}`, borderRadius: 999, color: FG2 }}>{tx.heroTag}</span>
              </div>
              <div className="grid grid-cols-2" style={{ gap: 10, marginBottom: 14 }}>
                {tx.balances.map((b) => (
                  <div key={b.cur} style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: 14 }}>
                    <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: '0.1em', color: FG3 }}>{b.cur}</div>
                    <div style={{ fontFamily: FF, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 6 }}>{b.amt}</div>
                    <div style={{ fontSize: 11, color: '#1f8a5e', marginTop: 4, fontFamily: FM }}>{b.delta}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: FM, fontSize: 10, color: FG3, marginBottom: 8 }}>{tx.txLabel}</div>
              {tx.tx.map((row, i) => (
                <div key={i} className="flex items-center justify-between" style={{ padding: '9px 0', borderBottom: i < tx.tx.length - 1 ? `1px solid ${BG_MUTED}` : 'none', fontSize: 12.5 }}>
                  <div>
                    <div style={{ color: INK, fontWeight: 500 }}>{row.who}</div>
                    <div style={{ color: FG3, fontSize: 11, marginTop: 2 }}>{row.meta}</div>
                  </div>
                  <div style={{ fontFamily: FM, fontWeight: 500, color: row.dir === 'pos' ? '#1f8a5e' : '#cc2f47' }}>{row.amt}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.section>

        {/* ── 01 Problem / feature grid ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 56, paddingBottom: 56 }}>
          <Kicker>{tx.s1Kicker}</Kicker>
          <h2 style={{ fontFamily: FF, fontSize: 'clamp(24px, 2.8vw, 34px)', fontWeight: 500, letterSpacing: '-0.02em', marginTop: 14, maxWidth: 640, color: INK }}>{tx.s1Title}</h2>
          <p style={{ fontSize: 14.5, color: FG2, marginTop: 12, maxWidth: 640, lineHeight: 1.6 }}>{tx.s1Summary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ marginTop: 36, border: `1px solid ${LINE}`, borderRadius: 16, overflow: 'hidden' }}>
            {tx.features.map((f, i) => (
              <motion.div key={f.n} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.35 }}
                style={{ padding: 24, borderRight: (i % 3 !== 2) ? `1px solid ${LINE}` : 'none', borderBottom: i < 3 ? `1px solid ${LINE}` : 'none' }}>
                <div style={{ fontFamily: FM, fontSize: 11, color: FG3, letterSpacing: '0.08em' }}>{f.n}</div>
                <div style={{ color: FG2, marginTop: 12 }}><FeatureIconGlyph name={f.ic} /></div>
                <div style={{ fontFamily: FF, fontSize: 15.5, fontWeight: 500, marginTop: 12, color: INK }}>{f.t}</div>
                <div style={{ fontSize: 12.5, color: FG2, marginTop: 8, lineHeight: 1.55 }}>{f.d}</div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── 02 Workflow ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 56, paddingBottom: 56 }}>
          <Kicker>{tx.s2Kicker}</Kicker>
          <h2 style={{ fontFamily: FF, fontSize: 'clamp(24px, 2.8vw, 34px)', fontWeight: 500, letterSpacing: '-0.02em', marginTop: 14, maxWidth: 640, color: INK }}>{tx.s2Title}</h2>
          <p style={{ fontSize: 14.5, color: FG2, marginTop: 12, maxWidth: 640, lineHeight: 1.6 }}>{tx.s2Summary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ marginTop: 32, border: `1px solid ${LINE}`, borderRadius: 16, overflow: 'hidden' }}>
            {tx.steps.map((s, i) => (
              <motion.div key={s.t} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.35 }}
                style={{ padding: '28px 22px', borderRight: i < tx.steps.length - 1 ? `1px solid ${LINE}` : 'none' }}>
                <div style={{ fontFamily: FM, fontSize: 11, color: FG3, letterSpacing: '0.1em' }}>{lang === 'ru' ? `ШАГ ${i + 1}` : lang === 'tr' ? `ADIM ${i + 1}` : `STEP ${i + 1}`}</div>
                <h4 style={{ fontFamily: FF, fontSize: 16, fontWeight: 500, marginTop: 14, letterSpacing: '-0.01em', color: INK }}>{s.t}</h4>
                <p style={{ fontSize: 12.5, color: FG2, marginTop: 8, lineHeight: 1.55 }}>{s.d}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── 03 Ledger ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 56, paddingBottom: 56 }}>
          <Kicker>{tx.s3Kicker}</Kicker>
          <h2 style={{ fontFamily: FF, fontSize: 'clamp(24px, 2.8vw, 34px)', fontWeight: 500, letterSpacing: '-0.02em', marginTop: 14, maxWidth: 640, color: INK }}>{tx.s3Title}</h2>
          <p style={{ fontSize: 14.5, color: FG2, marginTop: 12, maxWidth: 640, lineHeight: 1.6 }}>{tx.s3Summary}</p>

          <div className="overflow-x-auto" style={{ marginTop: 32, border: `1px solid ${LINE}`, borderRadius: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={thStyle}>{tx.ledgerHead.date}</th>
                  <th style={thStyle}>{tx.ledgerHead.op}</th>
                  <th style={thStyle}>{tx.ledgerHead.doc}</th>
                  <th style={thStyle}>{tx.ledgerHead.cur}</th>
                  <th style={thStyle}>{tx.ledgerHead.status}</th>
                  <th style={thStyleR}>{tx.ledgerHead.amt}</th>
                </tr>
              </thead>
              <tbody>
                {tx.ledger.map((row, i) => {
                  const isLast = i === tx.ledger.length - 1;
                  const cellStyle = { ...tdStyle, borderBottom: isLast ? 'none' : tdStyle.borderBottom };
                  const amtNeg = row.amt.trim().startsWith('−') || row.amt.trim().startsWith('-');
                  return (
                    <tr key={i}>
                      <td style={cellStyle}>{row.date}</td>
                      <td style={cellStyle}>{row.op}</td>
                      <td style={{ ...cellStyle, fontFamily: FM, fontSize: 11, color: FG3 }}>{row.doc}</td>
                      <td style={cellStyle}>{row.cur}</td>
                      <td style={cellStyle}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: row.status === 'ok' ? OK_BG : HOLD_BG, color: row.status === 'ok' ? OK_FG : HOLD_FG }}>
                          {tx.statusLabel[row.status as 'ok' | 'hold']}
                        </span>
                      </td>
                      <td style={{ ...tdStyleR, borderBottom: isLast ? 'none' : tdStyleR.borderBottom, color: amtNeg ? '#cc2f47' : '#1f8a5e' }}>{row.amt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* ── 04 Site accounts ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 56, paddingBottom: 56 }}>
          <Kicker>{tx.s4Kicker}</Kicker>
          <h2 style={{ fontFamily: FF, fontSize: 'clamp(24px, 2.8vw, 34px)', fontWeight: 500, letterSpacing: '-0.02em', marginTop: 14, maxWidth: 640, color: INK }}>{tx.s4Title}</h2>
          <p style={{ fontSize: 14.5, color: FG2, marginTop: 12, maxWidth: 640, lineHeight: 1.6 }}>{tx.s4Summary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ marginTop: 32, gap: 16 }}>
            {tx.siteAccts.map((acc) => (
              <div key={acc.num} style={{ border: `1px solid ${LINE}`, borderRadius: 16, padding: 20, background: '#fff' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                  <span style={{ fontFamily: FM, fontSize: 12.5, color: INK }}>{acc.num}</span>
                  <span style={{ fontFamily: FM, fontSize: 10, padding: '2px 8px', borderRadius: 6, background: BG_MUTED, color: FG2 }}>{acc.cur}</span>
                </div>
                <div className="grid grid-cols-2">
                  {([
                    ['crm', acc.crm, false], ['op', acc.op, false], ['accrued', acc.accrued, false], ['credit', acc.credit, true],
                    ['invested', acc.invested, false], ['charged', acc.charged, false], ['pending', acc.pending, false], ['writeoff', acc.writeoff, true],
                  ] as const).map(([key, val, negTint], idx) => {
                    const isMuted = val.trim() === '0.00' || val.trim() === '0,00';
                    return (
                      <div key={key} style={{ padding: '7px 0', borderBottom: `1px solid ${BG_MUTED}`, paddingRight: idx % 2 === 0 ? 12 : 0 }}>
                        <div style={{ fontFamily: FM, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: FG3 }}>{tx.siteAcctFields[key as keyof typeof tx.siteAcctFields]}</div>
                        <div style={{ fontSize: 12, fontWeight: isMuted ? 400 : 500, color: isMuted ? '#aaa' : negTint && val.trim().startsWith('−') ? '#cc2f47' : INK, marginTop: 3 }}>{val} {acc.cur}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── 05 Investments ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 56, paddingBottom: 56 }}>
          <Kicker>{tx.s5Kicker}</Kicker>
          <h2 style={{ fontFamily: FF, fontSize: 'clamp(24px, 2.8vw, 34px)', fontWeight: 500, letterSpacing: '-0.02em', marginTop: 14, maxWidth: 640, color: INK }}>{tx.s5Title}</h2>
          <p style={{ fontSize: 14.5, color: FG2, marginTop: 12, maxWidth: 640, lineHeight: 1.6 }}>{tx.s5Summary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ marginTop: 32, gap: 16 }}>
            {tx.invest.map((inv, i) => (
              <motion.div key={inv.name} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.35 }}
                style={{ border: `1px solid ${LINE}`, borderRadius: 16, padding: 20, background: '#fff' }}>
                <div className="flex items-start justify-between" style={{ marginBottom: 8 }}>
                  <div>
                    <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>{inv.name}</div>
                    <div style={{ fontSize: 11, color: FG3, marginTop: 2 }}>{inv.cat}</div>
                  </div>
                  <span style={{ fontFamily: FM, fontSize: 9, fontWeight: 600, letterSpacing: '0.05em', padding: '2px 8px', borderRadius: 6, background: BG_MUTED, color: FG2 }}>{inv.badge}</span>
                </div>
                <div style={{ fontSize: 12, color: FG2, lineHeight: 1.5, marginBottom: 12 }}>{inv.desc}</div>
                <div className="flex items-center justify-between" style={{ borderTop: `1px solid ${BG_MUTED}`, paddingTop: 10 }}>
                  <div>
                    <div style={{ fontFamily: FM, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: FG3 }}>{tx.investAmount}</div>
                    <div style={{ fontSize: 13, color: INK, fontWeight: 600, marginTop: 3 }}>{inv.amount} USD</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: FM, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: FG3 }}>{tx.investProfit}</div>
                    <div style={{ fontSize: 13, color: '#aaa', fontWeight: 400, marginTop: 3 }}>0.00 USD</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── 06 Transfers ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 56, paddingBottom: 56 }}>
          <Kicker>{tx.s6Kicker}</Kicker>
          <h2 style={{ fontFamily: FF, fontSize: 'clamp(24px, 2.8vw, 34px)', fontWeight: 500, letterSpacing: '-0.02em', marginTop: 14, maxWidth: 640, color: INK }}>{tx.s6Title}</h2>
          <p style={{ fontSize: 14.5, color: FG2, marginTop: 12, maxWidth: 640, lineHeight: 1.6 }}>{tx.s6Summary}</p>

          <div className="overflow-x-auto" style={{ marginTop: 32, border: `1px solid ${LINE}`, borderRadius: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={thStyle}>{tx.transferHead.date}</th>
                  <th style={thStyle}>{tx.transferHead.from}</th>
                  <th style={thStyle}>{tx.transferHead.to}</th>
                  <th style={thStyle}>{tx.transferHead.cur}</th>
                  <th style={thStyleR}>{tx.transferHead.amt}</th>
                  <th style={thStyleR}>{tx.transferHead.rate}</th>
                  <th style={thStyleR}>{tx.transferHead.credited}</th>
                </tr>
              </thead>
              <tbody>
                {tx.transfers.map((row, i) => {
                  const isLast = i === tx.transfers.length - 1;
                  const cellStyle = { ...tdStyle, borderBottom: isLast ? 'none' : tdStyle.borderBottom };
                  const numStyle = { ...tdStyleR, borderBottom: isLast ? 'none' : tdStyleR.borderBottom };
                  return (
                    <tr key={i}>
                      <td style={cellStyle}>{row.date}</td>
                      <td style={cellStyle}>{row.from}</td>
                      <td style={cellStyle}>{row.to}</td>
                      <td style={cellStyle}>{row.cur}</td>
                      <td style={numStyle}>{row.amt}</td>
                      <td style={numStyle}>{row.rate}</td>
                      <td style={{ ...numStyle, color: '#1f8a5e' }}>{row.credited}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* ── Metrics ── */}
        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="grid grid-cols-2 md:grid-cols-4" style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, marginBottom: 64 }}>
          {tx.metrics.map((m, i) => (
            <div key={m.l} className={['py-8 px-5', i % 2 === 0 ? 'border-r' : '', i < 2 ? 'border-b md:border-b-0' : '', i === 1 ? 'md:border-r' : ''].filter(Boolean).join(' ')} style={{ borderColor: LINE }}>
              <div style={{ fontFamily: FF, fontSize: 'clamp(26px, 3.2vw, 38px)', fontWeight: 500, letterSpacing: '-0.03em', color: INK }}>{m.v}</div>
              <div style={{ fontSize: 12.5, color: FG2, marginTop: 8 }}>{m.l}</div>
            </div>
          ))}
        </motion.section>

        {/* ── Quote ── */}
        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="grid grid-cols-1 lg:grid-cols-[1fr_260px]" style={{ gap: 40, paddingBottom: 64, borderBottom: `1px solid ${LINE}`, marginBottom: 64 }}>
          <div>
            <div style={{ marginBottom: 24 }}><Kicker>{lang === 'ru' ? 'Клиенты' : lang === 'tr' ? 'Müşteriler' : 'Customers'}</Kicker></div>
            <p style={{ fontFamily: FF, fontSize: 'clamp(20px, 2.4vw, 28px)', fontWeight: 400, letterSpacing: '-0.01em', lineHeight: 1.4, color: INK }}>{tx.quote}</p>
          </div>
          <div>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: BG_MUTED, border: `1px solid ${LINE}`, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FF, fontWeight: 500 }}>
              {tx.quoteName.split(' ').map((p) => p[0]).slice(0, 2).join('')}
            </div>
            <div style={{ color: INK, fontWeight: 500, fontSize: 14 }}>{tx.quoteName}</div>
            <div style={{ fontFamily: FM, fontSize: 11, color: FG3, marginTop: 4 }}>{tx.quoteRole}</div>
          </div>
        </motion.section>

        {/* ── CTA ── */}
        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
          style={{ marginBottom: 80, borderRadius: 12, border: `1px solid ${LINE}`, padding: '56px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(to right, #f0f0f0 1px, transparent 1px)', backgroundSize: '48px 100%', opacity: 0.4, pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ marginBottom: 12 }}><Kicker>{tx.ctaKicker}</Kicker></div>
            <div style={{ fontFamily: FF, fontSize: 'clamp(22px, 2.8vw, 34px)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.15, maxWidth: 480, color: INK }}>{tx.ctaTitle}</div>
          </div>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220 }}>
            <Link to="/pricing" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 24px', fontSize: 13.5, fontWeight: 500, borderRadius: 999, background: INK, color: '#fff', border: `1px solid ${INK}`, textDecoration: 'none' }}>
              {tx.ctaBtn1}<ArrowRight />
            </Link>
            <Link to="/contact" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 24px', fontSize: 13.5, fontWeight: 500, borderRadius: 999, background: '#fff', color: INK, border: `1px solid ${LINE2}`, textDecoration: 'none' }}>
              {tx.ctaBtn2}
            </Link>
          </div>
        </motion.section>

      </div>

      <PublicFooter />
    </div>
  );
}
