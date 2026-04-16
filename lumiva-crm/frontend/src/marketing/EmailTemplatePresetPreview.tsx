import React, { useMemo } from 'react';

/** Демо-значения, чтобы в превью не торчали сырые {{...}} */
const PREVIEW_PLACEHOLDERS: Record<string, string> = {
  'lead.name': 'Иван Петров',
  'lead.email': 'ivan@example.com',
  'lead.phone': '+7 900 000-00-00',
  'lead.status': 'Новый',
  'contact.fullName': 'Иван Петров',
  'contact.email': 'ivan@example.com',
  'contact.name': 'Иван Петров',
  'project.name': 'Внедрение CRM',
  'project.status': 'Переговоры',
  'project.amount': '120 000',
  'project.currency': 'EUR',
  'sale.id': 'a1b2c3d4',
  'sale.amount': '45 000',
  'sale.currency': 'EUR',
  'sale.status': 'Подтверждена',
  'company.name': 'ООО «Пример»',
};

export function fillEmailPreviewPlaceholders(html: string): string {
  if (!html) return '';
  return html.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, raw: string) => {
    const path = String(raw).trim();
    return PREVIEW_PLACEHOLDERS[path] ?? '…';
  });
}

export interface EmailTemplatePresetPreviewProps {
  html: string;
  /** Подпись для iframe (доступность) */
  previewTitle: string;
  /** Высота видимой области превью, px */
  visibleHeight?: number;
  /** Масштаб: 600px ширина макета → видимая ширина 600*scale */
  scale?: number;
  className?: string;
}

const BASE_W = 600;
const BASE_H = 780;

/**
 * Уменьшенный предпросмотр HTML письма (как в почтовом клиенте).
 * Без скриптов: sandbox без allow-scripts.
 */
export const EmailTemplatePresetPreview: React.FC<EmailTemplatePresetPreviewProps> = ({
  html,
  previewTitle,
  visibleHeight = 200,
  scale = 0.34,
  className = '',
}) => {
  const srcDoc = useMemo(() => fillEmailPreviewPlaceholders(html), [html]);
  const boxW = Math.round(BASE_W * scale);
  const boxH = visibleHeight;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-t-xl border-b border-zinc-200 bg-zinc-100 ${className}`}
      style={{ width: boxW, height: boxH }}
    >
      <iframe
        title={previewTitle}
        srcDoc={srcDoc}
        sandbox=""
        className="absolute left-0 top-0 block border-0 bg-white"
        style={{
          width: BASE_W,
          height: BASE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
