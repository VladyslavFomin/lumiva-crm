import React from 'react';
import { useTranslation } from 'react-i18next';
import type { NotificationToken } from './notificationTokens';

interface VariablePickerProps {
  tokens: NotificationToken[];
  /** Textarea/input, куда вставляется токен на позицию курсора */
  inputRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  value: string;
  onInsert: (nextValue: string) => void;
}

/** Панель чипов для вставки {{token}} в текст письма/сообщения — курсор-aware, работает с любым controlled input/textarea. */
export const VariablePicker: React.FC<VariablePickerProps> = ({ tokens, inputRef, value, onInsert }) => {
  const { t } = useTranslation();
  if (tokens.length === 0) return null;

  const insertToken = (token: string) => {
    const el = inputRef.current;
    const placeholder = `{{${token}}}`;
    if (!el) {
      onInsert(`${value}${placeholder}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const nextValue = value.slice(0, start) + placeholder + value.slice(end);
    onInsert(nextValue);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + placeholder.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="var-picker">
      <span className="var-picker-label">{t('crm.automations.form.builderUi.variablePickerLabel')}</span>
      {tokens.map((tk) => (
        <button
          key={tk.token}
          type="button"
          className="var-picker-chip"
          title={`{{${tk.token}}}`}
          onClick={() => insertToken(tk.token)}
        >
          {t(`crm.automations.form.builderUi.${tk.labelKey}`)}
        </button>
      ))}
    </div>
  );
};
