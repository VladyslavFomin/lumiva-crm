import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PublicHeader } from '../../components/public/PublicHeader';
import { PublicFooter } from '../../components/public/PublicFooter';

type Lang = 'ru' | 'en' | 'tr';

const FEATURE_ICONS = ['grid', 'lock', 'link', 'bell', 'clock', 'doc'] as const;
type FeatureIcon = (typeof FEATURE_ICONS)[number];

const FeatureIconGlyph: React.FC<{ name: FeatureIcon }> = ({ name }) => {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'grid':
      return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.2" /><rect x="14" y="3" width="7" height="7" rx="1.2" /><rect x="3" y="14" width="7" height="7" rx="1.2" /><rect x="14" y="14" width="7" height="7" rx="1.2" /></svg>;
    case 'lock':
      return <svg {...common}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>;
    case 'link':
      return <svg {...common}><path d="M9 15l6-6" /><path d="M8 17l-2.5 2.5a3.5 3.5 0 01-5-5L3 12" /><path d="M16 7l2.5-2.5a3.5 3.5 0 015 5L21 12" /></svg>;
    case 'bell':
      return <svg {...common}><path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 004 0" /></svg>;
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>;
    case 'doc':
      return <svg {...common}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /><path d="M9.5 13h5M9.5 16.5h5" /></svg>;
  }
};

const ArrowRight: React.FC = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
);

const T = {
  ru: {
    kicker: 'РЕШЕНИЕ · УПРАВЛЕНИЕ СКЛАДОМ',
    title1: 'Видите каждую ячейку,',
    title2: 'а не только «сколько всего на складе».',
    sub: 'Остатки по ячейкам, резервы под незакрытые заказы и поставки в пути — в одной таблице. Алерты по минимальному остатку срабатывают раньше, чем клиент узнаёт, что товара нет.',
    ctaPrimary: 'Попробовать бесплатно',
    ctaSecondary: 'Смотреть демо',
    heroCardLabel: 'СКЛАД · ГЛАВНЫЙ',
    heroCardTitle: 'Остатки в реальном времени',
    heroCardTag: '128 позиций',
    heroKpis: [
      { l: 'СТОИМОСТЬ', v: '2.4M ₺' },
      { l: 'МАЛО', v: '6', color: '#c08319' },
      { l: 'НЕТ В НАЛИЧИИ', v: '2', color: '#cc2f47' },
    ],
    heroRows: [
      { loc: 'A1-03', name: 'Футболка базовая, чёрная', qty: '128', level: '' },
      { loc: 'A2-11', name: 'Худи оверсайз, серый', qty: '6', level: 'low' },
      { loc: 'B1-02', name: 'Платье миди, красное', qty: '0', level: 'out' },
      { loc: 'D1-07', name: 'Кроссовки classic, белые', qty: '47', level: '' },
    ],
    s1Kicker: '01 · ЗАДАЧА',
    s1Title: '«В наличии» и «доступно к продаже» — разные числа.',
    s1Summary: 'Товар физически на складе, но половина уже зарезервирована под заказы, а часть — в пути от поставщика. Без разбивки по ячейкам, резервам и поставкам склад продаёт то, чего фактически нет.',
    features: [
      { n: '01', ic: 'grid' as FeatureIcon, t: 'Остатки по ячейкам', d: 'Каждая позиция привязана к конкретной ячейке хранения — кладовщик находит товар за секунды, а не обходом склада.' },
      { n: '02', ic: 'lock' as FeatureIcon, t: 'Резервы под заказы', d: 'Как только заказ подтверждён, товар резервируется автоматически — остальные менеджеры видят реальный доступный остаток.' },
      { n: '03', ic: 'link' as FeatureIcon, t: 'Поставки в пути', d: 'Ожидаемые поступления от поставщиков видны заранее — можно обещать клиенту дату, а не гадать.' },
      { n: '04', ic: 'bell' as FeatureIcon, t: 'Алерты по минимуму', d: 'Порог минимального остатка настраивается на каждый товар — уведомление приходит раньше, чем товар закончится.' },
      { n: '05', ic: 'clock' as FeatureIcon, t: 'История движений', d: 'Приёмки, продажи, инвентаризационные корректировки — полная лента с датой, суммой и автором операции.' },
      { n: '06', ic: 'doc' as FeatureIcon, t: 'Ручная инвентаризация', d: 'Быстрая корректировка остатка с указанием причины — расхождения не теряются в комментариях.' },
    ],
    s2Kicker: '02 · ОСТАТКИ ПО ЯЧЕЙКАМ',
    s2Title: 'Полная таблица склада — не сводка, а факт.',
    s2Summary: 'В наличии, в резерве под заказы и в пути от поставщика — три разных числа по каждой позиции. Строка становится жёлтой на грани минимума и красной при нуле.',
    tableHead: { name: 'Товар', loc: 'Ячейка', onhand: 'В наличии', reserved: 'Резерв', incoming: 'В пути', min: 'Мин.', cost: 'Стоимость' },
    table: [
      { sku: 'TS-BLK-001', name: 'Футболка базовая, чёрная', cat: 'Одежда · Мужская', loc: 'A1-03', onhand: 128, reserved: 14, incoming: 60, min: 30, unit: 'шт', cost: 640 },
      { sku: 'HD-GRY-014', name: 'Худи оверсайз, серый меланж', cat: 'Одежда · Мужская', loc: 'A2-11', onhand: 6, reserved: 2, incoming: 40, min: 15, unit: 'шт', cost: 2100 },
      { sku: 'DR-RED-022', name: 'Платье миди, красный', cat: 'Одежда · Женская', loc: 'B1-02', onhand: 0, reserved: 0, incoming: 25, min: 10, unit: 'шт', cost: 2900 },
      { sku: 'BG-TAN-007', name: 'Сумка кожаная, песочная', cat: 'Аксессуары', loc: 'C3-01', onhand: 22, reserved: 3, incoming: 0, min: 8, unit: 'шт', cost: 4200 },
      { sku: 'SN-WHT-099', name: 'Кроссовки classic, белые', cat: 'Обувь', loc: 'D1-07', onhand: 47, reserved: 9, incoming: 0, min: 20, unit: 'пар', cost: 3100 },
      { sku: 'CD-BLK-004', name: 'Кардиган вязаный, чёрный', cat: 'Одежда · Женская', loc: 'B2-04', onhand: 18, reserved: 1, incoming: 0, min: 12, unit: 'шт', cost: 1850 },
      { sku: 'BT-BRN-011', name: 'Ботинки челси, коричневые', cat: 'Обувь', loc: 'D2-02', onhand: 9, reserved: 4, incoming: 20, min: 12, unit: 'пар', cost: 4400 },
      { sku: 'PL-WHT-002', name: 'Плед хлопковый, молочный', cat: 'Товары для дома', loc: 'E1-05', onhand: 34, reserved: 0, incoming: 0, min: 10, unit: 'шт', cost: 1300 },
      { sku: 'CP-NVY-018', name: 'Кепка бейсболка, тёмно-синяя', cat: 'Аксессуары', loc: 'C1-09', onhand: 61, reserved: 5, incoming: 0, min: 20, unit: 'шт', cost: 520 },
      { sku: 'JN-BLU-033', name: 'Джинсы прямые, синие', cat: 'Одежда · Мужская', loc: 'A3-06', onhand: 3, reserved: 1, incoming: 50, min: 15, unit: 'шт', cost: 1600 },
    ],
    s3Kicker: '03 · КАК ЭТО РАБОТАЕТ',
    s3Title: 'От приёмки до отгрузки — без пересчёта вручную.',
    steps: [
      { t: 'Приёмка', d: 'Сканируете штрихкод поставки — остаток пополняется автоматически, ячейка назначается по правилам склада.' },
      { t: 'Резервирование', d: 'Заказ клиента резервирует нужное количество — остальные видят актуальный доступный остаток, а не «физическое» число.' },
      { t: 'Алерт и дозаказ', d: 'При достижении минимума система формирует уведомление и черновик заказа поставщику.' },
      { t: 'Отгрузка и сверка', d: 'Каждая продажа списывает остаток из нужной ячейки; инвентаризация сверяет фактическое количество раз в период.' },
    ],
    s4Kicker: '04 · ИСТОРИЯ ДВИЖЕНИЙ',
    s4Title: 'Лента, где виден каждый плюс и минус.',
    s4Summary: 'Каждое движение — с причиной, документом и датой. Инвентаризация не «расходится в комментариях», а фиксируется как отдельная операция.',
    moves: [
      { t: 'сегодня 14:20', d: 'Приёмка от поставщика Textile Union', qty: '+40', dir: 'in' },
      { t: 'сегодня 09:05', d: 'Продажа · заказ #10482', qty: '-2', dir: 'out' },
      { t: 'вчера 18:44', d: 'Продажа · заказ #10471', qty: '-1', dir: 'out' },
      { t: '6 июля 11:00', d: 'Инвентаризация · корректировка', qty: '-3', dir: 'out' },
      { t: '3 июля 16:12', d: 'Приёмка от поставщика Textile Union', qty: '+60', dir: 'in' },
    ],
    metrics: [
      { v: '99.2%', l: 'точность остатков после внедрения' },
      { v: '−64%', l: 'случаев «продали то, чего нет»' },
      { v: '8 сек', l: 'на поиск товара по ячейке' },
      { v: '24/7', l: 'мониторинг минимальных остатков' },
    ],
    quote: '«Раньше кладовщик обходил склад с блокнотом, чтобы понять, что осталось. Сейчас карта ячеек и алерты по минимуму работают за него — мы сократили случаи "продали то, чего физически нет" почти на две трети.»',
    quoteName: 'Сергей Найдёнов',
    quoteRole: 'Руководитель склада · Umbra Retail',
    ctaKicker: 'Готовы навести порядок на складе?',
    ctaTitle: '14 дней бесплатно. Перенос остатков из вашей системы — за наш счёт.',
    ctaBtn1: 'Создать аккаунт',
    ctaBtn2: 'Связаться с командой',
  },
  en: {
    kicker: 'SOLUTION · WAREHOUSE MANAGEMENT',
    title1: 'See every bin,',
    title2: 'not just "how much is in the warehouse".',
    sub: 'Bin-level stock, reservations for open orders and incoming shipments — in one table. Minimum-stock alerts fire before a customer finds out an item is gone.',
    ctaPrimary: 'Try for free',
    ctaSecondary: 'Watch demo',
    heroCardLabel: 'WAREHOUSE · MAIN',
    heroCardTitle: 'Real-time stock levels',
    heroCardTag: '128 items',
    heroKpis: [
      { l: 'VALUE', v: '$2.4M' },
      { l: 'LOW', v: '6', color: '#c08319' },
      { l: 'OUT OF STOCK', v: '2', color: '#cc2f47' },
    ],
    heroRows: [
      { loc: 'A1-03', name: 'Basic tee, black', qty: '128', level: '' },
      { loc: 'A2-11', name: 'Oversized hoodie, grey', qty: '6', level: 'low' },
      { loc: 'B1-02', name: 'Midi dress, red', qty: '0', level: 'out' },
      { loc: 'D1-07', name: 'Classic sneakers, white', qty: '47', level: '' },
    ],
    s1Kicker: '01 · THE PROBLEM',
    s1Title: '"In stock" and "available to sell" are different numbers.',
    s1Summary: 'A product is physically in the warehouse, but half of it is already reserved for orders, and part is in transit from the supplier. Without a breakdown by bin, reservation and shipment, the warehouse ends up selling stock that isn\'t actually there.',
    features: [
      { n: '01', ic: 'grid' as FeatureIcon, t: 'Bin-level stock', d: 'Every item is tied to a specific storage bin — staff find it in seconds instead of walking the floor.' },
      { n: '02', ic: 'lock' as FeatureIcon, t: 'Order reservations', d: 'As soon as an order is confirmed, stock is reserved automatically — everyone sees the real available quantity.' },
      { n: '03', ic: 'link' as FeatureIcon, t: 'Shipments in transit', d: 'Expected supplier deliveries are visible ahead of time — you can promise a real date instead of guessing.' },
      { n: '04', ic: 'bell' as FeatureIcon, t: 'Minimum-stock alerts', d: 'A minimum threshold is configurable per item — the alert arrives before the product actually runs out.' },
      { n: '05', ic: 'clock' as FeatureIcon, t: 'Movement history', d: 'Receipts, sales and inventory adjustments — a full feed with date, amount and the person responsible.' },
      { n: '06', ic: 'doc' as FeatureIcon, t: 'Manual stock counts', d: 'Quick stock corrections with a reason attached — discrepancies never get lost in comments.' },
    ],
    s2Kicker: '02 · STOCK BY BIN',
    s2Title: 'The full warehouse table — a fact, not a summary.',
    s2Summary: 'On hand, reserved for orders and in transit from suppliers — three different numbers for every item. A row turns yellow near the minimum and red at zero.',
    tableHead: { name: 'Product', loc: 'Bin', onhand: 'On hand', reserved: 'Reserved', incoming: 'Incoming', min: 'Min.', cost: 'Value' },
    table: [
      { sku: 'TS-BLK-001', name: 'Basic tee, black', cat: 'Apparel · Men', loc: 'A1-03', onhand: 128, reserved: 14, incoming: 60, min: 30, unit: 'pcs', cost: 640 },
      { sku: 'HD-GRY-014', name: 'Oversized hoodie, heather grey', cat: 'Apparel · Men', loc: 'A2-11', onhand: 6, reserved: 2, incoming: 40, min: 15, unit: 'pcs', cost: 2100 },
      { sku: 'DR-RED-022', name: 'Midi dress, red', cat: 'Apparel · Women', loc: 'B1-02', onhand: 0, reserved: 0, incoming: 25, min: 10, unit: 'pcs', cost: 2900 },
      { sku: 'BG-TAN-007', name: 'Leather bag, tan', cat: 'Accessories', loc: 'C3-01', onhand: 22, reserved: 3, incoming: 0, min: 8, unit: 'pcs', cost: 4200 },
      { sku: 'SN-WHT-099', name: 'Classic sneakers, white', cat: 'Footwear', loc: 'D1-07', onhand: 47, reserved: 9, incoming: 0, min: 20, unit: 'pairs', cost: 3100 },
      { sku: 'CD-BLK-004', name: 'Knit cardigan, black', cat: 'Apparel · Women', loc: 'B2-04', onhand: 18, reserved: 1, incoming: 0, min: 12, unit: 'pcs', cost: 1850 },
      { sku: 'BT-BRN-011', name: 'Chelsea boots, brown', cat: 'Footwear', loc: 'D2-02', onhand: 9, reserved: 4, incoming: 20, min: 12, unit: 'pairs', cost: 4400 },
      { sku: 'PL-WHT-002', name: 'Cotton throw, cream', cat: 'Home goods', loc: 'E1-05', onhand: 34, reserved: 0, incoming: 0, min: 10, unit: 'pcs', cost: 1300 },
      { sku: 'CP-NVY-018', name: 'Baseball cap, navy', cat: 'Accessories', loc: 'C1-09', onhand: 61, reserved: 5, incoming: 0, min: 20, unit: 'pcs', cost: 520 },
      { sku: 'JN-BLU-033', name: 'Straight jeans, blue', cat: 'Apparel · Men', loc: 'A3-06', onhand: 3, reserved: 1, incoming: 50, min: 15, unit: 'pcs', cost: 1600 },
    ],
    s3Kicker: '03 · HOW IT WORKS',
    s3Title: 'From receiving to shipping — with no manual recount.',
    steps: [
      { t: 'Receiving', d: 'Scan the delivery barcode — stock is topped up automatically and a bin is assigned by warehouse rules.' },
      { t: 'Reservation', d: 'A customer order reserves the needed quantity — everyone else sees the real available stock, not the "physical" number.' },
      { t: 'Alert & reorder', d: 'When stock hits the minimum, the system creates a notification and a draft purchase order.' },
      { t: 'Shipping & reconciliation', d: 'Every sale deducts stock from the right bin; stock counts reconcile actual quantity on a regular cycle.' },
    ],
    s4Kicker: '04 · MOVEMENT HISTORY',
    s4Title: 'A feed where every plus and minus is visible.',
    s4Summary: 'Every movement comes with a reason, a document and a date. Stock counts don\'t "drift in comments" — they\'re recorded as a separate operation.',
    moves: [
      { t: 'today 14:20', d: 'Receiving from Textile Union', qty: '+40', dir: 'in' },
      { t: 'today 09:05', d: 'Sale · order #10482', qty: '-2', dir: 'out' },
      { t: 'yesterday 18:44', d: 'Sale · order #10471', qty: '-1', dir: 'out' },
      { t: 'Jul 6, 11:00', d: 'Stock count · adjustment', qty: '-3', dir: 'out' },
      { t: 'Jul 3, 16:12', d: 'Receiving from Textile Union', qty: '+60', dir: 'in' },
    ],
    metrics: [
      { v: '99.2%', l: 'stock accuracy after rollout' },
      { v: '−64%', l: 'fewer "sold what we don\'t have" cases' },
      { v: '8 sec', l: 'to locate an item by bin' },
      { v: '24/7', l: 'minimum-stock monitoring' },
    ],
    quote: '"Our warehouse lead used to walk the floor with a notepad to figure out what was left. Now the bin map and minimum-stock alerts do that work for him — we cut \'sold what we physically don\'t have\' cases by almost two thirds."',
    quoteName: 'Sergey Naydenov',
    quoteRole: 'Warehouse Lead · Umbra Retail',
    ctaKicker: 'Ready to get your warehouse in order?',
    ctaTitle: '14 days free. We migrate your stock data from your current system at no cost.',
    ctaBtn1: 'Create account',
    ctaBtn2: 'Talk to the team',
  },
  tr: {
    kicker: 'ÇÖZÜM · DEPO YÖNETİMİ',
    title1: 'Sadece "depoda ne kadar var" değil,',
    title2: 'her hücreyi görün.',
    sub: 'Hücre bazlı stok, açık siparişler için rezervler ve yoldaki sevkiyatlar — tek bir tabloda. Minimum stok uyarıları, müşteri ürünün bitmiş olduğunu öğrenmeden önce devreye girer.',
    ctaPrimary: 'Ücretsiz deneyin',
    ctaSecondary: 'Demo izleyin',
    heroCardLabel: 'DEPO · ANA',
    heroCardTitle: 'Gerçek zamanlı stok durumu',
    heroCardTag: '128 kalem',
    heroKpis: [
      { l: 'DEĞER', v: '2.4M ₺' },
      { l: 'AZ', v: '6', color: '#c08319' },
      { l: 'STOKTA YOK', v: '2', color: '#cc2f47' },
    ],
    heroRows: [
      { loc: 'A1-03', name: 'Basic tişört, siyah', qty: '128', level: '' },
      { loc: 'A2-11', name: 'Oversize hoodie, gri', qty: '6', level: 'low' },
      { loc: 'B1-02', name: 'Midi elbise, kırmızı', qty: '0', level: 'out' },
      { loc: 'D1-07', name: 'Klasik spor ayakkabı, beyaz', qty: '47', level: '' },
    ],
    s1Kicker: '01 · SORUN',
    s1Title: '"Stokta var" ile "satışa hazır" farklı sayılardır.',
    s1Summary: 'Ürün fiziksel olarak depodadır, ancak yarısı siparişler için zaten rezerve edilmiştir, bir kısmı da tedarikçiden yoldadır. Hücre, rezerv ve sevkiyat kırılımı olmadan depo, fiilen olmayan ürünü satar.',
    features: [
      { n: '01', ic: 'grid' as FeatureIcon, t: 'Hücre bazlı stok', d: 'Her ürün belirli bir depolama hücresine bağlıdır — depo görevlisi ürünü saniyeler içinde bulur.' },
      { n: '02', ic: 'lock' as FeatureIcon, t: 'Sipariş rezervleri', d: 'Sipariş onaylanır onaylanmaz ürün otomatik olarak rezerve edilir — herkes gerçek kullanılabilir stoğu görür.' },
      { n: '03', ic: 'link' as FeatureIcon, t: 'Yoldaki sevkiyatlar', d: 'Tedarikçiden beklenen teslimatlar önceden görünür — müşteriye tahmin değil gerçek bir tarih verebilirsiniz.' },
      { n: '04', ic: 'bell' as FeatureIcon, t: 'Minimum stok uyarıları', d: 'Minimum eşik her ürün için ayarlanabilir — bildirim ürün bitmeden önce gelir.' },
      { n: '05', ic: 'clock' as FeatureIcon, t: 'Hareket geçmişi', d: 'Kabuller, satışlar, sayım düzeltmeleri — tarih, tutar ve sorumlu kişiyle birlikte tam bir akış.' },
      { n: '06', ic: 'doc' as FeatureIcon, t: 'Manuel sayım', d: 'Sebep belirterek hızlı stok düzeltmesi — tutarsızlıklar yorumlarda kaybolmaz.' },
    ],
    s2Kicker: '02 · HÜCRE BAZLI STOK',
    s2Title: 'Tam depo tablosu — özet değil, gerçek.',
    s2Summary: 'Elde mevcut, siparişler için rezerve ve tedarikçiden yolda — her ürün için üç farklı sayı. Satır minimuma yaklaşınca sarı, sıfırlanınca kırmızı olur.',
    tableHead: { name: 'Ürün', loc: 'Hücre', onhand: 'Mevcut', reserved: 'Rezerv', incoming: 'Yolda', min: 'Min.', cost: 'Değer' },
    table: [
      { sku: 'TS-BLK-001', name: 'Basic tişört, siyah', cat: 'Giyim · Erkek', loc: 'A1-03', onhand: 128, reserved: 14, incoming: 60, min: 30, unit: 'adet', cost: 640 },
      { sku: 'HD-GRY-014', name: 'Oversize hoodie, gri melanj', cat: 'Giyim · Erkek', loc: 'A2-11', onhand: 6, reserved: 2, incoming: 40, min: 15, unit: 'adet', cost: 2100 },
      { sku: 'DR-RED-022', name: 'Midi elbise, kırmızı', cat: 'Giyim · Kadın', loc: 'B1-02', onhand: 0, reserved: 0, incoming: 25, min: 10, unit: 'adet', cost: 2900 },
      { sku: 'BG-TAN-007', name: 'Deri çanta, bej', cat: 'Aksesuar', loc: 'C3-01', onhand: 22, reserved: 3, incoming: 0, min: 8, unit: 'adet', cost: 4200 },
      { sku: 'SN-WHT-099', name: 'Klasik spor ayakkabı, beyaz', cat: 'Ayakkabı', loc: 'D1-07', onhand: 47, reserved: 9, incoming: 0, min: 20, unit: 'çift', cost: 3100 },
      { sku: 'CD-BLK-004', name: 'Örgü hırka, siyah', cat: 'Giyim · Kadın', loc: 'B2-04', onhand: 18, reserved: 1, incoming: 0, min: 12, unit: 'adet', cost: 1850 },
      { sku: 'BT-BRN-011', name: 'Chelsea bot, kahverengi', cat: 'Ayakkabı', loc: 'D2-02', onhand: 9, reserved: 4, incoming: 20, min: 12, unit: 'çift', cost: 4400 },
      { sku: 'PL-WHT-002', name: 'Pamuklu battaniye, krem', cat: 'Ev tekstili', loc: 'E1-05', onhand: 34, reserved: 0, incoming: 0, min: 10, unit: 'adet', cost: 1300 },
      { sku: 'CP-NVY-018', name: 'Şapka, lacivert', cat: 'Aksesuar', loc: 'C1-09', onhand: 61, reserved: 5, incoming: 0, min: 20, unit: 'adet', cost: 520 },
      { sku: 'JN-BLU-033', name: 'Düz kesim kot, mavi', cat: 'Giyim · Erkek', loc: 'A3-06', onhand: 3, reserved: 1, incoming: 50, min: 15, unit: 'adet', cost: 1600 },
    ],
    s3Kicker: '03 · NASIL ÇALIŞIR',
    s3Title: 'Kabulden sevkiyata — manuel sayım olmadan.',
    steps: [
      { t: 'Kabul', d: 'Sevkiyat barkodunu okutun — stok otomatik olarak artar, hücre depo kurallarına göre atanır.' },
      { t: 'Rezervasyon', d: 'Müşteri siparişi gereken miktarı rezerve eder — herkes fiziksel değil gerçek kullanılabilir stoğu görür.' },
      { t: 'Uyarı ve yeniden sipariş', d: 'Minimuma ulaşıldığında sistem bir bildirim ve taslak tedarikçi siparişi oluşturur.' },
      { t: 'Sevkiyat ve mutabakat', d: 'Her satış ilgili hücreden stok düşer; sayım fiziksel miktarı periyodik olarak doğrular.' },
    ],
    s4Kicker: '04 · HAREKET GEÇMİŞİ',
    s4Title: 'Her artı ve eksinin göründüğü akış.',
    s4Summary: 'Her hareket bir sebep, belge ve tarihle birlikte gelir. Sayım "yorumlarda kaybolmaz", ayrı bir işlem olarak kaydedilir.',
    moves: [
      { t: 'bugün 14:20', d: 'Textile Union\'dan kabul', qty: '+40', dir: 'in' },
      { t: 'bugün 09:05', d: 'Satış · sipariş #10482', qty: '-2', dir: 'out' },
      { t: 'dün 18:44', d: 'Satış · sipariş #10471', qty: '-1', dir: 'out' },
      { t: '6 Temmuz 11:00', d: 'Sayım · düzeltme', qty: '-3', dir: 'out' },
      { t: '3 Temmuz 16:12', d: 'Textile Union\'dan kabul', qty: '+60', dir: 'in' },
    ],
    metrics: [
      { v: '%99.2', l: 'kurulum sonrası stok doğruluğu' },
      { v: '−%64', l: '"olmayanı sattık" vakası' },
      { v: '8 sn', l: 'hücreden ürün bulma süresi' },
      { v: '7/24', l: 'minimum stok izleme' },
    ],
    quote: '"Eskiden depo görevlisi elinde defterle depoyu dolaşıp ne kaldığını anlamaya çalışırdı. Şimdi hücre haritası ve minimum stok uyarıları bu işi onun yerine yapıyor — \'fiziksel olarak olmayanı sattık\' vakalarını neredeyse üçte iki azalttık."',
    quoteName: 'Sergey Naydenov',
    quoteRole: 'Depo Sorumlusu · Umbra Retail',
    ctaKicker: 'Deponuzu düzene sokmaya hazır mısınız?',
    ctaTitle: '14 gün ücretsiz. Mevcut sisteminizden stok aktarımı bizden.',
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
const RED_BG = '#fbecef';
const FF = "'Inter Tight', sans-serif";
const FM = "'JetBrains Mono', monospace";

const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FM, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: INK, display: 'inline-block' }} />
    {children}
  </div>
);

export default function WarehouseSolutionsPage() {
  const { i18n } = useTranslation();
  const lang = ((i18n.language || 'ru').slice(0, 2) as Lang) in T ? (i18n.language || 'ru').slice(0, 2) as Lang : 'ru';
  const tx = T[lang];

  return (
    <div style={{ background: '#fff', color: INK, fontFamily: "'Inter', sans-serif", minHeight: '100vh' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />

      <PublicHeader activeKey="warehouse" />

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
                  <span style={{ fontFamily: FM, fontWeight: 600, color: r.level === 'low' ? AMBER : r.level === 'out' ? RED : INK }}>{r.qty}</span>
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

        {/* ── 02 Stock table ── */}
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
                  <th style={{ textAlign: 'right', padding: '11px 14px', fontFamily: FM, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: FG3, background: BG_MUTED, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>{tx.tableHead.onhand}</th>
                  <th style={{ textAlign: 'right', padding: '11px 14px', fontFamily: FM, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: FG3, background: BG_MUTED, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>{tx.tableHead.reserved}</th>
                  <th style={{ textAlign: 'right', padding: '11px 14px', fontFamily: FM, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: FG3, background: BG_MUTED, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>{tx.tableHead.incoming}</th>
                  <th style={{ textAlign: 'right', padding: '11px 14px', fontFamily: FM, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: FG3, background: BG_MUTED, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>{tx.tableHead.min}</th>
                  <th style={{ textAlign: 'right', padding: '11px 14px', fontFamily: FM, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: FG3, background: BG_MUTED, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>{tx.tableHead.cost}</th>
                </tr>
              </thead>
              <tbody>
                {tx.table.map((w, i) => {
                  const level = w.onhand === 0 ? 'out' : w.onhand <= w.min ? 'low' : '';
                  const rowBg = level === 'out' ? RED_BG : level === 'low' ? AMBER_BG : undefined;
                  const isLast = i === tx.table.length - 1;
                  return (
                    <tr key={w.sku} style={{ background: rowBg }}>
                      <td style={{ padding: '10px 14px', borderBottom: isLast ? 'none' : `1px solid ${BG_MUTED}`, verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 500, color: INK }}>{w.name}</div>
                        <span style={{ fontFamily: FM, fontSize: 10, color: FG3, display: 'block', marginTop: 2 }}>{w.sku} · {w.cat}</span>
                      </td>
                      <td style={{ padding: '10px 14px', borderBottom: isLast ? 'none' : `1px solid ${BG_MUTED}` }}>
                        <span style={{ fontFamily: FM, fontSize: 10, padding: '2px 7px', border: `1px solid ${LINE}`, borderRadius: 5, background: BG_MUTED }}>{w.loc}</span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: isLast ? 'none' : `1px solid ${BG_MUTED}`, fontFamily: FM, fontSize: 12 }}>
                        <span style={{ color: level === 'out' ? RED : level === 'low' ? AMBER : INK, fontWeight: 600 }}>{w.onhand}</span> {w.unit}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: isLast ? 'none' : `1px solid ${BG_MUTED}`, fontFamily: FM, fontSize: 12 }}>{w.reserved}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: isLast ? 'none' : `1px solid ${BG_MUTED}`, fontFamily: FM, fontSize: 12 }}>{w.incoming || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: isLast ? 'none' : `1px solid ${BG_MUTED}`, fontFamily: FM, fontSize: 12, color: FG3 }}>{w.min}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: isLast ? 'none' : `1px solid ${BG_MUTED}`, fontFamily: FM, fontSize: 12 }}>{(w.onhand * w.cost).toLocaleString(lang === 'ru' ? 'ru-RU' : lang === 'tr' ? 'tr-TR' : 'en-US')}</td>
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

        {/* ── 04 Movement history ── */}
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

        {/* ── Quote ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-[1fr_260px]"
          style={{ gap: 40, paddingBottom: 64, borderBottom: `1px solid ${LINE}`, marginBottom: 64 }}
        >
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
