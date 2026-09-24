import React from 'react';

/** Иконки для сетки выбора типа поля — общие для модалок добавления/редактирования колонки
 * (WorkspaceTableViewPage) и списка "Управление колонками" (WorkspaceFieldsManagerDrawer). */
const FIELD_TYPE_ICON_D: Record<string, React.ReactNode> = {
  text: <path d="M4 6h16M4 12h10M4 18h8" />,
  number: (
    <>
      <path d="M7 4L5 20" />
      <path d="M17 4l-2 16" />
      <path d="M4 9h16" />
      <path d="M3 15h16" />
    </>
  ),
  date: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </>
  ),
  datetime: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9v4l3 2" />
      <path d="M9.5 2.5h5" />
    </>
  ),
  boolean: <path d="M5 12l4.5 4.5L19 7" />,
  status: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.5l2.3 2.3L15.5 9" />
    </>
  ),
  select: <path d="M6 9l6 6 6-6" />,
  multiselect: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.3" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.3" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.3" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.3" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V9z" />
      <path d="M14 3v6h6" />
    </>
  ),
  ai: <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z" />,
  crm_lead: (
    <>
      <path d="M3 12c0-5 4-9 9-9s9 4 9 9-4 9-9 9" />
      <path d="M3 12l4-4" />
      <path d="M3 12l4 4" />
    </>
  ),
  crm_project: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M8.5 4v16" />
    </>
  ),
  crm_company: (
    <>
      <path d="M4 21V7l8-4 8 4v14" />
      <path d="M9.5 21v-6h5v6" />
    </>
  ),
  readonly: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </>
  ),
  fixed: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </>
  ),
};

export function WsFieldTypeIcon({ typeKey }: { typeKey: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {FIELD_TYPE_ICON_D[typeKey] || FIELD_TYPE_ICON_D.text}
    </svg>
  );
}

/** Сетка карточек типа поля — замена плоского native <select> в модалках добавления/редактирования колонки. */
export function WsFieldTypeGrid({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="ws-type-grid">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`ws-type-card${value === opt.value ? ' on' : ''}`}
        >
          <WsFieldTypeIcon typeKey={opt.value} />
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
