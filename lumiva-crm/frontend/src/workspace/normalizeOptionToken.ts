/**
 * Нормализация значений select/status (как на бэкенде optionToken / normalizeKanbanToken):
 * сохраняет буквы Unicode (в т.ч. турецкие ığüşöç), без поломки как у [a-z]-only.
 */
export function normalizeOptionToken(value: string): string {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKC')
    .replace(/\s+/g, '_')
    .replace(/[^\p{L}\p{N}_]+/gu, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}
