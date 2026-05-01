export interface PageMeta {
  title: string;
  description: string;
  ogImage?: string;
}

export const SEO_META: Record<string, PageMeta> = {
  '/': {
    title: 'Lumiva CRM — современная CRM-система для бизнеса',
    description: 'Управляйте сделками, клиентами и командой в одном месте. Автоматизация, аналитика, интеграции.',
    ogImage: '/og-home.png',
  },
  '/pricing': {
    title: 'Тарифы — Lumiva CRM',
    description: 'Выберите подходящий тариф. Начните бесплатно и масштабируйтесь по мере роста.',
  },
  '/features': {
    title: 'Возможности — Lumiva CRM',
    description: 'Воронки продаж, автоматизация, аналитика, email-рассылки и многое другое.',
  },
  '/about': {
    title: 'О нас — Lumiva CRM',
    description: 'Команда Lumiva создаёт инструменты для роста бизнеса.',
  },
  '/blog': {
    title: 'Блог — Lumiva CRM',
    description: 'Статьи о продажах, маркетинге и управлении клиентами.',
  },
  '/contact': {
    title: 'Контакты — Lumiva CRM',
    description: 'Свяжитесь с нашей командой. Ответим на вопросы и поможем с запуском.',
  },
  '/faq': {
    title: 'Частые вопросы — Lumiva CRM',
    description: 'Ответы на популярные вопросы о работе с Lumiva CRM.',
  },
  '/privacy': {
    title: 'Политика конфиденциальности — Lumiva CRM',
    description: 'Как мы обрабатываем и защищаем ваши данные.',
  },
  '/terms': {
    title: 'Условия использования — Lumiva CRM',
    description: 'Условия предоставления услуг платформы Lumiva CRM.',
  },
  '/changelog': {
    title: 'Список изменений — Lumiva CRM',
    description: 'История обновлений и новых функций платформы.',
  },
  '/integrations': {
    title: 'Интеграции — Lumiva CRM',
    description: 'Подключите Lumiva CRM к вашим любимым сервисам: Telegram, WhatsApp, Google Sheets и другим.',
  },
};
