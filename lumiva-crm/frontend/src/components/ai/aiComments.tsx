import React from 'react';

/** Комментарии людей хранятся уже локализованной строкой, комментарии ИИ — ISO: приводим ISO к локальному времени пользователя. */
export function formatCommentTime(createdAt: string, locale?: string): string {
  if (/^\d{4}-\d{2}-\d{2}T/.test(createdAt)) {
    const d = new Date(createdAt);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString(locale);
  }
  return createdAt;
}

export const isAiAuthor = (author: string | undefined | null) => !!author && /\(AI\)\s*$/.test(author);

/** Строка «дата · автор» с яркой меткой ✦ AI у комментариев ИИ-сотрудников. */
export function CommentMetaLine({ createdAt, author, locale }: { createdAt: string; author: string; locale?: string }) {
  const ai = isAiAuthor(author);
  return (
    <>
      {formatCommentTime(createdAt, locale)} ·{' '}
      {ai ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '0 7px',
            borderRadius: 9,
            fontWeight: 600,
            color: '#fff',
            background: 'linear-gradient(135deg,#7c3aed,#2563eb 60%,#06b6d4)',
          }}
        >
          ✦ {author.replace(/\s*\(AI\)\s*$/, '')}
        </span>
      ) : (
        author
      )}
    </>
  );
}
