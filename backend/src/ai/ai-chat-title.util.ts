/** Placeholder titles from createSession / older clients — replace from first user message. */
export function isDefaultAiChatTitle(title: string | null | undefined): boolean {
  const t = (title || '').trim().toLowerCase();
  if (!t) return true;
  return (
    t === 'новый чат' ||
    t === 'new chat' ||
    t === 'yeni sohbet'
  );
}

export function deriveAiChatTitleFromUserMessage(
  plain: string,
  visible: string,
  maxLen = 80,
): string {
  const pickFirstLine = (s: string) => {
    const line = s.split(/\r?\n/).find((x) => x.trim()) || s;
    return line.trim().slice(0, maxLen);
  };
  const p = plain.trim();
  if (p) return pickFirstLine(p);
  const v = visible.trim();
  if (v) return pickFirstLine(v);
  return 'Вложение / запрос'.slice(0, maxLen);
}
