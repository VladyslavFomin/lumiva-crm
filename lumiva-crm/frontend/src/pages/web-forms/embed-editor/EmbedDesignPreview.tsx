import React from 'react';
import { useTranslation } from 'react-i18next';

function dNum(d: Record<string, unknown>, k: string, def: number) {
  const n = Number(d[k]);
  return Number.isFinite(n) ? n : def;
}

type Props = {
  design: Record<string, unknown>;
  title: string;
};

/**
 * Мини-превью: как выглядит форма с текущим design, без публичного API.
 */
export const EmbedDesignPreview: React.FC<Props> = ({ design, title }) => {
  const { t } = useTranslation();
  const d = design;
  const bg = String(d['backgroundColor'] || '#fff');
  const text = String(d['textColor'] || '#111');
  const fieldBg = String(d['fieldBackground'] || '#f9fafb');
  const border = String(d['borderColor'] || '#e5e7eb');
  const br = dNum(d, 'borderRadiusPx', 8);
  const pad = dNum(d, 'fieldPaddingPx', 10);
  const gap = dNum(d, 'gapPx', 10);
  const font = String(d['fontFamily'] || 'system-ui, sans-serif');
  const fs = dNum(d, 'fontSizePx', 14);
  const hfs = dNum(d, 'headingSizePx', 18);
  const btnBg = String(d['buttonBackground'] || '#111');
  const btnTx = String(d['buttonTextColor'] || '#fff');
  const bbr = dNum(d, 'buttonBorderRadiusPx', 8);
  const bpx = dNum(d, 'buttonPaddingXPx', 16);
  const bpy = dNum(d, 'buttonPaddingYPx', 10);
  const bw = d['buttonWidth'] === 'auto' ? 'auto' : '100%';
  const lw = dNum(d, 'labelWeight', 600);

  return (
    <div
      className="lv-embed-preview-box"
      style={{
        backgroundColor: bg,
        color: text,
        fontFamily: font,
        fontSize: fs,
      }}
    >
      <h3 style={{ fontSize: hfs, fontWeight: 600, margin: '0 0 10px' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap, marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: lw, fontSize: 12, marginBottom: 3 }}>{t('crm.embedDesignPreview.emailLabel')}</div>
          <div
            className="lv-embed-preview-inp"
            style={{
              backgroundColor: fieldBg,
              border: `1px solid ${border}`,
              borderRadius: br,
              padding: pad,
            }}
          >
            name@…
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 calc(50% - 4px)', minWidth: 0 }}>
            <div style={{ fontWeight: lw, fontSize: 12, marginBottom: 3 }}>{t('crm.embedDesignPreview.phoneLabel')}</div>
            <div
              className="lv-embed-preview-inp"
              style={{
                backgroundColor: fieldBg,
                border: `1px solid ${border}`,
                borderRadius: br,
                padding: pad,
              }}
            >
              +7 …
            </div>
          </div>
          <div style={{ flex: '1 1 calc(50% - 4px)', minWidth: 0 }}>
            <div style={{ fontWeight: lw, fontSize: 12, marginBottom: 3 }}>{t('crm.embedDesignPreview.cityLabel')}</div>
            <div
              className="lv-embed-preview-inp"
              style={{
                backgroundColor: fieldBg,
                border: `1px solid ${border}`,
                borderRadius: br,
                padding: pad,
              }}
            >
              …
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontWeight: lw, fontSize: 12, marginBottom: 3 }}>{t('crm.embedDesignPreview.messageLabel')}</div>
          <div
            className="lv-embed-preview-ta"
            style={{
              backgroundColor: fieldBg,
              border: `1px solid ${border}`,
              borderRadius: br,
              padding: pad,
              minHeight: 52,
            }}
          >
            …
          </div>
        </div>
      </div>
      <button
        type="button"
        style={{
          width: bw,
          display: 'block',
          backgroundColor: btnBg,
          color: btnTx,
          border: 'none',
          borderRadius: bbr,
          padding: `${bpy}px ${bpx}px`,
          fontWeight: 600,
          fontSize: fs,
          cursor: 'default',
        }}
      >
        {t('crm.embedDesignPreview.submitBtn')}
      </button>
    </div>
  );
};
