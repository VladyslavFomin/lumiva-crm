import { appLocale } from '../i18n/format';
// Единый форматтер денежных сумм для всего мобильного приложения.
//
// На сайте единого formatCurrency() нет — разные страницы дублируют логику по-разному:
// где-то просто `${amount} ${currency}`, в 4 местах — захардкоженная функция символов
// ТОЛЬКО на 4 валюты (TRY/USD/RUB, всё остальное падает на €, включая GBP — баг сайта).
// Здесь сознательно НЕ повторяем этот баг: Intl.NumberFormat поддерживает любой ISO 4217 код
// и сам подбирает правильный символ/позицию для любой валюты, а не только четырёх.
export function formatMoney(amount: number | string, currency: string | null | undefined): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  const code = (currency || 'EUR').toUpperCase();
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(appLocale(), {
      style: 'currency',
      currency: code,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    // Intl бросает на некорректный/неизвестный код валюты — не должно случаться
    // с реальными данными бэкенда, но не роняем экран из-за форматирования.
    return `${value.toLocaleString(appLocale())} ${code}`;
  }
}
