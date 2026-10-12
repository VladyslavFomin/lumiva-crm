/**
 * Стартовые шаблоны писем ИИ-отдела: появляются в «Шаблонах писем» компании при создании отдела,
 * в фирменной обёртке (useWrapper), и агенты отдела выбирают их вместо письма «с нуля».
 * Ключ (meta.aiOfficeStarter) не даёт создать один и тот же шаблон дважды.
 */
type L = { ru: string; en: string; tr: string };
export type StarterTemplate = { key: string; name: L; description: L; subject: L; text: L };

const WELCOME: StarterTemplate = {
  key: 'sales_welcome',
  name: { ru: 'Приветствие нового лида', en: 'New lead welcome', tr: 'Yeni lead karşılama' },
  description: { ru: 'Первый ответ на заявку: благодарность и 2 вопроса квалификации', en: 'First reply to an inquiry: thanks and 2 qualifying questions', tr: 'Talebe ilk yanıt: teşekkür ve 2 nitelendirme sorusu' },
  subject: { ru: '{{lead.name}}, спасибо за обращение', en: '{{lead.name}}, thank you for reaching out', tr: '{{lead.name}}, bize ulaştığınız için teşekkürler' },
  text: {
    ru: 'Здравствуйте, {{lead.name}}!\n\nСпасибо, что обратились к нам. Чтобы предложить подходящее решение, подскажите, пожалуйста:\n— какую задачу вы хотите решить;\n— к какому сроку это нужно.\n\nЕсли удобнее голосом — просто ответьте на это письмо, и мы договоримся о коротком созвоне.\n\nС уважением',
    en: 'Hello {{lead.name}},\n\nThank you for reaching out. To suggest the right solution, could you tell us:\n— what you would like to achieve;\n— by when you need it.\n\nIf a call is easier, just reply to this email and we will arrange a short one.\n\nBest regards',
    tr: 'Merhaba {{lead.name}},\n\nBize ulaştığınız için teşekkürler. Size uygun çözümü önerebilmemiz için lütfen şunları paylaşır mısınız:\n— hangi işi çözmek istiyorsunuz;\n— ne zamana kadar gerekli.\n\nTelefonla konuşmak daha kolaysa bu e-postayı yanıtlamanız yeterli, kısa bir görüşme ayarlayalım.\n\nSaygılarımızla',
  },
};

const FOLLOWUP: StarterTemplate = {
  key: 'sales_followup',
  name: { ru: 'Напоминание после первого письма', en: 'Follow-up after the first email', tr: 'İlk e-postadan sonra takip' },
  description: { ru: 'Мягкий дожим, если клиент не ответил', en: 'Gentle follow-up when the client has not replied', tr: 'Müşteri yanıt vermediğinde nazik takip' },
  subject: { ru: '{{lead.name}}, остались вопросы?', en: '{{lead.name}}, any questions left?', tr: '{{lead.name}}, sorunuz kaldı mı?' },
  text: {
    ru: 'Здравствуйте, {{lead.name}}!\n\nВозвращаюсь к вашему запросу. Если вопрос ещё актуален — ответьте одной строкой, что для вас сейчас важнее всего, и я пришлю конкретное предложение. Если удобнее созвониться — предложите время.\n\nС уважением',
    en: 'Hello {{lead.name}},\n\nFollowing up on your request. If it is still relevant, reply with one line about what matters most to you right now and I will send a concrete proposal. If a call is easier, suggest a time.\n\nBest regards',
    tr: 'Merhaba {{lead.name}},\n\nTalebinize geri dönüyorum. Hâlâ geçerliyse, şu an sizin için en önemli olanı tek satırla yazın, size somut bir teklif göndereyim. Görüşmek daha kolaysa bir saat önerin.\n\nSaygılarımızla',
  },
};

const OFFER: StarterTemplate = {
  key: 'sales_offer',
  name: { ru: 'Предложение о сотрудничестве', en: 'Partnership proposal', tr: 'İş birliği teklifi' },
  description: { ru: 'Короткое предложение с призывом к созвону', en: 'Short proposal with a call to action', tr: 'Görüşme çağrılı kısa teklif' },
  subject: { ru: 'Предложение о сотрудничестве', en: 'Partnership proposal', tr: 'İş birliği teklifi' },
  text: {
    ru: 'Здравствуйте, {{lead.name}}!\n\nМы помогаем компаниям, как ваша, решать подобные задачи быстрее и без лишних затрат. Готовы показать, как это может выглядеть именно у вас, — на 15-минутном созвоне.\n\nКогда вам удобно?\n\nС уважением',
    en: 'Hello {{lead.name}},\n\nWe help companies like yours solve similar tasks faster and without extra cost. We would be glad to show what it could look like for you in a 15-minute call.\n\nWhen would suit you?\n\nBest regards',
    tr: 'Merhaba {{lead.name}},\n\nSizin gibi şirketlerin benzer işleri daha hızlı ve ek maliyet olmadan çözmesine yardımcı oluyoruz. Sizde nasıl olabileceğini 15 dakikalık bir görüşmede göstermekten memnuniyet duyarız.\n\nSizin için ne zaman uygun?\n\nSaygılarımızla',
  },
};

const PAYMENT: StarterTemplate = {
  key: 'finance_payment_reminder',
  name: { ru: 'Напоминание об оплате', en: 'Payment reminder', tr: 'Ödeme hatırlatması' },
  description: { ru: 'Вежливое напоминание о неоплаченном счёте', en: 'Polite reminder about an unpaid invoice', tr: 'Ödenmemiş fatura için kibar hatırlatma' },
  subject: { ru: 'Напоминание об оплате', en: 'Payment reminder', tr: 'Ödeme hatırlatması' },
  text: {
    ru: 'Здравствуйте, {{lead.name}}!\n\nНапоминаем, что оплата по вашему заказу пока не поступила. Если вы уже оплатили — просто проигнорируйте это письмо. Если есть вопросы по счёту — ответьте, мы поможем.\n\nСпасибо!',
    en: 'Hello {{lead.name}},\n\nThis is a reminder that the payment for your order has not been received yet. If you have already paid, please ignore this email. If you have questions about the invoice, just reply and we will help.\n\nThank you!',
    tr: 'Merhaba {{lead.name}},\n\nSiparişinizin ödemesinin henüz ulaşmadığını hatırlatırız. Zaten ödediyseniz bu e-postayı dikkate almayın. Fatura ile ilgili sorunuz varsa yanıtlayın, yardımcı olalım.\n\nTeşekkürler!',
  },
};

// ── ресепшн: письма гостю по брони. {{guest_name}} {{date}} {{time}} {{service}} {{place}} {{address}} подставляет
// система из брони; {{review_link}} — ссылка на отзывы из «Мозга» (проверяется, что она там есть).
const R_CONFIRM: StarterTemplate = {
  key: 'reception_confirm',
  name: { ru: 'Бронь: подтверждение гостю', en: 'Booking: confirmation to the guest', tr: 'Rezervasyon: misafire onay' },
  description: { ru: 'Отправляется при новой брони', en: 'Sent when a booking is created', tr: 'Yeni rezervasyonda gönderilir' },
  subject: { ru: '{{guest_name}}, ваша бронь подтверждена — {{date}}', en: '{{guest_name}}, your booking is confirmed — {{date}}', tr: '{{guest_name}}, rezervasyonunuz onaylandı — {{date}}' },
  text: {
    ru: 'Здравствуйте, {{guest_name}}!\n\nВаша бронь подтверждена:\n— {{service}}\n— {{date}}, {{time}}\n— {{place}}, {{address}}\n\nЕсли планы изменятся — просто ответьте на это письмо, и мы подберём другое время.\n\nДо встречи!',
    en: 'Hello {{guest_name}},\n\nYour booking is confirmed:\n— {{service}}\n— {{date}}, {{time}}\n— {{place}}, {{address}}\n\nIf your plans change, just reply to this email and we will find another time.\n\nSee you soon!',
    tr: 'Merhaba {{guest_name}},\n\nRezervasyonunuz onaylandı:\n— {{service}}\n— {{date}}, {{time}}\n— {{place}}, {{address}}\n\nPlanlarınız değişirse bu e-postayı yanıtlamanız yeterli, başka bir zaman bulalım.\n\nGörüşmek üzere!',
  },
};
const R_REMIND: StarterTemplate = {
  key: 'reception_remind',
  name: { ru: 'Бронь: напоминание накануне', en: 'Booking: reminder the day before', tr: 'Rezervasyon: bir gün önce hatırlatma' },
  description: { ru: 'За день до визита или заезда', en: 'One day before the visit or check-in', tr: 'Ziyaret veya girişten bir gün önce' },
  subject: { ru: 'Напоминание: {{date}}, {{time}}', en: 'Reminder: {{date}}, {{time}}', tr: 'Hatırlatma: {{date}}, {{time}}' },
  text: {
    ru: 'Здравствуйте, {{guest_name}}!\n\nНапоминаем: ждём вас завтра, {{date}}, в {{time}}.\n{{service}} — {{place}}, {{address}}.\n\nЕсли не получается прийти — ответьте на это письмо, перенесём.\n\nДо встречи!',
    en: 'Hello {{guest_name}},\n\nA reminder: we are expecting you tomorrow, {{date}}, at {{time}}.\n{{service}} — {{place}}, {{address}}.\n\nIf you cannot come, reply to this email and we will reschedule.\n\nSee you!',
    tr: 'Merhaba {{guest_name}},\n\nHatırlatma: sizi yarın, {{date}}, saat {{time}}’da bekliyoruz.\n{{service}} — {{place}}, {{address}}.\n\nGelemeyecekseniz bu e-postayı yanıtlayın, erteleyelim.\n\nGörüşmek üzere!',
  },
};
const R_NOSHOW: StarterTemplate = {
  key: 'reception_noshow',
  name: { ru: 'Бронь: гость не пришёл', en: 'Booking: guest did not come', tr: 'Rezervasyon: misafir gelmedi' },
  description: { ru: 'Вежливо, без упрёков — предложить новое время', en: 'Polite, no blame — offer a new time', tr: 'Kibar, suçlamadan — yeni saat öner' },
  subject: { ru: '{{guest_name}}, подберём новое время?', en: '{{guest_name}}, shall we find a new time?', tr: '{{guest_name}}, yeni bir zaman bulalım mı?' },
  text: {
    ru: 'Здравствуйте, {{guest_name}}!\n\nМы ждали вас {{date}} в {{time}}, но, похоже, не получилось прийти. Ничего страшного — ответьте на это письмо, и мы подберём удобное время.\n\nХорошего дня!',
    en: 'Hello {{guest_name}},\n\nWe were expecting you on {{date}} at {{time}}, but it seems you could not make it. No problem — reply to this email and we will find a convenient time.\n\nHave a nice day!',
    tr: 'Merhaba {{guest_name}},\n\nSizi {{date}} saat {{time}}’da bekliyorduk ama gelemediniz galiba. Sorun değil — bu e-postayı yanıtlayın, uygun bir zaman bulalım.\n\nİyi günler!',
  },
};
const R_REVIEW: StarterTemplate = {
  key: 'reception_review',
  name: { ru: 'Бронь: спасибо и отзыв', en: 'Booking: thank you and review', tr: 'Rezervasyon: teşekkür ve yorum' },
  description: { ru: 'После визита или выезда', en: 'After the visit or check-out', tr: 'Ziyaret veya çıkıştan sonra' },
  subject: { ru: 'Спасибо, что были у нас, {{guest_name}}!', en: 'Thank you for visiting, {{guest_name}}!', tr: 'Bizi ziyaret ettiğiniz için teşekkürler, {{guest_name}}!' },
  text: {
    ru: 'Здравствуйте, {{guest_name}}!\n\nСпасибо, что выбрали нас. Нам очень поможет ваш отзыв — это займёт минуту:\n{{review_link}}\n\nБудем рады видеть вас снова!',
    en: 'Hello {{guest_name}},\n\nThank you for choosing us. Your review would help us a lot — it takes a minute:\n{{review_link}}\n\nWe hope to see you again!',
    tr: 'Merhaba {{guest_name}},\n\nBizi seçtiğiniz için teşekkürler. Yorumunuz bize çok yardımcı olur — bir dakikanızı alır:\n{{review_link}}\n\nSizi yeniden görmekten mutluluk duyarız!',
  },
};

export const RECEPTION_TEMPLATE_KEYS = ['confirm', 'remind', 'noshow', 'review'] as const;

export const STARTER_TEMPLATES: Record<string, StarterTemplate[]> = {
  reception: [R_CONFIRM, R_REMIND, R_NOSHOW, R_REVIEW],
  sales: [WELCOME, FOLLOWUP, OFFER],
  marketing: [OFFER],
  finance: [PAYMENT],
};
