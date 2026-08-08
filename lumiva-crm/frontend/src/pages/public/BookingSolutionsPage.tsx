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
    kicker: 'РЕШЕНИЕ · БРОНИРОВАНИЯ',
    title1: 'Расписание, которое',
    title2: 'заполняет себя само.',
    sub: 'Онлайн-запись, занятость сотрудников и лист ожидания — в одной системе. Отмена автоматически предлагается следующему клиенту в очереди, а не пропадает пустым слотом.',
    ctaPrimary: 'Попробовать бесплатно',
    ctaSecondary: 'Смотреть демо',
    heroCardLabel: 'БРОНИРОВАНИЯ · СЕГОДНЯ',
    heroCardTitle: 'Расписание на сегодня',
    heroCardTag: '18 записей',
    heroKpis: [
      { l: 'ЗАГРУЗКА', v: '82%' },
      { l: 'ЛИСТ ОЖИДАНИЯ', v: '4', color: '#c08319' },
      { l: 'НЕ ЯВИЛСЯ', v: '1', color: '#cc2f47' },
    ],
    heroRows: [
      { loc: '10:00', name: 'Стрижка · Анна К.', qty: 'Мария', level: '' },
      { loc: '11:30', name: 'Маникюр · Ольга П.', qty: 'Лена', level: '' },
      { loc: '13:00', name: 'Окрашивание · Ирина С.', qty: 'Мария', level: 'low' },
      { loc: '14:30', name: 'Свободно', qty: '—', level: 'out' },
    ],
    s1Kicker: '01 · ЗАДАЧА',
    s1Title: 'Пустой слот в расписании — это упущенная выручка.',
    s1Summary: 'Клиент отменяет запись за час до визита — и слот просто пропадает, потому что никто не успевает предложить его следующему в очереди. Ручное расписание в блокноте или таблице не умеет ловить такие моменты.',
    features: [
      { n: '01', ic: 'grid' as FeatureIcon, t: 'Каталог услуг и сотрудников', d: 'Локации, услуги, сотрудники и ресурсы (кабинеты, оборудование) — единый каталог, из которого собирается расписание.' },
      { n: '02', ic: 'clock' as FeatureIcon, t: 'Занятость и график', d: 'Недельная доступность, отгулы и проверка конфликтов по каждому сотруднику — двойная запись на одно время невозможна.' },
      { n: '03', ic: 'bell' as FeatureIcon, t: 'Лист ожидания', d: 'При отмене освободившийся слот автоматически предлагается следующему в очереди по приоритету — вручную никого искать не нужно.' },
      { n: '04', ic: 'link' as FeatureIcon, t: 'Виджет онлайн-записи', d: 'Встраиваемая форма для сайта — клиент бронирует сам, без звонка администратору.' },
      { n: '05', ic: 'lock' as FeatureIcon, t: 'Статусы и контроль неявок', d: 'Полный жизненный цикл брони: подтверждена → пришёл → завершена — или отменена/не явился, с отдельной аналитикой по каждому статусу.' },
      { n: '06', ic: 'doc' as FeatureIcon, t: 'Напоминания клиентам', d: 'Шаблоны уведомлений под каждый тип услуги — меньше неявок без ручных звонков.' },
    ],
    s2Kicker: '02 · РАСПИСАНИЕ',
    s2Title: 'Кто, когда и у кого записан — одним взглядом.',
    s2Summary: 'Каждая запись видна по сотруднику, услуге и статусу оплаты. Просроченные и неоплаченные брони подсвечиваются отдельно.',
    tableHead: { name: 'Клиент', loc: 'Время', staff: 'Сотрудник', status: 'Статус', payment: 'Оплата' },
    table: [
      { name: 'Анна Ковалёва', service: 'Стрижка + укладка', time: '10:00', staff: 'Мария', status: 'confirmed', payment: 'paid' },
      { name: 'Ольга Петрова', service: 'Маникюр классический', time: '11:30', staff: 'Лена', status: 'confirmed', payment: 'deposit' },
      { name: 'Ирина Сидорова', service: 'Окрашивание', time: '13:00', staff: 'Мария', status: 'pending', payment: 'unpaid' },
      { name: 'Дмитрий Волков', service: 'Стрижка мужская', time: '13:30', staff: 'Лена', status: 'checked_in', payment: 'paid' },
      { name: 'Светлана Орлова', service: 'Массаж 60 мин', time: '15:00', staff: 'Павел', status: 'no_show', payment: 'unpaid' },
      { name: 'Екатерина Белова', service: 'Педикюр', time: '16:00', staff: 'Лена', status: 'confirmed', payment: 'paid' },
    ],
    statusLabels: { confirmed: 'Подтверждена', pending: 'Ожидает', checked_in: 'Пришёл', no_show: 'Не явился' },
    paymentLabels: { paid: 'Оплачено', deposit: 'Депозит', unpaid: 'Не оплачено' },
    s3Kicker: '03 · КАК ЭТО РАБОТАЕТ',
    s3Title: 'От онлайн-заявки до аналитики загрузки.',
    steps: [
      { t: 'Запись', d: 'Клиент бронирует через виджет на сайте или менеджер вносит запись вручную — обе брони попадают в одно расписание.' },
      { t: 'Подтверждение', d: 'Система отправляет напоминание по шаблону нужного типа услуги — за день и за час до визита.' },
      { t: 'Приём или отмена', d: 'Статус меняется на «пришёл» или «не явился»; при отмене слот сразу предлагается следующему в листе ожидания.' },
      { t: 'Аналитика', d: 'Загрузка по сотрудникам, топ услуг и доля неявок — видно, где расписание работает, а где теряет выручку.' },
    ],
    s4Kicker: '04 · ЛЕНТА АКТИВНОСТИ',
    s4Title: 'Каждое изменение брони — с автором и временем.',
    s4Summary: 'Создание, перенос, смена статуса — полная история по каждой записи, а не только текущее состояние.',
    moves: [
      { t: 'сегодня 09:14', d: 'Бронь создана · Анна Ковалёва, 10:00', qty: 'новая', dir: 'in' },
      { t: 'сегодня 08:50', d: 'Отмена · Светлана Орлова, слот предложен листу ожидания', qty: 'отмена', dir: 'out' },
      { t: 'вчера 18:20', d: 'Перенос · Ирина Сидорова, 13:00 → 13:00 (др. сотрудник)', qty: 'перенос', dir: 'in' },
      { t: 'вчера 16:05', d: 'Завершена · Екатерина Белова', qty: 'готово', dir: 'in' },
      { t: '2 дня назад', d: 'Не явился · клиент из листа ожидания', qty: 'no-show', dir: 'out' },
    ],
    metrics: [
      { v: '−38%', l: 'неявок после включения напоминаний' },
      { v: '3 мин', l: 'на бронирование через виджет' },
      { v: '82%', l: 'средняя загрузка по сотрудникам' },
      { v: '24/7', l: 'приём заявок без администратора' },
    ],
    ctaKicker: 'Готовы автоматизировать расписание?',
    ctaTitle: '14 дней бесплатно. Перенос текущих записей — за наш счёт.',
    ctaBtn1: 'Создать аккаунт',
    ctaBtn2: 'Связаться с командой',
  },
  en: {
    kicker: 'SOLUTION · BOOKINGS',
    title1: 'A schedule that',
    title2: 'fills itself in.',
    sub: 'Online booking, staff availability and a waitlist — in one system. A cancellation is automatically offered to the next person in line instead of disappearing as an empty slot.',
    ctaPrimary: 'Try for free',
    ctaSecondary: 'Watch demo',
    heroCardLabel: 'BOOKINGS · TODAY',
    heroCardTitle: "Today's schedule",
    heroCardTag: '18 bookings',
    heroKpis: [
      { l: 'OCCUPANCY', v: '82%' },
      { l: 'WAITLIST', v: '4', color: '#c08319' },
      { l: 'NO-SHOW', v: '1', color: '#cc2f47' },
    ],
    heroRows: [
      { loc: '10:00', name: 'Haircut · Anna K.', qty: 'Maria', level: '' },
      { loc: '11:30', name: 'Manicure · Olga P.', qty: 'Lena', level: '' },
      { loc: '13:00', name: 'Color · Irina S.', qty: 'Maria', level: 'low' },
      { loc: '14:30', name: 'Open', qty: '—', level: 'out' },
    ],
    s1Kicker: '01 · THE PROBLEM',
    s1Title: 'An empty slot in the schedule is lost revenue.',
    s1Summary: 'A client cancels an hour before their visit — and the slot just disappears because nobody has time to offer it to the next person in line. A notebook or spreadsheet schedule can\'t catch moments like that.',
    features: [
      { n: '01', ic: 'grid' as FeatureIcon, t: 'Services & staff catalog', d: 'Locations, services, staff and resources (rooms, equipment) — one catalog that the schedule is built from.' },
      { n: '02', ic: 'clock' as FeatureIcon, t: 'Availability & schedule', d: 'Weekly availability, time off and conflict checks per staff member — double-booking the same slot is impossible.' },
      { n: '03', ic: 'bell' as FeatureIcon, t: 'Waitlist', d: 'When a slot opens up, it\'s automatically offered to the next person in line by priority — no manual searching needed.' },
      { n: '04', ic: 'link' as FeatureIcon, t: 'Online booking widget', d: 'An embeddable form for your website — clients book themselves, no call to the front desk needed.' },
      { n: '05', ic: 'lock' as FeatureIcon, t: 'Status & no-show control', d: 'A full booking lifecycle — confirmed → checked in → completed — or cancelled/no-show, with separate analytics per status.' },
      { n: '06', ic: 'doc' as FeatureIcon, t: 'Client reminders', d: 'Notification templates per service type — fewer no-shows without manual phone calls.' },
    ],
    s2Kicker: '02 · SCHEDULE',
    s2Title: 'Who, when, and with whom — at a glance.',
    s2Summary: 'Every booking is visible by staff member, service and payment status. Overdue and unpaid bookings are highlighted separately.',
    tableHead: { name: 'Client', loc: 'Time', staff: 'Staff', status: 'Status', payment: 'Payment' },
    table: [
      { name: 'Anna Kovaleva', service: 'Haircut + styling', time: '10:00', staff: 'Maria', status: 'confirmed', payment: 'paid' },
      { name: 'Olga Petrova', service: 'Classic manicure', time: '11:30', staff: 'Lena', status: 'confirmed', payment: 'deposit' },
      { name: 'Irina Sidorova', service: 'Color', time: '13:00', staff: 'Maria', status: 'pending', payment: 'unpaid' },
      { name: 'Dmitry Volkov', service: "Men's haircut", time: '13:30', staff: 'Lena', status: 'checked_in', payment: 'paid' },
      { name: 'Svetlana Orlova', service: '60-min massage', time: '15:00', staff: 'Pavel', status: 'no_show', payment: 'unpaid' },
      { name: 'Ekaterina Belova', service: 'Pedicure', time: '16:00', staff: 'Lena', status: 'confirmed', payment: 'paid' },
    ],
    statusLabels: { confirmed: 'Confirmed', pending: 'Pending', checked_in: 'Checked in', no_show: 'No-show' },
    paymentLabels: { paid: 'Paid', deposit: 'Deposit', unpaid: 'Unpaid' },
    s3Kicker: '03 · HOW IT WORKS',
    s3Title: 'From an online request to occupancy analytics.',
    steps: [
      { t: 'Booking', d: 'A client books through the website widget, or a manager enters it manually — both land in the same schedule.' },
      { t: 'Confirmation', d: 'The system sends a reminder using the right service-type template — a day and an hour before the visit.' },
      { t: 'Check-in or cancellation', d: 'Status changes to "checked in" or "no-show"; on cancellation, the slot is instantly offered to the next person on the waitlist.' },
      { t: 'Analytics', d: 'Occupancy per staff member, top services and no-show rate — see where the schedule works and where it\'s leaking revenue.' },
    ],
    s4Kicker: '04 · ACTIVITY FEED',
    s4Title: 'Every booking change, with who and when.',
    s4Summary: 'Creation, rescheduling, status changes — a full history per booking, not just the current state.',
    moves: [
      { t: 'today 09:14', d: 'Booking created · Anna Kovaleva, 10:00', qty: 'new', dir: 'in' },
      { t: 'today 08:50', d: 'Cancelled · Svetlana Orlova, slot offered to waitlist', qty: 'cancelled', dir: 'out' },
      { t: 'yesterday 18:20', d: 'Rescheduled · Irina Sidorova, 13:00 → 13:00 (different staff)', qty: 'moved', dir: 'in' },
      { t: 'yesterday 16:05', d: 'Completed · Ekaterina Belova', qty: 'done', dir: 'in' },
      { t: '2 days ago', d: 'No-show · client from waitlist', qty: 'no-show', dir: 'out' },
    ],
    metrics: [
      { v: '−38%', l: 'fewer no-shows after enabling reminders' },
      { v: '3 min', l: 'to book through the widget' },
      { v: '82%', l: 'average staff occupancy' },
      { v: '24/7', l: 'booking requests with no front desk' },
    ],
    ctaKicker: 'Ready to automate your schedule?',
    ctaTitle: '14 days free. We migrate your existing bookings at no cost.',
    ctaBtn1: 'Create account',
    ctaBtn2: 'Talk to the team',
  },
  tr: {
    kicker: 'ÇÖZÜM · REZERVASYONLAR',
    title1: 'Kendini dolduran',
    title2: 'bir takvim.',
    sub: 'Online rezervasyon, personel müsaitliği ve bekleme listesi — tek sistemde. İptal edilen randevu, boş bir slot olarak kaybolmak yerine otomatik olarak sıradaki müşteriye önerilir.',
    ctaPrimary: 'Ücretsiz deneyin',
    ctaSecondary: 'Demo izleyin',
    heroCardLabel: 'REZERVASYONLAR · BUGÜN',
    heroCardTitle: 'Bugünkü program',
    heroCardTag: '18 randevu',
    heroKpis: [
      { l: 'DOLULUK', v: '%82' },
      { l: 'BEKLEME LİSTESİ', v: '4', color: '#c08319' },
      { l: 'GELMEDİ', v: '1', color: '#cc2f47' },
    ],
    heroRows: [
      { loc: '10:00', name: 'Saç kesimi · Anna K.', qty: 'Maria', level: '' },
      { loc: '11:30', name: 'Manikür · Olga P.', qty: 'Lena', level: '' },
      { loc: '13:00', name: 'Boyama · Irina S.', qty: 'Maria', level: 'low' },
      { loc: '14:30', name: 'Boş', qty: '—', level: 'out' },
    ],
    s1Kicker: '01 · SORUN',
    s1Title: 'Programdaki boş bir slot, kaybedilen gelirdir.',
    s1Summary: 'Müşteri randevudan bir saat önce iptal eder — ve kimse sıradaki kişiye önermeye vakit bulamadığı için slot kaybolur. Defter veya tablo ile tutulan bir program bu anları yakalayamaz.',
    features: [
      { n: '01', ic: 'grid' as FeatureIcon, t: 'Hizmet ve personel kataloğu', d: 'Lokasyonlar, hizmetler, personel ve kaynaklar (odalar, ekipman) — programın oluşturulduğu tek katalog.' },
      { n: '02', ic: 'clock' as FeatureIcon, t: 'Müsaitlik ve program', d: 'Her personel için haftalık müsaitlik, izinler ve çakışma kontrolü — aynı saate çift randevu imkansızdır.' },
      { n: '03', ic: 'bell' as FeatureIcon, t: 'Bekleme listesi', d: 'Bir slot boşaldığında, öncelik sırasına göre otomatik olarak sıradaki kişiye önerilir — manuel arama gerekmez.' },
      { n: '04', ic: 'link' as FeatureIcon, t: 'Online rezervasyon widget\'ı', d: 'Web siteniz için gömülebilir bir form — müşteriler resepsiyonu aramadan kendileri rezervasyon yapar.' },
      { n: '05', ic: 'lock' as FeatureIcon, t: 'Durum ve gelmeme kontrolü', d: 'Tam bir randevu yaşam döngüsü — onaylandı → geldi → tamamlandı — veya iptal/gelmedi, her durum için ayrı analitikle.' },
      { n: '06', ic: 'doc' as FeatureIcon, t: 'Müşteri hatırlatmaları', d: 'Hizmet türüne göre bildirim şablonları — manuel telefon aramaları olmadan daha az gelmeme.' },
    ],
    s2Kicker: '02 · PROGRAM',
    s2Title: 'Kim, ne zaman ve kimle — tek bakışta.',
    s2Summary: 'Her randevu personel, hizmet ve ödeme durumuna göre görünür. Süresi geçen ve ödenmemiş randevular ayrıca vurgulanır.',
    tableHead: { name: 'Müşteri', loc: 'Saat', staff: 'Personel', status: 'Durum', payment: 'Ödeme' },
    table: [
      { name: 'Anna Kovaleva', service: 'Saç kesimi + fön', time: '10:00', staff: 'Maria', status: 'confirmed', payment: 'paid' },
      { name: 'Olga Petrova', service: 'Klasik manikür', time: '11:30', staff: 'Lena', status: 'confirmed', payment: 'deposit' },
      { name: 'Irina Sidorova', service: 'Boyama', time: '13:00', staff: 'Maria', status: 'pending', payment: 'unpaid' },
      { name: 'Dmitry Volkov', service: 'Erkek saç kesimi', time: '13:30', staff: 'Lena', status: 'checked_in', payment: 'paid' },
      { name: 'Svetlana Orlova', service: '60 dk masaj', time: '15:00', staff: 'Pavel', status: 'no_show', payment: 'unpaid' },
      { name: 'Ekaterina Belova', service: 'Pedikür', time: '16:00', staff: 'Lena', status: 'confirmed', payment: 'paid' },
    ],
    statusLabels: { confirmed: 'Onaylandı', pending: 'Beklemede', checked_in: 'Geldi', no_show: 'Gelmedi' },
    paymentLabels: { paid: 'Ödendi', deposit: 'Depozito', unpaid: 'Ödenmedi' },
    s3Kicker: '03 · NASIL ÇALIŞIR',
    s3Title: 'Online talepten doluluk analitiğine.',
    steps: [
      { t: 'Rezervasyon', d: 'Müşteri site widget\'ı üzerinden rezervasyon yapar veya yönetici manuel girer — ikisi de aynı programa düşer.' },
      { t: 'Onay', d: 'Sistem, doğru hizmet türü şablonunu kullanarak bir gün ve bir saat önce hatırlatma gönderir.' },
      { t: 'Giriş veya iptal', d: 'Durum "geldi" veya "gelmedi" olarak değişir; iptal durumunda slot anında bekleme listesindeki sıradaki kişiye önerilir.' },
      { t: 'Analitik', d: 'Personel bazında doluluk, en çok tercih edilen hizmetler ve gelmeme oranı — programın nerede işlediğini, nerede gelir kaybettiğini görün.' },
    ],
    s4Kicker: '04 · AKTİVİTE AKIŞI',
    s4Title: 'Her randevu değişikliği, kim ve ne zaman ile birlikte.',
    s4Summary: 'Oluşturma, yeniden planlama, durum değişiklikleri — sadece mevcut durum değil, her randevu için tam geçmiş.',
    moves: [
      { t: 'bugün 09:14', d: 'Randevu oluşturuldu · Anna Kovaleva, 10:00', qty: 'yeni', dir: 'in' },
      { t: 'bugün 08:50', d: 'İptal edildi · Svetlana Orlova, slot bekleme listesine önerildi', qty: 'iptal', dir: 'out' },
      { t: 'dün 18:20', d: 'Yeniden planlandı · Irina Sidorova, 13:00 → 13:00 (farklı personel)', qty: 'taşındı', dir: 'in' },
      { t: 'dün 16:05', d: 'Tamamlandı · Ekaterina Belova', qty: 'tamam', dir: 'in' },
      { t: '2 gün önce', d: 'Gelmedi · bekleme listesinden müşteri', qty: 'gelmedi', dir: 'out' },
    ],
    metrics: [
      { v: '−%38', l: 'hatırlatmalar sonrası gelmeme oranı' },
      { v: '3 dk', l: 'widget üzerinden rezervasyon süresi' },
      { v: '%82', l: 'ortalama personel doluluğu' },
      { v: '7/24', l: 'resepsiyonsuz rezervasyon kabulü' },
    ],
    ctaKicker: 'Programınızı otomatikleştirmeye hazır mısınız?',
    ctaTitle: '14 gün ücretsiz. Mevcut randevularınızı biz aktarıyoruz.',
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
const FF = "'Inter Tight', sans-serif";
const FM = "'JetBrains Mono', monospace";

const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FM, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: INK, display: 'inline-block' }} />
    {children}
  </div>
);

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  confirmed: { bg: '#e8f5ee', fg: '#1f8a5e' },
  pending: { bg: '#fbf2dc', fg: AMBER },
  checked_in: { bg: '#e8f0fb', fg: '#2f5fcc' },
  no_show: { bg: '#fbecef', fg: RED },
};
const PAYMENT_COLORS: Record<string, { bg: string; fg: string }> = {
  paid: { bg: '#e8f5ee', fg: '#1f8a5e' },
  deposit: { bg: '#fbf2dc', fg: AMBER },
  unpaid: { bg: '#fbecef', fg: RED },
};

export default function BookingSolutionsPage() {
  const { i18n } = useTranslation();
  const lang = ((i18n.language || 'ru').slice(0, 2) as Lang) in T ? (i18n.language || 'ru').slice(0, 2) as Lang : 'ru';
  const tx = T[lang];

  return (
    <div style={{ background: '#fff', color: INK, fontFamily: "'Inter', sans-serif", minHeight: '100vh' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />

      <PublicHeader activeKey="booking" />

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

        {/* ── 02 Schedule table ── */}
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
                  <th style={{ textAlign: 'left', padding: '11px 14px', fontFamily: FM, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: FG3, background: BG_MUTED, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>{tx.tableHead.loc}</th>
                  <th style={{ textAlign: 'left', padding: '11px 14px', fontFamily: FM, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: FG3, background: BG_MUTED, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>{tx.tableHead.staff}</th>
                  <th style={{ textAlign: 'left', padding: '11px 14px', fontFamily: FM, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: FG3, background: BG_MUTED, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>{tx.tableHead.status}</th>
                  <th style={{ textAlign: 'left', padding: '11px 14px', fontFamily: FM, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: FG3, background: BG_MUTED, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>{tx.tableHead.payment}</th>
                </tr>
              </thead>
              <tbody>
                {tx.table.map((row, i) => {
                  const isLast = i === tx.table.length - 1;
                  const st = STATUS_COLORS[row.status];
                  const pm = PAYMENT_COLORS[row.payment];
                  return (
                    <tr key={row.name + row.time}>
                      <td style={{ padding: '10px 14px', borderBottom: isLast ? 'none' : `1px solid ${BG_MUTED}`, verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 500, color: INK }}>{row.name}</div>
                        <span style={{ fontFamily: FM, fontSize: 10, color: FG3, display: 'block', marginTop: 2 }}>{row.service}</span>
                      </td>
                      <td style={{ padding: '10px 14px', borderBottom: isLast ? 'none' : `1px solid ${BG_MUTED}`, fontFamily: FM, fontSize: 12 }}>{row.time}</td>
                      <td style={{ padding: '10px 14px', borderBottom: isLast ? 'none' : `1px solid ${BG_MUTED}` }}>{row.staff}</td>
                      <td style={{ padding: '10px 14px', borderBottom: isLast ? 'none' : `1px solid ${BG_MUTED}` }}>
                        <span style={{ fontFamily: FM, fontSize: 10.5, padding: '3px 8px', borderRadius: 999, background: st.bg, color: st.fg, fontWeight: 600 }}>{(tx.statusLabels as Record<string, string>)[row.status]}</span>
                      </td>
                      <td style={{ padding: '10px 14px', borderBottom: isLast ? 'none' : `1px solid ${BG_MUTED}` }}>
                        <span style={{ fontFamily: FM, fontSize: 10.5, padding: '3px 8px', borderRadius: 999, background: pm.bg, color: pm.fg, fontWeight: 600 }}>{(tx.paymentLabels as Record<string, string>)[row.payment]}</span>
                      </td>
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

        {/* ── 04 Activity feed ── */}
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
