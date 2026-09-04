// src/esign/esign-default-templates.ts
// Shared by the one-time backfill migration and EsignService.seedDefaultTemplates() (called
// on tenant signup) — same starter templates either way, so a tenant's "Мои документы" page
// is never a bare empty gallery. Bodies use the {KEY} placeholder catalog (see esign-keys.ts).

export interface EsignDefaultTemplate {
  name: string;
  description: string;
  kind: string;
  bodyTemplate: string;
  fileNamePattern: string;
}

export const ESIGN_DEFAULT_TEMPLATES: EsignDefaultTemplate[] = [
  {
    name: 'Договор оказания услуг',
    description: 'Базовый шаблон с реквизитами сторон и предметом договора',
    kind: 'Договор',
    fileNamePattern: '{KIND}-{NAME}-{CONTRACT_DATE}',
    bodyTemplate:
      'ДОГОВОР № {CONTRACT_NO}\n{CONTRACT_DATE}\n\n' +
      '{ORG_NAME}, в лице {MANAGER}, далее «Исполнитель», и\n' +
      '{NAME}, паспорт {PASSPORT}, далее «Заказчик», заключили договор о следующем.\n\n' +
      '1. ПРЕДМЕТ\n1.1. Исполнитель оказывает услуги: {SERVICE}.\n1.2. Срок оказания услуг: {TERM}.\n\n' +
      '2. СТОИМОСТЬ И ОПЛАТА\n2.1. Стоимость услуг составляет {AMOUNT} {CURRENCY} ({AMOUNT_WORDS}).\n2.2. Порядок оплаты: {PAY_TERMS}.\n\n' +
      '3. КОНТАКТЫ СТОРОН\nЗаказчик: {NAME}, тел. {PHONE}, {EMAIL}\nИсполнитель: {ORG_NAME}, {ORG_TAX}\n\n' +
      'Подписано {TODAY}.',
  },
  {
    name: 'Счёт на оплату',
    description: 'С реквизитами и суммой к оплате',
    kind: 'Счёт',
    fileNamePattern: '{KIND}-{NAME}-{CONTRACT_DATE}',
    bodyTemplate:
      'СЧЁТ № {CONTRACT_NO} от {CONTRACT_DATE}\n\n' +
      'Плательщик: {NAME} ({COMPANY}, ИНН {TAX_ID})\n' +
      'Получатель: {ORG_NAME}, {ORG_TAX}\n\n' +
      'Услуга: {SERVICE}\nК оплате: {AMOUNT} {CURRENCY}\nСрок оплаты: {PAY_TERMS}\n\n' +
      'Ответственный: {MANAGER}',
  },
  {
    name: 'Акт выполненных работ',
    description: 'Закрывающий документ с перечнем работ и суммой',
    kind: 'Акт',
    fileNamePattern: '{KIND}-{NAME}-{CONTRACT_DATE}',
    bodyTemplate:
      'АКТ к договору № {CONTRACT_NO} от {CONTRACT_DATE}\n\n' +
      'Исполнитель {ORG_NAME} сдал, а заказчик {NAME} принял услуги: {SERVICE}.\n' +
      'Стоимость: {AMOUNT} {CURRENCY}.\nПретензий по объёму и качеству нет.\n\n' +
      'Дата: {TODAY}',
  },
  {
    name: 'Согласие на обработку данных',
    description: 'Согласие клиента на обработку персональных данных',
    kind: 'Согласие',
    fileNamePattern: '{KIND}-{NAME}-{CONTRACT_DATE}',
    bodyTemplate:
      'СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ\n\n' +
      'Я, {NAME}, паспорт {PASSPORT}, проживающий по адресу {ADDRESS},\n' +
      'даю согласие {ORG_NAME} на обработку моих персональных данных\n' +
      'в объёме: ФИО, телефон {PHONE}, почта {EMAIL}.\n\n' +
      'Дата: {TODAY}',
  },
  {
    name: 'Оферта на пакет услуг',
    description: 'Публичная оферта на пакет услуг клиенту',
    kind: 'Оферта',
    fileNamePattern: '{KIND}-{NAME}-{CONTRACT_DATE}',
    bodyTemplate:
      'ОФЕРТА\n\n' +
      'Для {NAME} на пакет: {SERVICE}\n' +
      'Стоимость пакета: {AMOUNT} {CURRENCY}\n' +
      'Срок действия оферты: {TERM}\n\n' +
      '{ORG_NAME}, {MANAGER}, {TODAY}',
  },
  {
    name: 'Доверенность',
    description: 'На представление интересов компании',
    kind: 'Доверенность',
    fileNamePattern: '{KIND}-{NAME}-{CONTRACT_DATE}',
    bodyTemplate:
      'ДОВЕРЕННОСТЬ\n\n' +
      '{ORG_NAME} настоящей доверенностью уполномочивает {NAME} представлять интересы компании ' +
      'перед третьими лицами, государственными органами и организациями по вопросам, связанным ' +
      'с деятельностью компании.\n\n' +
      'Доверенность выдана {TODAY} и действует без права передоверия, если иное не указано отдельно.',
  },
];
