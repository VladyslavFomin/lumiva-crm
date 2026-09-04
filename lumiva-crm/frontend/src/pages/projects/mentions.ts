import type { StaffUser } from '../../api/staff';

export const normalizeMentionLabel = (value?: string | null) =>
  (value ?? '').toString().trim().toLowerCase();

const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** ФИО и email каждого сотрудника — единственные "надёжные" метки для @упоминаний. */
export function mentionLabelsForStaff(staffList: StaffUser[]): string[] {
  const labels = new Set<string>();
  staffList.forEach((s) => {
    if (s.fullName?.trim()) labels.add(normalizeMentionLabel(s.fullName));
    if (s.email?.trim()) labels.add(normalizeMentionLabel(s.email));
  });
  return Array.from(labels);
}

/**
 * Упомянут ли кто-то из currentLabels в тексте. Ищем "@<метка>" подстрокой, а не
 * токенизацией по пробелу — ФИО вроде "Иван Петров" не должно обрезаться на первом слове.
 */
export function isTextMentioning(text: string, currentLabels: string[]): boolean {
  const normalizedText = normalizeMentionLabel(text);
  return currentLabels.some((label) => label && normalizedText.includes(`@${label}`));
}

/** Разбивает текст на куски для подсветки — @упоминание найденное по списку меток сотрудников. */
export function splitTextWithMentions(
  text: string,
  staffList: StaffUser[],
): Array<{ text: string; mention: boolean }> {
  const labels = staffList
    .flatMap((s) => [s.fullName, s.email])
    .filter((v): v is string => Boolean(v && v.trim()))
    .sort((a, b) => b.length - a.length);

  if (!labels.length) return [{ text, mention: false }];

  const pattern = labels.map(escapeRe).join('|');
  const re = new RegExp(`@(${pattern})`, 'giu');
  const parts: Array<{ text: string; mention: boolean }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = re.exec(text))) {
    if (match.index > lastIndex) parts.push({ text: text.slice(lastIndex, match.index), mention: false });
    parts.push({ text: match[0], mention: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), mention: false });
  return parts.length ? parts : [{ text, mention: false }];
}
