import { TriggerEvent } from '../automations/automation.entity';

/**
 * Готовые сценарии «путь гостя» — ставятся в «Автоматизации» обычными автоматизациями, ВЫКЛЮЧЕННЫМИ: клиент
 * проверяет текст и включает. Основной текст — английский, варианты по языку гостя ({{guest_lang}}) — ru/tr.
 * Письма уходят с почты клиента (без выбранного ящика — почта CRM по умолчанию).
 */
type L = { subject: string; textBody: string };
type Preset = {
  key: string;
  name: Record<'ru' | 'en' | 'tr', string>;
  triggerEvent: TriggerEvent;
  meta: Record<string, unknown>;
  conditions?: Array<{ field: string; operator: string; value?: unknown }>;
  actions: Array<{ type: string; config: Record<string, unknown> }>;
};

const email = (en: L, ru: L, tr: L) => ({
  type: 'send_email',
  config: { to: '{{guest_email}}', subject: en.subject, textBody: en.textBody, langVariants: { ru, tr } },
});

export const HOTEL_JOURNEY_PRESETS: Preset[] = [
  {
    key: 'pre_arrival',
    name: { ru: 'Гость: за 3 дня до заезда — онлайн-регистрация', en: 'Guest: 3 days before arrival — online check-in', tr: 'Misafir: girişten 3 gün önce — online check-in' },
    triggerEvent: TriggerEvent.HOTEL_GUEST_BEFORE_ARRIVAL,
    meta: { offsetDays: 3, sendTime: '10:00' },
    conditions: [{ field: 'guest_email', operator: 'is_not_empty' }],
    actions: [
      email(
        { subject: 'See you soon at {{hotel_name}}', textBody: 'Dear {{guest_first_name}},\n\nWe look forward to welcoming you on {{check_in}} ({{nights}} nights, {{room_type}}).\n\nSave time at reception — fill in the guest details online:\n{{precheckin_link}}\n\nCheck-in from {{checkin_time}}. See you soon!\n{{hotel_name}}' },
        { subject: 'Скоро увидимся в {{hotel_name}}', textBody: 'Здравствуйте, {{guest_first_name}}!\n\nЖдём вас {{check_in}} ({{nights}} ноч., {{room_type}}).\n\nСэкономьте время на ресепшене — заполните данные гостей онлайн:\n{{precheckin_link}}\n\nЗаселение с {{checkin_time}}. До встречи!\n{{hotel_name}}' },
        { subject: '{{hotel_name}} — yakında görüşmek üzere', textBody: 'Sayın {{guest_first_name}},\n\nSizi {{check_in}} tarihinde bekliyoruz ({{nights}} gece, {{room_type}}).\n\nResepsiyonda zaman kazanın — misafir bilgilerini online doldurun:\n{{precheckin_link}}\n\nGiriş saati {{checkin_time}}. Görüşmek üzere!\n{{hotel_name}}' },
      ),
    ],
  },
  {
    key: 'deposit_due',
    name: { ru: 'Гость: напоминание о предоплате за 2 дня до срока', en: 'Guest: deposit reminder 2 days before due', tr: 'Misafir: ön ödeme hatırlatması (2 gün önce)' },
    triggerEvent: TriggerEvent.HOTEL_DEPOSIT_DUE,
    meta: { offsetDays: 2, sendTime: '10:00' },
    conditions: [{ field: 'guest_email', operator: 'is_not_empty' }],
    actions: [
      email(
        { subject: 'Deposit for your booking at {{hotel_name}}', textBody: 'Dear {{guest_first_name}},\n\nTo keep your booking {{booking_code}} ({{check_in}} – {{check_out}}), please pay the deposit of {{deposit_left}} {{currency}} by {{deposit_due}}:\n{{pay_link}}\n\nThank you!\n{{hotel_name}}' },
        { subject: 'Предоплата брони в {{hotel_name}}', textBody: 'Здравствуйте, {{guest_first_name}}!\n\nЧтобы сохранить бронь {{booking_code}} ({{check_in}} – {{check_out}}), оплатите, пожалуйста, предоплату {{deposit_left}} {{currency}} до {{deposit_due}}:\n{{pay_link}}\n\nСпасибо!\n{{hotel_name}}' },
        { subject: '{{hotel_name}} rezervasyon ön ödemesi', textBody: 'Sayın {{guest_first_name}},\n\n{{booking_code}} rezervasyonunuzu ({{check_in}} – {{check_out}}) korumak için lütfen {{deposit_left}} {{currency}} ön ödemeyi {{deposit_due}} tarihine kadar yapın:\n{{pay_link}}\n\nTeşekkürler!\n{{hotel_name}}' },
      ),
    ],
  },
  {
    key: 'payment_thanks',
    name: { ru: 'Гость: спасибо за онлайн-оплату', en: 'Guest: thank you for the online payment', tr: 'Misafir: online ödeme teşekkürü' },
    triggerEvent: TriggerEvent.HOTEL_PAYMENT_RECEIVED,
    meta: {},
    conditions: [{ field: 'guest_email', operator: 'is_not_empty' }],
    actions: [
      email(
        { subject: 'Payment received — {{hotel_name}}', textBody: 'Dear {{guest_first_name}},\n\nWe have received your payment of {{payment_amount}} {{payment_currency}} for booking {{booking_code}}. See you on {{check_in}}!\n\n{{hotel_name}}' },
        { subject: 'Оплата получена — {{hotel_name}}', textBody: 'Здравствуйте, {{guest_first_name}}!\n\nМы получили оплату {{payment_amount}} {{payment_currency}} по брони {{booking_code}}. Ждём вас {{check_in}}!\n\n{{hotel_name}}' },
        { subject: 'Ödeme alındı — {{hotel_name}}', textBody: 'Sayın {{guest_first_name}},\n\n{{booking_code}} rezervasyonu için {{payment_amount}} {{payment_currency}} ödemenizi aldık. {{check_in}} tarihinde görüşmek üzere!\n\n{{hotel_name}}' },
      ),
    ],
  },
  {
    key: 'welcome',
    name: { ru: 'Гость: день заезда — приветствие и заявки из номера', en: 'Guest: arrival day — welcome & room requests', tr: 'Misafir: giriş günü — hoş geldiniz ve oda talepleri' },
    triggerEvent: TriggerEvent.HOTEL_GUEST_ARRIVAL_DAY,
    meta: { sendTime: '16:00' },
    conditions: [{ field: 'guest_email', operator: 'is_not_empty' }, { field: 'status', operator: 'equals', value: 'checked_in' }],
    actions: [
      email(
        { subject: 'Welcome to {{hotel_name}}!', textBody: 'Dear {{guest_first_name}},\n\nWelcome! If you need anything during your stay — towels, cleaning, a repair — just tap here and the right team gets it right away:\n{{guest_care_link}}\n\nEnjoy your stay!\n{{hotel_name}}' },
        { subject: 'Добро пожаловать в {{hotel_name}}!', textBody: 'Здравствуйте, {{guest_first_name}}!\n\nДобро пожаловать! Если во время отдыха что-то понадобится — полотенца, уборка, ремонт — нажмите сюда, и заявка сразу уйдёт нужной службе:\n{{guest_care_link}}\n\nПриятного отдыха!\n{{hotel_name}}' },
        { subject: '{{hotel_name}} — hoş geldiniz!', textBody: 'Sayın {{guest_first_name}},\n\nHoş geldiniz! Konaklamanız sırasında bir şeye ihtiyacınız olursa — havlu, temizlik, arıza — buraya dokunun, talep hemen ilgili ekibe gider:\n{{guest_care_link}}\n\nİyi tatiller!\n{{hotel_name}}' },
      ),
    ],
  },
  {
    key: 'mid_stay',
    name: { ru: 'Гость: 2-й день — как вам у нас? (опрос)', en: 'Guest: day 2 — how is your stay? (survey)', tr: 'Misafir: 2. gün — konaklamanız nasıl? (anket)' },
    triggerEvent: TriggerEvent.HOTEL_GUEST_IN_STAY,
    meta: { offsetDays: 1, sendTime: '18:00' },
    conditions: [{ field: 'guest_email', operator: 'is_not_empty' }, { field: 'nights', operator: 'greater_than', value: 2 }],
    actions: [
      email(
        { subject: 'How is your stay, {{guest_first_name}}?', textBody: 'Dear {{guest_first_name}},\n\nWe hope you are enjoying {{hotel_name}}. One tap — how is everything so far?\n{{survey_link}}\n\nIf something is not right, we will fix it today.' },
        { subject: 'Как вам у нас, {{guest_first_name}}?', textBody: 'Здравствуйте, {{guest_first_name}}!\n\nНадеемся, вам нравится в {{hotel_name}}. Одно нажатие — как всё проходит?\n{{survey_link}}\n\nЕсли что-то не так — исправим сегодня же.' },
        { subject: 'Konaklamanız nasıl, {{guest_first_name}}?', textBody: 'Sayın {{guest_first_name}},\n\n{{hotel_name}}’da keyifli vakit geçirdiğinizi umuyoruz. Tek dokunuş — her şey nasıl gidiyor?\n{{survey_link}}\n\nBir sorun varsa bugün çözeriz.' },
      ),
    ],
  },
  {
    key: 'post_stay',
    name: { ru: 'Гость: через день после выезда — спасибо и отзыв', en: 'Guest: day after departure — thanks & review', tr: 'Misafir: çıkıştan bir gün sonra — teşekkür ve yorum' },
    triggerEvent: TriggerEvent.HOTEL_GUEST_AFTER_DEPARTURE,
    meta: { offsetDays: 1, sendTime: '11:00' },
    conditions: [{ field: 'guest_email', operator: 'is_not_empty' }],
    actions: [
      email(
        { subject: 'Thank you for staying at {{hotel_name}}', textBody: 'Dear {{guest_first_name}},\n\nThank you for choosing {{hotel_name}}! We would love to hear how it was — it takes 10 seconds:\n{{survey_link}}\n\nWe hope to see you again.' },
        { subject: 'Спасибо, что выбрали {{hotel_name}}', textBody: 'Здравствуйте, {{guest_first_name}}!\n\nСпасибо, что отдыхали в {{hotel_name}}! Расскажите, как всё прошло — это 10 секунд:\n{{survey_link}}\n\nБудем рады видеть вас снова.' },
        { subject: '{{hotel_name}}’ı tercih ettiğiniz için teşekkürler', textBody: 'Sayın {{guest_first_name}},\n\n{{hotel_name}}’da konakladığınız için teşekkür ederiz! Nasıl geçtiğini anlatın — 10 saniye sürer:\n{{survey_link}}\n\nSizi tekrar görmek isteriz.' },
      ),
    ],
  },
  {
    key: 'negative_alert',
    name: { ru: 'Менеджеру: гость недоволен (оценка 3 и ниже)', en: 'Manager: unhappy guest (score 3 or lower)', tr: 'Müdüre: memnun olmayan misafir (puan 3 ve altı)' },
    triggerEvent: TriggerEvent.HOTEL_GUEST_FEEDBACK_NEGATIVE,
    meta: {},
    actions: [
      { type: 'send_notification', config: { title: 'Гость недоволен: {{guest_name}} · {{score_stars}}', message: '{{hotel_name}} · номер {{room_number}} · {{check_in}}–{{check_out}}\n«{{comment}}»\n{{crm_url}}' } },
    ],
  },
];
