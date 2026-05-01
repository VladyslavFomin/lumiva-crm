import React from 'react';

type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id?: string;
};

export const EmbedSwitch: React.FC<Props> = ({ checked, onChange, label, id }) => {
  const sid = id || `sw-${label.replace(/\s/g, '')}`;
  return (
    <label htmlFor={sid} className="lv-embed-switch">
      <input
        id={sid}
        type="checkbox"
        className="lv-embed-switch__input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="lv-embed-switch__track" aria-hidden>
        <span className="lv-embed-switch__thumb" />
      </span>
      <span className="lv-embed-switch__text">{label}</span>
    </label>
  );
};
