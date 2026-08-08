import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PublicHeader } from '../../components/public/PublicHeader';
import { PublicFooter } from '../../components/public/PublicFooter';

type Lang = 'ru' | 'en' | 'tr';

const FEATURE_ICONS = ['grid', 'clock', 'bell', 'link', 'lock', 'doc'] as const;
type FeatureIcon = (typeof FEATURE_ICONS)[number];

const FeatureIconGlyph: React.FC<{ name: FeatureIcon }> = ({ name }) => {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'grid':
      return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.2" /><rect x="14" y="3" width="7" height="7" rx="1.2" /><rect x="3" y="14" width="7" height="7" rx="1.2" /><rect x="14" y="14" width="7" height="7" rx="1.2" /></svg>;
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>;
    case 'bell':
      return <svg {...common}><path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 004 0" /></svg>;
    case 'link':
      return <svg {...common}><path d="M9 15l6-6" /><path d="M8 17l-2.5 2.5a3.5 3.5 0 01-5-5L3 12" /><path d="M16 7l2.5-2.5a3.5 3.5 0 015 5L21 12" /></svg>;
    case 'lock':
      return <svg {...common}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>;
    case 'doc':
      return <svg {...common}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /><path d="M9.5 13h5M9.5 16.5h5" /></svg>;
  }
};

const ArrowRight: React.FC = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
);

const T = {
  ru: {
    kicker: 'РЕШЕНИЕ · СИСТЕМА РЕЗЕРВАЦИИ',
    title1: 'Видите отставание от плана',
    title2: 'за месяцы до заезда, а не по факту.',
    sub: 'Пейсинг по датам заезда, риск недозагрузки по типам номеров и тарифы по рынкам и агентствам — в одной системе. Алерт приходит, пока ещё есть время поднять продажи, а не когда бронь уже сорвалась.',
    ctaPrimary: 'Попробовать бесплатно',
    ctaSecondary: 'Смотреть демо',
    heroCardLabel: 'ОТЕЛЬ · СЕЙЧАС',
    heroCardTitle: 'Загрузка в реальном времени',
    heroCardTag: '81 номер',
    heroKpis: [
      { l: 'ЗАГРУЗКА', v: '78%' },
      { l: 'СВОБОДНО', v: '18', color: '#c08319' },
      { l: 'ВЫРУЧКА', v: '$42K' },
    ],
    heroRows: [
      { loc: 'Standard', name: 'Заполнено на месяц', qty: '92%', level: '' },
      { loc: 'Delux', name: 'Заполнено на месяц', qty: '71%', level: '' },
      { loc: 'Suite', name: 'Отстаёт от плана', qty: '38%', level: 'low' },
      { loc: 'Family', name: 'Стоп-продажа', qty: '—', level: 'out' },
    ],
    s1Kicker: '01 · ЗАДАЧА',
    s1Title: 'Отставание видно в отчёте, когда исправлять уже поздно.',
    s1Summary: 'Тип номера продаётся медленнее плана уже месяц, но это заметно только когда до заезда остаётся неделя и поднять цену или запустить акцию по нужным рынкам уже некогда. Без пейсинга по датам заезда отель узнаёт об этом последним.',
    features: [
      { n: '01', ic: 'grid' as FeatureIcon, t: 'Номерной фонд и стоп-продажи', d: 'Типы номеров, количество, точечные переопределения по датам и стоп-продажи — без путаницы в Excel-таблицах.' },
      { n: '02', ic: 'clock' as FeatureIcon, t: 'Пейсинг по датам заезда', d: 'Факт продаж сравнивается с целевым темпом по каждому периоду до заезда — видно, где отставание, а не только итоговую загрузку.' },
      { n: '03', ic: 'bell' as FeatureIcon, t: 'Риск недозагрузки', d: 'Порог заполняемости настраивается по каждому типу номера и месяцу — алерт приходит, пока есть время скорректировать тариф.' },
      { n: '04', ic: 'link' as FeatureIcon, t: 'Тарифы по рынкам и агентствам', d: 'Дневные ставки по рынкам, группам рынков и отдельным агентствам — без ручного пересчёта для каждого канала.' },
      { n: '05', ic: 'lock' as FeatureIcon, t: 'Статусы оплаты брони', d: 'Полная / частичная / без оплаты / возврат — статус виден по каждой брони, вместе с источником и агентством.' },
      { n: '06', ic: 'doc' as FeatureIcon, t: 'Фотогалерея и фактшит', d: 'Категории фото номеров и объекта, фактшит с удобствами — контент отеля собран в одном месте, а не в переписке с менеджером.' },
    ],
    s2Kicker: '02 · ТИПЫ НОМЕРОВ',
    s2Title: 'Загрузка и доход — по каждому типу номера отдельно.',
    s2Summary: 'Общая загрузка отеля маскирует то, что происходит по конкретным типам номеров. Здесь видно, где план выполняется, а где отстаёт.',
    tableHead: { name: 'Тип номера', qty: 'Номеров', sold: 'Продано', occ: 'Загрузка', adr: 'ADR', revenue: 'Выручка' },
    table: [
      { name: 'Standard Twin', qty: 30, sold: 26, occ: 87, adr: 82, revenue: 2132, level: '' },
      { name: 'Standard Double', qty: 20, sold: 17, occ: 85, adr: 88, revenue: 1496, level: '' },
      { name: 'Delux Sea View', qty: 15, sold: 10, occ: 67, adr: 132, revenue: 1320, level: 'low' },
      { name: 'Suite Junior', qty: 10, sold: 4, occ: 40, adr: 210, revenue: 840, level: 'low' },
      { name: 'Family Room', qty: 6, sold: 5, occ: 83, adr: 168, revenue: 840, level: '' },
    ],
    s3Kicker: '03 · КАК ЭТО РАБОТАЕТ',
    s3Title: 'От тарифа до анализа по рынкам.',
    steps: [
      { t: 'Тариф и стоп-продажи', d: 'Задаёте дневные ставки по рынкам и период действия; при необходимости закрываете тип номера стоп-продажей на конкретные даты.' },
      { t: 'Бронирование', d: 'Резервация приходит вручную, от агентства или из массового импорта — сразу с рынком, источником и статусом оплаты.' },
      { t: 'Пейсинг и алерт', d: 'Система сверяет факт с целевым темпом по датам заезда и поднимает алерт по типам номеров с риском недозагрузки.' },
      { t: 'Анализ по рынкам', d: 'Revenue funnel и разбивка по типам номеров, рынкам и агентствам показывают, где именно теряется выручка.' },
    ],
    s4Kicker: '04 · ЛЕНТА СОБЫТИЙ',
    s4Title: 'Каждое изменение тарифа и брони — с датой и причиной.',
    s4Summary: 'Новая бронь, смена статуса, изменение цены, стоп-продажа, алерт по низкой загрузке — единая лента вместо разрозненных таблиц.',
    moves: [
      { t: 'сегодня 11:40', d: 'Алерт: Suite Junior — риск недозагрузки на март', qty: 'алерт', dir: 'out' },
      { t: 'сегодня 09:15', d: 'Новая бронь · Delux Sea View, агентство TravelHub', qty: 'новая', dir: 'in' },
      { t: 'вчера 17:30', d: 'Изменена цена · Standard Twin, рынок DE', qty: 'тариф', dir: 'in' },
      { t: 'вчера 14:02', d: 'Стоп-продажа установлена · Family Room, 12–15 июля', qty: 'стоп', dir: 'out' },
      { t: '2 дня назад', d: 'Статус изменён · бронь #4482, оплата получена', qty: 'оплата', dir: 'in' },
    ],
    metrics: [
      { v: '+90 дней', l: 'горизонт пейсинга до заезда' },
      { v: '−27%', l: 'номеров, ушедших в недозагрузку незамеченными' },
      { v: '81', l: 'номер под управлением в примере' },
      { v: '24/7', l: 'мониторинг риска по типам номеров' },
    ],
    ctaKicker: 'Готовы видеть отставание раньше, чем оно станет проблемой?',
    ctaTitle: '14 дней бесплатно. Перенос тарифов и текущей загрузки — за наш счёт.',
    ctaBtn1: 'Создать аккаунт',
    ctaBtn2: 'Связаться с командой',
  },
  en: {
    kicker: 'SOLUTION · HOTEL / PMS',
    title1: 'See you\'re falling behind plan',
    title2: 'months out, not after the fact.',
    sub: 'Pacing by arrival date, low-availability risk by room type, and market/agency rates — in one system. The alert arrives while there\'s still time to fix sales, not after the booking window has closed.',
    ctaPrimary: 'Try for free',
    ctaSecondary: 'Watch demo',
    heroCardLabel: 'HOTEL · NOW',
    heroCardTitle: 'Real-time occupancy',
    heroCardTag: '81 rooms',
    heroKpis: [
      { l: 'OCCUPANCY', v: '78%' },
      { l: 'AVAILABLE', v: '18', color: '#c08319' },
      { l: 'REVENUE', v: '$42K' },
    ],
    heroRows: [
      { loc: 'Standard', name: 'On pace for the month', qty: '92%', level: '' },
      { loc: 'Delux', name: 'On pace for the month', qty: '71%', level: '' },
      { loc: 'Suite', name: 'Behind plan', qty: '38%', level: 'low' },
      { loc: 'Family', name: 'Stop-sale', qty: '—', level: 'out' },
    ],
    s1Kicker: '01 · THE PROBLEM',
    s1Title: "By the time a report shows it, it's too late to fix.",
    s1Summary: 'A room type has been selling slower than plan for a month, but it only shows up when arrival is a week out and there\'s no time left to raise rates or push a market-specific promotion. Without pacing by arrival date, the hotel is the last to know.',
    features: [
      { n: '01', ic: 'grid' as FeatureIcon, t: 'Room inventory & stop-sales', d: 'Room types, quantities, date-level overrides and stop-sale dates — no more juggling spreadsheets.' },
      { n: '02', ic: 'clock' as FeatureIcon, t: 'Pacing by arrival date', d: 'Actual sales are compared against a target pace for every window before arrival — you see where you\'re behind, not just the final occupancy.' },
      { n: '03', ic: 'bell' as FeatureIcon, t: 'Low-availability risk', d: 'A fill-rate threshold is configurable per room type and month — the alert arrives while there\'s still time to adjust rates.' },
      { n: '04', ic: 'link' as FeatureIcon, t: 'Market & agency rates', d: 'Daily rates by market, market group and individual agency — no manual recalculation per channel.' },
      { n: '05', ic: 'lock' as FeatureIcon, t: 'Reservation payment status', d: 'Full / partial / unpaid / refunded — visible per reservation, along with source and agency.' },
      { n: '06', ic: 'doc' as FeatureIcon, t: 'Photo gallery & factsheet', d: 'Categorized room and property photos plus an amenities factsheet — hotel content lives in one place, not scattered emails.' },
    ],
    s2Kicker: '02 · ROOM TYPES',
    s2Title: 'Occupancy and revenue — broken down by room type.',
    s2Summary: 'Overall hotel occupancy hides what\'s happening at the room-type level. Here you see exactly where the plan is on track and where it isn\'t.',
    tableHead: { name: 'Room type', qty: 'Rooms', sold: 'Sold', occ: 'Occupancy', adr: 'ADR', revenue: 'Revenue' },
    table: [
      { name: 'Standard Twin', qty: 30, sold: 26, occ: 87, adr: 82, revenue: 2132, level: '' },
      { name: 'Standard Double', qty: 20, sold: 17, occ: 85, adr: 88, revenue: 1496, level: '' },
      { name: 'Delux Sea View', qty: 15, sold: 10, occ: 67, adr: 132, revenue: 1320, level: 'low' },
      { name: 'Suite Junior', qty: 10, sold: 4, occ: 40, adr: 210, revenue: 840, level: 'low' },
      { name: 'Family Room', qty: 6, sold: 5, occ: 83, adr: 168, revenue: 840, level: '' },
    ],
    s3Kicker: '03 · HOW IT WORKS',
    s3Title: 'From rate setup to market-level analysis.',
    steps: [
      { t: 'Rates & stop-sales', d: 'Set daily rates per market and validity period; close a room type with a stop-sale on specific dates when needed.' },
      { t: 'Reservation', d: 'A booking comes in manually, from an agency, or via bulk import — with market, source and payment status attached from the start.' },
      { t: 'Pacing & alert', d: 'The system checks actuals against target pace by arrival date and raises an alert for room types at risk of under-filling.' },
      { t: 'Market analysis', d: 'A revenue funnel plus breakdowns by room type, market and agency show exactly where revenue is being left on the table.' },
    ],
    s4Kicker: '04 · EVENT FEED',
    s4Title: 'Every rate and reservation change, dated and explained.',
    s4Summary: 'New bookings, status changes, rate changes, stop-sales, low-availability alerts — one feed instead of scattered spreadsheets.',
    moves: [
      { t: 'today 11:40', d: 'Alert: Suite Junior — low-availability risk in March', qty: 'alert', dir: 'out' },
      { t: 'today 09:15', d: 'New booking · Delux Sea View, agency TravelHub', qty: 'new', dir: 'in' },
      { t: 'yesterday 17:30', d: 'Rate changed · Standard Twin, DE market', qty: 'rate', dir: 'in' },
      { t: 'yesterday 14:02', d: 'Stop-sale set · Family Room, Jul 12–15', qty: 'stop', dir: 'out' },
      { t: '2 days ago', d: 'Status changed · booking #4482, payment received', qty: 'payment', dir: 'in' },
    ],
    metrics: [
      { v: '90+ days', l: 'pacing horizon before arrival' },
      { v: '−27%', l: 'room types slipping into under-fill unnoticed' },
      { v: '81', l: 'rooms under management in this example' },
      { v: '24/7', l: 'risk monitoring by room type' },
    ],
    ctaKicker: 'Ready to spot the gap before it becomes a problem?',
    ctaTitle: '14 days free. We migrate your rates and current occupancy at no cost.',
    ctaBtn1: 'Create account',
    ctaBtn2: 'Talk to the team',
  },
  tr: {
    kicker: 'ÇÖZÜM · OTEL / PMS',
    title1: 'Plan gerisinde kaldığınızı',
    title2: 'aylar önceden görün, sonradan değil.',
    sub: 'Varış tarihine göre pacing, oda tipine göre düşük doluluk riski ve pazar/acenta bazlı fiyatlar — tek sistemde. Uyarı, satışları düzeltmek için hâlâ vakit varken gelir, rezervasyon penceresi kapandıktan sonra değil.',
    ctaPrimary: 'Ücretsiz deneyin',
    ctaSecondary: 'Demo izleyin',
    heroCardLabel: 'OTEL · ŞİMDİ',
    heroCardTitle: 'Gerçek zamanlı doluluk',
    heroCardTag: '81 oda',
    heroKpis: [
      { l: 'DOLULUK', v: '%78' },
      { l: 'BOŞ', v: '18', color: '#c08319' },
      { l: 'GELİR', v: '$42K' },
    ],
    heroRows: [
      { loc: 'Standard', name: 'Ay için hedefte', qty: '%92', level: '' },
      { loc: 'Delux', name: 'Ay için hedefte', qty: '%71', level: '' },
      { loc: 'Suite', name: 'Plan gerisinde', qty: '%38', level: 'low' },
      { loc: 'Family', name: 'Satış durduruldu', qty: '—', level: 'out' },
    ],
    s1Kicker: '01 · SORUN',
    s1Title: 'Raporda göründüğünde düzeltmek için artık geç kalınmıştır.',
    s1Summary: 'Bir oda tipi bir aydır plandan daha yavaş satılıyor, ama bu ancak varışa bir hafta kala ve fiyat artırmak veya pazara özel kampanya başlatmak için vakit kalmadığında fark ediliyor. Varış tarihine göre pacing olmadan otel bunu en son öğrenir.',
    features: [
      { n: '01', ic: 'grid' as FeatureIcon, t: 'Oda envanteri ve satış durdurma', d: 'Oda tipleri, adetler, tarih bazlı geçersiz kılmalar ve satış durdurma tarihleri — Excel tablolarıyla uğraşmadan.' },
      { n: '02', ic: 'clock' as FeatureIcon, t: 'Varış tarihine göre pacing', d: 'Gerçek satışlar, varıştan önceki her dönem için hedef hızla karşılaştırılır — yalnızca nihai dolulukla değil, nerede geride kaldığınızla ilgilenirsiniz.' },
      { n: '03', ic: 'bell' as FeatureIcon, t: 'Düşük doluluk riski', d: 'Doluluk eşiği her oda tipi ve ay için ayarlanabilir — uyarı, fiyatları düzeltmek için hâlâ vakit varken gelir.' },
      { n: '04', ic: 'link' as FeatureIcon, t: 'Pazar ve acenta fiyatları', d: 'Pazar, pazar grubu ve tek tek acentalar bazında günlük fiyatlar — kanal başına manuel yeniden hesaplama yok.' },
      { n: '05', ic: 'lock' as FeatureIcon, t: 'Rezervasyon ödeme durumu', d: 'Tam / kısmi / ödenmedi / iade — kaynak ve acenta ile birlikte her rezervasyonda görünür.' },
      { n: '06', ic: 'doc' as FeatureIcon, t: 'Fotoğraf galerisi ve fact sheet', d: 'Kategorilere ayrılmış oda ve tesis fotoğrafları, olanaklar fact sheet\'i — otel içeriği dağınık e-postalarda değil tek bir yerde.' },
    ],
    s2Kicker: '02 · ODA TİPLERİ',
    s2Title: 'Doluluk ve gelir — oda tipine göre ayrı ayrı.',
    s2Summary: 'Genel otel doluluğu, oda tipi düzeyinde neler olduğunu gizler. Burada planın nerede yolunda gittiğini, nerede gitmediğini görürsünüz.',
    tableHead: { name: 'Oda tipi', qty: 'Oda', sold: 'Satıldı', occ: 'Doluluk', adr: 'ADR', revenue: 'Gelir' },
    table: [
      { name: 'Standard Twin', qty: 30, sold: 26, occ: 87, adr: 82, revenue: 2132, level: '' },
      { name: 'Standard Double', qty: 20, sold: 17, occ: 85, adr: 88, revenue: 1496, level: '' },
      { name: 'Delux Sea View', qty: 15, sold: 10, occ: 67, adr: 132, revenue: 1320, level: 'low' },
      { name: 'Suite Junior', qty: 10, sold: 4, occ: 40, adr: 210, revenue: 840, level: 'low' },
      { name: 'Family Room', qty: 6, sold: 5, occ: 83, adr: 168, revenue: 840, level: '' },
    ],
    s3Kicker: '03 · NASIL ÇALIŞIR',
    s3Title: 'Fiyat kurulumundan pazar bazlı analize.',
    steps: [
      { t: 'Fiyat ve satış durdurma', d: 'Pazar başına günlük fiyatlar ve geçerlilik dönemi belirleyin; gerektiğinde belirli tarihlerde bir oda tipini satış durdurma ile kapatın.' },
      { t: 'Rezervasyon', d: 'Rezervasyon manuel, bir acentadan veya toplu içe aktarımdan gelir — baştan itibaren pazar, kaynak ve ödeme durumuyla birlikte.' },
      { t: 'Pacing ve uyarı', d: 'Sistem, gerçekleşenleri varış tarihine göre hedef hızla karşılaştırır ve düşük doluluk riski taşıyan oda tipleri için uyarı verir.' },
      { t: 'Pazar analizi', d: 'Gelir hunisi ve oda tipi, pazar ve acenta bazlı kırılımlar gelirin tam olarak nerede kaybedildiğini gösterir.' },
    ],
    s4Kicker: '04 · OLAY AKIŞI',
    s4Title: 'Her fiyat ve rezervasyon değişikliği, tarihli ve açıklamalı.',
    s4Summary: 'Yeni rezervasyonlar, durum değişiklikleri, fiyat değişiklikleri, satış durdurmalar, düşük doluluk uyarıları — dağınık tablolar yerine tek bir akış.',
    moves: [
      { t: 'bugün 11:40', d: 'Uyarı: Suite Junior — Mart ayında düşük doluluk riski', qty: 'uyarı', dir: 'out' },
      { t: 'bugün 09:15', d: 'Yeni rezervasyon · Delux Sea View, TravelHub acentası', qty: 'yeni', dir: 'in' },
      { t: 'dün 17:30', d: 'Fiyat değişti · Standard Twin, DE pazarı', qty: 'fiyat', dir: 'in' },
      { t: 'dün 14:02', d: 'Satış durduruldu · Family Room, 12–15 Temmuz', qty: 'durduruldu', dir: 'out' },
      { t: '2 gün önce', d: 'Durum değişti · rezervasyon #4482, ödeme alındı', qty: 'ödeme', dir: 'in' },
    ],
    metrics: [
      { v: '90+ gün', l: 'varış öncesi pacing ufku' },
      { v: '−%27', l: 'fark edilmeden düşük dolulukta kalan oda tipi' },
      { v: '81', l: 'bu örnekte yönetilen oda sayısı' },
      { v: '7/24', l: 'oda tipine göre risk izleme' },
    ],
    ctaKicker: 'Sorun haline gelmeden farkı görmeye hazır mısınız?',
    ctaTitle: '14 gün ücretsiz. Fiyatlarınızı ve mevcut dolulukları biz aktarıyoruz.',
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
const AMBER = '#c08319';
const RED = '#cc2f47';
const AMBER_BG = '#fbf2dc';
const FF = "'Inter Tight', sans-serif";
const FM = "'JetBrains Mono', monospace";

const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FM, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: INK, display: 'inline-block' }} />
    {children}
  </div>
);

export default function HotelSolutionsPage() {
  const { i18n } = useTranslation();
  const lang = ((i18n.language || 'ru').slice(0, 2) as Lang) in T ? (i18n.language || 'ru').slice(0, 2) as Lang : 'ru';
  const tx = T[lang];
  const numberLocale = lang === 'ru' ? 'ru-RU' : lang === 'tr' ? 'tr-TR' : 'en-US';

  return (
    <div style={{ background: '#fff', color: INK, fontFamily: "'Inter', sans-serif", minHeight: '100vh' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />

      <PublicHeader activeKey="hotels" />

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
            <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: 18, boxShadow: '0 20px 50px rgba(15,23,42,0.08)' }}>
              <div className="flex items-start justify-between" style={{ marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: FM, fontSize: 10, color: FG3 }}>{tx.heroCardLabel}</div>
                  <div style={{ fontFamily: FF, fontSize: 15, fontWeight: 600, marginTop: 4 }}>{tx.heroCardTitle}</div>
                </div>
                <span style={{ fontFamily: FM, fontSize: 10, padding: '3px 9px', border: `1px solid ${LINE}`, borderRadius: 999, color: FG2 }}>{tx.heroCardTag}</span>
              </div>
              <div className="grid grid-cols-3" style={{ gap: 8, marginBottom: 14 }}>
                {tx.heroKpis.map((k) => (
                  <div key={k.l} style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontFamily: FM, fontSize: 9, letterSpacing: '0.08em', color: FG3 }}>{k.l}</div>
                    <div style={{ fontFamily: FF, fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 5, color: k.color ?? INK }}>{k.v}</div>
                  </div>
                ))}
              </div>
              {tx.heroRows.map((r, i) => (
                <div key={r.loc} className="flex items-center gap-2.5" style={{ padding: '9px 0', borderBottom: i < tx.heroRows.length - 1 ? `1px solid ${BG_MUTED}` : 'none', fontSize: 12 }}>
                  <span style={{ fontFamily: FM, fontSize: 10, padding: '2px 7px', border: `1px solid ${LINE}`, borderRadius: 5, background: BG_MUTED, color: INK }}>{r.loc}</span>
                  <span style={{ color: INK, fontWeight: 500, flex: 1 }}>{r.name}</span>
                  <span style={{ fontFamily: FM, fontWeight: 600, color: r.level === 'low' ? AMBER : r.level === 'out' ? FG3 : INK }}>{r.qty}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.section>

        {/* ── 01 Problem / feature grid ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ borderTop: `1px solid ${LINE}`, paddingTop: 56, paddingBottom: 56 }}
        >
          <Kicker>{tx.s1Kicker}</Kicker>
          <h2 style={{ fontFamily: FF, fontSize: 'clamp(24px, 2.8vw, 34px)', fontWeight: 500, letterSpacing: '-0.02em', marginTop: 14, maxWidth: 640, color: INK }}>{tx.s1Title}</h2>
          <p style={{ fontSize: 14.5, color: FG2, marginTop: 12, maxWidth: 640, lineHeight: 1.6 }}>{tx.s1Summary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ marginTop: 36, border: `1px solid ${LINE}`, borderRadius: 16, overflow: 'hidden' }}>
            {tx.features.map((f, i) => (
              <motion.div
                key={f.n}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                style={{
                  padding: 24,
                  borderRight: (i % 3 !== 2) ? `1px solid ${LINE}` : 'none',
                  borderBottom: i < 3 ? `1px solid ${LINE}` : 'none',
                }}
              >
                <div style={{ fontFamily: FM, fontSize: 11, color: FG3, letterSpacing: '0.08em' }}>{f.n}</div>
                <div style={{ color: FG2, marginTop: 12 }}><FeatureIconGlyph name={f.ic} /></div>
                <div style={{ fontFamily: FF, fontSize: 15.5, fontWeight: 500, marginTop: 12, color: INK }}>{f.t}</div>
                <div style={{ fontSize: 12.5, color: FG2, marginTop: 8, lineHeight: 1.55 }}>{f.d}</div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── 02 Room types table ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ borderTop: `1px solid ${LINE}`, paddingTop: 56, paddingBottom: 56 }}
        >
          <Kicker>{tx.s2Kicker}</Kicker>
          <h2 style={{ fontFamily: FF, fontSize: 'clamp(24px, 2.8vw, 34px)', fontWeight: 500, letterSpacing: '-0.02em', marginTop: 14, maxWidth: 640, color: INK }}>{tx.s2Title}</h2>
          <p style={{ fontSize: 14.5, color: FG2, marginTop: 12, maxWidth: 640, lineHeight: 1.6 }}>{tx.s2Summary}</p>

          <div className="overflow-x-auto" style={{ marginTop: 32, border: `1px solid ${LINE}`, borderRadius: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '11px 14px', fontFamily: FM, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: FG3, background: BG_MUTED, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>{tx.tableHead.name}</th>
                  <th style={{ textAlign: 'right', padding: '11px 14px', fontFamily: FM, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: FG3, background: BG_MUTED, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>{tx.tableHead.qty}</th>
                  <th style={{ textAlign: 'right', padding: '11px 14px', fontFamily: FM, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: FG3, background: BG_MUTED, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>{tx.tableHead.sold}</th>
                  <th style={{ textAlign: 'right', padding: '11px 14px', fontFamily: FM, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: FG3, background: BG_MUTED, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>{tx.tableHead.occ}</th>
                  <th style={{ textAlign: 'right', padding: '11px 14px', fontFamily: FM, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: FG3, background: BG_MUTED, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>{tx.tableHead.adr}</th>
                  <th style={{ textAlign: 'right', padding: '11px 14px', fontFamily: FM, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: FG3, background: BG_MUTED, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>{tx.tableHead.revenue}</th>
                </tr>
              </thead>
              <tbody>
                {tx.table.map((r, i) => {
                  const isLast = i === tx.table.length - 1;
                  const rowBg = r.level === 'low' ? AMBER_BG : undefined;
                  return (
                    <tr key={r.name} style={{ background: rowBg }}>
                      <td style={{ padding: '10px 14px', borderBottom: isLast ? 'none' : `1px solid ${BG_MUTED}`, fontWeight: 500, color: INK }}>{r.name}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: isLast ? 'none' : `1px solid ${BG_MUTED}`, fontFamily: FM, fontSize: 12 }}>{r.qty}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: isLast ? 'none' : `1px solid ${BG_MUTED}`, fontFamily: FM, fontSize: 12 }}>{r.sold}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: isLast ? 'none' : `1px solid ${BG_MUTED}`, fontFamily: FM, fontSize: 12, fontWeight: 600, color: r.level === 'low' ? AMBER : INK }}>{r.occ}%</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: isLast ? 'none' : `1px solid ${BG_MUTED}`, fontFamily: FM, fontSize: 12 }}>${r.adr}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: isLast ? 'none' : `1px solid ${BG_MUTED}`, fontFamily: FM, fontSize: 12 }}>${r.revenue.toLocaleString(numberLocale)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* ── 03 Workflow ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ borderTop: `1px solid ${LINE}`, paddingTop: 56, paddingBottom: 56 }}
        >
          <Kicker>{tx.s3Kicker}</Kicker>
          <h2 style={{ fontFamily: FF, fontSize: 'clamp(24px, 2.8vw, 34px)', fontWeight: 500, letterSpacing: '-0.02em', marginTop: 14, maxWidth: 640, color: INK }}>{tx.s3Title}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ marginTop: 32, border: `1px solid ${LINE}`, borderRadius: 16, overflow: 'hidden' }}>
            {tx.steps.map((s, i) => (
              <motion.div
                key={s.t}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.35 }}
                style={{ padding: '28px 22px', borderRight: i < tx.steps.length - 1 ? `1px solid ${LINE}` : 'none' }}
              >
                <div style={{ fontFamily: FM, fontSize: 11, color: FG3, letterSpacing: '0.1em' }}>{lang === 'ru' ? `ШАГ ${i + 1}` : lang === 'tr' ? `ADIM ${i + 1}` : `STEP ${i + 1}`}</div>
                <h4 style={{ fontFamily: FF, fontSize: 16, fontWeight: 500, marginTop: 14, letterSpacing: '-0.01em', color: INK }}>{s.t}</h4>
                <p style={{ fontSize: 12.5, color: FG2, marginTop: 8, lineHeight: 1.55 }}>{s.d}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── 04 Event feed ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ borderTop: `1px solid ${LINE}`, paddingTop: 56, paddingBottom: 56 }}
        >
          <Kicker>{tx.s4Kicker}</Kicker>
          <h2 style={{ fontFamily: FF, fontSize: 'clamp(24px, 2.8vw, 34px)', fontWeight: 500, letterSpacing: '-0.02em', marginTop: 14, maxWidth: 640, color: INK }}>{tx.s4Title}</h2>
          <p style={{ fontSize: 14.5, color: FG2, marginTop: 12, maxWidth: 640, lineHeight: 1.6 }}>{tx.s4Summary}</p>

          <div style={{ marginTop: 28, border: `1px solid ${LINE}`, borderRadius: 16, overflow: 'hidden' }}>
            {tx.moves.map((m, i) => (
              <div key={i} className="grid grid-cols-[100px_1fr_auto] sm:grid-cols-[120px_1fr_auto] items-center" style={{ gap: 14, padding: '13px 18px', borderBottom: i < tx.moves.length - 1 ? `1px solid ${BG_MUTED}` : 'none', fontSize: 12.5 }}>
                <span style={{ fontFamily: FM, fontSize: 11, color: FG3 }}>{m.t}</span>
                <span style={{ color: INK }}>{m.d}</span>
                <span style={{ fontFamily: FM, fontWeight: 600, color: m.dir === 'in' ? '#1f8a5e' : RED }}>{m.qty}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Metrics ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4"
          style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, marginBottom: 64 }}
        >
          {tx.metrics.map((m, i) => (
            <div
              key={m.l}
              className={['py-8 px-5', i % 2 === 0 ? 'border-r' : '', i < 2 ? 'border-b md:border-b-0' : '', i === 1 ? 'md:border-r' : ''].filter(Boolean).join(' ')}
              style={{ borderColor: LINE }}
            >
              <div style={{ fontFamily: FF, fontSize: 'clamp(26px, 3.2vw, 38px)', fontWeight: 500, letterSpacing: '-0.03em', color: INK }}>{m.v}</div>
              <div style={{ fontSize: 12.5, color: FG2, marginTop: 8 }}>{m.l}</div>
            </div>
          ))}
        </motion.section>

        {/* ── CTA ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: 80, borderRadius: 12, border: `1px solid ${LINE}`, padding: '56px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap', position: 'relative', overflow: 'hidden' }}
        >
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
